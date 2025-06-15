const request = require('supertest');
require('dotenv').config();

// Mock setInterval BEFORE importing server to prevent cleanup timers
const originalSetInterval = global.setInterval;
global.setInterval = jest.fn();

// Mock fetch to prevent actual HTTP calls
global.fetch = jest.fn(() => 
  Promise.resolve({
    status: 200,
    headers: { get: jest.fn(() => null) },
    json: () => Promise.resolve({ data: 'test' }),
    text: () => Promise.resolve('test response')
  })
);

// Import server AFTER mocking setInterval
const app = require('../server');

describe('Integration Tests', () => {
  afterAll((done) => {
    // Restore original setInterval
    global.setInterval = originalSetInterval;
    jest.clearAllTimers();
    setTimeout(done, 100);
  });

  describe('Full API Flow', () => {
    test('should handle a complete user roles request', async () => {
      const mockResponse = {
        roles: [{ sectionid: '123', section: 'Beavers' }]
      };
      
      fetch.mockResolvedValueOnce({
        status: 200,
        headers: { 
          get: jest.fn((header) => {
            switch(header) {
              case 'X-RateLimit-Limit': return '100';
              case 'X-RateLimit-Remaining': return '99';
              case 'X-RateLimit-Reset': return Math.floor(Date.now() / 1000) + 3600;
              default: return null;
            }
          })
        },
        json: () => Promise.resolve(mockResponse)
      });

      const response = await request(app)
        .post('/get-user-roles')
        .send({ access_token: 'test_token' })
        .expect(200);

      expect(response.body).toHaveProperty('_rateLimitInfo');
      expect(response.body._rateLimitInfo).toHaveProperty('backend');
      expect(response.body._rateLimitInfo).toHaveProperty('osm');
    });
  });
});