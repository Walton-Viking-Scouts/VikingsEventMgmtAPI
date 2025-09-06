# Authentication API

This document describes the authentication endpoints and OAuth flow for the Vikings OSM Backend API.

## Overview

This API uses OAuth 2.0 authorization code flow with Online Scout Manager (OSM) and supports dynamic frontend URL detection for flexible deployment environments. Client applications need to obtain an access token through the OAuth flow and include it in the `Authorization` header for subsequent API calls.

## OAuth Flow

### 1. Authorization Request

Direct users to OSM authorization URL:

```
https://www.onlinescoutmanager.co.uk/oauth/authorize?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=YOUR_BACKEND_URL/oauth/callback&
  state=OPTIONAL_STATE&
  frontend_url=YOUR_FRONTEND_URL
```

**Parameters:**
- `response_type`: Always `code`
- `client_id`: Your OSM OAuth client ID (`process.env.OAUTH_CLIENT_ID`)
- `redirect_uri`: Your backend callback URL (must match exactly with OSM registration)
- `state`: Optional state parameter for frontend environment detection
- `frontend_url`: Optional explicit frontend URL for redirect after auth
- `scope`: Required permissions (default: `section:member:read section:programme:read section:event:read section:flexirecord:write`)

### 2. Authorization Callback

OSM redirects to your callback URL with authorization code:

```
YOUR_BACKEND_URL/oauth/callback?code=AUTH_CODE&state=STATE&frontend_url=FRONTEND_URL
```

### 3. Token Exchange

The backend automatically:
1. Exchanges the authorization code for an access token
2. Stores the token in memory with session tracking
3. Redirects to the appropriate frontend URL

### 4. Frontend URL Detection

The backend uses multiple methods to determine the correct frontend URL for redirect:

**Priority Order:**
1. **Explicit Parameter**: `frontend_url` query parameter
2. **Embedded in State**: `state=prod&frontend_url=https://pr-123-app.onrender.com`
3. **Referer Header**: Automatic detection from request origin
4. **Environment Variable**: `FRONTEND_URL` configuration
5. **State-Based**: `state=dev` → localhost, `state=prod` → production
6. **Default Fallback**: Production frontend URL

## Endpoints

### GET /token

Get current access token for the session.

**Headers:**
- `Authorization`: Bearer token (optional for checking current token)

**Response (200 OK):**
```json
{
  "access_token": "osm_access_token_here",
  "expires_at": 1699123456000,
  "valid": true,
  "sessionId": "session_abc123"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "No valid token found for this session"
}
```

### GET /validate-token

Validate the current session token without returning the token value.

**Headers:**
- `Authorization`: Bearer token (required)

**Response (200 OK):**
```json
{
  "valid": true,
  "expires_at": 1699123456000,
  "sessionId": "session_abc123"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Invalid or expired access token"
}
```

### POST /logout

Logout and invalidate the current session token.

**Headers:**
- `Authorization`: Bearer token (optional)

**Response (200 OK):**
```json
{
  "message": "Logged out successfully",
  "sessionId": "session_abc123"
}
```

### GET /oauth/callback

OAuth callback endpoint (handled automatically by OSM).

**Parameters:**
- `code` - Authorization code from OSM (required)
- `state` - State parameter for environment detection (optional)
- `frontend_url` - Explicit frontend URL for redirect (optional)

**Response:**
- **Success**: HTTP 302 redirect to frontend with success indicator
- **Error**: HTTP 302 redirect to frontend with error parameter

### GET /oauth/debug

Debug endpoint to inspect OAuth configuration (development only).

**Response (200 OK):**
```json
{
  "backendUrl": "https://your-backend.com",
  "authUrl": "https://www.onlinescoutmanager.co.uk/oauth/authorize?...",
  "environment": "development",
  "oauthConfigured": true
}
```

**Response (403 Forbidden in production):**
```json
{
  "error": "Debug endpoint disabled in production"
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Access token is required in Authorization header",
  "_rateLimitInfo": {
    "backend": { "remaining": 99, "limit": 100 }
  }
}
```

### 403 Forbidden
```json
{
  "error": "Invalid or expired access token",
  "sessionId": "session_abc123"
}
```

### 500 Internal Server Error
```json
{
  "error": "OAuth token exchange failed",
  "details": "Invalid authorization code"
}
```

## Usage Examples

### Frontend Integration

```javascript
// Check if user is authenticated
const checkAuth = async () => {
  try {
    const response = await fetch('/token');
    if (response.ok) {
      const { access_token, expires_at } = await response.json();
      return { authenticated: true, token: access_token, expiresAt: expires_at };
    }
  } catch (error) {
    console.error('Auth check failed:', error);
  }
  return { authenticated: false };
};

// Initiate OAuth flow
const startOAuth = () => {
  const backendUrl = 'https://your-backend.com';
  const frontendUrl = window.location.origin;
  const state = 'prod'; // or 'dev' for development
  
  const authUrl = `${backendUrl}/oauth/authorize?` +
    `response_type=code&` +
    `client_id=YOUR_CLIENT_ID&` +
    `redirect_uri=${backendUrl}/oauth/callback&` +
    `state=${state}&` +
    `frontend_url=${encodeURIComponent(frontendUrl)}`;
  
  window.location.href = authUrl;
};

// Make authenticated requests
const makeAuthenticatedRequest = async (endpoint, options = {}) => {
  const { token } = await checkAuth();
  if (!token) {
    startOAuth();
    return;
  }
  
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  if (response.status === 401) {
    // Token expired, re-authenticate
    startOAuth();
    return;
  }
  
  return response;
};
```

### Logout

```javascript
const logout = async () => {
  try {
    await fetch('/logout', { method: 'POST' });
    // Redirect to login page or clear local state
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout failed:', error);
  }
};
```

### Token Validation

```javascript
const validateToken = async (token) => {
  try {
    const response = await fetch('/validate-token', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const { valid, expires_at } = await response.json();
      return { valid, expiresAt: expires_at };
    }
  } catch (error) {
    console.error('Token validation failed:', error);
  }
  return { valid: false };
};
```

## Security Considerations

### Frontend URL Validation

The backend validates frontend URLs against a whitelist to prevent open redirect vulnerabilities:

**Allowed Domains:**
- `localhost` and `127.0.0.1` (development only)
- `vikings-eventmgmt.onrender.com` (production)
- `vikingeventmgmt.onrender.com` (production)
- PR preview pattern: `vikingeventmgmt-pr-{number}.onrender.com`

**Security Features:**
- Protocol validation (HTTPS required except for localhost)
- URL length limits (max 1000 characters)
- Domain whitelist enforcement
- Malformed URL rejection

### Token Storage

- **Backend**: Tokens stored in memory with automatic cleanup
- **Session Tracking**: Each session gets a unique identifier
- **Expiration**: Tokens automatically expire based on OSM response
- **Cleanup**: Expired tokens removed every 15 minutes

### Rate Limiting

Authentication endpoints are subject to rate limiting:
- **Backend Rate Limit**: 100 requests per minute per session
- **OAuth Endpoints**: Additional protection against abuse

---

*Last updated: September 6, 2025*