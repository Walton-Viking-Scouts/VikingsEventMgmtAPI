const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// Rate limiting tracking for our backend
const rateLimitTracker = new Map();
const BACKEND_RATE_LIMIT_WINDOW = 60000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 100; // Our backend limit per minute per user

// OSM Rate limit tracking per user
const osmRateLimitTracker = new Map();

// Clean up old tracking data periodically
setInterval(() => {
    const now = Date.now();
    // Clean backend rate limit tracking
    for (const [key, data] of rateLimitTracker.entries()) {
        data.requests = data.requests.filter(timestamp => 
            now - timestamp < BACKEND_RATE_LIMIT_WINDOW
        );
        if (data.requests.length === 0) {
            rateLimitTracker.delete(key);
        }
    }
    
    // Clean OSM rate limit tracking (keep for 1 hour)
    for (const [key, data] of osmRateLimitTracker.entries()) {
        if (now - data.lastUpdated > 3600000) { // 1 hour
            osmRateLimitTracker.delete(key);
        }
    }
}, 300000); // Clean every 5 minutes

// Backend rate limiting middleware
const backendRateLimit = (req, res, next) => {
    const sessionId = req.cookies?.session_id || req.ip;
    const now = Date.now();
    
    if (!rateLimitTracker.has(sessionId)) {
        rateLimitTracker.set(sessionId, { requests: [] });
    }
    
    const userLimits = rateLimitTracker.get(sessionId);
    
    // Clean old requests outside the window
    userLimits.requests = userLimits.requests.filter(timestamp => 
        now - timestamp < BACKEND_RATE_LIMIT_WINDOW
    );
    
    // Check if limit exceeded
    if (userLimits.requests.length >= MAX_REQUESTS_PER_WINDOW) {
        const resetTime = userLimits.requests[0] + BACKEND_RATE_LIMIT_WINDOW;
        return res.status(429).json({
            error: 'Backend rate limit exceeded',
            backendRateLimit: {
                limit: MAX_REQUESTS_PER_WINDOW,
                remaining: 0,
                resetTime: resetTime,
                retryAfter: Math.ceil((resetTime - now) / 1000)
            }
        });
    }
    
    // Add current request
    userLimits.requests.push(now);
    
    // Add our backend rate limit headers
    res.set({
        'X-Backend-RateLimit-Limit': MAX_REQUESTS_PER_WINDOW,
        'X-Backend-RateLimit-Remaining': MAX_REQUESTS_PER_WINDOW - userLimits.requests.length,
        'X-Backend-RateLimit-Reset': Math.ceil((now + BACKEND_RATE_LIMIT_WINDOW) / 1000)
    });
    
    next();
};

// Check if we should allow OSM API request based on tracked rate limits
const shouldAllowOSMRequest = (sessionId) => {
    if (!sessionId) return true; // Allow if no session tracking
    
    const osmInfo = osmRateLimitTracker.get(sessionId);
    if (!osmInfo) return true; // Allow if no rate limit info yet
    
    // Check if we're currently rate limited
    if (osmInfo.rateLimited) {
        const now = Date.now();
        const resetTime = osmInfo.reset ? osmInfo.reset * 1000 : now;
        if (now < resetTime) {
            return false; // Still rate limited
        } else {
            // Reset time has passed, clear rate limited flag
            osmInfo.rateLimited = false;
            osmRateLimitTracker.set(sessionId, osmInfo);
        }
    }
    
    // Check remaining requests
    return osmInfo.remaining === null || osmInfo.remaining > 0;
};

// OSM API request wrapper that handles rate limiting
const makeOSMRequest = async (url, options = {}, sessionId = null) => {
    // Check if we should make the request based on known rate limits
    if (sessionId && !shouldAllowOSMRequest(sessionId)) {
        const osmInfo = osmRateLimitTracker.get(sessionId);
        const resetTime = osmInfo.reset ? osmInfo.reset * 1000 : Date.now() + 3600000; // Default 1 hour
        throw new Error(`OSM API rate limit exceeded. ${osmInfo.remaining || 0} requests remaining. Reset at ${new Date(resetTime).toISOString()}`);
    }
    
    console.log(`OSM API Request: ${url}`);
    
    const response = await fetch(url, options);
    
    // Extract OSM rate limit headers
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    
    // Store OSM rate limit info per user session
    if (sessionId && (limit || remaining || reset)) {
        const currentData = osmRateLimitTracker.get(sessionId) || {};
        osmRateLimitTracker.set(sessionId, {
            ...currentData,
            limit: limit ? parseInt(limit) : currentData.limit,
            remaining: remaining ? parseInt(remaining) : currentData.remaining,
            reset: reset ? parseInt(reset) : currentData.reset,
            rateLimited: false, // Clear rate limited flag on successful response
            lastUpdated: Date.now()
        });
        
        console.log(`OSM Rate Limit for session ${sessionId}:`, {
            limit,
            remaining,
            reset: reset ? new Date(parseInt(reset) * 1000).toISOString() : null
        });
        
        // Warn if getting close to limit
        const remainingCount = parseInt(remaining);
        if (remaining && remainingCount <= 5) {
            console.warn(`OSM API rate limit warning for session ${sessionId}: Only ${remainingCount} requests remaining!`);
        }
    }
    
    // Log response status
    console.log(`OSM API Response: ${response.status} for ${url}`);
    
    // Handle rate limiting response
    if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        console.warn(`OSM API rate limited. Retry after: ${retryAfter} seconds`);
        
        if (sessionId) {
            const currentData = osmRateLimitTracker.get(sessionId) || {};
            osmRateLimitTracker.set(sessionId, {
                ...currentData,
                remaining: 0, // Set remaining to 0 when rate limited
                retryAfter: retryAfter ? parseInt(retryAfter) : null,
                rateLimited: true,
                lastUpdated: Date.now()
            });
        }
    }
    
    return response;
};

// Helper to get session ID from request
const getSessionId = (req) => {
    return req.cookies?.session_id || req.ip;
};

// Helper to get OSM rate limit info for a session
const getOSMRateLimitInfo = (sessionId) => {
    return osmRateLimitTracker.get(sessionId) || null;
};

// CORS with credentials support
app.use(cors({
  origin: [
    'https://vikings-eventmgmt.onrender.com',
    'https://localhost:3000',
    'http://localhost:3000',
    'https://vikings-osm-event-manager.onrender.com'
  ],
  credentials: true  // IMPORTANT: This fixes the CORS error!
}));

app.use(express.json());
app.use(cookieParser());

// Rate limit status endpoint for frontend monitoring
app.get('/rate-limit-status', (req, res) => {
    const sessionId = getSessionId(req);
    
    // Get backend rate limit info
    const userLimits = rateLimitTracker.get(sessionId);
    const now = Date.now();
    let backendInfo = {
        limit: MAX_REQUESTS_PER_WINDOW,
        remaining: MAX_REQUESTS_PER_WINDOW,
        resetTime: now + BACKEND_RATE_LIMIT_WINDOW,
        window: 'per minute'
    };
    
    if (userLimits) {
        const activeRequests = userLimits.requests.filter(timestamp => 
            now - timestamp < BACKEND_RATE_LIMIT_WINDOW
        );
        backendInfo = {
            limit: MAX_REQUESTS_PER_WINDOW,
            remaining: MAX_REQUESTS_PER_WINDOW - activeRequests.length,
            resetTime: activeRequests.length > 0 ? activeRequests[0] + BACKEND_RATE_LIMIT_WINDOW : now + BACKEND_RATE_LIMIT_WINDOW,
            window: 'per minute'
        };
    }
    
    // Get OSM rate limit info
    const osmInfo = getOSMRateLimitInfo(sessionId);
    let osmRateLimit = {
        limit: null,
        remaining: null,
        resetTime: null,
        window: 'per hour',
        available: true
    };
    
    if (osmInfo) {
        osmRateLimit = {
            limit: osmInfo.limit,
            remaining: osmInfo.remaining,
            resetTime: osmInfo.reset ? osmInfo.reset * 1000 : null, // Convert to milliseconds
            window: 'per hour',
            available: !osmInfo.rateLimited,
            retryAfter: osmInfo.retryAfter
        };
    }
    
    res.json({
        backend: backendInfo,
        osm: osmRateLimit,
        timestamp: now
    });
});

// Enhanced response wrapper to include rate limit info
const addRateLimitInfoToResponse = (req, res, data) => {
    const sessionId = getSessionId(req);
    const osmInfo = getOSMRateLimitInfo(sessionId);
    
    // Add rate limit info to response
    const response = {
        ...data,
        _rateLimitInfo: {
            osm: osmInfo ? {
                limit: osmInfo.limit,
                remaining: osmInfo.remaining,
                resetTime: osmInfo.reset ? osmInfo.reset * 1000 : null,
                rateLimited: osmInfo.rateLimited || false
            } : null,
            backend: {
                remaining: res.getHeader('X-Backend-RateLimit-Remaining'),
                limit: res.getHeader('X-Backend-RateLimit-Limit')
            }
        }
    };
    
    // Log rate limit warnings
    if (osmInfo && osmInfo.remaining !== null && osmInfo.remaining < 10) {
        console.warn(`OSM API rate limit warning for session ${sessionId}: ${osmInfo.remaining} requests remaining`);
    }
    
    // Frontend-friendly warnings for different thresholds
    if (osmInfo && osmInfo.limit && osmInfo.remaining !== null) {
        const percentRemaining = (osmInfo.remaining / osmInfo.limit) * 100;
        if (percentRemaining <= 10) {
            console.warn(`OSM API rate limit critical warning for session ${sessionId}: ${osmInfo.remaining}/${osmInfo.limit} requests remaining (${percentRemaining.toFixed(1)}%)`);
        } else if (percentRemaining <= 25) {
            console.warn(`OSM API rate limit warning for session ${sessionId}: ${osmInfo.remaining}/${osmInfo.limit} requests remaining (${percentRemaining.toFixed(1)}%)`);
        }
    }
    
    return response;
};

const oauthclientid = 'xnaUg7zxsrARZAHKMlshvREmY4GhDs7Z';
const oauthsecret = 'wm24tggsYBl43emj7JB5qBq0tOTSHWTt8ay0W51KqmMSrSAMjCp3eRsO7XWlvWCS';

// Store tokens in memory (use Redis/DB in production)
const userTokens = new Map();

// OAuth callback endpoint
app.post('/callback', async (req, res) => {
    const { code, redirect_uri } = req.body;
    
    if (!code) {
        return res.status(400).json({ error: 'Authorization code required' });
    }

    try {
        console.log('Processing OAuth callback...');
        
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', oauthclientid);
        params.append('client_secret', oauthsecret);
        params.append('redirect_uri', redirect_uri || 'https://vikings-eventmgmt.onrender.com/callback.html');
        params.append('code', code);

        const response = await fetch('https://www.onlinescoutmanager.co.uk/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const text = await response.text();
        console.log('Callback OAuth response status:', response.status);
        console.log('Callback OAuth response (first 200 chars):', text.substring(0, 200));

        let tokenData;
        try {
            tokenData = JSON.parse(text);
        } catch (e) {
            console.error('Failed to parse OAuth response as JSON:', text.substring(0, 500));
            return res.status(502).json({ 
                error: 'OAuth server returned non-JSON', 
                details: text.substring(0, 500)
            });
        }

        console.log('Token exchange result:', tokenData);

        if (tokenData.access_token) {
            const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            userTokens.set(sessionId, {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_at: Date.now() + (tokenData.expires_in * 1000)
            });

            res.cookie('session_id', sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'none', // Required for cross-origin cookies
                maxAge: tokenData.expires_in * 1000
            });

            res.json({ success: true });
        } else {
            console.error('No access token received:', tokenData);
            res.status(400).json({ error: 'Token exchange failed', details: tokenData });
        }

    } catch (error) {
        console.error('OAuth callback error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Token endpoint - THIS WAS MISSING!
app.get('/token', (req, res) => {
    const sessionId = req.cookies?.session_id;
    
    if (!sessionId) {
        return res.status(401).json({ error: 'No session found' });
    }

    const tokenData = userTokens.get(sessionId);
    
    if (!tokenData) {
        return res.status(401).json({ error: 'Invalid session' });
    }

    // Check if token expired
    if (Date.now() > tokenData.expires_at) {
        userTokens.delete(sessionId);
        return res.status(401).json({ error: 'Token expired' });
    }

    res.json({ access_token: tokenData.access_token });
});

// Logout endpoint
app.post('/logout', (req, res) => {
    const sessionId = req.cookies?.session_id;
    if (sessionId) {
        userTokens.delete(sessionId);
    }
    res.clearCookie('session_id');
    res.json({ success: true });
});

// Exchange code for access token (existing endpoint)
app.post('/exchange-token', async (req, res) => {
    const { code, redirect_uri } = req.body;
    console.log('Exchange token request:', { 
        code: code?.substring(0, 10) + '...', 
        redirect_uri,
        client_id: oauthclientid 
    });
    
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', oauthclientid);
    params.append('client_secret', oauthsecret);
    params.append('redirect_uri', redirect_uri);
    params.append('code', code);

    try {
        const response = await fetch('https://www.onlinescoutmanager.co.uk/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        
        const text = await response.text();
        console.log('OSM OAuth response status:', response.status);
        console.log('OSM OAuth response (first 500 chars):', text.substring(0, 500));
        
        if (text.startsWith('<!doctype') || text.startsWith('<html')) {
            console.error('Received HTML instead of JSON - likely OAuth error');
            return res.status(502).json({ 
                error: 'OAuth server returned HTML error page', 
                details: 'Check client_id, client_secret, and redirect_uri',
                html_preview: text.substring(0, 200)
            });
        }
        
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Failed to parse OAuth response as JSON');
            return res.status(502).json({ 
                error: 'Invalid JSON from OAuth server', 
                details: text.substring(0, 500)
            });
        }
        
        console.log('OSM token response:', data);
        res.json(data);
    } catch (err) {
        console.error('Error in /exchange-token:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getTerms to avoid CORS
app.post('/get-terms', backendRateLimit, async (req, res) => {
    const { access_token } = req.body;
    const sessionId = getSessionId(req);
    if (!access_token) {
        return res.status(400).json({ error: 'No access token provided' });
    }
    try {
        const response = await makeOSMRequest('https://www.onlinescoutmanager.co.uk/api.php?action=getTerms', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const data = await response.json();
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-terms:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getSectionConfig to avoid CORS
app.post('/get-section-config', backendRateLimit, async (req, res) => {
    const { access_token, sectionid } = req.body;
    const sessionId = getSessionId(req);
    if (!access_token || !sectionid) {
        return res.status(400).json({ error: 'Missing access_token or sectionid' });
    }
    try {
        const response = await makeOSMRequest(`https://www.onlinescoutmanager.co.uk/api.php?action=getSectionConfig&sectionid=${sectionid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const data = await response.json();
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-section-config:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getUserRoles to avoid CORS
app.post('/get-user-roles', backendRateLimit, async (req, res) => {
    const { access_token } = req.body;
    const sessionId = getSessionId(req);
    if (!access_token) {
        return res.status(400).json({ error: 'No access token provided' });
    }
    try {
        const response = await makeOSMRequest('https://www.onlinescoutmanager.co.uk/api.php?action=getUserRoles', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const data = await response.json();
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-user-roles:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getEvents to avoid CORS
app.post('/get-events', backendRateLimit, async (req, res) => {
    const { access_token, sectionid, termid } = req.body;
    const sessionId = getSessionId(req);
    if (!access_token || !sectionid || !termid) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    try {
        const response = await makeOSMRequest(`https://www.onlinescoutmanager.co.uk/ext/events/summary/?action=get&sectionid=${sectionid}&termid=${termid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const data = await response.json();
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-events:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getEventAttendance to avoid CORS
app.post('/get-event-attendance', backendRateLimit, async (req, res) => {
    const { access_token, eventid, sectionid, termid } = req.body;
    const sessionId = getSessionId(req);
    if (!access_token || !eventid || !sectionid || termid === undefined) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    try {
        const response = await makeOSMRequest(`https://www.onlinescoutmanager.co.uk/ext/events/event/?action=getAttendance&eventid=${eventid}&sectionid=${sectionid}&termid=${termid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const data = await response.json();
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-event-attendance:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getContactDetails to avoid CORS
app.get('/get-contact-details', backendRateLimit, async (req, res) => {
    const { sectionid, scoutid, termid } = req.query;
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    if (!access_token || !sectionid || !scoutid || !termid) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    try {
        const response = await makeOSMRequest(`https://onlinescoutmanager.co.uk/ext/members/contact/?action=getIndividual&sectionid=${sectionid}&scoutid=${scoutid}&termid=${termid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const data = await response.json();
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-contact-details:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getListOfMembers to avoid CORS
app.get('/get-list-of-members', backendRateLimit, async (req, res) => {
    const { sectionid, termid, section } = req.query;
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    if (!access_token || !sectionid || !termid || !section) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    try {
        const apiUrl = `https://onlinescoutmanager.co.uk/ext/members/contact/?action=getListOfMembers&sort=dob&sectionid=${sectionid}&termid=${termid}&section=${encodeURIComponent(section)}`;
        const response = await makeOSMRequest(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return res.status(502).json({ error: 'Upstream returned non-JSON', details: text });
        }
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-list-of-members:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getFlexiRecords to avoid CORS
app.get('/get-flexi-records', backendRateLimit, async (req, res) => {
    const { sectionid, archived = 'n' } = req.query;
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    if (!access_token || !sectionid) {
        return res.status(400).json({ error: 'Missing access_token or sectionid' });
    }
    try {
        const response = await makeOSMRequest(`https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=getFlexiRecords&sectionid=${sectionid}&archived=${archived}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const text = await response.text();
        console.log('FlexiRecords API response:', text.substring(0, 200)); // Log first 200 chars
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return res.status(502).json({ error: 'Upstream returned non-JSON', details: text.substring(0, 500) });
        }
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-flexi-records:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getSingleFlexiRecord to avoid CORS
app.post('/get-single-flexi-record', backendRateLimit, async (req, res) => {
    const { access_token, flexirecordid, sectionid, termid } = req.body;
    const sessionId = getSessionId(req);
    if (!access_token || !flexirecordid || !sectionid || !termid) {
        return res.status(400).json({ error: 'Missing access_token, flexirecordid, sectionid, or termid' });
    }
    try {
        const response = await makeOSMRequest(`https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=getData&extraid=${flexirecordid}&sectionid=${sectionid}&termid=${termid}&nototal`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const text = await response.text();
        console.log('Single FlexiRecord API response:', text.substring(0, 200)); // Log first 200 chars
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return res.status(502).json({ error: 'Upstream returned non-JSON', details: text.substring(0, 500) });
        }
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-single-flexi-record:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy updateFlexiRecord to avoid CORS
app.post('/update-flexi-record', backendRateLimit, async (req, res) => {
    const { access_token, termid, sectiontype, sectionid, extraid, scoutid, column, value } = req.body;
    const sessionId = getSessionId(req);
    if (!access_token || !termid || !sectiontype || !sectionid || !extraid || !scoutid || !column || value === undefined) {
        return res.status(400).json({ error: 'Missing required parameters: access_token, termid, sectiontype, sectionid, extraid, scoutid, column, or value' });
    }
    try {
        const params = new URLSearchParams();
        params.append('termid', termid);
        params.append('section', sectiontype);
        params.append('sectionid', sectionid);
        params.append('extraid', extraid);
        params.append('scoutid', scoutid);
        params.append('column', column);
        params.append('value', value);

        const response = await makeOSMRequest('https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=updateScout&nototal', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        }, sessionId);
        const text = await response.text();
        console.log('Update FlexiRecord API response:', text.substring(0, 200)); // Log first 200 chars
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return res.status(502).json({ error: 'Upstream returned non-JSON', details: text.substring(0, 500) });
        }
        res.json(data);
    } catch (err) {
        console.error('Error in /update-flexi-record:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
    console.log('Available endpoints:');
    console.log('- POST /callback (OAuth callback)');
    console.log('- GET /token (Get current token)');
    console.log('- POST /logout (Logout)');
    console.log('- GET /rate-limit-status (Rate limit monitoring)');
    console.log('- POST /exchange-token (Legacy)');
    console.log('- POST /get-terms');
    console.log('- POST /get-section-config');
    console.log('- POST /get-user-roles');
    console.log('- POST /get-events');
    console.log('- POST /get-event-attendance');
    console.log('- GET /get-contact-details');
    console.log('- GET /get-list-of-members');
    console.log('- GET /get-flexi-records');
    console.log('- POST /get-single-flexi-record');
    console.log('- POST /update-flexi-record');
});