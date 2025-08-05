# Future Enhancement Ideas

## Tiered Rate Limiting by Endpoint Type

**Issue**: Currently all endpoints share the same rate limits (5/sec, 100/min, 900/hour), but different endpoint types have different resource requirements and risk profiles.

**Proposed Enhancement**:
Implement tiered rate limiting with different limits based on endpoint categories:

### Tier 1: High-Frequency Endpoints (Health, Status, etc.)
- **Per-second**: 50 requests
- **Per-minute**: 500 requests  
- **Per-hour**: 3000 requests
- **Endpoints**: `/health`, `/rate-limit-status`, `/oauth/debug`

### Tier 2: Authentication Endpoints
- **Per-second**: 10 requests
- **Per-minute**: 60 requests
- **Per-hour**: 300 requests  
- **Endpoints**: `/token`, `/logout`, `/oauth/callback`

### Tier 3: OSM API Proxy Endpoints (Current Limits)
- **Per-second**: 5 requests
- **Per-minute**: 100 requests
- **Per-hour**: 900 requests (stays under OSM's 1000/hour limit)
- **Endpoints**: `/get-*`, `/update-*`

### Tier 4: Admin/Maintenance Endpoints
- **Per-second**: 2 requests
- **Per-minute**: 20 requests
- **Per-hour**: 100 requests
- **Endpoints**: `/admin/*`, `/test-*`

### Implementation Approach:
1. Create multiple rate limit middleware instances with different configs
2. Apply appropriate middleware to route groups
3. Update rate limit headers to show tier-specific limits
4. Maintain backward compatibility with existing headers

### Benefits:
- **Better UX**: Health checks and authentication won't hit limits as easily
- **Better Protection**: OSM API limits remain strict to prevent account blocking
- **Scalability**: System can handle legitimate high-frequency monitoring
- **Security**: Admin endpoints get extra protection

### Priority: Medium
This is a nice-to-have improvement that would optimize the user experience while maintaining security. The current single-tier approach works well for MVP.