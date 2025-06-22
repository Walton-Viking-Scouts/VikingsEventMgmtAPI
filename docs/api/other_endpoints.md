# Other Endpoints

This section covers miscellaneous helper or debugging endpoints available in the API.

## 1. OAuth Debug Helper

*   **Endpoint:** `GET /oauth/debug`
*   **Description:** Provides a snapshot of the OAuth-related environment variables configured on the backend and constructs a sample OSM authorization URL. This is primarily useful during development and debugging to ensure the backend is correctly configured for the OAuth flow.
*   **Headers:** None required.
*   **Query Parameters:**
    *   `state` (string, optional): If provided (e.g., `dev` or `development`), the generated `authUrl` and `frontendUrl` will reflect development settings (e.g., `localhost`). Otherwise, it defaults to production URLs.
*   **Example Request:**
    ```bash
    # For production defaults
    curl -X GET "https://your-backend-api.com/oauth/debug"

    # For development settings
    curl -X GET "https://your-backend-api.com/oauth/debug?state=dev"
    ```
*   **Example Successful Response (`200 OK`):**
    ```json
    {
        "clientId": "Set", // Indicates if OAUTH_CLIENT_ID is configured
        "clientSecret": "Set", // Indicates if OAUTH_CLIENT_SECRET is configured
        "frontendUrl": "https://vikings-eventmgmt.onrender.com", // Or "https://localhost:3000" if state=dev
        "stateParam": "Not set", // Or the value of the 'state' query parameter if provided
        "nodeEnv": "production", // Or "development"
        "backendUrl": "https://vikings-osm-event-manager.onrender.com", // Backend's configured URL
        "authUrl": "https://www.onlinescoutmanager.co.uk/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=https%3A%2F%2Fvikings-osm-event-manager.onrender.com%2Foauth%2Fcallback&scope=section%3Amember%3Aread%20section%3Aprogramme%3Aread%20section%3Aevent%3Aread%20section%3Aflexirecord%3Awrite&response_type=code"
        // The authUrl is constructed using the backend's environment variables.
        // Replace YOUR_CLIENT_ID with the actual client ID.
    }
    ```
    *   `clientId`: "Set" or "Missing".
    *   `clientSecret`: "Set" or "Missing".
    *   `frontendUrl`: The frontend URL the backend would redirect to, based on the `state` parameter.
    *   `stateParam`: The value of the `state` query parameter passed to this debug endpoint.
    *   `nodeEnv`: The `NODE_ENV` environment variable value.
    *   `backendUrl`: The `BACKEND_URL` environment variable value, used for the `redirect_uri`.
    *   `authUrl`: A fully constructed sample authorization URL that can be used to initiate the OAuth flow with OSM. This is very helpful for verifying that the `client_id` and `redirect_uri` are correctly configured.

*   **Purpose for Generative AI (like Copilot):**
    *   This endpoint is **not typically called by an application in production**.
    *   It's a diagnostic tool. If an AI is helping set up or troubleshoot the OAuth flow, it might be instructed to check this endpoint (or guide a human to do so) to verify server-side OAuth configuration.

---
