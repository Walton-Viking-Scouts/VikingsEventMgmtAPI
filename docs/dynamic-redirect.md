# Dynamic Frontend Redirect using State Parameter

## Implementation
The backend OAuth callback uses the `state` parameter to determine which frontend to redirect to.

## Frontend OAuth URL Construction

**For Development (localhost):**
```javascript
const authUrl = `https://www.onlinescoutmanager.co.uk/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent('https://vikings-osm-event-manager.onrender.com/oauth/callback')}&state=dev&scope=section%3Amember%3Aread%20section%3Aprogramme%3Aread%20section%3Aevent%3Aread%20section%3Aflexirecord%3Awrite&response_type=code`;
```

**For Production:**
```javascript
const authUrl = `https://www.onlinescoutmanager.co.uk/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent('https://vikings-osm-event-manager.onrender.com/oauth/callback')}&state=prod&scope=section%3Amember%3Aread%20section%3Aprogramme%3Aread%20section%3Aevent%3Aread%20section%3Aflexirecord%3Awrite&response_type=code`;
```

## Backend Logic
```javascript
const getFrontendUrl = () => {
  if (state === 'dev' || state === 'development') {
    return 'https://localhost:3000';
  }
  return 'https://vikings-eventmgmt.onrender.com';
};
```

## OSM Application Settings
Callback URL: `https://vikings-osm-event-manager.onrender.com/oauth/callback`

## Testing
- Test development: `https://backend.com/oauth/debug?state=dev`
- Test production: `https://backend.com/oauth/debug?state=prod`pproach: Add a query parameter to the OAuth callback URL

// Frontend initiates OAuth with environment info:
// Production: https://backend.com/oauth/callback
// Development: https://backend.com/oauth/callback?env=dev

// Then in the OAuth callback:
const getFrontendUrlFromQuery = () => {
  const env = req.query.env;
  
  if (env === 'dev' || env === 'development') {
    return 'https://localhost:3000';
  }
  
  return 'https://vikings-eventmgmt.onrender.com';
};