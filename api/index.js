const app = require('../src/server');
const { setupDatabaseIfNeeded } = require('../src/utils/setupDatabase');

let setupPromise;

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
    await ensureSetup();
    return app(req, res);
  } catch (error) {
    console.error('Vercel API startup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server startup failed',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};
