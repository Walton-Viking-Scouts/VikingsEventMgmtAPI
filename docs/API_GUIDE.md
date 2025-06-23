# API Documentation

Welcome to the API documentation for the Vikings OSM Backend. This guide provides developers, including generative AI assistants, with the information needed to interact with the API.

## Overview

This API serves as a backend proxy and authentication layer for interacting with the Online Scout Manager (OSM) API. It handles OAuth2 authentication with OSM and provides a set of endpoints to access various OSM functionalities.

Key features include:

*   OAuth2 authentication with Online Scout Manager.
*   Proxy endpoints for common OSM API calls, handling CORS and adding a layer for rate limiting.
*   Rate limiting for both backend and OSM API requests.

## Getting Started

1.  **Authentication**: Understand how to authenticate your application using the OAuth2 flow. See [Authentication Guide](./api/auth.md).
2.  **Endpoints**: Explore the available API endpoints to interact with OSM data. See [OSM Proxy Endpoints Guide](./api/osm_proxy.md).
3.  **Rate Limiting**: Be aware of the rate limits imposed by this API and the underlying OSM API. See [Rate Limiting Guide](./api/rate_limiting.md).

## API Structure

The API is structured into several main parts:

*   **Base URL**: All endpoint paths described in the linked guides should be appended to the API's base URL (e.g., `https://your-backend-api.com/api/v1` or similar, depending on deployment).

*   **Authentication Endpoints**: Used to manage the OAuth2 flow and token retrieval.

*   **Authentication Endpoints**: Used to manage the OAuth2 flow and token retrieval.
*   **OSM Proxy Endpoints**: Endpoints that mirror or facilitate calls to the Online Scout Manager API.
*   **Utility Endpoints**: Endpoints for monitoring or debugging, such as rate limit status.

## Navigation

*   [Authentication](./api/auth.md)
*   [OSM Proxy Endpoints](./api/osm_proxy.md)
*   [Rate Limiting](./api/rate_limiting.md)
*   [Other Endpoints](./api/other_endpoints.md)

---

*This documentation is intended to be comprehensive. If you find any discrepancies or areas needing clarification, please consider updating it or raising an issue.*
