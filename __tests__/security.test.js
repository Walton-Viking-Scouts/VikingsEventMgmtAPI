const request = require('supertest');

// Mock environment variables before importing the server
process.env.OAUTH_CLIENT_ID = 'test-client-id';
process.env.OAUTH_CLIENT_SECRET = 'test-client-secret';
process.env.NODE_ENV = 'test';

// Import the server to get access to the app
const app = require('../server');

describe('Frontend URL Validation Security', () => {
  describe('validateFrontendUrl function (via OAuth callback)', () => {
    
    test('should accept valid localhost URLs', async () => {
      const response = await request(app)
        .get('/oauth/callback?frontend_url=https://localhost:3001');
      
      // Should not throw validation error (would redirect with error if validation failed)
      expect(response.status).toBe(302); // Redirect is expected for OAuth callback
    });
    
    test('should accept valid production URLs', async () => {
      const response = await request(app)
        .get('/oauth/callback?frontend_url=https://vikingeventmgmt.onrender.com');
      
      expect(response.status).toBe(302);
    });
    
    test('should accept valid PR preview URLs', async () => {
      const response = await request(app)
        .get('/oauth/callback?frontend_url=https://vikingeventmgmt-pr-123.onrender.com');
      
      expect(response.status).toBe(302);
    });
    
    test('should reject malicious URLs and fallback to default', async () => {
      const response = await request(app)
        .get('/oauth/callback?frontend_url=https://evil.com');
      
      // Should redirect to default frontend since malicious URL is rejected
      expect(response.status).toBe(302);
      expect(response.headers.location).not.toContain('evil.com');
      expect(response.headers.location).toMatch(/vikingeventmgmt\.onrender\.com/);
    });
    
    test('should reject non-HTTPS URLs and fallback to default', async () => {
      const response = await request(app)
        .get('/oauth/callback?frontend_url=http://vikings-eventmgmt.onrender.com');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).not.toContain('http://vikings-eventmgmt.onrender.com');
      expect(response.headers.location).toMatch(/vikingeventmgmt\.onrender\.com/);
    });
    
    test('should reject invalid URL formats and fallback to default', async () => {
      const response = await request(app)
        .get('/oauth/callback?frontend_url=not-a-url');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).not.toContain('not-a-url');
      expect(response.headers.location).toMatch(/vikingeventmgmt\.onrender\.com/);
    });
    
  });
});