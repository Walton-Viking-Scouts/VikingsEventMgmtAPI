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

  // describe('Full API Flow', () => { // This block can be removed or repurposed if /get-user-roles was its only test
  //   it('should handle a complete user roles request', async () => {
  //     const response = await request(app)
  //       .post('/get-user-roles')
  //       .send({ access_token: 'test_token' })
  //       .expect(200);
  //
  //     expect(response.body).toEqual([
  //       { sectionid: "11107", sectionname: "Adults" },
  //       { sectionid: "49097", sectionname: "Thursday Beavers" }
  //     ]);
  //   });
  // });

  describe('Authentication Endpoints', () => {
    describe('POST /callback', () => {
      it('should exchange authorization code for tokens and redirect to /', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'mock_access_token',
            refresh_token: 'mock_refresh_token',
            expires_in: 3600,
          }),
        });

        const response = await request(app)
          .post('/callback')
          .send({ code: 'valid_auth_code' })
          .expect(302); // Expect a redirect

        expect(response.headers.location).toBe('/');
        expect(fetch).toHaveBeenCalledWith(
          'https://www.onlinescoutmanager.co.uk/oauth/token',
          expect.any(Object)
        );
        // Further checks can be added for cookies if they are set
      });

      it('should return 400 if authorization code is missing', async () => {
        await request(app)
          .post('/callback')
          .send({})
          .expect(400);
      });

      it('should return 500 if token exchange fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

        await request(app)
          .post('/callback')
          .send({ code: 'invalid_auth_code' })
          .expect(500);
      });
    });

    describe('GET /token', () => {
      it('should return tokens if session is valid', async () => {
        // Mock a valid session by setting cookies
        const agent = request.agent(app);
        await agent
          .post('/callback') // Simulate a successful login
          .send({ code: 'valid_auth_code' })
          .expect(302);

        fetch.mockResolvedValueOnce({ // Mock for /callback
          ok: true,
          json: async () => ({
            access_token: 'mock_access_token',
            refresh_token: 'mock_refresh_token',
            expires_in: 3600,
          }),
        });

        const response = await agent.get('/token').expect(200);

        expect(response.body).toHaveProperty('access_token');
        expect(response.body).toHaveProperty('refresh_token');
        expect(response.body).toHaveProperty('expires_at');
      });

      it('should return 401 if session is invalid or not present', async () => {
        await request(app).get('/token').expect(401);
      });
    });

    describe('POST /logout', () => {
      it('should clear session cookies and redirect to /', async () => {
        // Mock a valid session by setting cookies
        const agent = request.agent(app);
        await agent
          .post('/callback') // Simulate a successful login
          .send({ code: 'valid_auth_code' })
          .expect(302);

        fetch.mockResolvedValueOnce({ // Mock for /callback
          ok: true,
          json: async () => ({
            access_token: 'mock_access_token',
            refresh_token: 'mock_refresh_token',
            expires_in: 3600,
          }),
        });

        const response = await agent.post('/logout').expect(302);

        expect(response.headers.location).toBe('/');
        // Check that cookies are cleared
        expect(response.headers['set-cookie']).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/access_token=;.*Max-Age=0/),
            expect.stringMatching(/refresh_token=;.*Max-Age=0/),
            expect.stringMatching(/expires_at=;.*Max-Age=0/),
          ])
        );
      });
    });

    describe('POST /exchange-token', () => {
      it('should exchange authorization code for tokens with valid redirect URI', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'new_access_token',
            refresh_token: 'new_refresh_token',
            expires_in: 3600,
          }),
        });

        const response = await request(app)
          .post('/exchange-token')
          .send({ code: 'valid_auth_code', redirect_uri: 'http://localhost:3000/callback' })
          .expect(200);

        expect(response.body).toHaveProperty('access_token', 'new_access_token');
        expect(fetch).toHaveBeenCalledWith(
          'https://www.onlinescoutmanager.co.uk/oauth/token',
          expect.objectContaining({
            body: expect.stringContaining('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback'),
          })
        );
      });

      it('should return 400 if code is missing', async () => {
        await request(app)
          .post('/exchange-token')
          .send({ redirect_uri: 'http://localhost:3000/callback' })
          .expect(400);
      });

      it('should return 400 if redirect_uri is missing', async () => {
        await request(app)
          .post('/exchange-token')
          .send({ code: 'valid_auth_code' })
          .expect(400);
      });

      it('should return 500 if token exchange fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

        await request(app)
          .post('/exchange-token')
          .send({ code: 'invalid_auth_code', redirect_uri: 'http://localhost:3000/callback' })
          .expect(500);
      });
    });
  });

  describe('Data Retrieval Endpoints', () => {
    const mockAccessToken = 'test_access_token'; // Used by multiple data retrieval tests
    const mockLegacyAccessToken = 'test_token'; // For the older /get-user-roles style

    describe('POST /get-user-roles', () => { // Moved from 'Full API Flow'
      it('should return user roles with a valid access_token in body', async () => {
        // Mock fetch specifically for this test as it might have a different response structure
        fetch.mockResolvedValueOnce({
          ok: true, // Assuming ok property for consistency, though original test didn't check
          json: async () => ([
            { sectionid: "11107", sectionname: "Adults" },
            { sectionid: "49097", sectionname: "Thursday Beavers" }
          ])
        });

        const response = await request(app)
          .post('/get-user-roles')
          .send({ access_token: mockLegacyAccessToken })
          .expect(200);

        expect(response.body).toEqual([
          { sectionid: "11107", sectionname: "Adults" },
          { sectionid: "49097", sectionname: "Thursday Beavers" }
        ]);
        // Add fetch call verification if desired, e.g.
        // expect(fetch).toHaveBeenCalledWith(
        //   'https://www.onlinescoutmanager.co.uk/api.php?action=getUserRoles',
        //   expect.any(Object) // Or more specific if POST body for fetch is consistent
        // );
      });

      it('should return 400 if access_token is missing in body', async () => {
        await request(app)
          .post('/get-user-roles')
          .send({})
          .expect(400);
      });

      it('should return 500 if OSM API call fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'OSM API Error' }),
        });

        await request(app)
          .post('/get-user-roles')
          .send({ access_token: mockLegacyAccessToken })
          .expect(500);
      });
    });

    describe('GET /get-terms', () => {
      it('should return terms with a valid access token', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ terms: [{ id: 1, name: 'Spring Term' }] }),
        });

        const response = await request(app)
          .get('/get-terms')
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(200);

        expect(response.body).toEqual({ terms: [{ id: 1, name: 'Spring Term' }] });
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('onlinescoutmanager.co.uk/api.php?action=getTerms'),
          expect.any(Object)
        );
      });

      it('should return 401 if access token is missing', async () => {
        await request(app).get('/get-terms').expect(401);
      });

      it('should return 500 if OSM API call fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'OSM API Error' }),
        });

        await request(app)
          .get('/get-terms')
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(500);
      });
    });

    describe('GET /get-section-config', () => {
      const sectionId = '12345';
      it('should return section config with valid token and section_id', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ config: { name: 'Test Section' } }),
        });

        const response = await request(app)
          .get(`/get-section-config?section_id=${sectionId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(200);

        expect(response.body).toEqual({ config: { name: 'Test Section' } });
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`onlinescoutmanager.co.uk/api.php?action=getSectionConfig&sectionid=${sectionId}`),
          expect.any(Object)
        );
      });

      it('should return 401 if access token is missing', async () => {
        await request(app).get(`/get-section-config?section_id=${sectionId}`).expect(401);
      });

      it('should return 400 if section_id is missing', async () => {
        await request(app)
          .get('/get-section-config')
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(400);
      });

      it('should return 500 if OSM API call fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'OSM API Error' }),
        });

        await request(app)
          .get(`/get-section-config?section_id=${sectionId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(500);
      });
    });

    describe('GET /get-events', () => {
      const sectionId = '12345';
      const termId = 'term1';
      it('should return events with valid token, section_id, and term_id', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ([{ id: 'event1', name: 'Camp' }]),
        });

        const response = await request(app)
          .get(`/get-events?section_id=${sectionId}&term_id=${termId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(200);

        expect(response.body).toEqual([{ id: 'event1', name: 'Camp' }]);
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`onlinescoutmanager.co.uk/api.php?action=getEvents&sectionid=${sectionId}&termid=${termId}`),
          expect.any(Object)
        );
      });

      it('should return 401 if access token is missing', async () => {
        await request(app).get(`/get-events?section_id=${sectionId}&term_id=${termId}`).expect(401);
      });

      it('should return 400 if section_id is missing', async () => {
        await request(app)
          .get(`/get-events?term_id=${termId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(400);
      });

      it('should return 400 if term_id is missing', async () => {
        await request(app)
          .get(`/get-events?section_id=${sectionId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(400);
      });

      it('should return 500 if OSM API call fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'OSM API Error' }),
        });

        await request(app)
          .get(`/get-events?section_id=${sectionId}&term_id=${termId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(500);
      });
    });

    describe('GET /get-event-attendance', () => {
      const sectionId = '12345';
      const termId = 'term1';
      const eventId = 'event1';

      it('should return event attendance with valid token and parameters', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ '123': { attending: 'Yes' } }),
        });

        const response = await request(app)
          .get(`/get-event-attendance?section_id=${sectionId}&term_id=${termId}&event_id=${eventId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(200);

        expect(response.body).toEqual({ '123': { attending: 'Yes' } });
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`onlinescoutmanager.co.uk/api.php?action=getEventAttendance&sectionid=${sectionId}&termid=${termId}&eventid=${eventId}`),
          expect.any(Object)
        );
      });

      it('should return 401 if access token is missing', async () => {
        await request(app).get(`/get-event-attendance?section_id=${sectionId}&term_id=${termId}&event_id=${eventId}`).expect(401);
      });

      it('should return 400 if section_id is missing', async () => {
        await request(app)
          .get(`/get-event-attendance?term_id=${termId}&event_id=${eventId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(400);
      });

      it('should return 400 if term_id is missing', async () => {
        await request(app)
          .get(`/get-event-attendance?section_id=${sectionId}&event_id=${eventId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(400);
      });

      it('should return 400 if event_id is missing', async () => {
        await request(app)
          .get(`/get-event-attendance?section_id=${sectionId}&term_id=${termId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(400);
      });

      it('should return 500 if OSM API call fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'OSM API Error' }),
        });

        await request(app)
          .get(`/get-event-attendance?section_id=${sectionId}&term_id=${termId}&event_id=${eventId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(500);
      });
    });

    describe('GET /get-contact-details', () => {
      const sectionId = '12345';
      const memberId = 'member1';

      it('should return contact details with valid token and parameters', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ contact: { email: 'test@example.com' } }),
        });

        const response = await request(app)
          .get(`/get-contact-details?section_id=${sectionId}&member_id=${memberId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(200);

        expect(response.body).toEqual({ contact: { email: 'test@example.com' } });
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`onlinescoutmanager.co.uk/api.php?action=getContactDetails&sectionid=${sectionId}&memberid=${memberId}`),
          expect.any(Object)
        );
      });

      it('should return 401 if access token is missing', async () => {
        await request(app).get(`/get-contact-details?section_id=${sectionId}&member_id=${memberId}`).expect(401);
      });

      it('should return 400 if section_id is missing', async () => {
        await request(app)
          .get(`/get-contact-details?member_id=${memberId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(400);
      });

      it('should return 400 if member_id is missing', async () => {
        await request(app)
          .get(`/get-contact-details?section_id=${sectionId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(400);
      });

      it('should return 500 if OSM API call fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'OSM API Error' }),
        });

        await request(app)
          .get(`/get-contact-details?section_id=${sectionId}&member_id=${memberId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(500);
      });
    });

    describe('GET /get-list-of-members', () => {
      const sectionId = '12345';
      const termId = 'term1';

      it('should return list of members with valid token and parameters', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ([{ member_id: 'member1', name: 'Test Member' }]),
        });

        const response = await request(app)
          .get(`/get-list-of-members?section_id=${sectionId}&term_id=${termId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(200);

        expect(response.body).toEqual([{ member_id: 'member1', name: 'Test Member' }]);
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`onlinescoutmanager.co.uk/api.php?action=getListOfMembers&sectionid=${sectionId}&termid=${termId}`),
          expect.any(Object)
        );
      });

      it('should return 401 if access token is missing', async () => {
        await request(app).get(`/get-list-of-members?section_id=${sectionId}&term_id=${termId}`).expect(401);
      });

      it('should return 400 if section_id is missing', async () => {
        await request(app)
          .get(`/get-list-of-members?term_id=${termId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(400);
      });

      it('should return 400 if term_id is missing', async () => {
        await request(app)
          .get(`/get-list-of-members?section_id=${sectionId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(400);
      });

      it('should return 500 if OSM API call fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'OSM API Error' }),
        });

        await request(app)
          .get(`/get-list-of-members?section_id=${sectionId}&term_id=${termId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(500);
      });
    });

    describe('GET /get-flexi-records', () => {
      const sectionId = '12345';
      const memberId = 'member1';

      it('should return flexi records with valid token and section_id', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ records: [{ id: 'rec1', data: 'value' }] }),
        });

        const response = await request(app)
          .get(`/get-flexi-records?section_id=${sectionId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(200);

        expect(response.body).toEqual({ records: [{ id: 'rec1', data: 'value' }] });
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`onlinescoutmanager.co.uk/api.php?action=getFlexiRecords&sectionid=${sectionId}`),
          expect.any(Object)
        );
      });

      it('should return flexi records for a specific member if member_id is provided', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ records: [{ id: 'rec2', data: 'value2' }] }),
        });

        const response = await request(app)
          .get(`/get-flexi-records?section_id=${sectionId}&member_id=${memberId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(200);

        expect(response.body).toEqual({ records: [{ id: 'rec2', data: 'value2' }] });
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`onlinescoutmanager.co.uk/api.php?action=getFlexiRecords&sectionid=${sectionId}&memberid=${memberId}`),
          expect.any(Object)
        );
      });

      it('should return 401 if access token is missing', async () => {
        await request(app).get(`/get-flexi-records?section_id=${sectionId}`).expect(401);
      });

      it('should return 400 if section_id is missing', async () => {
        await request(app)
          .get('/get-flexi-records')
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(400);
      });

      it('should return 500 if OSM API call fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'OSM API Error' }),
        });

        await request(app)
          .get(`/get-flexi-records?section_id=${sectionId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(500);
      });
    });

    describe('GET /get-single-flexi-record', () => {
      const sectionId = '12345';
      const memberId = 'member1';
      const recordId = 'record1';

      it('should return a single flexi record with valid token and parameters', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'record1', data: 'value' }),
        });

        const response = await request(app)
          .get(`/get-single-flexi-record?section_id=${sectionId}&member_id=${memberId}&record_id=${recordId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(200);

        expect(response.body).toEqual({ id: 'record1', data: 'value' });
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`onlinescoutmanager.co.uk/api.php?action=getSingleFlexiRecord&sectionid=${sectionId}&memberid=${memberId}&recordid=${recordId}`),
          expect.any(Object)
        );
      });

      it('should return 401 if access token is missing', async () => {
        await request(app).get(`/get-single-flexi-record?section_id=${sectionId}&member_id=${memberId}&record_id=${recordId}`).expect(401);
      });

      it('should return 400 if section_id is missing', async () => {
        await request(app)
          .get(`/get-single-flexi-record?member_id=${memberId}&record_id=${recordId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(400);
      });

      it('should return 400 if member_id is missing', async () => {
        await request(app)
          .get(`/get-single-flexi-record?section_id=${sectionId}&record_id=${recordId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(400);
      });

      it('should return 400 if record_id is missing', async () => {
        await request(app)
          .get(`/get-single-flexi-record?section_id=${sectionId}&member_id=${memberId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(400);
      });

      it('should return 500 if OSM API call fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'OSM API Error' }),
        });

        await request(app)
          .get(`/get-single-flexi-record?section_id=${sectionId}&member_id=${memberId}&record_id=${recordId}`)
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .expect(500);
      });
    });
  });

  describe('Data Modification Endpoints', () => {
    const mockAccessToken = 'test_access_token';

    describe('POST /update-flexi-record', () => {
      const sectionId = '12345';
      const memberId = 'member1';
      const recordId = 'record1';
      const value = 'new_value';

      it('should update flexi record with valid token and parameters', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }), // Assuming OSM returns a success indicator
        });

        const response = await request(app)
          .post('/update-flexi-record')
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .send({ section_id: sectionId, member_id: memberId, record_id: recordId, value: value })
          .expect(200);

        expect(response.body).toEqual({ success: true });
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('onlinescoutmanager.co.uk/api.php?action=updateFlexiRecord'),
          expect.objectContaining({
            method: 'POST',
            body: expect.any(URLSearchParams), // Or JSON.stringify if the API expects JSON
          })
        );
        // More specific check for body contents if needed
        const fetchCall = fetch.mock.calls[0];
        const bodyParams = new URLSearchParams(fetchCall[1].body.toString());
        expect(bodyParams.get('sectionid')).toBe(sectionId);
        expect(bodyParams.get('memberid')).toBe(memberId);
        expect(bodyParams.get('recordid')).toBe(recordId);
        expect(bodyParams.get('value')).toBe(value);
      });

      it('should return 401 if access token is missing', async () => {
        await request(app)
          .post('/update-flexi-record')
          .send({ section_id: sectionId, member_id: memberId, record_id: recordId, value: value })
          .expect(401);
      });

      it('should return 400 if section_id is missing', async () => {
        await request(app)
          .post('/update-flexi-record')
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .send({ member_id: memberId, record_id: recordId, value: value })
          .expect(400);
      });

      it('should return 400 if member_id is missing', async () => {
        await request(app)
          .post('/update-flexi-record')
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .send({ section_id: sectionId, record_id: recordId, value: value })
          .expect(400);
      });

      it('should return 400 if record_id is missing', async () => {
        await request(app)
          .post('/update-flexi-record')
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .send({ section_id: sectionId, member_id: memberId, value: value })
          .expect(400);
      });

      it('should return 400 if value is missing', async () => {
        await request(app)
          .post('/update-flexi-record')
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .send({ section_id: sectionId, member_id: memberId, record_id: recordId })
          .expect(400);
      });

      it('should return 500 if OSM API call fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'OSM API Error' }),
        });

        await request(app)
          .post('/update-flexi-record')
          .set('Authorization', `Bearer ${mockAccessToken}`)
          .send({ section_id: sectionId, member_id: memberId, record_id: recordId, value: value })
          .expect(500);
      });
    });
  });

  describe('Utility Endpoints', () => {
    describe('GET /rate-limit-status', () => {
      it('should return rate limit status', async () => {
        // This test assumes the server internally tracks rate limits
        // and doesn't need a specific OSM mock for this endpoint itself,
        // unless the rate limit is fetched directly from OSM on this call.
        // For now, we expect a structure.
        // If the server's /rate-limit-status fetches from OSM, a mock would be needed here.

        // To make this test more robust, we could simulate some API calls
        // that are known to affect rate limits if the server's logic is complex.
        // However, based on the name, it's likely returning stored/calculated values.

        const response = await request(app)
          .get('/rate-limit-status')
          .expect(200);

        // Assuming a specific structure for the rate limit status response
        expect(response.body).toHaveProperty('maxRequests');
        expect(response.body).toHaveProperty('requestsLeft');
        expect(response.body).toHaveProperty('resetsIn'); // e.g., seconds or a timestamp

        // Example of more specific checks if the defaults are known
        // expect(response.body.maxRequests).toBeGreaterThan(0);
        // expect(response.body.requestsLeft).toBeGreaterThanOrEqual(0);
        // expect(response.body.resetsIn).toBeGreaterThanOrEqual(0);
      });

      // If an access token is required for this endpoint, that test should be added.
      // For example:
      // it('should return 401 if access token is missing and endpoint is protected', async () => {
      //   await request(app).get('/rate-limit-status').expect(401);
      // });
    });
  });
});