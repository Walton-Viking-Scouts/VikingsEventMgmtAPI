# OAuth Issues Analysis - Vikings OSM Backend

## 🚨 Critical Issues Identified

### 1. **In-Memory Token Storage - High Risk**

**Issue**: Tokens are stored in a JavaScript Map (`userTokens`) in memory
```javascript
// controllers/auth.js line 13
const userTokens = new Map();
```

**Problems**:
- **Session Loss**: All user sessions are lost when server restarts
- **No Scalability**: Won't work with multiple server instances
- **Memory Leaks**: Expired tokens aren't automatically cleaned up
- **No Persistence**: Deployments invalidate all active sessions

**Impact**: 🔴 HIGH - Users need to re-authenticate on every deployment

**Solution**: Implement persistent token storage (Redis, Database)

### 2. **Complex Frontend URL Detection - Medium Risk**

**Issue**: The `getFrontendUrl()` function has 7 different fallback mechanisms
```javascript
// server.js lines 40-108
1. frontend_url parameter
2. State parameter parsing  
3. Referer header detection
4. Environment variable
5. Legacy state detection
6. Special dev-to-prod handling
7. Default fallback
```

**Problems**:
- **Unpredictable Behavior**: Too many fallback paths can lead to wrong URLs
- **Hard to Debug**: Complex logic makes issues difficult to trace
- **Environment Confusion**: Multiple detection methods can conflict
- **Maintenance Burden**: Each path needs testing and can break independently

**Impact**: 🟡 MEDIUM - Authentication redirects can go to wrong frontend

**Solution**: Simplify URL detection logic and add better validation

### 3. **Redirect URI Configuration Complexity - Medium Risk**

**Issue**: Multiple hardcoded fallback URLs in different parts of the code

**Problems**:
- `server.js` line 329: Hardcoded fallback in token payload
- Multiple environment-dependent URL construction
- Inconsistent URL handling between environments

**Impact**: 🟡 MEDIUM - OAuth failures due to redirect URI mismatches

### 4. **Token Expiration Handling Issues - Medium Risk**

**Issue**: Basic token expiration checking without proper cleanup
```javascript
// controllers/auth.js lines 27-30
if (Date.now() > tokenData.expires_at) {
  userTokens.delete(sessionId);
  return res.status(401).json({ error: 'Token expired' });
}
```

**Problems**:
- **Reactive Only**: Only checks expiration when token is accessed
- **No Proactive Cleanup**: Expired tokens remain in memory until accessed
- **Memory Growth**: Memory usage grows over time with expired tokens

**Impact**: 🟡 MEDIUM - Memory leaks and degraded performance

### 5. **Session Management Vulnerability - High Risk**

**Issue**: Session ID generation and management not visible in codebase

**Problems**:
- **Session Fixation Risk**: No clear session rotation strategy
- **Weak Session IDs**: Unknown if sessions use cryptographically secure IDs
- **No Session Timeout**: Besides token expiration, no session management

**Impact**: 🔴 HIGH - Potential security vulnerabilities

## 🔧 **Immediate Fixes Required**

### **Fix 1: Implement Persistent Token Storage**

**Priority**: 🔴 CRITICAL

Replace in-memory storage with Redis or database:

```javascript
// Option A: Redis implementation
const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL);

const storeToken = async (sessionId, tokenData) => {
  const ttl = Math.floor((tokenData.expires_at - Date.now()) / 1000);
  await client.setex(`token:${sessionId}`, ttl, JSON.stringify(tokenData));
};

const getToken = async (sessionId) => {
  const data = await client.get(`token:${sessionId}`);
  return data ? JSON.parse(data) : null;
};
```

### **Fix 2: Simplify Frontend URL Detection**

**Priority**: 🟡 HIGH

Reduce complexity and improve reliability:

```javascript
const getFrontendUrl = (req) => {
  // 1. Explicit parameter (highest priority)
  if (req.query.frontend_url) {
    return req.query.frontend_url;
  }
  
  // 2. Environment variable
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  
  // 3. Referer header for PR previews
  const referer = req.get('Referer');
  if (referer && referer.includes('.onrender.com')) {
    const url = new URL(referer);
    return `${url.protocol}//${url.hostname}`;
  }
  
  // 4. Default based on environment
  return process.env.NODE_ENV === 'development' 
    ? 'https://localhost:3001'
    : 'https://vikingeventmgmt.onrender.com';
};
```

### **Fix 3: Add Token Cleanup Job**

**Priority**: 🟡 MEDIUM

Implement automatic cleanup for expired tokens:

```javascript
// Cleanup expired tokens every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, tokenData] of userTokens.entries()) {
    if (now > tokenData.expires_at) {
      userTokens.delete(sessionId);
      console.log(`Cleaned up expired token for session: ${sessionId}`);
    }
  }
}, 15 * 60 * 1000);
```

### **Fix 4: Add Configuration Validation**

**Priority**: 🟡 MEDIUM

Validate OAuth configuration on startup:

```javascript
const validateOAuthConfig = () => {
  const required = ['OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET', 'BACKEND_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing OAuth configuration:', missing);
    process.exit(1);
  }
  
  // Validate URL format
  try {
    new URL(process.env.BACKEND_URL);
  } catch {
    console.error('❌ Invalid BACKEND_URL format');
    process.exit(1);
  }
  
  console.log('✅ OAuth configuration validated');
};
```

## 🛡️ **Security Recommendations**

### **1. Implement CSRF Protection**
- Add CSRF tokens to OAuth state parameter
- Validate state parameter includes CSRF protection

### **2. Add Request Rate Limiting for OAuth**
- Separate rate limiting for OAuth endpoints
- Prevent OAuth callback abuse

### **3. Implement Token Refresh**
- Add refresh token support if OSM supports it
- Graceful token renewal without user re-authentication

### **4. Enhanced Session Security**
- Use cryptographically secure session IDs
- Implement session rotation on login
- Add session timeout separate from token expiration

## 📊 **OAuth Flow Analysis**

### **Current Flow Issues**:
1. **Frontend** → Constructs OAuth URL with dynamic parameters
2. **OSM** → Redirects to backend with authorization code
3. **Backend** → Complex URL detection to determine frontend redirect
4. **Backend** → Token exchange with OSM
5. **Backend** → Redirects to frontend with token in URL
6. **Frontend** → Extracts token from URL and stores in sessionStorage

### **Problematic Steps**:
- **Step 3**: Too complex and error-prone
- **Step 5**: Token in URL is visible in logs/referer headers
- **Token Storage**: In-memory storage causes session loss

### **Recommended Improvements**:
- Simplify URL detection logic
- Use HTTP-only cookies for token storage
- Implement proper session management
- Add CSRF protection throughout flow

## 🔍 **Debugging Tools Needed**

### **Enhanced OAuth Debug Endpoint**
Add more comprehensive debugging information:

```javascript
app.get('/oauth/debug', (req, res) => {
  res.json({
    configuration: {
      clientId: process.env.OAUTH_CLIENT_ID ? 'Set' : 'Missing',
      clientSecret: process.env.OAUTH_CLIENT_SECRET ? 'Set' : 'Missing',
      backendUrl: process.env.BACKEND_URL,
      frontendUrl: process.env.FRONTEND_URL,
    },
    runtime: {
      detectedFrontendUrl: getFrontendUrl(req),
      referer: req.get('Referer'),
      userAgent: req.get('User-Agent'),
      sessionId: getSessionId(req),
      activeTokens: userTokens.size,
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
    }
  });
});
```

## 📋 **Action Items Priority**

### **Immediate (This Week)**
1. 🔴 Implement persistent token storage (Redis/Database)
2. 🔴 Add token cleanup mechanism
3. 🟡 Simplify frontend URL detection

### **Short Term (Next Sprint)**
1. 🟡 Add comprehensive OAuth debugging
2. 🟡 Implement configuration validation
3. 🟡 Add CSRF protection

### **Medium Term (Next Month)**
1. 🟠 Enhanced session security
2. 🟠 Token refresh implementation
3. 🟠 Comprehensive OAuth flow testing

### **Long Term (Future)**
1. 🔵 Migration to database-backed sessions
2. 🔵 OAuth scope management
3. 🔵 Multi-tenant token management

---

**Last Updated**: January 2025  
**Severity**: 🔴 HIGH - Critical issues affecting user experience  
**Recommended Action**: Address persistent storage immediately