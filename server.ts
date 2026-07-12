import express from 'express';
import { createServer } from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const PORT = 3000;
  const BACKEND_URL = 'http://127.0.0.1:5000';

  console.log('Initializing μ-Sentry Gateway...');

  // 1. PROXY CONFIG
  //
  // FIX (important): when you mount a proxy with app.use('/v1', proxy),
  // Express strips '/v1' off req.url BEFORE the proxy ever sees it.
  // So a browser request to /v1/oracle arrives at this middleware as
  // just /oracle, and http-proxy-middleware forwards that stripped
  // path straight to Flask -- which only has a route at /v1/oracle,
  // so it 404s. Same problem applies to /api.
  //
  // Fix: give each mount its own proxy instance with a pathRewrite
  // that adds the prefix back before forwarding to Flask.
  const makeProxy = (prefix: string, opts: Record<string, any> = {}) =>
    createProxyMiddleware({
      target: BACKEND_URL,
      changeOrigin: true,
      proxyTimeout: 10000,
      timeout: 10000,
      pathRewrite: (path) => `${prefix}${path}`,
      on: {
        error: (err, req, res) => {
          console.error('Proxy Error:', err.message);
          const response = res as any;
          if (response && response.status && !response.headersSent) {
            response.status(503).json({ error: 'Quant Core Unavailable', details: err.message });
          }
        }
      },
      ...opts,
    });

  const apiProxy = makeProxy('/api');
  const v1Proxy  = makeProxy('/v1');
  // NOTE: wsProxy's Express mount below is effectively unused for real
  // WebSocket traffic -- the actual handshake is handled by the manual
  // server.on('upgrade', ...) bypass further down, which preserves the
  // original unstripped '/python-ws' path. This mount only exists to
  // log/handle stray plain HTTP requests to that path.
  const wsProxy = createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true,
    ws: true,
    proxyTimeout: 10000,
    timeout: 10000,
    on: {
      error: (err, req, res) => {
        console.error('Proxy Error:', err.message);
        const response = res as any;
        if (response && response.status && !response.headersSent) {
          response.status(503).json({ error: 'Quant Core Unavailable', details: err.message });
        }
      }
    }
  });

  // 2. VITE MIDDLEWARE (Development Mode)
  let vite;
  if (process.env.NODE_ENV !== 'production') {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
  }

  // 3. ROUTES
  // Forward /api, /v1, and /python-ws to the Flask backend, each with
  // its prefix restored by the matching proxy instance above.
  app.use('/api', (req, res, next) => {
    console.log(`[Gateway] Proxying API request: ${req.method} ${req.url}`);
    next();
  }, apiProxy);

  app.use('/v1', (req, res, next) => {
    console.log(`[Gateway] Proxying v1 request: ${req.method} ${req.url}`);
    next();
  }, v1Proxy);

  app.use('/python-ws', (req, res, next) => {
    console.log(`[Gateway] Proxying WS request: ${req.url}`);
    next();
  }, wsProxy);

  // Manual WebSocket upgrade for /python-ws.
  // NOTE: this bypasses Express routing entirely (it operates on the
  // raw http.Server 'upgrade' event), so req.url here is still the
  // original, unstripped '/python-ws' -- this path was already correct
  // and is why your WebSocket connection succeeded in the log even
  // while the /v1 REST calls were 404ing.
  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/python-ws') {
      (wsProxy as any).upgrade(req, socket, head);
    }
  });

  // 3. FRONTEND SERVING
  if (process.env.NODE_ENV !== 'production' && vite) {
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 μ-SENTRY IS LIVE');
    console.log(`👉 ACCESS FRONTEND AT: http://localhost:${PORT}`);
    console.log(`📡 QUANT CORE RUNNING ON: ${BACKEND_URL}`);
    console.log('='.repeat(50) + '\n');
  });
}

startServer().catch(err => {
  console.error('CRITICAL: Gateway failed to start', err);
});