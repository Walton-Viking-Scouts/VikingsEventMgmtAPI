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
        expires_in: Math.floor((tokenData.expires_at - Date.now()) / 1000)
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

module.exports = {
    getCurrentToken,
    logout
};