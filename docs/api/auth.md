# Authentication Guide

This API uses OAuth2 to authenticate with Online Scout Manager (OSM). Client applications (like the frontend) need to go through an OAuth2 authorization flow to obtain an access token. This token must then be included in the `Authorization` header for most subsequent API calls.

## Main OAuth2 Flow (Recommended)

This flow is initiated by the frontend and involves redirecting the user to OSM for authorization.

### 1. Initiate Authorization

The frontend application should redirect the user to the OSM authorization URL. The backend provides a debug endpoint (`GET /oauth/debug`) that can help construct this URL.

**OSM Authorization URL Structure:**
`https://www.onlinescoutmanager.co.uk/oauth/authorize?client_id=<YOUR_CLIENT_ID>&redirect_uri=<YOUR_BACKEND_CALLBACK_URL>&scope=<SCOPES>&response_type=code&state=<STATE_STRING>`

*   `client_id`: Your OAuth Client ID for OSM. This is `process.env.OAUTH_CLIENT_ID` on the backend.
*   `redirect_uri`: The backend's OAuth callback URL (e.g., `https://your-backend-url.com/oauth/callback`). This is `process.env.BACKEND_URL + /oauth/callback`. This **must** exactly match one of the redirect URIs registered with your OSM OAuth application.
*   `scope`: The required permissions (e.g., `section:member:read section:event:read section:flexirecord:write`). Consult OSM documentation for available scopes. The default scopes used by this application are `section:member:read section:programme:read section:event:read section:flexirecord:write`.
*   `response_type`: Must be `code`.
*   `state`: An optional, but **highly recommended**, opaque string that will be passed back to your redirect URI. This is used to prevent CSRF attacks and can also be used to pass application state (e.g., environment information like `dev` or `production` or `development`) from the frontend to the backend callback. The backend uses this to determine the correct frontend URL for the final redirect.

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

### Get Current Token (Associated with Legacy Session)

*   **Endpoint:** `GET /token`
*   **Purpose:** Retrieves the access token if a session (cookie-based, from POST `/callback`) is active.
*   **Response (Success `200 OK`):**
    ```json
    {
      "access_token": "example_access_token",
      "expires_at": 1678886400000,
      "expires_in": 3599
    }
    ```
*   **Note:** This is less relevant if using the primary `GET /oauth/callback` flow where the token is managed client-side.

### Logout (Legacy Session)

*   **Endpoint:** `POST /logout`
*   **Purpose:** Clears the server-side session cookie. For the main OAuth flow, client-side token deletion is the primary logout mechanism.
*   **Response (Success `200 OK`):**
    ```json
    { "success": true, "message": "Logged out successfully" }
    ```

## Legacy Authentication Endpoints

These are older or alternative flows. **The `GET /oauth/callback` flow is recommended.**

### Legacy OAuth Callback (POST)

*   **Endpoint:** `POST /callback`
*   **Purpose:** Exchanges `code` for token, stores token in server-side memory, and sets a `session_id` cookie.
*   **Request Body (JSON):** `{ "code": "...", "redirect_uri": "..." }`
*   **Response (Success `200 OK`):** Sets `session_id` cookie. `{ "success": true, "sessionId": "...", "expires_in": ... }`

### Legacy Exchange Token (POST)

*   **Endpoint:** `POST /exchange-token`
*   **Purpose:** Directly exchanges an authorization `code` for an OSM access token. This is effectively what the backend does internally in other callback flows.
*   **Request Body (JSON):** `{ "code": "...", "redirect_uri": "..." }`
*   **Response (Success `200 OK`):** OSM token response: `{ "access_token": "...", "token_type": "Bearer", ... }`

## Security Notes:

*   **State Parameter:** Crucial for CSRF protection in the OAuth flow.
*   **HTTPS:** Mandatory for all communication involving tokens.
*   **Token Storage:** `sessionStorage` is preferred on the client-side over `localStorage`.
*   **Redirect URIs:** Must be precisely registered with OSM and validated.

This guide should help in understanding and implementing authentication.
