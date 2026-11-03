

const dash = {
  colors: ['#0b4fd4', '#12aef4', '#0a1a4d', '#6b7688', '#1a7f4b', '#b45309', '#7a4fd4', '#c0392b'],
  _d: {}, _c: {}, _dr: {}, _ids: [], _asof: null,
  calc(id, o) { this._c[id] = o; },
  draw(name, fn) { this._dr[name] = fn; },
  data(id) {
    const c = this._c[id];
    if (c) {
      const ins = c.inputs.map((i) => this.data(i));
      return ins.every((x) => x.status === 'ok') ? { status: 'ok', data: c.fn(...ins.map((x) => x.data)) } : { status: 'loading', data: [] };
    }
    return this._d[id] ? { status: 'ok', data: this._d[id] } : { status: 'loading', data: [] };
  },
  async load() {
    await Promise.all(this._ids.map(async (id) => {
      const r = await fetch('data/' + id + '.csv?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error(id + ' ' + r.status);
      const lm = r.headers.get('last-modified');
      if (lm && (!this._asof || new Date(lm) > this._asof)) this._asof = new Date(lm);
      this._d[id] = d3.csvParse(await r.text());
    }));
  },
  paint() {
    document.querySelectorAll('[data-draw]').forEach((el) => { const f = this._dr[el.dataset.draw]; if (f) f(el); });
    const a = document.getElementById('asof');
    if (a && this._asof) a.textContent = 'Data last updated ' + d3.timeFormat('%a %-d %b %Y, %-I:%M %p')(this._asof) + '.';
  },
  async start(ids) {
    this._ids = ids;
    try { await this.load(); this.paint(); } catch (e) { document.getElementById('dash-root').insertAdjacentHTML('afterbegin', '<p style="color:var(--color-bad)">Could not load the data files: ' + e.message + '</p>'); }
    setInterval(async () => { try { await this.load(); this.paint(); } catch (e) {} }, 5 * 60 * 1000);
  }
};




const num = (x) => { const n = Number(x); return Number.isFinite(n) && String(x).trim() !== '' ? n : null; };
const days = (h, crew, dh) => (h && h > 0) ? Math.ceil(h / (crew * dh)) : null;

dash.calc('stage_days', {
  title: 'Stage hours and days',
  description: 'Simpro hours per stage, with days worked out as hours divided by crew size and hours per day, rounded up.',
  inputs: ['stage_hours'],
  fn: (stage_hours) => stage_hours.map((r) => {
    const crew = Number(r.crew), dh = Number(r.day_h);
    const n = (x) => (String(x).trim() === '' ? null : Number(x));
    const d = (h) => (h && h > 0) ? Math.ceil(h / (crew * dh)) : null;
    return {
      job: r.job, simpro: r.simpro, basis: r.basis,
      demo_h: n(r.demo_h) || null, rough_h: n(r.rough_h) || null, rough_d: d(n(r.rough_h)),
      fit_h: n(r.fit_h) || null, fit_d: d(n(r.fit_h)),
      comm_h: n(r.comm_h) || null, comm_d: d(n(r.comm_h)),
      unsplit_h: n(r.unsplit_h) || null, used_h: n(r.used_h) || null
    };
  })
});

dash.calc('summary', {
  title: 'Program summary',
  description: 'Counts of jobs with hours and programs, and total Simpro hours.',
  inputs: ['stage_hours', 'programs'],
  fn: (stage_hours, programs) => {
    const hrs = (r) => ['demo_h','rough_h','fit_h','comm_h','unsplit_h'].reduce((a, k) => a + (Number(r[k]) || 0), 0);
    const withHours = stage_hours.filter((r) => hrs(r) > 0);
    const found = programs.filter((r) => r.status.startsWith('Found')).length;
    const none = programs.filter((r) => r.status === 'None found').length;
    return [{ jobs: withHours.length, hours: Math.round(withHours.reduce((a, r) => a + hrs(r), 0)), found, missing: none }];
  }
});

const ok = (id) => { const g = dash.data(id); return g.status === 'ok' ? g.data : null; };
const fmt = (v) => (v === null || v === undefined || v === '') ? '—' : (typeof v === 'number' ? d3.format(',')(v) : String(v));

dash.draw('kpi', (el) => {
  const rows = ok('summary');
  el.textContent = rows && rows.length ? fmt(rows[0][el.dataset.field]) : '—';
});

function fillTable(tbody, rows, cols, numeric) {
  tbody.replaceChildren();
  if (!rows) return;
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    cols.forEach((c) => {
      const td = document.createElement('td');
      if (numeric.includes(c)) td.className = 'n';
      td.textContent = fmt(r[c]);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

dash.draw('stagetable', (tb) => fillTable(tb, ok('stage_days'),
  ['job','simpro','demo_h','rough_h','rough_d','fit_h','fit_d','comm_h','comm_d','unsplit_h','used_h','basis'],
  ['demo_h','rough_h','rough_d','fit_h','fit_d','comm_h','comm_d','unsplit_h','used_h']));
dash.draw('programtable', (tb) => fillTable(tb, ok('programs'),
  ['job','status','rough_in','fit_off','cut_out','commissioning','program_start','program_finish'], []));
dash.draw('guidetable', (tb) => fillTable(tb, ok('guideline'), ['item','demo_h','rough_h','fit_h','comm_h'], ['demo_h','rough_h','fit_h','comm_h']));
dash.draw('crewtable', (tb) => fillTable(tb, ok('crew'), ['name','role','current_work'], []));

dash.draw('stagebars', (el) => {
  const rows = ok('stage_days');
  if (!rows) { el.textContent = '—'; return; }
  const split = rows.filter((r) => (r.rough_d || 0) + (r.fit_d || 0) + (r.comm_d || 0) > 0);
  const max = d3.max(split, (r) => (r.rough_d || 0) + (r.fit_d || 0) + (r.comm_d || 0)) || 1;
  const cols = [dash.colors[0], dash.colors[1], dash.colors[2]];
  el.replaceChildren();
  split.forEach((r) => {
    const parts = [r.rough_d || 0, r.fit_d || 0, r.comm_d || 0];
    const total = parts.reduce((a, b) => a + b, 0);
    const row = document.createElement('div'); row.className = 'brow';
    const name = document.createElement('span'); name.textContent = r.job;
    const track = document.createElement('div'); track.className = 'btrack';
    track.style.width = (total / max * 100) + '%';
    parts.forEach((p, i) => {
      if (!p) return;
      const seg = document.createElement('i');
      seg.style.flex = p + ' 0 0'; seg.style.background = cols[i];
      seg.title = ['Rough-in', 'Fit-off', 'Commissioning'][i] + ': ' + p + ' days';
      track.appendChild(seg);
    });
    const tot = document.createElement('span'); tot.className = 'muted'; tot.textContent = total + ' days';
    row.append(name, track, tot);
    el.appendChild(row);
  });
});

const parseD = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const isoD = d3.timeFormat('%Y-%m-%d');
const longD = d3.timeFormat('%a %-d %b %Y');
const HOL = ['2026-11-03','2026-12-25','2026-12-28','2027-01-01','2027-01-26','2027-03-08','2027-03-26','2027-03-29','2027-06-14'];
// Christmas break: office and crew off from Wed 23 Dec 2026, back Wed 6 Jan 2027.
const inBreak = (d) => { const s = isoD(d); return s >= '2026-12-23' && s <= '2027-01-05'; };
const offLabel = (d) => (inBreak(d) ? 'Christmas break' : (HOL.includes(isoD(d)) ? 'Public holiday' : ''));
const isWork = (d) => d.getDay() !== 0 && d.getDay() !== 6 && !HOL.includes(isoD(d)) && !inBreak(d);
const finishFor = (start, n) => {
  let d = parseD(start), c = 0;
  for (let i = 0; i < 400; i++) {
    if (isWork(d)) { c++; if (c === n) return d; }
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return null;
};

dash.calc('fantech_sched', {
  title: 'Fantech fire station schedule',
  description: 'Finish by the bay rule (3 days for 1 bay, plus 2 days for each extra bay, working days, Victorian public holidays skipped) compared with the schedule finish.',
  inputs: ['fantech'],
  fn: (fantech) => fantech.map((r) => {
    const bays = Number(r.bays), n = 2 * bays + 1;
    const f = finishFor(r.start, n);
    const given = r.finish_given ? parseD(r.finish_given) : null;
    let check = r.status === 'Done' ? 'Done' : 'No finish on schedule';
    if (given && r.status !== 'Done') check = isoD(given) === isoD(f) ? 'Matches the rule' : 'Differs: schedule is ' + (given > f ? 'later' : 'earlier') + ' than the rule';
    return { station: r.station, name: r.name, district: r.district, bays, days: n,
      start: longD(parseD(r.start)), finish_rule: longD(f), finish_given: given ? longD(given) : '', status: r.status || '', check };
  })
});


dash.draw('wiptable', (tb) => fillTable(tb, ok('wip_nov'), ['job_no','job','builder','this_month','claim_day','dates'], []));
dash.draw('fantechtable', (tb) => fillTable(tb, ok('fantech_sched'), ['station','name','district','bays','days','start','finish_rule','finish_given','status','check'], ['bays','days']));

const KIND = {
  program: { name: 'Builder program', c: '#0b4fd4' },
  fantech: { name: 'Fantech fire station', c: '#12aef4' },
  roster: { name: 'Crew roster (Schedule Calendar)', c: '#7a4fd4' },
  proposed: { name: 'Proposed estimate', c: 'var(--color-fg-muted)', dash: true },
  pending: { name: 'Dates pending', c: 'var(--color-warn)', dash: true }
};
const MONTHS = [[2026, 10], [2026, 11], [2027, 0], [2027, 1], [2027, 2], [2027, 3], [2027, 4], [2027, 5]];
const ui = { person: null, m: null, kinds: new Set(Object.keys(KIND)), job: 'all', sel: null };
const baseJob = (j) => String(j).replace(/ L\d+$/, '');
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const shortD = d3.timeFormat('%a %-d %b');

dash.draw('calendar', (el) => {
  const ev = ok('cal_events');
  if (!ev) { el.textContent = '—'; return; }
  // Edits made on the planner (drag, or right click to change the date or set a status). Saved in this browser only; the CSV is not changed.
  const MOVE_KEY = 'vp-sched-edits-v1';
  let moves = {};
  try { moves = JSON.parse(localStorage.getItem(MOVE_KEY) || '{}') || {}; } catch (e) { moves = {}; }
  const saveMoves = () => { try { localStorage.setItem(MOVE_KEY, JSON.stringify(moves)); } catch (e) { /* storage blocked: edits last until refresh */ } };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const mkey = (r) => [r.job, r.label, r.start, r.end].join('|');
  const STATUS = { confirmed: 'Confirmed', discuss: 'To be discussed' };
  const all = ev.map((r, i) => {
    const k = mkey(r), ed = moves[k] || {};
    const s = parseD(ed.start || r.start), e = parseD(ed.end || r.end);
    const moved = Math.round((s - parseD(r.start)) / 86400000) || Math.round((e - parseD(r.end)) / 86400000);
    return { ...r, i, key: k, moved, status: ed.status || '', deleted: !!ed.deleted, s, e, base: baseJob(r.job) };
  });
  // Crew moved onto a job in the weekly view: stored as one-day roster rows, in this browser only.
  const CREW_KEY = 'vp-sched-crew-v1';
  let manual = [];
  try { manual = JSON.parse(localStorage.getItem(CREW_KEY) || '[]') || []; } catch (e) { manual = []; }
  const saveManual = () => { try { localStorage.setItem(CREW_KEY, JSON.stringify(manual)); } catch (e) { /* storage blocked */ } };
  const mkManual = (m) => ({ job: m.job, label: 'Crew added: ' + m.person, start: m.date, end: m.date, kind: 'roster', note: m.person + '. Added on the planner.', i: -1, key: 'manual|' + m.job + '|' + m.date + '|' + m.person, moved: 0, status: (moves['manual|' + m.job + '|' + m.date + '|' + m.person] || {}).status || '', deleted: false, manual: true, s: parseD(m.date), e: parseD(m.date), base: baseJob(m.job) });
  manual.forEach((m) => all.push(mkManual(m)));
  let items = all.filter((r) => !r.deleted);
  // Activity log: every change made on the planner, newest first. Kept in this browser only.
  const LOG_KEY = 'vp-sched-log-v1';
  let actlog = [];
  try { actlog = JSON.parse(localStorage.getItem(LOG_KEY) || '[]') || []; } catch (e) { actlog = []; }
  const logAct = (type, job, text) => {
    actlog.unshift({ t: new Date().toISOString(), type, job: job || '', text });
    if (actlog.length > 1000) actlog.length = 1000;
    try { localStorage.setItem(LOG_KEY, JSON.stringify(actlog)); } catch (e) { /* storage blocked */ }
  };
  let cascading = '';
  const rng = (s, e) => (isoD(s) === isoD(e) ? shortD(s) : shortD(s) + ' to ' + shortD(e));
  const setEdit = (r, patch) => {
    const oS = r.s, oE = r.e, oSt = r.status || '', oDel = !!r.deleted;
    const ed = Object.assign({}, moves[r.key] || {}, patch);
    const same0 = (!ed.start || ed.start === r.start) && (!ed.end || ed.end === r.end);
    if (same0) { delete ed.start; delete ed.end; }
    if (!ed.status) delete ed.status;
    if (!ed.deleted) delete ed.deleted;
    if (Object.keys(ed).length) moves[r.key] = ed; else delete moves[r.key];
    saveMoves();
    const e2 = moves[r.key] || {};
    r.s = parseD(e2.start || r.start); r.e = parseD(e2.end || r.end); r.status = e2.status || '';
    r.moved = Math.round((r.s - parseD(r.start)) / 86400000) || Math.round((r.e - parseD(r.end)) / 86400000);
    r.deleted = !!e2.deleted;
    items = all.filter((x) => !x.deleted);
    const who = r.job + ' · ' + r.label;
    if (r.deleted && !oDel) logAct('Deleted', r.base, 'Deleted from the planner: ' + who + ' (' + rng(oS, oE) + ').');
    else if (!r.deleted && oDel) logAct('Restored', r.base, 'Put back on the planner: ' + who + '.');
    if (isoD(oS) !== isoD(r.s) || isoD(oE) !== isoD(r.e)) logAct(cascading ? 'Date moved with job' : 'Date changed', r.base, who + ': ' + rng(oS, oE) + ' changed to ' + rng(r.s, r.e) + (cascading ? ' (moved with ' + cascading + ').' : '.'));
    if ((r.status || '') !== oSt) logAct('Status', r.base, who + ': ' + (r.status ? STATUS[r.status] : 'status cleared') + '.');
  };
  // Move the later items of the same job by the same number of days (the job's dates follow the one you changed).
  const cascade = (r, delta, from) => {
    if (!delta) return 0;
    let n = 0;
    const td = new Date(); td.setHours(0, 0, 0, 0);
    cascading = r.label; items.filter((x) => x !== r && x.base === r.base && x.kind !== 'claim' && x.s > from && x.s >= td).forEach((x) => { setEdit(x, { start: isoD(addDays(x.s, delta)), end: isoD(addDays(x.e, delta)) }); n++; }); cascading = '';
    return n;
  };
  let ctxMenu = null;
  const closeMenu = () => { if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; } };
  document.addEventListener('click', (e3) => { if (ctxMenu && !ctxMenu.contains(e3.target)) closeMenu(); });
  document.addEventListener('keydown', (e3) => { if (e3.key === 'Escape') closeMenu(); });
  const openMenu = (r, x, y, rerender) => {
    closeMenu();
    const m = document.createElement('div'); m.className = 'ctxmenu'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Edit ' + r.job);
    const h = document.createElement('strong'); h.textContent = r.job + ': ' + r.label; m.appendChild(h);
    const sub = document.createElement('small'); sub.textContent = 'Applies to the whole item.'; m.appendChild(sub);
    const row = document.createElement('div'); row.className = 'cmrow';
    const mkIn = (lbl, val) => { const l = document.createElement('label'); l.textContent = lbl; const inp = document.createElement('input'); inp.type = 'date'; inp.value = val; l.appendChild(inp); row.appendChild(l); return inp; };
    const si = mkIn('Start', isoD(r.s)), ei = mkIn('Finish', isoD(r.e));
    m.appendChild(row);
    const cl = document.createElement('label'); cl.className = 'cmcheck';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true;
    cl.append(cb, document.createTextNode(' Move the later items on this job by the same number of days'));
    m.appendChild(cl);
    const upd = document.createElement('button'); upd.type = 'button'; upd.className = 'cmbtn'; upd.textContent = 'Change date';
    upd.onclick = () => {
      if (!si.value || !ei.value) return;
      let sv = si.value, ev3 = ei.value; if (ev3 < sv) { const t = sv; sv = ev3; ev3 = t; }
      const oldS = new Date(r.s), delta = Math.round((parseD(sv) - oldS) / 86400000);
      setEdit(r, { start: sv, end: ev3 });
      if (cb.checked) cascade(r, delta, oldS);
      closeMenu(); rerender();
    };
    m.appendChild(upd);
    const st = document.createElement('div'); st.className = 'cmrow cmstat';
    [['confirmed', 'Confirmed'], ['discuss', 'To be discussed'], ['', 'No status']].forEach(([v, t]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'cmbtn st-' + (v || 'none'); b.textContent = t; b.setAttribute('aria-pressed', String((r.status || '') === v));
      b.onclick = () => { setEdit(r, { status: v }); closeMenu(); rerender(); };
      st.appendChild(b);
    });
    m.appendChild(st);
    const del = document.createElement('button'); del.type = 'button'; del.className = 'cmbtn cmdel'; del.textContent = 'Delete from planner';
    del.onclick = () => {
      if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = 'Click again to delete'; return; }
      setEdit(r, { deleted: true }); if (ui.sel === r.base && !items.some((x) => x.base === r.base)) ui.sel = null; closeMenu(); rerender();
    };
    m.appendChild(del);
    const dsub = document.createElement('small'); dsub.textContent = 'Only removes it from this planner in this browser. Put everything back brings it back.'; m.appendChild(dsub);
    document.body.appendChild(m); ctxMenu = m;
    const w = m.offsetWidth, hh = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + 'px';
    m.style.top = Math.max(8, Math.min(y, window.innerHeight - hh - 8)) + 'px';
    si.focus();
  };
  let dragRef = null;
  if (ui.m === null) {
    const now = new Date();
    const idx = MONTHS.findIndex(([y, m]) => now.getFullYear() === y && now.getMonth() === m);
    ui.m = idx >= 0 ? idx : 0;
  }
  const vis = (r) => (ui.kinds.has(r.kind) || (ui.kinds.has('fantech') && /^FS\d+/i.test(r.job))) && (ui.job === 'all' || r.base === ui.job) && (!ui.person || crewOf(r).includes(ui.person) || (!r.manual && manual.some((m) => m.person === ui.person && baseJob(m.job) === r.base)) || (r.base === IGA && r.kind === 'program' && items.some((x) => x.base === IGA && x.kind === 'roster' && crewOf(x).includes(ui.person))));
  const IGA = 'Swan St IGA';
  const visK = (r) => (ui.kinds.has(r.kind) || (ui.kinds.has('fantech') && /^FS\d+/i.test(r.job))) && (ui.job === 'all' || r.base === ui.job);
  // Crew added by dragging show as faces on the job's own box for that day, not as a separate box.
  const hostFor = (base, day) => {
    const c = items.filter((x) => !x.manual && x.base === base && x.kind !== 'claim' && ['roster', 'fantech', 'program'].includes(x.kind) && x.s <= day && day <= x.e && (isoD(x.s) === isoD(x.e) || isWork(day)) && visK(x));
    if (base === IGA) return c.find((x) => x.kind === 'program') || null;
    return c.find((x) => x.kind === 'roster') || c.find((x) => x.kind === 'fantech') || c[0] || null;
  };
  const inMonth = (r, mi) => { const [y, m] = MONTHS[mi]; return r.s <= new Date(y, m + 1, 0) && r.e >= new Date(y, m, 1); };

  const fmtT = (iso) => d3.timeFormat('%a %-d %b, %-I:%M %p')(new Date(iso));
  let dragPerson = null;
  // Pointer-based drag (works with mouse, touch and pen in every browser). Calls onDrop(elementUnderPointer).
  let suppress = false;
  const pdrag = (el, label, onDrop, onPlainClick, sel) => {
    sel = sel || '[data-drop]';
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e0) => {
      if (e0.button && e0.button !== 0) return;
      const x0 = e0.clientX, y0 = e0.clientY; let ghost = null, moved = false;
      const mv = (e1) => {
        if (!moved && Math.hypot(e1.clientX - x0, e1.clientY - y0) < 6) return;
        if (!moved) { moved = true; ghost = mk('div', 'pghost', label); document.body.appendChild(ghost); document.body.classList.add('pdragging'); }
        ghost.style.left = (e1.clientX + 10) + 'px'; ghost.style.top = (e1.clientY + 10) + 'px';
        document.querySelectorAll('.pdrop').forEach((n) => n.classList.remove('pdrop'));
        const t = document.elementFromPoint(e1.clientX, e1.clientY); const z = t && t.closest(sel); if (z) z.classList.add('pdrop');
      };
      const up = (e2) => {
        document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        document.querySelectorAll('.pdrop').forEach((n) => n.classList.remove('pdrop'));
        document.body.classList.remove('pdragging'); if (ghost) ghost.remove();
        if (moved) { const t = document.elementFromPoint(e2.clientX, e2.clientY); const z = t && t.closest(sel); suppress = true; setTimeout(() => { suppress = false; }, 50); if (z) onDrop(z, e2); else toast(sel === '[data-day]' ? 'Drop it onto the day you want.' : 'Drop it onto a job box on the day you want.'); }
      };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    });
    el.addEventListener('click', (e) => { if (suppress) { e.preventDefault(); e.stopImmediatePropagation(); return; } if (onPlainClick) onPlainClick(e); });
  };
  const toast = (msg) => { const t = mk('div', 'toast', msg); t.setAttribute('role', 'status'); document.body.appendChild(t); setTimeout(() => t.remove(), 6000); };
  // Drop a crew face on a job for a day: refused if they are off or already on a job that day.
  const dropPerson = (p, job, d, row) => {
    // Dropped on a job: add the person to every working day that booking covers, plus every other day that week the job is on site.
    // Also every other working day that week when the job is on site (other bookings of the same job).
    const days = []; const seen = new Set(); const add = (x) => { if (isWork(x) && !seen.has(isoD(x))) { seen.add(isoD(x)); days.push(new Date(x)); } };
    if (row) for (let x = new Date(row.s); x <= row.e; x = addDays(x, 1)) add(x);
    else add(d);
    const mon = addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
    for (let n = 0; n < 6; n++) { const x = addDays(mon, n); if (items.some((r) => r.base === job && r.kind !== 'claim' && ['roster', 'fantech', 'program'].includes(r.kind) && r.s <= x && x <= r.e && (isoD(r.s) === isoD(r.e) || isWork(x)))) add(x); }
    days.sort((p1, p2) => p1 - p2);
    if (!days.length) { toast(shortD(d) + ' is not a working day.'); return; }
    const done = [], skipped = [];
    days.forEach((x) => {
      const o = offOnFn(p, x);
      const busy = items.filter((r) => (r.kind === 'roster' || r.kind === 'fantech') && r.s <= x && x <= r.e && (isoD(r.s) === isoD(r.e) || isWork(x)) && crewOf(r).includes(p));
      if (o) skipped.push(shortD(x) + ' (' + o + ')'); else if (busy.length) skipped.push(shortD(x) + ' (on ' + busy[0].base + ')'); else { assignFn(p, job, x, true); done.push(x); }
    });
    if (done.length) { logAct('Crew added', baseJob(job), p + ' added to ' + job + ' for ' + done.length + ' day' + (done.length > 1 ? 's' : '') + ' (' + rng(done[0], done[done.length - 1]) + ')' + (skipped.length ? '; locked, not added: ' + skipped.join(', ') : '') + '.'); renderFn(); }
    toast(done.length ? p + ' added to ' + job + ' for ' + done.length + ' day' + (done.length > 1 ? 's' : '') + ' (' + shortD(done[0]) + (done.length > 1 ? ' to ' + shortD(done[done.length - 1]) : '') + ').' + (skipped.length ? ' Locked, not added: ' + skipped.join(', ') + '.' : '') : p + ' could not be added: ' + skipped.join(', ') + '.');
  };
  let renderFn = () => {};
  let offOnFn = () => '', assignFn = () => {};
  function render() {
    el.replaceChildren();

    ui.m = window.PAGE_MONTH;
    const [yy, mm] = MONTHS[ui.m];
    const mStart = new Date(yy, mm, 1), mEnd = new Date(yy, mm + 1, 0);

    const body = mk('div', 'fade'); body.style.cssText = 'display:flex;flex-direction:column;gap:var(--cds-gap-md);padding-top:var(--cds-gap-md)';
    el.appendChild(body);

    // Crew faces: click one to see only that person's days
    const cb = mk('div', 'crewbar');
    cb.appendChild(mk('span', 'muted', 'On the tools:'));
    CREW.forEach((n) => {
      const b = mk('button', 'cb'); b.type = 'button';
      b.setAttribute('aria-pressed', String(ui.person === n));
      b.insertAdjacentHTML('afterbegin', faceSVG(n, 28));
      b.append(n);
      b.title = 'Click to filter. Drag onto a job on a day to schedule ' + n + '.'; b.style.cursor = 'grab';
      pdrag(b, n, (z) => dropPerson(n, z.dataset.base, parseD(z.dataset.date), z._row), () => { ui.person = ui.person === n ? null : n; ui.sel = null; render(); });
      cb.appendChild(b);
    });
    body.appendChild(cb);

    // Filters
    const fl = mk('div', 'filters');
    Object.entries(KIND).filter(([k]) => items.some((r) => r.kind === k)).forEach(([k, v]) => {
      const b = mk('button', 'fbtn', v.name); b.type = 'button';
      b.style.setProperty('--k', v.c);
      b.setAttribute('aria-pressed', String(ui.kinds.has(k) && ui.kinds.size < Object.keys(KIND).length));
      b.classList.toggle('dim', ui.kinds.size < Object.keys(KIND).length && !ui.kinds.has(k));
      b.onclick = () => { const only = ui.kinds.size === 1 && ui.kinds.has(k); ui.kinds = only ? new Set(Object.keys(KIND)) : new Set([k]); ui.sel = null; render(); };
      fl.appendChild(b);
    });
    const sel = mk('select'); sel.setAttribute('aria-label', 'Filter by job');
    const jobs = [...new Set(items.filter((r) => r.kind !== 'claim').map((r) => r.base))].sort();
    [['all', 'All jobs'], ...jobs.map((j) => [j, j])].forEach(([v, t]) => { const o = mk('option', '', t); o.value = v; if (v === ui.job) o.selected = true; sel.appendChild(o); });
    sel.onchange = () => { ui.job = sel.value; ui.sel = null; render(); };
    const clr = mk('button', 'clr', 'Reset'); clr.type = 'button';
    clr.onclick = () => { ui.kinds = new Set(Object.keys(KIND)); ui.job = 'all'; ui.person = null; ui.sel = null; render(); };
    fl.append(sel, clr);
    body.appendChild(fl);

    // Month summary
    const mItems = items.filter((r) => inMonth(r, ui.m) && vis(r));
    const fsDays = mItems.filter((r) => r.kind === 'fantech').reduce((a, r) => {
      let n = 0;
      for (let d = new Date(Math.max(r.s, mStart)); d <= Math.min(r.e, mEnd); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) if (isWork(d)) n++;
      return a + n;
    }, 0);
    const kp = mk('div', 'kpis');
    [['Jobs on the calendar', new Set(mItems.filter((r) => r.kind !== 'claim').map((r) => r.base)).size],
     ['Fire station days', fsDays],
     ['Crew roster entries', mItems.filter((r) => r.kind === 'roster').length]].forEach(([l, v]) => {
      const k = mk('div', 'kpi'); k.append(mk('span', 'muted', l), mk('b', '', String(v))); kp.appendChild(k);
    });
    body.appendChild(kp);

    // Overlaps: the same person on two jobs on one working day
    const clashAll = findClashes(items, isWork);
    const clashDay = {};
    clashAll.forEach((c) => { (clashDay[c.iso] = clashDay[c.iso] || []).push(c); });
    const clashMonth = clashAll.filter((c) => c.date >= mStart && c.date <= mEnd);
    if (clashMonth.length) {
      const al = mk('div', 'alertbox');
      al.appendChild(mk('strong', '', 'Overlap warning: ' + clashMonth.length + (clashMonth.length === 1 ? ' double booking' : ' double bookings') + ' this month'));
      const ul = mk('ul'); clashMonth.slice(0, 10).forEach((c) => ul.appendChild(mk('li', '', c.person + ' is on ' + c.jobs.join(' and ') + ' on ' + shortD(c.date))));
      al.appendChild(ul); body.appendChild(al);
    }

    // Edits banner
    const nDel = all.filter((r) => r.deleted).length;
    const nEdit = all.filter((r) => r.moved || r.status || r.deleted).length;
    const tip = mk('div', 'movebar');
    tip.append(mk('span', 'muted', (nEdit ? nEdit + ' item' + (nEdit === 1 ? '' : 's') + ' changed from the schedule' + (nDel ? ' (' + nDel + ' deleted)' : '') + '. ' : '') + 'Drag an item to move it (hold Shift to move the later items on that job too), or right click it to change the date or mark it Confirmed or To be discussed. Saved in this browser only; it does not change the Schedule Calendar.'));
    if (nEdit) {
      const rs = mk('button', 'clr', 'Put everything back'); rs.type = 'button';
      rs.onclick = () => { logAct('Reset', '', 'Put everything back to the original schedule (date, status and delete changes cleared).'); moves = {}; saveMoves(); all.forEach((r) => { r.moved = 0; r.status = ''; r.deleted = false; r.s = parseD(r.start); r.e = parseD(r.end); }); items = all.slice(); render(); };
      tip.appendChild(rs);
    }
    body.appendChild(tip);

    // Grid
    const picked = ui.sel ? { base: ui.sel } : null;
    const wrap = mk('div', 'scroll');
    const cal = mk('div', 'cal' + (picked ? ' picked' : ''));
    const head = mk('div', 'calrow calhead');
    ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach((n) => head.appendChild(mk('span', '', n)));
    cal.appendChild(head);
    const first = new Date(yy, mm, 1);
    let day = new Date(yy, mm, 1 - ((first.getDay() + 6) % 7));
    const todayIso = isoD(new Date());
    while (day < new Date(yy, mm + 1, 1)) {
      const row = mk('div', 'calrow');
      for (let i = 0; i < 7; i++) {
        const inM = day.getMonth() === mm;
        const dHere = new Date(day);
        const cell = mk('div', 'day' + (inM ? '' : ' out') + (i > 4 ? ' wkend' : '') + (isoD(day) === todayIso ? ' today' : ''));
        cell.appendChild(mk('span', 'dn', String(day.getDate())));
        if (inM && clashDay[isoD(day)]) { cell.classList.add('clash'); cell.appendChild(mk('span', 'clashtag', 'Overlap: ' + clashDay[isoD(day)].map((c) => c.person).join(', '))); }
        if (inM && (HOL.includes(isoD(day)) || inBreak(day)) && day.getDay() % 6 !== 0) cell.appendChild(mk('span', 'hol', offLabel(day)));
        if (inM) {
          // Crew days off (trade school, leave) from data/crew_off.csv
          if (ui.job === 'all') (ok('crew_off') || []).filter((o) => o.date === isoD(day) && (!ui.person || o.person === ui.person)).forEach((o) => {
            const oc = mk('span', 'chip off'); oc.insertAdjacentHTML('afterbegin', faceSVG(o.person, 16) + ' '); oc.append(o.person + ' · ' + o.reason); oc.title = o.person + ': ' + o.reason + ' (not available for jobs)';
            cell.appendChild(oc);
          });
          items.filter(vis).forEach((r) => {
            if (day < r.s || day > r.e) return;
            const single = isoD(r.s) === isoD(r.e);
            if (!single && !isWork(day) && isoD(day) !== isoD(r.s)) return;
            // Swan St IGA follows the program only: one box a day, with the crew's faces from the roster.
            let igaCrew = [], igaLabel = null;
            if (r.base === IGA) {
              if (r.kind !== 'program') return;
              const progs = items.filter((x) => x.base === IGA && x.kind === 'program' && x.s <= day && day <= x.e && (isoD(x.s) === isoD(x.e) || isWork(day)) && visK(x));
              if (progs[0] !== r) return;
              igaLabel = progs.map((x) => x.label.replace(/ \(program\)$/, '')).join(' + ');
              igaCrew = [...new Set(items.filter((x) => x.base === IGA && x.kind === 'roster' && x.s <= day && day <= x.e).flatMap((x) => crewOf(x)))];
            }
            if (r.manual && hostFor(r.base, day)) return;
            const extra = (!r.manual && hostFor(r.base, day) === r) ? manual.filter((m) => baseJob(m.job) === r.base && m.date === isoD(day)).map((m) => m.person) : [];
            if (ui.person && !crewOf(r).includes(ui.person) && !extra.includes(ui.person) && !igaCrew.includes(ui.person)) return;
            const kd = KIND[r.kind] || { c: 'var(--color-fg-muted)', dash: true };
            const c = mk('button', 'chip' + (kd.dash ? ' dash' : '') + (picked && picked.base === r.base ? ' hl' : ''), r.kind === 'claim' ? r.label : r.job + ' · ' + (igaLabel || r.label));
            c.type = 'button';
            c.style.setProperty('--k', jobColor(r.base));
            c.style.setProperty('--kc', kd.c);
            const crew = [...new Set([...crewOf(r), ...igaCrew, ...extra])];
            const shown = igaLabel || r.label;
            if (crew.length) { c.textContent = ''; c.insertAdjacentHTML('afterbegin', crew.map((n) => faceSVG(n, 16)).join('') + ' '); c.append(r.kind === 'claim' ? r.label : r.job + ' · ' + shown); }
            c.insertAdjacentHTML('beforeend', '<i class="kd"></i>');
            c.title = r.job + ': ' + shown + (extra.length ? ' (added on the planner: ' + extra.join(', ') + ')' : '');
            const chipClick = () => { ui.sel = ui.sel === r.base ? null : r.base; render(); };
            if (r.kind === 'claim') c.onclick = chipClick;
            if (r.kind !== 'claim') {
              pdrag(c, r.job, (z, e2) => {
                const delta = Math.round((parseD(z.dataset.day) - dHere) / 86400000);
                if (delta) { const oldS = new Date(r.s); setEdit(r, { start: isoD(addDays(r.s, delta)), end: isoD(addDays(r.e, delta)) }); if (e2.shiftKey) cascade(r, delta, oldS); render(); }
              }, chipClick, '[data-day]');
              if (r.moved) { c.classList.add('moved'); c.title += ' (moved ' + (r.moved > 0 ? '+' : '') + r.moved + ' d from the schedule)'; }
              if (r.status) { c.classList.add('s-' + r.status); c.title += ' (' + STATUS[r.status] + ')'; c.insertAdjacentHTML('beforeend', r.status === 'confirmed' ? '<svg class="stbadge" viewBox="0 0 12 12" width="12" height="12" aria-label="Confirmed"><circle cx="6" cy="6" r="6" fill="#2b9348"/><path d="M3 6.2L5.2 8.3L9 4" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '<b class="stbadge disc" title="To be discussed">To discuss</b>'); }
              c.oncontextmenu = (e4) => { e4.preventDefault(); openMenu(r, e4.clientX, e4.clientY, render); };
            }
            c._row = r; c.dataset.drop = '1'; c.dataset.base = r.base; c.dataset.date = isoD(dHere);
            c.ondragover = (e5) => { if (dragPerson) { e5.preventDefault(); e5.stopPropagation(); c.classList.add('dropok'); } };
            c.ondragleave = () => c.classList.remove('dropok');
            c.ondrop = (e5) => { if (!dragPerson) return; e5.preventDefault(); e5.stopPropagation(); c.classList.remove('dropok'); const p0 = dragPerson; dragPerson = null; dropPerson(p0, r.base, dHere, r); };
            cell.appendChild(c);
          });
        }
        if (inM) {
          const here = new Date(day); cell.dataset.day = isoD(day);
          cell.ondragover = (e2) => { if (dragRef) { e2.preventDefault(); cell.classList.add('dropok'); } };
          cell.ondragleave = () => cell.classList.remove('dropok');
          cell.ondrop = (e2) => {
            e2.preventDefault(); cell.classList.remove('dropok');
            if (!dragRef) return;
            const delta = Math.round((here - dragRef.from) / 86400000);
            if (delta) { const r0 = dragRef.r, oldS = new Date(r0.s); setEdit(r0, { start: isoD(addDays(r0.s, delta)), end: isoD(addDays(r0.e, delta)) }); if (e2.shiftKey) cascade(r0, delta, oldS); }
            dragRef = null; render();
          };
        }
        row.appendChild(cell);
        day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
      }
      cal.appendChild(row);
    }
    wrap.appendChild(cal); body.appendChild(wrap);

    // Weekly crew view: who is on which job each day. Crew already on a job (or off) are greyed and locked.
    const offRows = ok('crew_off') || [];
    const offOn = (p, d) => { const o = offRows.find((x) => x.person === p && x.date === isoD(d)); return o ? o.reason : offLabel(d); };
    const PEOPLE_ROWS = ['Urv', 'Kei', 'Dan', 'Tandy', 'Matt B', 'Dan B', 'Jonte'];
    const mondayOf = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
    if (!ui.wk) { const t0 = new Date(); ui.wk = (t0 >= mStart && t0 <= mEnd) ? mondayOf(t0) : mondayOf(mStart); }
    const wkEnd = addDays(ui.wk, 5);
    const wsec = mk('section', 'weekview');
    const whead = mk('div', 'whead');
    const pb = mk('button', 'clr', 'Previous week'); pb.type = 'button'; pb.onclick = () => { ui.wk = addDays(ui.wk, -7); render(); };
    const nb = mk('button', 'clr', 'Next week'); nb.type = 'button'; nb.onclick = () => { ui.wk = addDays(ui.wk, 7); render(); };
    whead.append(mk('h2', '', 'Crew this week: ' + shortD(ui.wk) + ' to ' + shortD(wkEnd)), pb, nb);
    wsec.appendChild(whead);
    wsec.appendChild(mk('p', 'muted', 'Crew on a job are greyed and locked, so nobody gets double booked. Drag a free person (blue) onto a job on the same day to add them. Click a free person to pick the job instead.'));
    const wdays = [0, 1, 2, 3, 4, 5].map((n) => addDays(ui.wk, n));
    const activeRows = (d) => items.filter((r) => r.kind !== 'claim' && r.s <= d && d <= r.e && (isoD(r.s) === isoD(r.e) || isWork(d)));
    const jobsOn = (d) => [...new Set(activeRows(d).filter((r) => r.kind === 'roster' || r.kind === 'fantech' || r.kind === 'program').map((r) => r.base))];
    const whoOn = (p, d) => activeRows(d).filter((r) => (r.kind === 'roster' || r.kind === 'fantech') && crewOf(r).includes(p));
    const tbl = mk('div', 'wgrid'); tbl.style.setProperty('--cols', String(wdays.length));
    tbl.appendChild(mk('span', 'wc wh', ''));
    wdays.forEach((d) => tbl.appendChild(mk('span', 'wc wh', shortD(d))));
    // Jobs row: the drop targets
    tbl.appendChild(mk('span', 'wc wl', 'Jobs on'));
    let dragCrew = null;
    const assign = (p, job, d, quiet) => {
      const m = { job, date: isoD(d), person: p };
      if (manual.some((x) => x.job === m.job && x.date === m.date && x.person === p)) return;
      manual.push(m); saveManual();
      const row = mkManual(m); delete moves[row.key]; saveMoves(); all.push(row); items = all.filter((x) => !x.deleted); if (!quiet) { logAct('Crew added', baseJob(job), p + ' added to ' + job + ' on ' + shortD(d) + '.'); render(); }
    };
    const unassign = (p, job, d) => {
      manual = manual.filter((x) => !(x.job === job && x.date === isoD(d) && x.person === p)); saveManual();
      const k = 'manual|' + job + '|' + isoD(d) + '|' + p; const ix = all.findIndex((x) => x.key === k); if (ix >= 0) all.splice(ix, 1);
      items = all.filter((x) => !x.deleted); logAct('Crew removed', baseJob(job), p + ' removed from ' + job + ' on ' + shortD(d) + '.'); render();
    };
    wdays.forEach((d) => {
      const col = mk('span', 'wc wj'); const js = jobsOn(d);
      if (!isWork(d) && !js.length) col.appendChild(mk('i', 'muted', offLabel(d) || 'No roster'));
      js.forEach((j) => {
        const t = mk('span', 'wjob', j); t.style.setProperty('--jc', jobColor(j)); t.dataset.drop = '1'; t.dataset.base = j; t.dataset.date = isoD(d);
        t.ondragover = (e5) => { if (dragCrew && dragCrew.date === isoD(d)) { e5.preventDefault(); t.classList.add('dropok'); } };
        t.ondragleave = () => t.classList.remove('dropok');
        t.ondrop = (e5) => { e5.preventDefault(); t.classList.remove('dropok'); if (dragCrew && dragCrew.date === isoD(d)) { const p0 = dragCrew.person; dragCrew = null; assign(p0, j, d); } };
        col.appendChild(t);
      });
      tbl.appendChild(col);
    });
    PEOPLE_ROWS.forEach((p) => {
      const nm = mk('span', 'wc wl'); nm.insertAdjacentHTML('afterbegin', faceSVG(p, 22) + ' ' + p); tbl.appendChild(nm);
      wdays.forEach((d) => {
        const cell = mk('span', 'wc');
        const off = offOn(p, d), on = whoOn(p, d);
        if (off || (!isWork(d) && !on.length)) { cell.classList.add('woff'); cell.textContent = off || 'Off'; }
        else if (on.length) {
          cell.classList.add('wbusy');
          on.forEach((r) => {
            const t = mk('span', 'wjob busy', r.base); t.style.setProperty('--jc', jobColor(r.base)); t.title = p + ' is on ' + r.base + ' this day, so they cannot be moved to another job.';
            if (r.manual) { const x = mk('button', 'wx', 'Remove'); x.type = 'button'; x.title = 'Remove ' + p + ' from ' + r.base + ' on ' + shortD(d); x.onclick = () => unassign(p, r.base, d); t.appendChild(x); }
            cell.appendChild(t);
          });
        } else {
          const pill = mk('button', 'wfree', 'Free'); pill.type = 'button'; pill.title = 'Drag ' + p + ' onto a job on ' + shortD(d);
          pill.style.cursor = 'grab';
          pdrag(pill, p, (z) => { if (z.dataset.date === isoD(d)) dropPerson(p, z.dataset.base, d); else toast('Drop ' + p + ' onto a job on ' + shortD(d) + '.'); }, (e5) => { pill.dataset.open = '1'; });
          pill.onclick = (e5) => {
            e5.stopPropagation(); closeMenu();
            const js = jobsOn(d); const m = document.createElement('div'); m.className = 'ctxmenu'; m.setAttribute('role', 'dialog');
            const h = document.createElement('strong'); h.textContent = p + ' on ' + shortD(d); m.appendChild(h);
            if (!js.length) { const s = document.createElement('small'); s.textContent = 'No jobs on that day.'; m.appendChild(s); }
            js.forEach((j) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'cmbtn'; b.textContent = j; b.onclick = () => { closeMenu(); dropPerson(p, j, d); }; m.appendChild(b); });
            document.body.appendChild(m); ctxMenu = m;
            const r0 = pill.getBoundingClientRect(); m.style.left = Math.max(8, Math.min(r0.left, window.innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = Math.max(8, Math.min(r0.bottom + 4, window.innerHeight - m.offsetHeight - 8)) + 'px';
          };
          cell.appendChild(pill);
        }
        tbl.appendChild(cell);
      });
    });
    const lh = mk('span', 'wc wl', 'Labour hire');
    tbl.appendChild(lh);
    wdays.forEach((d) => { const cell = mk('span', 'wc wlh'); const on = activeRows(d).filter((r) => /labour hire/i.test((r.label || '') + ' ' + (r.note || ''))).map((r) => r.base); cell.textContent = [...new Set(on)].join(', ') || ''; tbl.appendChild(cell); });
    offOnFn = offOn; assignFn = assign; renderFn = render;
    const sc = mk('div', 'wscroll'); sc.appendChild(tbl); wsec.appendChild(sc);
    body.appendChild(wsec);

    // Activity log
    const lsec = mk('section', 'actlogsec');
    const lh2 = mk('div', 'whead'); lh2.append(mk('h2', '', 'Activity log'));
    const ex = mk('button', 'clr', 'Download as CSV'); ex.type = 'button';
    ex.onclick = () => {
      const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
      const csv = ['Time,Change,Job,Detail'].concat(actlog.map((l) => [fmtT(l.t), l.type, l.job, l.text].map(q).join(','))).join('\r\n');
      const u = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const lk = document.createElement('a'); lk.href = u; lk.download = 'planner-activity-log.csv'; document.body.appendChild(lk); lk.click(); lk.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
    };
    lh2.appendChild(ex); lsec.appendChild(lh2);
    lsec.appendChild(mk('p', 'muted', 'Every date change, status, delete and crew move made on the planner, newest first. It is kept in this browser only. ' + actlog.length + ' entr' + (actlog.length === 1 ? 'y' : 'ies') + '.'));
    if (!actlog.length) lsec.appendChild(mk('p', 'muted', 'Nothing has been changed yet.'));
    else {
      const lt = mk('div', 'logtbl');
      lt.append(mk('b', '', 'When'), mk('b', '', 'Change'), mk('b', '', 'Detail'));
      actlog.slice(0, 150).forEach((l) => { lt.append(mk('span', 'lt', fmtT(l.t)), mk('span', 'lk', l.type), mk('span', '', l.text)); });
      lsec.appendChild(lt);
      if (actlog.length > 150) lsec.appendChild(mk('p', 'muted', 'Showing the latest 150. Download the CSV for all of them.'));
    }
    lsec.appendChild(mk('p', 'muted', 'Planner version 20261103q. If you do not see this line, refresh the page again.'));
    body.appendChild(lsec);

    // Job information: a list of jobs; click one to see what we are doing on it
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const stat = (r) => (r.s <= today0 && today0 <= r.e) ? 'Now' : (r.s > today0 ? 'Next' : 'Done');
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    const same = (x, y) => { const p = norm(x), q = norm(y); return p && q && (p.includes(q) || q.includes(p)); };
    const wipRows = ok('wip_nov') || [];
    const wipFor = (name) => wipRows.find((w) => same(w.job, name));
    const range = (r) => isoD(r.s) === isoD(r.e) ? shortD(r.s) : shortD(r.s) + ' to ' + shortD(r.e);
    const dated = mItems.filter((r) => r.kind !== 'claim');
    const firstStart = (n) => Math.min(...dated.filter((r) => r.base === n).map((r) => +r.s));
    const names = [...new Set(dated.map((r) => r.base))].sort((x, y) => firstStart(x) - firstStart(y));
    const wipOnly = (ui.m === 0 && ui.job === 'all') ? wipRows.filter((w) => !names.some((n) => same(w.job, n))) : [];

    const list = mk('div', 'joblist');
    const addJob = (name, label) => {
      const b = mk('button', 'jbtn'); b.type = 'button'; b.style.setProperty('--jc', jobColor(name));
      b.setAttribute('aria-pressed', String(ui.sel === name));
      b.append(mk('span', '', name), mk('small', 'muted', label));
      b.onclick = () => { ui.sel = ui.sel === name ? null : name; render(); };
      list.appendChild(b);
    };
    names.forEach((n) => {
      const st = dated.filter((r) => r.base === n).map(stat);
      addJob(n, st.includes('Now') ? 'On now' : (st.includes('Next') ? 'Coming up' : 'Done this month'));
    });
    wipOnly.forEach((w) => addJob(w.job, items.some((r) => r.kind !== 'claim' && same(r.base, w.job)) ? 'Dated in a later month' : 'No dates yet'));
    if (!list.children.length) list.appendChild(mk('span', 'muted', 'Nothing matches these filters for this month.'));

    const det = mk('div', 'detail');
    if (ui.sel) {
      const isWipOnly = wipOnly.some((w) => w.job === ui.sel);
      const ents = items.filter((r) => r.kind !== 'claim' && (r.base === ui.sel || (isWipOnly && same(r.base, ui.sel)))).sort((x, y) => x.s - y.s);
      det.style.setProperty('--k', jobColor(ui.sel));
      det.appendChild(mk('strong', '', ui.sel));
      if (ents.length) {
        det.appendChild(mk('span', 'muted', 'What we are doing on this job'));
        ents.forEach((r) => {
          const st = stat(r);
          const line = mk('div', 'jline');
          const stTxt = r.status ? ' [' + STATUS[r.status] + ']' : '';
          line.append(mk('span', 'pill' + (st === 'Now' ? ' ok' : st === 'Next' ? ' warn' : ''), st),
            mk('span', '', ' ' + r.label + ', ' + range(r) + stTxt + '. ' + r.note));
          det.appendChild(line);
        });
        const sp = schedulePos(ents, today0, isWork);
        const crew = [...new Set(sp.active.flatMap(crewOf))];
        const sh = (ok('stage_hours') || []).find((x) => same(x.job, ui.sel));
        const hrs = sh ? [sh.rough_h, sh.fit_h, '', sh.comm_h].map((v) => (+v ? +v : '')) : null;
        const cr = mk('div', 'crewrow');
        if (crew.length) { cr.appendChild(mk('span', 'muted', 'On this job now:')); crew.forEach((n) => { const sp1 = mk('span', 'pill'); sp1.insertAdjacentHTML('afterbegin', faceSVG(n, 22) + ' ' + n); cr.appendChild(sp1); }); }
        else cr.appendChild(mk('span', 'muted', 'No crew named on the roster for this job.'));
        det.appendChild(cr);
        const msAll = ok('milestones') || [];
        const jobMs = msAll.filter((x) => same(x.job, ui.sel) || (/anytime/i.test(x.job) && /anytime/i.test(ui.sel)));
        const sv = jobMs.filter((x) => /^survey:/i.test(x.milestone)).map((x) => ({ label: String(x.milestone).replace(/^survey:\s*/i, ''), status: x.status }));
        const tk = jobMs.filter((x) => /^task:/i.test(x.milestone)).map((x) => ({ label: String(x.milestone).replace(/^task:\s*/i, ''), status: x.status }));
        const rcReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const asOf = (rows) => rows.map((x) => x.as_of).filter(Boolean).sort().pop();
        if (sv.length) {
          det.appendChild(mk('span', 'muted', 'Site survey'));
          const sw = mk('div', 'trackwrap'); det.appendChild(sw);
          buildSurveyTrack(sw, { items: sv, walkers: crewOf({ label: 'Urv', note: '' }), color: jobColor(ui.sel), reduce: rcReduce, aria: ui.sel + ' survey progress' });
          det.appendChild(mk('span', 'muted', 'Ticks come from the job channel posts and the daily site recap (last updated ' + (asOf(jobMs.filter((x) => /^survey:/i.test(x.milestone))) || '') + '). The survey is not finished: the rest needs a day for Urv, which is not booked yet.'));
          det.appendChild(mk('span', 'muted', 'Install: not started. The crew are expected on site in 2 to 3 weeks, once the survey is finished.'));
        }
        if (tk.length) {
          det.appendChild(mk('span', 'muted', 'Site progress from the job channel'));
          const tw = mk('div', 'trackwrap'); det.appendChild(tw);
          buildSurveyTrack(tw, { items: tk, walkers: crew, color: jobColor(ui.sel), reduce: rcReduce, aria: ui.sel + ' site progress', unit: 'items' });
          det.appendChild(mk('span', 'muted', 'From the Slack job channel posts (last updated ' + (asOf(jobMs.filter((x) => /^task:/i.test(x.milestone))) || '') + '). A ring with a number means still to do; orange means part done.'));
        }
        const finRow = (ok('finished') || []).find((x) => same(x.job, ui.sel));
        if (finRow) {
          const fp = pointsFor(finRow.est_h, finRow.actual_h);
          det.appendChild(mk('span', 'muted', 'Finished' + (finRow.finished ? ' ' + shortD(parseD(finRow.finished)) : '') + ', ' + finRow.actual_h + ' of ' + finRow.est_h + ' h' + (fp !== null && finRow.completed_by ? ', ' + fp + (fp === 1 ? ' point' : ' points') + ' for ' + finRow.completed_by : '')));
          const fw = mk('div', 'trackwrap'); det.appendChild(fw);
          buildCelebration(fw, { name: finRow.completed_by, within: fp === 5 && !!finRow.completed_by, others: ['Tandy', 'Dan', 'Urv', 'Matt B', 'Dan B', 'Kei'], aria: ui.sel + ' finished' });
        }
        const jhs = (ok('job_hours') || []).find((x) => same(x.job, ui.sel) || (/iga/i.test(ui.sel) && /iga/i.test(x.job)));
        const estAll = sh ? ['demo_h', 'rough_h', 'fit_h', 'comm_h', 'unsplit_h'].reduce((t, k) => t + (+sh[k] || 0), 0) : 0;
        if (sh && estAll > 0) {
          const u = +sh.used_h || 0, e = estAll, pc = Math.round(u / e * 100), sc = jhs ? +jhs.sched_h || 0 : 0;
          det.appendChild(mk('span', 'muted', 'Estimate from the Simpro job (' + sh.simpro + '): ' + e + ' h. ' + (/Job Hours file/i.test(sh.basis || '') ? 'Hours used to date in Simpro (' + String(sh.basis).replace(/^.*file\s*/i, '').replace(/\s*\(.*/, '') + ', not yet split by stage): ' : 'Actual hours worked to date from the Simpro week view: ') + u + ' h (' + pc + '%), ' + Math.max(0, e - u) + ' h left' + (sc ? '. Scheduled ahead in the week view: ' + sc + ' h' : '') + '.'));
          const hb = mk('div', 'daybar'); const hf = document.createElement('i'); hf.style.width = Math.min(100, pc) + '%'; hf.style.background = pc > 100 ? '#e03131' : '#2b9348'; hb.appendChild(hf); det.appendChild(hb);
        }
        if (/IGA/i.test(ui.sel)) {
          const ros = ents.filter((r) => r.kind === 'roster');
          if (ros.length) {
            // Proposed allocated days: the rostered days in the Schedule Calendar (Quick Links > Schedule), not the builder program.
            const y0 = new Date(today0.getTime() - 86400000);
            let tot = 0, dn = 0, last = null;
            ros.forEach((r) => { for (let x = new Date(r.s); x <= r.e; x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1)) if (isWork(x)) { tot++; if (x <= y0) dn++; if (!last || x > last) last = x; } });
            det.appendChild(mk('span', 'muted', 'Proposed days from the Schedule Calendar: ' + dn + ' of ' + tot + ' rostered days done, last rostered day ' + shortD(last) + '.'));
            const db = mk('div', 'daybar'); const dfill = document.createElement('i'); dfill.style.width = Math.round(dn / tot * 100) + '%'; dfill.style.background = jobColor(ui.sel); db.appendChild(dfill); det.appendChild(db);
          }
        }
        const th = mk('div', 'trackwrap'); det.appendChild(th);
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const isFire = /^FS\d+/i.test(ui.sel) || /fire station/i.test(ui.sel) || ents.some((r) => r.kind === 'fantech');
        const isLC = /459 Little Collins/i.test(ui.sel);
        const isCondRep = /368 smith/i.test(ui.sel);
        const noSplit = !!sh && /no stage split/i.test(sh.basis || '');
        const isSmall = isCondRep || (!isFire && !isLC && !!sh && (+sh.demo_h || 0) + (+sh.rough_h || 0) + (+sh.fit_h || 0) + (+sh.comm_h || 0) === 0 && (+sh.unsplit_h || 0) > 0 && (+sh.unsplit_h || 0) <= 40);
        if (isLC) {
          // 459 Little Collins St: Levels 3, 4, 8, 9, 10 and 11, then commissioning
          const ms = (ok('milestones') || []).filter((x) => /459/i.test(x.job));
          const status = {}; ms.forEach((x) => { status[String(x.milestone).trim()] = x.status; });
          const comm = status['Commissioning'] || '';
          buildLevelsTrack(th, { levels: [3, 4, 8, 9, 10, 11], status, commissioning: comm, walkers: crew, color: jobColor(ui.sel), reduce, aria: ui.sel + ' progress by level' });
          if (!ms.length) det.appendChild(mk('span', 'muted', 'No level progress has been recorded yet, so the crew start at Level 3. Progress is added from Matt B\'s site posts.'));
        } else
        if (isSmall) {
          // Small job: no rough-in, fit-off or commissioning stages. Just rostered days and the Simpro hours.
          th.remove();
          const rs = ents.filter((r) => r.kind !== 'program');
          let tot = 0, dn = 0;
          rs.forEach((r) => { for (let x = new Date(r.s); x <= r.e; x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1)) if (isWork(x) || isoD(r.s) === isoD(r.e)) { tot++; if (x < today0) dn++; } });
          det.appendChild(mk('span', 'muted', (isCondRep ? 'Scope: condition report and airflow testing. There are no rough-in, fit-off or commissioning stages. ' : 'Small job, so there are no rough-in, fit-off or commissioning stages. ') + (tot ? dn + ' of ' + tot + ' rostered ' + (tot === 1 ? 'day' : 'days') + ' done.' : 'No rostered days yet.')));
          if (tot) { const db = mk('div', 'daybar'); const df = document.createElement('i'); df.style.width = Math.round(dn / tot * 100) + '%'; df.style.background = jobColor(ui.sel); db.appendChild(df); det.appendChild(db); }
        } else
        if (isFire) {
          // Fire stations: no rough-in, fit-off or commissioning. Progress is by bay and by day.
          const code = (String(ui.sel).match(/^FS\d+/i) || [''])[0].toUpperCase();
          const fr = (ok('fantech') || []).find((x) => x.station === code);
          const bays = fr ? +fr.bays : 2;
          const BAYDAYS = { 1: 3, 2: 5, 3: 7, 4: 9, 5: 11, 6: 13 };
          const hasFt = ents.some((r) => r.kind === 'fantech');
          const s0 = new Date(Math.min(...ents.map((r) => +r.s))), e0 = new Date(Math.max(...ents.map((r) => +r.e)));
          const rosterDays = (() => { let n = 0; ents.forEach((r) => { for (let x = new Date(r.s); x <= r.e; x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1)) if (isWork(x)) n++; }); return n; })();
          const days = hasFt ? (BAYDAYS[bays] || rosterDays) : rosterDays;
          let done = 0;
          if (today0 > s0) { const upto = new Date(Math.min(+today0 - 86400000, +e0)); ents.forEach((r) => { for (let x = new Date(r.s); x <= r.e && x <= upto; x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1)) if (isWork(x)) done++; }); }
          const todayWork = ents.some((r) => r.s <= today0 && today0 <= r.e) && isWork(today0);
          buildFireTrack(th, { bays, days: Math.max(days, 1), dayNo: Math.min(days, done + (todayWork ? 0.5 : 0)), walkers: crew, color: jobColor(ui.sel), reduce, aria: ui.sel + ' fire station progress', unit: hasFt ? 'Day' : 'Rostered day' });
        } else {
        let posUse = /anytime/i.test(ui.sel) ? 0 : sp.pos, hrPlan = 0;
        const hrow = (ok('job_hours') || []).find((x) => same(x.job, ui.sel) || (/iga/i.test(ui.sel) && /iga/i.test(x.job)));
        const zoneH = sh ? [+sh.rough_h || 0, +sh.fit_h || 0, 0, +sh.comm_h || 0] : [0, 0, 0, 0];
        if (sh && zoneH.reduce((t, v) => t + v, 0) > 0) {
          // Position from Simpro hours: stage estimates from the job, hours worked from the week view, then hours scheduled ahead.
          // Hours past the end of a stage carry into the next one, which shows as an overlap.
          const toPos = (h) => { let cum = 0; for (let k = 0; k < 4; k++) { if (zoneH[k] > 0 && h <= cum + zoneH[k]) return k + (h - cum) / zoneH[k]; cum += zoneH[k]; } return 4; };
          const used = +sh.used_h || 0, sched = hrow ? +hrow.sched_h || 0 : 0;
          posUse = toPos(used); hrPlan = sched ? toPos(used + sched) : 0;
        }
        const stg = ['Rough-in', 'Fit-off', 'Cut-out', 'Commissioning'];
        const stDone = (nm) => jobMs.some((x) => new RegExp('^stage:\\s*' + nm, 'i').test(x.milestone) && /done/i.test(x.status));
        let confirmed = 0; while (confirmed < 4 && stDone(stg[confirmed])) confirmed++;
        if (noSplit) { th.remove(); det.appendChild(mk('span', 'muted', 'The stage track is not shown because the Simpro hours for this job are not split by rough-in, fit-off or commissioning. Progress is the items above and the hours bar.')); }
        if (!noSplit) buildTrack(th, { plan: hrPlan, confirmed, complete: jobMs.some((x) => /^stage:\s*job complete/i.test(x.milestone) && /done/i.test(x.status)), pos: posUse, walkers: crew, color: jobColor(ui.sel), hours: hrs, reduce, aria: ui.sel + ' schedule position' });
        }
        if (!noSplit) det.appendChild(mk('span', 'muted', (/459 Little Collins/i.test(ui.sel) ? 'Ticks show what has been recorded as done on each level. Matt B stands at the first unfinished job.' : 'The marker shows where the roster and builder dates put this job today. A stage is only ticked once the crew say it is complete. Red stripes show scheduled time running past the end of a stage.') + (/459 Little Collins/i.test(ui.sel) ? '' : /^FS\d+/i.test(ui.sel) || /fire station/i.test(ui.sel) ? ' Fire stations are tracked by truck and by day: each truck gets connected to the extraction hose in turn. There is no rough-in, fit-off or commissioning.' : '')));
      } else {
        det.appendChild(mk('span', 'muted', 'No dates on the calendar for this job yet.'));
        // Progress for a job that is not scheduled yet: Simpro hours and what the crew have posted in Slack.
        const shU = (ok('stage_hours') || []).find((x) => same(x.job, ui.sel));
        const msU = (ok('milestones') || []).filter((x) => same(x.job, ui.sel));
        const eU = shU ? ['demo_h', 'rough_h', 'fit_h', 'comm_h', 'unsplit_h'].reduce((t, k) => t + (+shU[k] || 0), 0) : 0;
        const tkU = msU.filter((x) => /^task:/i.test(x.milestone)).map((x) => ({ label: String(x.milestone).replace(/^task:\s*/i, ''), status: x.status }));
        if (tkU.length) {
          det.appendChild(mk('span', 'muted', 'Site progress from the job channel'));
          const tw = mk('div', 'trackwrap'); det.appendChild(tw);
          buildSurveyTrack(tw, { items: tkU, walkers: [], color: jobColor(ui.sel), reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches, aria: ui.sel + ' site progress', unit: 'items' });
          det.appendChild(mk('span', 'muted', 'From the Slack job channel posts (last updated ' + (msU.map((x) => x.as_of).filter(Boolean).sort().pop() || '') + '). Nothing is scheduled for the rest yet.'));
        }
        if (shU && eU > 0) {
          const uU = +shU.used_h || 0, pcU = Math.round(uU / eU * 100);
          det.appendChild(mk('span', 'muted', 'Estimate from the Simpro job (' + shU.simpro + '): ' + eU + ' h. Hours used to date in Simpro (' + String(shU.basis).replace(/^.*file\s*/i, '').replace(/\s*\(.*/, '') + ', not yet split by stage): ' + uU + ' h (' + pcU + '%), ' + Math.max(0, eU - uU) + ' h left.'));
          const hbU = mk('div', 'daybar'); const hfU = document.createElement('i'); hfU.style.width = Math.min(100, pcU) + '%'; hfU.style.background = pcU > 100 ? '#e03131' : '#2b9348'; hbU.appendChild(hfU); det.appendChild(hbU);
        }
      }
      const w = wipFor(ui.sel);
      if (w) {
        det.appendChild(mk('span', 'muted', 'On the WIP'));
        det.appendChild(mk('span', '', w.this_month + '. Claim day: ' + w.claim_day + '. Program: ' + w.dates + '.'));
      }
    } else {
      det.appendChild(mk('span', 'muted', 'Click a job to see what we are doing on it.'));
    }
    const jd = mk('details', 'jobinfo');
    jd.appendChild(mk('summary', '', 'Job information'));
    jd.appendChild(list);
    jd.appendChild(det);
    jd.open = !!ui.jobOpen || !!ui.sel;
    jd.addEventListener('toggle', () => { ui.jobOpen = jd.open; });
    body.appendChild(jd);
  }
  render();
});

dash.start(['stage_hours','programs','guideline','crew','fantech','cal_events','wip_nov','milestones','finished','job_hours','crew_off']);
