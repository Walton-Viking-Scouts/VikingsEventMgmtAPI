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

// OAuth callback endpoint
const oauthCallback = async (req, res) => {
    const { code, redirect_uri } = req.body;
    console.log('OAuth callback received:', { 
        code: code?.substring(0, 10) + '...', 
        redirect_uri,
        timestamp: new Date().toISOString()
    });
    
    if (!code) {
        return res.status(400).json({ error: 'Authorization code required' });
    }
    
    try {
        // Exchange code for token
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', oauthclientid);
        params.append('client_secret', oauthsecret);
        params.append('redirect_uri', redirect_uri);
        params.append('code', code);

        const response = await fetch('https://www.onlinescoutmanager.co.uk/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        
        const text = await response.text();
        console.log('OSM OAuth response status:', response.status);
        console.log('OSM OAuth response (first 200 chars):', text.substring(0, 200));
        
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
        
        if (data.access_token) {
            // Generate session ID
            const sessionId = getSessionId(req) + '_' + Date.now();
            
            // Store token with session ID
            userTokens.set(sessionId, {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_at: Date.now() + (data.expires_in * 1000),
                created_at: Date.now()
            });
            
            // Set session cookie
            res.cookie('session_id', sessionId, { 
                httpOnly: true, 
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: data.expires_in * 1000 
            });
            
            console.log('✅ OAuth token stored successfully');
            res.json({ 
                success: true, 
                sessionId: sessionId,
                expires_in: data.expires_in 
            });
        } else if (data.error) {
            console.error('OAuth error:', data);
            res.status(400).json(data);
        } else {
            console.error('Unexpected OAuth response format');
            res.status(502).json({ error: 'Unexpected response format', details: data });
        }
    } catch (err) {
        console.error('Error in OAuth callback:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
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

// Legacy token exchange endpoint (for backwards compatibility)
const exchangeToken = async (req, res) => {
    const { code, redirect_uri } = req.body;
    
    // Enhanced logging for debugging
    console.log('=== OAuth Token Exchange Debug ===');
    console.log('Request body:', { 
        code: code ? `${code.substring(0, 10)}...` : 'MISSING', 
        redirect_uri: redirect_uri || 'MISSING',
        code_length: code ? code.length : 0
    });
    console.log('OAuth Config:', { 
        client_id: oauthclientid,
        client_secret: oauthsecret ? `${oauthsecret.substring(0, 10)}...` : 'MISSING',
        redirect_uri_param: redirect_uri
    });
    
    if (!code) {
        console.error('ERROR: Missing authorization code');
        return res.status(400).json({ error: 'Missing authorization code' });
    }
    
    if (!redirect_uri) {
        console.error('ERROR: Missing redirect_uri');
        return res.status(400).json({ error: 'Missing redirect_uri' });
    }
    
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', oauthclientid);
    params.append('client_secret', oauthsecret);
    params.append('redirect_uri', redirect_uri);
    params.append('code', code);
    
    console.log('Request parameters being sent to OSM:');
    console.log('- grant_type:', 'authorization_code');
    console.log('- client_id:', oauthclientid);
    console.log('- client_secret:', oauthsecret ? '[PRESENT]' : '[MISSING]');
    console.log('- redirect_uri:', redirect_uri);
    console.log('- code:', code ? `${code.substring(0, 15)}...` : '[MISSING]');

    try {
        const response = await fetch('https://www.onlinescoutmanager.co.uk/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        
        const text = await response.text();
        console.log('OSM OAuth response status:', response.status);
        console.log('OSM OAuth response headers:', Object.fromEntries(response.headers.entries()));
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
        
        console.log('Parsed OSM token response:', data);
        
        // Check for OAuth errors
        if (data.error) {
            console.error('=== OAuth Error Details ===');
            console.error('Error:', data.error);
            console.error('Description:', data.error_description);
            console.error('Hint:', data.hint);
            console.error('Message:', data.message);
            console.error('========================');
            
            // Return detailed error for debugging
            return res.status(400).json({
                error: 'OAuth Error',
                oauth_error: data.error,
                description: data.error_description,
                hint: data.hint,
                message: data.message,
                debug_info: {
                    client_id: oauthclientid,
                    redirect_uri: redirect_uri,
                    code_provided: !!code,
                    code_length: code ? code.length : 0
                }
            });
        }
        
        res.json(data);
    } catch (err) {
        console.error('Error in /exchange-token:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};

module.exports = {
    oauthCallback,
    getCurrentToken,
    logout,
    exchangeToken
};