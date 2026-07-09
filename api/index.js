const app = require('../src/server');
const { setupDatabaseIfNeeded } = require('../src/utils/setupDatabase');

let setupPromise;

function isHealthRequest(req) {
  return req.url === '/api/health' || req.url === '/health' || req.url.includes('/api/health');
}

function ensureSetup() {
  if (!setupPromise) {
    setupPromise = setupDatabaseIfNeeded().catch((error) => {
      setupPromise = null;
      throw error;
    });
  }
  return setupPromise;
}

module.exports = async (req, res) => {
  try {
    // Health should confirm the Vercel function starts even if DB setup has an issue.
    if (isHealthRequest(req)) {
      return app(req, res);
    }

    await ensureSetup();
    return app(req, res);
  } catch (error) {
    console.error('Vercel API startup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server startup failed',
      error: error.message || String(error)
    });
  }
};
