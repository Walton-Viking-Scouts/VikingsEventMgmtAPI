const breaker = require('../utils/osmCircuitBreaker');

const COOLDOWN_MS = 60 * 60 * 1000;

describe('osmCircuitBreaker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    breaker.reset();
  });

  afterEach(() => {
    breaker.reset();
    jest.useRealTimers();
  });

  it('allows requests when closed', () => {
    expect(breaker.shouldAllowRequest()).toBe(true);
    expect(breaker.getStatus().state).toBe('closed');
  });

  it('opens on recordBlocked', () => {
    breaker.recordBlocked();
    const status = breaker.getStatus();
    expect(status.state).toBe('open');
    expect(status.tripCount).toBe(1);
    expect(status.trippedAt).toBe(new Date('2026-01-01T00:00:00Z').toISOString());
  });

  it('denies requests while open and before the cooldown elapses', () => {
    breaker.recordBlocked();
    jest.setSystemTime(new Date(Date.now() + COOLDOWN_MS - 1000));
    expect(breaker.shouldAllowRequest()).toBe(false);
    expect(breaker.getStatus().state).toBe('open');
  });

  it('allows exactly one caller through as the probe once the cooldown elapses', () => {
    breaker.recordBlocked();
    jest.setSystemTime(new Date(Date.now() + COOLDOWN_MS));

    expect(breaker.shouldAllowRequest()).toBe(true);
    expect(breaker.getStatus().state).toBe('half-open');

    expect(breaker.shouldAllowRequest()).toBe(false);
    expect(breaker.shouldAllowRequest()).toBe(false);
  });

  it('closes and recovers when the half-open probe succeeds', () => {
    breaker.recordBlocked();
    jest.setSystemTime(new Date(Date.now() + COOLDOWN_MS));
    breaker.shouldAllowRequest();

    breaker.recordSuccess();

    const status = breaker.getStatus();
    expect(status.state).toBe('closed');
    expect(status.trippedAt).toBeNull();
    expect(breaker.shouldAllowRequest()).toBe(true);
  });

  it('re-opens with a fresh trippedAt when recordBlocked fires from half-open', () => {
    breaker.recordBlocked();
    const firstTrippedAt = breaker.getStatus().trippedAt;
    jest.setSystemTime(new Date(Date.now() + COOLDOWN_MS));
    breaker.shouldAllowRequest();

    jest.setSystemTime(new Date(Date.now() + 1000));
    breaker.recordBlocked();

    const status = breaker.getStatus();
    expect(status.state).toBe('open');
    expect(status.tripCount).toBe(2);
    expect(status.trippedAt).not.toBe(firstTrippedAt);
  });

  it('leaves the breaker open on recordProbeFailure but allows the next request to probe again', () => {
    breaker.recordBlocked();
    jest.setSystemTime(new Date(Date.now() + COOLDOWN_MS));
    breaker.shouldAllowRequest();

    breaker.recordProbeFailure();

    expect(breaker.getStatus().state).toBe('open');
    expect(breaker.shouldAllowRequest()).toBe(true);
    expect(breaker.getStatus().state).toBe('half-open');
  });

  it('no-ops recordProbeFailure when not half-open', () => {
    expect(breaker.getStatus().state).toBe('closed');
    breaker.recordProbeFailure();
    expect(breaker.getStatus().state).toBe('closed');
  });

  it('no-ops recordSuccess when already closed', () => {
    breaker.recordSuccess();
    expect(breaker.getStatus().tripCount).toBe(0);
    expect(breaker.getStatus().state).toBe('closed');
  });

  it('force-closes on reset', () => {
    breaker.recordBlocked();
    breaker.reset();
    const status = breaker.getStatus();
    expect(status.state).toBe('closed');
    expect(status.trippedAt).toBeNull();
    expect(breaker.shouldAllowRequest()).toBe(true);
  });

  it('force-opens on trip', () => {
    breaker.trip();
    expect(breaker.getStatus().state).toBe('open');
    expect(breaker.shouldAllowRequest()).toBe(false);
  });

  it('returns the documented getStatus shape', () => {
    const status = breaker.getStatus();
    expect(status).toEqual({
      state: 'closed',
      trippedAt: null,
      tripCount: 0,
      cooldownMs: COOLDOWN_MS,
      secondsUntilProbe: null,
    });
  });

  it('reports secondsUntilProbe counting down while open', () => {
    breaker.recordBlocked();
    jest.setSystemTime(new Date(Date.now() + 1000));
    const status = breaker.getStatus();
    expect(status.secondsUntilProbe).toBeGreaterThan(0);
    expect(status.secondsUntilProbe).toBeLessThanOrEqual(Math.ceil(COOLDOWN_MS / 1000));
  });
});
