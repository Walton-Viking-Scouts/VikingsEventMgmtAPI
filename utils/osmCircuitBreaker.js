const { logger } = require('../config/sentry');

const COOLDOWN_MS = 60 * 60 * 1000;

const STATE_CLOSED = 'closed';
const STATE_OPEN = 'open';
const STATE_HALF_OPEN = 'half-open';

let state = STATE_CLOSED;
let trippedAt = null;
let tripCount = 0;
let probeInFlight = false;
let generation = 0;

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
  generation += 1;
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
 * @param {number} observedGeneration - The generation captured by the caller
 *   at the moment its request was dispatched (via getGeneration()). If a
 *   trip()/reset() has since bumped the generation, this observation is
 *   stale (TOCTOU: the request was in flight during a state change it never
 *   observed) and must be ignored rather than force-closing a fresh trip.
 * @returns {void}
 */
const recordSuccess = (observedGeneration) => {
  if (observedGeneration !== generation) {
    return;
  }
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
 * @param {number} observedGeneration - The generation captured by the caller
 *   at the moment its request was dispatched (via getGeneration()). A stale
 *   pre-trip failure landing during a genuine half-open probe must not be
 *   allowed to end a probe cycle it never belonged to.
 * @returns {void}
 */
const recordProbeFailure = (observedGeneration) => {
  if (observedGeneration !== generation) {
    return;
  }
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
  generation += 1;
  logger.warn('OSM circuit breaker reset', buildStatus());
};

/**
 * Returns the current breaker status.
 * @returns {{state: string, trippedAt: string|null, tripCount: number, cooldownMs: number, secondsUntilProbe: number|null}}
 */
const getStatus = () => buildStatus();

/**
 * Returns the current generation counter. Callers should capture this right
 * after shouldAllowRequest() passes and pass it back into recordSuccess()/
 * recordProbeFailure() so a forced trip()/reset() during the request can
 * invalidate that stale observation (TOCTOU guard). Not reusing tripCount
 * for this because reset() zeroes tripCount, which could make a stale
 * generation match again after a reset.
 * @returns {number} The current generation
 */
const getGeneration = () => generation;

module.exports = {
  shouldAllowRequest,
  recordBlocked,
  recordSuccess,
  recordProbeFailure,
  reset,
  trip,
  getStatus,
  getGeneration,
};
