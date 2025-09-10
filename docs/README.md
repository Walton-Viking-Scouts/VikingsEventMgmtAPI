# Vikings OSM Backend API Documentation

Welcome to the comprehensive documentation for the Vikings OSM Backend API. This backend serves as an OAuth proxy and rate-limited gateway for Online Scout Manager (OSM) API integration.

## 📚 Documentation Structure

### 🚀 Getting Started
- **[Quick Start Guide](./getting-started/README.md)** - Set up and run the API locally
- **[Installation](./getting-started/installation.md)** - Detailed installation instructions
- **[Configuration](./getting-started/configuration.md)** - Environment variables and setup
- **[Development Setup](./getting-started/development.md)** - Development environment configuration

### 🔧 API Reference
- **[Authentication](./api/authentication.md)** - OAuth flow and token management
- **[OSM Proxy Endpoints](./api/osm-proxy.md)** - OSM API proxy endpoints with examples
- **[Rate Limiting](./api/rate-limiting.md)** - Rate limiting system and monitoring
- **[Health & Monitoring](./api/health-monitoring.md)** - Health checks and system monitoring
- **[Error Handling](./api/error-handling.md)** - Error responses and troubleshooting

### 🏗️ Architecture
- **[System Overview](./architecture/overview.md)** - High-level architecture and components
- **[OSM Integration](./architecture/osm-integration.md)** - OSM API integration patterns
- **[Rate Limiting Architecture](./architecture/rate-limiting.md)** - Dual-layer rate limiting system
- **[Security](./architecture/security.md)** - Security considerations and best practices
- **[Data Flow](./architecture/data-flow.md)** - Request/response flow diagrams

### 🚀 Deployment
- **[Railway Deployment](./deployment/railway.md)** - Production deployment on Railway
- **[Environment Configuration](./deployment/environment.md)** - Production environment setup
- **[CI/CD Pipeline](./deployment/cicd.md)** - GitHub Actions and automated deployment
- **[Monitoring & Logging](./deployment/monitoring.md)** - Sentry integration and logging

### 🧪 Development
- **[Testing Guide](./development/testing.md)** - Running tests and test coverage
- **[Code Style](./development/code-style.md)** - ESLint configuration and standards
- **[Contributing](./development/contributing.md)** - Contribution guidelines
- **[Debugging](./development/debugging.md)** - Debugging tips and tools

### 📊 Operations
- **[Performance](./operations/performance.md)** - Performance monitoring and optimization
- **[Troubleshooting](./operations/troubleshooting.md)** - Common issues and solutions
- **[Maintenance](./operations/maintenance.md)** - Routine maintenance tasks
- **[Scaling](./operations/scaling.md)** - Scaling considerations

### 📋 Reference
- **[API Changelog](./reference/changelog.md)** - Version history and changes
- **[Technical Debt](./reference/technical-debt.md)** - Known technical debt and improvement plans
- **[Glossary](./reference/glossary.md)** - Terms and definitions

## 🔗 Quick Links

### For Developers
- [API Endpoints Overview](./api/osm-proxy.md#endpoints-overview)
- [Authentication Flow](./api/authentication.md#oauth-flow)
- [Local Development Setup](./getting-started/development.md)
- [Testing Guide](./development/testing.md)

### For DevOps
- [Deployment Guide](./deployment/railway.md)
- [Environment Variables](./deployment/environment.md)
- [Monitoring Setup](./deployment/monitoring.md)
- [Troubleshooting](./operations/troubleshooting.md)

### For API Consumers
- [Authentication](./api/authentication.md)
- [Rate Limiting](./api/rate-limiting.md)
- [Error Handling](./api/error-handling.md)
- [OSM Proxy Endpoints](./api/osm-proxy.md)

## 📖 Interactive Documentation

When the server is running, you can access interactive API documentation:

- **Backend API Documentation**: `https://your-backend.com/backend-docs`
- **OpenAPI Specification**: `https://your-backend.com/backend-docs.json`

## 🆘 Support

- **Issues**: Report bugs and feature requests on GitHub
- **Documentation**: This documentation is maintained alongside the codebase
- **Updates**: Documentation is updated with each release

---

## Legacy Documentation

The following legacy documentation is preserved for reference:

### 📁 `frontend-api/`
Contains Swagger documentation for the **Frontend API** - the main API that frontend applications consume.

### 📁 `osm-api/`
Contains Swagger documentation for the **OSM API Reference** - unofficial documentation of the Online Scout Manager API.

### 📄 Legacy Files
- `API_GUIDE.md` - Legacy API guide
- `dynamic-redirect.md` - OAuth redirect configuration
- `oauth-flow-updated.md` - Updated OAuth flow documentation

---

*Last updated: September 6, 2025*