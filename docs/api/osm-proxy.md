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