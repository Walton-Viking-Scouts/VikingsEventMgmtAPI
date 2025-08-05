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
// Adjust limits based on environment
const MAX_REQUESTS_PER_WINDOW = process.env.NODE_ENV === 'test' ? 1000 : 100; // Higher for tests

// Per-second rate limiting to prevent burst requests
const BACKEND_RATE_LIMIT_SECOND = 1000; // 1 second window
const MAX_REQUESTS_PER_SECOND = process.env.NODE_ENV === 'test' ? 100 : 5; // 5 req/sec for development and production

// Per-hour rate limiting to stay under OSM's 1000/hour limit
const BACKEND_RATE_LIMIT_HOUR = 3600000; // 1 hour window (60 * 60 * 1000)
const MAX_REQUESTS_PER_HOUR = process.env.NODE_ENV === 'test' ? 10000 : 900; // Higher for tests

// OSM Rate limit tracking per user
const osmRateLimitTracker = new Map();

// Clean up old tracking data periodically
setInterval(() => {
  const now = Date.now();
  // Clean backend rate limit tracking
  for (const [key, data] of rateLimitTracker.entries()) {
    // Clean minute window requests
    data.requests = data.requests.filter(timestamp => 
      now - timestamp < BACKEND_RATE_LIMIT_WINDOW,
    );
    // Clean second window requests
    data.secondRequests = data.secondRequests?.filter(timestamp => 
      now - timestamp < BACKEND_RATE_LIMIT_SECOND,
    ) || [];
    // Clean hour window requests
    data.hourRequests = data.hourRequests?.filter(timestamp => 
      now - timestamp < BACKEND_RATE_LIMIT_HOUR,
    ) || [];
    
    if (data.requests.length === 0 && data.secondRequests.length === 0 && data.hourRequests.length === 0) {
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

  // Skip rate limiting for health and debug endpoints
  if (req.path === '/health' || req.path === '/oauth/debug' || req.path.startsWith('/docs')) {
    return next();
  }

  // Ensure rateLimitTracker is initialized for the sessionId
  if (!rateLimitTracker.has(sessionId)) {
    rateLimitTracker.set(sessionId, { requests: [], secondRequests: [], hourRequests: [] });
  }

  const userLimits = rateLimitTracker.get(sessionId);
  const now = Date.now();

  // Validate userLimits and requests arrays
  if (!userLimits || !Array.isArray(userLimits.requests)) {
    userLimits.requests = [];
  }
  if (!Array.isArray(userLimits.secondRequests)) {
    userLimits.secondRequests = [];
  }
  if (!Array.isArray(userLimits.hourRequests)) {
    userLimits.hourRequests = [];
  }

  // Clean up old requests outside all rate limit windows
  userLimits.requests = userLimits.requests.filter(timestamp => now - timestamp < BACKEND_RATE_LIMIT_WINDOW);
  userLimits.secondRequests = userLimits.secondRequests.filter(timestamp => now - timestamp < BACKEND_RATE_LIMIT_SECOND);
  userLimits.hourRequests = userLimits.hourRequests.filter(timestamp => now - timestamp < BACKEND_RATE_LIMIT_HOUR);

  // Calculate remaining requests for all windows
  const remaining = MAX_REQUESTS_PER_WINDOW - userLimits.requests.length;
  const remainingPerSecond = MAX_REQUESTS_PER_SECOND - userLimits.secondRequests.length;
  const remainingPerHour = MAX_REQUESTS_PER_HOUR - userLimits.hourRequests.length;
  
  const resetTime = userLimits.requests.length > 0
    ? Math.ceil((userLimits.requests[0] + BACKEND_RATE_LIMIT_WINDOW) / 1000)
    : Math.ceil((Date.now() + BACKEND_RATE_LIMIT_WINDOW) / 1000);
  
  const resetTimeSecond = userLimits.secondRequests.length > 0
    ? Math.ceil((userLimits.secondRequests[0] + BACKEND_RATE_LIMIT_SECOND) / 1000)
    : Math.ceil((Date.now() + BACKEND_RATE_LIMIT_SECOND) / 1000);
  
  const resetTimeHour = userLimits.hourRequests.length > 0
    ? Math.ceil((userLimits.hourRequests[0] + BACKEND_RATE_LIMIT_HOUR) / 1000)
    : Math.ceil((Date.now() + BACKEND_RATE_LIMIT_HOUR) / 1000);

  // Ensure rate limit headers are always set (show the most restrictive limit)
  res.set({
    'x-backend-ratelimit-limit-minute': MAX_REQUESTS_PER_WINDOW,
    'x-backend-ratelimit-remaining-minute': Math.max(remaining, 0),
    'x-backend-ratelimit-reset-minute': resetTime,
    'x-backend-ratelimit-limit-second': MAX_REQUESTS_PER_SECOND,
    'x-backend-ratelimit-remaining-second': Math.max(remainingPerSecond, 0),
    'x-backend-ratelimit-reset-second': resetTimeSecond,
    'x-backend-ratelimit-limit-hour': MAX_REQUESTS_PER_HOUR,
    'x-backend-ratelimit-remaining-hour': Math.max(remainingPerHour, 0),
    'x-backend-ratelimit-reset-hour': resetTimeHour,
    // Legacy headers for backward compatibility (use most restrictive)
    'x-backend-ratelimit-limit': MAX_REQUESTS_PER_WINDOW,
    'x-backend-ratelimit-remaining': Math.max(Math.min(remaining, remainingPerSecond, remainingPerHour), 0),
    'x-backend-ratelimit-reset': resetTime,
  });

  // Check per-second rate limit first (more restrictive)
  if (userLimits.secondRequests.length >= MAX_REQUESTS_PER_SECOND) {
    log.warn(log.fmt`Backend Per-Second Rate Limit Exceeded: ${req.path}`, {
      endpoint: req.path,
      method: req.method,
      identifier: sessionId,
      clientIp: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      rateLimitInfo: {
        limit: MAX_REQUESTS_PER_SECOND,
        remaining: 0,
        reset: resetTimeSecond,
        window: 'per second',
        requestCount: userLimits.secondRequests.length,
      },
      section: 'backend-rate-limit-second',
      timestamp: new Date().toISOString(),
    });
        
    return res.status(429).json({
      error: 'Rate limit exceeded. Too many requests per second.',
      rateLimit: {
        limit: MAX_REQUESTS_PER_SECOND,
        remaining: 0,
        reset: resetTimeSecond,
        window: 'per second',
        retryAfter: Math.ceil((resetTimeSecond * 1000 - Date.now()) / 1000),
      },
    });
  }

  // Check per-hour rate limit (most restrictive for total volume)
  if (userLimits.hourRequests.length >= MAX_REQUESTS_PER_HOUR) {
    log.warn(log.fmt`Backend Per-Hour Rate Limit Exceeded: ${req.path}`, {
      endpoint: req.path,
      method: req.method,
      identifier: sessionId,
      clientIp: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      rateLimitInfo: {
        limit: MAX_REQUESTS_PER_HOUR,
        remaining: 0,
        reset: resetTimeHour,
        window: 'per hour',
        requestCount: userLimits.hourRequests.length,
      },
      section: 'backend-rate-limit-hour',
      timestamp: new Date().toISOString(),
    });
        
    return res.status(429).json({
      error: 'Rate limit exceeded. Too many requests per hour.',
      rateLimit: {
        limit: MAX_REQUESTS_PER_HOUR,
        remaining: 0,
        reset: resetTimeHour,
        window: 'per hour',
        retryAfter: Math.ceil((resetTimeHour * 1000 - Date.now()) / 1000),
      },
    });
  }

  // Check per-minute rate limit
  if (userLimits.requests.length >= MAX_REQUESTS_PER_WINDOW) {
    // Log backend rate limiting
    log.warn(log.fmt`Backend Per-Minute Rate Limit Exceeded: ${req.path}`, {
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
      section: 'backend-rate-limit-minute',
      timestamp: new Date().toISOString(),
    });
        
    return res.status(429).json({
      error: 'Rate limit exceeded. Please try again later.',
      rateLimit: {
        limit: MAX_REQUESTS_PER_WINDOW,
        remaining: 0,
        reset: resetTime,
        window: 'per minute',
        retryAfter: Math.ceil((resetTime * 1000 - Date.now()) / 1000),
      },
    });
  }

  // Add the current request timestamp to all arrays
  userLimits.requests.push(now);
  userLimits.secondRequests.push(now);
  userLimits.hourRequests.push(now);

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
        minute: {
          remaining: res.getHeader('x-backend-ratelimit-remaining-minute'),
          limit: res.getHeader('x-backend-ratelimit-limit-minute'),
          reset: res.getHeader('x-backend-ratelimit-reset-minute'),
        },
        second: {
          remaining: res.getHeader('x-backend-ratelimit-remaining-second'),
          limit: res.getHeader('x-backend-ratelimit-limit-second'),
          reset: res.getHeader('x-backend-ratelimit-reset-second'),
        },
        hour: {
          remaining: res.getHeader('x-backend-ratelimit-remaining-hour'),
          limit: res.getHeader('x-backend-ratelimit-limit-hour'),
          reset: res.getHeader('x-backend-ratelimit-reset-hour'),
        },
        // Legacy format for backward compatibility
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
  MAX_REQUESTS_PER_SECOND,
  BACKEND_RATE_LIMIT_SECOND,
  MAX_REQUESTS_PER_HOUR,
  BACKEND_RATE_LIMIT_HOUR,
};
