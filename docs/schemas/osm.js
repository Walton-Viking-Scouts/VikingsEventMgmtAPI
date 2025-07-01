/**
 * @swagger
 * components:
 *   schemas:
 *     OSMTerm:
 *       type: object
 *       properties:
 *         termid:
 *           type: string
 *           description: Unique term identifier
 *           example: "123"
 *         name:
 *           type: string
 *           description: Term name
 *           example: "Autumn 2023"
 *         startdate:
 *           type: string
 *           format: date
 *           description: Term start date
 *           example: "2023-09-01"
 *         enddate:
 *           type: string
 *           format: date
 *           description: Term end date
 *           example: "2023-12-15"
 *     
 *     OSMSection:
 *       type: object
 *       properties:
 *         sectionid:
 *           type: string
 *           description: Unique section identifier
 *           example: "456"
 *         sectionname:
 *           type: string
 *           description: Section name
 *           example: "1st Walton Scouts"
 *         sectiontype:
 *           type: string
 *           description: Type of scout section
 *           example: "scouts"
 *     
 *     OSMEvent:
 *       type: object
 *       properties:
 *         eventid:
 *           type: string
 *           description: Unique event identifier
 *           example: "789"
 *         name:
 *           type: string
 *           description: Event name
 *           example: "Weekly Meeting"
 *         startdate:
 *           type: string
 *           format: date
 *           description: Event start date
 *           example: "2023-10-15"
 *         enddate:
 *           type: string
 *           format: date
 *           description: Event end date
 *           example: "2023-10-15"
 *         starttime:
 *           type: string
 *           description: Event start time
 *           example: "19:00"
 *         endtime:
 *           type: string
 *           description: Event end time
 *           example: "20:30"
 *         location:
 *           type: string
 *           description: Event location
 *           example: "Scout Hall"
 *     
 *     OSMAttendance:
 *       type: object
 *       properties:
 *         scoutid:
 *           type: string
 *           description: Scout member identifier
 *           example: "101"
 *         firstname:
 *           type: string
 *           description: Scout first name
 *           example: "John"
 *         lastname:
 *           type: string
 *           description: Scout last name
 *           example: "Smith"
 *         attending:
 *           type: string
 *           enum: ["Yes", "No", ""]
 *           description: Attendance status
 *           example: "Yes"
 *         patrol:
 *           type: string
 *           description: Scout patrol/group
 *           example: "Eagles"
 *     
 *     OSMFlexiRecord:
 *       type: object
 *       properties:
 *         extraid:
 *           type: string
 *           description: Flexi record identifier
 *           example: "202"
 *         name:
 *           type: string
 *           description: Flexi record name
 *           example: "Activity Badges"
 *         config:
 *           type: object
 *           description: Record configuration and structure
 *           additionalProperties: true
 *     
 *     OSMFlexiRecordData:
 *       type: object
 *       properties:
 *         scoutid:
 *           type: string
 *           description: Scout identifier
 *           example: "101"
 *         firstname:
 *           type: string
 *           description: Scout first name
 *           example: "John"
 *         lastname:
 *           type: string
 *           description: Scout last name
 *           example: "Smith"
 *       additionalProperties:
 *         type: string
 *         description: Dynamic fields (f_1, f_2, etc.) containing record data
 *         example: "2023-10-15"
 *     
 *     UpdateFlexiRecordRequest:
 *       type: object
 *       required:
 *         - sectionid
 *         - scoutid
 *         - flexirecordid
 *         - columnid
 *         - value
 *       properties:
 *         sectionid:
 *           type: string
 *           description: Section identifier
 *           example: "456"
 *         scoutid:
 *           type: string
 *           description: Scout identifier
 *           example: "101"
 *         flexirecordid:
 *           type: string
 *           description: Flexi record identifier
 *           example: "202"
 *         columnid:
 *           type: string
 *           pattern: "^f_\\d+$"
 *           description: "Field identifier (format: f_1, f_2, etc.)"
 *           example: "f_1"
 *         value:
 *           type: string
 *           description: New field value
 *           example: "2023-10-15"
 *     
 *     StartupData:
 *       type: object
 *       properties:
 *         user:
 *           type: object
 *           properties:
 *             userid:
 *               type: string
 *               example: "12345"
 *             firstname:
 *               type: string
 *               example: "John"
 *             lastname:
 *               type: string
 *               example: "Doe"
 *             email:
 *               type: string
 *               format: email
 *               example: "john.doe@example.com"
 *         sections:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OSMSection'
 *         terms:
 *           type: object
 *           additionalProperties:
 *             $ref: '#/components/schemas/OSMTerm'
 *         _rateLimitInfo:
 *           $ref: '#/components/schemas/RateLimitInfo'
 */