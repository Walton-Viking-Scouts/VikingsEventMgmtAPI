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
 *     MultiUpdateFlexiRecordRequest:
 *       type: object
 *       required:
 *         - sectionid
 *         - scouts
 *         - value
 *         - column
 *         - flexirecordid
 *       properties:
 *         sectionid:
 *           type: string
 *           description: Section identifier
 *           example: "49097"
 *         scouts:
 *           type: array
 *           items:
 *             type: string
 *           minItems: 1
 *           maxItems: 50
 *           description: Array of scout IDs to update (recommended max 50 for optimal performance)
 *           example: ["1601995", "2060746", "1809627"]
 *         value:
 *           oneOf:
 *             - type: string
 *             - type: number
 *           description: The value to set for all specified scouts
 *           example: "1"
 *         column:
 *           type: string
 *           pattern: "^f_\\d+$"
 *           description: "Field identifier (format: f_1, f_2, etc.)"
 *           example: "f_1"
 *         flexirecordid:
 *           type: string
 *           description: Flexi record identifier (extraid)
 *           example: "72758"
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
 *     
 *     MembersGridRequest:
 *       type: object
 *       required:
 *         - section_id
 *         - term_id
 *       properties:
 *         section_id:
 *           type: string
 *           description: Section identifier
 *           example: "49097"
 *         term_id:
 *           type: string
 *           description: Term identifier
 *           example: "216843"
 *     
 *     MembersGridResponse:
 *       type: object
 *       properties:
 *         members:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OSMMemberWithContacts'
 *         metadata:
 *           $ref: '#/components/schemas/MembersGridMetadata'
 *     
 *     OSMMemberWithContacts:
 *       type: object
 *       properties:
 *         member_id:
 *           type: string
 *           description: Unique member identifier
 *           example: "311708"
 *         first_name:
 *           type: string
 *           description: Member's first name
 *           example: "Luke"
 *         last_name:
 *           type: string
 *           description: Member's last name
 *           example: "Hart"
 *         age:
 *           type: string
 *           description: Member's age in years/months format
 *           example: "17 / 06"
 *         patrol:
 *           type: string
 *           description: Member's patrol or group
 *           example: "Young Leaders (YLs)"
 *         patrol_id:
 *           type: integer
 *           description: Patrol identifier
 *           example: -3
 *         active:
 *           type: boolean
 *           description: Whether member is currently active
 *           example: true
 *         joined:
 *           type: string
 *           format: date
 *           description: Date member joined the section
 *           example: "2024-10-12"
 *         started:
 *           type: string
 *           format: date
 *           description: Date member started with the group
 *           example: "2015-01-14"
 *         end_date:
 *           type: string
 *           format: date
 *           nullable: true
 *           description: Date member left (if applicable)
 *           example: null
 *         date_of_birth:
 *           type: string
 *           format: date
 *           description: Member's date of birth
 *           example: "2007-12-02"
 *         section_id:
 *           type: integer
 *           description: Section identifier
 *           example: 49097
 *         contact_groups:
 *           type: object
 *           additionalProperties:
 *             type: object
 *             additionalProperties:
 *               type: string
 *           description: Contact information organized by groups (e.g., Primary Contact 1, Emergency Contact)
 *           example:
 *             "Primary Contact 1":
 *               "First Name": "Emma"
 *               "Last Name": "Hart"
 *               "Email 1": "hart_emma@hotmail.com"
 *               "Phone 1": "07876187138"
 *             "Primary Contact 2":
 *               "First Name": "Christopher"
 *               "Last Name": "Pratt"
 *               "Email 1": "ChristopherP@waltonviking.uk"
 *               "Phone 1": "07747025678"
 *     
 *     MembersGridMetadata:
 *       type: object
 *       properties:
 *         contact_groups:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ContactGroupInfo'
 *           description: Information about contact group structure
 *         column_mapping:
 *           type: object
 *           additionalProperties:
 *             $ref: '#/components/schemas/ColumnMappingInfo'
 *           description: Mapping of group_column_id to field information
 *     
 *     ContactGroupInfo:
 *       type: object
 *       properties:
 *         group_id:
 *           type: integer
 *           description: Unique group identifier
 *           example: 1
 *         name:
 *           type: string
 *           description: Human-readable group name
 *           example: "Primary Contact 1"
 *         identifier:
 *           type: string
 *           description: System identifier for the group
 *           example: "contact_primary_1"
 *         columns:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ContactColumnInfo'
 *           description: Column definitions for this group
 *     
 *     ContactColumnInfo:
 *       type: object
 *       properties:
 *         column_id:
 *           type: integer
 *           description: Column identifier within the group
 *           example: 2
 *         label:
 *           type: string
 *           description: Human-readable column label
 *           example: "First Name"
 *         type:
 *           type: string
 *           enum: [text, email, telephone, date]
 *           description: Data type of the column
 *           example: "text"
 *         varname:
 *           type: string
 *           description: System variable name for the column
 *           example: "firstname"
 *     
 *     ColumnMappingInfo:
 *       type: object
 *       properties:
 *         label:
 *           type: string
 *           description: Human-readable field label
 *           example: "First Name"
 *         type:
 *           type: string
 *           description: Field data type
 *           example: "text"
 *         varname:
 *           type: string
 *           description: System variable name
 *           example: "firstname"
 *         group_name:
 *           type: string
 *           description: Name of the group this field belongs to
 *           example: "Primary Contact 1"
 */