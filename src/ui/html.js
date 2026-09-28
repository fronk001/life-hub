// Small helpers shared by both views.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const tick = (size, width) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
export const CHECK = tick(18, 3);
export const CHECK_SM = tick(14, 3.2);
export const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>';

export const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

export const launcher = (s, id) => (s.launchers || []).find((l) => l.id === id) || null;

// Launchers marked "laptop" (a Claude Code session, a local server) mean
// nothing on a phone, so the phone never shows them.
export const launcherVisible = (l, phone) => !!l && !(phone && l.where === 'laptop');

// Only schemes we know; anything else (javascript:, data:) renders inert.
const SAFE = /^(https?:|claude:|ms-excel:|numbers:)/i;

export function launchLink(l, cls, label, { phone = false, ritualId = '' } = {}) {
  const url = phone && l.phoneUrl ? l.phoneUrl : l.url;
  if (!SAFE.test(url || '')) return `<span class="${cls} disabled">${esc(label)}</span>`;
  const web = /^https?:/i.test(url);
  return `<a class="${cls}" href="${esc(url)}"${web ? ' target="_blank" rel="noopener"' : ''} data-act="launch"${
    ritualId ? ` data-ritual="${esc(ritualId)}"` : ''}>${esc(label)} ${ARROW}</a>`;
}
