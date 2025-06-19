// Alternative approach: Add a query parameter to the OAuth callback URL

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