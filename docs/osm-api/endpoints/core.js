/**
 * @swagger
 * /api.php:
 *   get:
 *     summary: Get terms (OSM Core API)
 *     description: |
 *       Retrieves available terms/periods from OSM.
 *       
 *       **Actual OSM Endpoint:** `GET https://www.onlinescoutmanager.co.uk/api.php?action=getTerms`
 *       
 *       Returns all available terms that the authenticated user has access to.
 *       Terms are used to filter time-based data like events and records.
 *     tags: [OSM Core API]
 *     parameters:
 *       - in: query
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [getTerms]
 *         description: API action to perform
 *         example: getTerms
 *     responses:
 *       200:
 *         description: Available terms
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 $ref: '#/components/schemas/OSMRawTerm'
 *             example:
 *               "123":
 *                 termid: "123"
 *                 name: "Autumn 2023"
 *                 startdate: "2023-09-01"
 *                 enddate: "2023-12-15"
 *                 master_term: "1"
 *               "124":
 *                 termid: "124"
 *                 name: "Spring 2024"
 *                 startdate: "2024-01-08"
 *                 enddate: "2024-04-12"
 *                 master_term: "1"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 * 
 * /ext/generic/startup/:
 *   get:
 *     summary: Get user startup data (OSM Generic Extension)
 *     description: |
 *       Retrieves essential user information for application initialization.
 *       
 *       **Actual OSM Endpoint:** `GET https://www.onlinescoutmanager.co.uk/ext/generic/startup/?action=getData`
 *       
 *       ⚠️ **Special Response Format**: Returns JavaScript code, not pure JSON.
 *       The response starts with JavaScript that needs to be stripped (first 18 characters).
 *       
 *       Contains user profile, accessible sections, terms, and role information.
 *     tags: [OSM Generic Extension]
 *     parameters:
 *       - in: query
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [getData]
 *         description: Extension action to perform
 *         example: getData
 *     responses:
 *       200:
 *         description: User startup data (wrapped in JavaScript)
 *         content:
 *           application/javascript:
 *             schema:
 *               type: string
 *               description: JavaScript code containing JSON data
 *               example: "osmStartupData = {\"user\":{\"userid\":\"12345\",\"firstname\":\"John\"}}"
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OSMRawStartupData'
 *             description: Parsed JSON after removing JavaScript wrapper
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */