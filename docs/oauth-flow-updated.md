# OAuth Flow Documentation

## Current OAuth Implementation (Updated)

The OAuth flow has been simplified to use only the backend-handled callback:

### Flow:
1. **Frontend** initiates OAuth with state parameter (`dev` or `prod`)
2. **OSM** redirects to backend `/oauth/callback` 
3. **Backend** exchanges code for token and redirects to appropriate frontend
4. **Frontend** receives token via URL parameter and stores in sessionStorage

### Endpoints:
- `GET /oauth/callback` - Handles OAuth redirect from OSM
- `GET /oauth/debug` - Debug OAuth configuration
- `GET /token` - Get current stored token
- `POST /logout` - Clear stored token

### Removed Legacy Endpoints:
- ❌ `POST /callback` - Removed (legacy)
- ❌ `POST /exchange-token` - Removed (legacy)

### State Parameter Usage:
- `state=dev` → Redirects to `https://localhost:3000`
- `state=prod` → Redirects to production frontend

### OSM Application Configuration:
- Callback URL: `https://vikings-osm-backend.onrender.com/oauth/callback`

The codebase is now cleaner with only the active OAuth implementation.