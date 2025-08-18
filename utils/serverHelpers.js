/**
 * Server utility functions to reduce redundancy in server.js
 */

/**
 * Conditional logging helper that reduces repetitive logging patterns
 * @param {boolean} enableLogging - Whether logging is enabled
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {string} message - Log message
 * @param {any} data - Optional data to log
 */
const conditionalLog = (enableLogging, level, message, data = null) => {
  if (!enableLogging) return;
  
  const logFunction = console[level] || console.log;
  if (data !== null) {
    logFunction(message, data);
  } else {
    logFunction(message);
  }
};

/**
 * Creates a standard JSON spec serving endpoint
 * @param {Object} specs - OpenAPI specifications object
 * @param {string} contentType - Content type (defaults to 'application/json')
 * @returns {Function} Express route handler
 */
const createJsonSpecEndpoint = (specs, contentType = 'application/json') => {
  return (req, res) => {
    res.setHeader('Content-Type', contentType);
    res.send(specs);
  };
};

/**
 * Creates a test endpoint with switch/case pattern
 * @param {Object} testCases - Object with test case handlers
 * @param {string} defaultParam - Default parameter name (defaults to 'type')
 * @param {string} defaultValue - Default value if param not provided
 * @returns {Function} Express route handler
 */
const createTestEndpoint = (testCases, defaultParam = 'type', defaultValue = 'info') => {
  return (req, res) => {
    const testType = req.query[defaultParam] || defaultValue;
    
    const handler = testCases[testType];
    if (handler) {
      handler(req, res);
    } else {
      const defaultHandler = testCases['default'];
      if (defaultHandler) {
        defaultHandler(req, res);
      } else {
        res.status(404).json({ error: 'Test type not found' });
      }
    }
  };
};

/**
 * Creates standardized OAuth debug response
 * @param {Object} req - Express request object
 * @param {Function} getFrontendUrl - Function to get frontend URL
 * @returns {Object} OAuth debug information
 */
const createOAuthDebugResponse = (req, getFrontendUrl) => {
  return {
    clientId: process.env.OAUTH_CLIENT_ID ? 'Set' : 'Missing',
    clientSecret: process.env.OAUTH_CLIENT_SECRET ? 'Set' : 'Missing',
    frontendUrl: getFrontendUrl(req),
    stateParam: req.query.state || 'Not set',
    frontendUrlParam: req.query.frontend_url || 'Not set',
    refererHeader: req.get('Referer') || 'Not set',
    nodeEnv: process.env.NODE_ENV || 'Not set',
    backendUrl: process.env.BACKEND_URL || 'Not set',
    authUrl: `https://www.onlinescoutmanager.co.uk/oauth/authorize?client_id=${process.env.OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.BACKEND_URL || 'https://vikings-osm-backend.onrender.com')}/oauth/callback&scope=section%3Amember%3Aread%20section%3Aprogramme%3Aread%20section%3Aevent%3Aread%20section%3Aflexirecord%3Awrite&response_type=code`,
  };
};

/**
 * Standardized server startup logging
 * @param {string} serverType - Type of server (HTTP/HTTPS)
 * @param {number} port - Port number
 * @param {string} environment - Environment name
 * @param {Object} logger - Optional structured logger
 */
const logServerStartup = (serverType, port, environment, logger = null) => {
  // Console logging for immediate feedback
  console.log(`✅ Vikings OSM Backend Server Started (${serverType})`);
  console.log(`🌐 ${serverType} Server running on port ${port}`);
  console.log(`🏠 Environment: ${environment}`);
  
  // Structured Sentry logging for monitoring (if logger provided)
  if (logger) {
    logger.info('Vikings OSM Backend Server Started', {
      environment: environment,
      port: port,
      timestamp: new Date().toISOString(),
      configuration: {
        sentryEnabled: !!process.env.SENTRY_DSN,
        oauthConfigured: !!(process.env.OAUTH_CLIENT_ID && process.env.OAUTH_CLIENT_SECRET),
        corsEnabled: true,
        rateLimitingEnabled: true,
      },
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
      },
      section: 'server-startup',
    });
  }
};

/**
 * Prints available endpoints in a standardized format
 */
const logAvailableEndpoints = () => {
  console.log('📋 Available endpoints:');
  console.log('Documentation:');
  console.log('- GET /backend-docs (Interactive Backend API Documentation)');
  console.log('- GET /backend-docs.json (Backend API OpenAPI Specification)');
  console.log('- GET /api-docs.json (Legacy Backend API OpenAPI Specification)');
  console.log('Auth:');
  console.log('- GET /oauth/callback (OAuth redirect from OSM)');
  console.log('- GET /oauth/debug (OAuth configuration debug)');
  console.log('- GET /token');
  console.log('- POST /logout');
  console.log('Rate Monitoring:');
  console.log('- GET /rate-limit-status');
  console.log('OSM API Proxy:');
  console.log('- GET /get-terms');
  console.log('- GET /get-section-config');
  console.log('- POST /get-user-roles');
  console.log('- GET /get-events');
  console.log('- GET /get-event-attendance');
  console.log('- GET /get-contact-details');
  console.log('- GET /get-list-of-members');
  console.log('- GET /get-flexi-records');
  console.log('- GET /get-flexi-structure');
  console.log('- GET /get-single-flexi-record');
  console.log('- POST /update-flexi-record');
  console.log('- POST /get-members-grid');
};

/**
 * Creates CORS origin validation function
 * @param {Array<string>} allowedOrigins - List of allowed origins
 * @param {RegExp} prPreviewPattern - Pattern for PR preview URLs
 * @returns {Function} CORS origin validation function
 */
const createCorsOriginValidator = (allowedOrigins, prPreviewPattern) => {
  return (origin, callback) => {
    console.log('🔍 CORS check for origin:', origin);
    
    // Allow requests with no origin (mobile apps, postman, etc.)
    if (!origin) {
      console.log('✅ CORS: No origin header, allowing');
      return callback(null, true);
    }
    
    // Check exact matches first
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS: Origin allowed (exact match):', origin);
      return callback(null, true);
    }
    
    // Check PR preview pattern
    if (prPreviewPattern && prPreviewPattern.test(origin)) {
      console.log('✅ CORS: Origin allowed (PR preview):', origin);
      return callback(null, true);
    }
    
    // Reject all other origins
    console.log('❌ CORS: Origin rejected:', origin);
    callback(new Error('Not allowed by CORS'));
  };
};

/**
 * OAuth callback logging helpers
 */
const oAuthCallbackLogger = {
  logCallbackReceived: (code, state, error, req) => {
    console.log('🔗 OAuth callback received:', { 
      code: code ? code.substring(0, 20) + '...' : 'none', 
      state, 
      error,
      hasCode: !!code,
      referer: req.get('Referer'),
      userAgent: req.get('User-Agent'),
    });
  },
  
  logFrontendUrlDetermination: (frontendUrl) => {
    console.log('🎯 Determining frontend URL for redirect...');
    console.log('🚀 Final frontend URL selected:', frontendUrl);
  },
  
  logTokenExchange: (tokenPayload) => {
    console.log('Attempting token exchange with OSM...');
    console.log('Token exchange payload:', {
      ...tokenPayload,
      client_secret: '***hidden***',
      code: tokenPayload.code ? tokenPayload.code.substring(0, 20) + '...' : 'none',
    });
  },
  
  logTokenExchangeAttempt: (attempt, maxRetries) => {
    console.log(`Token exchange attempt ${attempt}/${maxRetries}...`);
  },
  
  logTokenExchangeRetry: (attempt, waitTime) => {
    console.log(`Token exchange attempt ${attempt} failed`);
    console.log(`Waiting ${waitTime}ms before retry...`);
  },
  
  logTokenResponse: (tokenResponse, tokenData) => {
    console.log('Token response status:', tokenResponse.status);
    console.log('Token response:', { 
      ...tokenData, 
      access_token: tokenData.access_token ? tokenData.access_token.substring(0, 20) + '...' : 'none',
    });
  },
  
  logSuccessfulRedirect: (redirectUrl) => {
    console.log('Token exchange successful, redirecting to frontend...');
    
    // Sanitize the redirect URL to avoid logging sensitive tokens
    let sanitizedUrl = redirectUrl;
    try {
      const url = new URL(redirectUrl);
      if (url.searchParams.has('access_token')) {
        const token = url.searchParams.get('access_token');
        // Replace token with a non-reversible placeholder showing first 8 chars
        url.searchParams.set('access_token', token.substring(0, 8) + '...[REDACTED]');
        sanitizedUrl = url.toString();
      }
    } catch (error) {
      // If URL parsing fails, manually replace access_token pattern
      sanitizedUrl = redirectUrl.replace(
        /access_token=([^&]+)/g,
        (match, token) => `access_token=${token.substring(0, 8)}...[REDACTED]`,
      );
    }
    
    console.log('🎯 Redirecting to:', sanitizedUrl);
  },
};

module.exports = {
  conditionalLog,
  createJsonSpecEndpoint,
  createTestEndpoint,
  createOAuthDebugResponse,
  logServerStartup,
  logAvailableEndpoints,
  createCorsOriginValidator,
  oAuthCallbackLogger,
};