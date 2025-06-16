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
        if (now - data.lastUpdated > 3600000) {
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
        if (osmInfo.reset && now < osmInfo.reset * 1000) {
            return false; // Still rate limited
        } else {
            // Reset expired, allow request
            osmInfo.rateLimited = false;
            osmInfo.retryAfter = null;
        }
    }
    
    // Check remaining requests
    return osmInfo.remaining === null || osmInfo.remaining > 0;
};

// OSM API request wrapper that handles rate limiting
const makeOSMRequest = async (url, options = {}, sessionId = null) => {
    // Check rate limits before making request
    if (sessionId && !shouldAllowOSMRequest(sessionId)) {
        const osmInfo = osmRateLimitTracker.get(sessionId);
        const response = new Response(JSON.stringify({
            error: 'Rate limited',
            retryAfter: osmInfo.retryAfter
        }), { status: 429 });
        return response;
    }

    const response = await fetch(url, options);
    
    // Extract rate limit headers from OSM response
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    
    // Store OSM rate limit info per user session
    if (sessionId && (limit || remaining || reset)) {
        osmRateLimitTracker.set(sessionId, {
            limit: limit ? parseInt(limit) : null,
            remaining: remaining ? parseInt(remaining) : null,
            reset: reset ? parseInt(reset) : null,
            rateLimited: response.status === 429,
            retryAfter: response.status === 429 ? 
                response.headers.get('Retry-After') || 3600 : null,
            lastUpdated: Date.now()
        });
    }
    
    // Log response status
    console.log(`OSM API Response: ${response.status} for ${url}`);
    
    // Handle rate limiting response
    if (response.status === 429) {
        console.log('OSM API rate limit hit');
        const retryAfter = response.headers.get('Retry-After') || '3600';
        console.log(`Retry after: ${retryAfter} seconds`);
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
        console.warn(`⚠️  OSM API rate limit low: ${osmInfo.remaining}/${osmInfo.limit} remaining`);
    }
    
    // Frontend-friendly warnings for different thresholds
    if (osmInfo && osmInfo.limit && osmInfo.remaining !== null) {
        const percentage = (osmInfo.remaining / osmInfo.limit) * 100;
        if (percentage <= 10) {
            console.warn(`⚠️  OSM API rate limit critical: ${osmInfo.remaining}/${osmInfo.limit} requests remaining (${percentage.toFixed(1)}%)`);
        } else if (percentage <= 25) {
            console.warn(`⚠️  OSM API rate limit warning: ${osmInfo.remaining}/${osmInfo.limit} requests remaining (${percentage.toFixed(1)}%)`);
        }
    }
    
    return response;
};

module.exports = {
    backendRateLimit,
    makeOSMRequest,
    getSessionId,
    getOSMRateLimitInfo,
    addRateLimitInfoToResponse,
    // Export constants for testing
    MAX_REQUESTS_PER_WINDOW,
    BACKEND_RATE_LIMIT_WINDOW
};