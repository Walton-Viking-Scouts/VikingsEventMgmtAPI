const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const apiid = 'JiZxFkZiFaBrlyO6g4cCBEfig1hOKEex';   // <-- Replace with your actual API ID
const token = 'cvNCEYpxZOGUIXmxTm3cyJpOb0QhvKkZm1hK6A0wY46HxOe1cH2DYWHVPykdq54u'; // <-- Replace with your actual API Token

app.post('/get-oauth-key', async (req, res) => {
    try {
        const { redirect_uri, scope } = req.body;
        const params = new URLSearchParams();
        params.append('apiid', apiid);
        params.append('token', token);
        params.append('redirect_uri', redirect_uri);
        params.append('scope', scope);

        const response = await fetch('https://www.onlinescoutmanager.co.uk/users.php?action=authorise', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const text = await response.text();
        console.log('OSM raw response:', text);

        let data;
        try {
            data = JSON.parse(text);
        } catch (jsonErr) {
            return res.status(502).json({ error: 'Invalid JSON from OSM', raw: text });
        }

        res.json(data);
    } catch (err) {
        console.error('Error in /get-oauth-key:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

app.listen(3001, () => {
    console.log('Backend listening on http://localhost:3001');
});