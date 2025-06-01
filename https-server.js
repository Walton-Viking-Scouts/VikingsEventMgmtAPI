const https = require('https');
const fs = require('fs');
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'oauth-webpage/src')));

https.createServer({
  key: fs.readFileSync('./localhost-key.pem'),
  cert: fs.readFileSync('./localhost.pem')
}, app).listen(3000, () => {
  console.log('HTTPS server running at https://localhost:3000');
});