/**
 * @swagger
 * components:
 *   schemas:
 *     OSMRawTerm:
 *       type: object
 *       description: Raw term data from OSM getTerms endpoint
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
 *           description: Term start date (YYYY-MM-DD)
 *           example: "2023-09-01"
 *         enddate:
 *           type: string
 *           format: date
 *           description: Term end date (YYYY-MM-DD)
 *           example: "2023-12-15"
 *         master_term:
 *           type: string
 *           description: Master term identifier
 *           example: "1"
 *     
 *     OSMRawSection:
 *       type: object
 *       description: Raw section data from OSM startup endpoint
 *       properties:
 *         sectionid:
 *           type: string
 *           description: Unique section identifier
 *           example: "12345"
 *         sectionname:
 *           type: string
 *           description: Section name
 *           example: "1st Walton Scouts"
 *         sectiontype:
 *           type: string
 *           description: Type of scout section
 *           enum: ["beavers", "cubs", "scouts", "explorers", "network", "adults"]
 *           example: "scouts"
 *         groupname:
 *           type: string
 *           description: Parent group name
 *           example: "1st Walton Scout Group"
 *         groupid:
 *           type: string
 *           description: Parent group identifier
 *           example: "6789"
 *     
 *     OSMRawEvent:
 *       type: object
 *       description: Raw event data from OSM events endpoint
 *       properties:
 *         eventid:
 *           type: string
 *           description: Unique event identifier
 *           example: "11111"
 *         name:
 *           type: string
 *           description: Event name
 *           example: "Weekly Meeting"
 *         startdate:
 *           type: string
 *           format: date
 *           description: Event start date (YYYY-MM-DD)
 *           example: "2023-10-15"
 *         enddate:
 *           type: string
 *           format: date
 *           description: Event end date (YYYY-MM-DD)
 *           example: "2023-10-15"
 *         starttime:
 *           type: string
 *           description: Event start time (HH:MM)
 *           example: "19:00"
 *         endtime:
 *           type: string
 *           description: Event end time (HH:MM)
 *           example: "20:30"
 *         location:
 *           type: string
 *           description: Event location
 *           example: "Scout Hall"
 *         notes:
 *           type: string
 *           description: Event notes/description
 *           example: "Bring uniform and neckerchief"
 *         cost:
 *           type: string
 *           description: Event cost
 *           example: "2.00"
 *         attendancelimit:
 *           type: string
 *           description: Maximum number of attendees
 *           example: "30"
 *         publicnotes:
 *           type: string
 *           description: Public notes visible to parents
 *           example: "Meet at 7pm sharp"
 *     
 *     OSMRawAttendance:
 *       type: object
 *       description: Raw attendance data from OSM attendance endpoint
 *       allOf:
 *         - $ref: '#/components/schemas/OSMMetadata'
 *         - type: object
 *           properties:
 *             attending:
 *               type: string
 *               enum: ["Yes", "No", ""]
 *               description: Attendance status
 *               example: "Yes"
 *             attendingdate:
 *               type: string
 *               format: date
 *               description: Date attendance was recorded
 *               example: "2023-10-15"
 *             notes:
 *               type: string
 *               description: Attendance notes
 *               example: "Left early"
 *     
 *     OSMRawFlexiRecord:
 *       type: object
 *       description: Raw flexi record from OSM flexi records endpoint
 *       properties:
 *         extraid:
 *           type: string
 *           description: Flexible record identifier
 *           example: "22222"
 *         name:
 *           type: string
 *           description: Flexible record name
 *           example: "Activity Badges"
 *         archived:
 *           type: string
 *           enum: ["0", "1"]
 *           description: Whether record is archived (0=active, 1=archived)
 *           example: "0"
 *         config:
 *           type: object
 *           description: Record configuration object
 *           additionalProperties: true
 *     
 *     OSMRawFlexiStructure:
 *       type: object
 *       description: Raw flexi record structure from OSM structure endpoint
 *       properties:
 *         structure:
 *           type: object
 *           description: Field structure definitions
 *           additionalProperties:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Field display name
 *                 example: "Date Completed"
 *               type:
 *                 type: string
 *                 description: Field data type
 *                 enum: ["text", "date", "select", "number", "textarea"]
 *                 example: "date"
 *               required:
 *                 type: string
 *                 enum: ["0", "1"]
 *                 description: Whether field is required
 *                 example: "0"
 *               tooltip:
 *                 type: string
 *                 description: Field tooltip/help text
 *                 example: "Date the badge was completed"
 *         columns:
 *           type: object
 *           description: Column configuration for display
 *           additionalProperties: true
 *     
 *     OSMRawFlexiData:
 *       type: object
 *       description: Raw flexi record data from OSM data endpoint
 *       allOf:
 *         - $ref: '#/components/schemas/OSMMetadata'
 *         - type: object
 *           description: Dynamic fields with f_ prefix
 *           additionalProperties:
 *             type: string
 *             description: Field value (f_1, f_2, etc.)
 *             example: "2023-10-15"
 *     
 *     OSMRawStartupUser:
 *       type: object
 *       description: Raw user data from OSM startup endpoint
 *       properties:
 *         userid:
 *           type: string
 *           description: User identifier
 *           example: "54321"
 *         firstname:
 *           type: string
 *           description: User first name
 *           example: "Jane"
 *         lastname:
 *           type: string
 *           description: User last name
 *           example: "Leader"
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *           example: "jane.leader@example.com"
 *         phone1:
 *           type: string
 *           description: Primary phone number
 *           example: "01234567890"
 *         phone2:
 *           type: string
 *           description: Secondary phone number
 *           example: "07890123456"
 *     
 *     OSMRawStartupData:
 *       type: object
 *       description: Raw startup data from OSM (wrapped in JavaScript)
 *       properties:
 *         user:
 *           $ref: '#/components/schemas/OSMRawStartupUser'
 *         sections:
 *           type: object
 *           description: Available sections for user
 *           additionalProperties:
 *             $ref: '#/components/schemas/OSMRawSection'
 *         terms:
 *           type: object
 *           description: Available terms for sections
 *           additionalProperties:
 *             $ref: '#/components/schemas/OSMRawTerm'
 *         roles:
 *           type: object
 *           description: User roles by section
 *           additionalProperties:
 *             type: object
 *             properties:
 *               level:
 *                 type: string
 *                 description: Permission level
 *                 example: "10"
 *               rolename:
 *                 type: string
 *                 description: Role display name
 *                 example: "Section Leader"
 */