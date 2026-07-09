require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const settingsRoutes = require('./routes/settings.routes');
const customersRoutes = require('./routes/customers.routes');
const productsRoutes = require('./routes/products.routes');
const invoicesRoutes = require('./routes/invoices.routes');
const reportsRoutes = require('./routes/reports.routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { setupDatabaseIfNeeded } = require('./utils/setupDatabase');

const app = express();
const PORT = process.env.PORT || 5000;
const publicDir = path.join(__dirname, '..', 'public');

// Important: CSP is disabled because the current frontend uses a few inline onclick handlers.
// Other Helmet protections remain enabled.
app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow same-origin/server-to-server requests and local tools.
    if (!origin) return callback(null, true);
    if (!allowedOrigins.length || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API healthy', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/reports', reportsRoutes);

// Single-link deployment: frontend is served by the same Node app.
app.use(express.static(publicDir));
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Only API paths should return JSON 404. Other paths fall back to index.html.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return notFound(req, res, next);
  return res.sendFile(path.join(publicDir, 'index.html'));
});

app.use(errorHandler);

async function startServer() {
  try {
    await setupDatabaseIfNeeded();
    app.listen(PORT, () => {
      console.log(`GST BillPro running on port ${PORT}`);
      console.log(`Open: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start GST BillPro:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
