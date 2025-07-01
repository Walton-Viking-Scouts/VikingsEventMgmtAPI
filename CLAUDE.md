# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
- `npm start` - Start production server
- `npm run dev` - Start development server with auto-restart via nodemon
- `npm run build` - No build step needed (returns echo message)

### Code Quality
- `npm run lint` - Run ESLint to check code style and catch errors

### Testing
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode for development
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:ci` - Run tests in CI mode (no watch, with coverage)

### Version Management
- `npm run version:patch` - Bump patch version, commit, and push with tags
- `npm run version:minor` - Bump minor version, commit, and push with tags
- `npm run version:major` - Bump major version, commit, and push with tags
- `npm run release:patch` - Run tests, then bump patch version
- `npm run release:minor` - Run tests, then bump minor version
- `npm run release:major` - Run tests, then bump major version

Test configuration uses Jest with Node.js environment, 15-second timeout, and single worker to prevent port conflicts.

## Architecture Overview

This is a Node.js Express backend that serves as an OAuth proxy for Online Scout Manager (OSM) API integration.

### Core Components

**Main Server** (`server.js`):
- Express app with CORS configuration for multiple frontend domains
- OAuth callback handling with dynamic frontend URL detection based on state parameter
- Sentry integration for error monitoring
- Rate limiting middleware applied to all routes

**Controllers**:
- `controllers/auth.js` - OAuth token management, logout functionality
- `controllers/osm.js` - OSM API proxy endpoints with rate limiting and error handling

**Middleware**:
- `middleware/rateLimiting.js` - Dual-layer rate limiting (backend + OSM API tracking)

**Configuration**:
- `config/sentry.js` - Sentry error monitoring and structured logging setup

### Rate Limiting Architecture

The application implements a sophisticated dual-layer rate limiting system:

1. **Backend Rate Limiting**: 100 requests per minute per user/IP
2. **OSM API Rate Limiting**: Tracks and respects OSM's rate limits per user session

Rate limit information is automatically included in all API responses under `_rateLimitInfo` field.

### OAuth Flow

OAuth authentication supports dynamic frontend URL detection with multiple fallback mechanisms:

**Frontend URL Detection Priority:**
1. `frontend_url` query parameter (highest priority)
2. Embedded URL in state parameter: `state=prod&frontend_url=https://pr-123-vikings-eventmgmt.onrender.com`
3. Referer header detection for `.onrender.com` domains
4. Legacy state-based detection:
   - `state=dev` or `state=development` → `https://localhost:3000`
   - `state=prod` or `state=production` → production frontend
5. Default: `https://vikings-eventmgmt.onrender.com`

This supports PR preview URLs and dynamic environments while maintaining backward compatibility.

Tokens are stored in-memory (Map) with expiration tracking.

### API Endpoints Structure

**Authentication**: `/token`, `/logout`, `/oauth/callback`, `/oauth/debug`
**OSM Proxy**: All use Authorization header with Bearer token
- GET endpoints: `/get-terms`, `/get-section-config`, `/get-user-roles`, `/get-events`, `/get-flexi-records`, `/get-single-flexi-record`, `/get-flexi-structure`, `/get-startup-data`
- POST endpoint: `/update-flexi-record` (with enhanced validation and Sentry logging)
**Utility**: `/rate-limit-status`

### Environment Variables Required

```env
OAUTH_CLIENT_ID=your_osm_client_id
OAUTH_CLIENT_SECRET=your_osm_client_secret
NODE_ENV=development|production|test
PORT=3000
SENTRY_DSN=optional_sentry_dsn
BACKEND_URL=backend_base_url
```

### Testing Approach

Tests are located in `__tests__/` directory:
- `server.test.js` - Unit tests
- `integration.test.js` - Integration tests

Jest configuration prevents port conflicts with single worker and handles async cleanup properly.

### Sentry Structured Logging

The application implements comprehensive structured logging using Sentry:

**Configuration Features:**
- Structured logging enabled with `_experiments: { enableLogs: true }`
- Console logging integration automatically captures console.log/error/warn
- Error monitoring with OSM-specific context and rate limit information
- Performance profiling in production environments

**Logging Patterns:**
- Import: `const Sentry = require('../config/sentry'); const { logger } = Sentry;`
- Structured context: All logs include `endpoint`, `sessionId`, and relevant parameters
- Log levels: `logger.info()`, `logger.error()`, `logger.warn()`, `logger.debug()`
- Template literals: Use `logger.fmt` for dynamic values in log messages

**Enhanced updateFlexiRecord Logging:**
- Request validation with parameter logging
- OSM API request/response tracking
- Rate limit monitoring and warnings
- Error context with full stack traces
- Success confirmation with operation details

### Key Implementation Notes

- All OSM proxy endpoints extract access tokens from Authorization headers
- Rate limiting headers are automatically added to responses
- Error responses include rate limit information when applicable
- OSM API responses are wrapped with rate limit info before sending to frontend
- Enhanced validation for flexi record updates with field ID format checking
- Comprehensive Sentry logging for debugging and monitoring
- Graceful shutdown handling with SIGTERM