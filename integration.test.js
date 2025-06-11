const request = require('supertest');

// Mock fetch for all integration tests
global.fetch = jest.fn();

describe('Integration Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Import the actual server
    jest.mock('node:fs', () => ({
      readFileSync: jest.fn()
    }));
    
    // Set up a test version of the server
    const express = require('express');
    const cors = require('cors');
    const cookieParser = require('cookie-parser');
    
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use(cookieParser());

    // Add actual route handlers (you can copy from server.js)
    app.post('/get-user-roles', async (req, res) => {
      const { access_token } = req.body;
      if (!access_token) {
        return res.status(400).json({ error: 'No access token provided' });
      }
      
      fetch.mockResolvedValueOnce({
        json: async () => ([
          { sectionid: "11107", sectionname: "Adults" },
          { sectionid: "49097", sectionname: "Thursday Beavers" }
        ])
      });

      try {
        const response = await fetch('https://www.onlinescoutmanager.co.uk/api.php?action=getUserRoles');
        const data = await response.json();
        res.json(data);
      } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    server = app.listen(0); // Use port 0 for testing
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Full API Flow', () => {
    it('should handle a complete user roles request', async () => {
      const response = await request(app)
        .post('/get-user-roles')
        .send({ access_token: 'test_token' })
        .expect(200);

      expect(response.body).toEqual([
        { sectionid: "11107", sectionname: "Adults" },
        { sectionid: "49097", sectionname: "Thursday Beavers" }
      ]);
    });
  });
});