const scope = 'section:member:read';

function redirectToOSMLogin() {
    const redirectUri = window.location.origin + '/oauth-webpage/src/callback.html';

    fetch('http://localhost:3001/get-oauth-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            redirect_uri: redirectUri,
            scope: scope
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.oauth) {
            window.location.href = `https://www.onlinescoutmanager.co.uk/login.php?oauth=${data.oauth}`;
        } else {
            alert('Failed to get OAuth key');
        }
    });
}

document.getElementById('osm-login-btn').addEventListener('click', redirectToOSMLogin);

async function getTerms() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('No access token found. Please log in first.');
        return;
    }

    const response = await fetch('https://www.onlinescoutmanager.co.uk/api.php?action=getTerms', {
        method: 'GET',
        headers: {
            'Authorization': token
        }
    });

    const data = await response.json();
    document.getElementById('api-response').textContent = JSON.stringify(data, null, 2);
    console.log('getTerms response:', data);
}

document.getElementById('get-terms-btn').addEventListener('click', getTerms);