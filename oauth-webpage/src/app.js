const clientId = 'JiZxFkZiFaBrlyO6g4cCBEfig1hOKEex'; // Your API ID
const scope = 'section:member:read';
const redirectUri = window.location.origin + '/callback.html';

function redirectToOSMLogin() {
    const authUrl = `https://www.onlinescoutmanager.co.uk/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
    window.location.href = authUrl;
}

document.getElementById('osm-login-btn').addEventListener('click', redirectToOSMLogin);

async function getTerms() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('No access token found. Please log in first.');
        return;
    }

    const response = await fetch('http://localhost:3001/get-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token })
    });

    const data = await response.json();
    // Hide the raw API response from the user
    // document.getElementById('api-response').textContent = JSON.stringify(data, null, 2);

    // Extract section IDs from getTerms
    const sectionIds = Object.keys(data);

    // Fetch user roles to get section names
    const rolesRes = await fetch('http://localhost:3001/get-user-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token })
    });
    const roles = await rolesRes.json();

    // Map sectionid to sectionname
    const sectionIdToName = {};
    roles.forEach(role => {
        if (role.sectionid && role.sectionname) {
            sectionIdToName[role.sectionid] = role.sectionname;
        }
    });

    // Create dropdown
    let dropdown = document.getElementById('section-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('select');
        dropdown.id = 'section-dropdown';
        document.querySelector('.login-container').appendChild(dropdown);
    }
    dropdown.innerHTML = '';
    sectionIds.forEach(sectionid => {
        const option = document.createElement('option');
        option.value = sectionid;
        option.textContent = sectionIdToName[sectionid] || sectionid;
        dropdown.appendChild(option);
    });
}

document.getElementById('get-terms-btn').addEventListener('click', getTerms);