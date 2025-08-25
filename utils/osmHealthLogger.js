const { logger } = require('../config/sentry');
const fallbackLogger = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.log,
  fmt: (strings, ...values) => strings.reduce((result, string, i) => result + string + (values[i] || ''), ''),
};
const log = logger || fallbackLogger;

/**
 * OSM API Health Monitoring
 * Tracks OSM API status and detects when OSM starts blocking/failing
 */
class OSMHealthLogger {
  constructor() {
    this.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();
    this.blockDetected = false;
  }

  /**
   * Log OAuth token exchange result
   */
  logTokenExchange(success, responseData, errorDetails = null) {
    const now = Date.now();
    
    if (success) {
      // Reset failure tracking on success
      if (this.consecutiveFailures > 0) {
        log.info(log.fmt`🎯 OSM OAuth recovered: ${this.consecutiveFailures} consecutive failures ended`, {
          previousFailures: this.consecutiveFailures,
          downtimeDuration: now - this.lastSuccessTime,
          section: 'osm-health-recovery',
          timestamp: new Date().toISOString(),
        });
      }
      
      this.consecutiveFailures = 0;
      this.lastSuccessTime = now;
      this.blockDetected = false;
      
      // Only log OAuth success occasionally to reduce noise
      if (Math.random() < 0.1) { // 10% sampling
        log.info(log.fmt`✅ OSM OAuth success (sampled logging)`, {
          section: 'osm-health-success',
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      this.consecutiveFailures++;
      
      // Detect HTML "Blocked" responses
      const isBlockedResponse = errorDetails && 
        errorDetails.error === 'html_response_received' &&
        errorDetails.html_preview && 
        errorDetails.html_preview.includes('Blocked');
      
      if (isBlockedResponse && !this.blockDetected) {
        this.blockDetected = true;
        log.error(log.fmt`🚨 OSM BLOCKING DETECTED: Server IP appears to be blocked by OSM`, {
          consecutiveFailures: this.consecutiveFailures,
          blockDetectionTime: new Date().toISOString(),
          htmlPreview: errorDetails.html_preview.substring(0, 200),
          section: 'osm-health-blocked',
          alertLevel: 'critical',
          actionRequired: 'Contact OSM support or check server IP status',
        });
      }
      
      // Log escalating failure patterns
      if (this.consecutiveFailures === 3) {
        log.warn(log.fmt`⚠️ OSM OAuth degraded: 3 consecutive failures`, {
          consecutiveFailures: this.consecutiveFailures,
          timeSinceLastSuccess: now - this.lastSuccessTime,
          section: 'osm-health-degraded',
          timestamp: new Date().toISOString(),
        });
      } else if (this.consecutiveFailures === 10) {
        log.error(log.fmt`🚨 OSM OAuth failing: 10+ consecutive failures`, {
          consecutiveFailures: this.consecutiveFailures,
          timeSinceLastSuccess: now - this.lastSuccessTime,
          section: 'osm-health-failing',
          alertLevel: 'high',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Log API call results to detect patterns
   */
  logApiCall(endpoint, success, responseData) {
    // Only log API failures and occasional successes to reduce noise
    if (!success) {
      log.warn(log.fmt`❌ OSM API call failed: ${endpoint}`, {
        endpoint,
        error: responseData.error || 'Unknown error',
        section: 'osm-api-failure',
        timestamp: new Date().toISOString(),
      });
    } else if (Math.random() < 0.05) { // 5% sampling for successful API calls
      log.debug(log.fmt`✅ OSM API call success: ${endpoint} (sampled)`, {
        endpoint,
        section: 'osm-api-success',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    const now = Date.now();
    const timeSinceSuccess = now - this.lastSuccessTime;
    
    return {
      isHealthy: this.consecutiveFailures < 3 && !this.blockDetected,
      consecutiveFailures: this.consecutiveFailures,
      timeSinceLastSuccess: timeSinceSuccess,
      isBlocked: this.blockDetected,
      status: this.blockDetected ? 'blocked' : 
        this.consecutiveFailures >= 10 ? 'failing' :
          this.consecutiveFailures >= 3 ? 'degraded' : 'healthy',
    };
  }
}

// Export singleton instance
const osmHealthLogger = new OSMHealthLogger();

module.exports = {
  osmHealthLogger,
  OSMHealthLogger,
};