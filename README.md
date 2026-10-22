# Programming Worlds — cinematic website

One-page, scroll-driven 3D site for **Programming Worlds** (*Beyond Code. Beyond Limits.*).
Two themes (dark / light), two languages (English LTR / Arabic RTL), seven cinematic scenes + footer.

Stack: [Vite](https://vitejs.dev) · vanilla JS · [Three.js](https://threejs.org) r170 · [GSAP](https://gsap.com) + ScrollTrigger · self-hosted fonts (Sora, IBM Plex Sans Arabic).

## Run & build

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static output in dist/
npm run preview    # serve dist/ on http://localhost:4173
```

## Deploy

`dist/` is a fully static site — upload it to any static host:

- **Netlify / Cloudflare Pages / Vercel**: build command `npm run build`, output directory `dist`.
- **Any web server / S3**: copy the contents of `dist/` to the web root.
  Serve `index.html` with `Cache-Control: no-cache`; files in `dist/assets/` are content-hashed and can be cached for a year.

## Before going live

Edit [src/config.js](src/config.js):

- `email` — turns **Contact Us Now** into a `mailto:` link.
- `socials` — footer links (empty entries render as non-clickable “coming soon” icons).
- `PROJECTS` — add **verified** projects only. Until then the portfolio scene shows capability showcases and says so on the page.

## Structure

```
index.html              markup + SEO + no-flash theme/language bootstrap
public/assets/pw-logo.png   original PW logo (unmodified)
src/main.js             boot: WebGL detection, engine, scenes, UI
src/ui.js               i18n rendering, theme toggle, language menu, nav, text reveals
src/i18n.js             all English + Arabic copy
src/config.js           contact / social / projects
src/styles.css          tokens (dark/light), layout, RTL, responsive
src/three/engine.js     renderer, per-section scissor rendering, bloom, adaptive quality
src/three/lib.js        shared shaders, 3D logo, planets, rocks, astronaut, theme binding
src/three/scenes/*.js   hero, services, about, process, portfolio, future, contact
scripts/screenshots.mjs captures every scene in all four states
scripts/compare.py      side-by-side sheets vs. reference/reference.png
```

### How the 3D works

- A single fixed WebGL canvas. Each section owns a Three.js scene; the engine anchors it to the section's DOM position and renders it clipped (scissor) to that section, so native scrolling, accessibility and layout stay in the DOM.
- A shared additive 3D galaxy gate appears during each section's scroll-in and scroll-out window. Its orbital rings and star streaks grow with scroll progress, joining each scene into one journey; it is omitted when reduced motion is requested.
- Every themed value (colours, light levels, glow blending, bloom) is registered with a dark and a light value and interpolated from one 0→1 mix — both themes share identical geometry, layout and motion.
- Labels and controls over 3D objects (service planets, future planets) are real DOM buttons projected onto the 3D positions: keyboard-, touch- and screen-reader-accessible.
- RTL mirrors the 3D compositions horizontally along with the layout.

### Interactions

Hero logo assembles on load and breaks apart as you scroll · a shared galaxy gate bridges every scene entrance and exit · pointer parallax everywhere · services: hover/focus/tap a planet for details, drag to orbit, “Explore Services” cycles them · about: fragments explode and reassemble with scroll · process: camera travels the tunnel past six stages (“How We Work” jumps to the next) · portfolio: arrows, thumbnails, ←/→ keys or swipe rotate the device ring · future: four planned areas marked *Coming Soon* · contact: portal opens as it arrives.

### Accessibility & performance

- `prefers-reduced-motion` disables intro/scroll animation and slows ambient motion; `?still` forces it.
- Quality tiers (pixel ratio, bloom) step down automatically when frames run long. Without WebGL the site falls back to static gradients + the 2D logo.
- Theme follows the OS on first visit, is stored in `localStorage` (`pw-theme`), and is applied before first paint. Language is stored as `pw-lang`.

## Visual verification

```bash
npm run build
npx vite preview --port 4173 &
npm run shots                 # screenshots/<theme>-<lang>-<scene>.png at 1440×1200
python scripts/compare.py en  # screenshots/compare/<scene>-en.png
python scripts/compare.py ar
```

URL parameters for previews: `?theme=light|dark`, `?lang=en|ar`, `?quality=high|low`, `?capture` (skips intro animations).
