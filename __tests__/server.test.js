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

describe('Frontend URL Validation Security', () => {
  test('should validate localhost URLs with different ports', async () => {
    const validLocalUrls = [
      'http://localhost:3000',
      'https://localhost:3001',
      'http://127.0.0.1:8080',
      'https://127.0.0.1:5000',
    ];

    for (const url of validLocalUrls) {
      const response = await request(app)
        .get('/test-frontend-url')
        .query({ frontend_url: url });
      expect(response.status).toBe(200);
      expect(response.body.result.detectedUrl).toBe(url);
    }
  });

  test('should reject malicious URLs masquerading as valid domains', async () => {
    const maliciousUrls = [
      'https://vikingeventmgmt.onrender.com.evil.com',
      'https://evil.com/vikingeventmgmt.onrender.com',
      'https://vikingeventmgmt-onrender-com.evil.com',
      'https://sub.vikingeventmgmt.onrender.com.fake.com',
    ];

    for (const url of maliciousUrls) {
      const response = await request(app)
        .get('/test-frontend-url')
        .query({ frontend_url: url });
      expect(response.status).toBe(200);
      expect(response.body.result.detectedUrl).not.toBe(url);
      expect(response.body.result.detectedUrl).toBe('https://vikingeventmgmt.onrender.com');
    }
  });

  test('should handle edge cases in PR preview pattern matching', async () => {
    const testCases = [
      { url: 'https://vikingeventmgmt-pr-0.onrender.com', valid: true },
      { url: 'https://vikingeventmgmt-pr-00123.onrender.com', valid: true },
      { url: 'https://vikingeventmgmt-pr-999999.onrender.com', valid: true },
      { url: 'https://vikingeventmgmt-pr-123a.onrender.com', valid: false },
      { url: 'https://vikingeventmgmt-pr-abc123.onrender.com', valid: false },
      { url: 'https://vikingeventmgmt-pr-123-.onrender.com', valid: false },
    ];

    for (const testCase of testCases) {
      const response = await request(app)
        .get('/test-frontend-url')
        .query({ frontend_url: testCase.url });
      expect(response.status).toBe(200);
        
      if (testCase.valid) {
        expect(response.body.result.detectedUrl).toBe(testCase.url);
      } else {
        expect(response.body.result.detectedUrl).not.toBe(testCase.url);
      }
    }
  });

  test('should handle protocol edge cases', async () => {
    const protocolTests = [
      { url: 'ftp://localhost:3000', valid: false },
      { url: 'file://localhost:3000', valid: false },
      { url: 'javascript:alert(1)', valid: false },
      { url: 'data:text/html,<script>alert(1)</script>', valid: false },
      { url: 'mailto:admin@example.com', valid: false },
    ];

    for (const test of protocolTests) {
      const response = await request(app)
        .get('/test-frontend-url')
        .query({ frontend_url: test.url });
      expect(response.status).toBe(200);
      expect(response.body.result.detectedUrl).not.toBe(test.url);
    }
  });
});

describe('Frontend URL Detection Edge Cases', () => {
  test('should handle state parameter with multiple frontend_url occurrences', async () => {
    const maliciousState = 'frontend_url=https://evil.com&legitimate_param=value&frontend_url=https://localhost:3000';
      
    const response = await request(app)
      .get('/test-frontend-url')
      .query({ state: maliciousState });
      
    expect(response.status).toBe(200);
    // Should extract the first valid URL, not the malicious one
  });

  test('should handle deeply nested URL encoding in state', async () => {
    const validUrl = 'https://localhost:3000';
    const doubleEncoded = encodeURIComponent(encodeURIComponent(`frontend_url=${validUrl}`));
      
    const response = await request(app)
      .get('/test-frontend-url')
      .query({ state: doubleEncoded });
      
    expect(response.status).toBe(200);
  });

  test('should handle Referer header with query parameters and fragments', async () => {
    const refererWithParams = 'https://vikingeventmgmt-pr-42.onrender.com/dashboard?tab=events&filter=upcoming#section1';
      
    const response = await request(app)
      .get('/test-frontend-url')
      .set('Referer', refererWithParams);
      
    expect(response.status).toBe(200);
    expect(response.body.result.detectedUrl).toBe('https://vikingeventmgmt-pr-42.onrender.com');
  });

  test('should handle localhost Referer with non-standard ports', async () => {
    const localhostUrls = [
      'http://localhost:8080/app',
      'https://localhost:4000/admin',
      'http://127.0.0.1:9000/test',
    ];

    for (const url of localhostUrls) {
      const response = await request(app)
        .get('/test-frontend-url')
        .set('Referer', url);
        
      expect(response.status).toBe(200);
      const expectedUrl = new URL(url);
      const expected = `${expectedUrl.protocol}//${expectedUrl.hostname}:${expectedUrl.port}`;
      expect(response.body.result.detectedUrl).toBe(expected);
    }
  });

  test('should prioritize valid URLs when multiple detection methods provide different results', async () => {
    // Test explicit parameter vs malicious Referer
    const response = await request(app)
      .get('/test-frontend-url')
      .query({ frontend_url: 'https://localhost:3000' })
      .set('Referer', 'https://evil-site.com/fake-page');
      
    expect(response.status).toBe(200);
    expect(response.body.result.detectedUrl).toBe('https://localhost:3000');
    expect(response.body.result.detectionMethod).toBe('Explicit Parameter');
  });
});

describe('Health Endpoint Comprehensive Testing', () => {
  test('should return different memory usage patterns', async () => {
    // Test multiple calls to see memory consistency
    const responses = await Promise.all([
      request(app).get('/health'),
      request(app).get('/health'),
      request(app).get('/health'),
    ]);

    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body.memory.used).toMatch(/^\d+ MB$/);
      expect(response.body.memory.total).toMatch(/^\d+ MB$/);
    });
  });

  test('should validate health endpoint structure and types', async () => {
    const response = await request(app).get('/health');
      
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    expect(response.body).toHaveProperty('uptime');
    expect(response.body.uptime).toMatch(/^\d+ seconds$/);
    expect(response.body).toHaveProperty('environment');
    expect(response.body).toHaveProperty('tokenStats');
    expect(response.body.tokenStats).toHaveProperty('total');
    expect(response.body.tokenStats).toHaveProperty('active');
    expect(response.body.tokenStats).toHaveProperty('expired');
    expect(response.body).toHaveProperty('memory');
    expect(response.body.memory).toHaveProperty('used');
    expect(response.body.memory).toHaveProperty('total');
    expect(response.body).toHaveProperty('configuration');
    expect(response.body).toHaveProperty('monitoring');
  });

  test('should handle environment variable configurations', async () => {
    const originalEnv = { ...process.env };
      
    // Test with all environment variables set
    process.env.BACKEND_URL = 'https://test-backend.com';
    process.env.FRONTEND_URL = 'https://test-frontend.com';
    process.env.OAUTH_CLIENT_ID = 'test-client-id';
    process.env.OAUTH_CLIENT_SECRET = 'test-client-secret';
    process.env.SENTRY_DSN = 'https://test@sentry.io/project';

    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.configuration.backendUrl).toBe('https://test-backend.com');
    expect(response.body.configuration.frontendUrlConfigured).toBe(true);
    expect(response.body.configuration.oauthConfigured).toBe(true);
    expect(response.body.configuration.sentryConfigured).toBe(true);

    // Restore original environment
    process.env = originalEnv;
  });
});

describe('OAuth Callback Advanced Testing', () => {
  beforeEach(() => {
    process.env.OAUTH_CLIENT_ID = 'test-client-id';
    process.env.OAUTH_CLIENT_SECRET = 'test-client-secret';
    process.env.BACKEND_URL = 'https://test-backend.com';
  });

  test('should handle OAuth callback with state containing frontend URL', async () => {
    const frontendUrl = 'https://vikingeventmgmt-pr-123.onrender.com';
    const state = `frontend_url=${encodeURIComponent(frontendUrl)}&other_data=value`;
      
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        access_token: 'test-token',
        token_type: 'Bearer',
      }),
    });

    const response = await request(app)
      .get('/oauth/callback')
      .query({
        code: 'test-code',
        state: state,
      });
      
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain(frontendUrl);
  });

  test('should handle OAuth callback with malicious state parameter', async () => {
    const maliciousState = `frontend_url=${encodeURIComponent('https://evil.com')}&legitimate=data`;
      
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        access_token: 'test-token',
        token_type: 'Bearer',
      }),
    });

    const response = await request(app)
      .get('/oauth/callback')
      .query({
        code: 'test-code',
        state: maliciousState,
      });
      
    expect(response.status).toBe(302);
    expect(response.headers.location).not.toContain('evil.com');
  });

  test('should handle token exchange with different response formats', async () => {
    const tokenResponses = [
      {
        access_token: 'token1',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read write',
      },
      {
        access_token: 'token2',
        token_type: 'bearer', // lowercase
        expires_in: 7200,
      },
      {
        access_token: 'token3',
        // minimal response
      },
    ];

    for (const tokenData of tokenResponses) {
      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(tokenData),
      });

      const response = await request(app)
        .get('/oauth/callback')
        .query({
          code: 'test-code',
          state: 'test-state',
        });
        
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain(`access_token=${tokenData.access_token}`);
    }
  });

  test('should handle network timeouts and retries', async () => {
    // Test timeout on first attempt, success on second
    fetch
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'retry-success-token',
          token_type: 'Bearer',
        }),
      });

    const response = await request(app)
      .get('/oauth/callback')
      .query({
        code: 'test-code',
        state: 'retry-test',
      });
      
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('access_token=retry-success-token');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('Admin Endpoints Advanced Testing', () => {
  test('should handle admin endpoints with different NODE_ENV values', async () => {
    const environments = ['production', 'staging', 'test', 'development'];
      
    for (const env of environments) {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = env;
        
      const response = await request(app).get('/admin/tokens');
        
      if (env === 'production') {
        expect(response.status).toBe(403);
        expect(response.body.error).toContain('disabled in production');
      } else {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('summary');
      }
        
      process.env.NODE_ENV = originalEnv;
    }
  });

  test('should provide detailed token information in admin endpoints', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
      
    const response = await request(app).get('/admin/tokens');
      
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('summary');
    expect(response.body.summary).toHaveProperty('total');
    expect(response.body.summary).toHaveProperty('active');
    expect(response.body.summary).toHaveProperty('expired');
    expect(response.body).toHaveProperty('tokens');
    expect(Array.isArray(response.body.tokens)).toBe(true);
    expect(response.body).toHaveProperty('actions');
    expect(response.body.actions).toHaveProperty('cleanup');
    expect(response.body.actions).toHaveProperty('clearAll');
      
    process.env.NODE_ENV = originalEnv;
  });
});

describe('API Documentation Endpoints', () => {
  test('should serve backend documentation', async () => {
    const response = await request(app).get('/backend-docs');
    // Swagger UI can return 200 (direct content) or 301 (redirect to UI)
    expect([200, 301]).toContain(response.status);
  });

  test('should provide JSON API specification', async () => {
    const response = await request(app).get('/backend-docs.json');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('info');
    expect(response.body).toHaveProperty('paths');
  });

  test('should maintain backward compatibility with old API docs endpoint', async () => {
    const response = await request(app).get('/api-docs.json');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('info');
    expect(response.body).toHaveProperty('paths');
  });
});

describe('Test Endpoints Comprehensive Coverage', () => {
  test('should provide Sentry test functionality', async () => {
    const response = await request(app).get('/test-sentry');
      
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Sentry test endpoint');
    expect(response.body).toHaveProperty('usage');
    expect(response.body).toHaveProperty('sentryEnabled');
    expect(response.body).toHaveProperty('debug');
  });

  test('should handle Sentry test with message type', async () => {
    const response = await request(app).get('/test-sentry?type=message');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Test message sent to Sentry');
  });

  test('should handle Sentry test with exception type', async () => {
    const response = await request(app).get('/test-sentry?type=exception');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Test exception sent to Sentry');
  });

  test('should provide rate limiting test functionality', async () => {
    const response = await request(app).get('/test-rate-limits');
      
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Rate limiting test endpoint');
    expect(response.body).toHaveProperty('usage');
    expect(response.body).toHaveProperty('currentLimits');
  });
});

describe('Error Handling and Edge Cases', () => {
  test('should handle malformed JSON in POST requests gracefully', async () => {
    const response = await request(app)
      .post('/get-members-grid')
      .set('Content-Type', 'application/json')
      .send('{"invalid": json}');
      
    expect(response.status).toBe(400);
  });

  test('should handle extremely long URLs', async () => {
    const longUrl = 'https://localhost:3000/' + 'x'.repeat(2000);
      
    const response = await request(app)
      .get('/test-frontend-url')
      .query({ frontend_url: longUrl });
      
    expect(response.status).toBe(200);
    // Should fall back to default due to validation failure
    expect(response.body.result.detectedUrl).toBe('https://vikingeventmgmt.onrender.com');
  });

  test('should handle concurrent requests properly', async () => {
    const concurrentRequests = Array(5).fill(0).map(() => 
      request(app).get('/health'),
    );

    const responses = await Promise.all(concurrentRequests);
      
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
  });
});

describe('CORS Advanced Configuration', () => {
  test('should handle CORS with allowed origins', async () => {
    const allowedOrigins = [
      'https://vikingeventmgmt.onrender.com',
      'https://localhost:3000',
      'http://localhost:3001',
    ];

    for (const origin of allowedOrigins) {
      const response = await request(app)
        .get('/health')
        .set('Origin', origin);
        
      expect(response.status).toBe(200);
    }
  });

  test('should handle CORS preflight requests', async () => {
    const response = await request(app)
      .options('/health')
      .set('Origin', 'https://vikingeventmgmt.onrender.com')
      .set('Access-Control-Request-Method', 'GET');
      
    expect(response.status).toBe(200);
  });
});

describe('Performance Testing', () => {
  test('should handle rapid sequential requests efficiently', async () => {
    const startTime = Date.now();
    const requests = [];
      
    for (let i = 0; i < 10; i++) {
      requests.push(request(app).get('/health'));
    }
      
    const responses = await Promise.all(requests);
    const endTime = Date.now();
      
    expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
      
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });

  test('should maintain performance under mixed endpoint load', async () => {
    const mixedRequests = [
      request(app).get('/health'),
      request(app).get('/rate-limit-status'),
      request(app).get('/oauth/debug'),
      request(app).get('/test-frontend-url'),
      request(app).get('/backend-docs.json'),
    ];

    const startTime = Date.now();
    const responses = await Promise.all(mixedRequests);
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(2000);
      
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});
