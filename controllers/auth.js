// OAuth configuration from environment variables
const oauthclientid = process.env.OAUTH_CLIENT_ID;
const oauthsecret = process.env.OAUTH_CLIENT_SECRET;

// Validate OAuth configuration
if (!oauthclientid || !oauthsecret) {
  console.error('❌ CRITICAL: OAuth credentials not found in environment variables!');
  console.error('❌ Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET environment variables');
  console.error('❌ Server cannot start without OAuth credentials');
  process.exit(1);
}

// Store tokens in memory (use Redis/DB in production)
const userTokens = new Map();

// Import rate limiting utilities
const { getSessionId } = require('../middleware/rateLimiting');

// Import Sentry logging
const { logger, Sentry } = require('../config/sentry');
const fallbackLogger = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.log,
  fmt: (strings, ...values) => strings.reduce((result, string, i) => result + string + (values[i] || ''), ''),
};
const log = logger || fallbackLogger;

// Cleanup expired tokens every 15 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [sessionId, tokenData] of userTokens.entries()) {
    if (now > tokenData.expires_at) {
      userTokens.delete(sessionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    log.info(log.fmt`Token cleanup completed: ${cleanedCount} tokens removed`, {
      cleanedCount,
      activeTokens: userTokens.size,
      section: 'oauth-token-cleanup',
      timestamp: new Date().toISOString(),
    });
  }
}, CLEANUP_INTERVAL);

// Get current token endpoint
const getCurrentToken = (req, res) => {
  const sessionId = getSessionId(req);
  const tokenData = userTokens.get(sessionId);
    
  if (!tokenData) {
    return res.status(401).json({ error: 'No active session' });
  }
    
  // Check if token is expired
  if (Date.now() > tokenData.expires_at) {
    userTokens.delete(sessionId);
    return res.status(401).json({ error: 'Token expired' });
  }
    
  res.json({
    access_token: tokenData.access_token,
    expires_at: tokenData.expires_at,
    expires_in: Math.floor((tokenData.expires_at - Date.now()) / 1000),
  });
};

// Logout endpoint
const logout = (req, res) => {
  const sessionId = getSessionId(req);
    
  // Remove token from memory
  userTokens.delete(sessionId);
    
  // Clear session cookie
  res.clearCookie('session_id');
    
  log.info(log.fmt`User logged out successfully: ${sessionId}`, {
    sessionId,
    section: 'oauth-logout',
    timestamp: new Date().toISOString(),
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

// Helper function to store token (for use in OAuth callback)
const storeToken = (sessionId, tokenData) => {
  // Calculate expiration time (OSM tokens typically last 1 hour)
  const expiresIn = tokenData.expires_in || 3600; // Default to 1 hour
  const expiresAt = Date.now() + (expiresIn * 1000);
  
  const storedTokenData = {
    access_token: tokenData.access_token,
    token_type: tokenData.token_type || 'Bearer',
    expires_at: expiresAt,
    scope: tokenData.scope,
    created_at: Date.now(),
  };
  
  userTokens.set(sessionId, storedTokenData);
  log.info(log.fmt`Token stored successfully: ${sessionId}`, {
    sessionId,
    tokenType: storedTokenData.token_type,
    expiresAt: new Date(expiresAt).toISOString(),
    expiresIn: expiresIn,
    scope: tokenData.scope || 'Not specified',
    section: 'oauth-token-storage',
    timestamp: new Date().toISOString(),
  });
  
  return storedTokenData;
};

// Get token storage statistics (for debugging)
const getTokenStats = () => {
  const now = Date.now();
  let activeTokens = 0;
  let expiredTokens = 0;
  
  for (const [sessionId, tokenData] of userTokens.entries()) {
    if (now > tokenData.expires_at) {
      expiredTokens++;
    } else {
      activeTokens++;
    }
  }
  
  return {
    total: userTokens.size,
    active: activeTokens,
    expired: expiredTokens,
  };
};

// Comprehensive token validation function with structured logging
const validateTokenFromHeader = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const sessionId = getSessionId(req);
  const endpoint = req.path;
  const method = req.method;
  const userAgent = req.get('User-Agent');
  
  // Log token validation attempt
  log.info(log.fmt`Token validation attempt initiated`, {
    sessionId,
    endpoint,
    method,
    hasAuthHeader: !!authHeader,
    userAgent,
    section: 'token-validation',
    timestamp: new Date().toISOString(),
  });
  
  // Track validation attempt in Sentry
  if (Sentry) {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Token validation attempt',
      level: 'info',
      data: {
        sessionId: sessionId ? sessionId.substring(0, 8) + '...' : null,
        endpoint,
        method,
        hasAuthHeader: !!authHeader,
      },
    });
  }
  
  // Check if Authorization header is present
  if (!authHeader) {
    log.warn(log.fmt`Token validation failed: Authorization header missing`, {
      sessionId,
      endpoint,
      method,
      userAgent,
      errorType: 'missing_header',
      section: 'token-validation',
      timestamp: new Date().toISOString(),
    });
    
    // Track missing header in Sentry
    if (Sentry) {
      Sentry.captureMessage('Token validation failed - Authorization header missing', {
        level: 'warning',
        tags: {
          section: 'token-validation',
          error_type: 'missing_header',
        },
        extra: {
          sessionId: sessionId ? sessionId.substring(0, 8) + '...' : null,
          endpoint,
          method,
          userAgent,
        },
      });
    }
    
    return res.status(401).json({ 
      error: 'Authorization header required',
      details: 'Missing Authorization header with Bearer token'
    });
  }
  
  // Check if Authorization header is properly formatted
  if (!authHeader.startsWith('Bearer ')) {
    log.warn(log.fmt`Token validation failed: Authorization header malformed`, {
      sessionId,
      endpoint,
      method,
      userAgent,
      authHeaderFormat: authHeader.substring(0, 20) + '...',
      errorType: 'malformed_header',
      section: 'token-validation',
      timestamp: new Date().toISOString(),
    });
    
    // Track malformed header in Sentry
    if (Sentry) {
      Sentry.captureMessage('Token validation failed - Authorization header malformed', {
        level: 'warning',
        tags: {
          section: 'token-validation',
          error_type: 'malformed_header',
        },
        extra: {
          sessionId: sessionId ? sessionId.substring(0, 8) + '...' : null,
          endpoint,
          method,
          userAgent,
          authHeaderPrefix: authHeader.substring(0, 20),
        },
      });
    }
    
    return res.status(401).json({ 
      error: 'Invalid Authorization header format',
      details: 'Authorization header must start with "Bearer "'
    });
  }
  
  // Extract token from header
  const token = authHeader.substring(7); // Remove "Bearer " prefix
  
  if (!token || token.trim() === '') {
    log.warn(log.fmt`Token validation failed: Empty token in Authorization header`, {
      sessionId,
      endpoint,
      method,
      userAgent,
      errorType: 'empty_token',
      section: 'token-validation',
      timestamp: new Date().toISOString(),
    });
    
    // Track empty token in Sentry
    if (Sentry) {
      Sentry.captureMessage('Token validation failed - Empty token', {
        level: 'warning',
        tags: {
          section: 'token-validation',
          error_type: 'empty_token',
        },
        extra: {
          sessionId: sessionId ? sessionId.substring(0, 8) + '...' : null,
          endpoint,
          method,
          userAgent,
        },
      });
    }
    
    return res.status(401).json({ 
      error: 'Empty token',
      details: 'Token cannot be empty'
    });
  }
  
  // Look up token in stored tokens using session ID
  const tokenData = userTokens.get(sessionId);
  
  if (!tokenData) {
    log.warn(log.fmt`Token validation failed: Token not found for session`, {
      sessionId,
      endpoint,
      method,
      userAgent,
      tokenLength: token.length,
      errorType: 'token_not_found',
      section: 'token-validation',
      timestamp: new Date().toISOString(),
    });
    
    // Track token not found in Sentry
    if (Sentry) {
      Sentry.captureMessage('Token validation failed - Token not found', {
        level: 'warning',
        tags: {
          section: 'token-validation',
          error_type: 'token_not_found',
        },
        extra: {
          sessionId: sessionId ? sessionId.substring(0, 8) + '...' : null,
          endpoint,
          method,
          userAgent,
          tokenLength: token.length,
        },
      });
    }
    
    return res.status(401).json({ 
      error: 'Invalid token',
      details: 'Token not found or session expired'
    });
  }
  
  // Check if stored token matches the provided token
  if (tokenData.access_token !== token) {
    log.warn(log.fmt`Token validation failed: Token mismatch`, {
      sessionId,
      endpoint,
      method,
      userAgent,
      providedTokenLength: token.length,
      storedTokenLength: tokenData.access_token.length,
      errorType: 'token_mismatch',
      section: 'token-validation',
      timestamp: new Date().toISOString(),
    });
    
    // Track token mismatch in Sentry
    if (Sentry) {
      Sentry.captureMessage('Token validation failed - Token mismatch', {
        level: 'warning',
        tags: {
          section: 'token-validation',
          error_type: 'token_mismatch',
        },
        extra: {
          sessionId: sessionId ? sessionId.substring(0, 8) + '...' : null,
          endpoint,
          method,
          userAgent,
          providedTokenLength: token.length,
          storedTokenLength: tokenData.access_token.length,
        },
      });
    }
    
    return res.status(401).json({ 
      error: 'Invalid token',
      details: 'Token does not match stored token'
    });
  }
  
  // Check if token is expired
  const now = Date.now();
  if (now > tokenData.expires_at) {
    // Remove expired token
    userTokens.delete(sessionId);
    
    log.warn(log.fmt`Token validation failed: Token expired`, {
      sessionId,
      endpoint,
      method,
      userAgent,
      expiresAt: new Date(tokenData.expires_at).toISOString(),
      currentTime: new Date(now).toISOString(),
      expiredBy: Math.floor((now - tokenData.expires_at) / 1000),
      errorType: 'token_expired',
      section: 'token-validation',
      timestamp: new Date().toISOString(),
    });
    
    // Track token expiration in Sentry
    if (Sentry) {
      Sentry.captureMessage('Token validation failed - Token expired', {
        level: 'info',
        tags: {
          section: 'token-validation',
          error_type: 'token_expired',
        },
        extra: {
          sessionId: sessionId ? sessionId.substring(0, 8) + '...' : null,
          endpoint,
          method,
          userAgent,
          expiresAt: new Date(tokenData.expires_at).toISOString(),
          expiredBy: Math.floor((now - tokenData.expires_at) / 1000),
        },
      });
    }
    
    return res.status(401).json({ 
      error: 'Token expired',
      details: 'Token has expired, please re-authenticate'
    });
  }
  
  // Token validation successful
  log.info(log.fmt`Token validation successful`, {
    sessionId,
    endpoint,
    method,
    userAgent,
    tokenType: tokenData.token_type,
    scope: tokenData.scope,
    expiresAt: new Date(tokenData.expires_at).toISOString(),
    timeToExpiry: Math.floor((tokenData.expires_at - now) / 1000),
    section: 'token-validation',
    timestamp: new Date().toISOString(),
  });
  
  // Track successful validation in Sentry
  if (Sentry) {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Token validation successful',
      level: 'info',
      data: {
        sessionId: sessionId ? sessionId.substring(0, 8) + '...' : null,
        endpoint,
        method,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
        timeToExpiry: Math.floor((tokenData.expires_at - now) / 1000),
      },
    });
  }
  
  // Attach user/token data to request for use in subsequent middleware
  req.user = {
    sessionId,
    tokenData,
    accessToken: tokenData.access_token,
    tokenType: tokenData.token_type,
    scope: tokenData.scope,
    expiresAt: tokenData.expires_at,
  };
  
  next();
};

module.exports = {
  getCurrentToken,
  logout,
  storeToken,
  getTokenStats,
  userTokens, // Export for debugging (remove in production)
  validateTokenFromHeader,
};
