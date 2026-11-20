'use strict';
/* Tiny SVG chart kit for the parent dashboard. One series color (blue), orange only for a second series.
   Every chart has a hover tooltip and a table view. No dual axes. */
const Charts = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let tip;
  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement('div'); tip.className = 'ch-tip'; tip.hidden = true; document.body.appendChild(tip);
    document.addEventListener('pointermove', e => {
      const t = e.target.closest && e.target.closest('[data-tip]');
      if (!t) { tip.hidden = true; return; }
      tip.innerHTML = t.getAttribute('data-tip'); tip.hidden = false;
      const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8), y = Math.max(8, e.clientY - tip.offsetHeight - 10);
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    });
    return tip;
  }
  const nice = v => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
  const fmt = (v, unit) => v === null || v === undefined ? '—' : `${Math.round(v * 10) / 10}${unit || ''}`;

  /* Vertical bars (one series). opts: {unit, goal, goalLabel, height, markers:[{i,label}], color} */
  function bars(items, opts = {}) {
    ensureTip();
    const W = 640, H = opts.height || 210, L = 40, R = 10, T = 24, B = 30;
    const vals = items.map(i => i.value).filter(v => v !== null && v !== undefined);
    const max = opts.max || nice(Math.max(1, ...vals, opts.goal || 0) * 1.1);
    const bw = (W - L - R) / Math.max(1, items.length); const barW = Math.max(3, Math.min(34, bw - 4));
    const y = v => T + (H - T - B) * (1 - v / max);
    const ticks = [0, max / 2, max];
    let s = `<svg viewBox="0 0 ${W} ${H}" class="ch" role="img" aria-label="${esc(opts.label || 'chart')}">`;
    ticks.forEach(t => { s += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${L - 6}" y="${y(t) + 4}" class="ax" text-anchor="end">${fmt(t, '')}</text>`; });
    if (opts.goal) s += `<line x1="${L}" x2="${W - R}" y1="${y(opts.goal)}" y2="${y(opts.goal)}" class="goal"/><text x="${W - R}" y="${y(opts.goal) - 4}" class="ax goal-t" text-anchor="end">${esc(opts.goalLabel || 'target')}</text>`;
    (opts.markers || []).forEach(m => { const x = L + bw * m.i; s += `<line x1="${x}" x2="${x}" y1="${T - 12}" y2="${H - B}" class="marker"/><text x="${x > W * 0.7 ? x - 4 : x + 4}" y="${T - 14}" class="ax mk-t" text-anchor="${x > W * 0.7 ? 'end' : 'start'}">${esc(m.label)}</text>`; });
    const every = Math.ceil(items.length / 12);
    items.forEach((it, i) => {
      const cx = L + bw * i + bw / 2;
      const v = it.value;
      const tipTxt = `<b>${esc(it.full || it.label)}</b><br>${v === null || v === undefined ? 'no data' : fmt(v, opts.unit ? ' ' + opts.unit : '')}${it.note ? '<br>' + esc(it.note) : ''}`;
      if (v === null || v === undefined) s += `<text x="${cx}" y="${H - B - 4}" class="ax nodata" text-anchor="middle">·</text>`;
      else { const h = Math.max(1, (H - T - B) - (y(v) - T)); const top = y(v); s += `<path d="M${cx - barW / 2},${H - B} V${top + 4} q0,-4 4,-4 h${barW - 8} q4,0 4,4 V${H - B} Z" class="bar ${it.cls || ''}"/>`; }
      s += `<rect x="${L + bw * i}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent" data-tip="${esc(tipTxt)}"/>`;
      if (i % every === 0) s += `<text x="${cx}" y="${H - B + 16}" class="ax" text-anchor="middle">${esc(it.label)}</text>`;
    });
    s += `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="base"/></svg>`;
    return s;
  }

  /* Line with optional second series (orange), target band, phase markers. */
  function line(items, opts = {}) {
    ensureTip();
    const W = 640, H = opts.height || 220, L = 40, R = 14, T = 26, B = 30;
    const all = items.flatMap(i => [i.value, i.value2]).filter(v => v !== null && v !== undefined);
    const lo = opts.min ?? 0; const max = opts.max || nice(Math.max(1, ...all, opts.band ? opts.band[1] : 0) * 1.1);
    const step = (W - L - R) / Math.max(1, items.length - 1);
    const x = i => L + step * i, y = v => T + (H - T - B) * (1 - (v - lo) / (max - lo));
    let s = `<svg viewBox="0 0 ${W} ${H}" class="ch" role="img" aria-label="${esc(opts.label || 'chart')}">`;
    [lo, (lo + max) / 2, max].forEach(t => { s += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${L - 6}" y="${y(t) + 4}" class="ax" text-anchor="end">${fmt(t, '')}</text>`; });
    if (opts.band) s += `<rect x="${L}" width="${W - L - R}" y="${y(opts.band[1])}" height="${y(opts.band[0]) - y(opts.band[1])}" class="band"/><text x="${L + 6}" y="${y(opts.band[0]) - 5}" class="ax goal-t">${esc(opts.bandLabel || 'target')}</text>`;
    (opts.markers || []).forEach(m => { const xx = x(m.i); s += `<line x1="${xx}" x2="${xx}" y1="${T - 12}" y2="${H - B}" class="marker"/><text x="${xx > W * 0.7 ? xx - 4 : xx + 4}" y="${T - 16}" class="ax mk-t" text-anchor="${xx > W * 0.7 ? 'end' : 'start'}">${esc(m.label)}</text>`; });
    const path = key => { let d = '', pen = false; items.forEach((it, i) => { const v = it[key]; if (v === null || v === undefined) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; }); return d; };
    if (items.some(i => i.value2 !== undefined)) s += `<path d="${path('value2')}" class="ln ln2"/>`;
    s += `<path d="${path('value')}" class="ln"/>`;
    items.forEach((it, i) => {
      if (it.value !== null && it.value !== undefined) s += `<circle cx="${x(i)}" cy="${y(it.value)}" r="4" class="dot"/>`;
      if (it.value2 !== null && it.value2 !== undefined) s += `<circle cx="${x(i)}" cy="${y(it.value2)}" r="4" class="dot dot2"/>`;
      const t = `<b>${esc(it.full || it.label)}</b><br>${esc(opts.name1 || '')}${opts.name1 ? ': ' : ''}${fmt(it.value, opts.unit ? ' ' + opts.unit : '')}${it.value2 !== undefined ? `<br>${esc(opts.name2 || '')}: ${fmt(it.value2, opts.unit ? ' ' + opts.unit : '')}` : ''}`;
      s += `<rect x="${x(i) - step / 2}" y="${T}" width="${step}" height="${H - T - B}" fill="transparent" data-tip="${esc(t)}"/>`;
      if (i % Math.ceil(items.length / 10) === 0) s += `<text x="${x(i)}" y="${H - B + 16}" class="ax" text-anchor="middle">${esc(it.label)}</text>`;
    });
    s += `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="base"/></svg>`;
    if (opts.name2) s += `<div class="legend"><span><i class="lg1"></i>${esc(opts.name1)}</span><span><i class="lg2"></i>${esc(opts.name2)}</span></div>`;
    return s;
  }

  /* Horizontal bars as HTML rows (labels never collide). */
  function hbars(items, opts = {}) {
    ensureTip();
    const max = opts.max || Math.max(1, ...items.map(i => i.value || 0));
    return `<div class="hb">${items.map(it => `<div class="hb-row" data-tip="${esc(`<b>${esc(it.label)}</b><br>${fmt(it.value, opts.unit ? ' ' + opts.unit : '')}${it.note ? '<br>' + esc(it.note) : ''}`)}">
      <span class="hb-l">${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>
      <span class="hb-track"><i style="width:${Math.max(0, Math.min(100, (it.value || 0) / max * 100)).toFixed(1)}%" class="${it.cls || ''}"></i></span>
      <span class="hb-v">${fmt(it.value, opts.unit || '')}</span></div>`).join('')}</div>`;
  }

  function table(cols, rows) {
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => v && typeof v === 'object' && 'html' in v ? `<td>${v.html}</td>` : `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  /* Card wrapper with a Chart/Table toggle. */
  function card(id, title, sub, chartHTML, tableHTML) {
    return `<section class="card ch-card" id="${id}"><div class="ch-head"><div><h3>${esc(title)}</h3>${sub ? `<p class="muted">${sub}</p>` : ''}</div>
      ${tableHTML ? `<button class="tbtn" data-toggle="${id}">Table</button>` : ''}</div>
      <div class="ch-body">${chartHTML}</div>${tableHTML ? `<div class="ch-table" hidden>${tableHTML}</div>` : ''}</section>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-toggle]'); if (!b) return;
    const c = document.getElementById(b.dataset.toggle); const t = c.querySelector('.ch-table'), g = c.querySelector('.ch-body');
    const showTable = t.hidden; t.hidden = !showTable; g.hidden = showTable; b.textContent = showTable ? 'Chart' : 'Table';
  });
  return { bars, line, hbars, table, card, esc };
})();
