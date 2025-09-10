# Development Setup

This guide covers setting up a complete development environment for the Vikings OSM Backend API.

## Prerequisites

### Required Software

- **Node.js**: 16.0.0 or higher (18.x LTS recommended)
- **npm**: 7.0.0 or higher (comes with Node.js)
- **Git**: For version control
- **Code Editor**: VS Code recommended with extensions

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-json",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.vscode-jest"
  ]
}
```

## Initial Setup

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd vikings-osm-backend
```

### 2. Install Dependencies

```bash
# Install all dependencies (including dev dependencies)
npm install

# Or install only production dependencies
npm install --omit=dev
```

### 3. Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Development Configuration
NODE_ENV=development
PORT=3000
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001

# OSM OAuth Credentials (obtain from OSM)
OAUTH_CLIENT_ID=your_dev_client_id
OAUTH_CLIENT_SECRET=your_dev_client_secret

# Optional: Sentry for error monitoring
SENTRY_DSN=your_sentry_dsn_optional
```

### 4. Verify Installation

```bash
# Run tests to verify everything works
npm test

# Start development server
npm run dev
```

## Development Workflow

### Starting the Development Server

```bash
# Start with auto-restart on file changes
npm run dev

# Or start without auto-restart
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

### Available Endpoints

Once running, you can access:

- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)
- **API Documentation**: [http://localhost:3000/backend-docs](http://localhost:3000/backend-docs)
- **Rate Limit Status**: [http://localhost:3000/rate-limit-status](http://localhost:3000/rate-limit-status)
- **OAuth Debug**: [http://localhost:3000/oauth/debug](http://localhost:3000/oauth/debug)

### Development Scripts

```bash
# Development server with auto-restart
npm run dev

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Version management
npm run version:patch
npm run version:minor
npm run version:major
```

## Code Structure

### Project Organization

```
/vikings-osm-backend/
├── __tests__/              # Test files
│   ├── server.test.js      # Main test suite
│   └── integration.test.js # Integration tests
├── config/                 # Configuration files
│   └── sentry.js          # Sentry configuration
├── controllers/            # Route controllers
│   ├── auth.js            # Authentication endpoints
│   ├── osm.js             # OSM proxy endpoints
│   └── osm-legacy.js      # Legacy complex functions
├── docs/                   # Documentation
├── middleware/             # Express middleware
│   └── rateLimiting.js    # Rate limiting middleware
├── utils/                  # Utility functions
│   ├── osmApiHandler.js   # Generic OSM API handler
│   ├── validators.js      # Validation functions
│   ├── responseHelpers.js # Response utilities
│   ├── osmEndpointFactories.js # Endpoint factories
│   └── serverHelpers.js   # Server utilities
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── jest.config.json       # Jest configuration
├── eslint.config.js       # ESLint configuration
└── .env                   # Environment variables
```

### Code Patterns

#### Endpoint Factory Pattern

New endpoints can be created using the factory pattern:

```javascript
// Simple GET endpoint
const getTerms = osmEndpoints.getTerms();

// POST endpoint with validation
const updateFlexiRecord = createOSMApiHandler('updateFlexiRecord', {
  method: 'POST',
  requiredParams: ['section_id', 'term_id', 'scout_id', 'field_id', 'value'],
  processResponse: (data) => ({
    success: true,
    message: 'Flexi record updated successfully',
    ...data
  })
});
```

#### Error Handling Pattern

```javascript
try {
  const result = await someOperation();
  sendOSMResponse(res, result, sessionId);
} catch (error) {
  logger.error('Operation failed', { 
    error: error.message, 
    stack: error.stack,
    sessionId 
  });
  sendErrorResponse(res, 'Internal server error', 500, { sessionId });
}
```

#### Validation Pattern

```javascript
const validation = validateRequiredParams(req, ['section_id', 'term_id']);
if (!validation.valid) {
  return sendValidationError(res, validation.error, { sessionId });
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests in CI mode
npm run test:ci
```

### Test Structure

The test suite includes:

- **Unit Tests**: Individual function testing
- **Integration Tests**: Full request/response testing
- **Error Handling Tests**: Error scenario validation
- **Rate Limiting Tests**: Rate limit functionality
- **Authentication Tests**: OAuth flow testing

### Writing Tests

Example test structure:

```javascript
describe('GET /get-events', () => {
  it('should return events with valid token', async () => {
    const response = await request(app)
      .get('/get-events?section_id=123&term_id=456')
      .set('Authorization', 'Bearer valid_token');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('_rateLimitInfo');
  });
  
  it('should return 401 without token', async () => {
    const response = await request(app)
      .get('/get-events?section_id=123&term_id=456');
    
    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Access token is required');
  });
});
```

## Debugging

### Debug Configuration

VS Code debug configuration (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/server.js",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "runtimeExecutable": "nodemon",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Run Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "env": {
        "NODE_ENV": "test"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

### Logging

The application uses structured logging with Sentry integration:

```javascript
const { logger } = require('./config/sentry');

// Log levels
logger.info('Operation completed', { userId: '123', operation: 'update' });
logger.warn('Rate limit approaching', { remaining: 10, limit: 100 });
logger.error('Operation failed', { error: error.message, stack: error.stack });
```

### Debug Endpoints

Development-only endpoints for debugging:

```bash
# OAuth configuration
curl http://localhost:3000/oauth/debug

# Token inspection (development only)
curl http://localhost:3000/admin/tokens

# Rate limit status
curl http://localhost:3000/rate-limit-status
```

## Code Quality

### ESLint Configuration

The project uses ESLint for code quality:

```bash
# Run linting
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### Code Style Guidelines

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Line Length**: 100 characters max
- **Naming**: camelCase for variables, PascalCase for classes

### Pre-commit Hooks

Consider setting up pre-commit hooks:

```bash
# Install husky for git hooks
npm install --save-dev husky

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm test"
```

## Environment Management

### Multiple Environments

Use different `.env` files for different environments:

```bash
# Development
.env.development

# Testing
.env.test

# Production (use deployment platform secrets)
.env.production
```

### Environment Switching

```bash
# Load specific environment
NODE_ENV=test npm start

# Or use cross-env for Windows compatibility
npx cross-env NODE_ENV=test npm start
```

## Performance Optimization

### Development Performance

- **Nodemon**: Auto-restart on file changes
- **Source Maps**: Enabled for debugging
- **Hot Reloading**: Consider using PM2 for advanced features

### Memory Management

Monitor memory usage during development:

```javascript
// Check memory usage
console.log('Memory usage:', process.memoryUsage());

// Monitor for memory leaks
setInterval(() => {
  const usage = process.memoryUsage();
  if (usage.heapUsed > 100 * 1024 * 1024) { // 100MB
    console.warn('High memory usage detected:', usage);
  }
}, 60000);
```

## Common Development Issues

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

### Module Not Found

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### OAuth Issues

1. **Check credentials**: Verify `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET`
2. **Check redirect URI**: Ensure it matches OSM registration
3. **Check environment**: Use development credentials for development

### Test Failures

```bash
# Run specific test file
npm test -- server.test.js

# Run tests with verbose output
npm test -- --verbose

# Run tests with debugging
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Git Workflow

### Branch Strategy

```bash
# Create feature branch
git checkout -b feature/new-endpoint

# Make changes and commit
git add .
git commit -m "feat: add new endpoint for member data"

# Push and create PR
git push origin feature/new-endpoint
```

### Commit Message Format

Follow conventional commits:

```
feat: add new API endpoint
fix: resolve rate limiting issue
docs: update API documentation
test: add integration tests
refactor: improve error handling
```

## Next Steps

After setting up your development environment:

1. **[API Reference](../api/osm-proxy.md)** - Learn about available endpoints
2. **[Testing Guide](../development/testing.md)** - Comprehensive testing information
3. **[Deployment Guide](../deployment/railway.md)** - Deploy to production
4. **[Contributing Guidelines](../development/contributing.md)** - Contribution workflow

---

*Last updated: September 6, 2025*