// Vercel serverless function: POST /api/contact → email to programmingworld2030@gmail.com.
// Needs RESEND_API_KEY (and ideally CONTACT_FROM) in the Vercel project's environment variables.
import { handleContact, createRateLimiter } from '../server/contact.js';

const limiter = createRateLimiter();

export default async function handler(req, res) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const result = await handleContact({ method: req.method, body: req.body, headers: req.headers, ip, env: process.env, limiter });
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.status(result.status).json(result.body);
}
