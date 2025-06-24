const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Load environment variables
require('dotenv').config();

// Initialize Sentry
const Sentry = require('./config/sentry');

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
    console.log('Determining frontend URL - state parameter:', state);
    console.log('Query params:', req.query);
  }
  
  // Check for frontend_url parameter first (highest priority)
  const frontendUrlParam = req.query.frontend_url;
  if (frontendUrlParam) {
    if (enableLogging) console.log('Frontend URL parameter provided:', frontendUrlParam);
    return frontendUrlParam;
  }
  
  // Parse state parameter for embedded frontend URL
  if (state && state.includes('frontend_url=')) {
    const urlMatch = state.match(/frontend_url=([^&]+)/);
    if (urlMatch) {
      const extractedUrl = decodeURIComponent(urlMatch[1]);
      if (enableLogging) console.log('Frontend URL extracted from state:', extractedUrl);
      return extractedUrl;
    }
  }
  
  // Check Referer header as fallback for deployed environments
  const referer = req.get('Referer');
  if (referer && referer.includes('.onrender.com')) {
    const refererUrl = new URL(referer);
    const frontendUrl = `${refererUrl.protocol}//${refererUrl.hostname}`;
    if (enableLogging) console.log('Frontend URL detected from Referer header:', frontendUrl);
    return frontendUrl;
  }
  
  // Environment-based detection
  if (process.env.FRONTEND_URL) {
    if (enableLogging) console.log('Using FRONTEND_URL environment variable');
    return process.env.FRONTEND_URL;
  }
  
  // Legacy state parameter support
  if (state === 'dev' || state === 'development' || process.env.DEV_MODE === 'true') {
    if (enableLogging) console.log('Development environment detected');
    return 'https://localhost:3000';
  }
  
  if (state === 'prod' || state === 'production' || (state && state.startsWith('prod'))) {
    if (enableLogging) console.log('Production environment detected');
    return 'https://vikings-eventmgmt.onrender.com';
  }
  
  // Default fallback
  if (enableLogging) console.log('Using default production frontend URL');
  return 'https://vikings-eventmgmt.onrender.com';
};

// Sentry request handler (must be first middleware)
if (Sentry && process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
}

// Update CORS configuration to allow localhost and production frontend
app.use(cors({
  origin: [
    'https://vikings-eventmgmt.onrender.com',  // Production frontend
    'https://localhost:3000',                  // Development frontend (https)
    'http://localhost:3000'                    // Development frontend (http)
  ],
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
    authUrl: `https://www.onlinescoutmanager.co.uk/oauth/authorize?client_id=${process.env.OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.BACKEND_URL || 'https://vikings-osm-event-manager.onrender.com')}/oauth/callback&scope=section%3Amember%3Aread%20section%3Aprogramme%3Aread%20section%3Aevent%3Aread%20section%3Aflexirecord%3Awrite&response_type=code`
  });
});


// OAuth callback route to handle the authorization code from OSM
app.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    console.log('OAuth callback received:', { 
      code: code ? code.substring(0, 20) + '...' : 'none', 
      state, 
      error,
      fullQuery: req.query 
    });
    
    
    if (error) {
      console.error('OAuth error from OSM:', error);
      return res.redirect(`${getFrontendUrl(req, {enableLogging: true})}?error=${error}`);
    }
    
    if (!code) {
      console.error('No authorization code received');
      return res.redirect(`${getFrontendUrl(req, {enableLogging: true})}?error=no_code`);
    }

    console.log('Attempting token exchange with OSM...');

    // Exchange authorization code for access token
    const tokenPayload = {
      grant_type: 'authorization_code',
      client_id: process.env.OAUTH_CLIENT_ID,
      client_secret: process.env.OAUTH_CLIENT_SECRET,
      code: code,
      redirect_uri: `${process.env.BACKEND_URL || 'https://vikings-osm-event-manager.onrender.com'}/oauth/callback`
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
      return res.redirect(`${getFrontendUrl(req, {enableLogging: true})}?error=token_exchange_failed&details=${encodeURIComponent(JSON.stringify(tokenData))}`);
    }

    console.log('Token exchange successful, redirecting to frontend...');
    
    // Redirect to frontend auth-success page with token as URL parameter
    // This allows the frontend to store the token in sessionStorage on the correct domain
    const frontendUrl = getFrontendUrl(req, {enableLogging: true});
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
    app.use(Sentry.Handlers.errorHandler({
        shouldHandleError(error) {
            return error.status >= 400;
        }
    }));
}

// Global error handler (fallback)
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    if (Sentry && process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
        Sentry.captureException(err);
    }
    
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
        console.log('✅ Vikings OSM Backend Server Started');
        console.log(`🌐 Server running on port ${PORT}`);
        console.log(`🏠 Environment: ${process.env.NODE_ENV || 'development'}`);
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