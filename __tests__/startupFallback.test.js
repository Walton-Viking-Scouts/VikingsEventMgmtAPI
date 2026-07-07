const request = require('supertest');

require('dotenv').config();

process.env.OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || 'test_client_id';
process.env.OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || 'test_client_secret';

global.setInterval = jest.fn();
global.fetch = jest.fn();

const app = require('../server');

/**
 * Builds a mock fetch response in the shape makeOSMRequest expects
 * (it reads rate-limit headers off every response).
 *
 * @param {object} overrides - Response field overrides
 * @returns {object} Mock fetch response
 */
function mockResponse(overrides = {}) {
  return {
    ok: overrides.status ? overrides.status >= 200 && overrides.status < 300 : true,
    status: 200,
    headers: { get: jest.fn(() => null) },
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    ...overrides,
  };
}

describe('GET /get-startup-data oauth/resource fallback', () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  it('falls back to oauth/resource on 410 and returns the startup globals shape', async () => {
    global.fetch
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 410 }))
      .mockResolvedValueOnce(mockResponse({
        json: () => Promise.resolve({
          data: { full_name: 'John Smith', user_id: 123, email: 'j@example.com' },
        }),
      }));

    const res = await request(app)
      .get('/get-startup-data')
      .set('Authorization', 'Bearer fallback-success-token');

    expect(res.status).toBe(200);
    expect(res.body.globals).toEqual({
      firstname: 'John',
      lastname: 'Smith',
      userid: 123,
      email: 'j@example.com',
    });
    expect(res.body._source).toBe('oauth-resource');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(String(global.fetch.mock.calls[1][0])).toContain('/oauth/resource');
  });

  it('splits single-word and multi-part names sensibly', async () => {
    global.fetch
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 410 }))
      .mockResolvedValueOnce(mockResponse({
        json: () => Promise.resolve({
          data: { full_name: '  Mary Jane van der Berg ', user_id: 5, email: null },
        }),
      }));

    const res = await request(app)
      .get('/get-startup-data')
      .set('Authorization', 'Bearer name-split-token');

    expect(res.status).toBe(200);
    expect(res.body.globals.firstname).toBe('Mary');
    expect(res.body.globals.lastname).toBe('Jane van der Berg');
  });

  it('returns 502 naming both failures when the fallback also fails', async () => {
    global.fetch
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 410 }))
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 500 }));

    const res = await request(app)
      .get('/get-startup-data')
      .set('Authorization', 'Bearer fallback-failure-token');

    expect(res.status).toBe(502);
    expect(res.body.error).toContain('410');
    expect(res.body.error).toContain('oauth/resource');
  });

  it('does not trigger the fallback on 429 rate limiting', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({ ok: false, status: 429 }));

    const res = await request(app)
      .get('/get-startup-data')
      .set('Authorization', 'Bearer rate-limited-token');

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('OSM API rate limit exceeded');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('surfaces non-410 startup errors without invoking the fallback', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({ ok: false, status: 500 }));

    const res = await request(app)
      .get('/get-startup-data')
      .set('Authorization', 'Bearer transient-error-token');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('OSM API error: 500');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
