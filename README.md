# OSM Tracker

OSM Event Management Tracker - A web application for managing Online Scout Manager events and attendance.

## Features

- OAuth authentication with OSM
- Section and event selection
- Attendance tracking with filtering
- Export capabilities

## Development

```bash
# Install dependencies
npm install

# Start development server
npm start
```

# Vikings OSM Backend

Backend API for Vikings OSM Event Manager with rate limiting and OAuth integration.

## Features

- ✅ OAuth integration with OnlineScoutManager (OSM)
- ✅ Rate limiting (backend + OSM API monitoring)
- ✅ CORS support for multiple domains
- ✅ Comprehensive test suite
- ✅ Environment variable configuration
- ✅ Automated CI/CD with GitHub Actions
- ✅ Sentry structured logging and error monitoring
- ✅ Enhanced flexi record management with validation
- ✅ Camp groups sign-in/out functionality

## Setup

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd vikings-osm-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   OAUTH_CLIENT_ID=your_osm_client_id
   OAUTH_CLIENT_SECRET=your_osm_client_secret
   NODE_ENV=development
   PORT=3000
   SENTRY_DSN=your_sentry_dsn_optional
   BACKEND_URL=http://localhost:3000
   ```

4. **Run the server**
   ```bash
   npm run dev  # Development with auto-restart
   npm start    # Production
   ```

### GitHub Actions Setup

For CI/CD to work properly, add these secrets to your GitHub repository:

1. **Go to your GitHub repository**
2. **Settings → Secrets and variables → Actions**
3. **Add these repository secrets:**
   - `OAUTH_CLIENT_ID` = `your_osm_client_id`
   - `OAUTH_CLIENT_SECRET` = `your_osm_client_secret`

### Deployment (Render)

Set these environment variables in your Render service:
- `OAUTH_CLIENT_ID` = `your_osm_client_id`
- `OAUTH_CLIENT_SECRET` = `your_osm_client_secret`
- `NODE_ENV` = `production`

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode for development
npm run test:coverage # With coverage report
npm run test:ci       # CI mode (no watch, with coverage)
```

## API Endpoints

### Authentication
- `POST /callback` - OAuth callback
- `GET /token` - Get current token
- `POST /logout` - Logout

### Rate Limiting
- `GET /rate-limit-status` - Get current rate limit status

### OSM API Proxy
- `GET /get-terms` - Get terms
- `GET /get-section-config` - Get section configuration  
- `GET /get-user-roles` - Get user roles
- `GET /get-events` - Get events
- `GET /get-event-attendance` - Get event attendance
- `GET /get-event-sharing-status` - Get event sharing status across sections
- `GET /get-shared-event-attendance` - Get combined attendance for shared events
- `GET /get-contact-details` - Get contact details
- `GET /get-list-of-members` - Get list of members
- `GET /get-flexi-records` - Get flexi records
- `GET /get-flexi-structure` - Get flexi record structure
- `GET /get-single-flexi-record` - Get single flexi record
- `GET /get-startup-data` - Get user startup data
- `POST /update-flexi-record` - Update flexi record (with enhanced validation)
- `POST /multi-update-flexi-record` - Batch update same field for multiple members

## Rate Limiting

The API implements two layers of rate limiting:

1. **Backend Rate Limiting**: 100 requests per minute per user/IP
2. **OSM API Rate Limiting**: Respects OSM's rate limits (tracked per user)

Rate limit information is included in all API responses:

```json
{
  "data": "...",
  "_rateLimitInfo": {
    "backend": {
      "remaining": 95,
      "limit": 100
    },
    "osm": {
      "limit": 500,
      "remaining": 450,
      "resetTime": 1699123456000,
      "rateLimited": false
    }
  }
}
```

## Sentry Logging

The application includes comprehensive structured logging using Sentry:

### Configuration
- **Structured Logging**: Enabled with `_experiments: { enableLogs: true }`
- **Console Integration**: Automatically captures console.log/error/warn
- **Error Monitoring**: OSM-specific context and rate limit information
- **Performance Profiling**: Enabled in production environments

### Usage
```javascript
const Sentry = require('./config/sentry');
const { logger } = Sentry;

logger.info('Operation completed', { endpoint: '/api/endpoint', userId: '123' });
logger.error('API error', { error: err.message, stack: err.stack });
logger.warn('Rate limit warning', { remaining: 10, limit: 100 });
```

### Enhanced updateFlexiRecord Logging
- Request validation with parameter logging
- OSM API request/response tracking  
- Rate limit monitoring and warnings
- Error context with full stack traces
- Success confirmation with operation details

## Development

### Project Structure
```
/vikings-osm-backend/
├── __tests__/
│   ├── server.test.js        # Unit tests
│   └── integration.test.js   # Integration tests
├── .github/workflows/
│   └── ci.yml               # GitHub Actions workflow
├── config/
│   └── sentry.js            # Sentry configuration with structured logging
├── controllers/
│   ├── auth.js              # OAuth authentication endpoints
│   └── osm.js               # OSM API proxy with enhanced logging
├── middleware/
│   └── rateLimiting.js      # Dual-layer rate limiting
├── server.js                # Main server file
├── package.json
├── jest.config.json
├── .env.example
├── .gitignore
├── CLAUDE.md                # Development guidance
└── README.md
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Commit and push
6. Create a Pull Request

## License

MIT