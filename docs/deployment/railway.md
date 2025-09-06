# Railway Deployment Guide

This guide covers deploying the Vikings OSM Backend API to Railway, including auto-deployment setup and production configuration.

## Overview

The Vikings OSM Backend uses **auto-deployment** on Railway, meaning code merged to the `main` branch automatically deploys to production. This requires careful version management and testing.

## Railway Setup

### 1. Initial Deployment

#### Create Railway Project

1. **Sign up/Login**: Go to [railway.app](https://railway.app) and sign in with GitHub
2. **New Project**: Click "New Project" → "Deploy from GitHub repo"
3. **Select Repository**: Choose your Vikings OSM Backend repository
4. **Configure Service**: Railway will automatically detect it's a Node.js project

#### Basic Configuration

Railway will automatically:
- Detect `package.json` and install dependencies
- Use `npm start` as the start command
- Assign a public domain (e.g., `your-app.up.railway.app`)

### 2. Environment Variables

Configure environment variables in Railway dashboard:

#### Required Variables
```env
OAUTH_CLIENT_ID=your_production_osm_client_id
OAUTH_CLIENT_SECRET=your_production_osm_client_secret
NODE_ENV=production
```

#### Recommended Variables
```env
BACKEND_URL=https://your-app.up.railway.app
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

#### Setting Variables in Railway

1. **Go to Project**: Open your Railway project dashboard
2. **Select Service**: Click on your backend service
3. **Variables Tab**: Click "Variables" in the sidebar
4. **Add Variables**: Click "New Variable" for each environment variable

### 3. Custom Domain (Optional)

#### Configure Custom Domain

1. **Domains Tab**: In Railway dashboard, go to "Settings" → "Domains"
2. **Add Domain**: Click "Custom Domain" and enter your domain
3. **DNS Configuration**: Update your DNS to point to Railway
4. **SSL Certificate**: Railway automatically provisions SSL certificates

#### Update Environment Variables

```env
BACKEND_URL=https://your-custom-domain.com
```

## Auto-Deployment Workflow

### Standard Development Process

```bash
# 1. Feature Development (in PR)
git checkout -b feature/my-feature
# ... develop and test ...
npm run lint && npm test && npm run build  # Verify before PR

# 2. Version Management (BEFORE merge)
# Update version in PR if this will be a new release
npm run version:patch  # Updates package.json only (--no-git-tag-version)
git add package.json package-lock.json
git commit -m "chore: bump version to v1.x.x for production deployment"

# 3. PR Review & Merge
# Create PR → Review → Merge to main
# ⚠️ Auto-deployment triggers immediately after merge

# 4. Post-Merge Release Finalization (LOCAL SYNC)
git checkout main && git pull origin main  # Sync with merged changes
git tag -a v1.x.x -m "Release v1.x.x: Description of changes"
git push origin v1.x.x
npm run release:finalize  # Finalize Sentry release
```

### Production Issue Resolution

When fixing critical production errors:

```bash
# 1. Create Hotfix Branch
git checkout -b feature/hotfix-critical-issue

# 2. Implement Fix with Enhanced Logging
# Add structured logging and error context
# Include Sentry integration for monitoring

# 3. Update Version BEFORE Merge (Critical!)
npm run version:patch
git add package.json package-lock.json  
git commit -m "chore: bump to v1.x.x for critical production fix"

# 4. PR with Detailed Context
# Include Sentry issue IDs and error descriptions
# Reference production monitoring and logs

# 5. Post-Merge: Align Local & Create Release Tag
git checkout main && git pull origin main
git tag -a v1.x.x -m "Release v1.x.x: Critical fixes for [issue description]"
git push origin v1.x.x
npm run release:finalize
```

## Deployment Configuration

### Railway Configuration File

Create `railway.json` in project root:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Package.json Configuration

Ensure your `package.json` has the correct scripts:

```json
{
  "scripts": {
    "start": "node server.js",
    "build": "echo 'No build step needed'",
    "install:prod": "npm install --omit=dev"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
```

## Monitoring and Logging

### Railway Logs

Access logs in Railway dashboard:

1. **Deployments Tab**: View deployment history and logs
2. **Logs Tab**: Real-time application logs
3. **Metrics Tab**: CPU, memory, and network usage

### Sentry Integration

Configure Sentry for production monitoring:

```env
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

**Sentry Features:**
- Error tracking and alerting
- Performance monitoring
- Structured logging with context
- Release tracking

### Health Monitoring

The application includes a health endpoint for monitoring:

```bash
curl https://your-app.up.railway.app/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-06T19:45:00.000Z",
  "uptime": "3600 seconds",
  "environment": "production",
  "configuration": {
    "backendUrl": "https://your-app.up.railway.app",
    "oauthConfigured": true,
    "sentryConfigured": true
  }
}
```

## Performance Optimization

### Railway Performance Settings

#### Resource Allocation

Railway automatically scales based on usage, but you can configure:

1. **Memory Limit**: Set in Railway dashboard under "Settings"
2. **CPU Allocation**: Automatically managed by Railway
3. **Disk Space**: Ephemeral storage, automatically managed

#### Optimization Tips

```javascript
// Enable compression
app.use(compression());

// Set appropriate cache headers
app.use((req, res, next) => {
  if (req.path.includes('/static/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
  next();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
```

### Database Considerations

If you add a database:

1. **Railway PostgreSQL**: Add PostgreSQL service in Railway
2. **Connection Pooling**: Use connection pooling for better performance
3. **Environment Variables**: Railway automatically provides database URLs

## Security Configuration

### Environment Security

```env
# Production security settings
NODE_ENV=production
BACKEND_URL=https://your-secure-domain.com
```

### CORS Configuration

The application automatically configures CORS for production:

```javascript
const allowedOrigins = [
  'https://vikings-eventmgmt.onrender.com',
  'https://vikingeventmgmt.onrender.com',
  // PR preview pattern
  /^https:\/\/vikingeventmgmt-pr-\d+\.onrender\.com$/
];
```

### Security Headers

Consider adding security headers:

```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

## Troubleshooting

### Common Deployment Issues

#### Build Failures

**Issue**: Deployment fails during build
**Solution**:
```bash
# Check package.json scripts
npm run build  # Should not fail locally

# Verify Node.js version
node --version  # Should be >= 16.0.0

# Check for missing dependencies
npm install
```

#### Environment Variable Issues

**Issue**: Application fails to start due to missing environment variables
**Solution**:
1. Check Railway dashboard → Variables tab
2. Ensure all required variables are set
3. Verify variable names match exactly (case-sensitive)

#### OAuth Redirect Issues

**Issue**: OAuth callback fails with redirect URI mismatch
**Solution**:
1. Update `BACKEND_URL` to match Railway domain
2. Update OSM OAuth application settings
3. Ensure exact URL match including protocol

#### Memory Issues

**Issue**: Application crashes due to memory limits
**Solution**:
1. Monitor memory usage in Railway metrics
2. Optimize application memory usage
3. Consider upgrading Railway plan

### Debugging Production Issues

#### Access Logs

```bash
# Railway CLI (install first: npm install -g @railway/cli)
railway login
railway logs

# Or use Railway dashboard logs tab
```

#### Health Check Debugging

```bash
# Check application health
curl https://your-app.up.railway.app/health

# Check specific endpoints
curl https://your-app.up.railway.app/rate-limit-status
```

#### Sentry Error Tracking

1. **Check Sentry Dashboard**: Review error reports and performance
2. **Error Context**: Sentry provides full error context and stack traces
3. **Performance Monitoring**: Track slow requests and bottlenecks

## Rollback Strategy

### Quick Rollback

If deployment fails:

1. **Railway Dashboard**: Go to "Deployments" tab
2. **Previous Deployment**: Click on a previous successful deployment
3. **Redeploy**: Click "Redeploy" to rollback

### Git-based Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main  # Triggers new deployment

# Or reset to specific commit
git reset --hard <previous-commit-hash>
git push --force origin main  # Use with caution
```

## Scaling Considerations

### Horizontal Scaling

Railway supports horizontal scaling:

1. **Multiple Instances**: Railway can run multiple instances
2. **Load Balancing**: Automatic load balancing between instances
3. **Session Affinity**: Consider session storage for multi-instance deployments

### Vertical Scaling

Railway automatically scales resources based on usage:

1. **Memory**: Automatically allocated based on usage
2. **CPU**: Scales with demand
3. **Network**: Unlimited bandwidth on paid plans

## Cost Optimization

### Railway Pricing

- **Hobby Plan**: $5/month with usage-based pricing
- **Pro Plan**: $20/month with higher limits
- **Team Plan**: Custom pricing for teams

### Cost Optimization Tips

1. **Efficient Code**: Optimize application performance
2. **Resource Monitoring**: Monitor usage in Railway dashboard
3. **Graceful Shutdown**: Implement proper shutdown handling
4. **Caching**: Implement caching to reduce CPU usage

## Backup and Recovery

### Code Backup

- **Git Repository**: Primary backup via Git
- **Railway Deployments**: Railway keeps deployment history
- **Release Tags**: Use Git tags for version tracking

### Data Backup

If using databases:

1. **Railway Backups**: Railway provides automatic database backups
2. **Manual Backups**: Regular manual backups for critical data
3. **Backup Testing**: Regularly test backup restoration

## Next Steps

After successful deployment:

1. **[Monitoring Setup](./monitoring.md)** - Configure comprehensive monitoring
2. **[CI/CD Pipeline](./cicd.md)** - Set up automated testing and deployment
3. **[Performance Optimization](../operations/performance.md)** - Optimize for production
4. **[Troubleshooting Guide](../operations/troubleshooting.md)** - Handle production issues

---

*Last updated: September 6, 2025*