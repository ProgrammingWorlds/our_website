import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { handleContact, createRateLimiter } from './server/contact.js';

const page = (file) => fileURLToPath(new URL(file, import.meta.url));

// Serves /api/contact from the same handler as the Vercel function, so the
// form works under `npm run dev` and `npm run preview` (reads .env.local).
function contactApi(env) {
  const limiter = createRateLimiter();
  const middleware = (req, res) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 64000) req.destroy();
    });
    req.on('end', async () => {
      const result = await handleContact({ method: req.method, body: raw, headers: req.headers, ip: req.socket.remoteAddress, env, limiter });
      res.statusCode = result.status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(result.body));
    });
  };
  return {
    name: 'pw-contact-api',
    configureServer: (server) => void server.middlewares.use('/api/contact', middleware),
    configurePreviewServer: (server) => void server.middlewares.use('/api/contact', middleware),
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [contactApi({ ...loadEnv(mode, process.cwd(), ''), ...process.env })],
  build: {
    // two pages: the homepage story and /universal.html ("Our Future")
    rollupOptions: { input: { main: page('index.html'), universal: page('universal.html') } },
    // three.js alone is ~530 kB; it is loaded on demand after the page is interactive
    chunkSizeWarningLimit: 600,
  },
}));
