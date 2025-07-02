# Multi-Update FlexiRecord API Guide

## Overview

The Multi-Update FlexiRecord API allows you to update the same field for multiple scouts in a single batch operation. This is much more efficient than making individual updates for each scout.

## Endpoint

```
POST /multi-update-flexi-record
```

## Authentication

This endpoint requires a valid OSM Bearer token in the Authorization header.

```
Authorization: Bearer YOUR_OSM_TOKEN
```

## Request Body

```json
{
  "sectionid": "49097",
  "scouts": ["1601995", "2060746", "1809627"],
  "value": "1",
  "column": "f_1",
  "flexirecordid": "72758"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sectionid` | string | Yes | The OSM section ID |
| `scouts` | array | Yes | Array of scout IDs to update |
| `value` | string/number | Yes | The value to set for all scouts |
| `column` | string | Yes | The field column ID (format: f_1, f_2, etc.) |
| `flexirecordid` | string | Yes | The FlexiRecord ID (extraid) |

### Field Validation

- **scouts**: Must be a non-empty array of valid scout ID strings
- **column**: Must match format `f_1`, `f_2`, `f_3`, etc.
- **value**: Can be string or number, will be converted to string for OSM API
- **sectionid**: Must be a valid section ID the user has access to
- **flexirecordid**: Must be a valid FlexiRecord ID for the section

## Response

### Success Response (200 OK)

```json
{
  "status": true,
  "data": {
    "success": true,
    "updated_count": 3,
    "message": "Records updated successfully"
  },
  "_rateLimitInfo": {
    "backend": {
      "limit": 100,
      "remaining": 99,
      "resetTime": 1625097600000,
      "window": "per minute"
    },
    "osm": {
      "limit": 1000,
      "remaining": 995,
      "resetTime": 1625100000000,
      "window": "per hour"
    }
  }
}
```

### Error Responses

#### 400 Bad Request - Missing Parameters

```json
{
  "error": "Missing required parameters: sectionid, scouts (array), value, column, flexirecordid are required, plus Authorization header"
}
```

#### 400 Bad Request - Invalid Field Format

```json
{
  "error": "Invalid field ID format. Expected format: f_1, f_2, etc."
}
```

#### 400 Bad Request - Empty Scouts Array

```json
{
  "error": "scouts array cannot be empty"
}
```

#### 401 Unauthorized

```json
{
  "error": "Access token is required in Authorization header"
}
```

#### 429 Rate Limited

```json
{
  "error": "OSM API rate limit exceeded",
  "rateLimitInfo": {
    "limit": 1000,
    "remaining": 0,
    "resetTime": 1625100000000,
    "retryAfter": 300
  },
  "message": "Please wait before making more requests"
}
```

## Usage Examples

### JavaScript/Frontend

```javascript
const response = await fetch('/multi-update-flexi-record', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    sectionid: '49097',
    scouts: ['1601995', '2060746', '1809627'],
    value: '1',
    column: 'f_1',
    flexirecordid: '72758'
  })
});

const data = await response.json();
console.log('Updated', data.updated_count, 'scouts');
```

### cURL

```bash
curl --location 'https://vikings-osm-backend.onrender.com/multi-update-flexi-record' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--data '{
    "sectionid": "49097",
    "scouts": ["1601995", "2060746", "1809627"],
    "value": "1",
    "column": "f_1",
    "flexirecordid": "72758"
}'
```

## Rate Limiting

This endpoint is subject to both backend and OSM API rate limits:

- **Backend**: 100 requests per minute per user/IP
- **OSM API**: OSM's standard rate limits (typically 1000 requests per hour)

Rate limit information is included in every response under `_rateLimitInfo`.

## Error Handling

The API provides comprehensive error handling with structured logging via Sentry. Common scenarios:

1. **Invalid scout IDs**: OSM will return an error if any scout ID is invalid
2. **Permission errors**: OSM will return an error if you don't have permission to update the section
3. **Invalid FlexiRecord**: OSM will return an error if the FlexiRecord doesn't exist or you don't have access

## Best Practices

1. **Batch size**: Keep batches under 50 scouts for optimal performance
2. **Error handling**: Always check the response status and handle rate limiting
3. **Validation**: Validate scout IDs and field formats before making requests
4. **Logging**: Monitor rate limit information to avoid hitting limits

## Related Endpoints

- `GET /get-list-of-members` - Get list of scouts for a section
- `GET /get-flexi-structure` - Get FlexiRecord structure and field IDs
- `POST /update-flexi-record` - Update single scout (legacy endpoint)