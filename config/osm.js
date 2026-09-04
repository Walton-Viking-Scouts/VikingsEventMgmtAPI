/**
 * OSM (Online Scout Manager) integration configuration shared by the OAuth
 * routes and helpers so the requested scope has a single source of truth.
 */

/**
 * OSM OAuth scopes requested at login. Every scope here must be enabled on the
 * OSM app registration or OSM rejects the whole authorisation request.
 * section:finance:read is required by the online payments (subscriptions)
 * endpoints.
 */
const DEFAULT_OSM_OAUTH_SCOPE = 'section:member:read section:programme:read section:event:read section:flexirecord:write section:finance:read';

/**
 * Effective scope. Override with the OSM_OAUTH_SCOPE environment variable when
 * a deployment must request a different set (for example while the OSM app
 * registration does not yet grant a newly added scope).
 */
const OSM_OAUTH_SCOPE = (process.env.OSM_OAUTH_SCOPE || DEFAULT_OSM_OAUTH_SCOPE).trim();

const OSM_OAUTH_AUTHORIZE_URL = 'https://www.onlinescoutmanager.co.uk/oauth/authorize';

module.exports = {
  DEFAULT_OSM_OAUTH_SCOPE,
  OSM_OAUTH_SCOPE,
  OSM_OAUTH_AUTHORIZE_URL,
};
