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

const oauthclientid = '98YWRWrOQyUVAlJuPHs8AdsbVg2mUCQO';
const oauthsecret = 'DwYXWqxsf7MlkNQE1dF0cRzrmdbjFdXqhwUER8270C99Y5CmNc5yx2l4OxU5QjNm';

// Store tokens in memory (use Redis/DB in production)
const userTokens = new Map();

// OAuth callback endpoint
app.post('/callback', async (req, res) => {
    const { code } = req.body;
    
    if (!code) {
        return res.status(400).json({ error: 'Authorization code required' });
    }

    try {
        console.log('Processing OAuth callback...');
        
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', oauthclientid);
        params.append('client_secret', oauthsecret);
        params.append('redirect_uri', 'https://localhost:3000/callback.html');
        params.append('code', code);

        const response = await fetch('https://www.onlinescoutmanager.co.uk/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const tokenData = await response.json();
        console.log('Token exchange result:', tokenData);

        if (tokenData.access_token) {
            const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            userTokens.set(sessionId, {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_at: Date.now() + (tokenData.expires_in * 1000)
            });

            res.cookie('session_id', sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'none', // Required for cross-origin cookies
                maxAge: tokenData.expires_in * 1000
            });

            res.json({ success: true });
        } else {
            console.error('No access token received:', tokenData);
            res.status(400).json({ error: 'Token exchange failed', details: tokenData });
        }

    } catch (error) {
        console.error('OAuth callback error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Token endpoint - THIS WAS MISSING!
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
    res.json({ success: true });
});

// Exchange code for access token (existing endpoint)
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
        console.log('OSM token response:', data);
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

// Proxy getFlexiRecords to avoid CORS
app.post('/get-flexi-records', async (req, res) => {
    const { sectionid, archived = 'n' } = req.body;
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    if (!access_token || !sectionid) {
        return res.status(400).json({ error: 'Missing access_token or sectionid' });
    }
    try {
        const response = await fetch(`https://www.onlinescoutmanager.co.uk/api.php?action=getFlexiRecords&sectionid=${sectionid}&archived=${archived}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Error in /get-flexi-records:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
    console.log('Available endpoints:');
    console.log('- POST /callback (OAuth callback)');
    console.log('- GET /token (Get current token)');
    console.log('- POST /logout (Logout)');
    console.log('- POST /exchange-token (Legacy)');
    console.log('- POST /get-terms');
    console.log('- POST /get-section-config');
    console.log('- POST /get-user-roles');
    console.log('- POST /get-events');
    console.log('- POST /get-event-attendance');
    console.log('- GET /get-contact-details');
    console.log('- GET /get-list-of-members');
    console.log('- POST /get-flexi-records');
});