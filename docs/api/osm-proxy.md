# OSM Proxy Endpoints

This document describes the OSM (Online Scout Manager) proxy endpoints provided by the Vikings OSM Backend API.

## Overview

These endpoints act as a proxy to the OSM API, providing:
- Authentication handling with Bearer token validation
- Dual-layer rate limiting (backend + OSM API)
- Standardized error handling and response formatting
- Comprehensive logging and monitoring
- Request validation and parameter checking

All endpoints require authentication via the `Authorization` header with a Bearer token obtained through the OAuth flow.

## Authentication

Include the access token in the Authorization header:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Rate Limiting

All endpoints are subject to dual-layer rate limiting:
- **Backend Rate Limit**: 100 requests per minute per session/IP
- **OSM API Rate Limit**: Respects OSM's rate limits (tracked per user session)

Rate limit information is included in all responses under `_rateLimitInfo`:

```json
{
  "_rateLimitInfo": {
    "backend": {
      "remaining": 95,
      "limit": 100,
      "resetTime": 1699123456000,
      "window": "per minute"
    },
    "osm": {
      "limit": 1000,
      "remaining": 742,
      "resetTime": 1699126800000,
      "window": "per hour",
      "available": true
    }
  }
}
```

## Endpoints Overview

### Data Retrieval Endpoints (GET)

| Endpoint | Purpose | Required Parameters |
|----------|---------|-------------------|
| `/get-terms` | Get available terms | None |
| `/get-section-config` | Get section configuration | None |
| `/get-user-roles` | Get user roles and permissions | None |
| `/get-events` | Get events for section/term | `section_id`, `term_id` |
| `/get-event-attendance` | Get event attendance | `section_id`, `event_id` |
| `/get-event-sharing-status` | Get event sharing status | `section_id`, `event_id` |
| `/get-shared-event-attendance` | Get shared event attendance | `section_id`, `event_id` |
| `/get-event-summary` | Get event summary | `section_id`, `event_id` |
| `/get-contact-details` | Get member contact details | `section_id`, `term_id` |
| `/get-list-of-members` | Get member list | `section_id`, `term_id` |
| `/get-flexi-records` | Get flexi records | `section_id`, `term_id` |
| `/get-flexi-structure` | Get flexi record structure | `section_id` |
| `/get-single-flexi-record` | Get single flexi record | `section_id`, `scout_id` |
| `/get-startup-data` | Get user startup data | None |
| `/get-payment-schemes` | Get online payment schemes (subscriptions) | `sectionid` |
| `/get-payment-schedule` | Get scheme settings and payment schedule | `sectionid`, `schemeid` (optional `termid`, `allpayments`) |
| `/get-payment-status` | Get per-member payment status | `sectionid`, `schemeid`, `termid` (optional `payload`) |

### Data Modification Endpoints (POST)

| Endpoint | Purpose | Required Parameters |
|----------|---------|-------------------|
| `/update-flexi-record` | Update flexi record | `section_id`, `term_id`, `scout_id`, `field_id`, `value` |
| `/multi-update-flexi-record` | Batch update flexi records | `section_id`, `term_id`, `field_id`, `value`, `scout_ids` |
| `/get-members-grid` | Get members grid data | `section_id`, `term_id` |

## Detailed Endpoint Documentation

### GET /get-terms

Get available terms for the user's sections.

**Headers:**
- `Authorization`: Bearer token (required)

**Response (200 OK):**
```json
{
  "data": [
    {
      "termid": "123",
      "name": "Autumn 2023",
      "startdate": "2023-09-01",
      "enddate": "2023-12-15",
      "sectionid": "12345"
    }
  ],
  "_rateLimitInfo": {
    "backend": { "remaining": 99, "limit": 100 },
    "osm": { "remaining": 450, "limit": 1000 }
  }
}
```

### GET /get-section-config

Get section configuration and details.

**Headers:**
- `Authorization`: Bearer token (required)

**Response (200 OK):**
```json
{
  "data": {
    "sectionid": "12345",
    "sectionname": "1st Example Scout Group",
    "sectiontype": "scouts",
    "country": "UK",
    "settings": {
      "currency": "GBP",
      "timezone": "Europe/London"
    }
  },
  "_rateLimitInfo": { ... }
}
```

### GET /get-user-roles

Get user roles and permissions across sections.

**Headers:**
- `Authorization`: Bearer token (required)

**Response (200 OK):**
```json
{
  "data": [
    {
      "sectionid": "12345",
      "section": "1st Example Scout Group",
      "sectionname": "1st Example Scout Group",
      "groupname": "1st Example Group",
      "permissions": {
        "member": ["read", "write"],
        "programme": ["read"],
        "events": ["read", "write"]
      }
    }
  ],
  "_rateLimitInfo": { ... }
}
```

### GET /get-events

Get events for a specific section and term.

**Headers:**
- `Authorization`: Bearer token (required)

**Query Parameters:**
- `section_id` (string, required) - Section ID
- `term_id` (string, required) - Term ID

**Response (200 OK):**
```json
{
  "data": [
    {
      "eventid": "789",
      "name": "Camp Weekend",
      "startdate": "2023-10-15",
      "enddate": "2023-10-17",
      "starttime": "18:00",
      "endtime": "16:00",
      "location": "Scout Camp",
      "notes": "Bring sleeping bag",
      "cost": "25.00",
      "attendancelimit": 24,
      "attendancereminder": 7
    }
  ],
  "_rateLimitInfo": { ... }
}
```

### GET /get-flexi-records

Get flexi records for members in a section and term.

**Headers:**
- `Authorization`: Bearer token (required)

**Query Parameters:**
- `section_id` (string, required) - Section ID
- `term_id` (string, required) - Term ID

**Response (200 OK):**
```json
{
  "data": [
    {
      "scoutid": "456",
      "firstname": "John",
      "lastname": "Doe",
      "dob": "2010-05-15",
      "flexirecords": {
        "f_789": {
          "fieldid": "f_789",
          "name": "Swimming Badge",
          "value": "Stage 3",
          "completed": "2023-09-15"
        }
      }
    }
  ],
  "_rateLimitInfo": { ... }
}
```

### POST /update-flexi-record

Update a flexi record for a specific member.

**Headers:**
- `Authorization`: Bearer token (required)
- `Content-Type`: application/json

**Request Body:**
```json
{
  "section_id": "12345",
  "term_id": "123",
  "scout_id": "456",
  "field_id": "f_789",
  "value": "Stage 4"
}
```

**Validation:**
- `section_id`: Required, non-empty string
- `term_id`: Required, non-empty string
- `scout_id`: Required, non-empty string
- `field_id`: Required, must match format `f_\d+`
- `value`: Required, non-empty string

**Response (200 OK):**
```json
{
  "data": {
    "success": true,
    "message": "Flexi record updated successfully",
    "updated": {
      "scout_id": "456",
      "field_id": "f_789",
      "old_value": "Stage 3",
      "new_value": "Stage 4"
    }
  },
  "_rateLimitInfo": { ... }
}
```

### POST /multi-update-flexi-record

Batch update the same field for multiple members.

**Headers:**
- `Authorization`: Bearer token (required)
- `Content-Type`: application/json

**Request Body:**
```json
{
  "section_id": "12345",
  "term_id": "123",
  "field_id": "f_789",
  "value": "Completed",
  "scout_ids": ["456", "457", "458"]
}
```

**Response (200 OK):**
```json
{
  "data": {
    "success": true,
    "message": "Batch update completed",
    "updated_count": 3,
    "failed_count": 0,
    "results": [
      {
        "scout_id": "456",
        "success": true,
        "message": "Updated successfully"
      }
    ]
  },
  "_rateLimitInfo": { ... }
}
```

### POST /get-members-grid

Get members data in grid format (requires POST due to complex parameters).

**Headers:**
- `Authorization`: Bearer token (required)
- `Content-Type`: application/json

**Request Body:**
```json
{
  "section_id": "12345",
  "term_id": "123",
  "include_inactive": false
}
```

**Response (200 OK):**
```json
{
  "data": {
    "identifier": "scoutid",
    "label": "name",
    "items": [
      {
        "scoutid": "456",
        "firstname": "John",
        "lastname": "Doe",
        "name": "John Doe",
        "dob": "2010-05-15",
        "started": "2023-01-15",
        "active": true
      }
    ]
  },
  "_rateLimitInfo": { ... }
}
```

### Online Payments / Subscriptions (GET)

These endpoints proxy OSM's `ext/finances/onlinepayments/` API family, which is
where subscription (subs) schemes live. They all require the
`section:finance:read` OAuth scope, so the OSM app registration must grant that
scope and users must re-authorise before these calls succeed.

OSM does not publish this API. The URLs and query names below match what the
OSM web app itself sends (captured from its network requests) and what the
`osm-extender/osm` Ruby gem and `hippysurfer/scout-records` use: every action
sits on the same `ext/finances/onlinepayments/` URL and takes `sectionid`,
`schemeid` and `termid`. OSM answers `405 {"error":{"message":"Invalid
parameter"}}` to any other query name, so never guess at parameters here.
The response shapes are those the community clients parse; confirm against a
saved OSM response before relying on a field.

Only the parameters listed for each endpoint are forwarded to OSM; any other
query keys are dropped. Each forwarded value must be a single query-string
value: repeated or bracketed keys (which parse as arrays/objects) and values
supplied in a request body are rejected with `400`.

Responses are always JSON objects. If OSM returns a top-level array it is
wrapped as `{ "items": [...] }`, and a bare scalar as `{ "value": ... }`, so
the `_rateLimitInfo` field can always be attached without altering the data.

The requested OAuth scope can be overridden per deployment with the
`OSM_OAUTH_SCOPE` environment variable (see `config/osm.js`). The user also
needs finance read permission on the section (`permissions.finance >= 10` in
`/get-user-roles`); sections without it should not be queried.

#### GET /get-payment-schemes

Lists the payment schemes configured for a section. Use the returned
`schemeid` with the other finance endpoints.

**Query Parameters:** `sectionid` (required)

```bash
curl "https://your-backend-api.com/get-payment-schemes?sectionid=49097" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (200 OK)** (captured from OSM on 2026-09-04):
```json
{
  "identifier": "schemeid",
  "label": "name",
  "has_accounts": true,
  "items": [
    {
      "schemeid": "60603",
      "accountid": 11507,
      "name": "General Subscriptions",
      "currency": "GBP",
      "require_all": 0,
      "one_off_payments": false,
      "amount_overdue": "0.00"
    }
  ],
  "bank_accounts": [ { "name": "…", "accountid": "11507", "gateway": "gocardless" } ],
  "config": { "...section config, same object as /get-user-roles sectionConfig..." },
  "_rateLimitInfo": { ... }
}
```

`amount_overdue` is the scheme-wide overdue total, ready for a summary tile.

#### GET /get-payment-schedule

Scheme settings plus its dated payments. Pass `termid` for one term's
payments or `allpayments=true` for every payment ever scheduled.

**Query Parameters:** `sectionid`, `schemeid` (required); `termid`, `allpayments` (optional)

**Response (200 OK):**
```json
{
  "schemeid": "60603",
  "accountid": "1234",
  "name": "General Subscriptions",
  "description": "",
  "archived": "0",
  "giftaid": "1",
  "defaulton": "1",
  "paynow": "-1",
  "preauth_amount": "100.00",
  "payments": [
    { "paymentid": "123", "name": "Autumn 2026", "date": "2026-09-15", "amount": "45.00", "archived": "0" }
  ],
  "_rateLimitInfo": { ... }
}
```

Flags are the strings `"0"` / `"1"`. `defaulton` means every member is expected
to pay (the gem calls it `require_all`).

#### GET /get-payment-status

Per-member payment status for a scheme and term. Always send `payload=1`
(the OSM UI does): the response is then an envelope whose `data.members`
entries carry one **object** per payment, keyed by `paymentid`. Without
`payload`, community clients report a flat `items` array where each payment
is a JSON *string* instead.

**Query Parameters:** `sectionid`, `schemeid`, `termid` (required); `payload` (send `1`)

**Response (200 OK)** (captured from OSM on 2026-09-04, `payload=1`):
```json
{
  "status": true,
  "error": null,
  "data": {
    "members": [
      {
        "scoutid": "2111171",
        "firstname": "…",
        "lastname": "…",
        "dob": "…",
        "patrolid": "119078",
        "patrolleader": "2",
        "photo_guid": "…",
        "startdate": "2024-09-26",
        "directdebit": "Active",
        "can_remove": true,
        "975153": {
          "date": "2025-04-01",
          "amount": "26.00",
          "active": true,
          "defaulton": true,
          "status": [
            {
              "statusid": "49259537",
              "scoutid": "2111171",
              "schemeid": "60603",
              "paymentid": "975153",
              "statustimestamp": "2025-04-01 11:23:00",
              "status": "Payment required",
              "details": "",
              "editable": "0",
              "prevent_automatic_billing": "0",
              "latest": "0",
              "who": "…",
              "firstname": "…"
            }
          ]
        }
      }
    ]
  },
  "meta": [],
  "_rateLimitInfo": { ... }
}
```

Per-payment object: `date` (due date), `amount`, `active` (the payment
applies to this member; `false` for payments dated before they joined),
`defaulton` (member is expected to pay it), `status` (history, **newest
first**). The entry with `"latest": "1"` is the current state and is the first
element; an empty `status` array means nothing has happened yet (a future
payment, or an inactive one). `directdebit` is `Active` or `Inactive`. A
normal successful sequence is `Initiated` → `Submitted` → `Paid` → `Received`;
other values seen: `Payment required`, `Payment not required`; the gem also
lists `Paid manually`.

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Access token is required in Authorization header",
  "_rateLimitInfo": {
    "backend": { "remaining": 99, "limit": 100 }
  }
}
```

### 400 Bad Request
```json
{
  "error": "Missing required parameter: section_id",
  "details": "section_id is required for this endpoint",
  "_rateLimitInfo": { ... }
}
```

### 422 Unprocessable Entity
```json
{
  "error": "Invalid field_id format",
  "details": "field_id must match pattern f_\\d+ (e.g., f_123)",
  "received": "invalid_field",
  "_rateLimitInfo": { ... }
}
```

### 429 Rate Limited
```json
{
  "error": "OSM API rate limit exceeded",
  "rateLimitInfo": {
    "osm": {
      "limit": 1000,
      "remaining": 0,
      "resetTime": 1699126800000,
      "rateLimited": true
    }
  },
  "message": "Please wait before making more requests"
}
```

### 502 Bad Gateway
```json
{
  "error": "Upstream returned non-JSON",
  "details": "Response content preview...",
  "statusCode": 502
}
```

### 503 Service Unavailable
```json
{
  "error": "OSM API temporarily unavailable",
  "details": "Service maintenance in progress",
  "retryAfter": 300
}
```

## Usage Examples

### Basic Data Retrieval

```javascript
const getEvents = async (sectionId, termId, accessToken) => {
  try {
    const response = await fetch(`/get-events?section_id=${sectionId}&term_id=${termId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (response.ok) {
      const { data, _rateLimitInfo } = await response.json();
      console.log('Rate limit remaining:', _rateLimitInfo.backend.remaining);
      return data;
    } else {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to get events:', error);
    throw error;
  }
};
```

### Update Flexi Record with Error Handling

```javascript
const updateFlexiRecord = async (params, accessToken) => {
  try {
    const response = await fetch('/update-flexi-record', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('Update successful:', result.data.message);
      return result.data;
    } else {
      // Handle specific error types
      if (response.status === 422) {
        throw new Error(`Validation error: ${result.details}`);
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait before retrying.');
      } else {
        throw new Error(result.error || 'Update failed');
      }
    }
  } catch (error) {
    console.error('Failed to update flexi record:', error);
    throw error;
  }
};
```

### Batch Update with Progress Tracking

```javascript
const batchUpdateFlexiRecord = async (params, accessToken) => {
  try {
    const response = await fetch('/multi-update-flexi-record', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      const { updated_count, failed_count, results } = result.data;
      console.log(`Batch update completed: ${updated_count} successful, ${failed_count} failed`);
      
      // Log any failures
      results.filter(r => !r.success).forEach(failure => {
        console.warn(`Failed to update scout ${failure.scout_id}: ${failure.message}`);
      });
      
      return result.data;
    } else {
      throw new Error(result.error || 'Batch update failed');
    }
  } catch (error) {
    console.error('Failed to batch update:', error);
    throw error;
  }
};
```

### Rate Limit Monitoring

```javascript
const monitorRateLimit = (rateLimitInfo) => {
  const { backend, osm } = rateLimitInfo;
  
  // Warn when approaching limits
  if (backend.remaining < 10) {
    console.warn(`Backend rate limit low: ${backend.remaining}/${backend.limit} remaining`);
  }
  
  if (osm.remaining < 50) {
    console.warn(`OSM rate limit low: ${osm.remaining}/${osm.limit} remaining`);
  }
  
  // Calculate time until reset
  const backendResetIn = Math.max(0, backend.resetTime - Date.now());
  const osmResetIn = Math.max(0, osm.resetTime - Date.now());
  
  return {
    backendResetIn: Math.ceil(backendResetIn / 1000), // seconds
    osmResetIn: Math.ceil(osmResetIn / 1000), // seconds
    shouldThrottle: backend.remaining < 5 || osm.remaining < 10
  };
};
```

## Best Practices

### Error Handling
- Always check response status before processing data
- Handle rate limiting gracefully with exponential backoff
- Log errors with sufficient context for debugging
- Provide user-friendly error messages

### Rate Limiting
- Monitor rate limit headers in responses
- Implement client-side throttling when approaching limits
- Use batch operations when updating multiple records
- Cache frequently accessed data to reduce API calls

### Data Validation
- Validate parameters before sending requests
- Use proper field ID formats (`f_\d+`)
- Ensure required parameters are present
- Handle validation errors appropriately

### Performance
- Use appropriate endpoints for your use case
- Batch operations when possible
- Implement caching for static data
- Monitor response times and optimize accordingly

---

*Last updated: September 6, 2025*