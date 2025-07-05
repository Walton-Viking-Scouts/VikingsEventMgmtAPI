const { addRateLimitInfoToResponse } = require('../middleware/rateLimiting');

/**
 * Sends a standardized OSM API response with rate limit information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @returns {void}
 */
const sendOSMResponse = (req, res, data) => {
  const responseWithRateInfo = addRateLimitInfoToResponse(req, res, data);
  res.json(responseWithRateInfo);
};

/**
 * Sends a standardized error response
 * @param {Object} res - Express response object
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @param {any} details - Optional error details
 * @returns {void}
 */
const sendErrorResponse = (res, status, message, details = null) => {
  const response = { error: message };
  if (details) {
    response.details = details;
  }
  res.status(status).json(response);
};

/**
 * Sends a standardized validation error response
 * @param {Object} res - Express response object
 * @param {Array<string>} errors - Array of validation error messages
 * @returns {void}
 */
const sendValidationError = (res, errors) => {
  const message = errors.length === 1 ? errors[0] : 'Validation failed';
  const response = { 
    error: message,
    validationErrors: errors,
  };
  res.status(400).json(response);
};

/**
 * Sends a standardized rate limit error response
 * @param {Object} res - Express response object
 * @param {Object} rateLimitInfo - Rate limit information from OSM
 * @returns {void}
 */
const sendRateLimitError = (res, rateLimitInfo) => {
  res.status(429).json({
    error: 'OSM API rate limit exceeded',
    rateLimitInfo,
    message: 'Please wait before making more requests',
  });
};

/**
 * Sends a standardized unauthorized response
 * @param {Object} res - Express response object
 * @param {string} message - Optional custom message
 * @returns {void}
 */
const sendUnauthorizedResponse = (res, message = 'Access token is required in Authorization header') => {
  res.status(401).json({ error: message });
};

/**
 * Sends a standardized internal server error response
 * @param {Object} res - Express response object
 * @param {Error} error - The error object
 * @param {boolean} includeDetails - Whether to include error details (for development)
 * @returns {void}
 */
const sendServerError = (res, error, includeDetails = process.env.NODE_ENV === 'development') => {
  const response = { error: 'Internal Server Error' };
  if (includeDetails) {
    response.details = error.message;
  }
  res.status(500).json(response);
};

/**
 * Processes and parses JSON response text with error handling
 * @param {string} responseText - Raw response text from OSM API
 * @param {string} endpoint - Endpoint name for logging
 * @returns {Object} Parsed data or error information
 */
const parseOSMResponse = (responseText, endpoint) => {
  if (!responseText.trim()) {
    return {
      success: false,
      error: 'Empty response from OSM API',
      status: 500,
    };
  }

  try {
    const data = JSON.parse(responseText);
    return {
      success: true,
      data,
    };
  } catch (parseError) {
    return {
      success: false,
      error: 'Invalid JSON response from OSM API',
      details: responseText.substring(0, 500),
      status: 500,
    };
  }
};

/**
 * Processes special OSM startup response (removes first 18 characters)
 * @param {string} responseText - Raw response text from OSM startup API
 * @returns {Object} Parsed data or error information
 */
const parseOSMStartupResponse = (responseText) => {
  if (!responseText || responseText.length < 18) {
    return {
      success: false,
      error: 'Invalid startup response from OSM API',
      status: 500,
    };
  }

  // OSM startup endpoint returns JavaScript code, remove first 18 characters to get JSON
  const jsonText = responseText.substring(18);
  
  try {
    const data = JSON.parse(jsonText);
    return {
      success: true,
      data,
    };
  } catch (parseError) {
    return {
      success: false,
      error: 'Invalid JSON in startup response from OSM API',
      details: jsonText.substring(0, 500),
      status: 500,
    };
  }
};

module.exports = {
  sendOSMResponse,
  sendErrorResponse,
  sendValidationError,
  sendRateLimitError,
  sendUnauthorizedResponse,
  sendServerError,
  parseOSMResponse,
  parseOSMStartupResponse,
};