# Rate Limiting Guide

To ensure fair usage and stability, the API implements rate limiting. This applies to requests made to this backend service, which in turn also manages its rate of requests to the upstream Online Scout Manager (OSM) API.

## Overview

There are two levels of rate limiting to be aware of:

1.  **Backend Rate Limiting:** This API service itself has a rate limit to protect its own resources.
2.  **OSM API Rate Limiting:** The Online Scout Manager API has its own rate limits. This backend attempts to manage requests to OSM gracefully, but it's possible for clients of this API to indirectly hit OSM's limits.

When a rate limit is exceeded, the API will typically respond with an HTTP `429 Too Many Requests` status code.

## Backend Rate Limiting

*   The backend imposes a general rate limit on incoming requests to prevent abuse and ensure availability.
*   The specific limits (e.g., requests per minute) are defined in the backend configuration (currently `MAX_REQUESTS_PER_WINDOW` and `BACKEND_RATE_LIMIT_WINDOW` in `middleware/rateLimiting.js`).
*   If you exceed this limit, you will receive a `429 Too Many Requests` response. The response body might include details about the limit and when you can retry.

## OSM API Rate Limiting

*   The OSM API has its own rate limits (typically per hour, per access token).
*   This backend service attempts to track the rate limits imposed by OSM based on the headers returned by OSM (e.g., `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`).
*   If a request to an OSM proxy endpoint cannot be fulfilled because the OSM rate limit is (or is predicted to be) exceeded for the given access token, this backend will also return a `429 Too Many Requests` status.
*   The response body in such cases will often include information about the OSM rate limit status.

**Example `429` Response due to OSM Rate Limit:**
```json
{
  "error": "OSM API rate limit exceeded",
  "rateLimitInfo": {
    "limit": 1000, // Max requests allowed by OSM in the window
    "remaining": 0, // Requests remaining for OSM in the window
    "reset": 1678886400, // Unix timestamp when the OSM limit resets
    "rateLimited": true, // Indicates if currently limited by OSM
    "retryAfter": 3600 // Suggested seconds to wait before retrying
  },
  "message": "Please wait before making more requests"
}
```

## Monitoring Rate Limits

The API provides an endpoint to check the current rate limit status.

### Get Rate Limit Status

*   **Endpoint:** `GET /rate-limit-status`
*   **Description:** Retrieves the current rate limit status for both the backend and the proxied OSM API (based on the session/token making the request).
*   **Headers:**
    *   `Authorization: Bearer <ACCESS_TOKEN>` (Recommended, to get OSM status specific to your token)
*   **Query Parameters:** None.
*   **Example Request:**
    ```bash
    curl -X GET "https://your-backend-api.com/rate-limit-status" \
         -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```
*   **Example Successful Response (`200 OK`):**
    ```json
    {
        "backend": {
            "limit": 100, // Max requests to this backend per window
            "remaining": 95, // Remaining requests to this backend
            "resetTime": 1678882860000, // Timestamp when backend limit window resets
            "window": "per minute" // Window duration for backend limit
        },
        "osm": {
            "limit": 1000, // Max requests to OSM API per hour (example)
            "remaining": 950, // Remaining requests for your token to OSM
            "resetTime": 1678886400000, // Timestamp when OSM limit resets (for your token)
            "window": "per hour",
            "available": true, // Whether requests to OSM are likely to succeed
            "retryAfter": null // Seconds to wait if unavailable
        },
        "timestamp": 1678882800000 // Current server timestamp
    }
    ```
    *Note: The `backend` part of the response reflects the rate limit of this API service. The `osm` part reflects the status of the Online Scout Manager API rate limit for the authenticated user's token, as tracked by this backend.*

## Best Practices

*   **Check `/rate-limit-status`:** Periodically check this endpoint to understand your current limits.
*   **Implement Retries:** When receiving a `429` status code, wait for the duration specified in the `Retry-After` header (if present) or use an exponential backoff strategy before retrying the request.
*   **Cache Responses:** Cache responses from the API where appropriate to reduce the number of requests, especially for data that doesn't change frequently.
*   **Efficient API Usage:** Avoid making unnecessary API calls. For example, fetch data in batches if the API supports it, rather than making many individual requests.
