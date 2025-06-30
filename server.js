const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Load environment variables
require('dotenv').config();

// Initialize Sentry
const { Sentry, logger } = require('./config/sentry');

// Import middleware and controllers
const { backendRateLimit } = require('./middleware/rateLimiting');
const authController = require('./controllers/auth');
const osmController = require('./controllers/osm');

const app = express();

// Centralized frontend URL determination utility
const getFrontendUrl = (req, options = {}) => {
  const { state } = req.query;
  const enableLogging = options.enableLogging || false;
  
  if (enableLogging) {
    console.log('🔍 getFrontendUrl - Raw state parameter:', state);
    console.log('🔍 getFrontendUrl - All query params:', req.query);
    console.log('🔍 getFrontendUrl - Referer header:', req.get('Referer'));
  }
  
  // Check for frontend_url parameter first (highest priority)
  const frontendUrlParam = req.query.frontend_url;
  if (frontendUrlParam) {
    if (enableLogging) console.log('✅ Frontend URL from parameter:', frontendUrlParam);
    return frontendUrlParam;
  }
  
  // Parse state parameter for embedded frontend URL with better decoding
  if (state && state.includes('frontend_url=')) {
    if (enableLogging) console.log('🔍 State contains frontend_url, parsing...');
    
    // Handle both URL encoded and non-encoded state parameters
    let decodedState = state;
    try {
      // Try decoding in case the state itself is URL encoded
      decodedState = decodeURIComponent(state);
      if (enableLogging) console.log('🔍 Decoded state:', decodedState);
    } catch (e) {
      if (enableLogging) console.log('🔍 State not URL encoded, using as-is');
    }
    
    // Extract frontend_url from the state parameter
    const urlMatch = decodedState.match(/frontend_url=([^&]+)/);
    if (urlMatch) {
      try {
        const extractedUrl = decodeURIComponent(urlMatch[1]);
        if (enableLogging) console.log('✅ Frontend URL extracted from state:', extractedUrl);
        return extractedUrl;
      } catch (e) {
        if (enableLogging) console.log('❌ Error decoding extracted URL:', e.message);
      }
    } else {
      if (enableLogging) console.log('❌ No frontend_url match found in state');
    }
  }
  
  // Check Referer header as fallback for deployed environments
  const referer = req.get('Referer');
  if (referer && referer.includes('.onrender.com')) {
    try {
      const refererUrl = new URL(referer);
      const frontendUrl = `${refererUrl.protocol}//${refererUrl.hostname}`;
      if (enableLogging) console.log('✅ Frontend URL from Referer header:', frontendUrl);
      return frontendUrl;
    } catch (e) {
      if (enableLogging) console.log('❌ Error parsing Referer header:', e.message);
    }
  }
  
  // Environment-based detection
  if (process.env.FRONTEND_URL) {
    if (enableLogging) console.log('✅ Frontend URL from environment variable:', process.env.FRONTEND_URL);
    return process.env.FRONTEND_URL;
  }
  
  // Legacy state parameter support
  if (state === 'dev' || state === 'development' || process.env.DEV_MODE === 'true') {
    if (enableLogging) console.log('✅ Development environment detected');
    return 'https://localhost:3000';
  }
  
  // Enhanced production state detection
  if (state === 'prod' || state === 'production' || (state && state.startsWith('prod'))) {
    if (enableLogging) console.log('✅ Production environment detected (legacy)');
    return 'https://vikings-eventmgmt.onrender.com';
  }
  
  // Default fallback
  if (enableLogging) console.log('⚠️ Using default production frontend URL');
  return 'https://vikings-eventmgmt.onrender.com';
};

// Sentry request handler (must be first middleware) - v9 API handles this automatically
if (Sentry && process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
    console.log('✅ Sentry request handlers added via expressIntegration');
} else {
    console.log('⚠️ Sentry request handlers NOT added - Sentry:', !!Sentry, 'DSN:', !!process.env.SENTRY_DSN, 'ENV:', process.env.NODE_ENV);
}

// Dynamic CORS configuration to allow production, localhost, and specific PR previews
app.use(cors({
  origin: (origin, callback) => {
    console.log('🔍 CORS check for origin:', origin);
    
    // Allow requests with no origin (mobile apps, postman, etc.)
    if (!origin) {
      console.log('✅ CORS: No origin header, allowing');
      return callback(null, true);
    }
    
    // Define allowed origins
    const allowedOrigins = [
      'https://vikings-eventmgmt.onrender.com',  // Production frontend
      'https://localhost:3000',                  // Development frontend (https)
      'http://localhost:3000'                    // Development frontend (http)
    ];
    
    // Check exact matches first
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS: Origin allowed (exact match):', origin);
      return callback(null, true);
    }
    
    // Allow specific PR preview URLs: https://vikings-event-management-front-end-pr-{number}.onrender.com
    const prPreviewPattern = /^https:\/\/vikings-event-management-front-end-pr-\d+\.onrender\.com$/;
    if (prPreviewPattern.test(origin)) {
      console.log('✅ CORS: Origin allowed (PR preview):', origin);
      return callback(null, true);
    }
    
    // Reject all other origins
    console.log('❌ CORS: Origin rejected:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(cookieParser());
app.use(backendRateLimit); // Apply rate limiting middleware to all routes

// ========================================
// ROUTES - Using imported controllers
// ========================================

// Rate limit monitoring endpoint
app.get('/rate-limit-status', osmController.getRateLimitStatus);

// OAuth/Authentication endpoints
app.get('/token', authController.getCurrentToken);
app.post('/logout', authController.logout);

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
app.get('/get-startup-data', osmController.getStartupData);

// Sentry test endpoint
app.get('/test-sentry', (req, res) => {
  // Test different types of errors
  const testType = req.query.type || 'error';
  
  switch (testType) {
    case 'error':
      throw new Error('Test error for Sentry - this is expected!');
    case 'message':
      if (Sentry) {
        Sentry.captureMessage('Test message from backend', 'info');
      }
      res.json({ message: 'Test message sent to Sentry' });
      break;
    case 'exception':
      if (Sentry) {
        Sentry.captureException(new Error('Test exception for Sentry'));
      }
      res.json({ message: 'Test exception sent to Sentry' });
      break;
    default:
      res.json({ 
        message: 'Sentry test endpoint',
        usage: '?type=error|message|exception',
        sentryEnabled: !!Sentry && !!process.env.SENTRY_DSN,
        debug: {
          sentryObject: !!Sentry,
          dsn: process.env.SENTRY_DSN ? 'Set' : 'Missing',
          nodeEnv: process.env.NODE_ENV,
          testEnv: process.env.NODE_ENV === 'test'
        }
      });
  }
});

// Rate limiting test endpoint for development
app.get('/test-rate-limits', (req, res) => {
  const testType = req.query.type || 'info';
  
  switch (testType) {
    case 'backend-stress':
      // This will trigger backend rate limiting after multiple requests
      res.json({ 
        message: 'Backend stress test - make 100+ requests rapidly to trigger rate limit',
        endpoint: '/test-rate-limits?type=backend-stress',
        tip: 'Use: for i in {1..105}; do curl "http://localhost:3000/test-rate-limits?type=backend-stress" & done'
      });
      break;
      
    case 'osm-simulation':
      // Simulate OSM rate limit info
      res.set({
        'X-RateLimit-Limit': '1000',
        'X-RateLimit-Remaining': '5',
        'X-RateLimit-Reset': Math.floor(Date.now() / 1000) + 3600
      });
      res.json({ 
        message: 'OSM rate limit simulation - low remaining requests',
        rateLimitHeaders: {
          limit: 1000,
          remaining: 5,
          reset: Math.floor(Date.now() / 1000) + 3600
        }
      });
      break;
      
    default:
      res.json({
        message: 'Rate limiting test endpoint',
        usage: {
          'backend-stress': 'Test backend rate limiting (100 req/min)',
          'osm-simulation': 'Simulate OSM rate limit headers'
        },
        currentLimits: {
          backend: '100 requests per minute per user/IP',
          osm: 'Dynamic based on OSM API responses'
        }
      });
  }
});

// Add OAuth environment validation endpoint for debugging
app.get('/oauth/debug', (req, res) => {
  res.json({
    clientId: process.env.OAUTH_CLIENT_ID ? 'Set' : 'Missing',
    clientSecret: process.env.OAUTH_CLIENT_SECRET ? 'Set' : 'Missing',
    frontendUrl: getFrontendUrl(req),
    stateParam: req.query.state || 'Not set',
    frontendUrlParam: req.query.frontend_url || 'Not set',
    refererHeader: req.get('Referer') || 'Not set',
    nodeEnv: process.env.NODE_ENV || 'Not set',
    backendUrl: process.env.BACKEND_URL || 'Not set',
    authUrl: `https://www.onlinescoutmanager.co.uk/oauth/authorize?client_id=${process.env.OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.BACKEND_URL || 'https://vikings-osm-backend.onrender.com')}/oauth/callback&scope=section%3Amember%3Aread%20section%3Aprogramme%3Aread%20section%3Aevent%3Aread%20section%3Aflexirecord%3Awrite&response_type=code`
  });
});


// OAuth callback route to handle the authorization code from OSM
app.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    console.log('🔗 OAuth callback received:', { 
      code: code ? code.substring(0, 20) + '...' : 'none', 
      state, 
      error,
      fullQuery: req.query,
      referer: req.get('Referer'),
      userAgent: req.get('User-Agent')
    });
    
    // Debug the frontend URL determination
    console.log('🎯 Determining frontend URL for redirect...');
    const frontendUrl = getFrontendUrl(req, {enableLogging: true});
    console.log('🚀 Final frontend URL selected:', frontendUrl);
    
    
    if (error) {
      console.error('OAuth error from OSM:', error);
      return res.redirect(`${frontendUrl}?error=${error}`);
    }
    
    if (!code) {
      console.error('No authorization code received');
      return res.redirect(`${frontendUrl}?error=no_code`);
    }

    console.log('Attempting token exchange with OSM...');

    // Exchange authorization code for access token
    const tokenPayload = {
      grant_type: 'authorization_code',
      client_id: process.env.OAUTH_CLIENT_ID,
      client_secret: process.env.OAUTH_CLIENT_SECRET,
      code: code,
      redirect_uri: `${process.env.BACKEND_URL || 'https://vikings-osm-backend.onrender.com'}/oauth/callback`
    };
    
    console.log('Token exchange payload:', {
      ...tokenPayload,
      client_secret: '***hidden***',
      code: code.substring(0, 20) + '...'
    });

    const tokenResponse = await fetch('https://www.onlinescoutmanager.co.uk/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenPayload)
    });

    console.log('Token response status:', tokenResponse.status);
    
    const tokenData = await tokenResponse.json();
    console.log('Token response:', { 
      ...tokenData, 
      access_token: tokenData.access_token ? tokenData.access_token.substring(0, 20) + '...' : 'none'
    });
    
    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      return res.redirect(`${frontendUrl}?error=token_exchange_failed&details=${encodeURIComponent(JSON.stringify(tokenData))}`);
    }

    console.log('Token exchange successful, redirecting to frontend...');
    
    // Redirect to frontend auth-success page with token as URL parameter
    // This allows the frontend to store the token in sessionStorage on the correct domain
    console.log('🎯 Redirecting to:', `${frontendUrl}/auth-success.html`);
    res.redirect(`${frontendUrl}/auth-success.html?access_token=${tokenData.access_token}&token_type=${tokenData.token_type || 'Bearer'}`);
    
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
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});


// ========================================
// SERVER STARTUP
// ========================================

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
        // Console logging for immediate feedback
        console.log('✅ Vikings OSM Backend Server Started');
        console.log(`🌐 Server running on port ${PORT}`);
        console.log(`🏠 Environment: ${process.env.NODE_ENV || 'development'}`);
        
        // Structured Sentry logging for monitoring
        if (logger) {
            logger.info("Vikings OSM Backend Server Started", {
                environment: process.env.NODE_ENV || 'development',
                port: PORT,
                timestamp: new Date().toISOString(),
                configuration: {
                    sentryEnabled: !!Sentry,
                    sentryDsn: !!process.env.SENTRY_DSN,
                    oauthConfigured: !!(process.env.OAUTH_CLIENT_ID && process.env.OAUTH_CLIENT_SECRET),
                    corsEnabled: true,
                    rateLimitingEnabled: true
                },
                server: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    architecture: process.arch
                },
                section: 'server-startup'
            });
        }
        
        console.log('📋 Available endpoints:');
        console.log('Auth:');
        console.log('- GET /oauth/callback (OAuth redirect from OSM)');
        console.log('- GET /token');
        console.log('- POST /logout');
        console.log('Rate Monitoring:');
        console.log('- GET /rate-limit-status');
        console.log('OSM API Proxy:');
        console.log('- GET /get-terms');
        console.log('- GET /get-section-config');
        console.log('- GET /get-user-roles');
        console.log('- GET /get-events');
        console.log('- GET /get-event-attendance');
        console.log('- GET /get-contact-details');
        console.log('- GET /get-list-of-members');
        console.log('- GET /get-flexi-records');
        console.log('- GET /get-flexi-structure');
        console.log('- GET /get-single-flexi-record');
        console.log('- POST /update-flexi-record');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('SIGTERM received, shutting down gracefully');
        server.close(() => {
            process.exit(0);
        });
    });
}

// Export the app for testing
module.exports = app;