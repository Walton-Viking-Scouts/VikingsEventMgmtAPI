# OSM Proxy Endpoints Guide

These API endpoints proxy requests to the Online Scout Manager (OSM) API. They handle CORS and allow the backend to manage aspects like rate limiting and consistent authentication.

**Authentication:** All endpoints listed here require an `Authorization: Bearer <ACCESS_TOKEN>` header, where `<ACCESS_TOKEN>` is the token obtained through the [Authentication Flow](./authentication.md).

**Rate Limiting:** Be mindful of [Rate Limiting](./rate_limiting.md). Responses may include headers related to rate limits.

---

## 1. Get Terms

*   **Endpoint:** `GET /get-terms`
*   **Description:** Retrieves a list of terms (e.g., school terms) from OSM.
*   **Headers:**
    *   `Authorization: Bearer <ACCESS_TOKEN>` (Required)
*   **Query Parameters:** None.
*   **Example Request:**
    ```bash
    curl -X GET "https://your-backend-api.com/get-terms" \
         -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```
*   **Example Successful Response (`200 OK`):**
    ```json
    {
        "12345": "Spring Term 2023",
        "12346": "Summer Term 2023",
        "12347": "Autumn Term 2023"
        // ... more terms
    }
    ```
    *Note: The structure is an object where keys are term IDs and values are term names.*
*   **Potential Error Responses:**
    *   `401 Unauthorized`: If the access token is missing, invalid, or expired.
    *   `429 Too Many Requests`: If rate limit is exceeded.
    *   `500 Internal Server Error`: If there's an issue on the server or with the OSM API.
    *   `502 Bad Gateway`: If OSM returns an invalid response.

---

## 2. Get Section Config

*   **Endpoint:** `GET /get-section-config`
*   **Description:** Retrieves configuration details for a specific section.
*   **Headers:**
    *   `Authorization: Bearer <ACCESS_TOKEN>` (Required)
*   **Query Parameters:**
    *   `sectionid` (string, required): The ID of the section.
    *   `access_token` (string, **deprecated**, use Authorization header instead): The access token. *Note: While the code shows this as a query param, best practice and other endpoints suggest standardizing on the Authorization header.*
*   **Example Request:**
    ```bash
    curl -X GET "https://your-backend-api.com/get-section-config?sectionid=SECTION_ID" \
         -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```
*   **Example Successful Response (`200 OK`):**
    ```json
    {
        "section_name": "1st Example Scouts",
        "group_name": "Example District",
        // ... other configuration details
        "custom_fields": [
            // ...
        ]
    }
    ```
*   **Potential Error Responses:**
    *   `400 Bad Request`: If `sectionid` is missing.
    *   `401 Unauthorized`: If the access token is missing or invalid.
    *   `429 Too Many Requests`.
    *   `500 Internal Server Error`.
    *   `502 Bad Gateway`.

---

## 3. Get User Roles

*   **Endpoint:** `GET /get-user-roles`
*   **Description:** Retrieves the roles associated with the authenticated user.
*   **Headers:**
    *   `Authorization: Bearer <ACCESS_TOKEN>` (Required)
*   **Query Parameters:** None.
*   **Example Request:**
    ```bash
    curl -X GET "https://your-backend-api.com/get-user-roles" \
         -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```
*   **Example Successful Response (`200 OK`):**
    ```json
    {
        "10001": { // Section ID
            "sectionid": "10001",
            "role": "Leader",
            "userid": "USER_ID",
            "permissions": ["event:read", "member:read"],
            "groupid": "500",
            "groupname": "Example Group",
            "section": "Beavers",
            "sectionname": "Monday Beavers"
        }
        // ... other roles for other sections
    }
    ```
*   **Potential Error Responses:**
    *   `401 Unauthorized`.
    *   `429 Too Many Requests`.
    *   `500 Internal Server Error`.
    *   `502 Bad Gateway`.
    *Note: The original controller code shows this as a POST request to OSM, but the backend route is GET. The documentation reflects the backend route.*

---

## 4. Get Events

*   **Endpoint:** `GET /get-events`
*   **Description:** Retrieves a list of events for a specific section and term.
*   **Headers:**
    *   `Authorization: Bearer <ACCESS_TOKEN>` (Required)
*   **Query Parameters:**
    *   `sectionid` (string, required): The ID of the section.
    *   `termid` (string, required): The ID of the term.
*   **Example Request:**
    ```bash
    curl -X GET "https://your-backend-api.com/get-events?sectionid=SECTION_ID&termid=TERM_ID" \
         -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```
*   **Example Successful Response (`200 OK`):**
    ```json
    {
        "items": [
            {
                "eventid": "EVENT_ID_1",
                "name": "Camp Weekend",
                "startdate": "2023-10-20",
                "enddate": "2023-10-22",
                // ... other event details
            },
            {
                "eventid": "EVENT_ID_2",
                "name": "Weekly Meeting",
                "startdate": "2023-10-23",
                "enddate": "2023-10-23",
                // ... other event details
            }
        ],
        "status": "success"
    }
    ```
*   **Potential Error Responses:**
    *   `400 Bad Request`: If `sectionid` or `termid` are missing.
    *   `401 Unauthorized`.
    *   `429 Too Many Requests`.
    *   `500 Internal Server Error`: Could also indicate an empty or invalid JSON response from OSM.
    *   `502 Bad Gateway`.

---

## 5. Get Event Attendance

*   **Endpoint:** `GET /get-event-attendance`
*   **Description:** Retrieves attendance data for a specific event.
*   **Headers:**
    *   `Authorization: Bearer <ACCESS_TOKEN>` (Required)
*   **Query Parameters:**
    *   `sectionid` (string, required): The ID of the section.
    *   `termid` (string, required): The ID of the term (context for the event).
    *   `eventid` (string, required): The ID of the event.
*   **Example Request:**
    ```bash
    curl -X GET "https://your-backend-api.com/get-event-attendance?sectionid=SECTION_ID&termid=TERM_ID&eventid=EVENT_ID" \
         -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```
*   **Example Successful Response (`200 OK`):**
    ```json
    {
        "attendance": [
            {
                "memberid": "MEMBER_ID_1",
                "firstname": "John",
                "lastname": "Doe",
                "attending": "yes", // or "no", "maybe"
                // ... other attendance details
            }
        ],
        "event_details": {
            "name": "Camp Weekend",
            // ...
        }
    }
    ```
*   **Potential Error Responses:**
    *   `400 Bad Request`: If `sectionid`, `termid`, or `eventid` are missing.
    *   `401 Unauthorized`.
    *   `429 Too Many Requests`.
    *   `500 Internal Server Error`.
    *   `502 Bad Gateway`.

---

## 6. Get Contact Details

*   **Endpoint:** `GET /get-contact-details`
*   **Description:** Retrieves contact details for a specific member (scout).
*   **Headers:**
    *   `Authorization: Bearer <ACCESS_TOKEN>` (Required)
*   **Query Parameters:**
    *   `sectionid` (string, required): The ID of the section.
    *   `scoutid` (string, required): The ID of the member (scout).
*   **Example Request:**
    ```bash
    curl -X GET "https://your-backend-api.com/get-contact-details?sectionid=SECTION_ID&scoutid=SCOUT_ID" \
         -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```
*   **Example Successful Response (`200 OK`):**
    ```json
    {
        "member_id": "SCOUT_ID",
        "firstname": "Jane",
        "lastname": "Doe",
        "email": "jane.doe@example.com",
        "phone": "123-456-7890",
        // ... other contact fields and parent/guardian details
    }
    ```
*   **Potential Error Responses:**
    *   `400 Bad Request`: If `sectionid` or `scoutid` are missing.
    *   `401 Unauthorized`.
    *   `429 Too Many Requests`.
    *   `500 Internal Server Error`.
    *   `502 Bad Gateway`: If OSM returns non-JSON.

---

## 7. Get List of Members

*   **Endpoint:** `GET /get-list-of-members`
*   **Description:** Retrieves a list of members for a specific section.
*   **Headers:**
    *   `Authorization: Bearer <ACCESS_TOKEN>` (Required)
*   **Query Parameters:**
    *   `sectionid` (string, required): The ID of the section.
*   **Example Request:**
    ```bash
    curl -X GET "https://your-backend-api.com/get-list-of-members?sectionid=SECTION_ID" \
         -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```
*   **Example Successful Response (`200 OK`):**
    ```json
    {
        "identifier": "scoutid", // Field used as the unique ID for members
        "label": "fullname",    // Field used as the display name
        "items": [
            {
                "scoutid": "MEMBER_ID_1",
                "firstname": "John",
                "lastname": "Doe",
                "fullname": "Doe, John",
                // ... other member summary fields
            },
            {
                "scoutid": "MEMBER_ID_2",
                "firstname": "Jane",
                "lastname": "Smith",
                "fullname": "Smith, Jane",
                // ...
            }
        ]
    }
    ```
*   **Potential Error Responses:**
    *   `400 Bad Request`: If `sectionid` is missing.
    *   `401 Unauthorized`.
    *   `429 Too Many Requests`.
    *   `500 Internal Server Error`.
    *   `502 Bad Gateway`: If OSM returns non-JSON.

---

## 8. Get Flexi-Records

*   **Endpoint:** `GET /get-flexi-records`
*   **Description:** Retrieves flexi-records (custom data fields/tables) for a section. Can optionally include archived records.
*   **Headers:**
    *   `Authorization: Bearer <ACCESS_TOKEN>` (Required)
*   **Query Parameters:**
    *   `sectionid` (string, required): The ID of the section.
    *   `archived` (boolean, optional): Set to `true` to include archived records. Defaults to `false` if not provided.
*   **Example Request:**
    ```bash
    # Get active flexi-records
    curl -X GET "https://your-backend-api.com/get-flexi-records?sectionid=SECTION_ID" \
         -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

    # Get flexi-records including archived
    curl -X GET "https://your-backend-api.com/get-flexi-records?sectionid=SECTION_ID&archived=true" \
         -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```
*   **Example Successful Response (`200 OK`):**
    ```json
    [ // An array of flexi-record definitions
        {
            "extraid": "FLEXI_RECORD_ID_1",
            "name": "T-Shirt Sizes",
            "type": "members", // or "contacts"
            // ... other metadata about the flexi-record
        },
        {
            "extraid": "FLEXI_RECORD_ID_2",
            "name": "Dietary Requirements",
            "type": "members",
            // ...
        }
    ]
    ```
*   **Potential Error Responses:**
    *   `400 Bad Request`: If `sectionid` is missing.
    *   `401 Unauthorized`.
    *   `429 Too Many Requests`.
    *   `500 Internal Server Error`.
    *   `502 Bad Gateway`: If OSM returns non-JSON.

---

## 9. Get Flexi-Record Structure

*   **Endpoint:** `GET /get-flexi-structure`
*   **Description:** Retrieves the structure (columns and field types) of a specific flexi-record.
*   **Headers:**
    *   `Authorization: Bearer <ACCESS_TOKEN>` (Required)
*   **Query Parameters:**
    *   `sectionid` (string, required): The ID of the section.
    *   `flexirecordid` (string, required): The ID of the flexi-record (obtained from `/get-flexi-records`, usually the `extraid` field).
*   **Example Request:**
    ```bash
    curl -X GET "https://your-backend-api.com/get-flexi-structure?sectionid=SECTION_ID&flexirecordid=FLEXI_RECORD_ID" \
         -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```
*   **Example Successful Response (`200 OK`):**
    ```json
    {
        "name": "T-Shirt Sizes",
        "columns": {
            "column_id_1": {
                "name": "Size",
                "type": "dropdown", // e.g., text, number, date, dropdown
                "options": { "S": "Small", "M": "Medium", "L": "Large" },
                // ... other column properties
            },
            "column_id_2": {
                "name": "Date Ordered",
                "type": "date",
                // ...
            }
        },
        // ... other structure details
    }
    ```
*   **Potential Error Responses:**
    *   `400 Bad Request`: If `sectionid` or `flexirecordid` are missing.
    *   `401 Unauthorized`.
    *   `429 Too Many Requests`.
    *   `500 Internal Server Error`.
    *   `502 Bad Gateway`: If OSM returns non-JSON.

---

## 10. Get Single Flexi-Record Data

*   **Endpoint:** `GET /get-single-flexi-record`
*   **Description:** Retrieves the data entries for a specific flexi-record within a section and term. This gets the actual values entered for members against the defined flexi-record structure.
*   **Headers:**
    *   `Authorization: Bearer <ACCESS_TOKEN>` (Required)
*   **Query Parameters:**
    *   `sectionid` (string, required): The ID of the section.
    *   `termid` (string, required): The ID of the term.
    *   `flexirecordid` (string, required): The ID of the flexi-record (referred to as `extraid` in OSM API calls).
*   **Example Request:**
    ```bash
    curl -X GET "https://your-backend-api.com/get-single-flexi-record?sectionid=SECTION_ID&termid=TERM_ID&flexirecordid=FLEXI_RECORD_ID" \
         -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```
*   **Example Successful Response (`200 OK`):**
    ```json
    {
        "data": { // Keyed by member ID (scoutid)
            "MEMBER_ID_1": {
                "column_id_1": "M", // Value for the first column (e.g., T-Shirt Size)
                "column_id_2": "2023-05-10"  // Value for the second column (e.g., Date Ordered)
            },
            "MEMBER_ID_2": {
                "column_id_1": "L",
                "column_id_2": "2023-05-11"
            }
        },
        "meta": {
            // Metadata about the flexi-record, similar to /get-flexi-structure
        }
    }
    ```
*   **Potential Error Responses:**
    *   `400 Bad Request`: If `sectionid`, `termid`, or `flexirecordid` are missing. (Note: `scoutid` is mentioned in controller comments but not used in the URL construction for this endpoint, it seems `termid` is used instead for context).
    *   `401 Unauthorized`.
    *   `429 Too Many Requests`.
    *   `500 Internal Server Error`.
    *   `502 Bad Gateway`: If OSM returns non-JSON.

---

## 11. Update Flexi-Record

*   **Endpoint:** `POST /update-flexi-record`
*   **Description:** Updates a specific field (column) for a member within a flexi-record.
*   **Headers:**
    *   `Authorization: Bearer <ACCESS_TOKEN>` (Required)
    *   `Content-Type: application/json` (Assumed, though controller uses `application/x-www-form-urlencoded` for OSM call) - **Clarification: The backend expects a JSON body from the client, then transforms it.**
*   **Request Body (JSON):**
    ```json
    {
        "sectionid": "SECTION_ID",
        "scoutid": "MEMBER_ID", // The ID of the member
        "flexirecordid": "FLEXI_RECORD_ID", // The ID of the flexi-record table (extraid)
        "columnid": "COLUMN_ID", // The ID of the column within the flexi-record to update
        "value": "NEW_VALUE" // The new value for the field
    }
    ```
*   **Example Request:**
    ```bash
    curl -X POST "https://your-backend-api.com/update-flexi-record" \
         -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
         -H "Content-Type: application/json" \
         -d '{
               "sectionid": "12345",
               "scoutid": "67890",
               "flexirecordid": "FLEX_XYZ",
               "columnid": "COL_ABC",
               "value": "Updated Value"
             }'
    ```
*   **Example Successful Response (`200 OK`):**
    ```json
    {
        "status": "ok", // Or similar success indicator from OSM
        // ... other potential fields from OSM response
    }
    ```
*   **Potential Error Responses:**
    *   `400 Bad Request`: If any required fields in the body are missing.
    *   `401 Unauthorized`.
    *   `429 Too Many Requests`.
    *   `500 Internal Server Error`.
    *   `502 Bad Gateway`.

---
