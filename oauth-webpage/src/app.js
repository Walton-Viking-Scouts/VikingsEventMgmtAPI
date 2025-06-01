const clientId = 'JiZxFkZiFaBrlyO6g4cCBEfig1hOKEex'; // Your API ID
const scope = 'section:member:read section:programme:read section:event:read';
const redirectUri = window.location.origin + '/callback.html';

function redirectToOSMLogin() {
    const authUrl = `https://www.onlinescoutmanager.co.uk/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
    window.location.href = authUrl;
}

document.getElementById('osm-login-btn').addEventListener('click', redirectToOSMLogin);

async function getTermsForSection(sectionId) {
    const token = localStorage.getItem('access_token');
    if (!token) return [];

    const response = await fetch('http://localhost:3001/get-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token })
    });

    const data = await response.json();
    // data is an object: { sectionid: [terms] }
    return data[sectionId] || [];
}

async function getMostRecentTermId(sectionId) {
    const terms = await getTermsForSection(sectionId);
    if (!terms.length) return null;
    // Sort by enddate descending
    terms.sort((a, b) => new Date(b.enddate) - new Date(a.enddate));
    return terms[0].termid;
}

async function getSections() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('No access token found. Please log in first.');
        return;
    }

    const response = await fetch('http://localhost:3001/get-user-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token })
    });

    const roles = await response.json();

    // Map sectionid to sectionname (avoid duplicates)
    const sectionIdToName = {};
    roles.forEach(role => {
        if (role.sectionid && role.sectionname) {
            sectionIdToName[role.sectionid] = role.sectionname;
        }
    });

    // Create section dropdown
    let sectionDropdown = document.getElementById('section-dropdown');
    if (!sectionDropdown) {
        sectionDropdown = document.createElement('select');
        sectionDropdown.id = 'section-dropdown';
        document.querySelector('.login-container').appendChild(sectionDropdown);
    }
    sectionDropdown.innerHTML = '';
    Object.entries(sectionIdToName).forEach(([sectionid, sectionname]) => {
        const option = document.createElement('option');
        option.value = sectionid;
        option.textContent = sectionname;
        sectionDropdown.appendChild(option);
    });

    // When a section is selected, fetch and display events (future events by default)
    sectionDropdown.onchange = async function () {
        const selectedSectionId = sectionDropdown.value;
        const token = localStorage.getItem('access_token');
        if (!token) return;

        // Get the most recent termid for this section
        const termid = await getMostRecentTermId(selectedSectionId);
        if (!termid) {
            alert('No terms found for this section.');
            return;
        }

        // Call your backend to proxy the events API (with real termid)
        const response = await fetch('http://localhost:3001/get-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: token,
                sectionid: selectedSectionId,
                termid: termid
            })
        });
        const events = await response.json();

        // Display events in a table
        let table = document.getElementById('events-table');
        if (!table) {
            table = document.createElement('table');
            table.id = 'events-table';
            document.querySelector('.login-container').appendChild(table);
        }
        // Table header
        table.innerHTML = `
            <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Yes</th>
                <th>Yes Members</th>
                <th>Yes YLs</th>
                <th>Yes Leaders</th>
                <th>No</th>
            </tr>
        `;
        // Table rows
        if (Array.isArray(events.items)) {
            events.items.forEach(event => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${event.name || ''}</td>
                    <td>${event.date || ''}</td>
                    <td>${event.yes || 0}</td>
                    <td>${event.yes_members || 0}</td>
                    <td>${event.yes_yls || 0}</td>
                    <td>${event.yes_leaders || 0}</td>
                    <td>${event.no || 0}</td>
                `;
                row.style.cursor = 'pointer';
                row.addEventListener('click', async () => {
                    const token = localStorage.getItem('access_token');
                    if (!token) return;
                    const attendanceResponse = await fetch('http://localhost:3001/get-event-attendance', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            access_token: token,
                            eventid: event.eventid,
                            sectionid: selectedSectionId,
                            termid: termid
                        })
                    });
                    const attendance = await attendanceResponse.json();

                    // Display attendance in a table
                    let attendancePanel = document.getElementById('attendance-panel');
                    attendancePanel.innerHTML = ''; // Clear previous table
                    let attendanceTable = document.createElement('table');
                    attendanceTable.id = 'attendance-table';
                    attendancePanel.appendChild(attendanceTable);

                    // Table header
                    attendanceTable.innerHTML = `
                        <tr>
                            <th>Attending</th>
                            <th>First Name</th>
                            <th>Last Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                        </tr>
                    `;
                    // Table rows
                    if (attendance.items && Array.isArray(attendance.items)) {
                        const filtered = attendance.items.filter(person => person.attending && person.attending.trim() !== '');
                        for (const person of filtered) {
                            // Fetch contact details for each attendee
                            const contact = await getContactDetails(selectedSectionId, person.scoutid, termid, token);
                            const email = contact.email || '';
                            const phone = contact.phone || '';
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td>${person.attending}</td>
                                <td>${person.firstname || ''}</td>
                                <td>${person.lastname || ''}</td>
                                <td>${email}</td>
                                <td>${phone}</td>
                            `;
                            attendanceTable.appendChild(row);
                        }
                        if (filtered.length === 0) {
                            attendanceTable.innerHTML += `<tr><td colspan="5">No attendance data</td></tr>`;
                        }
                    } else {
                        attendanceTable.innerHTML += `<tr><td colspan="5">No attendance data</td></tr>`;
                    }
                });
                table.appendChild(row);
            });
        }
    };

    // Trigger change event to load events for the first section by default
    sectionDropdown.dispatchEvent(new Event('change'));
}

async function getContactDetails(sectionid, scoutid, termid, token) {
    const response = await fetch(`http://localhost:3001/get-contact-details?sectionid=${sectionid}&scoutid=${scoutid}&termid=${termid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return await response.json();
}

document.getElementById('get-sections-btn').addEventListener('click', getSections);