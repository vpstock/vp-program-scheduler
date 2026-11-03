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
    walk.innerHTML = CREW.map((n, i) => '<span class="hw" style="animation-delay:' + (-i * 3.2) + 's">' + faceSVG(n, 44) + '</span>').join('');
  }

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
})();
