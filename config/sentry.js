// Note: express, cors, cookieParser imports removed as they're not needed in this config file

// Load environment variables
require('dotenv').config();

// Initialize Sentry BEFORE other imports
let Sentry;
try {
  Sentry = require('@sentry/node');
  const { nodeProfilingIntegration } = require('@sentry/profiling-node');
    
  // Initialize Sentry
  if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      integrations: [
        Sentry.httpIntegration({ tracing: true }),
        Sentry.expressIntegration(),
        nodeProfilingIntegration(),
        // Send console.log, console.error, and console.warn calls as logs to Sentry
        Sentry.consoleIntegration({ levels: ['log', 'error', 'warn'] }),
      ],
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // Enable structured logging
      _experiments: {
        enableLogs: true,
      },
      beforeSend(event, _hint) {
        if (event.tags && event.tags.section === 'osm-api') {
          event.contexts = {
            ...event.contexts,
            osm: {
              rate_limit_info: event.extra?.rateLimitInfo || null,
              endpoint: event.extra?.endpoint || null,
            },
          };
        }
        return event;
      },
    });
    console.log('✅ Sentry initialized for error monitoring and structured logging');
  } else {
    console.log('⚠️  Sentry not initialized (missing SENTRY_DSN or test environment)');
  }
} catch (_e) {
  console.log('⚠️  Sentry not available (package not installed)');
  Sentry = null;
}

module.exports = { 
  Sentry, 
  logger: Sentry?.logger || null, 
};
