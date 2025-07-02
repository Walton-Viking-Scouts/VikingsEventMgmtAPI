const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Vikings OSM Backend API',
      version: '1.1.0',
      description: `
        API gateway that handles OAuth authentication and data transformation for Online Scout Manager (OSM) integration.
        
        ## Authentication
        This API uses OAuth 2.0 via bearer tokens. Include your token in the Authorization header:
        \`Authorization: Bearer YOUR_TOKEN\`
        
        ## Rate Limiting
        - **Backend**: 100 requests per minute per user/IP
        - **OSM API**: Dynamic limits based on OSM responses
        
        All responses include rate limit information in the \`_rateLimitInfo\` field.
        
        ## Data Sources
        This API aggregates data from Online Scout Manager and normalizes the response format.
        
        ## OAuth Flow
        The API supports dynamic frontend URL detection with multiple fallback mechanisms:
        1. \`frontend_url\` query parameter (highest priority)
        2. Embedded URL in state parameter
        3. Referer header detection for \`.onrender.com\` domains  
        4. Legacy state-based detection
        5. Default production URL
      `,
      contact: {
        name: 'API Support',
        url: 'https://github.com/Walton-Vikings/vikings-osm-backend',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://vikings-osm-backend.onrender.com' 
          : 'https://localhost:3000',
        description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: `
            JWT token obtained from OAuth flow with Online Scout Manager.
            The token is validated against the upstream OAuth provider.
            
            **How to get a token:**
            1. Navigate to \`/oauth/callback\` to start OAuth flow
            2. Complete OSM authentication
            3. Token will be returned in the redirect URL
            4. Use the token in subsequent API calls
          `,
        },
      },
      responses: {
        Unauthorized: {
          description: 'Unauthorized - invalid or expired token',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        RateLimited: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/Error' },
                  {
                    type: 'object',
                    properties: {
                      rateLimitInfo: {
                        $ref: '#/components/schemas/RateLimitInfo',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    './controllers/*.js',
    './docs/frontend-api/schemas/*.js',
    './docs/frontend-api/endpoints/*.js',
    './server.js',
  ],
};

const specs = swaggerJsdoc(options);

module.exports = { specs, swaggerUi };