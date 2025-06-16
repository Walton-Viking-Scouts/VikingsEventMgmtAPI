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
- `POST /get-terms` - Get terms
- `POST /get-section-config` - Get section configuration
- `POST /get-user-roles` - Get user roles
- `POST /get-events` - Get events
- `POST /get-event-attendance` - Get event attendance
- `GET /get-contact-details` - Get contact details
- `GET /get-list-of-members` - Get list of members
- `GET /get-flexi-records` - Get flexi records
- `GET /get-flexi-structure` - Get flexi record structure
- `GET /get-single-flexi-record` - Get single flexi record
- `POST /update-flexi-record` - Update flexi record

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

## Development

### Project Structure
```
/vikings-osm-backend/
├── __tests__/
│   ├── server.test.js        # Unit tests
│   └── integration.test.js   # Integration tests
├── .github/workflows/
│   └── ci.yml               # GitHub Actions workflow
├── server.js                # Main server file
├── package.json
├── jest.config.json
├── .env.example
├── .gitignore
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