// The scroll story: one chapter per section, laid end to end on a single
// scroll track. `len` is the chapter's scroll length in viewport heights.
// Chapters with `steps` dwell on each step inside their `range` (local 0..1).
// Each page picks its story with <html data-story="…">.
const STORIES = {
  home: [
    { id: 'home', scene: 'hero', len: 1.4, win: [-1, -1, 0.34, 0.5] },
    { id: 'about', scene: 'about', len: 2.2, steps: 4, range: [0.3, 0.78] },
    { id: 'services', scene: 'services', len: 2.8, steps: 5, range: [0.16, 0.84] },
    { id: 'process', scene: 'process', len: 3.2, steps: 6, range: [0.18, 0.86] },
    { id: 'projects', scene: 'portfolio', len: 2, steps: 2, range: [0.28, 0.72] },
    { id: 'contact', scene: 'contact', len: 1.6, win: [0.02, 0.2, 9, 9] },
  ],
  // universal.html — the "Our Future" chapter on its own page
  universal: [{ id: 'future', scene: 'future', len: 3.2, steps: 4, range: [0.14, 0.84], win: [-1, -1, 0.9, 0.98] }],
};

const requested = typeof document !== 'undefined' ? document.documentElement.dataset.story : null;
export const STORY = requested in STORIES ? requested : 'home';
export const CHAPTERS = STORIES[STORY];
export { STORIES };

/** Default text-panel window: [fade-in start, in end, fade-out start, out end] in local progress. */
export const WINDOW = [0.04, 0.16, 0.86, 0.97];

export const chapterIndex = (id) => CHAPTERS.findIndex((c) => c.id === id);
export const chapter = (id) => CHAPTERS[chapterIndex(id)];

/** Continuous step position (0..steps-1) for a chapter at local progress. */
export function stepF(ch, local) {
  if (!ch.steps) return 0;
  const [a, b] = ch.range;
  return Math.min(1, Math.max(0, (local - a) / (b - a))) * (ch.steps - 1);
}
/** Local progress at which step k is centred. */
export function stepAt(ch, k) {
  const [a, b] = ch.range;
  return a + (k / (ch.steps - 1)) * (b - a);
}
/** Local progress to land on when jumping to a chapter. */
export function arriveAt(ch) {
  return ch.steps ? ch.range[0] : ch.win?.[0] < 0 ? 0 : 0.3;
}
