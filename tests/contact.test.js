import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, handleContact, createRateLimiter, composeEmail, DEFAULT_TO } from '../server/contact.js';

const good = { name: 'Lina Haddad', email: 'Lina@Example.com', company: 'Acme', service: 'web', scope: 'medium', message: 'We need a new website for our bakery.', website: '', elapsed: 8000 };
const post = (body, extra = {}) => ({ method: 'POST', body, headers: { host: 'site.test', origin: 'https://site.test' }, ip: '1.2.3.4', ...extra });
const ok = (id = 'em_123') => async () => ({ ok: true, status: 200, json: async () => ({ id }) });

test('validate: normalizes a good submission', () => {
  const { data } = validate(good);
  assert.equal(data.email, 'lina@example.com');
  assert.equal(data.service, 'web');
  assert.equal(data.scope, 'medium');
});

test('validate: strips control characters and collapses single-line fields', () => {
  const { data } = validate({ ...good, name: ' Lina\u0000​\n  Haddad ', message: 'Line one\r\nLine two  here' });
  assert.equal(data.name, 'Lina Haddad');
  assert.equal(data.message, 'Line one\nLine two here');
});

test('validate: rejects missing and malformed fields', () => {
  const { errors } = validate({ ...good, name: '', email: 'not-an-email', service: 'hacking', message: 'short' });
  assert.deepEqual(Object.keys(errors).sort(), ['email', 'message', 'name', 'service']);
});

test('validate: unknown scope falls back, overlong message is rejected', () => {
  assert.equal(validate({ ...good, scope: 'huge' }).data.scope, 'unsure');
  assert.equal(validate({ ...good, message: 'x'.repeat(3001) }).errors.message, 'long');
});

test('validate: honeypot and instant submissions are spam', () => {
  assert.equal(validate({ ...good, website: 'http://spam' }).spam, true);
  assert.equal(validate({ ...good, elapsed: 300 }).spam, true);
  assert.equal(validate({ ...good, elapsed: undefined }).spam, true);
});

test('composeEmail: escapes HTML from the visitor', () => {
  const { html, text, subject } = composeEmail(validate({ ...good, name: '<img src=x onerror=alert(1)>', message: 'Hi <script>alert(1)</script> team' }).data);
  assert.ok(!html.includes('<script>') && !html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(text.includes('<script>')); // plain text is not HTML
  assert.ok(subject.startsWith('New inquiry — Web & Systems'));
});

test('rate limiter: allows max hits per window, per key', () => {
  const limit = createRateLimiter({ windowMs: 1000, max: 2 });
  assert.equal(limit('a', 0), true);
  assert.equal(limit('a', 10), true);
  assert.equal(limit('a', 20), false);
  assert.equal(limit('b', 20), true);
  assert.equal(limit('a', 1500), true); // window passed
});

test('handleContact: only POST', async () => {
  assert.equal((await handleContact({ method: 'GET' })).status, 405);
});

test('handleContact: rejects cross-site posts', async () => {
  const r = await handleContact(post(good, { headers: { host: 'site.test', origin: 'https://evil.test' }, env: { RESEND_API_KEY: 'k' }, fetchImpl: ok() }));
  assert.equal(r.status, 403);
});

test('handleContact: never claims success without an API key', async () => {
  const r = await handleContact(post(good, { env: {} }));
  assert.equal(r.status, 503);
  assert.equal(r.body.ok, false);
});

test('handleContact: sends to programmingworld2030@gmail.com with reply-to', async () => {
  let sent;
  const fetchImpl = async (url, opts) => {
    sent = { url, opts, body: JSON.parse(opts.body) };
    return { ok: true, status: 200, json: async () => ({ id: 'em_1' }) };
  };
  const r = await handleContact(post(JSON.stringify(good), { env: { RESEND_API_KEY: 'secret' }, fetchImpl }));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, id: 'em_1' });
  assert.equal(sent.url, 'https://api.resend.com/emails');
  assert.equal(sent.opts.headers.Authorization, 'Bearer secret');
  assert.deepEqual(sent.body.to, [DEFAULT_TO]);
  assert.equal(DEFAULT_TO, 'programmingworld2030@gmail.com');
  assert.equal(sent.body.reply_to, 'lina@example.com');
});

test('handleContact: provider errors are reported as failures', async () => {
  const rejected = async () => ({ ok: false, status: 422, json: async () => ({ message: 'invalid from' }) });
  const noId = async () => ({ ok: true, status: 200, json: async () => ({}) });
  const down = async () => {
    throw new Error('ECONNRESET');
  };
  for (const fetchImpl of [rejected, noId, down]) {
    const r = await handleContact(post(good, { env: { RESEND_API_KEY: 'k' }, fetchImpl }));
    assert.equal(r.status, 502);
    assert.equal(r.body.ok, false);
  }
});

test('handleContact: invalid input, spam, bad JSON and rate limits', async () => {
  const env = { RESEND_API_KEY: 'k' };
  assert.equal((await handleContact(post({ ...good, email: 'x' }, { env, fetchImpl: ok() }))).status, 400);
  assert.equal((await handleContact(post({ ...good, website: 'x' }, { env, fetchImpl: ok() }))).body.error, 'rejected');
  assert.equal((await handleContact(post('{oops', { env, fetchImpl: ok() }))).status, 400);
  const limiter = createRateLimiter({ max: 1 });
  assert.equal((await handleContact(post(good, { env, fetchImpl: ok(), limiter }))).status, 200);
  assert.equal((await handleContact(post(good, { env, fetchImpl: ok(), limiter }))).status, 429);
});
