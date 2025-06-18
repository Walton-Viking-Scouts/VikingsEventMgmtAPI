// Current OAuth callback HTML that stores the token
// This JavaScript runs in the user's browser after OAuth completion:

const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Success</title>
</head>
<body>
    <script>
        // Store token securely in browser sessionStorage
        sessionStorage.setItem('access_token', '${tokenData.access_token}');
        sessionStorage.setItem('token_type', '${tokenData.token_type || "Bearer"}');
        
        // Redirect to frontend app
        window.location.href = '${frontendUrl}/';
    </script>
    <p>Redirecting to application...</p>
</body>
</html>
`;

// This code runs when the user completes OAuth authentication
// The token is stored in the browser's sessionStorage with key 'access_token'