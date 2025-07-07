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
// Reverse map for O(1) token lookup: token -> sessionId
const tokenToSessionId = new Map();

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
      // Clean up both maps
      userTokens.delete(sessionId);
      tokenToSessionId.delete(tokenData.access_token);
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

// Shared token validation utility
const authUtils = {
  /**
   * Validates token from request with comprehensive logging and Sentry integration
   * @param {Object} req - Express request object
   * @param {string} section - Section identifier for logging
   * @returns {Object} - Validation result with success, error, sessionId, and tokenData
   */
  validateToken: (req, section = 'token-validation') => {
    const authHeader = req.headers.authorization;
    const sessionId = getSessionId(req);
    const endpoint = req.path;
    const method = req.method;
    const userAgent = req.get('User-Agent');
    
    // Log validation attempt
    log.info(log.fmt`Token validation attempt initiated`, {
      sessionId,
      endpoint,
      method,
      hasAuthHeader: !!authHeader,
      userAgent,
      section,
      timestamp: new Date().toISOString(),
    });
    
    // Track validation attempt in Sentry only if available
    if (Sentry && typeof Sentry.addBreadcrumb === 'function') {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Token validation attempt',
        level: 'info',
        data: {
          sessionId: sessionId ? sessionId.substring(0, 8) + '...' : null,
          endpoint,
          method,
          hasAuthHeader: !!authHeader,
          section,
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
        section,
        timestamp: new Date().toISOString(),
      });
      
      // Track missing header in Sentry only if available
      if (Sentry && typeof Sentry.captureMessage === 'function') {
        Sentry.captureMessage('Token validation failed - Authorization header missing', {
          level: 'warning',
          tags: {
            section,
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
      
      return {
        success: false,
        error: 'Authorization header required',
        details: 'Missing Authorization header with Bearer token',
        sessionId,
      };
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
        section,
        timestamp: new Date().toISOString(),
      });
      
      // Track malformed header in Sentry only if available
      if (Sentry && typeof Sentry.captureMessage === 'function') {
        Sentry.captureMessage('Token validation failed - Authorization header malformed', {
          level: 'warning',
          tags: {
            section,
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
      
      return {
        success: false,
        error: 'Invalid Authorization header format',
        details: 'Authorization header must start with "Bearer "',
        sessionId,
      };
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
        section,
        timestamp: new Date().toISOString(),
      });
      
      // Track empty token in Sentry only if available
      if (Sentry && typeof Sentry.captureMessage === 'function') {
        Sentry.captureMessage('Token validation failed - Empty token', {
          level: 'warning',
          tags: {
            section,
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
      
      return {
        success: false,
        error: 'Empty token',
        details: 'Token cannot be empty',
        sessionId,
      };
    }
    
    // O(1) token lookup using reverse map
    const foundSessionId = tokenToSessionId.get(token);
    const tokenData = foundSessionId ? userTokens.get(foundSessionId) : null;
    
    if (!tokenData) {
      log.warn(log.fmt`Token validation failed: Token not found`, {
        sessionId,
        endpoint,
        method,
        userAgent,
        tokenLength: token.length,
        totalStoredTokens: userTokens.size,
        errorType: 'token_not_found',
        section,
        timestamp: new Date().toISOString(),
      });
      
      // Track token not found in Sentry only if available
      if (Sentry && typeof Sentry.captureMessage === 'function') {
        Sentry.captureMessage('Token validation failed - Token not found', {
          level: 'warning',
          tags: {
            section,
            error_type: 'token_not_found',
          },
          extra: {
            sessionId: sessionId ? sessionId.substring(0, 8) + '...' : null,
            endpoint,
            method,
            userAgent,
            tokenLength: token.length,
            totalStoredTokens: userTokens.size,
          },
        });
      }
      
      return {
        success: false,
        error: 'Invalid or expired token',
        details: 'Token not found or session expired',
        sessionId,
      };
    }
    
    // Check if token is expired
    const now = Date.now();
    if (now > tokenData.expires_at) {
      // Remove expired token from both maps
      userTokens.delete(foundSessionId);
      tokenToSessionId.delete(token);
      
      log.warn(log.fmt`Token validation failed: Token expired`, {
        sessionId: foundSessionId,
        endpoint,
        method,
        userAgent,
        expiresAt: new Date(tokenData.expires_at).toISOString(),
        currentTime: new Date(now).toISOString(),
        expiredBy: Math.floor((now - tokenData.expires_at) / 1000),
        errorType: 'token_expired',
        section,
        timestamp: new Date().toISOString(),
      });
      
      // Track token expiration in Sentry only if available
      if (Sentry && typeof Sentry.captureMessage === 'function') {
        Sentry.captureMessage('Token validation failed - Token expired', {
          level: 'info',
          tags: {
            section,
            error_type: 'token_expired',
          },
          extra: {
            sessionId: foundSessionId ? foundSessionId.substring(0, 8) + '...' : null,
            endpoint,
            method,
            userAgent,
            expiresAt: new Date(tokenData.expires_at).toISOString(),
            expiredBy: Math.floor((now - tokenData.expires_at) / 1000),
          },
        });
      }
      
      return {
        success: false,
        error: 'Invalid or expired token',
        details: 'Token has expired, please re-authenticate',
        sessionId: foundSessionId,
      };
    }
    
    // Token validation successful
    log.info(log.fmt`Token validation successful`, {
      sessionId: foundSessionId,
      endpoint,
      method,
      userAgent,
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
      expiresAt: new Date(tokenData.expires_at).toISOString(),
      timeToExpiry: Math.floor((tokenData.expires_at - now) / 1000),
      section,
      timestamp: new Date().toISOString(),
    });
    
    // Track successful validation in Sentry only if available
    if (Sentry && typeof Sentry.addBreadcrumb === 'function') {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Token validation successful',
        level: 'info',
        data: {
          sessionId: foundSessionId ? foundSessionId.substring(0, 8) + '...' : null,
          endpoint,
          method,
          tokenType: tokenData.token_type,
          scope: tokenData.scope,
          timeToExpiry: Math.floor((tokenData.expires_at - now) / 1000),
          section,
        },
      });
    }
    
    return {
      success: true,
      sessionId: foundSessionId,
      tokenData,
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
      expiresAt: tokenData.expires_at,
    };
  },
};

// Get current token endpoint
const getCurrentToken = (req, res) => {
  const sessionId = getSessionId(req);
  const tokenData = userTokens.get(sessionId);
    
  if (!tokenData) {
    return res.status(401).json({ error: 'No active session' });
  }
    
  // Check if token is expired
  if (Date.now() > tokenData.expires_at) {
    // Clean up both maps
    userTokens.delete(sessionId);
    tokenToSessionId.delete(tokenData.access_token);
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
  const tokenData = userTokens.get(sessionId);
    
  // Remove token from both maps
  if (tokenData) {
    tokenToSessionId.delete(tokenData.access_token);
  }
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
  
  // Store in both maps
  userTokens.set(sessionId, storedTokenData);
  tokenToSessionId.set(tokenData.access_token, sessionId);
  
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
  
  for (const [_sessionId, tokenData] of userTokens.entries()) {
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
    reverseMapSize: tokenToSessionId.size,
  };
};

// Comprehensive token validation middleware using shared utility
const validateTokenFromHeader = (req, res, next) => {
  const validation = authUtils.validateToken(req, 'token-validation-middleware');
  
  if (!validation.success) {
    return res.status(401).json({ 
      error: validation.error,
      details: validation.details,
    });
  }
  
  // Attach user/token data to request for use in subsequent middleware
  req.user = {
    sessionId: validation.sessionId,
    tokenData: validation.tokenData,
    accessToken: validation.accessToken,
    tokenType: validation.tokenType,
    scope: validation.scope,
    expiresAt: validation.expiresAt,
  };
  
  next();
};

// Token validation endpoint (cross-domain compatible) using shared utility
const validateTokenEndpoint = (req, res) => {
  const validation = authUtils.validateToken(req, 'token-validation-endpoint');
  
  if (!validation.success) {
    return res.status(401).json({ 
      error: validation.error,
      details: validation.details,
    });
  }
  
  const now = Date.now();
  res.json({
    access_token: validation.accessToken,
    expires_at: validation.expiresAt,
    expires_in: Math.floor((validation.expiresAt - now) / 1000),
    sessionId: validation.sessionId,
    valid: true,
  });
};

module.exports = {
  getCurrentToken,
  logout,
  storeToken,
  getTokenStats,
  userTokens, // Export for debugging (remove in production)
  tokenToSessionId, // Export for debugging (remove in production)
  validateTokenFromHeader,
  validateTokenEndpoint,
  authUtils, // Export utility functions
};
