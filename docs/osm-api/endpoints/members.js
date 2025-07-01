/**
 * @swagger
 * /ext/members/contact/:
 *   get:
 *     summary: Get member contact information (OSM Members Extension)
 *     description: |
 *       Retrieves contact details and member information.
 *       Two main actions available: get list of members or individual member details.
 *       
 *       **Base URL:** `https://www.onlinescoutmanager.co.uk/ext/members/contact/`
 *     tags: [OSM Members Extension]
 *     parameters:
 *       - in: query
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [getListOfMembers, getIndividual]
 *         description: Member contact action to perform
 *         example: getListOfMembers
 *       - $ref: '#/components/parameters/sectionid'
 *       - in: query
 *         name: scoutid
 *         schema:
 *           type: string
 *         description: Scout/member identifier (required for getIndividual action)
 *         example: "33333"
 *     responses:
 *       200:
 *         description: Member contact information
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   description: getListOfMembers response
 *                   additionalProperties:
 *                     allOf:
 *                       - $ref: '#/components/schemas/OSMMetadata'
 *                       - type: object
 *                         properties:
 *                           dob:
 *                             type: string
 *                             format: date
 *                             description: Date of birth
 *                             example: "2010-05-15"
 *                           started:
 *                             type: string
 *                             format: date
 *                             description: Date started in section
 *                             example: "2022-09-01"
 *                           age:
 *                             type: string
 *                             description: Current age
 *                             example: "13"
 *                 - type: object
 *                   description: getIndividual response
 *                   allOf:
 *                     - $ref: '#/components/schemas/OSMMetadata'
 *                     - type: object
 *                       properties:
 *                         email1:
 *                           type: string
 *                           format: email
 *                           description: Primary email
 *                           example: "parent@example.com"
 *                         phone1:
 *                           type: string
 *                           description: Primary phone
 *                           example: "01234567890"
 *                         address:
 *                           type: string
 *                           description: Home address
 *                           example: "123 Main St, Town"
 *                         medical:
 *                           type: string
 *                           description: Medical information
 *                           example: "No known allergies"
 *             examples:
 *               getListOfMembers:
 *                 summary: List of all members
 *                 value:
 *                   "33333":
 *                     identifier: "33333"
 *                     firstname: "John"
 *                     lastname: "Smith"
 *                     patrol: "Eagles"
 *                     dob: "2010-05-15"
 *                     age: "13"
 *                     started: "2022-09-01"
 *               getIndividual:
 *                 summary: Individual member details
 *                 value:
 *                   identifier: "33333"
 *                   firstname: "John"
 *                   lastname: "Smith"
 *                   email1: "parent@example.com"
 *                   phone1: "01234567890"
 *                   address: "123 Main St, Town"
 *                   medical: "No known allergies"
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
 */