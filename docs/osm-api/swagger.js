const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Online Scout Manager (OSM) API Documentation',
      version: '1.0.0',
      description: `
        **UNOFFICIAL** documentation for the Online Scout Manager API endpoints.
        
        > ⚠️ **Important**: This is reverse-engineered documentation based on our usage. 
        > OSM does not provide official API documentation. Use at your own risk.
        
        ## About OSM API
        
        Online Scout Manager provides a REST API for accessing scout section data including:
        - Member information and attendance
        - Events and programme activities  
        - Flexible records (badges, awards, custom tracking)
        - Section configuration and user roles
        
        ## Authentication
        
        The OSM API uses OAuth 2.0 Bearer tokens:
        \`Authorization: Bearer YOUR_OSM_TOKEN\`
        
        **OAuth Flow:**
        1. Redirect to: \`https://www.onlinescoutmanager.co.uk/oauth/authorize\`
        2. User authorizes your application
        3. Callback receives authorization code
        4. Exchange code for access token at: \`https://www.onlinescoutmanager.co.uk/oauth/token\`
        
        ## Rate Limiting
        
        OSM implements rate limiting (exact limits unknown):
        - Responses include \`X-RateLimit-*\` headers when approaching limits
        - Rate limited requests return HTTP 429
        - Limits appear to be per-user and per-hour
        
        ## Base URLs
        
        - **API Base**: \`https://www.onlinescoutmanager.co.uk/api.php\`
        - **Extensions**: \`https://www.onlinescoutmanager.co.uk/ext/{module}/{action}/\`
        - **OAuth**: \`https://www.onlinescoutmanager.co.uk/oauth/\`
        
        ## Data Formats
        
        - **Request**: URL-encoded form data or query parameters
        - **Response**: JSON (sometimes with JavaScript wrapper)
        - **Dates**: YYYY-MM-DD format
        - **IDs**: String values (not integers)
        
        ## Common Patterns
        
        Most endpoints require:
        - \`sectionid\` - Section identifier  
        - \`termid\` - Term/period identifier (for time-based data)
        - OAuth token in Authorization header
        
        ## Error Handling
        
        OSM API errors are inconsistent:
        - HTTP status codes (400, 401, 429, 500)
        - JSON error objects
        - Sometimes HTML error pages
        - Empty responses for some error conditions
        
        ## Disclaimer
        
        This documentation is provided as-is based on reverse engineering. 
        OSM may change their API without notice. Always test thoroughly.
      `,
      contact: {
        name: 'Community Documentation',
        url: 'https://github.com/Walton-Vikings/vikings-osm-backend',
      },
      license: {
        name: 'Unofficial Documentation',
      },
    },
    servers: [
      {
        url: 'https://www.onlinescoutmanager.co.uk',
        description: 'OSM Production API',
      },
    ],
    components: {
      securitySchemes: {
        osmBearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'OAuth',
          description: `
            OAuth 2.0 Bearer token from OSM authorization flow.
            
            **Required OAuth Scopes:**
            - \`section:member:read\` - Read member information
            - \`section:programme:read\` - Read programme/events  
            - \`section:event:read\` - Read event details
            - \`section:flexirecord:write\` - Read/write flexible records
          `,
        },
      },
      parameters: {
        sectionid: {
          name: 'sectionid',
          in: 'query',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'Section identifier from OSM',
          example: '12345',
        },
        termid: {
          name: 'termid', 
          in: 'query',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'Term identifier from OSM',
          example: '67890',
        },
        eventid: {
          name: 'eventid',
          in: 'query', 
          required: true,
          schema: {
            type: 'string',
          },
          description: 'Event identifier from OSM',
          example: '11111',
        },
        flexirecordid: {
          name: 'extraid',
          in: 'query',
          required: true, 
          schema: {
            type: 'string',
          },
          description: 'Flexible record identifier (called extraid in OSM)',
          example: '22222',
        },
        scoutid: {
          name: 'scoutid',
          in: 'query',
          required: true,
          schema: {
            type: 'string', 
          },
          description: 'Scout/member identifier from OSM',
          example: '33333',
        },
      },
      responses: {
        RateLimited: {
          description: 'Rate limit exceeded',
          headers: {
            'X-RateLimit-Limit': {
              description: 'Request limit per time window',
              schema: {
                type: 'integer',
                example: 1000,
              },
            },
            'X-RateLimit-Remaining': {
              description: 'Requests remaining in current window',
              schema: {
                type: 'integer',
                example: 5,
              },
            },
            'X-RateLimit-Reset': {
              description: 'Unix timestamp when limit resets',
              schema: {
                type: 'integer',
                example: 1640995200,
              },
            },
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'Rate limit exceeded',
                  },
                },
              },
            },
          },
        },
        Unauthorized: {
          description: 'Invalid or expired OAuth token',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'Invalid token',
                  },
                },
              },
            },
          },
        },
        ServerError: {
          description: 'OSM server error (may return HTML)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'Internal server error',
                  },
                },
              },
            },
            'text/html': {
              schema: {
                type: 'string',
                example: '<html>Error page...</html>',
              },
            },
          },
        },
      },
    },
    security: [{ osmBearerAuth: [] }],
  },
  apis: [
    './docs/osm-api/schemas/*.js',
    './docs/osm-api/endpoints/*.js',
  ],
};

const specs = swaggerJsdoc(options);

module.exports = { specs, swaggerUi };