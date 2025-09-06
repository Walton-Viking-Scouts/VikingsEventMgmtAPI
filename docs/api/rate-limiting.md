# Rate Limiting

This document describes the sophisticated dual-layer rate limiting system implemented in the Vikings OSM Backend API.

## Overview

The API implements a comprehensive rate limiting system to protect both the backend infrastructure and the upstream OSM API from abuse while ensuring fair usage for all users. The system tracks usage per session and provides detailed monitoring and feedback.

## Rate Limiting Architecture

### 1. Backend Rate Limiting

Applied to all incoming requests to protect the backend infrastructure using express-rate-limit middleware.

**Limits:**
- **Per-minute**: 100 requests per session/IP
- **Window**: 60 seconds (sliding window)
- **Scope**: Per IP address or session identifier

**Implementation:**
- Uses in-memory store for development
- Session-based tracking with unique identifiers
- Automatic cleanup of expired rate limit data

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699123456
X-RateLimit-Window: 60
```

### 2. OSM API Rate Limiting

Tracks and respects the upstream OSM API rate limits to prevent account blocking and service disruption.

**OSM Limits:**
- **Per-hour**: 1000 requests per user (OSM enforced)
- **Tracking**: Per user session based on access token
- **Monitoring**: Real-time tracking of OSM API responses

**Features:**
- Proactive rate limit detection from OSM responses
- Automatic backoff when approaching limits
- Session-based tracking to prevent cross-user interference
- Rate limit information extraction from OSM headers

## Rate Limit Information

All API responses include comprehensive rate limit information in the `_rateLimitInfo` field:

```json
{
  "data": "...",
  "_rateLimitInfo": {
    "backend": {
      "remaining": 95,
      "limit": 100,
      "resetTime": 1699123456000,
      "window": "per minute"
    },
    "osm": {
      "limit": 1000,
      "remaining": 742,
      "resetTime": 1699126800000,
      "window": "per hour",
      "available": true,
      "rateLimited": false
    },
    "timestamp": 1699123400000
  }
}
```

**Field Descriptions:**
- `remaining`: Requests remaining in current window
- `limit`: Maximum requests allowed in window
- `resetTime`: Unix timestamp when limits reset
- `window`: Time window description
- `available`: Whether API is currently available
- `rateLimited`: Whether currently rate limited
- `timestamp`: Current server timestamp

## Rate Limit Responses

### 429 Too Many Requests (Backend)

When backend rate limits are exceeded:

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please wait before making more requests.",
  "retryAfter": 60,
  "_rateLimitInfo": {
    "backend": {
      "remaining": 0,
      "limit": 100,
      "resetTime": 1699123456000,
      "window": "per minute"
    }
  }
}
```

### 429 Too Many Requests (OSM API)

When OSM API rate limits are exceeded:

```json
{
  "error": "OSM API rate limit exceeded",
  "message": "Please wait before making more requests to OSM",
  "retryAfter": 3600,
  "_rateLimitInfo": {
    "osm": {
      "remaining": 0,
      "limit": 1000,
      "resetTime": 1699126800000,
      "window": "per hour",
      "rateLimited": true
    }
  }
}
```

## Monitoring Endpoint

### GET /rate-limit-status

Get current rate limit status for your session without consuming API quota.

**Headers:**
- `Authorization`: Bearer token (optional, but recommended for session-specific data)

**Response (200 OK):**
```json
{
  "backend": {
    "limit": 100,
    "remaining": 95,
    "resetTime": 1699123456000,
    "window": "per minute"
  },
  "osm": {
    "limit": 1000,
    "remaining": 742,
    "resetTime": 1699126800000,
    "window": "per hour",
    "available": true,
    "rateLimited": false
  },
  "timestamp": 1699123400000,
  "sessionId": "session_abc123"
}
```

## Implementation Details

### Session Tracking

The system uses sophisticated session tracking to ensure accurate rate limiting:

```javascript
// Session ID generation
const getSessionId = (req) => {
  // Priority order:
  // 1. Authorization header (for authenticated requests)
  // 2. Session cookie
  // 3. IP address fallback
  const authHeader = req.headers.authorization;
  if (authHeader) {
    return crypto.createHash('sha256')
      .update(authHeader)
      .digest('hex')
      .substring(0, 16);
  }
  
  return req.sessionID || req.ip;
};
```

### OSM Rate Limit Detection

The system proactively monitors OSM API responses for rate limit information:

```javascript
// Extract rate limit info from OSM responses
const extractOSMRateLimit = (response, sessionId) => {
  const remaining = parseInt(response.headers.get('x-ratelimit-remaining')) || null;
  const limit = parseInt(response.headers.get('x-ratelimit-limit')) || 1000;
  const reset = parseInt(response.headers.get('x-ratelimit-reset')) || null;
  
  return {
    limit,
    remaining: remaining !== null ? remaining : 'unknown',
    resetTime: reset ? reset * 1000 : Date.now() + 3600000,
    window: 'per hour',
    available: response.status !== 429,
    rateLimited: response.status === 429
  };
};
```

### Automatic Cleanup

The system includes automatic cleanup of expired rate limit data:

```javascript
// Cleanup expired rate limit data every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(sessionId);
    }
  }
}, 15 * 60 * 1000);
```

## Best Practices

### Client-Side Implementation

1. **Monitor Rate Limits**: Always check `_rateLimitInfo` in responses
2. **Implement Exponential Backoff**: Use exponential backoff when hitting limits
3. **Cache Static Data**: Reduce API calls by caching terms, sections, etc.
4. **Use Batch Operations**: Prefer batch endpoints for multiple updates
5. **Implement Circuit Breakers**: Stop making requests when consistently rate limited

### Example Client Implementation

```javascript
class RateLimitedAPIClient {
  constructor(baseURL, accessToken) {
    this.baseURL = baseURL;
    this.accessToken = accessToken;
    this.rateLimitInfo = null;
    this.backoffDelay = 1000; // Start with 1 second
    this.maxBackoffDelay = 60000; // Max 1 minute
  }

  async makeRequest(endpoint, options = {}) {
    // Check if we should throttle based on current rate limit info
    if (this.shouldThrottle()) {
      await this.waitForRateLimit();
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const data = await response.json();
      
      // Update rate limit info from response
      if (data._rateLimitInfo) {
        this.rateLimitInfo = data._rateLimitInfo;
      }

      if (response.status === 429) {
        // Handle rate limiting with exponential backoff
        await this.handleRateLimit(data);
        return this.makeRequest(endpoint, options); // Retry
      }

      // Reset backoff delay on successful request
      this.backoffDelay = 1000;
      return data;

    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  shouldThrottle() {
    if (!this.rateLimitInfo) return false;
    
    const { backend, osm } = this.rateLimitInfo;
    
    // Throttle if approaching limits
    return (
      backend.remaining < 5 || 
      osm.remaining < 10 || 
      osm.rateLimited
    );
  }

  async handleRateLimit(errorData) {
    const retryAfter = errorData.retryAfter || 60;
    const waitTime = Math.min(retryAfter * 1000, this.maxBackoffDelay);
    
    console.warn(`Rate limited. Waiting ${waitTime}ms before retry.`);
    await this.sleep(waitTime);
    
    // Exponential backoff for subsequent requests
    this.backoffDelay = Math.min(this.backoffDelay * 2, this.maxBackoffDelay);
  }

  async waitForRateLimit() {
    if (!this.rateLimitInfo) return;
    
    const { backend, osm } = this.rateLimitInfo;
    const now = Date.now();
    
    // Calculate wait times
    const backendWait = Math.max(0, backend.resetTime - now);
    const osmWait = Math.max(0, osm.resetTime - now);
    
    // Wait for the shorter of the two, but not more than 1 minute
    const waitTime = Math.min(
      Math.max(backendWait, osmWait), 
      60000
    );
    
    if (waitTime > 0) {
      console.log(`Proactive throttling: waiting ${waitTime}ms`);
      await this.sleep(waitTime);
    }
  }

  async checkRateLimit() {
    try {
      const response = await fetch(`${this.baseURL}/rate-limit-status`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.rateLimitInfo = {
          backend: data.backend,
          osm: data.osm,
          timestamp: data.timestamp
        };
        return data;
      }
    } catch (error) {
      console.warn('Failed to check rate limit status:', error);
    }
    return null;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get rate limit status without making a request
  getRateLimitStatus() {
    return this.rateLimitInfo;
  }

  // Check if API is currently available
  isAvailable() {
    if (!this.rateLimitInfo) return true;
    
    const { backend, osm } = this.rateLimitInfo;
    return backend.remaining > 0 && osm.available && !osm.rateLimited;
  }
}
```

### Caching Strategy

Implement intelligent caching to reduce API calls:

```javascript
class CachedAPIClient extends RateLimitedAPIClient {
  constructor(baseURL, accessToken) {
    super(baseURL, accessToken);
    this.cache = new Map();
    this.cacheExpiry = new Map();
  }

  async getCachedData(endpoint, cacheDuration = 300000) { // 5 minutes default
    const now = Date.now();
    const cached = this.cache.get(endpoint);
    const expiry = this.cacheExpiry.get(endpoint);

    // Return cached data if still valid
    if (cached && expiry && now < expiry) {
      console.log(`Cache hit for ${endpoint}`);
      return cached;
    }

    // Fetch fresh data
    const data = await this.makeRequest(endpoint);
    
    // Cache the data
    this.cache.set(endpoint, data);
    this.cacheExpiry.set(endpoint, now + cacheDuration);
    
    return data;
  }

  // Cache static data for longer periods
  async getTerms() {
    return this.getCachedData('/get-terms', 3600000); // 1 hour
  }

  async getSectionConfig() {
    return this.getCachedData('/get-section-config', 3600000); // 1 hour
  }

  async getUserRoles() {
    return this.getCachedData('/get-user-roles', 1800000); // 30 minutes
  }
}
```

## Rate Limit Bypass

Rate limits **cannot** be bypassed or increased. They are in place to:
- Protect the backend infrastructure from overload
- Prevent OSM account blocking due to excessive API usage
- Ensure fair usage for all users and applications
- Maintain service stability and reliability
- Comply with OSM's terms of service

## Troubleshooting

### High Rate Limit Usage

If you're hitting rate limits frequently:

1. **Audit API Usage**: Review your application's API call patterns
2. **Implement Caching**: Cache static data like terms, sections, user roles
3. **Use Batch Operations**: Prefer `/multi-update-flexi-record` over individual updates
4. **Optimize Polling**: Reduce frequency of status checks and real-time updates
5. **Implement Pagination**: Use pagination for large data sets
6. **Use Conditional Requests**: Check if data has changed before fetching

### Common Rate Limit Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Backend 429 | Too many requests per minute | Implement client-side throttling |
| OSM 429 | Exceeded OSM hourly limit | Wait for reset or reduce usage |
| Rapid 429s | No backoff strategy | Implement exponential backoff |
| Consistent limits | Inefficient usage pattern | Audit and optimize API calls |

### Monitoring and Alerting

Set up monitoring for rate limit usage:

```javascript
// Monitor rate limit usage
const monitorRateLimit = (rateLimitInfo) => {
  const { backend, osm } = rateLimitInfo;
  
  // Alert when approaching limits
  if (backend.remaining < 10) {
    console.warn(`Backend rate limit low: ${backend.remaining}/${backend.limit}`);
  }
  
  if (osm.remaining < 50) {
    console.warn(`OSM rate limit low: ${osm.remaining}/${osm.limit}`);
  }
  
  // Log usage patterns
  console.log(`Rate limit usage - Backend: ${100 - (backend.remaining / backend.limit * 100)}%, OSM: ${100 - (osm.remaining / osm.limit * 100)}%`);
};
```

## Future Enhancements

Potential improvements to the rate limiting system:

1. **Tiered Rate Limiting**: Different limits for different endpoint types
2. **Redis Backend**: Distributed rate limiting for multiple server instances
3. **Predictive Throttling**: Machine learning-based usage prediction
4. **User-Specific Limits**: Different limits based on user roles or subscription
5. **Rate Limit Queuing**: Queue requests when approaching limits

---

*Last updated: September 6, 2025*