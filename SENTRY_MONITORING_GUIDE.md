# Comprehensive Sentry Monitoring Guide

## 🎯 Overview

This document outlines all the Sentry monitoring and logging implemented in the Vikings OSM Backend for comprehensive observability, performance tracking, and error detection.

## 🔧 Current Sentry Configuration

### **Base Configuration** (`config/sentry.js`)
- ✅ **HTTP Tracing**: Automatic HTTP request/response tracking
- ✅ **Express Integration**: Automatic Express.js middleware integration
- ✅ **Profiling**: CPU and memory profiling (10% sample rate in production)
- ✅ **Console Integration**: Automatic console.log/error/warn capture
- ✅ **Structured Logging**: Enhanced log context and metadata

### **Environment Settings**
- **Development**: 100% trace sample rate for complete visibility
- **Production**: 10% trace sample rate for performance optimization
- **Environment Variable**: `SENTRY_DSN` required for activation

---

## 📊 **1. OAuth Flow Monitoring** (Future Enhancement)

### **OAuth Callback Comprehensive Tracking**
**Transaction**: `oauth-callback`
**Operation**: `oauth.callback`

#### **Planned Tracked Events**:
- 🔍 **OAuth callback received** - Initial request logging
- 🌐 **Frontend URL detection** - URL detection method and result
- ❌ **OAuth errors from OSM** - External service errors
- 🚫 **Missing authorization code** - Invalid callback handling
- 🔄 **Token exchange attempts** - Retry logic and failures
- ✅ **Successful OAuth completion** - Success metrics and performance

---

## 🔐 **2. Token Lifecycle Monitoring**

### **Token Validation with Comprehensive Logging**
**Function**: `validateTokenFromHeader` in `controllers/auth.js`

#### **Tracked Events**:
- 🔍 **Token validation attempts** - All validation attempts with context
- ❌ **Missing Authorization header** - Unauthenticated access attempts
- 🚫 **Malformed Authorization header** - Invalid header format detection
- 🔑 **Empty token detection** - Empty Bearer token handling
- 🚨 **Token not found** - Invalid or expired sessions
- 🔄 **Token mismatch** - Security violation detection
- ⏰ **Token expiration** - Automatic cleanup of expired tokens
- ✅ **Successful validation** - Valid token access tracking

#### **Structured Logging Fields**:
- `sessionId` - Session identifier (truncated for security)
- `endpoint` - Requested API endpoint
- `method` - HTTP method
- `userAgent` - Client identification
- `errorType` - Categorized error type
- `tokenLength` - Token length validation
- `timeToExpiry` - Remaining token lifetime

---

## 🌐 **3. API Performance Monitoring**

### **Comprehensive API Tracking**
**Middleware**: `apiMonitoringMiddleware`
**Applied to**: All API endpoints

#### **Tracked Metrics**:
- 📊 **Request/Response cycle** - Complete HTTP transaction tracking
- ⏱️ **Response times** - Performance monitoring for all endpoints
- 📈 **Status codes** - Error rate tracking
- 📝 **Request metadata** - Method, path, user agent, content type
- 📦 **Response size** - Payload size monitoring

#### **Performance Alerts**:
- **Slow responses** - Alert for requests >5 seconds
- **Error responses** - 4xx/5xx error tracking
- **High memory usage** - Alert if >200MB heap usage
- **High token count** - Alert if >50 active tokens

#### **Error Categorization**:
- **4xx errors** - Client errors (warning level)
- **5xx errors** - Server errors (error level)
- **Response time degradation** - Performance warnings

---

## 🏥 **4. Health Monitoring**

### **System Health Tracking**
**Endpoint**: `/health`
**Purpose**: Continuous system monitoring

#### **Tracked Metrics**:
- 💾 **Memory usage** - Heap usage and allocation
- ⏰ **System uptime** - Application availability
- 🔢 **Token statistics** - Active, expired, total counts
- ⚙️ **Configuration status** - Environment variable validation
- 🔍 **Sentry integration status** - Monitoring system health

#### **Health Alerts**:
- **High memory usage** - >200MB heap usage
- **High token count** - >50 total tokens
- **Configuration issues** - Missing environment variables

---

## 📋 **5. Sentry Tags and Organization**

### **Standardized Tagging System**

#### **Section Tags**:
- `section: oauth` - OAuth flow events
- `section: token-validation` - Token validation events
- `section: api` - API performance events
- `section: health` - System health events
- `section: performance` - Performance monitoring

#### **Error Type Tags**:
- `error_type: missing_header` - Authorization header missing
- `error_type: malformed_header` - Invalid header format
- `error_type: empty_token` - Empty Bearer token
- `error_type: token_not_found` - Invalid session/token
- `error_type: token_mismatch` - Security violation
- `error_type: token_expired` - Token expiration
- `error_type: http_error` - HTTP response errors

#### **Alert Type Tags**:
- `alert_type: slow_response` - Performance degradation
- `alert_type: high_memory` - Memory usage warnings
- `alert_type: high_token_count` - Token count warnings

---

## 🚨 **6. Alerting Strategy**

### **Critical Alerts** (Immediate Response)
- **Authentication bypass attempts** - Security violations
- **System errors** - Any 5xx errors
- **Memory exhaustion** - >90% heap usage
- **Token validation failures** - High failure rates

### **Warning Alerts** (Monitor Closely)
- **Slow performance** - >3 second average response time
- **High token count** - >50 active tokens
- **High memory usage** - >200MB heap usage
- **Authentication anomalies** - Unusual access patterns

### **Info Alerts** (Trend Monitoring)
- **Token lifecycle statistics** - Daily validation summaries
- **API usage patterns** - Endpoint popularity trends
- **System health reports** - Daily health summaries

---

## 🔧 **7. Implementation Status**

### **✅ Implemented**:
1. **API Performance Monitoring** - Complete middleware with response time tracking
2. **System Health Monitoring** - Enhanced `/health` endpoint with alerts
3. **Token Validation Logging** - Comprehensive `validateTokenFromHeader` function
4. **Structured Error Tracking** - Categorized tags and error types
5. **Memory Usage Alerts** - Automatic high usage detection
6. **Sentry Integration** - Full breadcrumb and transaction tracking

### **🔄 Future Enhancements**:
1. **OAuth Flow Monitoring** - Enhanced callback tracking
2. **Custom Dashboards** - Sentry dashboard configuration
3. **Alert Channel Integration** - Slack/Email notifications
4. **Performance Baselines** - Historical trend analysis

---

## 📊 **8. Usage Examples**

### **Monitoring Token Validation**:
```javascript
// Example log output for successful validation
{
  sessionId: "abc123...",
  endpoint: "/get-events",
  method: "GET",
  tokenType: "Bearer",
  timeToExpiry: 3456,
  section: "token-validation"
}
```

### **Monitoring API Performance**:
```javascript
// Example Sentry breadcrumb for slow response
{
  category: "api",
  message: "API response: 200 in 6200ms",
  level: "warning",
  data: {
    statusCode: 200,
    duration: 6200,
    method: "GET",
    path: "/get-members"
  }
}
```

### **Health Monitoring Alerts**:
```javascript
// Example high memory usage alert
{
  level: "warning",
  tags: {
    section: "health",
    alert_type: "high_memory"
  },
  extra: {
    memoryUsageMB: 250,
    tokenCount: 42,
    uptime: 86400
  }
}
```

---

## 🎯 **Next Steps**

### **Immediate** (Deploy these changes):
1. Deploy comprehensive monitoring code
2. Configure Sentry alerts in dashboard
3. Test token validation monitoring
4. Validate health endpoint alerts

### **Short Term** (Next 2 weeks):
1. Set up custom Sentry dashboards
2. Configure alert channels
3. Establish monitoring procedures
4. Optimize alerting thresholds

### **Long Term** (Next month):
1. Analyze monitoring data trends
2. Implement OAuth flow monitoring
3. Add custom performance metrics
4. Establish performance baselines

---

**Status**: ✅ **Core monitoring implemented**  
**Coverage**: Token Validation, API Performance, System Health  
**Security**: Authentication monitoring and validation tracking  
**Next Action**: Deploy and configure Sentry dashboard alerts