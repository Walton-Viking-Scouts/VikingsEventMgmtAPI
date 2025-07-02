# Documentation Structure

This directory contains comprehensive API documentation for the Vikings OSM Backend.

## Documentation Organization

### 📁 `frontend-api/`
Contains Swagger documentation for the **Frontend API** - the main API that frontend applications consume.

- **Endpoints**: `/api-docs` (Interactive Swagger UI)
- **JSON Spec**: `/api-docs.json` (OpenAPI specification)
- **Purpose**: Documents all endpoints that frontend applications use to interact with this backend
- **Features**: Authentication, OSM data proxy, rate limiting, member management

**Structure:**
- `swagger.js` - Main Swagger configuration
- `schemas/` - API request/response schemas
- `endpoints/` - Endpoint documentation

### 📁 `osm-api/`
Contains Swagger documentation for the **OSM API Reference** - unofficial documentation of the Online Scout Manager API.

- **Endpoints**: `/osm-api-docs` (Interactive Swagger UI)
- **JSON Spec**: `/osm-api-docs.json` (OpenAPI specification)
- **Purpose**: Reference documentation for the upstream OSM API that this backend proxies
- **Features**: Direct OSM endpoints, data structures, authentication flows

**Structure:**
- `swagger.js` - OSM API Swagger configuration
- `schemas/` - OSM data structures and schemas
- `endpoints/` - OSM API endpoint documentation

### 📁 `api/`
Contains detailed markdown documentation for various aspects of the API.

- `auth.md` - Authentication and OAuth flow documentation
- `osm_proxy.md` - OSM proxy endpoints guide with examples
- `rate_limiting.md` - Rate limiting information and best practices
- `other_endpoints.md` - Additional utility endpoints

### 📄 Other Documentation
- `API_GUIDE.md` - Main API guide
- `dynamic-redirect.md` - OAuth redirect configuration
- `oauth-flow-updated.md` - Updated OAuth flow documentation

## Accessing Documentation

When the server is running, you can access:

1. **Frontend API Documentation**: 
   - Interactive: `https://your-backend.com/api-docs`
   - JSON: `https://your-backend.com/api-docs.json`

2. **OSM API Reference**:
   - Interactive: `https://your-backend.com/osm-api-docs`
   - JSON: `https://your-backend.com/osm-api-docs.json`

## Development

When adding new endpoints or modifying existing ones:

1. **Frontend API changes**: Update files in `frontend-api/`
2. **OSM API reference updates**: Update files in `osm-api/`
3. **Detailed guides**: Update markdown files in `api/`

The Swagger documentation is automatically generated from JSDoc comments in the source code and schema files.