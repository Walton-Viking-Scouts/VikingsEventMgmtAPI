// Update the OAuth callback to use DEV_MODE environment variable
// This allows easy switching between development and production frontends
// without changing FRONTEND_URL every time

// In the OAuth callback, update the getFrontendUrl function:
const getFrontendUrl = () => {
  let url;
  
  // Priority 1: Explicit FRONTEND_URL override
  if (process.env.FRONTEND_URL) {
    url = process.env.FRONTEND_URL;
  } 
  // Priority 2: DEV_MODE flag for development
  else if (process.env.DEV_MODE === 'true') {
    url = 'https://localhost:3000';
  } 
  // Priority 3: Default to production frontend
  else {
    url = 'https://vikings-eventmgmt.onrender.com';
  }
  
  // Clean up URL formatting...
  return url;
};

// Usage:
// Development: Set DEV_MODE=true in Render
// Production: Leave DEV_MODE unset or set to false
// Override: Set FRONTEND_URL to any custom URL