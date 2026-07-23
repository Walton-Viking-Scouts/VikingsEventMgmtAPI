const { detectBlockedResponse } = require('../utils/responseHelpers');
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

describe('detectBlockedResponse title anchoring', () => {
  it('returns false for HTML that mentions "blocked" only in the body', () => {
    const html = `<!DOCTYPE html>
<html>
<head><title>Online Scout Manager (OSM): Error</title></head>
<body><p>Disable your pop-up blocker and blocked-content settings.</p></body>
</html>`;
    expect(detectBlockedResponse(html)).toBe(false);
  });

  it('matches the blocked title case-insensitively', () => {
    const html = '<html><head><title>OSM: BLOCKED</title></head><body></body></html>';
    expect(detectBlockedResponse(html)).toBe(true);
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
