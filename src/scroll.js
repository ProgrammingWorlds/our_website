import Lenis from 'lenis';
import { CHAPTERS, stepAt, arriveAt } from './story.js';

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Maps the page's native scroll onto the story coordinate `u`:
 * chapter i spans u ∈ [i, i+1). Lenis adds light inertia to wheel scrolling;
 * touch and keyboard scrolling stay native.
 */
export function createScroll({ reduced }) {
  const track = document.getElementById('track');
  const lenis = reduced ? null : new Lenis({ lerp: 0.1, wheelMultiplier: 1, touchMultiplier: 1 });
  const state = { u: 0, y: 0, velocity: 0, starts: [], heights: [], total: 0 };

  function layout() {
    const keep = state.total ? state.u : null;
    const vh = innerHeight;
    let y = 0;
    CHAPTERS.forEach((ch, i) => {
      state.starts[i] = y;
      state.heights[i] = ch.len * vh;
      y += ch.len * vh;
    });
    state.total = y;
    // the track ends where the footer starts to enter: scrollY = total ⇒ u = N
    track.style.height = `${y + vh}px`;
    lenis?.resize();
    // stay at the same point of the story when the viewport changes
    if (keep != null && keep < CHAPTERS.length) toU(keep, { immediate: true });
  }

  function uAt(y) {
    const { starts, heights } = state;
    for (let i = CHAPTERS.length - 1; i >= 0; i--) {
      if (y >= starts[i]) return Math.min(CHAPTERS.length, i + (y - starts[i]) / heights[i]);
    }
    return 0;
  }
  function yAt(u) {
    const i = Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor(u)));
    return state.starts[i] + (u - i) * state.heights[i];
  }

  // Soft settle: when the wheel stops close to a step, ease onto it. It never
  // runs during a programmatic flight or far from an anchor, so it can't fight
  // the visitor.
  const anchors = CHAPTERS.flatMap((ch, i) => (ch.steps ? Array.from({ length: ch.steps }, (_, k) => i + stepAt(ch, k)) : [i + arriveAt(ch)]));
  const snap = { last: 0 };
  const fine = matchMedia('(pointer: fine)').matches;
  lenis?.on('scroll', () => (snap.last = performance.now()));
  function settle() {
    if (!lenis || !fine || lenis.isScrolling || lenis.isStopped || performance.now() - snap.last < 220) return;
    if (state.y >= state.total) return; // footer
    let best = null;
    for (const a of anchors) if (best == null || Math.abs(a - state.u) < Math.abs(best - state.u)) best = a;
    const d = Math.abs(best - state.u);
    if (d < 0.003 || d > 0.05) return;
    snap.last = performance.now() + 1e4; // once per stop
    lenis.scrollTo(yAt(best), { duration: 0.6, easing: (t) => 1 - Math.pow(1 - t, 3) });
  }

  function update(time) {
    lenis?.raf(time);
    settle();
    const y = lenis ? lenis.scroll : scrollY;
    state.velocity = lenis ? lenis.velocity : 0;
    state.u = uAt(y);
    state.y = y;
    return state;
  }

  /**
   * Fly to story position u. Long jumps take a little longer so the camera
   * flight reads. Returns the flight duration in seconds.
   */
  function toU(u, { immediate = false, onDone } = {}) {
    const y = yAt(u);
    if (!lenis || immediate) {
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else scrollTo({ top: y, behavior: 'instant' });
      onDone?.();
      return 0;
    }
    const duration = Math.min(2.4, 0.75 + Math.abs(u - state.u) * 0.32);
    lenis.scrollTo(y, { duration, easing: easeInOut, onComplete: onDone });
    return duration;
  }
  function toY(y) {
    if (lenis) lenis.scrollTo(y, { duration: 1.2 });
    else scrollTo({ top: y });
  }

  layout();
  // mobile browser bars change innerHeight while scrolling; only re-lay out on real resizes
  const coarse = matchMedia('(pointer: coarse)').matches;
  let lastW = innerWidth;
  addEventListener('resize', () => {
    if (coarse && innerWidth === lastW) return;
    lastW = innerWidth;
    layout();
  });
  return { state, update, toU, toY, yAt, layout, lenis };
}
