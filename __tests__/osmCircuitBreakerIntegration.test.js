const request = require('supertest');

require('dotenv').config();

process.env.OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || 'test_client_id';
process.env.OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || 'test_client_secret';

global.setInterval = jest.fn();
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: jest.fn(() => null) },
    json: () => Promise.resolve({ data: 'test' }),
    text: () => Promise.resolve('{"data":"test"}'),
  }),
);

const app = require('../server');
const breaker = require('../utils/osmCircuitBreaker');

describe('OSM circuit breaker gating', () => {
  const originalAdminKey = process.env.ADMIN_API_KEY;

  beforeEach(() => {
    breaker.reset();
    fetch.mockClear();
  });

  afterEach(() => {
    breaker.reset();
    if (originalAdminKey === undefined) {
      delete process.env.ADMIN_API_KEY;
    } else {
      process.env.ADMIN_API_KEY = originalAdminKey;
    }
  });

  describe('factory-created endpoint', () => {
    it('proxies normally while the breaker is closed', async () => {
      const res = await request(app)
        .get('/get-terms')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('returns 503 blocked without calling OSM when the breaker is open', async () => {
      breaker.trip();

      const res = await request(app)
        .get('/get-terms')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        error: 'OSM API access blocked - sign in again to reconnect',
        blocked: true,
      });
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('startup data handler', () => {
    it('returns 503 blocked without calling OSM when the breaker is open', async () => {
      breaker.trip();

      const res = await request(app)
        .get('/get-startup-data')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(503);
      expect(res.body.blocked).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('GET /admin/osm-breaker', () => {
    it('returns 503 when ADMIN_API_KEY is not configured', async () => {
      delete process.env.ADMIN_API_KEY;

      const res = await request(app)
        .get('/admin/osm-breaker')
        .set('x-admin-key', 'anything');

      expect(res.status).toBe(503);
      expect(res.body).toEqual({ error: 'Admin endpoint not configured' });
    });

    it('returns 401 when the key is wrong', async () => {
      process.env.ADMIN_API_KEY = 'correct-key';

      const res = await request(app)
        .get('/admin/osm-breaker')
        .set('x-admin-key', 'wrong-key');

      expect(res.status).toBe(401);
    });

    it('returns 401 when the key header is missing', async () => {
      process.env.ADMIN_API_KEY = 'correct-key';

      const res = await request(app).get('/admin/osm-breaker');

      expect(res.status).toBe(401);
    });

    it('returns the breaker status with the correct key', async () => {
      process.env.ADMIN_API_KEY = 'correct-key';

      const res = await request(app)
        .get('/admin/osm-breaker')
        .set('x-admin-key', 'correct-key');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        state: 'closed',
        trippedAt: null,
        tripCount: 0,
        cooldownMs: 60 * 60 * 1000,
        secondsUntilProbe: null,
      });
    });
  });

  describe('POST /admin/osm-breaker', () => {
    beforeEach(() => {
      process.env.ADMIN_API_KEY = 'correct-key';
    });

    it('trips the breaker', async () => {
      const res = await request(app)
        .post('/admin/osm-breaker')
        .set('x-admin-key', 'correct-key')
        .send({ action: 'trip' });

      expect(res.status).toBe(200);
      expect(res.body.state).toBe('open');
    });

    it('resets the breaker', async () => {
      breaker.trip();

      const res = await request(app)
        .post('/admin/osm-breaker')
        .set('x-admin-key', 'correct-key')
        .send({ action: 'reset' });

      expect(res.status).toBe(200);
      expect(res.body.state).toBe('closed');
    });

    it('returns 400 for an unknown action', async () => {
      const res = await request(app)
        .post('/admin/osm-breaker')
        .set('x-admin-key', 'correct-key')
        .send({ action: 'bogus' });

      expect(res.status).toBe(400);
    });

    it('returns 401 for a wrong key', async () => {
      const res = await request(app)
        .post('/admin/osm-breaker')
        .set('x-admin-key', 'wrong-key')
        .send({ action: 'trip' });

      expect(res.status).toBe(401);
    });
  });
});
