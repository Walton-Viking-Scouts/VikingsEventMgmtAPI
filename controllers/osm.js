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
const { validateFieldIdFormat, validateArrayParam, validateFlexiRecordUpdateParams } = require('../utils/validators');
const { logger } = require('../config/sentry');
const fallbackLogger = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.log,
  fmt: (strings, ...values) => strings.reduce((result, string, i) => result + string + (values[i] || ''), ''),
};
const log = logger || fallbackLogger;

// Import existing complex functions that need custom handling
const { transformMemberGridData } = require('./osm-legacy');

/**
 * Monitoring: Get current backend and OSM API rate-limit status for this session.
 *
 * @tags Monitoring
 * @route GET /rate-limit-status
 * @returns {object} 200 - Rate limit info
 * @example Success response
 * {
 *   "backend": { "limit": 100, "remaining": 100, "resetTime": 1736443200000, "window": "per minute" },
 *   "osm": { "limit": 1000, "remaining": 742, "resetTime": 1736446800000, "window": "per hour", "available": true },
 *   "timestamp": 1736443185000
 * }
 */
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

/**
 * OSM: Get terms (sections' term list).
 *
 * Proxies the OSM API `action=getTerms`.
 *
 * @tags OSM
 * @route GET /get-terms
 * @header Authorization {string} - Bearer OSM access token
 * @returns {object} 200 - Terms array and OSM rate-limit headers
 * @returns {object} 401 - When missing/invalid token
 * @example Success response
 * {
 *   "terms": [
 *     { "termid": 12345, "name": "Autumn 2024", "start": "2024-09-01", "end": "2024-12-15" },
 *     { "termid": 12346, "name": "Spring 2025", "start": "2025-01-10", "end": "2025-04-01" }
 *   ],
 *   "rateLimit": { "limit": 1000, "remaining": 998, "reset": 1736446800 }
 * }
 * @example Error response (unauthorized)
 * { "error": "Access token is required in Authorization header" }
 */
const getTerms = osmEndpoints.getTerms();

/**
 * OSM: Get section configuration.
 *
 * @tags OSM
 * @route GET /get-section-config
 * @header Authorization {string}
 * @param {string|number} query.sectionid - OSM section id
 * @returns {object} 200 - Configuration for the given section
 * @example Success response
 * { "sectionid": 321, "name": "Vikings Scouts", "meeting_night": "Mon", "age_range": "10-14" }
 * @example Error response (missing param)
 * { "error": "Missing required parameters: sectionid" }
 */
const getSectionConfig = osmEndpoints.getSectionConfig();

/**
 * OSM: Get user roles for the authenticated account.
 *
 * @tags OSM
 * @route GET /get-user-roles
 * @header Authorization {string}
 * @returns {object} 200 - Roles info
 * @example Success response
 * { "roles": [ { "sectionid": 321, "role": "Leader" } ] }
 * @example Error response (unauthorized)
 * { "error": "Access token is required in Authorization header" }
 */
const getUserRoles = osmEndpoints.getUserRoles();

/**
 * OSM: Get events for a section and term.
 *
 * Dates are normalized: we include original UK format and ISO fields, and convert main field to mm/dd/yyyy for JS.
 *
 * @tags OSM
 * @route GET /get-events
 * @header Authorization {string}
 * @param {string|number} query.sectionid - Section id
 * @param {string|number} query.termid - Term id
 * @returns {object} 200 - Events list with normalized dates
 * @example Success response
 * { "items": [ { "eventid": 9901, "name": "Night Hike", "date": "10/15/2024", "date_original": "15/10/2024", "date_iso": "2024-10-15" } ] }
 * @example Error response (missing params)
 * { "error": "Missing required parameters: sectionid, termid" }
 */
const getEvents = osmEndpoints.getEvents();

/**
 * OSM: Get attendance list for an event.
 *
 * @tags OSM
 * @route GET /get-event-attendance
 * @header Authorization {string}
 * @param {string|number} query.sectionid - Section id
 * @param {string|number} query.termid - Term id
 * @param {string|number} query.eventid - Event id
 * @returns {object} 200 - Attendance details
 * @example Success response
 * { "eventid": 9901, "attendees": [ { "scoutid": 555, "name": "Alex Johnson", "status": "Yes" }, { "scoutid": 556, "name": "Riley Park", "status": "No" } ] }
 * @example Error response (missing params)
 * { "error": "Missing required parameters: sectionid, termid, eventid" }
 */
const getEventAttendance = osmEndpoints.getEventAttendance();

/**
 * OSM: Get detailed event summary.
 *
 * @tags OSM
 * @route GET /get-event-summary
 * @header Authorization {string}
 * @param {string|number} query.eventid - Event id
 * @returns {object} 200 - Event summary structure
 * @example Success response
 * { "event": { "id": 9901, "name": "Night Hike", "location": "Hillside Trail" }, "stats": { "yes": 18, "no": 3, "maybe": 2 } }
 * @example Error response (missing params)
 * { "error": "Missing required parameters: eventid" }
 */
const getEventSummary = osmEndpoints.getEventSummary();

/**
 * OSM: Get an individual member's contact details.
 *
 * @tags OSM
 * @route GET /get-contact-details
 * @header Authorization {string}
 * @param {string|number} query.sectionid - Section id
 * @param {string|number} query.scoutid - Member id
 * @returns {object} 200 - Contact details
 * @example Success response
 * { "scoutid": 555, "name": "Alex Johnson", "primary_contact": { "name": "Sam Johnson", "relation": "Parent", "phone": "+44 7700 900123" } }
 * @example Error response (missing params)
 * { "error": "Missing required parameters: sectionid, scoutid" }
 */
const getContactDetails = osmEndpoints.getContactDetails();

/**
 * OSM: Get list of members for a section and term.
 *
 * @tags OSM
 * @route GET /get-list-of-members
 * @header Authorization {string}
 * @param {string|number} query.sectionid - Section id
 * @param {string|number} query.termid - Term id
 * @param {string} query.section - Section type (e.g., "scouts")
 * @returns {object} 200 - Members list
 * @example Success response
 * { "items": [ { "scoutid": 555, "name": "Alex Johnson" }, { "scoutid": 556, "name": "Riley Park" } ] }
 * @example Error response (missing params)
 * { "error": "Missing required parameters: sectionid, termid, section" }
 */
const getListOfMembers = osmEndpoints.getListOfMembers();

/**
 * OSM: Get FlexiRecord entries for a section.
 *
 * @tags OSM
 * @route GET /get-flexi-records
 * @header Authorization {string}
 * @param {string|number} query.sectionid - Section id
 * @param {boolean} [query.archived] - Optional; include archived records
 * @returns {object} 200 - Flexi records metadata
 * @example Success response
 * { "records": [ { "flexirecordid": 42, "name": "Badges", "fields": ["f_1","f_2"] } ] }
 * @example Error response (missing params)
 * { "error": "Missing required parameters: sectionid" }
 */
const getFlexiRecords = osmEndpoints.getFlexiRecords();

/**
 * OSM: Get FlexiRecord structure/columns for a term.
 *
 * @tags OSM
 * @route GET /get-flexi-structure
 * @header Authorization {string}
 * @param {string|number} query.sectionid - Section id
 * @param {string|number} query.flexirecordid - Flexi record id
 * @param {string|number} query.termid - Term id
 * @returns {object} 200 - Structure fields/columns
 * @example Success response
 * { "columns": [ { "id": "f_1", "label": "Permission Slip" }, { "id": "f_2", "label": "Paid" } ] }
 * @example Error response (missing params)
 * { "error": "Missing required parameters: sectionid, flexirecordid, termid" }
 */
const getFlexiStructure = osmEndpoints.getFlexiStructure();

/**
 * OSM: Get a single FlexiRecord's data.
 *
 * @tags OSM
 * @route GET /get-single-flexi-record
 * @header Authorization {string}
 * @param {string|number} query.sectionid - Section id
 * @param {string|number} query.flexirecordid - Flexi record id
 * @param {string|number} query.termid - Term id
 * @returns {object} 200 - Record rows/values
 * @example Success response
 * { "rows": [ { "scoutid": 555, "f_1": "Yes", "f_2": "No" } ] }
 * @example Error response (missing params)
 * { "error": "Missing required parameters: sectionid, flexirecordid, termid" }
 */
const getSingleFlexiRecord = osmEndpoints.getSingleFlexiRecord();

/**
 * OSM: Get event sharing status.
 *
 * @tags OSM
 * @route GET /get-event-sharing-status
 * @header Authorization {string}
 * @param {string|number} query.eventid - Event id
 * @param {string|number} query.sectionid - Section id
 * @returns {object} 200 - Event sharing status
 * @example Success response
 * { "shared_sections": [ { "sectionid": "123", "section_name": "1st Example Scouts" } ] }
 * @example Error response (missing params)
 * { "error": "Missing required parameters: eventid, sectionid" }
 */
const getEventSharingStatus = osmEndpoints.getEventSharingStatus();

/**
 * OSM: Get shared event attendance.
 *
 * @tags OSM
 * @route GET /get-shared-event-attendance
 * @header Authorization {string}
 * @param {string|number} query.eventid - Event id
 * @param {string|number} query.sectionid - Section id
 * @returns {object} 200 - Combined attendance from all shared sections
 * @example Success response
 * { "combined_attendance": [ { "memberid": "555", "firstname": "Alex", "sectionid": "123" } ] }
 * @example Error response (missing params)
 * { "error": "Missing required parameters: eventid, sectionid" }
 */
const getSharedEventAttendance = osmEndpoints.getSharedEventAttendance();

/**
 * OSM: Update a single FlexiRecord field for one member.
 *
 * value can be an empty string to clear a field. `columnid` must match pattern `f_<number>`.
 *
 * @tags OSM
 * @route POST /update-flexi-record
 * @header Authorization {string}
 * @param {string|number} body.sectionid - Section id
 * @param {string|number} body.scoutid - Member id
 * @param {string|number} body.flexirecordid - Flexi record id
 * @param {string} body.columnid - Field id (e.g., f_1)
 * @param {string} body.value - New value; can be empty to clear
 * @param {string|number} body.termid - Term id
 * @param {string} body.section - Section type (e.g., "scouts")
 * @returns {object} 200 - OSM update result
 * @returns {object} 400 - Validation error
 * @example Success response
 * { "success": true, "updated": { "scoutid": 555, "column": "f_1", "value": "Completed" } }
 * @example Error response
 * { "error": "Missing required parameter: value (can be empty string to clear field)" }
 */
const updateFlexiRecord = createOSMApiHandler('updateFlexiRecord', {
  method: 'POST',
  requiredParams: [], // Custom validation handles all parameters
  buildUrl: (_req) => 'https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=updateScout&nototal=null',
  buildRequestOptions: (req, access_token) => {
    // Debug log the incoming request
    log.info('updateFlexiRecord: Incoming request', {
      method: req.method,
      body: req.body,
      hasTermid: !!req.body.termid,
      termidValue: req.body.termid,
    });
    
    // Use centralized validation with comprehensive error logging
    const validation = validateFlexiRecordUpdateParams(req);
    
    if (!validation.valid) {
      const validationError = new Error(validation.error);
      
      // Log validation failure using standard logger
      log.error('updateFlexiRecord: Parameter validation failed', {
        operation: 'updateFlexiRecord',
        validationType: 'parameter_validation',
        method: req.method,
        url: req.url,
        missing: validation.missing,
        error: validation.error,
      });
      
      throw validationError;
    }
    
    const { sectionid, scoutid, flexirecordid, columnid, value, termid, section } = req.body;
    
    // Log successful validation with operation context
    log.info('updateFlexiRecord: Parameters validated successfully', {
      operation: 'updateFlexiRecord',
      sectionid,
      scoutid,
      flexirecordid,
      columnid,
      hasValue: req.body.hasOwnProperty('value'),
      valueLength: String(value).length,
    });
    
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

/**
 * OSM: Bulk update a FlexiRecord field for multiple members.
 *
 * @tags OSM
 * @route POST /multi-update-flexi-record
 * @header Authorization {string}
 * @param {string|number} body.sectionid - Section id
 * @param {Array<number>} body.scouts - Array of member ids (non-empty)
 * @param {string} body.value - Value to set
 * @param {string} body.column - Field id (e.g., f_2)
 * @param {string|number} body.flexirecordid - Flexi record id
 * @returns {object} 200 - Bulk update result
 * @returns {object} 400 - Validation error
 * @example Error response
 * { "error": "scouts must be an array" }
 */
const multiUpdateFlexiRecord = createOSMApiHandler('multiUpdateFlexiRecord', {
  method: 'POST',
  requiredParams: ['sectionid', 'scouts', 'value', 'column', 'flexirecordid'],
  buildUrl: (req) => `https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=multiUpdate&sectionid=${req.body.sectionid}`,
  buildRequestOptions: (req, access_token) => {
    const { scouts, value, column, flexirecordid } = req.body;

    // Custom validation for scouts array
    const scoutsValidation = validateArrayParam(scouts, 'scouts');
    if (!scoutsValidation.valid) {
      const err = new Error(scoutsValidation.error);
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    // Custom validation for field ID format
    const fieldValidation = validateFieldIdFormat(column);
    if (!fieldValidation.valid) {
      const err = new Error(fieldValidation.error);
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
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

/**
 * OSM: Create a new FlexiRecord template.
 *
 * Creates a new FlexiRecord with specified configuration for when required records don't exist.
 *
 * @tags OSM
 * @route POST /create-flexi-record
 * @header Authorization {string}
 * @param {string|number} body.sectionid - Section id
 * @param {string} body.name - FlexiRecord name
 * @param {string} [body.dob] - Include date of birth field (1 = yes, 0 = no)
 * @param {string} [body.age] - Include age field (1 = yes, 0 = no)
 * @param {string} [body.patrol] - Include patrol field (1 = yes, 0 = no)
 * @param {string} [body.type] - Record type (default: 'none')
 * @returns {object} 200 - Creation result
 * @returns {object} 400 - Validation error
 * @example Success response
 * { "success": true, "flexirecordid": 12345, "name": "Event Attendance" }
 * @example Error response
 * { "error": "Missing required parameter: name" }
 */
const createFlexiRecord = createOSMApiHandler('createFlexiRecord', {
  method: 'POST',
  requiredParams: ['sectionid', 'name'],
  buildUrl: (req) => `https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=addRecordSet&sectionid=${req.body.sectionid}`,
  buildRequestOptions: (req, access_token) => {
    const { name, dob = '1', age = '1', patrol = '1', type = 'none' } = req.body;

    const requestBody = new URLSearchParams({
      name,
      dob,
      age,
      patrol,
      type,
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

/**
 * OSM: Add a new column/field to an existing FlexiRecord.
 *
 * Adds a new field to an existing FlexiRecord for data collection.
 *
 * @tags OSM
 * @route POST /add-flexi-column
 * @header Authorization {string}
 * @param {string|number} body.sectionid - Section id
 * @param {string|number} body.flexirecordid - FlexiRecord id to add column to
 * @param {string} body.columnName - Name of the new column/field
 * @returns {object} 200 - Addition result
 * @returns {object} 400 - Validation error
 * @example Success response
 * { "success": true, "columnid": "f_5", "name": "assignedTerm" }
 * @example Error response
 * { "error": "Missing required parameter: columnName" }
 */
const addFlexiColumn = createOSMApiHandler('addFlexiColumn', {
  method: 'POST',
  requiredParams: ['sectionid', 'flexirecordid', 'columnName'],
  buildUrl: (req) => `https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=addColumn&sectionid=${req.body.sectionid}&extraid=${req.body.flexirecordid}`,
  buildRequestOptions: (req, access_token) => {
    const { columnName } = req.body;

    const requestBody = new URLSearchParams({
      columnName,
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

/**
 * OSM: Get startup data payload used by OSM web app (parsed from JS to JSON).
 *
 * @tags OSM
 * @route GET /get-startup-data
 * @header Authorization {string}
 * @returns {object} 200 - Startup JSON payload
 * @returns {object} 429 - When OSM rate limit is exceeded
 * @example Error response (rate limited)
 * { "error": "OSM API rate limit exceeded", "message": "Please wait before making more requests" }
 */
const getStartupData = osmEndpoints.getStartupData();

/**
 * OSM: Get members grid (transformed) for a section and term.
 *
 * @tags OSM
 * @route POST /get-members-grid
 * @header Authorization {string}
 * @param {string|number} body.section_id - Section id
 * @param {string|number} body.term_id - Term id
 * @returns {object} 200 - Grid with column definitions and rows (transformed)
 * @example Success response
 * { "columns": [ { "key": "name", "label": "Name" } ], "rows": [ { "scoutid": 555, "name": "Alex Johnson" } ] }
 * @example Error response (missing params)
 * { "error": "Missing required parameters: section_id, term_id" }
 */
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

module.exports = {
  // Utility
  getRateLimitStatus,
  getStartupData,

  // Basic Config
  getTerms,
  getSectionConfig,
  getUserRoles,

  // Events (grouped together)
  getEvents,
  getEventAttendance,
  getEventSummary,
  getEventSharingStatus,
  getSharedEventAttendance,

  // Members and Contacts
  getContactDetails,
  getListOfMembers,
  getMembersGrid,

  // FlexiRecords
  getFlexiRecords,
  getFlexiStructure,
  getSingleFlexiRecord,
  updateFlexiRecord,
  multiUpdateFlexiRecord,
  createFlexiRecord,
  addFlexiColumn,
};