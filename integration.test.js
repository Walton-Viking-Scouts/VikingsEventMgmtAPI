const request = require('supertest');

// Mock fetch for all integration tests
global.fetch = jest.fn();

// Import the Express app from server.js
const app = require('./server'); // Assuming server.js is in the same directory (root)

describe('Integration Tests', () => {
  // let app; // App is now imported
  let server;

  beforeAll(async () => {
    // Mock 'node:fs' if server.js uses it at the top level.
    // Based on server.js content, it's not used at the top level, so this mock might be removable
    // unless there's a file read during initial module load I missed.
    // For now, keeping it to be safe, but can be revisited if it causes issues.
    jest.mock('node:fs', () => ({
      readFileSync: jest.fn()
    }));
    
    // The app is already configured and includes all middleware and routes from server.js.
    // No need to redefine express(), cors(), cookieParser(), or any routes here.

    // Start the server on a random available port for testing
    server = app.listen(0);
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Full API Flow', () => { // This test will be moved or updated later to fit new structure
    it('should handle a complete user roles request', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ([ // OSM returns an array for getUserRoles
          { sectionid: "11107", sectionname: "Adults" },
          { sectionid: "49097", sectionname: "Thursday Beavers" }
        ]),
        headers: new Map() // For rate limit header extraction in makeOSMRequest
      });

      const response = await request(app)
        .post('/get-user-roles')
        .send({ access_token: 'test_token' })
        .expect(200);

      // server.js wraps array responses by merging properties, plus _rateLimitInfo
      expect(response.body).toHaveProperty('_rateLimitInfo');
      expect(response.body[0]).toEqual({ sectionid: "11107", sectionname: "Adults" });
      expect(response.body[1]).toEqual({ sectionid: "49097", sectionname: "Thursday Beavers" });

      expect(fetch).toHaveBeenCalledWith(
        'https://www.onlinescoutmanager.co.uk/api.php?action=getUserRoles',
        expect.objectContaining({
          headers: { 'Authorization': `Bearer test_token` }
        })
      );
    });
  });
});