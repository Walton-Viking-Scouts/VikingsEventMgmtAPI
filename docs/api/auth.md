# Authentication API

This document describes the authentication endpoints and OAuth flow for the Vikings OSM Backend API.

## Overview

This API uses OAuth 2.0 authorization code flow with Online Scout Manager (OSM) and supports dynamic frontend URL detection for flexible deployment environments. Client applications need to obtain an access token through the OAuth flow and include it in the `Authorization` header for subsequent API calls.

## OAuth Flow

The API uses OAuth 2.0 authorization code flow with OSM (Online Scout Manager) and supports dynamic frontend URL detection for flexible deployment environments.

### 1. Authorization Request

Direct users to OSM authorization URL:

```
https://www.onlinescoutmanager.co.uk/oauth/authorize?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=YOUR_BACKEND_URL/oauth/callback&
  state=OPTIONAL_STATE&
  frontend_url=YOUR_FRONTEND_URL
```

**Parameters:**
- `response_type`: Always `code`
- `client_id`: Your OSM OAuth client ID (`process.env.OAUTH_CLIENT_ID`)
- `redirect_uri`: Your backend callback URL (must match exactly with OSM registration)
- `state` (required): CSRF nonce plus an encoded/signed redirect hint for the client
- `scope`: Required permissions (default: `section:member:read section:programme:read section:event:read section:flexirecord:write`)

**Note**: OSM only echoes back the standard `code` and `state` parameters. Any frontend redirect information must be encoded within the `state` parameter.

### 2. User Authorizes Application

The user logs into OSM (if not already logged in) and approves the requested permissions for your application.

### 3. OSM Redirects to Backend Callback

After authorization, OSM redirects the user's browser to the `redirect_uri` specified in step 1, including an authorization `code` and the `state` (if provided) as query parameters.

**Backend Endpoint:** `GET /oauth/callback`

*   **Purpose:** Handles the redirect from OSM, exchanges the authorization code for an access token, and then redirects the user back to the appropriate frontend page.
*   **Query Parameters from OSM:**
    *   `code` (string, required): The authorization code from OSM.
    *   `state` (string, optional): The state parameter originally sent to OSM. The backend uses this to determine the frontend URL (e.g., `https://localhost:3000` if state is `dev` or `development`, otherwise `https://vikings-eventmgmt.onrender.com`).
    *   `error` (string, optional): If an error occurred at OSM (e.g., `access_denied`, `invalid_scope`).
    *   `error_description` (string, optional): A human-readable description of the error.
*   **Backend Behavior:**
    1.  Receives the `code` (and `state`) from OSM.
    2.  If an `error` parameter is present, redirects to the frontend with error information: `FRONTEND_URL?error=<ERROR_FROM_OSM>`.
    3.  If no `code` is present, redirects to frontend: `FRONTEND_URL?error=no_code`.
    4.  Exchanges the `code` for an access token with OSM's token endpoint (`https://www.onlinescoutmanager.co.uk/oauth/token`). This involves a POST request from the backend to OSM, including `grant_type: 'authorization_code'`, `client_id`, `client_secret`, `code`, and `redirect_uri`.
    5.  If token exchange fails, redirects to frontend: `FRONTEND_URL?error=token_exchange_failed&details=<OSM_ERROR_DETAILS>`.
    6.  On successful token exchange, redirects the user to a frontend page: `FRONTEND_URL/auth-success.html?access_token=<TOKEN>&token_type=<TOKEN_TYPE>`.
*   **Frontend Handling (on `auth-success.html` or similar):**
    *   Parse `access_token` and `token_type` from the URL query parameters.
    *   Store the `access_token` securely (e.g., `sessionStorage` or in-memory). **Avoid `localStorage`**.
    *   Use this token in `Authorization: Bearer <TOKEN>` headers for subsequent API calls to this backend.
    *   Clear the token from the URL.

### 4. Making Authenticated Requests to This Backend

Include the obtained `access_token` in the `Authorization` header for all calls to protected API endpoints on this backend (e.g., `/get-user-roles`, `/get-events`).

`Authorization: Bearer <YOUR_ACCESS_TOKEN>`

## Other Authentication-Related Endpoints

These endpoints are part of the backend's API.

### Get Current Token

*   **Endpoint:** `GET /token`
*   **Purpose:** Retrieves the access token if a session (cookie-based) is active.
*   **Response (Success `200 OK`):**
    ```json
    {
      "access_token": "example_access_token",
      "expires_at": 1678886400000,
      "expires_in": 3599
    }
    ```
*   **Note:** This is less relevant if using the primary `GET /oauth/callback` flow where the token is managed client-side.

### Logout

*   **Endpoint:** `POST /logout`
*   **Purpose:** Clears the server-side session cookie. For the main OAuth flow, client-side token deletion is the primary logout mechanism.
*   **Response (Success `200 OK`):**
    ```json
    { "success": true, "message": "Logged out successfully" }
    ```

## Debug Endpoint

### OAuth Debug Information

*   **Endpoint:** `GET /oauth/debug`
*   **Purpose:** Provides debugging information about OAuth configuration and environment settings.
*   **Query Parameters:**
    *   `state` (optional): Test state parameter for frontend URL detection (e.g., `dev` or `prod`)
*   **Response (Success `200 OK`):**
    ```json
    {
      "clientId": "Set",
      "clientSecret": "Set", 
      "frontendUrl": "https://localhost:3000",
      "stateParam": "dev",
      "nodeEnv": "production",
      "backendUrl": "https://vikings-osm-backend.onrender.com"
    }
    ```

## Security Notes:

*   **State Parameter:** Crucial for CSRF protection in the OAuth flow.
*   **HTTPS:** Mandatory for all communication involving tokens.
*   **Token Storage:** `sessionStorage` is preferred on the client-side over `localStorage`.
*   **Redirect URIs:** Must be precisely registered with OSM and validated.

This guide should help in understanding and implementing authentication.
