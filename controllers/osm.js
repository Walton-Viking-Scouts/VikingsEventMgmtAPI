// Import rate limiting utilities
const { 
  makeOSMRequest, 
  getSessionId, 
  getOSMRateLimitInfo, 
  addRateLimitInfoToResponse,
  MAX_REQUESTS_PER_WINDOW,
  BACKEND_RATE_LIMIT_WINDOW,
} = require('../middleware/rateLimiting');

// Import Sentry for structured logging
const { logger } = require('../config/sentry');
const fallbackLogger = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.log,
  fmt: (strings, ...values) => strings.reduce((result, string, i) => result + string + (values[i] || ''), ''),
};
const log = logger || fallbackLogger;

// Rate limit status endpoint for frontend monitoring (needs access to rateLimitTracker)
const getRateLimitStatus = (req, res) => {
  const sessionId = getSessionId(req);
    
  // Get backend rate limit info (this needs to be imported from rateLimiting.js)
  const now = Date.now();
  const backendInfo = {
    limit: MAX_REQUESTS_PER_WINDOW,
    remaining: MAX_REQUESTS_PER_WINDOW,
    resetTime: now + BACKEND_RATE_LIMIT_WINDOW,
    window: 'per minute',
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
    available: true,
  };
    
  if (osmInfo) {
    osmRateLimit = {
      limit: osmInfo.limit,
      remaining: osmInfo.remaining,
      resetTime: osmInfo.reset ? osmInfo.reset * 1000 : null,
      window: 'per hour',
      available: !osmInfo.rateLimited,
      retryAfter: osmInfo.retryAfter,
    };
  }
    
  res.json({
    backend: backendInfo,
    osm: osmRateLimit,
    timestamp: now,
  });
};

// Proxy getTerms to avoid CORS
// Update getTerms function to use Authorization header
const getTerms = async (req, res) => {
  const access_token = req.headers.authorization?.replace('Bearer ', '');
  const sessionId = getSessionId(req);
  const endpoint = 'getTerms';
  const osmUrl = 'https://www.onlinescoutmanager.co.uk/api.php?action=getTerms';
  const requestId = `${sessionId}-${Date.now()}`;
    
  // Pre-call logging
  log.info(log.fmt`OSM API Request: ${endpoint}`, {
    endpoint,
    requestId,
    sessionId,
    hasToken: !!access_token,
    clientIp: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString(),
    section: 'osm-api',
  });
    
  if (!access_token) {
    log.warn(log.fmt`OSM API Request Failed: ${endpoint} - Missing token`, {
      endpoint,
      requestId,
      sessionId,
      error: 'No authorization token provided',
      section: 'osm-api',
    });
    return res.status(401).json({ error: 'Access token is required in Authorization header' });
  }

  try {
    const response = await makeOSMRequest(osmUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    }, sessionId);
        
    if (response.status === 429) {
      const osmInfo = getOSMRateLimitInfo(sessionId);
      log.warn(log.fmt`OSM API Rate Limited: ${endpoint}`, {
        endpoint,
        requestId,
        sessionId,
        status: response.status,
        rateLimitInfo: osmInfo,
        section: 'osm-api',
      });
      return res.status(429).json({ 
        error: 'OSM API rate limit exceeded',
        rateLimitInfo: osmInfo,
        message: 'Please wait before making more requests',
      });
    }
        
    if (!response.ok) {
      log.error(log.fmt`OSM API Error: ${endpoint}`, {
        endpoint,
        requestId,
        sessionId,
        status: response.status,
        statusText: response.statusText,
        error: `OSM API error: ${response.status}`,
        section: 'osm-api',
      });
      return res.status(response.status).json({ error: `OSM API error: ${response.status}` });
    }
        
    const responseText = await response.text();
        
    if (!responseText.trim()) {
      log.error(log.fmt`OSM API Empty Response: ${endpoint}`, {
        endpoint,
        requestId,
        sessionId,
        error: 'Empty response from OSM API',
        section: 'osm-api',
      });
      return res.status(500).json({ error: 'Empty response from OSM API' });
    }
        
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      log.error(log.fmt`OSM API Parse Error: ${endpoint}`, {
        endpoint,
        requestId,
        sessionId,
        error: 'JSON parse error',
        parseError: parseError.message,
        responseLength: responseText.length,
        section: 'osm-api',
      });
      return res.status(500).json({ error: 'Invalid JSON response from OSM API' });
    }
        
    // Success logging
    log.info(log.fmt`OSM API Success: ${endpoint}`, {
      endpoint,
      requestId,
      sessionId,
      status: response.status,
      responseSize: responseText.length,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      rateLimitInfo: getOSMRateLimitInfo(sessionId),
      section: 'osm-api',
    });
        
    const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
    res.json(responseWithRateInfo);
  } catch (err) {
    log.error(log.fmt`OSM API Exception: ${endpoint}`, {
      endpoint,
      requestId,
      sessionId,
      error: err.message,
      stack: err.stack,
      section: 'osm-api',
    });
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
        'Authorization': `Bearer ${access_token}`,
      },
    }, sessionId);
        
    if (response.status === 429) {
      const osmInfo = getOSMRateLimitInfo(sessionId);
      return res.status(429).json({ 
        error: 'OSM API rate limit exceeded',
        rateLimitInfo: osmInfo,
        message: 'Please wait before making more requests',
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
        'Content-Type': 'application/json',
      },
    }, sessionId);
        
    if (response.status === 429) {
      const osmInfo = getOSMRateLimitInfo(sessionId);
      return res.status(429).json({ 
        error: 'OSM API rate limit exceeded',
        rateLimitInfo: osmInfo,
        message: 'Please wait before making more requests',
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
        'Content-Type': 'application/json',
      },
    }, sessionId);
        
    if (response.status === 429) {
      const osmInfo = getOSMRateLimitInfo(sessionId);
      return res.status(429).json({ 
        error: 'OSM API rate limit exceeded',
        rateLimitInfo: osmInfo,
        message: 'Please wait before making more requests',
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
        'Authorization': `Bearer ${access_token}`,
      },
    }, sessionId);
        
    if (response.status === 429) {
      const osmInfo = getOSMRateLimitInfo(sessionId);
      return res.status(429).json({ 
        error: 'OSM API rate limit exceeded',
        rateLimitInfo: osmInfo,
        message: 'Please wait before making more requests',
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
        'Authorization': `Bearer ${access_token}`,
      },
    }, sessionId);
        
    if (response.status === 429) {
      const osmInfo = getOSMRateLimitInfo(sessionId);
      return res.status(429).json({ 
        error: 'OSM API rate limit exceeded',
        rateLimitInfo: osmInfo,
        message: 'Please wait before making more requests',
      });
    }
        
    const text = await response.text();
    console.log('ContactDetails API response:', text.substring(0, 200));
    let data;
    try {
      data = JSON.parse(text);
    } catch (_e) {
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
        'Authorization': `Bearer ${access_token}`,
      },
    }, sessionId);
        
    if (response.status === 429) {
      const osmInfo = getOSMRateLimitInfo(sessionId);
      return res.status(429).json({ 
        error: 'OSM API rate limit exceeded',
        rateLimitInfo: osmInfo,
        message: 'Please wait before making more requests',
      });
    }
        
    const text = await response.text();
    console.log('ListOfMembers API response:', text.substring(0, 200));
    let data;
    try {
      data = JSON.parse(text);
    } catch (_e) {
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
        'Authorization': `Bearer ${access_token}`,
      },
    }, sessionId);
        
    if (response.status === 429) {
      const osmInfo = getOSMRateLimitInfo(sessionId);
      return res.status(429).json({ 
        error: 'OSM API rate limit exceeded',
        rateLimitInfo: osmInfo,
        message: 'Please wait before making more requests',
      });
    }
        
    const text = await response.text();
    console.log('FlexiRecords API response:', text.substring(0, 200));
    let data;
    try {
      data = JSON.parse(text);
    } catch (_e) {
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
        'Authorization': `Bearer ${access_token}`,
      },
    }, sessionId);
        
    if (response.status === 429) {
      const osmInfo = getOSMRateLimitInfo(sessionId);
      return res.status(429).json({ 
        error: 'OSM API rate limit exceeded',
                
        rateLimitInfo: osmInfo,
        message: 'Please wait before making more requests',
      });
    }
        
    const text = await response.text();
    console.log('FlexiStructure API response:', text.substring(0, 200));
    let data;
    try {
      data = JSON.parse(text);
    } catch (_e) {
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
        'Authorization': `Bearer ${access_token}`,
      },
    }, sessionId);
        
    if (response.status === 429) {
      const osmInfo = getOSMRateLimitInfo(sessionId);
      return res.status(429).json({ 
        error: 'OSM API rate limit exceeded',
        rateLimitInfo: osmInfo,
        message: 'Please wait before making more requests',
      });
    }
        
    const text = await response.text();
    console.log('SingleFlexiRecord API response:', text.substring(0, 200));
    let data;
    try {
      data = JSON.parse(text);
    } catch (_e) {
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
        'Authorization': `Bearer ${access_token}`,
      },
    }, sessionId);
        
    if (response.status === 429) {
      const osmInfo = getOSMRateLimitInfo(sessionId);
      return res.status(429).json({ 
        error: 'OSM API rate limit exceeded',
        rateLimitInfo: osmInfo,
        message: 'Please wait before making more requests',
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
    } catch (_e) {
      console.error('JSON parse error after substring:', _e);
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

// Proxy getMembersGrid to avoid CORS and transform data structure
const getMembersGrid = async (req, res) => {
  const { section_id, term_id } = req.body;
  const access_token = req.headers.authorization?.replace('Bearer ', '');
  const sessionId = getSessionId(req);
  const endpoint = 'getMembersGrid';
  const requestId = `${sessionId}-${Date.now()}`;
  
  // Enhanced validation
  if (!access_token || !section_id || !term_id) {
    log.error(log.fmt`${endpoint}: Missing required parameters`, {
      hasToken: !!access_token,
      section_id, 
      term_id,
      endpoint,
      requestId,
      sessionId,
    });
    return res.status(400).json({ 
      error: 'Missing required parameters: section_id and term_id are required, plus Authorization header', 
    });
  }
  
  log.info(log.fmt`${endpoint}: Processing request`, {
    section_id, 
    term_id,
    sessionId: sessionId.substring(0, 8) + '...',
    endpoint,
    requestId,
  });
  
  try {
    const requestBody = new URLSearchParams({
      section_id: section_id,
      term_id: term_id,
    });
    
    log.debug(log.fmt`${endpoint}: Sending request to OSM`, {
      url: 'https://www.onlinescoutmanager.co.uk/ext/members/contact/grid/?action=getMembers',
      bodyString: requestBody.toString(),
      sessionId: sessionId.substring(0, 8) + '...',
      endpoint,
      requestId,
    });
    
    const response = await makeOSMRequest('https://www.onlinescoutmanager.co.uk/ext/members/contact/grid/?action=getMembers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody,
    }, sessionId);
    
    log.debug(log.fmt`${endpoint}: OSM response status: ${response.status}`, {
      status: response.status,
      endpoint,
      requestId,
      sessionId: sessionId.substring(0, 8) + '...',
    });
    
    if (response.status === 429) {
      const osmInfo = getOSMRateLimitInfo(sessionId);
      log.warn(log.fmt`${endpoint}: Rate limit exceeded`, { 
        ...osmInfo,
        endpoint,
        requestId,
        sessionId: sessionId.substring(0, 8) + '...',
      });
      return res.status(429).json({ 
        error: 'OSM API rate limit exceeded',
        rateLimitInfo: osmInfo,
        message: 'Please wait before making more requests',
      });
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      log.error(log.fmt`${endpoint}: OSM API error`, {
        status: response.status,
        statusText: response.statusText,
        errorText,
        endpoint,
        requestId,
        sessionId: sessionId.substring(0, 8) + '...',
      });
      return res.status(response.status).json({ 
        error: `OSM API error: ${response.status}`,
        details: errorText,
      });
    }
    
    const rawData = await response.json();
    
    // Transform the data structure
    const transformedData = transformMemberGridData(rawData);
    
    log.info(log.fmt`${endpoint}: Success`, { 
      memberCount: transformedData.data?.members?.length || 0,
      contactGroupCount: transformedData.data?.metadata?.contact_groups?.length || 0,
      endpoint,
      requestId,
      sessionId: sessionId.substring(0, 8) + '...',
    });
    
    const responseWithRateInfo = addRateLimitInfoToResponse(req, res, transformedData);
    res.json(responseWithRateInfo);
  } catch (err) {
    log.error(log.fmt`${endpoint}: Internal server error`, {
      error: err.message,
      stack: err.stack,
      endpoint,
      requestId,
      sessionId: sessionId.substring(0, 8) + '...',
      section_id,
      term_id,
    });
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

// Helper function to transform member grid data structure
const transformMemberGridData = (rawData) => {
  if (!rawData || !rawData.data || !rawData.meta) {
    return {
      status: false,
      error: 'Invalid data structure from OSM API',
      data: { members: [], metadata: { contact_groups: [] } },
    };
  }
  
  // Build column mapping from metadata
  const columnMapping = {};
  const contactGroups = [];
  
  if (rawData.meta.structure && Array.isArray(rawData.meta.structure)) {
    rawData.meta.structure.forEach(group => {
      if (group.columns && Array.isArray(group.columns)) {
        const groupInfo = {
          group_id: group.group_id,
          name: group.name,
          identifier: group.identifier,
          columns: [],
        };
        
        group.columns.forEach(column => {
          const groupColumnId = `${group.group_id}_${column.column_id}`;
          columnMapping[groupColumnId] = {
            label: column.label,
            type: column.type,
            varname: column.varname,
            group_name: group.name,
          };
          
          groupInfo.columns.push({
            column_id: column.column_id,
            label: column.label,
            type: column.type,
            varname: column.varname,
          });
        });
        
        contactGroups.push(groupInfo);
      }
    });
  }
  
  // Transform member data
  const transformedMembers = [];
  
  Object.entries(rawData.data).forEach(([memberId, memberData]) => {
    const transformedMember = {
      member_id: memberId,
      first_name: memberData.first_name || '',
      last_name: memberData.last_name || '',
      age: memberData.age || '',
      patrol: memberData.patrol || '',
      patrol_id: memberData.patrol_id,
      active: memberData.active,
      joined: memberData.joined,
      started: memberData.started,
      end_date: memberData.end_date,
      date_of_birth: memberData.date_of_birth,
      section_id: memberData.section_id,
      contact_groups: {},
    };
    
    // Transform custom_data using column mapping
    if (memberData.custom_data) {
      Object.entries(memberData.custom_data).forEach(([groupId, groupData]) => {
        const groupInfo = contactGroups.find(g => g.group_id.toString() === groupId);
        const groupName = groupInfo ? groupInfo.name : `Group ${groupId}`;
        
        if (!transformedMember.contact_groups[groupName]) {
          transformedMember.contact_groups[groupName] = {};
        }
        
        Object.entries(groupData).forEach(([columnId, value]) => {
          const groupColumnId = `${groupId}_${columnId}`;
          const columnInfo = columnMapping[groupColumnId];
          
          if (columnInfo) {
            transformedMember.contact_groups[groupName][columnInfo.label] = value;
          } else {
            // Fallback for unmapped columns
            transformedMember.contact_groups[groupName][`Column ${columnId}`] = value;
          }
        });
      });
    }
    
    transformedMembers.push(transformedMember);
  });
  
  return {
    status: true,
    data: {
      members: transformedMembers,
      metadata: {
        contact_groups: contactGroups,
        column_mapping: columnMapping,
      },
    },
  };
};

// Proxy updateFlexiRecord to avoid CORS
const updateFlexiRecord = async (req, res) => {
  const { sectionid, scoutid, flexirecordid, columnid, value } = req.body;
  const access_token = req.headers.authorization?.replace('Bearer ', '');
  const sessionId = getSessionId(req);
    
  // Enhanced validation
  if (!access_token || !sectionid || !scoutid || !flexirecordid || !columnid || value === undefined) {
    logger.error('updateFlexiRecord: Missing required parameters', {
      hasToken: !!access_token,
      sectionid, scoutid, flexirecordid, columnid, value,
      endpoint: '/update-flexi-record',
    });
    return res.status(400).json({ error: 'Missing required parameters' });
  }
    
  // Validate field ID format (should be f_1, f_2, etc.)
  if (!columnid.match(/^f_\d+$/)) {
    logger.error('updateFlexiRecord: Invalid columnid format', { 
      columnid,
      endpoint: '/update-flexi-record',
    });
    return res.status(400).json({ error: 'Invalid field ID format. Expected format: f_1, f_2, etc.' });
  }
    
  logger.info('updateFlexiRecord: Processing request', {
    sectionid, 
    scoutid, 
    flexirecordid, 
    columnid, 
    valueLength: value.length,
    sessionId: sessionId.substring(0, 8) + '...',
    endpoint: '/update-flexi-record',
  });
    
  try {
    const requestBody = new URLSearchParams({
      sectionid: sectionid,
      scoutid: scoutid,
      extraid: flexirecordid,
      columnid: columnid,
      value: value,
    });
        
    logger.debug('updateFlexiRecord: Sending request to OSM', {
      url: 'https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=updateRecord',
      bodyString: requestBody.toString(),
      sessionId: sessionId.substring(0, 8) + '...',
      endpoint: '/update-flexi-record',
    });
        
    const response = await makeOSMRequest('https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=updateRecord', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody,
    }, sessionId);
        
    logger.debug(logger.fmt`updateFlexiRecord: OSM response status: ${response.status}`, {
      status: response.status,
      endpoint: '/update-flexi-record',
      sessionId: sessionId.substring(0, 8) + '...',
    });
        
    if (response.status === 429) {
      const osmInfo = getOSMRateLimitInfo(sessionId);
      logger.warn('updateFlexiRecord: Rate limit exceeded', { 
        ...osmInfo,
        endpoint: '/update-flexi-record',
        sessionId: sessionId.substring(0, 8) + '...',
      });
      return res.status(429).json({ 
        error: 'OSM API rate limit exceeded',
        rateLimitInfo: osmInfo,
        message: 'Please wait before making more requests',
      });
    }
        
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('updateFlexiRecord: OSM API error', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        endpoint: '/update-flexi-record',
        sessionId: sessionId.substring(0, 8) + '...',
      });
      return res.status(response.status).json({ 
        error: `OSM API error: ${response.status}`,
        details: errorText,
      });
    }
        
    const data = await response.json();
    logger.info('updateFlexiRecord: Success', { 
      success: data.ok || data.status,
      endpoint: '/update-flexi-record',
      sessionId: sessionId.substring(0, 8) + '...',
    });
        
    const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
    res.json(responseWithRateInfo);
  } catch (err) {
    logger.error('updateFlexiRecord: Internal server error', {
      error: err.message,
      stack: err.stack,
      endpoint: '/update-flexi-record',
      sessionId: sessionId.substring(0, 8) + '...',
      sectionid,
      scoutid,
      flexirecordid,
      columnid,
    });
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

// Multi-update flexirecord endpoint (batch update multiple scouts)
const multiUpdateFlexiRecord = async (req, res) => {
  const { sectionid, scouts, value, column, flexirecordid } = req.body;
  const access_token = req.headers.authorization?.replace('Bearer ', '');
  const sessionId = getSessionId(req);
  const endpoint = 'multiUpdateFlexiRecord';
  const requestId = `${sessionId}-${Date.now()}`;
    
  // Enhanced validation
  if (!access_token || !sectionid || !scouts || !Array.isArray(scouts) || value === undefined || !column || !flexirecordid) {
    log.error(log.fmt`${endpoint}: Missing required parameters`, {
      hasToken: !!access_token,
      sectionid, 
      scouts: Array.isArray(scouts) ? scouts.length : scouts,
      value, 
      column, 
      flexirecordid,
      endpoint,
      requestId,
      sessionId,
    });
    return res.status(400).json({ 
      error: 'Missing required parameters: sectionid, scouts (array), value, column, flexirecordid are required, plus Authorization header', 
    });
  }
    
  // Validate scouts array
  if (scouts.length === 0) {
    log.error(log.fmt`${endpoint}: Empty scouts array`, { endpoint, requestId, sessionId });
    return res.status(400).json({ error: 'scouts array cannot be empty' });
  }
    
  // Validate field ID format (should be f_1, f_2, etc.)
  if (!column.match(/^f_\d+$/)) {
    log.error(log.fmt`${endpoint}: Invalid column format`, { 
      column,
      endpoint,
      requestId,
      sessionId,
    });
    return res.status(400).json({ error: 'Invalid field ID format. Expected format: f_1, f_2, etc.' });
  }
    
  log.info(log.fmt`${endpoint}: Processing batch update`, {
    sectionid, 
    scoutCount: scouts.length,
    scouts: scouts.slice(0, 5), // Log first 5 scout IDs for debugging
    value: String(value).substring(0, 50), // Truncate long values
    column, 
    flexirecordid,
    sessionId: sessionId.substring(0, 8) + '...',
    endpoint,
    requestId,
  });
    
  try {
    // Build form data for OSM API
    const requestBody = new URLSearchParams({
      scouts: JSON.stringify(scouts), // OSM expects JSON string array
      value: value,
      col: column, // OSM uses 'col' not 'column'
      extraid: flexirecordid,
    });
        
    log.debug(log.fmt`${endpoint}: Sending request to OSM`, {
      url: `https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=multiUpdate&sectionid=${sectionid}`,
      bodyString: requestBody.toString(),
      sessionId: sessionId.substring(0, 8) + '...',
      endpoint,
      requestId,
    });
        
    const response = await makeOSMRequest(`https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=multiUpdate&sectionid=${sectionid}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody,
    }, sessionId);
        
    log.debug(log.fmt`${endpoint}: OSM response status: ${response.status}`, {
      status: response.status,
      endpoint,
      requestId,
      sessionId: sessionId.substring(0, 8) + '...',
    });
        
    if (response.status === 429) {
      const osmInfo = getOSMRateLimitInfo(sessionId);
      log.warn(log.fmt`${endpoint}: Rate limit exceeded`, { 
        ...osmInfo,
        endpoint,
        requestId,
        sessionId: sessionId.substring(0, 8) + '...',
      });
      return res.status(429).json({ 
        error: 'OSM API rate limit exceeded',
        rateLimitInfo: osmInfo,
        message: 'Please wait before making more requests',
      });
    }
        
    if (!response.ok) {
      const errorText = await response.text();
      log.error(log.fmt`${endpoint}: OSM API error`, {
        status: response.status,
        statusText: response.statusText,
        errorText,
        endpoint,
        requestId,
        sessionId: sessionId.substring(0, 8) + '...',
      });
      return res.status(response.status).json({ 
        error: `OSM API error: ${response.status}`,
        details: errorText,
      });
    }
        
    const data = await response.json();
    log.info(log.fmt`${endpoint}: Success`, { 
      success: data.ok || data.status,
      updatedCount: scouts.length,
      endpoint,
      requestId,
      sessionId: sessionId.substring(0, 8) + '...',
    });
        
    const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
    res.json(responseWithRateInfo);
  } catch (err) {
    log.error(log.fmt`${endpoint}: Internal server error`, {
      error: err.message,
      stack: err.stack,
      endpoint,
      requestId,
      sessionId: sessionId.substring(0, 8) + '...',
      sectionid,
      scoutCount: scouts?.length,
      column,
      flexirecordid,
    });
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
  multiUpdateFlexiRecord,
  getStartupData,
  getMembersGrid,
};
