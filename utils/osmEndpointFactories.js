const { createOSMApiHandler } = require('./osmApiHandler');
const { 
  getSessionId, 
  makeOSMRequest, 
  getOSMRateLimitInfo, 
  addRateLimitInfoToResponse,
} = require('../middleware/rateLimiting');
const { logger: _logger } = require('../config/sentry');

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
 * Creates startup data endpoint handler (with special response processing)
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

    try {
      const response = await makeOSMRequest(baseUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      }, sessionId);

      if (response.status === 429) {
        const osmInfo = getOSMRateLimitInfo(sessionId);
        return res.status(429).json({ 
          error: 'OSM API rate limit exceeded',
          rateLimitInfo: osmInfo,
          message: 'Please wait before making more requests',
        });
      }

      if (!response.ok) {
        return res.status(response.status).json({ error: `OSM API error: ${response.status}` });
      }

      const responseText = await response.text();
      
      // OSM startup endpoint returns JavaScript code, remove first 18 characters to get JSON
      const jsonText = responseText.substring(18);
      
      try {
        const data = JSON.parse(jsonText);
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
      } catch (parseError) {
        return res.status(500).json({ 
          error: 'Invalid JSON in startup response from OSM API',
          details: jsonText.substring(0, 500),
        });
      }
    } catch (err) {
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
  osmEndpoints,
};