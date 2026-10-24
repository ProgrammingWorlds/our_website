// The scroll story: one chapter per section, laid end to end on a single
// scroll track. `len` is the chapter's scroll length in viewport heights.
// Chapters with `steps` dwell on each step inside their `range` (local 0..1).
export const CHAPTERS = [
  { id: 'home', scene: 'hero', nav: 'home', len: 1.8, win: [-1, -1, 0.34, 0.5] },
  { id: 'services', scene: 'services', nav: 'services', len: 3.4, steps: 5, range: [0.16, 0.84] },
  { id: 'about', scene: 'about', nav: 'about', len: 2.6, steps: 4, range: [0.3, 0.78] },
  { id: 'process', scene: 'process', nav: 'process', len: 3.8, steps: 6, range: [0.14, 0.86] },
  { id: 'projects', scene: 'portfolio', nav: 'projects', len: 3.4, steps: 6, range: [0.16, 0.84] },
  { id: 'future', scene: 'future', nav: 'future', len: 3, steps: 4, range: [0.18, 0.82] },
  { id: 'contact', scene: 'contact', nav: 'contact', len: 1.8, win: [0.02, 0.2, 9, 9] },
];

/** Default text-panel window: [fade-in start, in end, fade-out start, out end] in local progress. */
export const WINDOW = [0.04, 0.16, 0.86, 0.97];

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
  return ch.steps ? ch.range[0] : ch.id === 'home' ? 0 : 0.3;
}
