# Programming Worlds — 3D scroll company profile

One continuous 3D world for **Programming Worlds** (*Digital worlds, crafted with precision.*): scrolling flies the camera through six stations — Home, About Us, Services, Our Process, Projects, Contact — then lands on the footer. **Our Future** lives on its own page, [`/universal.html`](universal.html).
Two themes (dark / light), two languages (English LTR / Arabic RTL). The site also prints as a flat company profile (Ctrl+P).

Stack: [Vite](https://vitejs.dev) · vanilla JS · [Three.js](https://threejs.org) r170 · [GSAP](https://gsap.com) · [Lenis](https://lenis.darkroom.engineering) smooth scroll · self-hosted fonts (Sora, IBM Plex Sans Arabic) · one Vercel serverless function for the contact form.

## Run & build

```bash
npm install
npm run dev        # http://localhost:5173 (also serves /api/contact)
npm run build      # static output in dist/ (index.html + universal.html)
npm run preview    # serve dist/ on http://localhost:4173 (also serves /api/contact)
npm test           # unit tests: contact handler, content, i18n, SEO files
npm run test:e2e   # browser tests against a running preview (see below)
```

## Deploy (Vercel)

The project is set up for Vercel (`vercel.json`): build `npm run build`, output `dist`, and `api/contact.js` becomes the serverless function `POST /api/contact`.

1. Import the GitHub repository in Vercel (framework preset: Vite — picked up from `vercel.json`).
2. **Contact form email** — create a free account at [resend.com](https://resend.com), then in Vercel → *Project → Settings → Environment Variables* add:

   | Variable | Required | Value |
   | --- | --- | --- |
   | `RESEND_API_KEY` | yes | API key from Resend |
   | `CONTACT_FROM` | strongly recommended | sender on a domain you verified in Resend, e.g. `Programming Worlds <hello@your-domain.com>` |
   | `CONTACT_TO` | no | defaults to `programmingworld2030@gmail.com` |

   Without `CONTACT_FROM`, Resend's test sender `onboarding@resend.dev` is used, and Resend only delivers it **to the email address that owns the Resend account** — so either register Resend with programmingworld2030@gmail.com or verify a domain.
   Until `RESEND_API_KEY` is set the endpoint answers `503 not_configured` and the form tells the visitor to email programmingworld2030@gmail.com directly — it never shows a false "sent".
3. Redeploy after adding the variables. Test by sending the form once on the live site.

To try email locally, copy `.env.example` to `.env.local`, fill it in, and run `npm run dev`.

### How `/universal.html` is served

`universal.html` is a second Vite entry (`build.rollupOptions.input` in [vite.config.js](vite.config.js)), so `npm run build` emits `dist/universal.html` next to `dist/index.html`. It is a real static file — no rewrite rule is involved — and `cleanUrls` is off in `vercel.json`, so the exact URL `/universal.html` resolves on Vercel and on any static host. Both pages load the same `src/main.js`; `<html data-story="…">` picks the story, and each page downloads only its own 3D scenes.

### Contact endpoint security

[server/contact.js](server/contact.js) (shared by the Vercel function and the dev server) validates and sanitizes every field, rejects cross-site posts (Origin must match the host), blocks the hidden honeypot field and instant submissions, limits each IP to 5 messages per 10 minutes, escapes the HTML email, and only returns success when Resend confirms the message. The rate limit lives in the function instance's memory (best effort); for a strict global limit add a store such as Vercel KV / Upstash.

## Content

Edit [src/config.js](src/config.js) and [src/i18n.js](src/i18n.js):

- `SITE.url` — the canonical domain (also hard-coded in the `<head>` of both HTML pages, `public/sitemap.xml` and `public/robots.txt`; change all of them if the domain changes).
- `SITE.socials` — footer links (empty entries render as non-clickable “coming soon” icons).
- `PROJECTS` — real projects only. After adding one, run `npm run capture:projects` to capture its laptop / tablet / phone screenshots (WebP) from the live site, and check that the site may be framed before setting `embeddable: true`.

Icons: `public/favicon.svg` is the source; `npm run icons` renders the PNG icon set.

## Structure

```
index.html                  homepage: header, chapter panels, contact form, SEO + JSON-LD
universal.html              "Our Future" page (the original chapter, moved here intact)
api/contact.js              Vercel function → server/contact.js
server/contact.js           validation, spam + rate limiting, email via Resend
src/story.js                stories per page: chapter order, scroll length, steps, text-panel windows
src/scroll.js               Lenis + mapping of scroll position → story position u
src/chapters.js             DOM side of the story: panels, steps, selection, overflow, focus, HUD, rail, nav
src/showcase.js             projects: device frames, screenshots, live preview iframes
src/contact-form.js         form validation, states and submission
src/ui.js                   i18n rendering, theme toggle, language toggle, mobile menu, cursor, loader
src/main.js                 boot: WebGL detection, scene registry, single animation loop
src/i18n.js                 all English + Arabic copy
src/config.js               site settings and projects
src/styles.css              tokens (dark/light), layout, RTL, responsive, reduced motion, print
src/three/world.js          renderer, camera spline, post FX, labels, adaptive quality
src/three/sky.js            sky dome with per-scene palette, star field, speed streaks
src/three/lib.js            shaders, 3D logo, planets, rocks, Nova the mascot, astronaut, theme binding
src/three/stations/*.js     hero, about, services, process, portfolio, future, contact
public/projects/            captured project screenshots (WebP)
scripts/                    screenshots, end-to-end tests, project capture, icon rendering
tests/                      node:test unit tests
```

### How the 3D scroll works

- The page has one tall scroll track. Each chapter has its own length in [src/story.js](src/story.js); the scroll position becomes the story position `u`: chapter index plus progress through that chapter.
- All stations sit in one Three.js scene along −Z. Each station adds camera keyframes; the world joins them into one Catmull-Rom path, so the camera flies from station to station with no cuts.
- Text panels are fixed over the canvas. Each one flies in from depth and out past the camera as its chapter starts and ends. A panel taller than the space under the header travels up through its content as you scroll (and to any control that receives keyboard focus) instead of being clipped.
- Chapters with steps (about pillars, services, process stages, projects) switch the focus card and the 3D focus together as you scroll. Clicking a step flies there and holds the selection during the flight, so it never flickers through the steps in between; any wheel or touch scroll hands control straight back to the visitor.
- While a form field is focused, the scene holds still, so a phone's on-screen keyboard can't scroll the story elsewhere.

### Accessibility & performance

- `prefers-reduced-motion` turns off smooth scrolling, the fly-in panels, the warp effects and the intro animation, and slows ambient motion. `?still` forces this mode.
- Step lists are ARIA tab lists (arrow keys, Home/End), the device switch is a radio group, every control has a visible focus ring, and the selected state never relies on colour alone.
- Rendering starts at 1.5× on high-density screens and steps down (pixel ratio, then bloom) when the median frame runs long; full-screen shaders use 3-octave noise; panels animate with transform/opacity only; label avoidance uses cached layout (no per-frame reflow). Without WebGL2, the site shows static gradients and the same scroll story.
- The full welcome animation plays once per session. Theme follows the OS on first visit, is stored in `localStorage` (`pw-theme`) and applied before first paint; language is stored as `pw-lang`.

## Visual verification

```bash
npm run build
npx vite preview --port 4173 &
npm run shots                                   # screenshots/<theme>-<lang>-<shot>.png at 1440×900
npm run shots -- --w=390 --h=844 --out=screenshots/mobile
npm run shots -- --page=universal.html --out=screenshots/universal
npm run test:e2e                                # interaction, responsive and console checks
```

URL parameters for previews: `?theme=light|dark`, `?lang=en|ar`, `?quality=high|low`, `?capture` (skips intro animations), `?test` (exposes hooks for the e2e script).
