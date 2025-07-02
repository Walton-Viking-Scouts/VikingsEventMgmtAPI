/**
 * @swagger
 * /rate-limit-status:
 *   get:
 *     summary: Get current rate limit status
 *     description: |
 *       Returns current rate limiting information for both backend and OSM API.
 *       Useful for monitoring API usage and avoiding rate limit violations.
 *     tags: [Utility]
 *     responses:
 *       200:
 *         description: Current rate limit status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 backend:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                       example: 100
 *                     remaining:
 *                       type: integer
 *                       example: 85
 *                     resetTime:
 *                       type: integer
 *                       example: 1640995200
 *                     window:
 *                       type: string
 *                       example: "per minute"
 *                 osm:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                       nullable: true
 *                       example: 1000
 *                     remaining:
 *                       type: integer
 *                       nullable: true
 *                       example: 245
 *                     resetTime:
 *                       type: integer
 *                       nullable: true
 *                       example: 1640995200
 *                     available:
 *                       type: boolean
 *                       example: true
 *                     retryAfter:
 *                       type: integer
 *                       nullable: true
 *                       example: 300
 *                 timestamp:
 *                   type: integer
 *                   description: Current server timestamp
 *                   example: 1640991600
 *     security: []
 * 
 * /get-terms:
 *   get:
 *     summary: Get available terms
 *     description: |
 *       Retrieves all available terms/periods from OSM for the authenticated user.
 *       Terms are used to filter events and records by time period.
 *     tags: [OSM Data]
 *     responses:
 *       200:
 *         description: List of available terms
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       additionalProperties:
 *                         $ref: '#/components/schemas/OSMTerm'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /get-section-config:
 *   get:
 *     summary: Get section configuration
 *     description: |
 *       Retrieves configuration details for a specific scout section.
 *       Includes section settings, customizations, and available features.
 *     tags: [OSM Data]
 *     parameters:
 *       - in: query
 *         name: access_token
 *         required: true
 *         schema:
 *           type: string
 *         description: OAuth access token
 *         example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       - in: query
 *         name: sectionid
 *         required: true
 *         schema:
 *           type: string
 *         description: Section identifier
 *         example: "456"
 *     responses:
 *       200:
 *         description: Section configuration data
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     config:
 *                       type: object
 *                       description: Section configuration object
 *                       additionalProperties: true
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /get-user-roles:
 *   get:
 *     summary: Get user roles and permissions
 *     description: |
 *       Retrieves the authenticated user's roles and permissions across all sections.
 *       Used to determine what actions the user can perform.
 *     tags: [OSM Data]
 *     responses:
 *       200:
 *         description: User roles and permissions
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     roles:
 *                       type: object
 *                       description: User roles by section
 *                       additionalProperties: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /get-events:
 *   get:
 *     summary: Get events for a section and term
 *     description: |
 *       Retrieves all events for a specific section and term.
 *       Events include meetings, activities, camps, and other scheduled activities.
 *     tags: [OSM Data]
 *     parameters:
 *       - in: query
 *         name: sectionid
 *         required: true
 *         schema:
 *           type: string
 *         description: Section identifier
 *         example: "456"
 *       - in: query
 *         name: termid
 *         required: true
 *         schema:
 *           type: string
 *         description: Term identifier
 *         example: "123"
 *     responses:
 *       200:
 *         description: List of events
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     events:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/OSMEvent'
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /get-event-attendance:
 *   get:
 *     summary: Get attendance for a specific event
 *     description: |
 *       Retrieves attendance information for all members for a specific event.
 *       Shows who attended, who didn't, and any additional attendance notes.
 *     tags: [OSM Data]
 *     parameters:
 *       - in: query
 *         name: sectionid
 *         required: true
 *         schema:
 *           type: string
 *         description: Section identifier
 *         example: "456"
 *       - in: query
 *         name: termid
 *         required: true
 *         schema:
 *           type: string
 *         description: Term identifier
 *         example: "123"
 *       - in: query
 *         name: eventid
 *         required: true
 *         schema:
 *           type: string
 *         description: Event identifier
 *         example: "789"
 *     responses:
 *       200:
 *         description: Event attendance data
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     attendance:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/OSMAttendance'
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /get-startup-data:
 *   get:
 *     summary: Get user startup data
 *     description: |
 *       Retrieves essential user information including name, roles, sections, and terms.
 *       This endpoint provides all the basic data needed to initialize the frontend application.
 *     tags: [OSM Data]
 *     responses:
 *       200:
 *         description: User startup data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StartupData'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /get-flexi-records:
 *   get:
 *     summary: Get available flexi records for a section
 *     description: |
 *       Retrieves all available flexible records (badges, awards, custom tracking)
 *       for a specific section. Flexi records are customizable data structures
 *       used to track member progress and achievements.
 *     tags: [Flexi Records]
 *     parameters:
 *       - in: query
 *         name: access_token
 *         required: true
 *         schema:
 *           type: string
 *         description: OAuth access token
 *       - in: query
 *         name: sectionid
 *         required: true
 *         schema:
 *           type: string
 *         description: Section identifier
 *         example: "456"
 *       - in: query
 *         name: archived
 *         schema:
 *           type: string
 *           enum: ["yes", "no"]
 *         description: Include archived records
 *         example: "no"
 *     responses:
 *       200:
 *         description: List of available flexi records
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     records:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/OSMFlexiRecord'
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /get-flexi-structure:
 *   get:
 *     summary: Get structure of a specific flexi record
 *     description: |
 *       Retrieves the field structure and configuration for a specific flexi record.
 *       This includes field definitions, types, and validation rules.
 *     tags: [Flexi Records]
 *     parameters:
 *       - in: query
 *         name: access_token
 *         required: true
 *         schema:
 *           type: string
 *         description: OAuth access token
 *       - in: query
 *         name: sectionid
 *         required: true
 *         schema:
 *           type: string
 *         description: Section identifier
 *         example: "456"
 *       - in: query
 *         name: flexirecordid
 *         required: true
 *         schema:
 *           type: string
 *         description: Flexi record identifier
 *         example: "202"
 *       - in: query
 *         name: termid
 *         required: true
 *         schema:
 *           type: string
 *         description: Term identifier
 *         example: "123"
 *     responses:
 *       200:
 *         description: Flexi record structure
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     structure:
 *                       type: object
 *                       description: Field definitions and configuration
 *                       additionalProperties: true
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /get-single-flexi-record:
 *   get:
 *     summary: Get data for a specific flexi record
 *     description: |
 *       Retrieves all member data for a specific flexi record.
 *       Returns the current values for all members and all fields in the record.
 *     tags: [Flexi Records]
 *     parameters:
 *       - in: query
 *         name: access_token
 *         required: true
 *         schema:
 *           type: string
 *         description: OAuth access token
 *       - in: query
 *         name: sectionid
 *         required: true
 *         schema:
 *           type: string
 *         description: Section identifier
 *         example: "456"
 *       - in: query
 *         name: flexirecordid
 *         required: true
 *         schema:
 *           type: string
 *         description: Flexi record identifier
 *         example: "202"
 *       - in: query
 *         name: termid
 *         required: true
 *         schema:
 *           type: string
 *         description: Term identifier
 *         example: "123"
 *     responses:
 *       200:
 *         description: Flexi record data for all members
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/OSMFlexiRecordData'
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /update-flexi-record:
 *   post:
 *     summary: Update a single field in a flexi record
 *     description: |
 *       Updates a specific field value for a specific member in a flexi record.
 *       This endpoint includes enhanced validation and comprehensive logging.
 *       
 *       **Field ID Format:** Must follow pattern `f_1`, `f_2`, etc.
 *       
 *       **Enhanced Features:**
 *       - Field ID format validation
 *       - Comprehensive Sentry logging
 *       - Rate limit monitoring with warnings
 *       - Detailed error context
 *     tags: [Flexi Records]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateFlexiRecordRequest'
 *     responses:
 *       200:
 *         description: Successfully updated flexi record
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     ok:
 *                       type: boolean
 *                       description: Update success status
 *                       example: true
 *                     status:
 *                       type: string
 *                       description: Update status message
 *                       example: "Record updated successfully"
 *       400:
 *         description: Invalid request or field ID format
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Error'
 *                 - type: object
 *                   properties:
 *                     error:
 *                       example: "Invalid field ID format. Expected format: f_1, f_2, etc."
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /multi-update-flexi-record:
 *   post:
 *     summary: Batch update multiple scouts in a flexi record
 *     description: |
 *       Updates the same field value for multiple scouts in a single batch operation.
 *       This is much more efficient than making individual update calls for each scout.
 *       
 *       **Key Features:**
 *       - Batch processing for better performance
 *       - Validates all scout IDs before processing
 *       - Comprehensive error handling and logging
 *       - Rate limit aware with detailed monitoring
 *       - Field ID format validation (f_1, f_2, etc.)
 *       
 *       **Use Cases:**
 *       - Marking attendance for multiple scouts
 *       - Bulk awarding of badges or achievements
 *       - Setting the same progress value for a group
 *       - Administrative updates across members
 *       
 *       **Efficiency Benefits:**
 *       - Single API call vs multiple individual calls
 *       - Reduced rate limit consumption
 *       - Atomic operation (all succeed or all fail)
 *       - Better error handling for batch operations
 *     tags: [Flexi Records]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MultiUpdateFlexiRecordRequest'
 *           examples:
 *             attendance_update:
 *               summary: Mark attendance for multiple scouts
 *               value:
 *                 sectionid: "49097"
 *                 scouts: ["1601995", "2060746", "1809627"]
 *                 value: "1"
 *                 column: "f_1"
 *                 flexirecordid: "72758"
 *             badge_award:
 *               summary: Award a badge to multiple scouts
 *               value:
 *                 sectionid: "49097"
 *                 scouts: ["1601995", "2060746"]
 *                 value: "Completed"
 *                 column: "f_3"
 *                 flexirecordid: "72758"
 *     responses:
 *       200:
 *         description: Successfully updated flexi records for all scouts
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     ok:
 *                       type: boolean
 *                       description: Update success status
 *                       example: true
 *                     status:
 *                       type: string
 *                       description: Update status message
 *                       example: "Records updated successfully"
 *                     updated_count:
 *                       type: integer
 *                       description: Number of scouts updated
 *                       example: 3
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Error'
 *                 - type: object
 *                   properties:
 *                     error:
 *                       oneOf:
 *                         - type: string
 *                           example: "Missing required parameters: sectionid, scouts (array), value, column, flexirecordid are required, plus Authorization header"
 *                         - type: string
 *                           example: "scouts array cannot be empty"
 *                         - type: string
 *                           example: "Invalid field ID format. Expected format: f_1, f_2, etc."
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /get-members-grid:
 *   post:
 *     summary: Get member contact grid with transformed structure
 *     description: |
 *       Retrieves member contact information from OSM and transforms the raw data structure
 *       into a more usable format with properly labeled contact groups and fields.
 *       
 *       **Key Features:**
 *       - Transforms raw OSM custom_data into labeled contact groups
 *       - Parses metadata to map column IDs to readable labels
 *       - Organizes contact information by groups (Primary Contact 1, Emergency Contact, etc.)
 *       - Preserves all core member information (name, age, patrol, etc.)
 *       - Includes comprehensive metadata for frontend processing
 *       
 *       **Data Transformation:**
 *       - Raw numeric keys (1_2, 1_3) become readable labels (First Name, Last Name)
 *       - Contact data is grouped by relationship type
 *       - Column metadata includes type information (text, email, telephone)
 *     tags: [OSM Data]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MembersGridRequest'
 *     responses:
 *       200:
 *         description: Successfully retrieved and transformed member contact data
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/MembersGridResponse'
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Error'
 *                 - type: object
 *                   properties:
 *                     error:
 *                       example: "Missing required parameters: section_id and term_id are required, plus Authorization header"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */