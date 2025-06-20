// Frontend should be making GET request, not POST
// Current error shows: "Cannot POST /get-user-roles"
// But backend expects: app.get('/get-user-roles', ...)

// Correct frontend code should be:
const response = await fetch(`${BACKEND_URL}/get-user-roles`, {
    method: 'GET',  // ← Change from POST to GET
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    }
});

// NOT:
const response = await fetch(`${BACKEND_URL}/get-user-roles`, {
    method: 'POST',  // ← This causes "Cannot POST" error
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ access_token: token })  // ← Not needed with GET
});