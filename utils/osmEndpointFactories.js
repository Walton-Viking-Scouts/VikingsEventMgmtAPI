const { createOSMApiHandler } = require('./osmApiHandler');
const { 
  getSessionId, 
  makeOSMRequest, 
  getOSMRateLimitInfo, 
  addRateLimitInfoToResponse,
} = require('../middleware/rateLimiting');
const { logger } = require('../config/sentry');
const { detectBlockedResponse } = require('./responseHelpers');
const {
  shouldAllowRequest,
  recordBlocked,
  recordSuccess,
  recordProbeFailure,
  getGeneration,
} = require('./osmCircuitBreaker');

/**
 * Creates a simple OSM GET endpoint handler
 * @param {string} endpoint - Endpoint name for logging
 * @param {string} baseUrl - Base OSM API URL
 * @param {Array<string>} requiredParams - Required parameters
 * @returns {Function} Express request handler
 */
const createSimpleGetHandler = (endpoint, baseUrl, requiredParams = []) => {
  return createOSMApiHandler(endpoint, {
    method: 'GET',
    requiredParams,
    buildUrl: (req) => {
      const url = new URL(baseUrl);
      
      // Add query parameters
      Object.entries(req.query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, value);
        }
      });
      
      return url.toString();
    },
    buildRequestOptions: (_req, access_token) => ({
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    }),
  });
};

/**
 * Creates a simple OSM POST endpoint handler
 * @param {string} endpoint - Endpoint name for logging
 * @param {string} baseUrl - Base OSM API URL
 * @param {Array<string>} requiredParams - Required parameters
 * @returns {Function} Express request handler
 */
const createSimplePostHandler = (endpoint, baseUrl, requiredParams = []) => {
  return createOSMApiHandler(endpoint, {
    method: 'POST',
    requiredParams,
    buildUrl: (_req) => baseUrl,
    buildRequestOptions: (req, access_token) => ({
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    }),
  });
};

/**
 * Creates a form-encoded POST endpoint handler (for OSM APIs that expect form data)
 * @param {string} endpoint - Endpoint name for logging
 * @param {string} baseUrl - Base OSM API URL
 * @param {Array<string>} requiredParams - Required parameters
 * @param {Function} buildFormData - Function to build form data from request
 * @returns {Function} Express request handler
 */
const createFormPostHandler = (endpoint, baseUrl, requiredParams, buildFormData) => {
  return createOSMApiHandler(endpoint, {
    method: 'POST',
    requiredParams,
    buildUrl: (_req) => baseUrl,
    buildRequestOptions: (req, access_token) => ({
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildFormData(req),
    }),
  });
};

/**
 * Creates a contact-related endpoint handler (with special JSON parsing)
 * @param {string} endpoint - Endpoint name for logging
 * @param {string} baseUrl - Base OSM API URL
 * @param {Array<string>} requiredParams - Required parameters
 * @returns {Function} Express request handler
 */
const createContactHandler = (endpoint, baseUrl, requiredParams = []) => {
  return createOSMApiHandler(endpoint, {
    method: 'GET',
    requiredParams,
    buildUrl: (req) => {
      const url = new URL(baseUrl);
      
      // Add query parameters
      Object.entries(req.query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, value);
        }
      });
      
      return url.toString();
    },
    buildRequestOptions: (_req, access_token) => ({
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    }),
    processResponse: (data, _req) => {
      // For contact endpoints, we just return the data as-is
      // The JSON parsing is already handled by the main handler
      return data;
    },
  });
};

/**
 * Builds a startup-data-shaped payload from OSM's OAuth resource-owner
 * endpoint. OSM retired /ext/generic/startup/ (it now returns 410 Gone),
 * but the frontend only consumes globals.{firstname,lastname,userid,email},
 * all of which the supported oauth/resource endpoint provides.
 *
 * Every failure path logs and returns a structured result so the caller can
 * propagate a truthful status - the fallback must never fail invisibly.
 *
 * @param {string} accessToken - OSM OAuth access token
 * @param {string} sessionId - Session id for rate-limit tracking
 * @returns {Promise<{data: object}|{failureStatus: number, reason: string}>}
 *   Startup-shaped payload, or the fallback's own failure status and reason
 */
const buildStartupDataFromOAuthResource = async (accessToken, sessionId) => {
  const response = await makeOSMRequest('https://www.onlinescoutmanager.co.uk/oauth/resource', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  }, sessionId);

  if (!response.ok) {
    logger.warn('Startup fallback: oauth/resource returned non-ok', {
      status: response.status,
      sessionId,
      section: 'startup-fallback',
    });
    return { failureStatus: response.status, reason: `oauth/resource returned ${response.status}` };
  }

  let payload;
  try {
    payload = await response.json();
  } catch (parseError) {
    logger.error('Startup fallback: oauth/resource returned non-JSON body', {
      error: parseError.message,
      sessionId,
      section: 'startup-fallback',
    });
    return { failureStatus: 502, reason: 'oauth/resource returned a non-JSON body' };
  }

  const user = payload?.data;
  const fullName = typeof user?.full_name === 'string' ? user.full_name.trim() : '';
  if (!fullName) {
    logger.error('Startup fallback: oauth/resource payload missing full_name', {
      hasData: !!user,
      sessionId,
      section: 'startup-fallback',
    });
    return { failureStatus: 502, reason: 'oauth/resource payload missing user data' };
  }

  const nameParts = fullName.split(/\s+/);
  const firstname = nameParts[0] || '';
  const lastname = nameParts.slice(1).join(' ');

  return {
    data: {
      globals: {
        firstname,
        lastname,
        userid: user.user_id ?? null,
        email: user.email ?? null,
      },
      _source: 'oauth-resource',
    },
  };
};

/**
 * Creates startup data endpoint handler (with special response processing).
 * When OSM's startup endpoint returns 410 Gone (retired), falls back to the
 * OAuth resource-owner endpoint via buildStartupDataFromOAuthResource.
 *
 * @param {string} endpoint - Endpoint name for logging
 * @param {string} baseUrl - Base OSM API URL
 * @returns {Function} Express request handler
 */
const createStartupHandler = (endpoint, baseUrl) => {
  // Special handler for startup endpoint that needs custom response processing
  return async (req, res) => {
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    
    if (!access_token) {
      return res.status(401).json({ error: 'Access token is required in Authorization header' });
    }

    if (!shouldAllowRequest()) {
      logger.warn('OSM circuit breaker open - startup request blocked without calling OSM', { sessionId });
      return res.status(503).json({
        error: 'OSM API access blocked - sign in again to reconnect',
        blocked: true,
      });
    }

    const breakerGeneration = getGeneration();

    try {
      const response = await makeOSMRequest(baseUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      }, sessionId);

      if (response.status === 429) {
        recordProbeFailure(breakerGeneration);
        const osmInfo = getOSMRateLimitInfo(sessionId);
        return res.status(429).json({
          error: 'OSM API rate limit exceeded',
          rateLimitInfo: osmInfo,
          message: 'Please wait before making more requests',
        });
      }

      if (response.status === 410) {
        let fallback;
        try {
          fallback = await buildStartupDataFromOAuthResource(access_token, sessionId);
        } catch (fallbackErr) {
          logger.error('Startup fallback threw', {
            error: fallbackErr.message,
            sessionId,
            section: 'startup-fallback',
          });
          fallback = { failureStatus: 502, reason: `oauth/resource request failed: ${fallbackErr.message}` };
        }

        if (fallback.data) {
          recordSuccess(breakerGeneration);
          logger.info('Startup data served from oauth/resource fallback', {
            sessionId,
            section: 'startup-fallback',
          });
          const responseWithRateInfo = addRateLimitInfoToResponse(req, res, fallback.data);
          return res.json(responseWithRateInfo);
        }

        recordProbeFailure(breakerGeneration);

        if (fallback.failureStatus === 429) {
          const osmInfo = getOSMRateLimitInfo(sessionId);
          return res.status(429).json({
            error: 'OSM API rate limit exceeded',
            rateLimitInfo: osmInfo,
            message: 'Please wait before making more requests',
          });
        }

        return res.status(502).json({
          error: `OSM startup endpoint returned 410 and the oauth/resource fallback failed (${fallback.reason})`,
        });
      }

      if (!response.ok) {
        recordProbeFailure(breakerGeneration);
        return res.status(response.status).json({ error: `OSM API error: ${response.status}` });
      }

      const responseText = await response.text();

      // OSM startup endpoint returns JavaScript code, remove first 18 characters to get JSON
      const jsonText = responseText.substring(18);

      try {
        const data = JSON.parse(jsonText);
        recordSuccess(breakerGeneration);
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
      } catch (parseError) {
        if (detectBlockedResponse(responseText)) {
          recordBlocked();
          logger.error('OSM returned Blocked page on startup data', {
            sessionId,
            parseError: parseError.message,
            responseLength: responseText.length,
            responsePreview: responseText.substring(0, 15000),
          });
          return res.status(503).json({
            error: 'OSM API access blocked - sign in again to reconnect',
            blocked: true,
            details: responseText.substring(0, 1000),
          });
        }
        recordProbeFailure(breakerGeneration);
        logger.error('Invalid JSON in startup response from OSM API', {
          sessionId,
          parseError: parseError.message,
          responseLength: responseText.length,
          responsePreview: responseText.substring(0, /^\s*</.test(responseText) ? 15000 : 200),
        });
        return res.status(500).json({
          error: 'Invalid JSON in startup response from OSM API',
          details: jsonText.substring(0, 500),
        });
      }
    } catch (err) {
      recordProbeFailure(breakerGeneration);
      res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
  };
};

/**
 * Creates flexi record update endpoint handler
 * @param {string} endpoint - Endpoint name for logging
 * @param {string} baseUrl - Base OSM API URL
 * @param {Array<string>} requiredParams - Required parameters
 * @param {Function} customValidation - Optional custom validation function
 * @returns {Function} Express request handler
 */
const createFlexiUpdateHandler = (endpoint, baseUrl, requiredParams, customValidation = null) => {
  return createOSMApiHandler(endpoint, {
    method: 'POST',
    requiredParams,
    buildUrl: (_req) => baseUrl,
    buildRequestOptions: (req, access_token) => {
      // Build form data for OSM API
      const formData = new URLSearchParams();
      
      // Add all body parameters to form data
      Object.entries(req.body).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, value);
        }
      });
      
      return {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      };
    },
    // Custom validation for flexi record endpoints
    customValidation,
  });
};

/**
 * Base URL for OSM's online payments (subscriptions) API family.
 */
const ONLINE_PAYMENTS_BASE = 'https://www.onlinescoutmanager.co.uk/ext/finances/onlinepayments/';

/**
 * Creates a handler for an OSM online payments (subscriptions) endpoint.
 *
 * Only the named query parameters are forwarded to OSM, so callers cannot
 * inject arbitrary query keys into the finance API. Every forwarded value must
 * be a single string from the query string; array/object values (repeated or
 * bracketed keys) and body-supplied values are rejected with 400.
 *
 * OSM does not document these response shapes, so the response is normalised
 * to always be a JSON object: a top-level array is wrapped as `{ items }` and
 * a bare scalar as `{ value }`, so the rate-limit wrapper cannot mangle it.
 *
 * @param {string} endpoint - Endpoint name for logging
 * @param {string} path - Path segment under the online payments base URL ('' for the root)
 * @param {string} action - OSM `action` query value
 * @param {Array<string>} requiredParams - Required query parameters
 * @param {Array<string>} [optionalParams] - Optional query parameters forwarded when present
 * @returns {Function} Express request handler
 */
const createOnlinePaymentsHandler = (endpoint, path, action, requiredParams, optionalParams = []) => {
  const forwardedParams = [...requiredParams, ...optionalParams];

  const validationError = (message) => {
    const err = new Error(message);
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    return err;
  };

  return createOSMApiHandler(endpoint, {
    method: 'GET',
    requiredParams,
    buildUrl: (req) => {
      const url = new URL(`${ONLINE_PAYMENTS_BASE}${path}`);
      url.searchParams.set('action', action);

      const invalid = forwardedParams.filter((param) => {
        const value = req.query[param];
        return value !== undefined && typeof value !== 'string';
      });
      if (invalid.length > 0) {
        throw validationError(`Parameter ${invalid.join(', ')} must be a single value`);
      }

      const missing = requiredParams.filter((param) => !req.query[param]);
      if (missing.length > 0) {
        throw validationError(`Missing required query parameters: ${missing.join(', ')}`);
      }

      forwardedParams.forEach((param) => {
        const value = req.query[param];
        if (value) {
          url.searchParams.set(param, value);
        }
      });

      return url.toString();
    },
    buildRequestOptions: (_req, access_token) => ({
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    }),
    processResponse: (data, _req) => {
      if (Array.isArray(data)) {
        return { items: data };
      }
      if (data === null || typeof data !== 'object') {
        return { value: data };
      }
      return data;
    },
  });
};

/**
 * Pre-configured endpoint handlers for common OSM APIs
 */
const osmEndpoints = {
  // Simple GET endpoints
  getTerms: () => createSimpleGetHandler(
    'getTerms',
    'https://www.onlinescoutmanager.co.uk/api.php?action=getTerms',
    [],
  ),
  
  getSectionConfig: () => createSimpleGetHandler(
    'getSectionConfig',
    'https://www.onlinescoutmanager.co.uk/api.php?action=getSectionConfig',
    ['sectionid'],
  ),
  
  getUserRoles: () => createSimpleGetHandler(
    'getUserRoles',
    'https://www.onlinescoutmanager.co.uk/api.php?action=getUserRoles',
    [],
  ),
  
  getEvents: () => createOSMApiHandler('getEvents', {
    method: 'GET',
    requiredParams: ['sectionid', 'termid'],
    buildUrl: (req) => {
      const url = new URL('https://www.onlinescoutmanager.co.uk/ext/events/summary/?action=get');
      
      // Add query parameters
      Object.entries(req.query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, value);
        }
      });
      
      return url.toString();
    },
    buildRequestOptions: (_req, access_token) => ({
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    }),
    processResponse: (data, _req) => {
      // Convert UK date format (dd/mm/yyyy) to ISO format for frontend
      if (data.items && Array.isArray(data.items)) {
        data.items = data.items.map(event => {
          const convertedEvent = { ...event };
          
          // Convert date fields from dd/mm/yyyy to ISO format
          const dateFields = ['date', 'startdate', 'enddate'];
          dateFields.forEach(field => {
            if (convertedEvent[field] && convertedEvent[field].includes('/')) {
              // Convert dd/mm/yyyy to yyyy-mm-dd
              const [day, month, year] = convertedEvent[field].split('/');
              if (day && month && year) {
                convertedEvent[field + '_iso'] = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                // Keep original for backward compatibility
                convertedEvent[field + '_original'] = convertedEvent[field];
                // Update main field to be JavaScript-friendly (mm/dd/yyyy)
                convertedEvent[field] = `${month}/${day}/${year}`;
              }
            }
          });
          
          return convertedEvent;
        });
      }
      
      return data;
    },
  }),
  
  getEventAttendance: () => createSimpleGetHandler(
    'getEventAttendance',
    'https://www.onlinescoutmanager.co.uk/ext/events/event/?action=getAttendance',
    ['sectionid', 'termid', 'eventid'],
  ),

  getProgrammeSummary: () => createSimpleGetHandler(
    'getProgrammeSummary',
    'https://www.onlinescoutmanager.co.uk/ext/programme/?action=getProgrammeSummary&verbose=1',
    ['sectionid', 'termid'],
  ),
  
  // Contact-related endpoints (with special handling)
  getContactDetails: () => createContactHandler(
    'getContactDetails',
    'https://www.onlinescoutmanager.co.uk/ext/members/contact/?action=getIndividual',
    ['sectionid', 'scoutid'],
  ),
  
  getListOfMembers: () => createContactHandler(
    'getListOfMembers',
    'https://www.onlinescoutmanager.co.uk/ext/members/contact/?action=getListOfMembers',
    ['sectionid', 'termid', 'section'],
  ),
  
  // Flexi record endpoints
  getFlexiRecords: () => createSimpleGetHandler(
    'getFlexiRecords',
    'https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=getFlexiRecords',
    ['sectionid'], // archived parameter is optional
  ),
  
  getFlexiStructure: () => createOSMApiHandler('getFlexiStructure', {
    method: 'GET',
    requiredParams: ['sectionid', 'flexirecordid', 'termid'],
    buildUrl: (req) => {
      const { sectionid, flexirecordid, termid } = req.query;
      return `https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=getStructure&sectionid=${sectionid}&extraid=${flexirecordid}&termid=${termid}`;
    },
    buildRequestOptions: (_req, access_token) => ({
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    }),
    processResponse: (data, _req) => {
      return data;
    },
  }),
  
  getSingleFlexiRecord: () => createOSMApiHandler('getSingleFlexiRecord', {
    method: 'GET',
    requiredParams: ['sectionid', 'flexirecordid', 'termid'],
    buildUrl: (req) => {
      const { sectionid, flexirecordid, termid } = req.query;
      return `https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=getData&extraid=${flexirecordid}&sectionid=${sectionid}&termid=${termid}&nototal`;
    },
    buildRequestOptions: (_req, access_token) => ({
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    }),
    processResponse: (data, _req) => {
      return data;
    },
  }),
  
  // Event summary endpoints
  getEventSummary: () => createOSMApiHandler('getEventSummary', {
    method: 'GET',
    requiredParams: ['eventid'],
    buildUrl: (req) => {
      const { eventid } = req.query;
      return `https://www.onlinescoutmanager.co.uk/v3/events/event/${eventid}/summary`;
    },
    buildRequestOptions: (_req, access_token) => ({
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    }),
    processResponse: (data, _req) => {
      // Process the complex event summary data structure
      // We could potentially flatten or reorganize the data here for easier frontend consumption
      return data;
    },
  }),

  // Shared events endpoints
  getEventSharingStatus: () => createSimpleGetHandler(
    'getEventSharingStatus',
    'https://www.onlinescoutmanager.co.uk/ext/events/event/sharing/?action=getStatus',
    ['eventid', 'sectionid'],
  ),

  getSharedEventAttendance: () => createSimpleGetHandler(
    'getSharedEventAttendance',
    'https://www.onlinescoutmanager.co.uk/ext/events/event/sharing/?action=getAttendance',
    ['eventid', 'sectionid'],
  ),

  // Online payments / subscriptions endpoints (require section:finance:read scope)
  getPaymentSchemes: () => createOnlinePaymentsHandler(
    'getPaymentSchemes',
    '',
    'getSchemes',
    ['section_id'],
  ),

  getPaymentSchedule: () => createOnlinePaymentsHandler(
    'getPaymentSchedule',
    'schedule/',
    'getPaymentSchedule',
    ['section_id', 'scheme_id'],
    ['term_id', 'all'],
  ),

  getPaymentScheduleDetails: () => createOnlinePaymentsHandler(
    'getPaymentScheduleDetails',
    'details/',
    'getDetails',
    ['section_id', 'scheme_id', 'term_id'],
  ),

  getPaymentStatus: () => createOnlinePaymentsHandler(
    'getPaymentStatus',
    'status/',
    'getPaymentStatus',
    ['section_id', 'scheme_id', 'term_id'],
    ['include_payload'],
  ),

  getUninitiatedPayments: () => createOnlinePaymentsHandler(
    'getUninitiatedPayments',
    'uninitiated/',
    'getUninitiated',
    ['section_id', 'scheme_id', 'term_id'],
  ),

  // Startup endpoint (with special response processing)
  getStartupData: () => createStartupHandler(
    'getStartupData',
    'https://www.onlinescoutmanager.co.uk/ext/generic/startup/?action=getData',
  ),
};

module.exports = {
  createSimpleGetHandler,
  createSimplePostHandler,
  createFormPostHandler,
  createContactHandler,
  createStartupHandler,
  createFlexiUpdateHandler,
  createOnlinePaymentsHandler,
  osmEndpoints,
};