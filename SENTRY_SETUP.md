# Sentry Setup Guide

## 1. Create Sentry Account

1. Go to [https://sentry.io/](https://sentry.io/)
2. Sign up for a free account
3. Create a new project
4. Select **Node.js** as the platform
5. Copy your DSN (looks like: `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx`)

## 2. Environment Configuration

### Local Development (.env file)
```env
SENTRY_DSN=https://your-dsn@sentry.ingest.sentry.io/project-id
NODE_ENV=development
```

### Render (Environment Variables)
Add this environment variable in your Render service:
- `SENTRY_DSN` = `https://your-dsn@sentry.ingest.sentry.io/project-id`

### GitHub Actions (Repository Secrets)
Add this repository secret:
- `SENTRY_DSN` = `https://your-dsn@sentry.ingest.sentry.io/project-id`

## 3. What Sentry Monitors

✅ **Automatic Error Tracking**:
- Unhandled exceptions
- HTTP 4xx and 5xx errors
- OSM API failures with context

✅ **Performance Monitoring**:
- Request tracing
- Database queries
- External API calls

✅ **Custom Context**:
- Rate limit information
- OSM API endpoint details
- User session data

## 4. Sentry Features Enabled

- **Request/Response tracking**
- **Performance profiling** (10% in production, 100% in development)
- **Custom error context** for OSM API errors
- **Automatic release tracking**

## 5. Testing Sentry

To test if Sentry is working, you can trigger an error:

```bash
curl -X POST http://localhost:3000/test-error
```

This will send an error to Sentry for testing purposes.

## 6. Sentry Dashboard

Once configured, you'll see:
- Real-time error alerts
- Performance metrics
- User impact analysis
- Error trends and patterns

## 7. Optional: Add Sentry Test Endpoint

Add this to your server.js for testing:

```javascript
// Test endpoint for Sentry (development only)
if (process.env.NODE_ENV === 'development') {
    app.get('/test-error', (req, res) => {
        throw new Error('Test error for Sentry');
    });
}
```