(function () {
  const HOL = ['2026-11-03','2026-12-25','2026-12-28','2027-01-01','2027-01-26'];
  const iso = (d) => d3.timeFormat('%Y-%m-%d')(d);
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const base = (j) => String(j).replace(/ L\d+$/, '');
  const fmt = d3.timeFormat('%a %-d %b');
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Hero: crew walking along a duct, fan spinning at the end
  const walk = document.getElementById('heroWalk');
  if (walk) {
    walk.innerHTML = CREW.map((n, i) => '<span class="hw" style="--d:' + (-i * 4.4) + 's">' + figSVG(n, 84) + '</span>').join('');
  }

  // Two on ladders lifting a duct section up to the hangers
  const f1 = document.getElementById('sceneF1'), f2 = document.getElementById('sceneF2');
  if (f1 && f2) { f1.innerHTML = figInner('Dan', { up: true }); f2.innerHTML = figInner('Tandy', { up: true }); }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tEl = document.getElementById('todayDate');
  if (tEl) tEl.textContent = d3.timeFormat('%A %-d %B %Y')(today);

  d3.csv('data/cal_events.csv?t=' + Date.now(), { cache: 'no-store' }).then((rows) => {
    const ev = rows.map((r) => ({ ...r, s: parse(r.start), e: parse(r.end), base: base(r.job) }));
    const on = (r, d) => r.s <= d && d <= r.e;
    const isWork = (d) => d.getDay() % 6 !== 0 && !HOL.includes(iso(d));

    // Today board
    const board = document.getElementById('todayBoard');
    if (board) {
      board.innerHTML = '';
      if (!isWork(today)) board.appendChild(el('p', 'banner', HOL.includes(iso(today)) ? 'Public holiday today. Roster is off.' : 'Weekend. Only Saturday work shows below.'));
      const sat = today.getDay() === 6 || today.getDay() === 0;
      CREW.forEach((n) => {
        const jobs = [...new Set(ev.filter((r) => r.kind !== 'claim' && on(r, today) && crewOf(r).includes(n)).map((r) => r.base))];
        const row = el('div', 'tb');
        row.innerHTML = faceSVG(n, 40) + '<div><b>' + esc(n) + '</b><span>' +
          (jobs.length ? jobs.map((j) => '<i class="dot" style="background:' + jobColor(j) + '"></i>' + esc(j)).join('<br>') : (isWork(today) || sat ? 'Not on the roster today' : 'Off')) + '</span></div>';
        board.appendChild(row);
      });
    }

    // Coming up
    const up = document.getElementById('comingUp');
    if (up) {
      const next = ev.filter((r) => r.kind !== 'claim' && r.e >= today).sort((a, b) => a.s - b.s || a.e - b.e).slice(0, 6);
      up.innerHTML = '';
      next.forEach((r) => {
        const when = +r.s <= +today ? 'On now' : fmt(r.s);
        const li = el('li', '', '<i class="dot" style="background:' + jobColor(r.base) + '"></i><b>' + esc(r.job) + '</b><span>' + esc(r.label) + '</span><em>' + when + '</em>');
        up.appendChild(li);
      });
      if (!next.length) up.appendChild(el('li', '', '<span>Nothing dated from today.</span>'));
    }

    // Month cards: job counts and the colour dots of the jobs in that month
    [['cardNov', 2026, 10], ['cardDec', 2026, 11], ['cardJan', 2027, 0]].forEach(([id, y, m]) => {
      const c = document.getElementById(id); if (!c) return;
      const a = new Date(y, m, 1), z = new Date(y, m + 1, 0);
      const jobs = [...new Set(ev.filter((r) => r.kind !== 'claim' && r.s <= z && r.e >= a).map((r) => r.base))];
      c.querySelector('.cnt').textContent = jobs.length + (jobs.length === 1 ? ' job' : ' jobs');
      c.querySelector('.dots').innerHTML = jobs.slice(0, 14).map((j) => '<i class="dot" title="' + esc(j) + '" style="background:' + jobColor(j) + '"></i>').join('');
    });
  }).catch(() => {});

  // Finished jobs: celebration scene and the points chart
  d3.csv('data/finished.csv?t=' + Date.now(), { cache: 'no-store' }).then((rows) => {
    const box = document.getElementById('finishedJobs'), lb = document.getElementById('leaderboard');
    if (!box || !lb) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pool = ['Tandy', 'Dan', 'Urv', 'Matt B', 'Dan B', 'Kei'];
    box.innerHTML = '';
    rows.forEach((r) => {
      const p = pointsFor(r.est_h, r.actual_h), within = p === 5, pct = r.est_h && r.actual_h ? Math.round(+r.actual_h / +r.est_h * 100) : null;
      const card = el('div', 'fj');
      const col = p === 5 ? '#2b9348' : p === 3 ? '#f08c00' : '#e03131';
      card.innerHTML = '<b>' + esc(r.job) + '</b><span>' + (r.finished ? 'Finished ' + fmt(parse(r.finished)) : 'Finish date not recorded') + ' · ' +
        (pct !== null ? esc(r.actual_h) + ' of ' + esc(r.est_h) + ' h (' + pct + '%)' : 'hours not recorded') + '</span>' +
        '<span>' + (r.completed_by ? 'Completed by ' + esc(r.completed_by) : 'Completed by: not recorded yet, so no points') +
        (p !== null && r.completed_by ? ' <i class="pt" style="background:' + col + '">' + p + ' pts</i>' : '') + '</span>';
      const sc = el('div'); card.appendChild(sc);
      buildCelebration(sc, { name: r.completed_by, within: within && !!r.completed_by, others: pool, reduce, aria: r.job + ' finished' });
      if (r.note) card.appendChild(el('span', 'muted', esc(r.note)));
      box.appendChild(card);
    });
    if (!rows.length) box.textContent = 'No finished jobs recorded yet.';
    buildLeaderboard(lb, rows, CREW.filter((n) => !/^Labour|^Dan B$|^Jonte$/.test(n)));
    document.getElementById('ptsNote').textContent = 'Points: finishing at or under the estimated hours is 5. Over the hours, up to 50% over, is 3. 50% or more over is 1. Points add up job by job. Hours are the estimated and used hours in Simpro for each job.';
    const fn = document.getElementById('finNote'); if (fn) fn.textContent = 'On hours: the finisher sits back with a drink while everyone applauds. Over hours: just the applause.';
  }).catch(() => {});
})();
