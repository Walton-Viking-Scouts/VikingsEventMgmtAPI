/**
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       required:
 *         - error
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *           example: "Access token is required in Authorization header"
 *         message:
 *           type: string
 *           description: Additional error details
 *           example: "Please include a valid Bearer token in the Authorization header"
 *         details:
 *           type: string
 *           description: Technical error details (development only)
 *           example: "Token validation failed: invalid signature"
 *         rateLimitInfo:
 *           $ref: '#/components/schemas/RateLimitInfo'
 *     
 *     RateLimitInfo:
 *       type: object
 *       description: Rate limiting information included in all API responses
 *       properties:
 *         backend:
 *           type: object
 *           properties:
 *             limit:
 *               type: integer
 *               description: Maximum requests allowed per window
 *               example: 100
 *             remaining:
 *               type: integer
 *               description: Requests remaining in current window
 *               example: 85
 *             resetTime:
 *               type: integer
 *               description: Unix timestamp when the limit resets
 *               example: 1640995200
 *             window:
 *               type: string
 *               description: Rate limit window duration
 *               example: "per minute"
 *         osm:
 *           type: object
 *           properties:
 *             limit:
 *               type: integer
 *               nullable: true
 *               description: OSM API rate limit (if available)
 *               example: 1000
 *             remaining:
 *               type: integer
 *               nullable: true
 *               description: OSM API requests remaining
 *               example: 245
 *             resetTime:
 *               type: integer
 *               nullable: true
 *               description: Unix timestamp when OSM limit resets
 *               example: 1640995200
 *             available:
 *               type: boolean
 *               description: Whether OSM API is currently available
 *               example: true
 *             retryAfter:
 *               type: integer
 *               nullable: true
 *               description: Seconds to wait before retrying (when rate limited)
 *               example: 300
 *     
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         _rateLimitInfo:
 *           $ref: '#/components/schemas/RateLimitInfo'
 *       additionalProperties: true
 *       description: Base response that includes rate limit information
 */