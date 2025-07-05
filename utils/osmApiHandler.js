const { 
  makeOSMRequest, 
  getSessionId, 
  getOSMRateLimitInfo, 
  addRateLimitInfoToResponse,
} = require('../middleware/rateLimiting');

const { logger } = require('../config/sentry');
const fallbackLogger = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.log,
  fmt: (strings, ...values) => strings.reduce((result, string, i) => result + string + (values[i] || ''), ''),
};
const log = logger || fallbackLogger;

/**
 * Creates a standardized OSM API request handler
 * @param {string} endpoint - The endpoint name for logging
 * @param {Object} config - Configuration object
 * @param {string} config.method - HTTP method (GET, POST, etc.)
 * @param {Array<string>} config.requiredParams - Required parameters from query or body
 * @param {Function} config.buildUrl - Function to build the OSM API URL
 * @param {Function} config.buildRequestOptions - Function to build request options
 * @param {Function} config.processResponse - Optional response processor
 * @param {boolean} config.useStructuredLogging - Whether to use structured logging
 * @returns {Function} Express request handler
 */
const createOSMApiHandler = (endpoint, config) => {
  const {
    method = 'GET',
    requiredParams = [],
    buildUrl,
    buildRequestOptions,
    processResponse = null,
    useStructuredLogging = true,
  } = config;

  return async (req, res) => {
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    const requestId = `${sessionId}-${Date.now()}`;
    
    // Create endpoint logger
    const endpointLogger = {
      info: (message, data = {}) => {
        if (useStructuredLogging) {
          log.info(log.fmt`OSM API ${endpoint}: ${message}`, {
            endpoint,
            requestId,
            sessionId,
            method,
            section: 'osm-api',
            timestamp: new Date().toISOString(),
            ...data,
          });
        } else {
          console.log(`[${endpoint}] ${message}`, data);
        }
      },
      warn: (message, data = {}) => {
        if (useStructuredLogging) {
          log.warn(log.fmt`OSM API ${endpoint}: ${message}`, {
            endpoint,
            requestId,
            sessionId,
            method,
            section: 'osm-api',
            timestamp: new Date().toISOString(),
            ...data,
          });
        } else {
          console.warn(`[${endpoint}] ${message}`, data);
        }
      },
      error: (message, data = {}) => {
        if (useStructuredLogging) {
          log.error(log.fmt`OSM API ${endpoint}: ${message}`, {
            endpoint,
            requestId,
            sessionId,
            method,
            section: 'osm-api',
            timestamp: new Date().toISOString(),
            ...data,
          });
        } else {
          console.error(`[${endpoint}] ${message}`, data);
        }
      },
    };

    // Pre-call logging
    endpointLogger.info('Processing request', {
      hasToken: !!access_token,
      clientIp: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    // Validate access token
    if (!access_token) {
      endpointLogger.warn('Missing authorization token');
      return res.status(401).json({ 
        error: 'Access token is required in Authorization header',
      });
    }

    // Validate required parameters
    const missingParams = requiredParams.filter(param => {
      const value = req.query[param] || req.body[param];
      return !value;
    });

    if (missingParams.length > 0) {
      endpointLogger.warn('Missing required parameters', { 
        missingParams,
        providedQuery: Object.keys(req.query),
        providedBody: Object.keys(req.body),
      });
      return res.status(400).json({ 
        error: `Missing required parameters: ${missingParams.join(', ')}`,
      });
    }

    try {
      // Build request URL and options
      const url = buildUrl(req);
      const requestOptions = buildRequestOptions(req, access_token);

      endpointLogger.info('Sending request to OSM', {
        url: url.replace(/access_token=[^&]+/, 'access_token=***'),
        method: requestOptions.method || method,
      });

      // Make OSM API request
      const response = await makeOSMRequest(url, requestOptions, sessionId);

      endpointLogger.info('OSM response received', {
        status: response.status,
        statusText: response.statusText,
      });

      // Handle rate limiting
      if (response.status === 429) {
        const osmInfo = getOSMRateLimitInfo(sessionId);
        endpointLogger.warn('Rate limit exceeded', {
          status: response.status,
          rateLimitInfo: osmInfo,
        });
        return res.status(429).json({ 
          error: 'OSM API rate limit exceeded',
          rateLimitInfo: osmInfo,
          message: 'Please wait before making more requests',
        });
      }

      // Handle non-OK responses
      if (!response.ok) {
        const errorText = await response.text();
        endpointLogger.error('OSM API error', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 500),
        });
        return res.status(response.status).json({ 
          error: `OSM API error: ${response.status}`,
          details: errorText,
        });
      }

      // Process response
      let data;
      const responseText = await response.text();
      
      if (!responseText.trim()) {
        endpointLogger.error('Empty response from OSM API');
        return res.status(500).json({ 
          error: 'Empty response from OSM API',
        });
      }

      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        endpointLogger.error('JSON parse error', {
          parseError: parseError.message,
          responseLength: responseText.length,
          responsePreview: responseText.substring(0, 200),
        });
        return res.status(500).json({ 
          error: 'Invalid JSON response from OSM API',
          details: responseText.substring(0, 500),
        });
      }

      // Apply custom response processing if provided
      if (processResponse) {
        data = processResponse(data, req);
      }

      // Success logging
      endpointLogger.info('Request completed successfully', {
        status: response.status,
        responseSize: responseText.length,
        hasData: !!data,
        dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
        rateLimitInfo: getOSMRateLimitInfo(sessionId),
      });

      // Send response with rate limit info
      const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
      res.json(responseWithRateInfo);

    } catch (err) {
      endpointLogger.error('Internal server error', {
        error: err.message,
        stack: err.stack,
      });
      res.status(500).json({ 
        error: 'Internal Server Error', 
        details: err.message,
      });
    }
  };
};

/**
 * Creates a simple OSM API handler for basic GET requests
 * @param {string} endpoint - The endpoint name for logging
 * @param {string} baseUrl - The base OSM API URL
 * @param {Array<string>} requiredParams - Required parameters
 * @returns {Function} Express request handler
 */
const createSimpleOSMHandler = (endpoint, baseUrl, requiredParams = []) => {
  return createOSMApiHandler(endpoint, {
    method: 'GET',
    requiredParams,
    buildUrl: (req) => {
      const queryParams = new URLSearchParams();
      
      // Add all query parameters to the URL
      Object.entries(req.query).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value);
        }
      });
      
      return `${baseUrl}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    },
    buildRequestOptions: (req, access_token) => ({
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    }),
  });
};

module.exports = {
  createOSMApiHandler,
  createSimpleOSMHandler,
};