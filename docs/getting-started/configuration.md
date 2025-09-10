# Configuration Guide

This guide covers all environment variables and configuration options for the Vikings OSM Backend API.

## Environment Variables

### Required Variables

These variables are required for the API to function:

#### OAuth Configuration
```env
OAUTH_CLIENT_ID=your_osm_client_id
OAUTH_CLIENT_SECRET=your_osm_client_secret
```

**Description:**
- `OAUTH_CLIENT_ID`: Your OSM OAuth application client ID
- `OAUTH_CLIENT_SECRET`: Your OSM OAuth application client secret

**How to obtain:**
1. Contact OSM support to request API access
2. Register your application with OSM
3. Receive client credentials

**Security Note:** Never commit these values to version control. Use environment-specific configuration.

### Optional Variables

#### Server Configuration
```env
NODE_ENV=development
PORT=3000
BACKEND_URL=http://localhost:3000
```

**Defaults:**
- `NODE_ENV`: `development`
- `PORT`: `3000`
- `BACKEND_URL`: Constructed from hostname and port

**Usage:**
- `NODE_ENV`: Controls logging level, error details, and debug endpoints
- `PORT`: Server listening port
- `BACKEND_URL`: Used for OAuth redirect URI construction

#### Frontend Configuration
```env
FRONTEND_URL=https://your-frontend.com
```

**Description:**
- `FRONTEND_URL`: Default frontend URL for OAuth redirects

**Note:** The backend supports dynamic frontend URL detection, so this is optional in most cases.

#### Monitoring and Logging
```env
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

**Description:**
- `SENTRY_DSN`: Sentry Data Source Name for error monitoring and structured logging

**Features when enabled:**
- Error tracking and alerting
- Performance monitoring
- Structured logging with context
- Request/response tracking

## Configuration Files

### Environment File (.env)

Create a `.env` file in the project root:

```env
# Required OAuth credentials
OAUTH_CLIENT_ID=your_osm_client_id
OAUTH_CLIENT_SECRET=your_osm_client_secret

# Server configuration
NODE_ENV=development
PORT=3000
BACKEND_URL=http://localhost:3000

# Optional frontend URL
FRONTEND_URL=http://localhost:3001

# Optional monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

### Package.json Scripts

The application includes several npm scripts for different environments:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "NODE_ENV=test jest",
    "lint": "eslint .",
    "build": "echo 'No build step needed'"
  }
}
```

## Environment-Specific Configuration

### Development Environment

```env
NODE_ENV=development
PORT=3000
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001
OAUTH_CLIENT_ID=dev_client_id
OAUTH_CLIENT_SECRET=dev_client_secret
```

**Features:**
- Detailed error messages
- Debug endpoints enabled (`/oauth/debug`, `/admin/tokens`)
- Verbose logging
- CORS allows localhost origins

### Production Environment

```env
NODE_ENV=production
PORT=3000
BACKEND_URL=https://your-backend.railway.app
OAUTH_CLIENT_ID=prod_client_id
OAUTH_CLIENT_SECRET=prod_client_secret
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

**Features:**
- Minimal error details
- Debug endpoints disabled
- Structured logging via Sentry
- CORS restricted to production domains
- Performance monitoring enabled

### Test Environment

```env
NODE_ENV=test
PORT=3001
OAUTH_CLIENT_ID=test_client_id
OAUTH_CLIENT_SECRET=test_client_secret
```

**Features:**
- Minimal logging
- Mock external services
- Isolated test database
- Fast test execution

## Configuration Validation

The application validates configuration on startup:

### OAuth Validation
```javascript
if (!process.env.OAUTH_CLIENT_ID || !process.env.OAUTH_CLIENT_SECRET) {
  console.error('❌ CRITICAL: OAuth credentials not found!');
  console.error('❌ Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET');
  process.exit(1);
}
```

### URL Validation
```javascript
const validateBackendUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    console.warn('⚠️ Invalid BACKEND_URL format:', url);
    return false;
  }
};
```

## Dynamic Configuration

### Frontend URL Detection

The backend supports multiple methods for frontend URL detection:

1. **Explicit Parameter**: `frontend_url` query parameter
2. **State Parameter**: Embedded in OAuth state
3. **Referer Header**: Automatic detection from request origin
4. **Environment Variable**: `FRONTEND_URL` setting
5. **Default Fallback**: Production frontend URL

### CORS Configuration

CORS origins are dynamically configured based on environment:

```javascript
const allowedOrigins = [
  'https://vikings-eventmgmt.onrender.com',  // Production
  'https://vikingeventmgmt.onrender.com',    // Production mobile
  'http://localhost:3000',                   // Development
  'http://localhost:3001',                   // Development mobile
];

// PR preview pattern support
const prPreviewPattern = /^https:\/\/vikingeventmgmt-pr-\d+\.onrender\.com$/;
```

## Security Configuration

### Frontend URL Whitelist

For security, frontend URLs are validated against a whitelist:

```javascript
const allowedDomains = [
  // Development
  'localhost',
  '127.0.0.1',
  
  // Production
  'vikings-eventmgmt.onrender.com',
  'vikingeventmgmt.onrender.com',
  
  // PR previews (pattern-based)
  /^vikingeventmgmt-pr-\d+\.onrender\.com$/
];
```

### Protocol Validation

- **HTTPS Required**: For all non-localhost domains
- **HTTP Allowed**: Only for localhost/127.0.0.1
- **URL Length Limit**: Maximum 1000 characters

## Configuration Debugging

### Debug Endpoint

Access configuration information via the debug endpoint (development only):

```bash
curl http://localhost:3000/oauth/debug
```

**Response:**
```json
{
  "backendUrl": "http://localhost:3000",
  "authUrl": "https://www.onlinescoutmanager.co.uk/oauth/authorize?...",
  "environment": "development",
  "oauthConfigured": true,
  "frontendUrl": "http://localhost:3001"
}
```

### Health Check

Monitor configuration status via the health endpoint:

```bash
curl http://localhost:3000/health
```

**Response includes:**
```json
{
  "configuration": {
    "backendUrl": "http://localhost:3000",
    "frontendUrlConfigured": true,
    "oauthConfigured": true,
    "sentryConfigured": false
  }
}
```

## Common Configuration Issues

### OAuth Redirect URI Mismatch

**Problem:** OAuth callback fails with redirect URI mismatch

**Solution:**
1. Ensure `BACKEND_URL` matches your actual deployment URL
2. Verify the redirect URI registered with OSM matches exactly
3. Check for trailing slashes and protocol differences

**Example:**
```env
# Correct
BACKEND_URL=https://your-backend.railway.app

# Incorrect (missing protocol)
BACKEND_URL=your-backend.railway.app
```

### CORS Errors

**Problem:** Frontend requests blocked by CORS policy

**Solution:**
1. Add your frontend domain to the allowed origins list
2. Ensure protocol matches (HTTP vs HTTPS)
3. Check for port number requirements

### Environment Variable Loading

**Problem:** Environment variables not loaded

**Solution:**
1. Ensure `.env` file is in the project root
2. Check file permissions and encoding
3. Verify variable names match exactly (case-sensitive)

### Port Conflicts

**Problem:** Port already in use error

**Solution:**
1. Change `PORT` environment variable
2. Stop conflicting processes
3. Use different ports for different environments

## Best Practices

### Development
- Use separate OAuth credentials for development
- Keep `.env` file in `.gitignore`
- Use descriptive variable names
- Document all custom variables

### Production
- Use secure credential management (Railway secrets, etc.)
- Enable Sentry monitoring
- Set appropriate `NODE_ENV`
- Use HTTPS for all URLs

### Testing
- Use test-specific credentials
- Mock external services
- Isolate test environment
- Clean up test data

## Configuration Templates

### Local Development Template
```env
# Local Development Configuration
NODE_ENV=development
PORT=3000
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001

# OSM OAuth (Development)
OAUTH_CLIENT_ID=dev_your_client_id
OAUTH_CLIENT_SECRET=dev_your_client_secret

# Optional: Sentry (Development)
# SENTRY_DSN=https://your-dev-sentry-dsn@sentry.io/project-id
```

### Production Template
```env
# Production Configuration
NODE_ENV=production
PORT=3000
BACKEND_URL=https://your-backend.railway.app

# OSM OAuth (Production)
OAUTH_CLIENT_ID=prod_your_client_id
OAUTH_CLIENT_SECRET=prod_your_client_secret

# Monitoring (Production)
SENTRY_DSN=https://your-prod-sentry-dsn@sentry.io/project-id
```

---

*Last updated: September 6, 2025*