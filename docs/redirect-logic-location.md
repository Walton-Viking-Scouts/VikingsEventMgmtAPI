// The current logs show this flow is using the legacy /exchange-token endpoint
// in controllers/auth.js, NOT the /oauth/callback route in server.js

// Looking at auth.js, the exchangeToken function currently just returns JSON:
res.json(data);

// It does NOT handle redirects - that's why you're getting the wrong behavior
// The redirect_uri in the logs ('https://vikings-eventmgmt.onrender.com/callback.html') 
// is what the frontend is sending to the backend, but the backend isn't using it

// The /oauth/callback route in server.js DOES handle redirects with state parameter:
const getFrontendUrl = () => {
  if (state === 'dev' || state === 'development') {
    return 'https://localhost:3000';
  }
  return 'https://vikings-eventmgmt.onrender.com';
};

// But your current flow is using /exchange-token, not /oauth/callback