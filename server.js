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

// CORS with credentials support
app.use(cors({
  origin: [
    'https://vikings-eventmgmt.onrender.com',
    'https://localhost:3000',
    'http://localhost:3000',
    'https://vikings-osm-event-manager.onrender.com'
  ],
  credentials: true
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

// Check if getUserRoles route is properly defined and matches frontend call
// Frontend is calling GET /get-user-roles with Authorization header
// Need to ensure route exists and controller function is updated for header-based auth

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