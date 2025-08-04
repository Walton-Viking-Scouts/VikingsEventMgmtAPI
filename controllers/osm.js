// Import rate limiting utilities
const { 
  getSessionId, 
  getOSMRateLimitInfo,
  MAX_REQUESTS_PER_WINDOW,
  BACKEND_RATE_LIMIT_WINDOW,
} = require('../middleware/rateLimiting');

// Import our new utility functions
const { osmEndpoints } = require('../utils/osmEndpointFactories');
const { createOSMApiHandler } = require('../utils/osmApiHandler');
const { validateFieldIdFormat, validateArrayParam } = require('../utils/validators');

// Import existing complex functions that need custom handling
const { transformMemberGridData } = require('./osm-legacy');

// Rate limit status endpoint (kept as-is since it's unique)
const getRateLimitStatus = (req, res) => {
  const sessionId = getSessionId(req);
    
  // Get backend rate limit info
  const now = Date.now();
  const backendInfo = {
    limit: MAX_REQUESTS_PER_WINDOW,
    remaining: MAX_REQUESTS_PER_WINDOW,
    resetTime: now + BACKEND_RATE_LIMIT_WINDOW,
    window: 'per minute',
  };
    
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

// Simple endpoints using our factories (reduces ~400 lines to ~10 lines)
const getTerms = osmEndpoints.getTerms();
const getSectionConfig = osmEndpoints.getSectionConfig();
const getUserRoles = osmEndpoints.getUserRoles();
const getEvents = osmEndpoints.getEvents();
const getEventAttendance = osmEndpoints.getEventAttendance();
const getEventSummary = osmEndpoints.getEventSummary();
const getContactDetails = osmEndpoints.getContactDetails();
const getListOfMembers = osmEndpoints.getListOfMembers();
const getFlexiRecords = osmEndpoints.getFlexiRecords();
const getFlexiStructure = osmEndpoints.getFlexiStructure();
const getSingleFlexiRecord = osmEndpoints.getSingleFlexiRecord();
const getStartupData = osmEndpoints.getStartupData();

// Complex endpoints that need custom logic
const getMembersGrid = createOSMApiHandler('getMembersGrid', {
  method: 'POST',
  requiredParams: ['section_id', 'term_id'],
  buildUrl: (_req) => 'https://www.onlinescoutmanager.co.uk/ext/members/contact/grid/?action=getMembers',
  buildRequestOptions: (req, access_token) => {
    const requestBody = new URLSearchParams({
      section_id: req.body.section_id,
      term_id: req.body.term_id,
    });
    
    return {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody,
    };
  },
  processResponse: (data, _req) => {
    // Apply the existing transformation logic
    return transformMemberGridData(data);
  },
});

const updateFlexiRecord = createOSMApiHandler('updateFlexiRecord', {
  method: 'POST',
  requiredParams: ['sectionid', 'scoutid', 'flexirecordid', 'columnid', 'value', 'termid', 'section'],
  buildUrl: (_req) => 'https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=updateScout&nototal=null',
  buildRequestOptions: (req, access_token) => {
    const { sectionid, scoutid, flexirecordid, columnid, value, termid, section } = req.body;
    
    // Custom validation for field ID format
    const fieldValidation = validateFieldIdFormat(columnid);
    if (!fieldValidation.valid) {
      throw new Error(fieldValidation.error);
    }
    
    const requestBody = new URLSearchParams({
      termid,
      sectionid,
      section,
      extraid: flexirecordid,
      scoutid,
      column: columnid,
      value,
    });
    
    return {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody,
    };
  },
});

const multiUpdateFlexiRecord = createOSMApiHandler('multiUpdateFlexiRecord', {
  method: 'POST',
  requiredParams: ['sectionid', 'scouts', 'value', 'column', 'flexirecordid'],
  buildUrl: (req) => `https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=multiUpdate&sectionid=${req.body.sectionid}`,
  buildRequestOptions: (req, access_token) => {
    const { scouts, value, column, flexirecordid } = req.body;
    
    // Custom validation for scouts array
    const scoutsValidation = validateArrayParam(scouts, 'scouts');
    if (!scoutsValidation.valid) {
      throw new Error(scoutsValidation.error);
    }
    
    // Custom validation for field ID format
    const fieldValidation = validateFieldIdFormat(column);
    if (!fieldValidation.valid) {
      throw new Error(fieldValidation.error);
    }
    
    const requestBody = new URLSearchParams({
      scouts: JSON.stringify(scouts),
      value,
      col: column, // OSM uses 'col' not 'column'
      extraid: flexirecordid,
    });
    
    return {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody,
    };
  },
});

module.exports = {
  getRateLimitStatus,
  getTerms,
  getSectionConfig,
  getUserRoles,
  getEvents,
  getEventAttendance,
  getEventSummary,
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