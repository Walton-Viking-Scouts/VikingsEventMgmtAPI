const { detectBlockedResponse, parseOSMResponse } = require('../utils/responseHelpers');
const { processOSMResponse } = require('../utils/osmApiHandler');

const BLOCKED_HTML = `<!DOCTYPE html>
<html>
<head><title>Online Scout Manager (OSM): Blocked</title></head>
<body><p>Your access has been blocked. Please wait before retrying.</p></body>
</html>`;

const NON_BLOCKED_HTML = `<!DOCTYPE html>
<html>
<head><title>Online Scout Manager (OSM): Error</title></head>
<body><p>An unexpected error occurred.</p></body>
</html>`;

describe('detectBlockedResponse', () => {
  it('returns true for the OSM blocked HTML page', () => {
    expect(detectBlockedResponse(BLOCKED_HTML)).toBe(true);
  });

  it('returns false for plain JSON text', () => {
    expect(detectBlockedResponse('{"foo": "bar blocked"}')).toBe(false);
  });

  it('returns false for HTML without "blocked"', () => {
    expect(detectBlockedResponse(NON_BLOCKED_HTML)).toBe(false);
  });
});

describe('parseOSMResponse', () => {
  it('returns a 503 blocked shape for blocked HTML', () => {
    const result = parseOSMResponse(BLOCKED_HTML, 'test-endpoint');
    expect(result.success).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.status).toBe(503);
    expect(result.error).toMatch(/blocked/i);
  });

  it('returns the existing 500 invalid-JSON shape for non-blocked HTML', () => {
    const result = parseOSMResponse(NON_BLOCKED_HTML, 'test-endpoint');
    expect(result.success).toBe(false);
    expect(result.blocked).toBeUndefined();
    expect(result.status).toBe(500);
    expect(result.error).toBe('Invalid JSON response from OSM API');
  });

  it('returns success for valid JSON', () => {
    const result = parseOSMResponse('{"foo": "bar"}', 'test-endpoint');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ foo: 'bar' });
  });
});

describe('processOSMResponse', () => {
  const makeLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  it('returns a 503 blocked shape for blocked HTML', async () => {
    const endpointLogger = makeLogger();
    const result = await processOSMResponse(
      { status: 200 },
      BLOCKED_HTML,
      null,
      { sessionId: 'test-session' },
      endpointLogger,
    );

    expect(result.status).toBe(503);
    expect(result.json.blocked).toBe(true);
    expect(result.json.error).toMatch(/blocked/i);
    expect(endpointLogger.error).toHaveBeenCalledWith(
      'OSM returned Blocked page',
      expect.objectContaining({
        responsePreview: expect.any(String),
      }),
    );
  });

  it('returns the existing 500 invalid-JSON shape for non-blocked HTML', async () => {
    const endpointLogger = makeLogger();
    const result = await processOSMResponse(
      { status: 200 },
      NON_BLOCKED_HTML,
      null,
      { sessionId: 'test-session' },
      endpointLogger,
    );

    expect(result.status).toBe(500);
    expect(result.json.blocked).toBeUndefined();
    expect(result.json.error).toBe('Invalid JSON response from OSM API');
  });
});
