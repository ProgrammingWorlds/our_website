// 24×24 stroke icons. Used as inline SVG in the DOM and as Path2D on canvases.
export const ICONS = {
  web: 'M3 5h18v11H3z M8 20h8 M12 16v4',
  code: 'M8 8l-4 4 4 4 M16 8l4 4-4 4 M13.5 6l-3 12',
  mobile: 'M7 2.5h10v19H7z M10.5 18.5h3',
  nfc: 'M12 12m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0 M8.2 8.2a5.4 5.4 0 0 0 0 7.6 M15.8 8.2a5.4 5.4 0 0 1 0 7.6 M5.4 5.4a9.3 9.3 0 0 0 0 13.2 M18.6 5.4a9.3 9.3 0 0 1 0 13.2',
  training: 'M2 9l10-5 10 5-10 5z M6 11v5c3 2.5 9 2.5 12 0v-5 M21 9v6',
  bulb: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  strategy: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0 M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M12 12l7-7 M16 5h3v3',
  design: 'M4 20l4-1 11-11-3-3L5 16z M14 7l3 3 M4 20l1-4',
  dev: 'M4 4h16v16H4z M8 10l-2 2 2 2 M16 10l2 2-2 2 M13 9l-2 6',
  test: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z M8.5 12l2.5 2.5 4.5-5',
  rocket: 'M12 2c3 2 5 6 5 10l-2 4H9l-2-4c0-4 2-8 5-10z M12 9.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0 M9 16l-3 3 M15 16l3 3 M12 18v4',
  creative: 'M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1 M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
  practical: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 7v5l3 3',
  modern: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v3 M12 19v3 M4.2 7l2.6 1.5 M17.2 15.5l2.6 1.5 M4.2 17l2.6-1.5 M17.2 8.5L19.8 7',
  partner: 'M12 21s-7-4.4-9-9.2C1.6 8.2 4 4.5 7.6 4.5c2 0 3.4 1 4.4 2.5 1-1.5 2.4-2.5 4.4-2.5 3.6 0 6 3.7 4.6 7.3-2 4.8-9 9.2-9 9.2z',
  arrow: 'M4 12h15 M14 6.5l5.5 5.5-5.5 5.5',
  sun: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  chevron: 'M6 9l6 6 6-6',
  globe: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M3 12h18 M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z',
  ai: 'M9 3v3 M15 3v3 M9 18v3 M15 18v3 M3 9h3 M3 15h3 M18 9h3 M18 15h3 M6 6h12v12H6z M10 10h4v4h-4z',
  cloud: 'M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z',
  instagram: 'M4 4h16v16H4z M12 12m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0 M17 7h.01',
  x: 'M4 4l16 16 M20 4L4 20',
  youtube: 'M3 7.5c0-1.4 1-2.5 2.4-2.6C7.5 4.7 9.7 4.6 12 4.6s4.5.1 6.6.3C20 5 21 6.1 21 7.5v9c0 1.4-1 2.5-2.4 2.6-2.1.2-4.3.3-6.6.3s-4.5-.1-6.6-.3C4 19 3 17.9 3 16.5z M10 9v6l5-3z',
  linkedin: 'M4 9h3.5v11H4z M5.75 4.2m-1.8 0a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0 M10.5 9h3.3v1.6c.6-1 1.8-1.9 3.6-1.9 3 0 3.6 2 3.6 4.6V20h-3.5v-5.8c0-1.4-.3-2.6-1.8-2.6s-1.9 1.2-1.9 2.5V20h-3.3z',
  menu: 'M4 7h16 M4 12h16 M4 17h16',
  close: 'M6 6l12 12 M18 6L6 18',
};

export function svg(name, cls = 'icon') {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[name]}"/></svg>`;
}

export function drawIcon(ctx, name, x, y, size, color, width = 1.6) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(ICONS[name]));
  ctx.restore();
}
