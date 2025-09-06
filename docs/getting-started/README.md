# Quick Start Guide

Get the Vikings OSM Backend API running locally in under 5 minutes.

## Prerequisites

- **Node.js** 16.0.0 or higher
- **npm** (comes with Node.js)
- **OSM API Credentials** (OAuth Client ID and Secret)

## Quick Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd vikings-osm-backend
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# Required OAuth credentials
OAUTH_CLIENT_ID=your_osm_client_id
OAUTH_CLIENT_SECRET=your_osm_client_secret

# Server configuration
NODE_ENV=development
PORT=3000
BACKEND_URL=http://localhost:3000

# Optional monitoring
SENTRY_DSN=your_sentry_dsn_optional
```

### 3. Start the Server

```bash
# Development mode (auto-restart on changes)
npm run dev

# Production mode
npm start
```

### 4. Verify Installation

Open your browser and visit:

- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)
- **API Documentation**: [http://localhost:3000/backend-docs](http://localhost:3000/backend-docs)
- **Rate Limit Status**: [http://localhost:3000/rate-limit-status](http://localhost:3000/rate-limit-status)

## Next Steps

- **[Complete Installation Guide](./installation.md)** - Detailed setup instructions
- **[Configuration Guide](./configuration.md)** - All environment variables explained
- **[Development Setup](./development.md)** - Development tools and workflow
- **[API Reference](../api/osm-proxy.md)** - Available endpoints and usage

## Common Issues

### OAuth Credentials Not Found
```
❌ CRITICAL: OAuth credentials not found in environment variables!
```
**Solution**: Ensure `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` are set in your `.env` file.

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution**: Change the `PORT` in your `.env` file or stop the process using port 3000.

### Module Not Found
```
Error: Cannot find module 'express'
```
**Solution**: Run `npm install` to install dependencies.

## Testing Your Setup

Run the test suite to verify everything is working:

```bash
npm test
```

All tests should pass. If any tests fail, check the [Troubleshooting Guide](../operations/troubleshooting.md).

---

*Last updated: September 6, 2025*