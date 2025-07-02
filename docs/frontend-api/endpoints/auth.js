/**
 * @swagger
 * /oauth/callback:
 *   get:
 *     summary: OAuth callback handler
 *     description: |
 *       Handles the OAuth callback from Online Scout Manager after user authentication.
 *       This endpoint exchanges the authorization code for an access token and redirects
 *       the user back to the frontend with the token.
 *       
 *       **Frontend URL Detection Priority:**
 *       1. `frontend_url` query parameter (highest priority)
 *       2. Embedded URL in state parameter: `state=prod&frontend_url=https://example.com`
 *       3. Referer header detection for `.onrender.com` domains
 *       4. Legacy state-based detection (dev/prod)
 *       5. Default production URL
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from OSM OAuth provider
 *         example: "abc123def456"
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: OAuth state parameter (can contain embedded frontend_url)
 *         example: "prod&frontend_url=https://my-frontend.com"
 *       - in: query
 *         name: frontend_url
 *         schema:
 *           type: string
 *           format: uri
 *         description: Explicit frontend URL for redirect (highest priority)
 *         example: "https://my-frontend.com"
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *         description: OAuth error from OSM (if authentication failed)
 *         example: "access_denied"
 *     responses:
 *       302:
 *         description: |
 *           Redirect to frontend with access token
 *           
 *           **Success redirect:** `{frontend_url}/?access_token={token}&token_type=Bearer`
 *           
 *           **Error redirect:** `{frontend_url}?error={error_code}&details={details}`
 *         headers:
 *           Location:
 *             description: Redirect URL with token or error
 *             schema:
 *               type: string
 *               example: "https://vikings-eventmgmt.onrender.com/?access_token=eyJ...&token_type=Bearer"
 *       400:
 *         description: Bad request (missing authorization code)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *     security: []
 * 
 * /oauth/debug:
 *   get:
 *     summary: OAuth configuration debug information
 *     description: |
 *       Returns OAuth configuration details for debugging purposes.
 *       Shows frontend URL detection logic and OAuth setup status.
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Test state parameter for URL detection
 *         example: "prod&frontend_url=https://test.com"
 *       - in: query
 *         name: frontend_url
 *         schema:
 *           type: string
 *         description: Test frontend_url parameter
 *         example: "https://test.com"
 *     responses:
 *       200:
 *         description: OAuth debug information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OAuthDebugInfo'
 *     security: []
 * 
 * /token:
 *   get:
 *     summary: Get current access token
 *     description: |
 *       Retrieves the current OAuth access token for the authenticated session.
 *       Returns the token information if valid, or an error if not authenticated.
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Current token information
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/OAuthToken'
 *                 - type: object
 *                   properties:
 *                     _rateLimitInfo:
 *                       $ref: '#/components/schemas/RateLimitInfo'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *     security:
 *       - bearerAuth: []
 * 
 * /logout:
 *   post:
 *     summary: Logout and invalidate token
 *     description: |
 *       Invalidates the current OAuth access token and removes it from the session.
 *       After logout, the token can no longer be used for API calls.
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Successfully logged out
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LogoutResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *     security:
 *       - bearerAuth: []
 */