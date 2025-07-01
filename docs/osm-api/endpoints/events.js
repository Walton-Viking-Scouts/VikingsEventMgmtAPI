/**
 * @swagger
 * /ext/events/summary/:
 *   get:
 *     summary: Get events summary (OSM Events Extension)
 *     description: |
 *       Retrieves all events for a specific section and term.
 *       
 *       **Actual OSM Endpoint:** `GET https://www.onlinescoutmanager.co.uk/ext/events/summary/?action=get&sectionid={id}&termid={id}`
 *       
 *       Returns events including meetings, activities, camps, and other scheduled activities.
 *       Each event contains dates, times, location, and other details.
 *     tags: [OSM Events Extension]
 *     parameters:
 *       - in: query
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [get]
 *         description: Extension action to perform
 *         example: get
 *       - $ref: '#/components/parameters/sectionid'
 *       - $ref: '#/components/parameters/termid'
 *     responses:
 *       200:
 *         description: Events for the section and term
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 $ref: '#/components/schemas/OSMRawEvent'
 *             example:
 *               "11111":
 *                 eventid: "11111"
 *                 name: "Weekly Meeting"
 *                 startdate: "2023-10-15"
 *                 enddate: "2023-10-15"
 *                 starttime: "19:00"
 *                 endtime: "20:30"
 *                 location: "Scout Hall"
 *                 cost: "2.00"
 *                 notes: "Bring uniform"
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
 * 
 * /ext/events/event/:
 *   get:
 *     summary: Get event attendance (OSM Events Extension)
 *     description: |
 *       Retrieves attendance information for all members for a specific event.
 *       
 *       **Actual OSM Endpoint:** `GET https://www.onlinescoutmanager.co.uk/ext/events/event/?action=getAttendance&eventid={id}&sectionid={id}&termid={id}`
 *       
 *       Shows attendance status for each member including notes and attendance date.
 *       Attendance values can be "Yes", "No", or empty string.
 *     tags: [OSM Events Extension]
 *     parameters:
 *       - in: query
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [getAttendance]
 *         description: Extension action to perform
 *         example: getAttendance
 *       - $ref: '#/components/parameters/eventid'
 *       - $ref: '#/components/parameters/sectionid'
 *       - $ref: '#/components/parameters/termid'
 *     responses:
 *       200:
 *         description: Attendance data for the event
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 $ref: '#/components/schemas/OSMRawAttendance'
 *             example:
 *               "33333":
 *                 identifier: "33333"
 *                 firstname: "John"
 *                 lastname: "Smith"
 *                 patrol: "Eagles"
 *                 attending: "Yes"
 *                 attendingdate: "2023-10-15"
 *                 notes: ""
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