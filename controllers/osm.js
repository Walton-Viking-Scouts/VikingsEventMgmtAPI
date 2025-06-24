// Import rate limiting utilities
const { 
    backendRateLimit,
    makeOSMRequest, 
    getSessionId, 
    getOSMRateLimitInfo, 
    addRateLimitInfoToResponse,
    MAX_REQUESTS_PER_WINDOW,
    BACKEND_RATE_LIMIT_WINDOW
} = require('../middleware/rateLimiting');

// Rate limit status endpoint for frontend monitoring (needs access to rateLimitTracker)
const getRateLimitStatus = (req, res) => {
    const sessionId = getSessionId(req);
    
    // Get backend rate limit info (this needs to be imported from rateLimiting.js)
    const now = Date.now();
    let backendInfo = {
        limit: MAX_REQUESTS_PER_WINDOW,
        remaining: MAX_REQUESTS_PER_WINDOW,
        resetTime: now + BACKEND_RATE_LIMIT_WINDOW,
        window: 'per minute'
    };
    
    // Note: This will need to be refactored to access rateLimitTracker from middleware
    // For now, using default values
    
    // Get OSM rate limit info
    const osmInfo = getOSMRateLimitInfo(sessionId);
    let osmRateLimit = {
        limit: null,
        remaining: null,
        resetTime: null,
        window: 'per hour',
        available: true
    };
    
    if (osmInfo) {
        osmRateLimit = {
            limit: osmInfo.limit,
            remaining: osmInfo.remaining,
            resetTime: osmInfo.reset ? osmInfo.reset * 1000 : null,
            window: 'per hour',
            available: !osmInfo.rateLimited,
            retryAfter: osmInfo.retryAfter
        };
    }
    
    res.json({
        backend: backendInfo,
        osm: osmRateLimit,
        timestamp: now
    });
};

// Proxy getTerms to avoid CORS
// Update getTerms function to use Authorization header
const getTerms = async (req, res) => {
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    
    if (!access_token) {
        return res.status(401).json({ error: 'Access token is required in Authorization header' });
    }

    try {
        const response = await makeOSMRequest(`https://www.onlinescoutmanager.co.uk/api.php?action=getTerms`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        if (!response.ok) {
            console.error(`OSM API error: ${response.status} ${response.statusText}`);
            return res.status(response.status).json({ error: `OSM API error: ${response.status}` });
        }
        
        const responseText = await response.text();
        
        if (!responseText.trim()) {
            console.error('Empty response from OSM API');
            return res.status(500).json({ error: 'Empty response from OSM API' });
        }
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            return res.status(500).json({ error: 'Invalid JSON response from OSM API' });
        }
        
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-terms:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};

// Proxy getSectionConfig to avoid CORS
const getSectionConfig = async (req, res) => {
    const { access_token, sectionid } = req.query;
    const sessionId = getSessionId(req);
    if (!access_token || !sectionid) {
        return res.status(400).json({ error: 'Missing access_token or sectionid' });
    }
    try {
        const response = await makeOSMRequest(`https://www.onlinescoutmanager.co.uk/api.php?action=getSectionConfig&sectionid=${sectionid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const data = await response.json();
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-section-config:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};

// Proxy getUserRoles to avoid CORS
const getUserRoles = async (req, res) => {
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    
    if (!access_token) {
        return res.status(401).json({ error: 'Access token is required in Authorization header' });
    }
    
    try {
        const response = await makeOSMRequest('https://www.onlinescoutmanager.co.uk/api.php?action=getUserRoles', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const data = await response.json();
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-user-roles:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};

// Update getEvents function to use Authorization header
const getEvents = async (req, res) => {
    const { sectionid, termid } = req.query;
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    
    if (!access_token) {
        return res.status(401).json({ error: 'Access token is required in Authorization header' });
    }
    
    if (!sectionid || !termid) {
        return res.status(400).json({ error: 'sectionid and termid are required' });
    }

    try {
        const response = await makeOSMRequest(`https://www.onlinescoutmanager.co.uk/ext/events/summary/?action=get&sectionid=${sectionid}&termid=${termid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        // Check if response is ok and has content
        if (!response.ok) {
            console.error(`OSM API error: ${response.status} ${response.statusText}`);
            return res.status(response.status).json({ error: `OSM API error: ${response.status}` });
        }
        
        // Get response text first to check if it's empty
        const responseText = await response.text();
        console.log('OSM API response text:', responseText.substring(0, 200) + '...');
        
        if (!responseText.trim()) {
            console.error('Empty response from OSM API');
            return res.status(500).json({ error: 'Empty response from OSM API' });
        }
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Response text:', responseText);
            return res.status(500).json({ error: 'Invalid JSON response from OSM API' });
        }
        
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-events:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};


// Proxy getEventAttendance to avoid CORS
const getEventAttendance = async (req, res) => {
    const { sectionid, termid, eventid } = req.query;
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    
    if (!access_token) {
        return res.status(401).json({ error: 'Access token is required in Authorization header' });
    }
    
    if (!sectionid || !termid || !eventid) {
        return res.status(400).json({ error: 'sectionid, termid, and eventid are required' });
    }

    try {
        const response = await makeOSMRequest(`https://www.onlinescoutmanager.co.uk/ext/events/event/?action=getAttendance&eventid=${eventid}&sectionid=${sectionid}&termid=${termid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const data = await response.json();
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-event-attendance:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};

// Proxy getContactDetails to avoid CORS
const getContactDetails = async (req, res) => {
    const { sectionid, scoutid } = req.query;
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    if (!access_token || !sectionid || !scoutid) {
        return res.status(400).json({ error: 'Missing access_token, sectionid, or scoutid' });
    }
    try {
        const response = await makeOSMRequest(`https://www.onlinescoutmanager.co.uk/ext/members/contact/?action=getIndividual&sectionid=${sectionid}&scoutid=${scoutid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const text = await response.text();
        console.log('ContactDetails API response:', text.substring(0, 200));
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return res.status(502).json({ error: 'Upstream returned non-JSON', details: text.substring(0, 500) });
        }
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-contact-details:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};

// Proxy getListOfMembers to avoid CORS
const getListOfMembers = async (req, res) => {
    const { sectionid } = req.query;
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    if (!access_token || !sectionid) {
        return res.status(400).json({ error: 'Missing access_token or sectionid' });
    }
    try {
        const response = await makeOSMRequest(`https://www.onlinescoutmanager.co.uk/ext/members/contact/?action=getListOfMembers&sectionid=${sectionid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const text = await response.text();
        console.log('ListOfMembers API response:', text.substring(0, 200));
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return res.status(502).json({ error: 'Upstream returned non-JSON', details: text.substring(0, 500) });
        }
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-list-of-members:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};

// Proxy getFlexiRecords to avoid CORS
const getFlexiRecords = async (req, res) => {
    const { sectionid, archived } = req.query;
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    if (!access_token || !sectionid) {
        return res.status(400).json({ error: 'Missing access_token or sectionid' });
    }
    
    // Build URL with optional archived parameter
    let url = `https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=getFlexiRecords&sectionid=${sectionid}`;
    if (archived) {
        url += `&archived=${archived}`;
    }
    
    try {
        const response = await makeOSMRequest(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const text = await response.text();
        console.log('FlexiRecords API response:', text.substring(0, 200));
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return res.status(502).json({ error: 'Upstream returned non-JSON', details: text.substring(0, 500) });
        }
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-flexi-records:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};

// Proxy getFlexiStructure to avoid CORS
const getFlexiStructure = async (req, res) => {
    const { sectionid, flexirecordid, termid } = req.query;
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    if (!access_token || !sectionid || !flexirecordid || !termid) {
        return res.status(400).json({ error: 'Missing access_token, sectionid, flexirecordid, or termid' });
    }
    try {
        const response = await makeOSMRequest(`https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=getStructure&sectionid=${sectionid}&extraid=${flexirecordid}&termid=${termid}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const text = await response.text();
        console.log('FlexiStructure API response:', text.substring(0, 200));
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return res.status(502).json({ error: 'Upstream returned non-JSON', details: text.substring(0, 500) });
        }
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-flexi-structure:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};

// Proxy getSingleFlexiRecord to avoid CORS
const getSingleFlexiRecord = async (req, res) => {
    const { flexirecordid, sectionid, termid } = req.query;
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    if (!access_token || !sectionid || !flexirecordid || !termid) {
        return res.status(400).json({ error: 'Missing access_token, sectionid, flexirecordid, or termid' });
    }
    try {
        const response = await makeOSMRequest(`https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=getData&extraid=${flexirecordid}&sectionid=${sectionid}&termid=${termid}&nototal`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const text = await response.text();
        console.log('SingleFlexiRecord API response:', text.substring(0, 200));
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return res.status(502).json({ error: 'Upstream returned non-JSON', details: text.substring(0, 500) });
        }
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-single-flexi-record:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};

// Get user startup data including name and roles
const getStartupData = async (req, res) => {
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    
    if (!access_token) {
        return res.status(401).json({ error: 'Access token is required in Authorization header' });
    }
    
    try {
        const response = await makeOSMRequest('https://www.onlinescoutmanager.co.uk/ext/generic/startup/?action=getData', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const text = await response.text();
        console.log('Startup API response (first 50 chars):', text.substring(0, 50));
        
        // OSM startup endpoint returns JavaScript code, not JSON
        // Remove first 18 characters to get the JSON data
        const jsonText = text.substring(18);
        console.log('After removing first 18 chars:', jsonText.substring(0, 50));
        
        let data;
        try {
            data = JSON.parse(jsonText);
        } catch (e) {
            console.error('JSON parse error after substring:', e);
            console.error('Text being parsed:', jsonText.substring(0, 200));
            return res.status(502).json({ error: 'Upstream returned invalid JSON', details: jsonText.substring(0, 500) });
        }
        
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /get-startup-data:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};

// Proxy updateFlexiRecord to avoid CORS
const updateFlexiRecord = async (req, res) => {
    const { sectionid, scoutid, flexirecordid, columnid, value } = req.body;
    const access_token = req.headers.authorization?.replace('Bearer ', '');
    const sessionId = getSessionId(req);
    if (!access_token || !sectionid || !scoutid || !flexirecordid || !columnid || value === undefined) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    try {
        const response = await makeOSMRequest('https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=updateRecord', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                sectionid: sectionid,
                scoutid: scoutid,
                extraid: flexirecordid,
                columnid: columnid,
                value: value
            })
        }, sessionId);
        
        if (response.status === 429) {
            const osmInfo = getOSMRateLimitInfo(sessionId);
            return res.status(429).json({ 
                error: 'OSM API rate limit exceeded',
                rateLimitInfo: osmInfo,
                message: 'Please wait before making more requests'
            });
        }
        
        const data = await response.json();
        const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
        res.json(responseWithRateInfo);
    } catch (err) {
        console.error('Error in /update-flexi-record:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};

module.exports = {
    getRateLimitStatus,
    getTerms,
    getSectionConfig,
    getUserRoles,
    getEvents,
    getEventAttendance,
    getContactDetails,
    getListOfMembers,
    getFlexiRecords,
    getFlexiStructure,
    getSingleFlexiRecord,
    updateFlexiRecord,
    getStartupData
};