/**
 * @swagger
 * /ext/members/flexirecords/:
 *   get:
 *     summary: Get flexible records operations (OSM Members Extension)
 *     description: |
 *       Multiple operations for flexible records (badges, awards, custom tracking).
 *       The action parameter determines which operation is performed.
 *       
 *       **Base URL:** `https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/`
 *     tags: [OSM FlexiRecords Extension]
 *     parameters:
 *       - in: query
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [getFlexiRecords, getStructure, getData]
 *         description: Flexi records action to perform
 *         example: getFlexiRecords
 *       - $ref: '#/components/parameters/sectionid'
 *       - in: query
 *         name: archived
 *         schema:
 *           type: string
 *           enum: ["yes", "no", "0", "1"]
 *         description: Include archived records (for getFlexiRecords action)
 *         example: "no"
 *       - in: query
 *         name: extraid
 *         schema:
 *           type: string
 *         description: Flexi record ID (required for getStructure and getData actions)
 *         example: "22222"
 *       - $ref: '#/components/parameters/termid'
 *       - in: query
 *         name: nototal
 *         schema:
 *           type: string
 *         description: Exclude totals from response (for getData action)
 *         example: ""
 *     responses:
 *       200:
 *         description: Response varies by action
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   description: getFlexiRecords response
 *                   additionalProperties:
 *                     $ref: '#/components/schemas/OSMRawFlexiRecord'
 *                 - type: object
 *                   description: getStructure response
 *                   allOf:
 *                     - $ref: '#/components/schemas/OSMRawFlexiStructure'
 *                 - type: object
 *                   description: getData response
 *                   additionalProperties:
 *                     $ref: '#/components/schemas/OSMRawFlexiData'
 *             examples:
 *               getFlexiRecords:
 *                 summary: Get available flexi records
 *                 value:
 *                   "22222":
 *                     extraid: "22222"
 *                     name: "Activity Badges"
 *                     archived: "0"
 *                     config: {}
 *               getStructure:
 *                 summary: Get flexi record structure
 *                 value:
 *                   structure:
 *                     f_1:
 *                       name: "Date Completed"
 *                       type: "date"
 *                       required: "0"
 *                   columns: {}
 *               getData:
 *                 summary: Get flexi record data
 *                 value:
 *                   "33333":
 *                     identifier: "33333"
 *                     firstname: "John"
 *                     lastname: "Smith"
 *                     f_1: "2023-10-15"
 *                     f_2: "Completed"
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OSMError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     summary: Update flexible record (OSM Members Extension)
 *     description: |
 *       Updates a specific field value for a specific member in a flexible record.
 *       
 *       **Actual OSM Endpoint:** `POST https://www.onlinescoutmanager.co.uk/ext/members/flexirecords/?action=updateRecord`
 *       
 *       **Important:** 
 *       - Content-Type must be `application/x-www-form-urlencoded`
 *       - Field IDs follow pattern `f_1`, `f_2`, etc.
 *       - All parameters sent in request body, not query string
 *     tags: [OSM FlexiRecords Extension]
 *     parameters:
 *       - in: query
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [updateRecord]
 *         description: Action to perform
 *         example: updateRecord
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - sectionid
 *               - scoutid
 *               - extraid
 *               - columnid
 *               - value
 *             properties:
 *               sectionid:
 *                 type: string
 *                 description: Section identifier
 *                 example: "12345"
 *               scoutid:
 *                 type: string
 *                 description: Scout/member identifier
 *                 example: "33333"
 *               extraid:
 *                 type: string
 *                 description: Flexi record identifier
 *                 example: "22222"
 *               columnid:
 *                 type: string
 *                 pattern: "^f_\\d+$"
 *                 description: Field identifier (f_1, f_2, etc.)
 *                 example: "f_1"
 *               value:
 *                 type: string
 *                 description: New field value
 *                 example: "2023-10-15"
 *     responses:
 *       200:
 *         description: Update result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   description: Whether update was successful
 *                   example: true
 *                 status:
 *                   type: string
 *                   description: Update status message
 *                   example: "success"
 *             example:
 *               ok: true
 *               status: "success"
 *       400:
 *         description: Invalid parameters or field ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OSMError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */