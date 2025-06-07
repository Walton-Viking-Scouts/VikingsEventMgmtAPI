const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

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

const oauthclientid = '98YWRWrOQyUVAlJuPHs8AdsbVg2mUCQO';   // <-- New OSM OAuth Client ID
const oauthsecret = 'DwYXWqxsf7MlkNQE1dF0cRzrmdbjFdXqhwUER8270C99Y5CmNc5yx2l4OxU5QjNm'; // <-- New OSM OAuth Secret

// Exchange code for access token
app.post('/exchange-token', async (req, res) => {
    const { code, redirect_uri } = req.body;
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
        const data = await response.json();
        console.log('OSM token response:', data); // <-- Add this line
        res.json(data);
    } catch (err) {
        console.error('Error in /exchange-token:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getTerms to avoid CORS
app.post('/get-terms', async (req, res) => {
    const { access_token } = req.body;
    if (!access_token) {
        return res.status(400).json({ error: 'No access token provided' });
    }
    try {
        const response = await fetch('https://www.onlinescoutmanager.co.uk/api.php?action=getTerms', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Error in /get-terms:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getSectionConfig to avoid CORS
app.post('/get-section-config', async (req, res) => {
    const { access_token, sectionid } = req.body;
    if (!access_token || !sectionid) {
        return res.status(400).json({ error: 'Missing access_token or sectionid' });
    }
    try {
        const response = await fetch(`https://www.onlinescoutmanager.co.uk/api.php?action=getSectionConfig&sectionid=${sectionid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Error in /get-section-config:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getUserRoles to avoid CORS
app.post('/get-user-roles', async (req, res) => {
    const { access_token } = req.body;
    if (!access_token) {
        return res.status(400).json({ error: 'No access token provided' });
    }
    try {
        const response = await fetch('https://www.onlinescoutmanager.co.uk/api.php?action=getUserRoles', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Error in /get-user-roles:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getEvents to avoid CORS
app.post('/get-events', async (req, res) => {
    const { access_token, sectionid, termid } = req.body;
    if (!access_token || !sectionid || !termid) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    try {
        const response = await fetch(`https://www.onlinescoutmanager.co.uk/ext/events/summary/?action=get&sectionid=${sectionid}&termid=${termid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Error in /get-events:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getEventAttendance to avoid CORS
app.post('/get-event-attendance', async (req, res) => {
    const { access_token, eventid, sectionid, termid } = req.body;
    if (!access_token || !eventid || !sectionid || termid === undefined) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    try {
        const response = await fetch(`https://www.onlinescoutmanager.co.uk/ext/events/event/?action=getAttendance&eventid=${eventid}&sectionid=${sectionid}&termid=${termid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Error in /get-event-attendance:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getContactDetails to avoid CORS
app.get('/get-contact-details', async (req, res) => {
    const { sectionid, scoutid, termid } = req.query;
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    if (!access_token || !sectionid || !scoutid || !termid) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    try {
        const response = await fetch(`https://onlinescoutmanager.co.uk/ext/members/contact/?action=getIndividual&sectionid=${sectionid}&scoutid=${scoutid}&termid=${termid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Error in /get-contact-details:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Proxy getListOfMembers to avoid CORS
app.get('/get-list-of-members', async (req, res) => {
    const { sectionid, termid, section } = req.query;
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    if (!access_token || !sectionid || !termid || !section) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    try {
        const apiUrl = `https://onlinescoutmanager.co.uk/ext/members/contact/?action=getListOfMembers&sort=dob&sectionid=${sectionid}&termid=${termid}&section=${encodeURIComponent(section)}`;
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return res.status(502).json({ error: 'Upstream returned non-JSON', details: text });
        }
        res.json(data);
    } catch (err) {
        console.error('Error in /get-list-of-members:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

app.listen(3001, () => {
    console.log('Backend listening on http://localhost:3001');
});

// Add this endpoint after your existing routes:

// OAuth callback endpoint
app.post('/callback', async (req, res) => {
    const { code } = req.body;
    
    if (!code) {
        return res.status(400).json({ error: 'Authorization code required' });
    }

    try {
        console.log('Processing OAuth callback with code:', code.substring(0, 20) + '...');
        
        // Exchange code for token
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', oauthclientid);
        params.append('client_secret', oauthsecret);
        params.append('redirect_uri', 'https://localhost:3000/callback.html'); // Your callback URL
        params.append('code', code);

        const response = await fetch('https://www.onlinescoutmanager.co.uk/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OSM token exchange failed:', response.status, errorText);
            return res.status(response.status).json({ 
                error: 'Token exchange failed', 
                details: errorText 
            });
        }

        const tokenData = await response.json();
        console.log('Token exchange successful');

        if (tokenData.access_token) {
            // Generate a session ID
            const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Store token with session ID
            userTokens.set(sessionId, {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_at: Date.now() + (tokenData.expires_in * 1000)
            });

            // Set session cookie
            res.cookie('session_id', sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: tokenData.expires_in * 1000
            });

            res.json({ 
                success: true, 
                message: 'Authentication successful' 
            });
        } else {
            console.error('No access token in response:', tokenData);
            res.status(400).json({ 
                error: 'No access token received', 
                details: tokenData 
            });
        }

    } catch (error) {
        console.error('OAuth callback error:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message 
        });
    }
});

// Token endpoint to get current user's token
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
    res.json({ success: true, message: 'Logged out successfully' });
});