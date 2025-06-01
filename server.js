const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const apiid = 'JiZxFkZiFaBrlyO6g4cCBEfig1hOKEex';   // <-- Replace with your actual API ID
const token = 'cvNCEYpxZOGUIXmxTm3cyJpOb0QhvKkZm1hK6A0wY46HxOe1cH2DYWHVPykdq54u'; // <-- Replace with your actual API Token

// Exchange code for access token
app.post('/exchange-token', async (req, res) => {
    const { code, redirect_uri } = req.body;
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', apiid);
    params.append('client_secret', token);
    params.append('redirect_uri', redirect_uri);
    params.append('code', code);

    try {
        const response = await fetch('https://www.onlinescoutmanager.co.uk/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        const data = await response.json();
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