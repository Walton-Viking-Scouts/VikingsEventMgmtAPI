/**
 * @swagger
 * components:
 *   schemas:
 *     OAuthToken:
 *       type: object
 *       properties:
 *         access_token:
 *           type: string
 *           description: OAuth access token for OSM API
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         token_type:
 *           type: string
 *           description: Token type (always "Bearer")
 *           example: "Bearer"
 *         expires_in:
 *           type: integer
 *           description: Token expiration time in seconds
 *           example: 3600
 *         scope:
 *           type: string
 *           description: OAuth scopes granted
 *           example: "section:member:read section:programme:read section:event:read section:flexirecord:write"
 *     
 *     OAuthDebugInfo:
 *       type: object
 *       properties:
 *         clientId:
 *           type: string
 *           enum: ["Set", "Missing"]
 *           description: Whether OAuth client ID is configured
 *         clientSecret:
 *           type: string
 *           enum: ["Set", "Missing"]
 *           description: Whether OAuth client secret is configured
 *         frontendUrl:
 *           type: string
 *           description: Detected frontend URL for redirects
 *           example: "https://vikings-eventmgmt.onrender.com"
 *         stateParam:
 *           type: string
 *           description: OAuth state parameter value
 *           example: "prod&frontend_url=https://my-frontend.com"
 *         frontendUrlParam:
 *           type: string
 *           description: Explicit frontend_url parameter
 *           example: "https://my-frontend.com"
 *         refererHeader:
 *           type: string
 *           description: HTTP Referer header value
 *           example: "https://vikings-eventmgmt.onrender.com/"
 *         nodeEnv:
 *           type: string
 *           description: Node.js environment
 *           example: "production"
 *         backendUrl:
 *           type: string
 *           description: Backend URL for OAuth callbacks
 *           example: "https://vikings-osm-backend.onrender.com"
 *         authUrl:
 *           type: string
 *           description: Complete OAuth authorization URL
 *           example: "https://www.onlinescoutmanager.co.uk/oauth/authorize?client_id=..."
 *     
 *     LogoutResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Successfully logged out"
 *         tokensRemoved:
 *           type: integer
 *           description: Number of tokens removed from session
 *           example: 1
 *         _rateLimitInfo:
 *           $ref: '#/components/schemas/RateLimitInfo'
 */