# Security Architecture

This document outlines the comprehensive security measures implemented in the Vikings OSM Backend API to protect against common vulnerabilities and ensure secure operation.

## Security Overview

The Vikings OSM Backend implements defense-in-depth security with multiple layers of protection:

1. **Authentication & Authorization**: OAuth 2.0 with secure token management
2. **Input Validation**: Comprehensive parameter and data validation
3. **Rate Limiting**: Multi-tier protection against abuse
4. **CORS Protection**: Whitelist-based origin validation
5. **Error Handling**: Secure error responses without information leakage
6. **Monitoring**: Real-time security event tracking

## Authentication Security

### OAuth 2.0 Implementation

The application implements OAuth 2.0 authorization code flow with security best practices:

```javascript
// Secure OAuth configuration
const oauthConfig = {
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET, // Never exposed to client
  redirectUri: `${process.env.BACKEND_URL}/oauth/callback`,
  scope: 'section:member:read section:programme:read section:event:read section:flexirecord:write'
};
```

**Security Features:**
- **Client Secret Protection**: Secrets never exposed to frontend
- **Secure Redirect URI**: Validated against registered URIs
- **State Parameter**: CSRF protection in OAuth flow
- **Scope Limitation**: Minimal required permissions

### Token Management

```javascript
// Secure token storage
const userTokens = new Map(); // In-memory storage
const tokenToSessionId = new Map(); // Reverse lookup

// Token validation with security checks
const validateToken = (req) => {
  const authHeader = req.headers.authorization;
  
  // Validate header format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Invalid authorization header format' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  // Validate token format and existence
  if (!token || token.length < 10) {
    return { success: false, error: 'Invalid token format' };
  }
  
  // Check token existence and expiration
  const sessionId = tokenToSessionId.get(token);
  if (!sessionId) {
    return { success: false, error: 'Token not found' };
  }
  
  const tokenData = userTokens.get(sessionId);
  if (!tokenData || Date.now() > tokenData.expires_at) {
    return { success: false, error: 'Token expired' };
  }
  
  return { success: true, tokenData, sessionId };
};
```

**Security Measures:**
- **In-Memory Storage**: Tokens never persisted to disk
- **Automatic Expiration**: Tokens expire based on OSM response
- **Session Isolation**: Each session has isolated token storage
- **Secure Cleanup**: Expired tokens automatically removed

### Session Security

```javascript
// Secure session ID generation
const getSessionId = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    // Hash the authorization header for consistent session ID
    return crypto.createHash('sha256')
      .update(authHeader)
      .digest('hex')
      .substring(0, 16);
  }
  
  // Fallback to session or IP
  return req.sessionID || req.ip;
};

// Automatic token cleanup
const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [sessionId, tokenData] of userTokens.entries()) {
    if (now > tokenData.expires_at) {
      userTokens.delete(sessionId);
      tokenToSessionId.delete(tokenData.access_token);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    logger.info('Token cleanup completed', { cleanedCount });
  }
}, CLEANUP_INTERVAL);
```

## Input Validation Security

### Parameter Validation

```javascript
// Comprehensive parameter validation
const validateRequiredParams = (req, requiredParams) => {
  const missing = [];
  const invalid = [];
  
  for (const param of requiredParams) {
    const value = req.query[param] || req.body[param];
    
    // Check for missing parameters
    if (!value) {
      missing.push(param);
      continue;
    }
    
    // Validate parameter format
    if (typeof value !== 'string' || value.trim().length === 0) {
      invalid.push(param);
      continue;
    }
    
    // Check for potential injection attempts
    if (containsSuspiciousContent(value)) {
      invalid.push(param);
    }
  }
  
  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required parameters: ${missing.join(', ')}`
    };
  }
  
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Invalid parameter format: ${invalid.join(', ')}`
    };
  }
  
  return { valid: true };
};

// Security content validation
const containsSuspiciousContent = (value) => {
  const suspiciousPatterns = [
    /<script/i,           // Script injection
    /javascript:/i,       // JavaScript protocol
    /on\w+\s*=/i,        // Event handlers
    /\beval\s*\(/i,      // Eval function
    /\bexec\s*\(/i,      // Exec function
    /\.\.\//,            // Path traversal
    /\0/,                // Null bytes
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(value));
};
```

### Field ID Validation

```javascript
// Specific validation for OSM field IDs
const validateFieldIdFormat = (fieldId) => {
  // OSM field IDs must match pattern f_\d+
  const fieldIdPattern = /^f_\d+$/;
  
  if (!fieldIdPattern.test(fieldId)) {
    return {
      valid: false,
      error: 'Invalid field_id format',
      details: 'field_id must match pattern f_\\d+ (e.g., f_123)',
      received: fieldId
    };
  }
  
  return { valid: true };
};

// Array parameter validation
const validateArrayParam = (param, paramName) => {
  if (!Array.isArray(param)) {
    return {
      valid: false,
      error: `${paramName} must be an array`
    };
  }
  
  if (param.length === 0) {
    return {
      valid: false,
      error: `${paramName} cannot be empty`
    };
  }
  
  // Validate each array element
  for (const item of param) {
    if (typeof item !== 'string' || item.trim().length === 0) {
      return {
        valid: false,
        error: `All ${paramName} items must be non-empty strings`
      };
    }
  }
  
  return { valid: true };
};
```

## CORS Security

### Whitelist-Based Origin Validation

```javascript
// Secure CORS configuration
const allowedOrigins = [
  // Production frontends
  'https://vikings-eventmgmt.onrender.com',
  'https://vikingeventmgmt.onrender.com',
  
  // Development (localhost only)
  'http://localhost:3000',
  'https://localhost:3000',
  'http://localhost:3001',
  'https://localhost:3001',
];

// PR preview pattern (secure pattern matching)
const prPreviewPattern = /^https:\/\/vikingeventmgmt-pr-\d+\.onrender\.com$/;

const corsOriginValidator = (origin, callback) => {
  // Allow requests with no origin (mobile apps, Postman, etc.)
  if (!origin) return callback(null, true);
  
  // Check against whitelist
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  
  // Check PR preview pattern
  if (prPreviewPattern.test(origin)) {
    return callback(null, true);
  }
  
  // Reject all other origins
  const error = new Error(`CORS policy violation: Origin ${origin} not allowed`);
  error.status = 403;
  callback(error, false);
};

// CORS configuration
app.use(cors({
  origin: corsOriginValidator,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));
```

## Frontend URL Security

### URL Validation and Sanitization

```javascript
// Comprehensive frontend URL validation
const validateFrontendUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  // Prevent DoS attacks with extremely long URLs
  if (url.length > 1000) {
    return false;
  }
  
  try {
    const parsedUrl = new URL(url);
    const { protocol, hostname, port } = parsedUrl;
    
    // Protocol validation
    if (protocol !== 'https:' && protocol !== 'http:') {
      return false;
    }
    
    // HTTP only allowed for localhost
    if (protocol === 'http:' && 
        hostname !== 'localhost' && 
        hostname !== '127.0.0.1') {
      return false;
    }
    
    // Port validation for localhost
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && 
        port && !['3000', '3001', '8080'].includes(port)) {
      return false;
    }
    
    // Domain whitelist validation
    const allowedDomains = [
      'localhost',
      '127.0.0.1',
      'vikings-eventmgmt.onrender.com',
      'vikingeventmgmt.onrender.com'
    ];
    
    // Check exact domain matches
    if (allowedDomains.includes(hostname)) {
      return true;
    }
    
    // Check PR preview pattern
    if (/^vikingeventmgmt-pr-\d+\.onrender\.com$/.test(hostname)) {
      return true;
    }
    
    return false;
    
  } catch (error) {
    // Invalid URL format
    return false;
  }
};
```

## Rate Limiting Security

### Multi-Tier Rate Limiting

```javascript
// Backend rate limiting configuration
const backendRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please wait before making more requests.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getSessionId(req), // Session-based limiting
  skip: (req) => {
    // Skip rate limiting for health checks in production monitoring
    return req.path === '/health' && req.get('User-Agent')?.includes('monitoring');
  }
});

// OSM API rate limiting tracking
const osmRateLimits = new Map(); // sessionId -> rateLimitInfo

const updateOSMRateLimit = (response, sessionId) => {
  const remaining = parseInt(response.headers.get('x-ratelimit-remaining'));
  const limit = parseInt(response.headers.get('x-ratelimit-limit'));
  const reset = parseInt(response.headers.get('x-ratelimit-reset'));
  
  const rateLimitInfo = {
    limit: limit || 1000,
    remaining: remaining !== null ? remaining : 'unknown',
    resetTime: reset ? reset * 1000 : Date.now() + 3600000,
    rateLimited: response.status === 429,
    lastUpdated: Date.now()
  };
  
  osmRateLimits.set(sessionId, rateLimitInfo);
  
  // Alert on approaching limits
  if (remaining !== null && remaining < 50) {
    logger.warn('OSM rate limit approaching', {
      sessionId: sessionId.substring(0, 8) + '...',
      remaining,
      limit
    });
  }
  
  return rateLimitInfo;
};
```

## Error Handling Security

### Secure Error Responses

```javascript
// Sanitized error responses
const sendErrorResponse = (res, error, statusCode = 500, context = {}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Base error response
  const errorResponse = {
    error: typeof error === 'string' ? error : 'Internal server error',
    timestamp: new Date().toISOString(),
    ...context
  };
  
  // Add detailed error information only in development
  if (isDevelopment && typeof error === 'object') {
    errorResponse.details = error.message;
    errorResponse.stack = error.stack;
  }
  
  // Never expose sensitive information
  if (errorResponse.error && typeof errorResponse.error === 'string') {
    errorResponse.error = sanitizeErrorMessage(errorResponse.error);
  }
  
  res.status(statusCode).json(errorResponse);
};

// Error message sanitization
const sanitizeErrorMessage = (message) => {
  // Remove potential sensitive information
  const sensitivePatterns = [
    /password[=:]\s*\S+/gi,
    /token[=:]\s*\S+/gi,
    /secret[=:]\s*\S+/gi,
    /key[=:]\s*\S+/gi,
    /authorization[=:]\s*\S+/gi
  ];
  
  let sanitized = message;
  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });
  
  return sanitized;
};

// Global error handler with security considerations
app.use((error, req, res, next) => {
  // Log error with context (but not sensitive data)
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    sessionId: getSessionId(req)?.substring(0, 8) + '...'
  });
  
  // Determine appropriate status code
  const statusCode = error.status || error.statusCode || 500;
  
  // Send sanitized error response
  sendErrorResponse(res, error.message || 'Internal server error', statusCode);
});
```

## Security Headers

### HTTP Security Headers

```javascript
// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (for API responses)
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  
  // Prevent caching of sensitive responses
  if (req.path.includes('/token') || req.path.includes('/oauth')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

app.use(securityHeaders);
```

## Monitoring and Alerting

### Security Event Monitoring

```javascript
// Security event tracking
const trackSecurityEvent = (eventType, details, req) => {
  const securityEvent = {
    type: eventType,
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    path: req.path,
    method: req.method,
    sessionId: getSessionId(req)?.substring(0, 8) + '...',
    ...details
  };
  
  // Log security event
  logger.warn('Security event detected', securityEvent);
  
  // Send to Sentry for alerting
  if (Sentry) {
    Sentry.captureMessage(`Security Event: ${eventType}`, {
      level: 'warning',
      tags: {
        section: 'security',
        event_type: eventType
      },
      extra: securityEvent
    });
  }
};

// Examples of security event tracking
const trackFailedAuth = (req, reason) => {
  trackSecurityEvent('failed_authentication', { reason }, req);
};

const trackSuspiciousRequest = (req, reason) => {
  trackSecurityEvent('suspicious_request', { reason }, req);
};

const trackRateLimitViolation = (req, limitType) => {
  trackSecurityEvent('rate_limit_violation', { limitType }, req);
};
```

### Automated Security Alerts

```javascript
// Security alert conditions
const securityAlerts = {
  // Multiple failed auth attempts from same IP
  multipleFailedAuth: {
    threshold: 5,
    timeWindow: 300000, // 5 minutes
    action: 'alert_and_block'
  },
  
  // Suspicious parameter patterns
  suspiciousInput: {
    threshold: 3,
    timeWindow: 600000, // 10 minutes
    action: 'alert'
  },
  
  // Rate limit violations
  rateLimitAbuse: {
    threshold: 10,
    timeWindow: 3600000, // 1 hour
    action: 'alert_and_throttle'
  }
};
```

## Security Best Practices

### Development Security

1. **Environment Variables**: Never commit secrets to version control
2. **Dependency Scanning**: Regular security audits of dependencies
3. **Code Review**: Security-focused code reviews for all changes
4. **Testing**: Security test cases for all endpoints

### Production Security

1. **HTTPS Only**: All production traffic over HTTPS
2. **Regular Updates**: Keep dependencies and runtime updated
3. **Monitoring**: Continuous security monitoring and alerting
4. **Incident Response**: Documented security incident procedures

### Operational Security

1. **Access Control**: Limit access to production systems
2. **Audit Logging**: Comprehensive audit trails
3. **Backup Security**: Secure backup and recovery procedures
4. **Compliance**: Regular security compliance assessments

## Security Compliance

### Data Protection

- **No Persistent Storage**: User data not stored permanently
- **Data Minimization**: Only necessary data processed
- **Secure Transmission**: All data encrypted in transit
- **Access Logging**: All data access logged and monitored

### Privacy Considerations

- **Token Anonymization**: Tokens hashed in logs
- **IP Address Handling**: IP addresses used only for security
- **User Consent**: OAuth flow requires explicit user consent
- **Data Retention**: Automatic cleanup of expired data

## Incident Response

### Security Incident Procedures

1. **Detection**: Automated monitoring and manual reporting
2. **Assessment**: Rapid impact assessment and classification
3. **Containment**: Immediate containment measures
4. **Investigation**: Forensic analysis and root cause identification
5. **Recovery**: System restoration and security improvements
6. **Documentation**: Incident documentation and lessons learned

### Emergency Contacts

- **Development Team**: Immediate technical response
- **Security Team**: Security expertise and guidance
- **Management**: Business impact assessment and decisions
- **External**: Third-party security services if needed

---

*Last updated: September 6, 2025*