const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const https = require('https');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

// Initialize Sentry
const { Sentry, logger } = require('./config/sentry');

// Import middleware and controllers
const { backendRateLimit } = require('./middleware/rateLimiting');
const authController = require('./controllers/auth');
const osmController = require('./controllers/osm');

// Import Swagger documentation
const frontendApiDocs = require('./docs/frontend-api/swagger');
// Temporarily disable OSM docs to fix conflicts
// const osmApiDocs = require('./docs/osm-api/swagger');

// Import server utilities to reduce redundancy
const {
  conditionalLog,
  createJsonSpecEndpoint,
  createTestEndpoint,
  createOAuthDebugResponse,
  logServerStartup,
  logAvailableEndpoints,
  createCorsOriginValidator,
  oAuthCallbackLogger,
} = require('./utils/serverHelpers');

// Successfully loaded documentation
console.log('✅ Frontend API docs loaded:', frontendApiDocs.specs.info.title, '(' + Object.keys(frontendApiDocs.specs.paths).length + ' endpoints)');
// console.log('✅ OSM API docs loaded:', osmApiDocs.specs.info.title, '(' + Object.keys(osmApiDocs.specs.paths).length + ' endpoints)');

const app = express();

// Centralized frontend URL determination utility
const getFrontendUrl = (req, options = {}) => {
  const { state } = req.query;
  const enableLogging = options.enableLogging || false;
  
  conditionalLog(enableLogging, 'log', '🔍 getFrontendUrl - State:', state);
  conditionalLog(enableLogging, 'log', '🔍 getFrontendUrl - Referer:', req.get('Referer'));
  
  // 1. EXPLICIT PARAMETER (Highest Priority)
  // Allows frontend to explicitly specify redirect URL
  const frontendUrlParam = req.query.frontend_url;
  if (frontendUrlParam) {
    conditionalLog(enableLogging, 'log', '✅ Frontend URL from explicit parameter:', frontendUrlParam);
    return frontendUrlParam;
  }
  
  // 2. REFERER HEADER DETECTION (Most Reliable for Deployed Environments)
  // Automatically detects the correct frontend URL from the request origin
  const referer = req.get('Referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      
      // Handle all Render.com deployments (production + PR previews)
      if (refererUrl.hostname.includes('.onrender.com')) {
        const detectedUrl = `${refererUrl.protocol}//${refererUrl.hostname}`;
        conditionalLog(enableLogging, 'log', '✅ Frontend URL from Referer (Render):', detectedUrl);
        return detectedUrl;
      }
      
      // Handle localhost development
      if (refererUrl.hostname === 'localhost' || refererUrl.hostname === '127.0.0.1') {
        const detectedUrl = `${refererUrl.protocol}//${refererUrl.hostname}:${refererUrl.port}`;
        conditionalLog(enableLogging, 'log', '✅ Frontend URL from Referer (localhost):', detectedUrl);
        return detectedUrl;
      }
      
    } catch (error) {
      conditionalLog(enableLogging, 'log', '❌ Error parsing Referer header:', error.message);
    }
  }
  
  // 3. ENVIRONMENT VARIABLE (Configuration-Based)
  // Use configured frontend URL for the deployment environment
  if (process.env.FRONTEND_URL) {
    conditionalLog(enableLogging, 'log', '✅ Frontend URL from environment variable:', process.env.FRONTEND_URL);
    return process.env.FRONTEND_URL;
  }
  
  // 4. STATE-BASED DETECTION (Simple Development/Production)
  // Basic fallback for common development scenarios
  if (state === 'dev' || state === 'development' || process.env.NODE_ENV === 'development') {
    const devUrl = 'https://localhost:3001';
    conditionalLog(enableLogging, 'log', '✅ Frontend URL for development:', devUrl);
    return devUrl;
  }
  
  // 5. DEFAULT FALLBACK (Production)
  // Default to main production frontend
  const defaultUrl = 'https://vikingeventmgmt.onrender.com';
  conditionalLog(enableLogging, 'log', '⚠️ Using default production frontend URL:', defaultUrl);
  return defaultUrl;
};

// Sentry request handler (must be first middleware) - v9 API handles this automatically
if (Sentry && process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
  console.log('✅ Sentry request handlers added via expressIntegration');
} else {
  console.log('⚠️ Sentry request handlers NOT added - Sentry:', !!Sentry, 'DSN:', !!process.env.SENTRY_DSN, 'ENV:', process.env.NODE_ENV);
}

// Dynamic CORS configuration to allow production, localhost, and specific PR previews
const allowedOrigins = [
  'https://vikings-eventmgmt.onrender.com',  // Production frontend (vanilla)
  'https://vikingeventmgmt.onrender.com',    // Production frontend (React mobile)
  'https://localhost:3000',                  // Development frontend (vanilla)
  'http://localhost:3000',                   // Development frontend (vanilla - http)
  'https://localhost:3001',                  // Development frontend (React mobile)
  'http://localhost:3001',                   // Development frontend (React mobile - http)
];
const prPreviewPattern = /^https:\/\/vikingeventmgmt-pr-\d+\.onrender\.com$/;

app.use(cors({
  origin: createCorsOriginValidator(allowedOrigins, prPreviewPattern),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
}));

app.use(express.json());
app.use(cookieParser());
app.use(backendRateLimit); // Apply rate limiting middleware to all routes

// ========================================
// ROUTES - Using imported controllers
// ========================================

// Backend API Documentation endpoints - Clean setup
const swaggerUi = require('swagger-ui-express');
app.use('/backend-docs', swaggerUi.serve);
app.get('/backend-docs', swaggerUi.setup(frontendApiDocs.specs, {
  customSiteTitle: 'Vikings OSM Backend API Documentation',
  explorer: false,
}));


// Serve Backend API OpenAPI spec as JSON
app.get('/backend-docs.json', createJsonSpecEndpoint(frontendApiDocs.specs));

// Keep old endpoint for backward compatibility
app.get('/api-docs.json', createJsonSpecEndpoint(frontendApiDocs.specs));

// OSM API Documentation endpoints - DISABLED to fix conflicts
// const osmApp = require('express')();
// const osmSwaggerUi = require('swagger-ui-express');
// osmApp.use('/static', osmSwaggerUi.serve);
// osmApp.get('/', osmSwaggerUi.setup(osmApiDocs.specs, {
//   customSiteTitle: 'OSM API Documentation (Unofficial)',
//   explorer: false,
// }));
// app.use('/osm-api-docs', osmApp);

// // Serve OSM API OpenAPI spec as JSON
// app.get('/osm-api-docs.json', (req, res) => {
//   res.setHeader('Content-Type', 'application/json');
//   res.send(osmApiDocs.specs);
// });

// Rate limit monitoring endpoint
app.get('/rate-limit-status', osmController.getRateLimitStatus);

// OAuth/Authentication endpoints
app.get('/token', authController.getCurrentToken);
app.post('/logout', authController.logout);

// Add comprehensive API monitoring middleware
const apiMonitoringMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Start transaction for API monitoring
  const transaction = Sentry.startTransaction({
    name: `${req.method} ${req.path}`,
    op: 'http.server',
    data: {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
    },
  });
  
  // Store transaction on request for use in route handlers
  req.sentryTransaction = transaction;
  
  // Track API request
  Sentry.addBreadcrumb({
    category: 'api',
    message: `API request: ${req.method} ${req.path}`,
    level: 'info',
    data: {
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
    },
  });
  
  // Override res.json to track response
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Track response metrics
    Sentry.addBreadcrumb({
      category: 'api',
      message: `API response: ${statusCode} in ${duration}ms`,
      level: statusCode >= 400 ? 'warning' : 'info',
      data: {
        statusCode,
        duration,
        method: req.method,
        path: req.path,
        responseSize: JSON.stringify(data).length,
      },
    });
    
    // Track slow requests
    if (duration > 5000) {
      Sentry.captureMessage('Slow API response detected', {
        level: 'warning',
        tags: {
          section: 'performance',
          alert_type: 'slow_response',
        },
        extra: {
          method: req.method,
          path: req.path,
          duration,
          statusCode,
          userAgent: req.get('User-Agent'),
        },
      });
    }
    
    // Track error responses
    if (statusCode >= 400) {
      Sentry.captureMessage('API error response', {
        level: statusCode >= 500 ? 'error' : 'warning',
        tags: {
          section: 'api',
          error_type: 'http_error',
          status_code: statusCode,
        },
        extra: {
          method: req.method,
          path: req.path,
          duration,
          statusCode,
          responseData: statusCode >= 500 ? data : undefined,
        },
      });
    }
    
    // Set transaction status and finish
    if (statusCode >= 500) {
      transaction.setStatus('internal_error');
    } else if (statusCode >= 400) {
      transaction.setStatus('invalid_argument');
    } else {
      transaction.setStatus('ok');
    }
    
    transaction.finish();
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Apply API monitoring middleware to all routes
app.use(apiMonitoringMiddleware);

// Enhanced health endpoint with Sentry metrics
app.get('/health', (req, res) => {
  const { getTokenStats } = require('./controllers/auth');
  const stats = getTokenStats();
  const uptime = Math.round(process.uptime());
  
  // Track health check
  Sentry.addBreadcrumb({
    category: 'health',
    message: 'Health check requested',
    level: 'info',
    data: {
      uptime,
      tokenCount: stats.total,
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
  });
  
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: uptime + ' seconds',
    environment: process.env.NODE_ENV || 'development',
    tokenStats: {
      total: stats.total,
      active: stats.active,
      expired: stats.expired,
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
    },
    configuration: {
      backendUrl: process.env.BACKEND_URL || 'Not set',
      frontendUrlConfigured: !!process.env.FRONTEND_URL,
      oauthConfigured: !!(process.env.OAUTH_CLIENT_ID && process.env.OAUTH_CLIENT_SECRET),
      sentryConfigured: !!process.env.SENTRY_DSN,
    },
    monitoring: {
      sentryEnabled: !!Sentry,
      sentryDsn: process.env.SENTRY_DSN ? 'Configured' : 'Not configured',
      environment: process.env.NODE_ENV || 'development',
    },
  };
  
  // Alert on high memory usage
  const memoryUsageMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  if (memoryUsageMB > 200) {
    Sentry.captureMessage('High memory usage detected', {
      level: 'warning',
      tags: {
        section: 'health',
        alert_type: 'high_memory',
      },
      extra: {
        memoryUsageMB,
        tokenCount: stats.total,
        uptime,
      },
    });
  }
  
  // Alert on high token count
  if (stats.total > 50) {
    Sentry.captureMessage('High token count detected', {
      level: 'warning',
      tags: {
        section: 'health',
        alert_type: 'high_token_count',
      },
      extra: {
        tokenStats: stats,
        uptime,
      },
    });
  }
  
  res.json(healthData);
});

// Token management endpoint for debugging (remove in production)
app.get('/admin/tokens', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Admin endpoints disabled in production' });
  }
  
  const { getTokenStats, userTokens } = require('./controllers/auth');
  const stats = getTokenStats();
  
  // Get detailed token info without exposing actual tokens
  const tokenDetails = [];
  const now = Date.now();
  
  for (const [sessionId, tokenData] of userTokens.entries()) {
    const timeToExpiry = tokenData.expires_at - now;
    const isExpired = timeToExpiry <= 0;
    
    tokenDetails.push({
      sessionId: sessionId.length > 10 ? sessionId.substring(0, 10) + '...' : sessionId,
      tokenType: tokenData.token_type,
      expiresAt: new Date(tokenData.expires_at).toISOString(),
      timeToExpiry: isExpired ? 'Expired' : `${Math.floor(timeToExpiry / 1000)}s`,
      isExpired,
      createdAt: new Date(tokenData.created_at).toISOString(),
      scope: tokenData.scope || 'Not specified',
    });
  }
  
  res.json({
    summary: stats,
    tokens: tokenDetails.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    actions: {
      cleanup: 'POST /admin/tokens/cleanup',
      clearAll: 'POST /admin/tokens/clear',
    },
  });
});

// Token cleanup endpoint
app.post('/admin/tokens/cleanup', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Admin endpoints disabled in production' });
  }
  
  const { userTokens } = require('./controllers/auth');
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [sessionId, tokenData] of userTokens.entries()) {
    if (now > tokenData.expires_at) {
      userTokens.delete(sessionId);
      cleanedCount++;
    }
  }
  
  res.json({
    message: `Cleaned up ${cleanedCount} expired tokens`,
    remaining: userTokens.size,
  });
});

// Clear all tokens endpoint
app.post('/admin/tokens/clear', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Admin endpoints disabled in production' });
  }
  
  const { userTokens } = require('./controllers/auth');
  const clearedCount = userTokens.size;
  userTokens.clear();
  
  res.json({
    message: `Cleared all ${clearedCount} tokens`,
    remaining: 0,
  });
});

// OSM API proxy endpoints (with rate limiting)
app.get('/get-terms', osmController.getTerms); // Updated to GET
app.get('/get-section-config', osmController.getSectionConfig); // Updated to GET
app.get('/get-user-roles', osmController.getUserRoles); // Updated to GET
app.get('/get-events', osmController.getEvents); // Updated to GET
app.get('/get-event-attendance', osmController.getEventAttendance);
app.get('/get-contact-details', osmController.getContactDetails);
app.get('/get-list-of-members', osmController.getListOfMembers);
app.get('/get-flexi-records', osmController.getFlexiRecords);
app.get('/get-flexi-structure', osmController.getFlexiStructure);
app.get('/get-single-flexi-record', osmController.getSingleFlexiRecord);
app.post('/update-flexi-record', osmController.updateFlexiRecord);
app.post('/multi-update-flexi-record', osmController.multiUpdateFlexiRecord);
app.get('/get-startup-data', osmController.getStartupData);
app.post('/get-members-grid', osmController.getMembersGrid);

// Sentry test endpoint
app.get('/test-sentry', createTestEndpoint({
  'error': (_req, _res) => {
    throw new Error('Test error for Sentry - this is expected!');
  },
  'message': (req, res) => {
    if (Sentry) {
      Sentry.captureMessage('Test message from backend', 'info');
    }
    res.json({ message: 'Test message sent to Sentry' });
  },
  'exception': (req, res) => {
    if (Sentry) {
      Sentry.captureException(new Error('Test exception for Sentry'));
    }
    res.json({ message: 'Test exception sent to Sentry' });
  },
  'default': (req, res) => {
    res.json({ 
      message: 'Sentry test endpoint',
      usage: '?type=error|message|exception',
      sentryEnabled: !!Sentry && !!process.env.SENTRY_DSN,
      debug: {
        sentryObject: !!Sentry,
        dsn: process.env.SENTRY_DSN ? 'Set' : 'Missing',
        nodeEnv: process.env.NODE_ENV,
        testEnv: process.env.NODE_ENV === 'test',
      },
    });
  },
}, 'type', 'error'));

// Rate limiting test endpoint for development
app.get('/test-rate-limits', createTestEndpoint({
  'backend-stress': (req, res) => {
    // This will trigger backend rate limiting after multiple requests
    res.json({ 
      message: 'Backend stress test - make 100+ requests rapidly to trigger rate limit',
      endpoint: '/test-rate-limits?type=backend-stress',
      tip: 'Use: for i in {1..105}; do curl "http://localhost:3000/test-rate-limits?type=backend-stress" & done',
    });
  },
  'osm-simulation': (req, res) => {
    // Simulate OSM rate limit info
    res.set({
      'X-RateLimit-Limit': '1000',
      'X-RateLimit-Remaining': '5',
      'X-RateLimit-Reset': Math.floor(Date.now() / 1000) + 3600,
    });
    res.json({ 
      message: 'OSM rate limit simulation - low remaining requests',
      rateLimitHeaders: {
        limit: 1000,
        remaining: 5,
        reset: Math.floor(Date.now() / 1000) + 3600,
      },
    });
  },
  'default': (req, res) => {
    res.json({
      message: 'Rate limiting test endpoint',
      usage: {
        'backend-stress': 'Test backend rate limiting (100 req/min)',
        'osm-simulation': 'Simulate OSM rate limit headers',
      },
      currentLimits: {
        backend: '100 requests per minute per user/IP',
        osm: 'Dynamic based on OSM API responses',
      },
    });
  },
}));

// Add OAuth environment validation endpoint for debugging
app.get('/oauth/debug', (req, res) => {
  const { getTokenStats } = require('./controllers/auth');
  const { getSessionId } = require('./middleware/rateLimiting');
  
  const sessionId = getSessionId(req);
  const tokenStats = getTokenStats();
  
  res.json({
    configuration: {
      clientId: process.env.OAUTH_CLIENT_ID ? 'Set' : 'Missing',
      clientSecret: process.env.OAUTH_CLIENT_SECRET ? 'Set' : 'Missing',
      backendUrl: process.env.BACKEND_URL || 'Not set',
      frontendUrl: process.env.FRONTEND_URL || 'Not set',
    },
    runtime: {
      detectedFrontendUrl: getFrontendUrl(req),
      referer: req.get('Referer') || 'None',
      userAgent: req.get('User-Agent') || 'None',
      currentSessionId: sessionId,
      hasSessionCookie: !!req.cookies?.session_id,
      sessionCookieValue: req.cookies?.session_id || 'None',
    },
    tokenStorage: {
      totalTokens: tokenStats.total,
      activeTokens: tokenStats.active,
      expiredTokens: tokenStats.expired,
      memoryUsage: tokenStats.total > 0 ? 'In-memory (not persistent)' : 'Empty',
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: process.env.PORT || '3000',
      timestamp: new Date().toISOString(),
    },
    warnings: [
      tokenStats.total > 100 ? 'High token count - consider cleanup' : null,
      tokenStats.expired > 0 ? `${tokenStats.expired} expired tokens need cleanup` : null,
      !process.env.BACKEND_URL ? 'BACKEND_URL not set' : null,
      !process.env.FRONTEND_URL ? 'FRONTEND_URL not set' : null,
    ].filter(Boolean),
    authUrl: `https://www.onlinescoutmanager.co.uk/oauth/authorize?client_id=${process.env.OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.BACKEND_URL || 'https://vikings-osm-backend.onrender.com')}/oauth/callback&scope=section%3Amember%3Aread%20section%3Aprogramme%3Aread%20section%3Aevent%3Aread%20section%3Aevent%3Awrite&response_type=code&state=debug`,
  });
});

// Frontend URL detection test endpoint
app.get('/test-frontend-url', (req, res) => {
  const detectedUrl = getFrontendUrl(req, { enableLogging: true });
  
  // Parse the current request to understand the context
  const referer = req.get('Referer');
  const userAgent = req.get('User-Agent');
  
  res.json({
    message: 'Frontend URL Detection Test',
    result: {
      detectedUrl: detectedUrl,
      detectionMethod: getUrlDetectionMethod(req),
    },
    requestInfo: {
      state: req.query.state || 'None',
      frontendUrlParam: req.query.frontend_url || 'None',
      referer: referer || 'None',
      userAgent: userAgent || 'None',
      host: req.get('Host') || 'None',
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      frontendUrlEnv: process.env.FRONTEND_URL || 'Not set',
      backendUrl: process.env.BACKEND_URL || 'Not set',
    },
    testScenarios: {
      localhost: '/test-frontend-url?state=dev',
      production: '/test-frontend-url?state=prod',
      explicit: '/test-frontend-url?frontend_url=https://example.com',
      prPreview: 'Test from PR preview environment (automatic via Referer)',
    },
    expectedBehavior: {
      localhost: 'Should detect localhost URLs from Referer or default to https://localhost:3001',
      production: 'Should detect .onrender.com URLs from Referer or default to production',
      prPreview: 'Should automatically detect vikingeventmgmt-pr-X.onrender.com from Referer',
      explicit: 'Should use frontend_url parameter when provided',
    },
  });
});

// Helper function to determine which detection method was used
const getUrlDetectionMethod = (req) => {
  const frontendUrlParam = req.query.frontend_url;
  if (frontendUrlParam) {
    return 'Explicit Parameter';
  }
  
  const referer = req.get('Referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.hostname.includes('.onrender.com')) {
        return 'Referer Header (Render.com)';
      }
      if (refererUrl.hostname === 'localhost' || refererUrl.hostname === '127.0.0.1') {
        return 'Referer Header (Localhost)';
      }
    } catch (_e) {
      // Invalid referer URL
    }
  }
  
  if (process.env.FRONTEND_URL) {
    return 'Environment Variable';
  }
  
  const { state } = req.query;
  if (state === 'dev' || state === 'development' || process.env.NODE_ENV === 'development') {
    return 'State-based (Development)';
  }
  
  return 'Default Fallback (Production)';
};

// OAuth callback route to handle the authorization code from OSM
app.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    oAuthCallbackLogger.logCallbackReceived(code, state, error, req);
    
    // Debug the frontend URL determination
    const frontendUrl = getFrontendUrl(req, {enableLogging: true});
    oAuthCallbackLogger.logFrontendUrlDetermination(frontendUrl);
    
    
    if (error) {
      console.error('OAuth error from OSM:', error);
      return res.redirect(`${frontendUrl}?error=${error}`);
    }
    
    if (!code) {
      console.error('No authorization code received');
      return res.redirect(`${frontendUrl}?error=no_code`);
    }

    // Exchange authorization code for access token
    const tokenPayload = {
      grant_type: 'authorization_code',
      client_id: process.env.OAUTH_CLIENT_ID,
      client_secret: process.env.OAUTH_CLIENT_SECRET,
      code: code,
      redirect_uri: `${process.env.BACKEND_URL || 'https://vikings-osm-backend.onrender.com'}/oauth/callback`,
    };
    
    oAuthCallbackLogger.logTokenExchange(tokenPayload);

    // Retry logic for token exchange with better timeout handling
    let tokenResponse;
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        oAuthCallbackLogger.logTokenExchangeAttempt(attempt, maxRetries);
        
        tokenResponse = await fetch('https://www.onlinescoutmanager.co.uk/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(tokenPayload),
          signal: global.AbortSignal?.timeout ? global.AbortSignal.timeout(30000) : undefined,
        });
        
        // If we get here, the request succeeded
        break;
        
      } catch (error) {
        if (attempt === maxRetries) {
          // Final attempt failed, throw the error
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        const waitTime = 1000 * attempt; // 1s, 2s
        oAuthCallbackLogger.logTokenExchangeRetry(attempt, waitTime);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    const tokenData = await tokenResponse.json();
    oAuthCallbackLogger.logTokenResponse(tokenResponse, tokenData);
    
    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      return res.redirect(`${frontendUrl}?error=token_exchange_failed&details=${encodeURIComponent(JSON.stringify(tokenData))}`);
    }

    // Redirect to frontend with token as URL parameter (original working approach)
    // This allows the frontend to store the token in sessionStorage on the correct domain
    const redirectUrl = `${frontendUrl}/?access_token=${tokenData.access_token}&token_type=${tokenData.token_type || 'Bearer'}`;
    oAuthCallbackLogger.logSuccessfulRedirect(redirectUrl);
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${getFrontendUrl(req)}?error=callback_error&details=${encodeURIComponent(error.message)}`);
  }
});

// ========================================
// ERROR HANDLING
// ========================================

// Sentry error handler (must be after all other middleware and routes)
if (Sentry && process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
  Sentry.setupExpressErrorHandler(app);
  console.log('✅ Sentry error handler added');
}

// Global error handler (fallback)
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
    
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});


// ========================================
// SERVER STARTUP
// ========================================

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
    
  // Use HTTPS in development, HTTP in production (Render handles SSL termination)
  if (process.env.NODE_ENV === 'development') {
    try {
      const httpsOptions = {
        key: fs.readFileSync('./localhost-key.pem'),
        cert: fs.readFileSync('./localhost.pem'),
      };
      https.createServer(httpsOptions, app).listen(PORT, () => {
        logServerStartup('HTTPS', PORT, process.env.NODE_ENV || 'development', logger);
        logAvailableEndpoints();
      });
    } catch (_error) {
      console.log('⚠️  SSL certificates not found, falling back to HTTP');
      app.listen(PORT, () => {
        logServerStartup('HTTP', PORT, process.env.NODE_ENV || 'development', logger);
        logAvailableEndpoints();
      });
    }
  } else {
    app.listen(PORT, () => {
      logServerStartup('HTTP', PORT, process.env.NODE_ENV || 'development', logger);
      logAvailableEndpoints();
    });
        
    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      process.exit(0);
    });
  }
}

// Export the app for testing
module.exports = app;
