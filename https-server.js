require('dotenv').config();
const https = require('https');
const fs = require('fs');
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'oauth-webpage/src')));

const PORT = process.env.PORT || 3000;
const USE_HTTPS = process.env.USE_HTTPS === 'true';

// Local HTTPS for development, HTTP for production (Render handles HTTPS)
if (USE_HTTPS) {
  https.createServer({
    key: fs.readFileSync('./localhost-key.pem'),
    cert: fs.readFileSync('./localhost.pem')
  }, app).listen(PORT, () => {
    console.log(`HTTPS server running at https://localhost:${PORT}`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`HTTP server running at http://localhost:${PORT}`);
  });
}