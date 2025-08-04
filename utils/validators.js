/**
 * Validates required parameters from request query or body
 * @param {Object} req - Express request object
 * @param {Array<string>} requiredParams - Array of required parameter names
 * @returns {Object} Validation result with valid boolean and missing array
 */
const validateRequiredParams = (req, requiredParams) => {
  const missingParams = requiredParams.filter(param => {
    const value = req.query[param] || req.body[param];
    return !value;
  });
  
  return {
    valid: missingParams.length === 0,
    missing: missingParams,
  };
};

/**
 * Validates access token from Authorization header
 * @param {Object} req - Express request object
 * @returns {Object} Validation result with valid boolean and token
 */
const validateAccessToken = (req) => {
  const access_token = req.headers.authorization?.replace('Bearer ', '');
  
  return {
    valid: !!access_token,
    token: access_token,
  };
};

/**
 * Validates field ID format (should be f_1, f_2, etc.)
 * @param {string} fieldId - Field ID to validate
 * @returns {Object} Validation result with valid boolean and error message
 */
const validateFieldIdFormat = (fieldId) => {
  const isValid = fieldId && fieldId.match(/^f_\d+$/);
  
  return {
    valid: isValid,
    error: isValid ? null : 'Invalid field ID format. Expected format: f_1, f_2, etc.',
  };
};

/**
 * Validates FlexiRecord update parameters including value field that can be empty
 * @param {Object} req - Express request object
 * @returns {Object} Validation result with valid boolean, missing array, and error message
 */
const validateFlexiRecordUpdateParams = (req) => {
  const requiredParams = ['sectionid', 'scoutid', 'flexirecordid', 'columnid', 'termid', 'section'];
  
  // Check standard required parameters (excluding value)
  const standardValidation = validateRequiredParams(req, requiredParams);
  
  // Special validation for 'value' - must exist as property but can be empty string
  const hasValueProperty = req.body.hasOwnProperty('value');
  
  if (!standardValidation.valid) {
    return {
      valid: false,
      missing: standardValidation.missing,
      error: `Missing required parameters: ${standardValidation.missing.join(', ')}`,
    };
  }
  
  if (!hasValueProperty) {
    return {
      valid: false,
      missing: ['value'],
      error: 'Missing required parameter: value (can be empty string to clear field)',
    };
  }
  
  // Validate field ID format
  const fieldValidation = validateFieldIdFormat(req.body.columnid);
  if (!fieldValidation.valid) {
    return {
      valid: false,
      missing: [],
      error: fieldValidation.error,
    };
  }
  
  return {
    valid: true,
    missing: [],
    error: null,
  };
};

/**
 * Validates array parameter (ensures it's an array and not empty)
 * @param {any} value - Value to validate
 * @param {string} paramName - Parameter name for error message
 * @returns {Object} Validation result with valid boolean and error message
 */
const validateArrayParam = (value, paramName) => {
  if (!Array.isArray(value)) {
    return {
      valid: false,
      error: `${paramName} must be an array`,
    };
  }
  
  if (value.length === 0) {
    return {
      valid: false,
      error: `${paramName} array cannot be empty`,
    };
  }
  
  return {
    valid: true,
    error: null,
  };
};

/**
 * Validates section and term parameters (commonly used together)
 * @param {Object} req - Express request object
 * @returns {Object} Validation result with valid boolean and missing array
 */
const validateSectionAndTerm = (req) => {
  return validateRequiredParams(req, ['sectionid', 'termid']);
};

/**
 * Validates flexi record parameters (commonly used together)
 * @param {Object} req - Express request object
 * @returns {Object} Validation result with valid boolean and missing array
 */
const validateFlexiRecordParams = (req) => {
  return validateRequiredParams(req, ['sectionid', 'flexirecordid', 'termid']);
};

/**
 * Combined validation for common OSM API requirements
 * @param {Object} req - Express request object
 * @param {Array<string>} additionalParams - Additional required parameters
 * @returns {Object} Validation result with details
 */
const validateCommonOSMParams = (req, additionalParams = []) => {
  const tokenValidation = validateAccessToken(req);
  const paramsValidation = validateRequiredParams(req, additionalParams);
  
  return {
    valid: tokenValidation.valid && paramsValidation.valid,
    token: tokenValidation.token,
    missingParams: paramsValidation.missing,
    errors: [
      ...(!tokenValidation.valid ? ['Access token is required in Authorization header'] : []),
      ...(paramsValidation.missing.length > 0 ? [`Missing required parameters: ${paramsValidation.missing.join(', ')}`] : []),
    ],
  };
};

module.exports = {
  validateRequiredParams,
  validateAccessToken,
  validateFieldIdFormat,
  validateFlexiRecordUpdateParams,
  validateArrayParam,
  validateSectionAndTerm,
  validateFlexiRecordParams,
  validateCommonOSMParams,
};