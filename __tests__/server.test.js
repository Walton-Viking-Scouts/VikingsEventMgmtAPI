const request = require('supertest');

// Load environment variables for tests
require('dotenv').config();

// Set test OAuth credentials BEFORE importing server
process.env.OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || 'test_client_id';
process.env.OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || 'test_client_secret';

// Mock setInterval BEFORE importing server to prevent cleanup timers
const originalSetInterval = global.setInterval;
global.setInterval = jest.fn();

// Mock fetch to prevent actual HTTP calls
global.fetch = jest.fn(() => 
  Promise.resolve({
    status: 200,
    headers: {
      get: jest.fn(() => null),
    },
    json: () => Promise.resolve({ data: 'test' }),
    text: () => Promise.resolve('test response'),
  }),
);

// Import server AFTER mocking setInterval
const app = require('../server');

describe('Vikings OSM Backend API', () => {
  afterAll((done) => {
    // Restore original setInterval
    global.setInterval = originalSetInterval;
    
    // Clear all timers and close server
    jest.clearAllTimers();
    setTimeout(done, 100);
  });

  beforeEach(() => {
    // Reset fetch mock
    fetch.mockClear();
  });

  describe('Rate Limit Status Endpoint', () => {
    test('GET /rate-limit-status should return current limits', async () => {
      const response = await request(app)
        .get('/rate-limit-status')
        .expect(200);

      expect(response.body).toHaveProperty('backend');
      expect(response.body).toHaveProperty('osm');
      expect(response.body).toHaveProperty('timestamp');
      
      // Check backend rate limit structure
      expect(response.body.backend).toHaveProperty('limit');
      expect(response.body.backend).toHaveProperty('remaining');
      expect(response.body.backend).toHaveProperty('window', 'per minute');
    });
  });

  describe('Rate Limiting Middleware', () => {
    // Test for rate limit headers
    it('should add rate limit headers to API responses', async () => {
      const response = await request(app)
        .get('/rate-limit-status')
        .set('Authorization', 'Bearer test_token');

      console.log('Response headers:', response.headers);

      expect(response.headers).toHaveProperty('x-backend-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-backend-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-backend-ratelimit-reset');
    });

    // Test for decrementing remaining count
    it('should decrement remaining count on each request', async () => {
      const response1 = await request(app)
        .get('/rate-limit-status')
        .set('Authorization', 'Bearer test_token');

      const remaining1 = parseInt(response1.headers['x-backend-ratelimit-remaining']);

      const response2 = await request(app)
        .get('/rate-limit-status')
        .set('Authorization', 'Bearer test_token');

      const remaining2 = parseInt(response2.headers['x-backend-ratelimit-remaining']);

      expect(remaining2).toBeLessThan(remaining1);
    });
  });

  describe('API Endpoints Validation', () => {
    test('GET /get-terms should require access token', async () => {
      const response = await request(app)
        .get('/get-terms')
        .send({})
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Access token is required');
    });

    test('GET /get-section-config should require access token and sectionid', async () => {
      // First test without authorization token - should get 401
      const response1 = await request(app)
        .get('/get-section-config')
        .send({})
        .expect(401);

      expect(response1.body).toHaveProperty('error');
      expect(response1.body.error).toContain('Access token is required');

      // Test with authorization token but missing sectionid - should get 400
      const response2 = await request(app)
        .get('/get-section-config')
        .set('Authorization', 'Bearer test_token')
        .send({})
        .expect(400);

      expect(response2.body).toHaveProperty('error');
      expect(response2.body.error).toContain('sectionid');
    });

    test('GET /get-flexi-structure should require access token, sectionid, and flexirecordid', async () => {
      // First test without authorization token - should get 401
      const response1 = await request(app)
        .get('/get-flexi-structure')
        .query({})
        .expect(401);

      expect(response1.body).toHaveProperty('error');
      expect(response1.body.error).toContain('Access token is required');

      // Test with authorization token but missing required params - should get 400
      const response2 = await request(app)
        .get('/get-flexi-structure')
        .set('Authorization', 'Bearer test_token')
        .query({})
        .expect(400);

      expect(response2.body).toHaveProperty('error');
      expect(response2.body.error).toContain('flexirecordid');
    });

    test('OAuth debug endpoint should provide configuration info', async () => {
      const response = await request(app)
        .get('/oauth/debug')
        .expect(200);

      expect(response.body).toHaveProperty('configuration');
      expect(response.body.configuration).toHaveProperty('clientId');
      expect(response.body.configuration).toHaveProperty('clientSecret');
      expect(response.body.configuration).toHaveProperty('frontendUrl');
      expect(response.body).toHaveProperty('runtime');
      expect(response.body).toHaveProperty('tokenStorage');
      expect(response.body).toHaveProperty('environment');
    });

    test('OAuth callback should handle missing authorization code', async () => {
      const response = await request(app)
        .get('/oauth/callback')
        .query({})
        .expect(302); // Should redirect on error

      // Should redirect to frontend with error
      expect(response.headers.location).toContain('error=no_code');
    });
  });

  describe('CORS Configuration', () => {
    test('should have CORS headers configured', async () => {
      const response = await request(app)
        .get('/rate-limit-status')
        .set('Origin', 'https://vikings-eventmgmt.onrender.com');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('OAuth Configuration', () => {
    test('should have OAuth environment variables', () => {
      // Test that OAuth credentials are properly configured from environment variables
      expect(process.env.OAUTH_CLIENT_ID).toBeDefined();
      expect(process.env.OAUTH_CLIENT_ID).not.toBe('');
      expect(process.env.OAUTH_CLIENT_ID).toMatch(/^[a-zA-Z0-9_]+$/); // Valid OAuth client ID format
      
      expect(process.env.OAUTH_CLIENT_SECRET).toBeDefined();
      expect(process.env.OAUTH_CLIENT_SECRET).not.toBe('');
      expect(process.env.OAUTH_CLIENT_SECRET.length).toBeGreaterThan(10); // OAuth secrets should be reasonably long
    });

    test('OAuth debug endpoint with state parameter', async () => {
      const response = await request(app)
        .get('/oauth/debug?state=dev')
        .expect(200);

      expect(response.body).toHaveProperty('runtime');
      expect(response.body.runtime).toHaveProperty('detectedFrontendUrl');
      expect(response.body.runtime.detectedFrontendUrl).toContain('localhost');
    });

    test('Token validation endpoint should work with Authorization header', async () => {
      // This test simulates the cross-domain scenario where frontend
      // uses Authorization header instead of session cookies
      const response = await request(app)
        .get('/validate-token')
        .set('Authorization', 'Bearer fake_token_for_testing')
        .expect(401); // Should fail with fake token

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid or expired token');
    });

    test('Token validation endpoint should require Authorization header', async () => {
      const response = await request(app)
        .get('/validate-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Authorization header required');
    });
  });
});
