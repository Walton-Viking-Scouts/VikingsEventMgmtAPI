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
    console.log(`🧹 Cleaned up ${cleanedCount} expired tokens. Active tokens: ${userTokens.size}`);
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
    
  console.log('User logged out successfully');
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
  console.log(`✅ Token stored for session: ${sessionId}, expires: ${new Date(expiresAt).toISOString()}`);
  
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
  logout,
  storeToken,
  getTokenStats,
  userTokens, // Export for debugging (remove in production)
};
