(function () {
  const HOL = ['2026-11-03','2026-12-25','2026-12-28','2027-01-01','2027-01-26','2027-03-08','2027-03-26','2027-03-29','2027-06-14'];
  const iso = (d) => d3.timeFormat('%Y-%m-%d')(d);
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const base = (j) => String(j).replace(/ L\d+$/, '');
  const fmt = d3.timeFormat('%a %-d %b');
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Banner: the walking crew has been taken off. The ladder scene and the fan stay.

  // Two on ladders lifting a duct section up to the hangers
  const f1 = document.getElementById('sceneF1'), f2 = document.getElementById('sceneF2');
  if (f1 && f2) { f1.innerHTML = figInner('Dan', { up: true }); f2.innerHTML = figInner('Tandy', { up: true }); }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tEl = document.getElementById('todayDate');
  if (tEl) tEl.textContent = d3.timeFormat('%A %-d %B %Y')(today);

  Promise.resolve(window.vpSyncReady).catch(() => {}).then(() => d3.csv('data/cal_events.csv?t=' + Date.now(), { cache: 'no-store' })).then((rows) => {
    let moves = {};
    try { moves = JSON.parse(localStorage.getItem('vp-sched-edits-v1') || '{}') || {}; } catch (e) { moves = {}; }
    const ev = rows.filter((r) => !(moves[[r.job, r.label, r.start, r.end].join('|')] || {}).deleted).map((r) => { const ed = moves[[r.job, r.label, r.start, r.end].join('|')] || {}; return { ...r, s: parse(ed.start || r.start), e: parse(ed.end || r.end), status: ed.status || '', base: base(r.job) }; });
    try {
      JSON.parse(localStorage.getItem('vp-sched-crew-v1') || '[]').forEach((m) => ev.push({ job: m.job, label: 'Crew added: ' + m.person, kind: 'roster', note: m.person, s: parse(m.date), e: parse(m.date), base: m.job }));
    } catch (e) { /* no stored crew moves */ }
    const on = (r, d) => r.s <= d && d <= r.e;
    const inBreak = (d) => { const s = iso(d); return s >= '2026-12-23' && s <= '2027-01-05'; };
    const isWork = (d) => d.getDay() % 6 !== 0 && !HOL.includes(iso(d)) && !inBreak(d);

    // Overlap alert: the same person on two jobs on the same working day, from today on
    let exL = []; try { exL = JSON.parse(localStorage.getItem('vp-sched-crewx-v1') || '[]') || []; } catch (e) { exL = []; }
    const alertBox = document.getElementById('clashAlert');
    if (alertBox) {
      const cl = findClashes(ev, isWork, (p, base, d) => exL.some((x) => x.person === p && x.job === base && x.date === iso(d))).filter((c) => c.date >= today);
      if (cl.length) {
        const nMoved = Object.keys(moves).length;
        alertBox.hidden = false;
        alertBox.innerHTML = '<h2>Overlap warning: ' + cl.length + (cl.length === 1 ? ' double booking' : ' double bookings') + '</h2><ul>' +
          cl.slice(0, 8).map((c) => '<li><b>' + esc(c.person) + '</b> is on ' + c.jobs.map(esc).join(' and ') + ' on ' + fmt(c.date) + '</li>').join('') + '</ul>' +
          '<p class="muted">' + (cl.length > 8 ? (cl.length - 8) + ' more on the calendar. ' : '') + 'One person cannot be on two jobs at once, so one of these needs to move.' + (nMoved ? ' This includes ' + nMoved + (nMoved === 1 ? ' item' : ' items') + ' you moved on the calendar.' : '') + '</p>';
      } else alertBox.hidden = true;
    }

    // Today board
    const board = document.getElementById('todayBoard');
    if (board) {
      board.innerHTML = '';
      if (!isWork(today)) board.appendChild(el('p', 'banner', inBreak(today) ? 'Christmas break. Back Wed 6 Jan.' : HOL.includes(iso(today)) ? 'Public holiday today. Roster is off.' : 'Weekend. Only Saturday work shows below.'));
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
    [['cardNov', 2026, 10], ['cardDec', 2026, 11], ['cardJan', 2027, 0], ['cardFebruary', 2027, 1], ['cardMarch', 2027, 2], ['cardApril', 2027, 3], ['cardMay', 2027, 4], ['cardJune', 2027, 5]].forEach(([id, y, m]) => {
      const c = document.getElementById(id); if (!c) return;
      const a = new Date(y, m, 1), z = new Date(y, m + 1, 0);
      const jobs = [...new Set(ev.filter((r) => r.kind !== 'claim' && r.s <= z && r.e >= a).map((r) => r.base))];
      c.querySelector('.cnt').textContent = jobs.length + (jobs.length === 1 ? ' job' : ' jobs');
      c.querySelector('.dots').innerHTML = jobs.slice(0, 14).map((j) => '<i class="dot" title="' + esc(j) + '" style="background:' + jobColor(j) + '"></i>').join('');
    });
  }).catch(() => {});

  // Finished jobs: celebration scene and the points chart
  d3.csv('data/finished.csv?t=' + Date.now(), { cache: 'no-store' }).then((rows) => {
    const lb = document.getElementById('leaderboard');
    if (!lb) return;
    buildLeaderboard(lb, rows.filter((r) => !/^FS\d/i.test(r.job) && r.est_h), CREW.filter((n) => !/^Labour|^Dan B$|^Jonte$/.test(n)));
    document.getElementById('ptsNote').textContent = 'Points: finishing at or under the estimated hours is 5. Over the hours, up to 50% over, is 3. 50% or more over is 1. Points add up job by job, on project jobs only. Fire stations and small jobs are not scored. Hours are the estimated and used hours in Simpro for each job.';
  }).catch(() => {});
})();
