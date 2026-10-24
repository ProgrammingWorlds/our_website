# Programming Worlds — 3D scroll company profile

One continuous 3D world for **Programming Worlds** (*Beyond Code. Beyond Limits.*): scrolling flies the camera through seven stations — Home, Services, About, Process, Projects, Future, Contact — then lands on the footer.
Two themes (dark / light), two languages (English LTR / Arabic RTL). The site also prints as a flat company profile (Ctrl+P).

Stack: [Vite](https://vitejs.dev) · vanilla JS · [Three.js](https://threejs.org) r170 · [GSAP](https://gsap.com) · [Lenis](https://lenis.darkroom.engineering) smooth scroll · self-hosted fonts (Sora, IBM Plex Sans Arabic).

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
index.html                  markup, loader, HUD, chapter panels, SEO, no-flash theme/language bootstrap
public/assets/pw-logo.png   original PW logo (unmodified)
src/story.js                chapter list: scroll length, steps inside each chapter, text-panel windows
src/scroll.js               Lenis + mapping of scroll position → story position u (chapter + progress)
src/chapters.js             DOM side of the story: panel fly-through, focus cards, steps, HUD, rail, nav
src/ui.js                   i18n rendering, theme toggle, language menu, mobile menu, cursor, loader
src/main.js                 boot: WebGL detection, world + stations, single animation loop
src/i18n.js                 all English + Arabic copy
src/config.js               contact / social / projects
src/styles.css              tokens (dark/light), layout, RTL, responsive, print
src/three/world.js          renderer, camera spline, post FX (bloom, warp lens), labels, adaptive quality
src/three/sky.js            sky dome with per-chapter palette, star field, speed streaks
src/three/lib.js            shared shaders, 3D logo, planets, rocks, astronaut, theme binding
src/three/stations/*.js     hero, services, about, process, portfolio, future, contact
scripts/screenshots.mjs     captures the story at fixed positions in all four states
```

### How the 3D scroll works

- The page has one tall scroll track. Each chapter has its own length in [src/story.js](src/story.js); the scroll position becomes the story position `u`: chapter index plus progress through that chapter.
- All stations sit in one Three.js scene along −Z. Each station adds camera keyframes; the world joins them into one Catmull-Rom path, so the camera flies from station to station with no cuts.
- Text panels are fixed over the canvas. Each one flies in from depth and out past the camera as its chapter starts and ends. Chapters with steps (services, about pillars, process stages, projects, future areas) switch the focus card and the 3D focus together as you scroll.
- Scroll speed drives the speed streaks, chromatic fringing, zoom blur and a small FOV change. The sky colour shifts with each chapter.
- Every themed value has a dark and a light value, blended from one 0→1 mix. RTL mirrors the compositions along with the layout.
- Labels on 3D objects (service planets, future planets) are DOM elements that follow their 3D anchors. Clicking one flies to that step.

### Interactions

Loader → the logo assembles · scrolling breaks it apart and flies through it · services: the solar system turns to bring each service forward (labels, step buttons and **Explore Services** jump to the next one) · about: fragments condense into the PW mark and the four pillars light up · process: you walk the hex tunnel through six stage gates (**How We Work** goes to the next stage) · projects: the device ring turns, and thumbnails jump to a screen · future: the camera turns to face each planned area, marked *Coming Soon* · contact: the portal opens · footer. Nav, rail and footer links fly to their chapter; deep links (`/#process`) land there directly.

### Accessibility & performance

- `prefers-reduced-motion` turns off smooth scrolling, the fly-in panels, the warp effects and the intro animation, and slows ambient motion. `?still` forces this mode.
- Keyboard users who tab into a chapter that is off stage are moved to it. The 3D labels are decorative; each panel has its own step buttons.
- Quality steps down (pixel ratio, then bloom) when frames run long. Without WebGL2, the site shows static gradients, the 2D logo and the same scroll story.
- Theme follows the OS on first visit, is stored in `localStorage` (`pw-theme`), and is applied before first paint. Language is stored as `pw-lang`.

## Visual verification

```bash
npm run build
npx vite preview --port 4173 &
npm run shots                 # screenshots/<theme>-<lang>-<shot>.png at 1440×900
npm run shots -- --w=390 --h=844 --out=screenshots/mobile
```

URL parameters for previews: `?theme=light|dark`, `?lang=en|ar`, `?quality=high|low`, `?capture` (skips intro animations).
