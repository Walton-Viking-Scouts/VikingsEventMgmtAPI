// Import Sentry logging
const { logger } = require('../config/sentry');
const fallbackLogger = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.log,
  fmt: (strings, ...values) => strings.reduce((result, string, i) => result + string + (values[i] || ''), ''),
};
const log = logger || fallbackLogger;

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
      now - timestamp < BACKEND_RATE_LIMIT_WINDOW,
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

  // Ensure rateLimitTracker is initialized for the sessionId
  if (!rateLimitTracker.has(sessionId)) {
    rateLimitTracker.set(sessionId, { requests: [] });
  }

  const userLimits = rateLimitTracker.get(sessionId);
  const now = Date.now();

  // Validate userLimits and requests array
  if (!userLimits || !Array.isArray(userLimits.requests)) {
    userLimits.requests = [];
  }

  // Clean up old requests outside the rate limit window
  userLimits.requests = userLimits.requests.filter(timestamp => now - timestamp < BACKEND_RATE_LIMIT_WINDOW);

  // Calculate remaining requests and reset time
  const remaining = MAX_REQUESTS_PER_WINDOW - userLimits.requests.length;
  const resetTime = userLimits.requests.length > 0
    ? Math.ceil((userLimits.requests[0] + BACKEND_RATE_LIMIT_WINDOW) / 1000)
    : Math.ceil((Date.now() + BACKEND_RATE_LIMIT_WINDOW) / 1000);

  // Ensure rate limit headers are always set
  res.set({
    'x-backend-ratelimit-limit': MAX_REQUESTS_PER_WINDOW,
    'x-backend-ratelimit-remaining': Math.max(remaining, 0), // Ensure non-negative value
    'x-backend-ratelimit-reset': resetTime,
  });

  // If the user has exceeded the rate limit, return a 429 response
  if (userLimits.requests.length >= MAX_REQUESTS_PER_WINDOW) {
    // Log backend rate limiting
    log.warn(log.fmt`Backend Rate Limit Exceeded: ${req.path}`, {
      endpoint: req.path,
      method: req.method,
      identifier: sessionId,
      clientIp: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      rateLimitInfo: {
        limit: MAX_REQUESTS_PER_WINDOW,
        remaining: 0,
        reset: resetTime,
        window: 'per minute',
        requestCount: userLimits.requests.length,
      },
      section: 'backend-rate-limit',
      timestamp: new Date().toISOString(),
    });
        
    return res.status(429).json({
      error: 'Rate limit exceeded. Please try again later.',
      rateLimit: {
        limit: MAX_REQUESTS_PER_WINDOW,
        remaining: 0,
        reset: resetTime,
      },
    });
  }

  // Add the current request timestamp
  userLimits.requests.push(now);

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
      // Reset expired, allow request - log recovery
      log.info(log.fmt`OSM Rate Limit Recovery: Session ${sessionId}`, {
        sessionId,
        rateLimitInfo: {
          previousLimit: osmInfo.limit,
          resetTime: osmInfo.reset,
          wasRateLimited: true,
        },
        section: 'osm-rate-limit',
        timestamp: new Date().toISOString(),
      });
            
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
        
    // Log proactive OSM rate limit blocking
    log.warn(log.fmt`OSM Proactive Rate Limit Block: ${url}`, {
      url,
      sessionId,
      method: options.method || 'GET',
      rateLimitInfo: {
        rateLimited: osmInfo.rateLimited,
        remaining: osmInfo.remaining,
        reset: osmInfo.reset,
        retryAfter: osmInfo.retryAfter,
        limit: osmInfo.limit,
      },
      reason: osmInfo.rateLimited ? 'Still in cooldown period' : 'No remaining requests',
      section: 'osm-rate-limit',
      timestamp: new Date().toISOString(),
    });
        
    const response = new Response(JSON.stringify({
      error: 'Rate limited',
      retryAfter: osmInfo.retryAfter,
    }), { status: 429 });
    return response;
  }

  const response = await fetch(url, options);
    
  // Extract rate limit headers from OSM response
  const limit = response.headers.get('X-RateLimit-Limit');
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');
  
  // Check for critical OSM headers
  const xBlocked = response.headers.get('X-Blocked');
  const xDeprecated = response.headers.get('X-Deprecated');
  
  // Log critical OSM API issues to Sentry
  if (xBlocked) {
    log.error(log.fmt`OSM API BLOCKED: Application has been blocked by OSM`, {
      url,
      sessionId,
      method: options.method || 'GET',
      xBlocked,
      rateLimitInfo: {
        limit: limit ? parseInt(limit) : null,
        remaining: remaining ? parseInt(remaining) : null,
        reset: reset ? parseInt(reset) : null,
      },
      section: 'osm-critical-error',
      timestamp: new Date().toISOString(),
    });
  }
  
  if (xDeprecated) {
    log.warn(log.fmt`OSM API DEPRECATED: Endpoint will be removed after ${xDeprecated}`, {
      url,
      sessionId,
      method: options.method || 'GET',
      xDeprecated,
      section: 'osm-deprecated',
      timestamp: new Date().toISOString(),
    });
  }
    
  // Store OSM rate limit info per user session
  if (sessionId && (limit || remaining || reset)) {
    const newRateLimitInfo = {
      limit: limit ? parseInt(limit) : null,
      remaining: remaining ? parseInt(remaining) : null,
      reset: reset ? parseInt(reset) : null,
      rateLimited: response.status === 429,
      retryAfter: response.status === 429 ? 
        response.headers.get('Retry-After') || 3600 : null,
      lastUpdated: Date.now(),
    };
        
    osmRateLimitTracker.set(sessionId, newRateLimitInfo);
        
    // Log rate limit info updates (debug level)
    if (remaining !== null) {
      log.debug(log.fmt`OSM Rate Limit Info Updated: ${url}`, {
        url,
        sessionId,
        rateLimitInfo: newRateLimitInfo,
        section: 'osm-rate-limit',
        timestamp: new Date().toISOString(),
      });
    }
  }
    
  // Handle rate limiting response
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || '3600';
    
    // Log 429 errors to Sentry as high priority
    log.error(log.fmt`OSM API Rate Limit Exceeded (429): ${url}`, {
      url,
      sessionId,
      method: options.method || 'GET',
      retryAfter,
      rateLimitInfo: {
        limit: limit ? parseInt(limit) : null,
        remaining: remaining ? parseInt(remaining) : null,
        reset: reset ? parseInt(reset) : null,
      },
      section: 'osm-rate-limit-exceeded',
      timestamp: new Date().toISOString(),
    });
    
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
        rateLimited: osmInfo.rateLimited || false,
      } : null,
      backend: {
        remaining: res.getHeader('x-backend-ratelimit-remaining'),
        limit: res.getHeader('x-backend-ratelimit-limit'),
      },
    },
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
  BACKEND_RATE_LIMIT_WINDOW,
};
