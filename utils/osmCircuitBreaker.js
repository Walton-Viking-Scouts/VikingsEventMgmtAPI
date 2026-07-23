const { logger } = require('../config/sentry');

const COOLDOWN_MS = 60 * 60 * 1000;

const STATE_CLOSED = 'closed';
const STATE_OPEN = 'open';
const STATE_HALF_OPEN = 'half-open';

let state = STATE_CLOSED;
let trippedAt = null;
let tripCount = 0;
let probeInFlight = false;

/**
 * Builds the status snapshot shared by getStatus() and log calls.
 * @returns {{state: string, trippedAt: string|null, tripCount: number, cooldownMs: number, secondsUntilProbe: number|null}}
 */
const buildStatus = () => {
  let secondsUntilProbe = null;
  if (state !== STATE_CLOSED && trippedAt !== null) {
    const remainingMs = trippedAt + COOLDOWN_MS - Date.now();
    secondsUntilProbe = Math.max(0, Math.ceil(remainingMs / 1000));
  }
  return {
    state,
    trippedAt: trippedAt !== null ? new Date(trippedAt).toISOString() : null,
    tripCount,
    cooldownMs: COOLDOWN_MS,
    secondsUntilProbe,
  };
};

/**
 * Trips the breaker to open, stamping a fresh trippedAt and incrementing
 * tripCount. Used both when OSM's Blocked page is detected and for
 * admin/testing force-open.
 * @returns {void}
 */
const trip = () => {
  state = STATE_OPEN;
  trippedAt = Date.now();
  tripCount += 1;
  probeInFlight = false;
  logger.error('OSM circuit breaker tripped', buildStatus());
};

/**
 * Called when a Blocked page is detected on any OSM-facing request.
 * Alias for trip() - kept as a separate name so call sites read intent.
 * @returns {void}
 */
const recordBlocked = () => {
  trip();
};

/**
 * Determines whether a new request may proceed to OSM.
 * Closed: always allows. Open: denies until the hourly cooldown has
 * elapsed since trippedAt, at which point it transitions to half-open and
 * allows exactly one caller through as the probe - concurrent callers
 * during that same open window keep getting denied until the probe
 * resolves (recordSuccess/recordProbeFailure) or the breaker is reset.
 * @returns {boolean} True if the request may proceed
 */
const shouldAllowRequest = () => {
  if (state === STATE_CLOSED) {
    return true;
  }

  if (state === STATE_HALF_OPEN) {
    return false;
  }

  const cooldownElapsed = trippedAt !== null && Date.now() - trippedAt >= COOLDOWN_MS;
  if (!cooldownElapsed || probeInFlight) {
    return false;
  }

  state = STATE_HALF_OPEN;
  probeInFlight = true;
  logger.info('OSM circuit breaker probing', buildStatus());
  return true;
};

/**
 * Called on any successfully-parsed OSM response. Closes the breaker if it
 * was half-open or open; no-op when already closed.
 * @returns {void}
 */
const recordSuccess = () => {
  if (state === STATE_CLOSED) {
    return;
  }
  const wasHalfOpen = state === STATE_HALF_OPEN;
  state = STATE_CLOSED;
  trippedAt = null;
  probeInFlight = false;
  if (wasHalfOpen) {
    logger.info('OSM circuit breaker recovered', buildStatus());
  }
};

/**
 * Called when the half-open probe request fails for a non-blocked reason
 * (network error, non-HTML error, etc). No-ops unless the breaker is
 * currently half-open. Clears probe-in-flight and returns to open WITHOUT
 * resetting trippedAt to now, so the next request immediately becomes the
 * next probe attempt rather than the cooldown being pushed out another
 * full hour.
 * @returns {void}
 */
const recordProbeFailure = () => {
  if (state !== STATE_HALF_OPEN) {
    return;
  }
  state = STATE_OPEN;
  probeInFlight = false;
};

/**
 * Force-closes the breaker and clears its history (admin use / test isolation).
 * @returns {void}
 */
const reset = () => {
  state = STATE_CLOSED;
  trippedAt = null;
  tripCount = 0;
  probeInFlight = false;
};

/**
 * Returns the current breaker status.
 * @returns {{state: string, trippedAt: string|null, tripCount: number, cooldownMs: number, secondsUntilProbe: number|null}}
 */
const getStatus = () => buildStatus();

module.exports = {
  shouldAllowRequest,
  recordBlocked,
  recordSuccess,
  recordProbeFailure,
  reset,
  trip,
  getStatus,
};
