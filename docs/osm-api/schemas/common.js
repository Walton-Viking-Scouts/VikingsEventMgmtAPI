/**
 * @swagger
 * components:
 *   schemas:
 *     OSMError:
 *       type: object
 *       description: OSM API error response (format varies)
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *           example: "Invalid section ID"
 *         message:
 *           type: string
 *           description: Additional error details
 *           example: "Section not found or access denied"
 *         code:
 *           type: integer
 *           description: Error code (when provided)
 *           example: 404
 *     
 *     OSMSuccessResponse:
 *       type: object
 *       description: Base OSM API success response
 *       properties:
 *         status:
 *           type: string
 *           description: Response status
 *           example: "success"
 *         data:
 *           type: object
 *           description: Response data (structure varies by endpoint)
 *           additionalProperties: true
 *     
 *     OSMMetadata:
 *       type: object
 *       description: Common metadata fields in OSM responses
 *       properties:
 *         identifier:
 *           type: string
 *           description: Unique identifier for the record
 *         firstname:
 *           type: string
 *           description: First name
 *           example: "John"
 *         lastname:
 *           type: string
 *           description: Last name
 *           example: "Smith"
 *         patrolid:
 *           type: string
 *           description: Patrol/group identifier
 *           example: "1"
 *         patrol:
 *           type: string
 *           description: Patrol/group name
 *           example: "Eagles"
 *         sectionid:
 *           type: string
 *           description: Section identifier
 *           example: "12345"
 */