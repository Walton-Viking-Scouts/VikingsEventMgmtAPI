const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'osm.js');
const HELPERS_PATH = path.join(__dirname, '..', 'utils', 'serverHelpers.js');

const freshRequire = (modulePath) => {
  let loaded;
  jest.isolateModules(() => {
    loaded = require(modulePath);
  });
  return loaded;
};

describe('OSM OAuth scope configuration', () => {
  const originalScope = process.env.OSM_OAUTH_SCOPE;

  afterEach(() => {
    if (originalScope === undefined) {
      delete process.env.OSM_OAUTH_SCOPE;
    } else {
      process.env.OSM_OAUTH_SCOPE = originalScope;
    }
    freshRequire(CONFIG_PATH);
  });

  test('default scope includes finance read for the subscriptions endpoints', () => {
    delete process.env.OSM_OAUTH_SCOPE;
    const { OSM_OAUTH_SCOPE, DEFAULT_OSM_OAUTH_SCOPE } = freshRequire(CONFIG_PATH);

    expect(OSM_OAUTH_SCOPE).toBe(DEFAULT_OSM_OAUTH_SCOPE);
    expect(OSM_OAUTH_SCOPE.split(' ')).toEqual([
      'section:member:read',
      'section:programme:read',
      'section:event:read',
      'section:flexirecord:write',
      'section:finance:read',
    ]);
  });

  test('OSM_OAUTH_SCOPE environment variable overrides the default', () => {
    process.env.OSM_OAUTH_SCOPE = ' section:member:read section:event:read ';
    const { OSM_OAUTH_SCOPE } = freshRequire(CONFIG_PATH);

    expect(OSM_OAUTH_SCOPE).toBe('section:member:read section:event:read');
  });

  test('createOAuthDebugResponse uses the shared scope and encoded redirect_uri', () => {
    delete process.env.OSM_OAUTH_SCOPE;
    process.env.OAUTH_CLIENT_ID = 'client_123';
    process.env.BACKEND_URL = 'https://backend.example.com';
    freshRequire(CONFIG_PATH);
    const { createOAuthDebugResponse } = freshRequire(HELPERS_PATH);

    const req = { query: {}, get: () => undefined };
    const result = createOAuthDebugResponse(req, () => 'https://frontend.example.com');

    expect(result.scope).toContain('section:finance:read');
    expect(result.authUrl).toContain(`scope=${encodeURIComponent(result.scope)}`);
    expect(result.authUrl).toContain(`redirect_uri=${encodeURIComponent('https://backend.example.com/oauth/callback')}`);
    expect(result.authUrl).toContain('client_id=client_123');
  });
});
