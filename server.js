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
app.post('/callback', authController.oauthCallback);
app.get('/token', authController.getCurrentToken);
app.post('/logout', authController.logout);
app.post('/exchange-token', authController.exchangeToken); // Legacy endpoint

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
  const getFrontendUrl = () => {
    if (process.env.FRONTEND_URL) {
      return process.env.FRONTEND_URL;
    }
    return process.env.NODE_ENV === 'production' 
      ? 'https://vikings-eventmgmt.onrender.com'
      : 'https://localhost:3000';
  };

  res.json({
    clientId: process.env.OAUTH_CLIENT_ID ? 'Set' : 'Missing',
    clientSecret: process.env.OAUTH_CLIENT_SECRET ? 'Set' : 'Missing',
    frontendUrl: getFrontendUrl(),
    nodeEnv: process.env.NODE_ENV || 'Not set',
    backendUrl: process.env.BACKEND_URL || 'Not set',
    authUrl: `https://www.onlinescoutmanager.co.uk/oauth/authorize?client_id=${process.env.OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.BACKEND_URL || 'https://vikings-osm-event-manager.onrender.com')}/oauth/callback&scope=section%3Amember%3Aread%20section%3Aprogramme%3Aread%20section%3Aevent%3Aread%20section%3Aflexirecord%3Awrite&response_type=code`
  });
});

// Check if getUserRoles route is properly defined and matches frontend call
// Frontend is calling GET /get-user-roles with Authorization header
// Need to ensure route exists and controller function is updated for header-based auth

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
    
    // Dynamically set frontend URL based on environment
    const getFrontendUrl = () => {
      let url;
      
      // Priority 1: Explicit FRONTEND_URL override
      if (process.env.FRONTEND_URL) {
        url = process.env.FRONTEND_URL;
      } 
      // Priority 2: DEV_MODE flag for development
      else if (process.env.DEV_MODE === 'true') {
        url = 'https://localhost:3000';
      } 
      // Priority 3: Default to production frontend
      else {
        url = 'https://vikings-eventmgmt.onrender.com';
      }
      
      // Ensure URL doesn't have double protocol
      if (url.startsWith('https://https://') || url.startsWith('http://https://')) {
        url = url.replace(/^https?:\/\//, '');
      }
      
      // Ensure URL has protocol
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      return url;
    };
    
    if (error) {
      console.error('OAuth error from OSM:', error);
      return res.redirect(`${getFrontendUrl()}?error=${error}`);
    }
    
    if (!code) {
      console.error('No authorization code received');
      return res.redirect(`${getFrontendUrl()}?error=no_code`);
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
      return res.redirect(`${getFrontendUrl()}?error=token_exchange_failed&details=${encodeURIComponent(JSON.stringify(tokenData))}`);
    }

    console.log('Token exchange successful, redirecting to frontend...');
    
    // Redirect to frontend auth-success page with token as URL parameter
    // This allows the frontend to store the token in sessionStorage on the correct domain
    const frontendUrl = getFrontendUrl();
    res.redirect(`${frontendUrl}/auth-success.html?access_token=${tokenData.access_token}&token_type=${tokenData.token_type || 'Bearer'}`);
    
  } catch (error) {
    console.error('O callback error:', error);
    const getFrontendUrl = () => {
      if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
      if (process.env.DEV_MODE === 'true') return 'https://localhost:3000';
      return 'https://vikings-eventmgmt.onrender.com';
    };
    res.redirect(`${getFrontendUrl()}?error=callback_error&details=${encodeURIComponent(error.message)}`);
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

// Debug the OAuth callback flow
// Common issues that cause authentication to get stuck:
// 1. Missing or incorrect OAuth callback URL configuration
// 2. Error in token exchange with OSM
// 3. Missing error handling in callback route
// 4. CORS issues with frontend redirect
// 5. Session/token storage issues

// Check the /oauth/callback route for proper error handling and logging

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
        console.log('- POST /callback');
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