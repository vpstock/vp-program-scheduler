

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
const HOL = ['2026-11-03','2026-12-25','2026-12-28','2027-01-01','2027-01-26','2027-03-08','2027-03-26','2027-03-29'];
const isWork = (d) => d.getDay() !== 0 && d.getDay() !== 6 && !HOL.includes(isoD(d));
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
const MONTHS = [[2026, 10], [2026, 11], [2027, 0]];
const ui = { person: null, m: null, kinds: new Set(Object.keys(KIND)), job: 'all', sel: null };
const baseJob = (j) => String(j).replace(/ L\d+$/, '');
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const shortD = d3.timeFormat('%a %-d %b');

dash.draw('calendar', (el) => {
  const ev = ok('cal_events');
  if (!ev) { el.textContent = '—'; return; }
  // Drag to move: a moved item is stored as a number of days to shift it, in this browser only (the CSV is not changed).
  const MOVE_KEY = 'vp-sched-moves-v1';
  let moves = {};
  try { moves = JSON.parse(localStorage.getItem(MOVE_KEY) || '{}') || {}; } catch (e) { moves = {}; }
  const saveMoves = () => { try { localStorage.setItem(MOVE_KEY, JSON.stringify(moves)); } catch (e) { /* storage blocked: moves last until refresh */ } };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const mkey = (r) => [r.job, r.label, r.start, r.end].join('|');
  const items = ev.map((r, i) => {
    const s0 = parseD(r.start), e0 = parseD(r.end), k = mkey(r), dd = Number(moves[k]) || 0;
    return { ...r, i, key: k, moved: dd, s: addDays(s0, dd), e: addDays(e0, dd), base: baseJob(r.job) };
  });
  let dragRef = null;
  if (ui.m === null) {
    const now = new Date();
    const idx = MONTHS.findIndex(([y, m]) => now.getFullYear() === y && now.getMonth() === m);
    ui.m = idx >= 0 ? idx : 0;
  }
  const vis = (r) => (ui.kinds.has(r.kind) || (ui.kinds.has('fantech') && /^FS\d+/i.test(r.job))) && (ui.job === 'all' || r.base === ui.job) && (!ui.person || crewOf(r).includes(ui.person));
  const inMonth = (r, mi) => { const [y, m] = MONTHS[mi]; return r.s <= new Date(y, m + 1, 0) && r.e >= new Date(y, m, 1); };

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
      b.onclick = () => { ui.person = ui.person === n ? null : n; ui.sel = null; render(); };
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

    // Moved items banner
    const nMoved = items.filter((r) => r.moved).length;
    const tip = mk('div', 'movebar');
    tip.append(mk('span', 'muted', nMoved ? nMoved + ' item' + (nMoved === 1 ? '' : 's') + ' moved from the schedule. Moves are saved in this browser only.' : 'Drag any item to another day to move it. Moves are saved in this browser only and do not change the Schedule Calendar.'));
    if (nMoved) {
      const rs = mk('button', 'clr', 'Put everything back'); rs.type = 'button';
      rs.onclick = () => { moves = {}; saveMoves(); items.forEach((r) => { r.moved = 0; r.s = parseD(r.start); r.e = parseD(r.end); }); render(); };
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
        if (inM && HOL.includes(isoD(day))) cell.appendChild(mk('span', 'hol', 'Public holiday'));
        if (inM) {
          items.filter(vis).forEach((r) => {
            if (day < r.s || day > r.e) return;
            const single = isoD(r.s) === isoD(r.e);
            if (!single && !isWork(day)) return;
            const kd = KIND[r.kind] || { c: 'var(--color-fg-muted)', dash: true };
            const c = mk('button', 'chip' + (kd.dash ? ' dash' : '') + (picked && picked.base === r.base ? ' hl' : ''), r.kind === 'claim' ? r.label : r.job + ' · ' + r.label);
            c.type = 'button';
            c.style.setProperty('--k', jobColor(r.base));
            c.style.setProperty('--kc', kd.c);
            const crew = crewOf(r);
            if (crew.length) { c.textContent = ''; c.insertAdjacentHTML('afterbegin', crew.map((n) => faceSVG(n, 16)).join('') + ' '); c.append(r.kind === 'claim' ? r.label : r.job + ' · ' + r.label); }
            c.insertAdjacentHTML('beforeend', '<i class="kd"></i>');
            c.title = r.job + ': ' + r.label;
            c.onclick = () => { ui.sel = ui.sel === r.base ? null : r.base; render(); };
            if (r.kind !== 'claim') {
              c.draggable = true;
              if (r.moved) { c.classList.add('moved'); c.title += ' (moved ' + (r.moved > 0 ? '+' : '') + r.moved + ' d from the schedule)'; }
              c.ondragstart = (ev2) => { dragRef = { r, from: dHere }; c.classList.add('dragging'); try { ev2.dataTransfer.effectAllowed = 'move'; ev2.dataTransfer.setData('text/plain', r.job); } catch (e) { /* ignore */ } };
              c.ondragend = () => { c.classList.remove('dragging'); dragRef = null; };
            }
            cell.appendChild(c);
          });
        }
        if (inM) {
          const here = new Date(day);
          cell.ondragover = (e2) => { if (dragRef) { e2.preventDefault(); cell.classList.add('dropok'); } };
          cell.ondragleave = () => cell.classList.remove('dropok');
          cell.ondrop = (e2) => {
            e2.preventDefault(); cell.classList.remove('dropok');
            if (!dragRef) return;
            const delta = Math.round((here - dragRef.from) / 86400000);
            if (delta) {
              const r0 = dragRef.r, cur = Number(moves[r0.key]) || 0, nv = cur + delta;
              if (nv === 0) delete moves[r0.key]; else moves[r0.key] = nv;
              saveMoves(); r0.moved = nv; r0.s = addDays(r0.s, delta); r0.e = addDays(r0.e, delta);
            }
            dragRef = null; render();
          };
        }
        row.appendChild(cell);
        day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
      }
      cal.appendChild(row);
    }
    wrap.appendChild(cal); body.appendChild(wrap);

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
          line.append(mk('span', 'pill' + (st === 'Now' ? ' ok' : st === 'Next' ? ' warn' : ''), st),
            mk('span', '', ' ' + r.label + ', ' + range(r) + '. ' + r.note));
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
          det.appendChild(mk('span', 'muted', 'Estimate from the Simpro job (' + sh.simpro + '): ' + e + ' h. Actual hours worked to date from the Simpro week view: ' + u + ' h (' + pc + '%), ' + Math.max(0, e - u) + ' h left' + (sc ? '. Scheduled ahead in the week view: ' + sc + ' h' : '') + '.'));
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
        const isSmall = !isFire && !isLC && !!sh && (+sh.demo_h || 0) + (+sh.rough_h || 0) + (+sh.fit_h || 0) + (+sh.comm_h || 0) === 0 && (+sh.unsplit_h || 0) > 0 && (+sh.unsplit_h || 0) <= 40;
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
          det.appendChild(mk('span', 'muted', 'Small job, so there are no rough-in, fit-off or commissioning stages. ' + (tot ? dn + ' of ' + tot + ' rostered ' + (tot === 1 ? 'day' : 'days') + ' done.' : 'No rostered days yet.')));
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
        buildTrack(th, { plan: hrPlan, confirmed, complete: jobMs.some((x) => /^stage:\s*job complete/i.test(x.milestone) && /done/i.test(x.status)), pos: posUse, walkers: crew, color: jobColor(ui.sel), hours: hrs, reduce, aria: ui.sel + ' schedule position' });
        }
        det.appendChild(mk('span', 'muted', (/459 Little Collins/i.test(ui.sel) ? 'Ticks show what has been recorded as done on each level. Matt B stands at the first unfinished job.' : 'The marker shows where the roster and builder dates put this job today. A stage is only ticked once the crew say it is complete. Red stripes show scheduled time running past the end of a stage.') + (/459 Little Collins/i.test(ui.sel) ? '' : /^FS\d+/i.test(ui.sel) || /fire station/i.test(ui.sel) ? ' Fire stations are tracked by truck and by day: each truck gets connected to the extraction hose in turn. There is no rough-in, fit-off or commissioning.' : '')));
      } else {
        det.appendChild(mk('span', 'muted', 'No dates on the calendar for this job yet.'));
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

dash.start(['stage_hours','programs','guideline','crew','fantech','cal_events','wip_nov','milestones','finished','job_hours']);
