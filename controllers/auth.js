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
const { logger } = require('../config/sentry');
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

// Validate token from Authorization header (cross-domain compatible)
const validateTokenFromHeader = (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  // Find token in storage by comparing access_token values
  let foundSessionId = null;
  let tokenData = null;
  
  for (const [sessionId, storedData] of userTokens.entries()) {
    if (storedData.access_token === token) {
      foundSessionId = sessionId;
      tokenData = storedData;
      break;
    }
  }
  
  if (!tokenData) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  // Check if token is expired
  if (Date.now() > tokenData.expires_at) {
    userTokens.delete(foundSessionId);
    return res.status(401).json({ error: 'Token expired' });
  }
  
  res.json({
    access_token: tokenData.access_token,
    expires_at: tokenData.expires_at,
    expires_in: Math.floor((tokenData.expires_at - Date.now()) / 1000),
    sessionId: foundSessionId,
    valid: true,
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

module.exports = {
  getCurrentToken,
  validateTokenFromHeader,
  logout,
  storeToken,
  getTokenStats,
  userTokens, // Export for debugging (remove in production)
};
