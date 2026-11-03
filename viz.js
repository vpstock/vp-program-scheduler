/* Job colours, crew faces and the HVAC progress track. Plain JS, no libraries. */
(function () {
  const PAL = ['#0b4fd4','#e8590c','#2b9348','#9c36b5','#d6336c','#0c8599','#d9a400','#5f3dc4','#c92a2a','#66a80f','#7048e8','#099268','#a61e4d','#1c7ed6'];
  const used = {};
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  window.jobColor = (name) => {
    if (name === 'Progress claims') return '#2b9348';
    if (used[name]) return used[name];
    const taken = new Set(Object.values(used));
    let i = hash(name) % PAL.length;
    for (let k = 0; k < PAL.length && taken.has(PAL[i]); k++) i = (i + 1) % PAL.length;
    return (used[name] = PAL[i]);
  };

  const PEOPLE = {
    Urv:   { full: 'Urv', bg: '#dbe7ff', skin: '#b9825a', shirt: '#f59f00', hair: '<path d="M10.5 15Q11 6 20 6Q29 6 29.5 15Q25 11 20 11Q15 11 10.5 15Z" fill="#1b1b1f"/>' },
    Kei:   { full: 'Kei', bg: '#e3f6ee', skin: '#f0c8a0', shirt: '#0a1a4d', hair: '<path d="M10.5 17Q10.5 9 20 9Q29.5 9 29.5 17Q27 12 20 12Q14 12 10.5 17Z" fill="#6b4423"/><path d="M9.5 14Q9.5 3.5 20 3.5Q30.5 3.5 30.5 14Z" fill="#f1f3f5" stroke="#ced4da" stroke-width=".6"/><rect x="7.5" y="13" width="25" height="3" rx="1.5" fill="#f1f3f5" stroke="#ced4da" stroke-width=".6"/>' },
    Dan:   { full: 'Dan', bg: '#fff1d6', skin: '#e3b08a', shirt: '#f76707', beard: true, hair: '<path d="M9.5 14Q9.5 3.5 20 3.5Q30.5 3.5 30.5 14Z" fill="#fab005" stroke="#c98a00" stroke-width=".6"/><rect x="7.5" y="13" width="25" height="3" rx="1.5" fill="#fab005" stroke="#c98a00" stroke-width=".6"/>' },
    Tandy: { full: 'Tandy', bg: '#ece7ff', skin: '#f6d5b8', shirt: '#2f9e44', hair: '<path d="M10 14Q10 4.5 20 4.5Q30 4.5 30 14Z" fill="#364fc7"/><rect x="9.5" y="12" width="21" height="4.5" rx="2.2" fill="#4c6ef5"/><circle cx="20" cy="3.5" r="2" fill="#4c6ef5"/>' },
    'Matt B': { full: 'Matt B', bg: '#e1f5fd', skin: '#d6a279', shirt: '#ffffff', stubble: true, hair: '<path d="M10 14Q10 5.5 20 5.5Q30 5.5 30 14Z" fill="#0b4fd4"/><rect x="17" y="12.2" width="17" height="3" rx="1.5" fill="#0a3fa8"/>' }
  };
  const GENERIC = { bg: '#e8ecf3', skin: '#c9d1dd', shirt: '#868e96', hair: '' };
  window.CREW = Object.keys(PEOPLE);
  const inner = (p) =>
    '<defs><clipPath id="fclip"><circle cx="20" cy="20" r="20"/></clipPath></defs><g clip-path="url(#fclip)">' +
    '<rect width="40" height="40" fill="' + p.bg + '"/>' +
    '<path d="M5 41Q5 29 20 29Q35 29 35 41Z" fill="' + p.shirt + '"/>' +
    (p.shirt === '#f59f00' || p.shirt === '#f76707' ? '<path d="M13 41L15 30M27 41L25 30" stroke="#e9ecef" stroke-width="2"/>' : '') +
    '<rect x="16" y="24" width="8" height="7" fill="' + p.skin + '"/><rect x="16" y="26" width="8" height="2" fill="#000" opacity=".12"/>' +
    '<circle cx="10.6" cy="19" r="2.2" fill="' + p.skin + '"/><circle cx="29.4" cy="19" r="2.2" fill="' + p.skin + '"/>' +
    '<ellipse cx="20" cy="18" rx="9.6" ry="11" fill="' + p.skin + '"/>' +
    (p.stubble ? '<path d="M11 21Q12 29 20 29Q28 29 29 21Q25 26 20 26Q15 26 11 21Z" fill="#000" opacity=".16"/>' : '') +
    (p.beard ? '<path d="M10.8 19.5Q10.5 31 20 31Q29.5 31 29.2 19.5Q27 26.5 20 26.5Q13 26.5 10.8 19.5Z" fill="#adb5bd"/><path d="M16 23.4Q20 22 24 23.4" stroke="#868e96" stroke-width="1.6" fill="none" stroke-linecap="round"/>' : '') +
    '<circle cx="16.3" cy="18" r="1.3" fill="#14181e"/><circle cx="23.7" cy="18" r="1.3" fill="#14181e"/>' +
    '<path d="M16.6 22.2Q20 25.2 23.4 22.2" stroke="' + (p.beard ? '#fff' : '#14181e') + '" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
    p.hair + '</g><circle cx="20" cy="20" r="19.4" fill="none" stroke="#0a1a4d" stroke-opacity=".35"/>';

  // Head only (no round avatar background): ears, face, beard or stubble, eyes, smile and hat or hair
  const headParts = (p) =>
    '<circle cx="10.6" cy="19" r="2.2" fill="' + p.skin + '"/><circle cx="29.4" cy="19" r="2.2" fill="' + p.skin + '"/>' +
    '<ellipse cx="20" cy="18" rx="9.6" ry="11" fill="' + p.skin + '"/>' +
    (p.stubble ? '<path d="M11 21Q12 29 20 29Q28 29 29 21Q25 26 20 26Q15 26 11 21Z" fill="#000" opacity=".16"/>' : '') +
    (p.beard ? '<path d="M10.8 19.5Q10.5 31 20 31Q29.5 31 29.2 19.5Q27 26.5 20 26.5Q13 26.5 10.8 19.5Z" fill="#adb5bd"/><path d="M16 23.4Q20 22 24 23.4" stroke="#868e96" stroke-width="1.6" fill="none" stroke-linecap="round"/>' : '') +
    '<circle cx="16.3" cy="18" r="1.3" fill="#14181e"/><circle cx="23.7" cy="18" r="1.3" fill="#14181e"/>' +
    '<path d="M16.6 22.2Q20 25.2 23.4 22.2" stroke="' + (p.beard ? '#fff' : '#14181e') + '" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
    p.hair;
  window.headInner = (name) => headParts(PEOPLE[name] || GENERIC);
  window.faceInner = (name) => inner(PEOPLE[name] || GENERIC);
  window.faceSVG = (name, px) => '<svg class="face" viewBox="0 0 40 40" width="' + px + '" height="' + px + '" role="img" aria-label="' + name + '">' + faceInner(name) + '</svg>';

  const TOOLS = {
    Urv: '<rect x="19" y="-35" width="17" height="9" rx="2.5" fill="#f08c00" stroke="#14181e" stroke-width="1"/><rect x="22" y="-28" width="5.5" height="11" rx="1.5" fill="#14181e"/><path d="M36 -30.5H42" stroke="#adb5bd" stroke-width="2.4" stroke-linecap="round"/>',
    Kei: '<rect x="18" y="-43" width="15" height="20" rx="2" fill="#14181e" stroke="#adb5bd" stroke-width="1"/><rect x="20" y="-41" width="11" height="15" rx="1" fill="#9fdcff"/><path d="M22 -37H29M22 -33H29M22 -29H27" stroke="#0a4fd4" stroke-width="1.2"/>',
    Dan: '<path d="M21 -25L34 -45" stroke="#868e96" stroke-width="3.4" stroke-linecap="round"/><circle cx="35" cy="-47" r="5.5" fill="none" stroke="#868e96" stroke-width="3.4"/><path d="M33 -52L38 -45" stroke="#e9ecef" stroke-width="3"/>',
    Tandy: '<circle cx="25" cy="-23" r="7.5" fill="#fab005" stroke="#14181e" stroke-width="1.2"/><circle cx="25" cy="-23" r="2.6" fill="#14181e"/><path d="M31 -20H38" stroke="#14181e" stroke-width="2" stroke-linecap="round"/><rect x="36" y="-23" width="4" height="6" rx="1" fill="#14181e"/>',
    'Matt B': '<rect x="19" y="-37" width="14" height="18" rx="2.5" fill="#f76707" stroke="#14181e" stroke-width="1"/><rect x="21" y="-35" width="10" height="6" rx="1" fill="#d3f9d8"/><circle cx="26" cy="-23" r="3" fill="#14181e"/><path d="M26 -37V-44" stroke="#14181e" stroke-width="2"/>'
  };
  const GENERIC_TOOL = '<rect x="19" y="-30" width="12" height="8" rx="2" fill="#868e96"/>';
  // Whole figure: boots at y 0, head about 80 up. Left arm swings, right hand holds the tool.
  window.figInner = (name) => {
    const p = PEOPLE[name] || GENERIC, sk = p.skin, sh = p.shirt;
    const hv = sh === '#f59f00' || sh === '#f76707';
    return '<g class="figure">' +
      '<g class="leg l1"><path d="M-5.5 -18V-3" stroke="#0a1a4d" stroke-width="6.5" stroke-linecap="round"/><rect x="-10" y="-5" width="10.5" height="5.5" rx="2.5" fill="#3b2a1a"/></g>' +
      '<g class="leg l2"><path d="M5.5 -18V-3" stroke="#0a1a4d" stroke-width="6.5" stroke-linecap="round"/><rect x="-0.5" y="-5" width="10.5" height="5.5" rx="2.5" fill="#3b2a1a"/></g>' +
      '<g class="arm"><path d="M-11 -39L-16 -22" stroke="' + sh + '" stroke-width="6" stroke-linecap="round"/><circle cx="-16.5" cy="-19.5" r="3.4" fill="' + sk + '"/></g>' +
      '<rect x="-12.5" y="-46" width="25" height="31" rx="8" fill="' + sh + '" stroke="#0a1a4d" stroke-width="1.4"/>' +
      (hv ? '<path d="M-12 -30H12M-12 -24H12" stroke="#e9ecef" stroke-width="2.2"/>' : '<rect x="-12.5" y="-20" width="25" height="5" rx="2" fill="#0a1a4d" fill-opacity=".25"/>') +
      '<rect x="-12.5" y="-17" width="25" height="4" fill="#0a1a4d" fill-opacity=".35"/>' +
      '<g class="rarm"><path d="M11 -39L20 -26" stroke="' + sh + '" stroke-width="6" stroke-linecap="round"/>' + (TOOLS[name] || GENERIC_TOOL) + '<circle cx="21" cy="-25" r="3.6" fill="' + sk + '"/></g>' +
      '<rect x="-4" y="-51" width="8" height="8" rx="2" fill="' + sk + '"/><rect x="-4" y="-47" width="8" height="2" fill="#000" opacity=".12"/>' +
      '<g transform="translate(-22,-80) scale(1.1)">' + headInner(name) + '</g>' +
      '</g>';
  };
  window.figSVG = (name, h) => '<svg class="fig" viewBox="-26 -90 70 92" height="' + h + '" width="' + Math.round(h * 70 / 92) + '" role="img" aria-label="' + name + '">' + figInner(name) + '</svg>';
  window.crewOf = (r) => {
    const t = (r.label || '') + ' ' + (r.note || '');
    const out = [];
    if (/\bUrv\b/.test(t)) out.push('Urv');
    if (/\bKei\b/.test(t)) out.push('Kei');
    if (/\bDan\b(?! B)/.test(t)) out.push('Dan');
    if (/\bTandy\b/.test(t)) out.push('Tandy');
    if (/\bMatt B\b/.test(t)) out.push('Matt B');
    return out;
  };

  /* ---- HVAC progress track ---- */
  const STAGES = ['Rough-in', 'Fit-off', 'Cut-out', 'Commissioning'];
  const stageRange = (r) => {
    const t = ((r.label || '') + ' ' + (r.note || '')).toLowerCase(), hit = [];
    if (/rough/.test(t)) hit.push(0);
    if (/fit[- ]?off/.test(t)) hit.push(1);
    if (/cut[- ]?out/.test(t)) hit.push(2);
    if (/commission|practical completion/.test(t)) hit.push(3);
    return hit.length ? [Math.min(...hit), Math.max(...hit) + 1] : null;
  };
  const wd = (a, b, isWork) => { let n = 0; for (let d = new Date(a); d <= b; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) if (isWork(d)) n++; return n; };

  // Where the schedule says the job is today, 0 (not started) to 4 (finished)
  window.schedulePos = (ents, today, isWork) => {
    const withStage = ents.filter(stageRange);
    const frac = (r) => { const tot = wd(r.s, r.e, isWork) || 1; return Math.min(1, Math.max(0, wd(r.s, new Date(Math.min(+today, +r.e)), isWork) - (today < r.s ? 0 : 0)) / tot); };
    if (withStage.length) {
      const sorted = withStage.slice().sort((a, b) => a.s - b.s);
      const cur = sorted.find((r) => r.s <= today && today <= r.e);
      if (cur) { const [lo, hi] = stageRange(cur); return { pos: lo + (hi - lo) * frac(cur), active: [cur] }; }
      const past = sorted.filter((r) => r.e < today);
      if (!past.length) return { pos: stageRange(sorted[0])[0], active: [sorted[0]] };
      const last = past[past.length - 1], next = sorted.find((r) => r.s > today);
      return { pos: next ? Math.max(stageRange(last)[1], stageRange(next)[0]) : stageRange(last)[1], active: [next || last] };
    }
    const s0 = Math.min(...ents.map((r) => +r.s)), e0 = Math.max(...ents.map((r) => +r.e));
    const all = { s: new Date(s0), e: new Date(e0) };
    const cur = ents.filter((r) => r.s <= today && today <= r.e);
    const p = today < all.s ? 0 : today > all.e ? 4 : 4 * frac(all);
    const nearest = ents.slice().sort((a, b) => a.s - b.s).find((r) => r.e >= today) || ents[ents.length - 1];
    return { pos: p, active: cur.length ? cur : [nearest] };
  };

  const X0 = 20, ZW = 200, GY = 150;
  const zoneArt = [
    (cx) => '<g class="art"><rect x="' + (cx - 80) + '" y="40" width="160" height="6" fill="#8a97ab"/>' +
      '<path d="M' + (cx - 45) + ' 46V72M' + (cx + 45) + ' 46V72" stroke="#6b7688" stroke-width="3"/>' +
      '<rect x="' + (cx - 70) + '" y="72" width="140" height="32" rx="2" fill="#dfe6f1" stroke="#0a1a4d" stroke-width="2"/>' +
      '<path d="M' + (cx - 23) + ' 72V104M' + (cx + 23) + ' 72V104" stroke="#0a1a4d" stroke-width="2"/>' +
      '<path d="M' + (cx - 70) + ' 114H' + (cx + 70) + 'M' + (cx - 70) + ' 120H' + (cx + 70) + '" stroke="#c8641c" stroke-width="4" stroke-linecap="round"/></g>',
    (cx) => '<g class="art"><rect x="' + (cx - 90) + '" y="40" width="180" height="6" fill="#8a97ab"/>' +
      '<rect x="' + (cx - 78) + '" y="46" width="60" height="12" fill="#fff" stroke="#0a1a4d" stroke-width="2"/>' +
      '<path d="M' + (cx - 66) + ' 46V58M' + (cx - 54) + ' 46V58M' + (cx - 42) + ' 46V58M' + (cx - 30) + ' 46V58" stroke="#0a1a4d"/>' +
      '<path class="air" d="M' + (cx - 66) + ' 68q6 8 0 16M' + (cx - 48) + ' 68q6 8 0 16M' + (cx - 30) + ' 68q6 8 0 16" stroke="#12aef4" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
      '<rect x="' + (cx + 8) + '" y="62" width="82" height="28" rx="6" fill="#fff" stroke="#0a1a4d" stroke-width="2"/>' +
      '<path d="M' + (cx + 16) + ' 80H' + (cx + 82) + '" stroke="#0a1a4d" stroke-width="2"/><circle cx="' + (cx + 80) + '" cy="72" r="2" fill="#12aef4"/>' +
      '<path class="air" d="M' + (cx + 24) + ' 98q6 8 0 16M' + (cx + 46) + ' 98q6 8 0 16M' + (cx + 68) + ' 98q6 8 0 16" stroke="#12aef4" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>',
    (cx) => '<g class="art"><rect x="' + (cx - 90) + '" y="40" width="40" height="30" fill="#fff" stroke="#8a97ab" stroke-width="2"/>' +
      '<rect x="' + (cx + 50) + '" y="40" width="40" height="30" fill="#fff" stroke="#8a97ab" stroke-width="2"/>' +
      '<rect x="' + (cx - 40) + '" y="40" width="80" height="30" fill="#0a1a4d" fill-opacity=".14" stroke="#0b4fd4" stroke-width="2" stroke-dasharray="6 4"/>' +
      '<path d="M' + (cx - 14) + ' 55H' + (cx + 14) + 'M' + (cx) + ' 46V64" stroke="#0b4fd4" stroke-width="2"/>' +
      '<g class="saw"><circle cx="' + cx + '" cy="104" r="14" fill="#dfe6f1" stroke="#0a1a4d" stroke-width="2"/><path d="M' + (cx - 14) + ' 104H' + (cx + 14) + 'M' + cx + ' 90V118" stroke="#0a1a4d" stroke-width="2"/><circle cx="' + cx + '" cy="104" r="3" fill="#0a1a4d"/></g></g>',
    (cx) => '<g class="art"><circle cx="' + (cx - 50) + '" cy="90" r="24" fill="#fff" stroke="#0a1a4d" stroke-width="3"/>' +
      '<path d="M' + (cx - 68) + ' 100A24 24 0 0 1 ' + (cx - 32) + ' 100" stroke="#e03131" stroke-width="3" fill="none"/>' +
      '<path d="M' + (cx - 68) + ' 80A24 24 0 0 1 ' + (cx - 50) + ' 66" stroke="#2b9348" stroke-width="3" fill="none"/>' +
      '<g class="needle"><path d="M' + (cx - 50) + ' 90L' + (cx - 38) + ' 76" stroke="#14181e" stroke-width="2.5" stroke-linecap="round"/></g><circle cx="' + (cx - 50) + '" cy="90" r="3" fill="#14181e"/>' +
      '<rect x="' + (cx + 8) + '" y="62" width="76" height="64" rx="5" fill="#eef3ff" stroke="#0a1a4d" stroke-width="3"/>' +
      '<g class="fan"><circle cx="' + (cx + 46) + '" cy="92" r="22" fill="#fff" stroke="#0a1a4d" stroke-width="2"/><path d="M' + (cx + 46) + ' 92L' + (cx + 46) + ' 72M' + (cx + 46) + ' 92L' + (cx + 63) + ' 102M' + (cx + 46) + ' 92L' + (cx + 29) + ' 102" stroke="#0b4fd4" stroke-width="5" stroke-linecap="round"/></g></g>'
  ];

  const walkersSvg = (opts, W, px, pos) => {
    let s = '';
    const n = opts.walkers.length;
    opts.walkers.forEach((name, i) => {
      const off = (i - (n - 1) / 2) * 48;
      const x = Math.min(W - 40, Math.max(X0 + 16, px + off));
      s += '<g class="walker" data-x="' + x + '" style="transform:translate(' + (opts.reduce ? x : X0 + 16) + 'px,' + (opts.gy || GY) + 'px)">' +
        '<g class="bob">' + figInner(name) + '</g>' +
        (opts.noNames ? '' : '<text y="' + (i % 2 ? 50 : 38) + '" text-anchor="middle" class="wn">' + name + '</text>') + '</g>';
    });
    if (!n) s += '<g class="walker" data-x="' + Math.max(X0 + 16, px) + '" style="transform:translate(' + (opts.reduce ? Math.max(X0 + 16, px) : X0 + 16) + 'px,' + (opts.gy || GY) + 'px)"><g class="bob"><rect x="-11" y="-30" width="22" height="18" rx="6" fill="#adb5bd"/><path d="M-14 -34Q-14 -52 0 -52Q14 -52 14 -34Z" fill="#fab005" stroke="#c98a00" stroke-width="1.5"/><rect x="-17" y="-36" width="34" height="5" rx="2.5" fill="#fab005" stroke="#c98a00" stroke-width="1.5"/></g><text y="38" text-anchor="middle" class="wn">Crew not rostered</text></g>';
    return s;
  };

  window.buildTrack = function (host, opts) {
    // opts: {pos, walkers:[names], label, hours:[r,f,_,c], done, color, reduce}
    const W = X0 * 2 + ZW * 4, pos = Math.min(4, Math.max(0, opts.pos));
    const px = (p) => X0 + p * ZW;
    let s = '<svg class="track" viewBox="0 0 ' + W + ' 215" role="img" aria-label="' + (opts.aria || 'Job progress') + '">' +
      '<defs><pattern id="bp" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#c9daf8" stroke-width="1"/></pattern></defs>' +
      '<rect width="' + W + '" height="215" rx="10" fill="#eaf2ff"/><rect width="' + W + '" height="215" rx="10" fill="url(#bp)"/>';
    for (let i = 0; i < 4; i++) {
      const x = X0 + i * ZW, cur = pos >= i && pos < i + 1 && pos < 4, dn = pos >= i + 1;
      if (cur) s += '<rect class="zcur" x="' + x + '" y="12" width="' + ZW + '" height="150" fill="' + opts.color + '" fill-opacity=".12"/>';
      s += '<g class="zone' + (dn ? ' done' : cur ? ' cur' : ' todo') + '">' + zoneArt[i](x + ZW / 2) + '</g>';
      s += '<text x="' + (x + ZW / 2) + '" y="30" text-anchor="middle" class="zl">' + STAGES[i] + (opts.hours && opts.hours[i] ? ' · ' + opts.hours[i] + ' h' : '') + '</text>';
      if (dn) s += '<g transform="translate(' + (x + ZW - 22) + ',16)"><circle r="9" cx="0" cy="8" fill="#2b9348"/><path d="M-4 8L-1 11L5 4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>';
    }
    // duct platform, with the finished stretch filled in the job colour
    s += '<rect x="' + X0 + '" y="' + GY + '" width="' + ZW * 4 + '" height="22" rx="3" fill="#dfe6f1" stroke="#0a1a4d" stroke-width="2"/>';
    for (let i = 1; i < 8; i++) s += '<path d="M' + (X0 + i * 100) + ' ' + GY + 'V' + (GY + 22) + '" stroke="#8a97ab" stroke-width="2"/>';
    s += '<clipPath id="pc"><rect class="pfill" x="' + X0 + '" y="' + GY + '" width="' + (px(pos) - X0) + '" height="22"/></clipPath>' +
      '<rect x="' + X0 + '" y="' + GY + '" width="' + ZW * 4 + '" height="22" rx="3" fill="' + opts.color + '" clip-path="url(#pc)"/>' +
      '<g clip-path="url(#pc)"><path class="flow" d="M' + (X0 - 40) + ' ' + (GY + 11) + 'h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5m34 0h8l6-5v10l-6-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></g>' +
      '<rect x="' + X0 + '" y="' + GY + '" width="' + ZW * 4 + '" height="22" rx="3" fill="none" stroke="#0a1a4d" stroke-width="2"/>';
    // handover flag
    s += '<g transform="translate(' + (W - 20) + ',' + (GY - 88) + ')"><path d="M0 0V88" stroke="#0a1a4d" stroke-width="3"/><path class="flag" d="M0 2H34L26 14L34 26H0Z" fill="' + (pos >= 4 ? '#2b9348' : '#adb5bd') + '"/></g>';
    s += '<text x="' + (W - 20) + '" y="' + (GY + 38) + '" text-anchor="end" class="zl">Handover</text>';
    s += walkersSvg(opts, W, px(pos), pos);
    s += '</svg>';
    host.innerHTML = s;
    animate(host, opts);
  };
  const animate = (host, opts) => {
    if (!opts.reduce) {
      const ws = host.querySelectorAll('.walker');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        host.querySelector('svg').classList.add('go');
        ws.forEach((w) => { w.classList.add('walking'); w.style.transform = 'translate(' + w.dataset.x + 'px,' + (opts.gy || GY) + 'px)'; });
        setTimeout(() => ws.forEach((w) => w.classList.remove('walking')), 2200);
      }));
    }
  };

  window.buildFireTrack = function (host, o) {
    // o: {bays, days, dayNo, walkers, color, reduce, aria, unit}
    const W = X0 * 2 + ZW * 4, n = Math.max(1, o.bays || 2), days = Math.max(1, o.days), d = Math.min(days, Math.max(0, o.dayNo));
    const bw = Math.min(170, (W - 2 * X0 - (n - 1) * 16) / n), gap = n > 1 ? (W - 2 * X0 - n * bw) / (n - 1) : 0;
    const start = n > 1 ? X0 : X0 + (W - 2 * X0 - bw) / 2;
    let s = '<svg class="track" viewBox="0 0 ' + W + ' 215" role="img" aria-label="' + (o.aria || 'Fire station progress') + '">' +
      '<defs><pattern id="bp2" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#c9daf8" stroke-width="1"/></pattern></defs>' +
      '<rect width="' + W + '" height="215" rx="10" fill="#eaf2ff"/><rect width="' + W + '" height="215" rx="10" fill="url(#bp2)"/>' +
      '<path d="M' + (X0 - 6) + ' 52L' + (W / 2) + ' 14L' + (W - X0 + 6) + ' 52Z" fill="#c92a2a" stroke="#0a1a4d" stroke-width="2.5"/>' +
      '<rect x="' + X0 + '" y="52" width="' + (W - 2 * X0) + '" height="98" fill="#e9eef7" stroke="#0a1a4d" stroke-width="2.5"/>' +
      '<text x="' + (W / 2) + '" y="44" text-anchor="middle" class="zl" style="fill:#fff">Fire station · ' + n + (n === 1 ? ' bay' : ' bays') + ' · ' + days + (days === 1 ? ' day' : ' days') + '</text>';
    // Overhead rail the Fantech hose trolleys run on
    s += '<path d="M' + (X0 + 6) + ' 70H' + (W - X0 - 6) + '" stroke="#0a1a4d" stroke-width="5" stroke-linecap="round"/><path d="M' + (X0 + 6) + ' 74H' + (W - X0 - 6) + '" stroke="#8a97ab" stroke-width="2"/>';
    for (let i = 0; i < n; i++) {
      const x = start + i * (bw + gap), fr = Math.min(1, Math.max(0, (d - i * days / n) / (days / n)));
      const doneB = fr >= 1, curB = !doneB && fr > 0;
      const sc = Math.min(1, (bw - 14) / 150), tx0 = x + 7, ty = 148 - 62 * sc;
      const nx = tx0 + 5 * sc, ny = ty + 43 * sc;               // exhaust nozzle at the rear of the truck
      const parked = x + bw - 16, conn = nx + 12 * sc;          // trolley parks at the right, then slides left to connect
      const trx = parked + (conn - parked) * fr;
      const ex = doneB ? nx : trx - 7, ey = doneB ? ny : 98 + 14 * (1 - fr);
      const hose = 'M' + trx + ' 76C' + trx + ' ' + (ey - 8) + ' ' + (ex + (doneB ? -14 : 0)) + ' ' + (ey - 22) + ' ' + ex + ' ' + ey;
      // truck, facing right
      s += '<g class="' + (doneB ? 'run' : '') + '" opacity="' + (doneB || curB ? 1 : .6) + '"><g transform="translate(' + tx0 + ',' + ty + ') scale(' + sc + ')">' +
        '<rect x="14" y="8" width="76" height="5" rx="2" fill="#adb5bd" stroke="#0a1a4d" stroke-width="1.5"/><path d="M24 8V13M36 8V13M48 8V13M60 8V13M72 8V13" stroke="#0a1a4d" stroke-width="1.5"/>' +
        '<rect x="6" y="38" width="140" height="12" rx="3" fill="#2b2f3a" stroke="#0a1a4d" stroke-width="2"/>' +
        '<rect x="10" y="14" width="88" height="28" rx="3" fill="#d92c2c" stroke="#0a1a4d" stroke-width="2.5"/><path d="M40 16V40M68 16V40M14 28H96" stroke="#7f1313" stroke-width="1.5"/>' +
        '<path d="M100 22H128Q142 24 144 40V42H100Z" fill="#d92c2c" stroke="#0a1a4d" stroke-width="2.5"/><path d="M120 25H130Q138 27 140 36H120Z" fill="#cfe9fb" stroke="#0a1a4d" stroke-width="1.5"/>' +
        '<rect x="104" y="14" width="14" height="6" rx="2" fill="' + (doneB || curB ? '#ffd43b' : '#adb5bd') + '" stroke="#0a1a4d" stroke-width="1.5"' + (doneB || curB ? ' class="beacon"' : '') + '/>' +
        '<circle cx="144" cy="34" r="3.2" fill="' + (doneB ? '#fff3bf' : '#868e96') + '" stroke="#0a1a4d" stroke-width="1"/>' +
        '<rect x="0" y="40" width="9" height="7" rx="2" fill="#6b7688" stroke="#0a1a4d" stroke-width="1.5"/>' +
        '<g><circle cx="34" cy="52" r="10" fill="#14181e"/><circle cx="34" cy="52" r="4" fill="#adb5bd"/><circle cx="116" cy="52" r="10" fill="#14181e"/><circle cx="116" cy="52" r="4" fill="#adb5bd"/></g>' +
        '</g></g>';
      // trolley on the rail, hose to the exhaust
      s += '<path d="' + hose + '" stroke="#0a1a4d" stroke-width="8" fill="none" stroke-linecap="round" opacity=".9"/><path d="' + hose + '" stroke="#e8590c" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        (doneB ? '<path class="hflow" d="' + hose + '" stroke="#fff" stroke-width="2.2" fill="none" stroke-dasharray="3 9" stroke-linecap="round"/>' : '') +
        '<rect x="' + (trx - 9) + '" y="63" width="18" height="14" rx="3" fill="#fff" stroke="#0a1a4d" stroke-width="2"/><circle cx="' + (trx - 4) + '" cy="79" r="2.2" fill="#0a1a4d"/><circle cx="' + (trx + 4) + '" cy="79" r="2.2" fill="#0a1a4d"/>';
      if (doneB) s += '<g class="puff"><circle cx="' + (nx - 8) + '" cy="' + (ny + 2) + '" r="3" fill="#868e96" opacity=".6"/><circle cx="' + (nx - 14) + '" cy="' + (ny - 4) + '" r="2.2" fill="#868e96" opacity=".5"/></g>';
      const cx = x + bw / 2;
      s += '<text x="' + cx + '" y="168" text-anchor="middle" class="zl" style="font-size:11px">Truck ' + (i + 1) + (doneB ? ' connected, running' : curB ? ' connecting' : ' waiting') + '</text>';
      if (doneB) s += '<g transform="translate(' + (x + bw - 26) + ',54)"><circle r="9" cx="0" cy="8" fill="#2b9348"/><path d="M-4 8L-1 11L5 4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>';
    }
    // day blocks on the ground: one block per working day
    const sw = (W - 2 * X0) / days, gy = 178;
    for (let k = 0; k < days; k++) {
      const filled = k + 1 <= Math.floor(d), part = !filled && k < d;
      s += '<rect x="' + (X0 + k * sw + 1) + '" y="' + gy + '" width="' + (sw - 2) + '" height="16" rx="3" fill="#dfe6f1" stroke="#0a1a4d" stroke-width="1.5"/>';
      if (filled || part) s += '<rect x="' + (X0 + k * sw + 1) + '" y="' + gy + '" width="' + ((sw - 2) * (filled ? 1 : d - k)) + '" height="16" rx="3" fill="' + o.color + '"/>';
      s += '<text x="' + (X0 + k * sw + sw / 2) + '" y="' + (gy + 12) + '" text-anchor="middle" class="wn" style="stroke:none;font-size:9px;fill:' + (filled ? '#fff' : '#0a1a4d') + '">' + (k + 1) + '</text>';
    }
    s += '<text x="' + (W - X0) + '" y="210" text-anchor="end" class="zl" style="font-size:11px">' + (o.unit || 'Day') + ' ' + Math.min(days, Math.max(0, Math.ceil(d))) + ' of ' + days + '</text>';
    const px = X0 + (d / days) * (W - 2 * X0);
    s += walkersSvg(Object.assign({}, o, { noNames: true }), W, px, 0).replace(/transform:translate\(([\d.]+)px,150px\)/g, 'transform:translate($1px,150px)');
    s += '</svg>';
    host.innerHTML = s;
    animate(host, o);
  };

  // Levels track: Level by level, three jobs each (flex on, fan, boxes and grilles), then commissioning
  window.buildLevelsTrack = function (host, o) {
    // o: {levels:[3,4,..], status:{ 'L3 flex':'done', ... }, commissioning:'done'|'doing'|'', walkers, color, reduce, aria}
    const L = o.levels, n = L.length, CW = 100, X = 20, W = X * 2 + n * CW + 240;
    const T = [['flex', 'Flex on'], ['fan', 'Fan'], ['boxes and grilles', 'Boxes, grilles']];
    const st = (lv, k) => (o.status['L' + lv + ' ' + k] || '').toLowerCase();
    let s = '<svg class="track" viewBox="0 0 ' + W + ' 232" role="img" aria-label="' + (o.aria || 'Level progress') + '">' +
      '<defs><pattern id="bp3" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#c9daf8" stroke-width="1"/></pattern></defs>' +
      '<rect width="' + W + '" height="232" rx="10" fill="#eaf2ff"/><rect width="' + W + '" height="232" rx="10" fill="url(#bp3)"/>';
    let units = 0;
    L.forEach((lv, i) => {
      const x = X + i * CW, cx = x + CW / 2;
      const d = T.filter(([k]) => st(lv, k) === 'done').length;
      units += d / 3;
      const all = d === 3;
      s += '<rect x="' + (x + 4) + '" y="14" width="' + (CW - 8) + '" height="146" rx="8" fill="' + (all ? o.color : '#fff') + '" fill-opacity="' + (all ? .14 : .55) + '" stroke="' + (all ? o.color : '#9fb3d6') + '" stroke-width="1.5"/>' +
        '<text x="' + cx + '" y="34" text-anchor="middle" class="zl">Level ' + lv + '</text>';
      if (all) s += '<g transform="translate(' + (x + CW - 24) + ',17)"><circle r="8" cx="0" cy="8" fill="#2b9348"/><path d="M-3.5 8L-1 10.5L4 4.5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>';
      T.forEach(([k], j) => {
        const y = 54 + j * 36, done = st(lv, k) === 'done', doing = st(lv, k) === 'doing';
        const op = done ? 1 : doing ? .8 : .38;
        s += '<g opacity="' + op + '">';
        if (j === 0) s += '<path d="M' + (cx - 26) + ' ' + (y + 12) + 'q4 -16 8 0t8 0t8 0t8 0t8 0t8 0" stroke="' + (done ? '#c8641c' : '#6b7688') + '" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M' + (cx - 28) + ' ' + (y + 12) + 'h4M' + (cx + 24) + ' ' + (y + 12) + 'h4" stroke="#0a1a4d" stroke-width="5" stroke-linecap="round"/>';
        if (j === 1) s += '<circle cx="' + cx + '" cy="' + (y + 12) + '" r="15" fill="#fff" stroke="#0a1a4d" stroke-width="2.5"/><g class="' + (done ? 'fan' : '') + '"><path d="M' + cx + ' ' + (y + 12) + 'V' + (y - 1) + 'M' + cx + ' ' + (y + 12) + 'L' + (cx + 11) + ' ' + (y + 19) + 'M' + cx + ' ' + (y + 12) + 'L' + (cx - 11) + ' ' + (y + 19) + '" stroke="#0b4fd4" stroke-width="4" stroke-linecap="round"/></g>';
        if (j === 2) s += '<rect x="' + (cx - 28) + '" y="' + (y + 2) + '" width="34" height="20" rx="2" fill="#dfe6f1" stroke="#0a1a4d" stroke-width="2"/><rect x="' + (cx + 10) + '" y="' + (y + 4) + '" width="18" height="16" fill="#fff" stroke="#0a1a4d" stroke-width="2"/><path d="M' + (cx + 13) + ' ' + (y + 8) + 'H' + (cx + 25) + 'M' + (cx + 13) + ' ' + (y + 12) + 'H' + (cx + 25) + 'M' + (cx + 13) + ' ' + (y + 16) + 'H' + (cx + 25) + '" stroke="#0a1a4d" stroke-width="1.5"/>';
        s += '</g>';
        if (done) s += '<circle cx="' + (x + 14) + '" cy="' + (y + 12) + '" r="6" fill="#2b9348"/><path d="M' + (x + 11) + ' ' + (y + 12) + 'L' + (x + 13.5) + ' ' + (y + 14.5) + 'L' + (x + 17.5) + ' ' + (y + 9.5) + '" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
      });
    });
    // commissioning
    const cx0 = X + n * CW, cdone = (o.commissioning || '').toLowerCase() === 'done';
    s += '<rect x="' + (cx0 + 4) + '" y="14" width="232" height="146" rx="8" fill="' + (cdone ? o.color : '#fff') + '" fill-opacity="' + (cdone ? .14 : .55) + '" stroke="' + (cdone ? o.color : '#9fb3d6') + '" stroke-width="1.5"/>' +
      '<text x="' + (cx0 + 120) + '" y="34" text-anchor="middle" class="zl">Commissioning</text>' +
      '<g opacity="' + (cdone ? 1 : .45) + '"><circle cx="' + (cx0 + 60) + '" cy="96" r="26" fill="#fff" stroke="#0a1a4d" stroke-width="3"/><path d="M' + (cx0 + 42) + ' 108A26 26 0 0 1 ' + (cx0 + 78) + ' 108" stroke="#e03131" stroke-width="3" fill="none"/><g class="needle"><path d="M' + (cx0 + 60) + ' 96L' + (cx0 + 73) + ' 80" stroke="#14181e" stroke-width="2.5" stroke-linecap="round"/></g><circle cx="' + (cx0 + 60) + '" cy="96" r="3" fill="#14181e"/>' +
      '<rect x="' + (cx0 + 120) + '" y="62" width="84" height="76" rx="5" fill="#eef3ff" stroke="#0a1a4d" stroke-width="3"/><g class="' + (cdone ? 'fan' : '') + '"><circle cx="' + (cx0 + 162) + '" cy="96" r="24" fill="#fff" stroke="#0a1a4d" stroke-width="2"/><path d="M' + (cx0 + 162) + ' 96V74M' + (cx0 + 162) + ' 96L' + (cx0 + 181) + ' 107M' + (cx0 + 162) + ' 96L' + (cx0 + 143) + ' 107" stroke="#0b4fd4" stroke-width="5" stroke-linecap="round"/></g></g>';
    // platform with progress fill
    const prog = units, px = X + prog * CW + (cdone ? 240 : 0);
    s += '<rect x="' + X + '" y="170" width="' + (n * CW + 240) + '" height="20" rx="3" fill="#dfe6f1" stroke="#0a1a4d" stroke-width="2"/>' +
      '<clipPath id="pc3"><rect x="' + X + '" y="170" width="' + Math.max(0, px - X) + '" height="20"/></clipPath><rect x="' + X + '" y="170" width="' + (n * CW + 240) + '" height="20" rx="3" fill="' + o.color + '" clip-path="url(#pc3)"/><rect x="' + X + '" y="170" width="' + (n * CW + 240) + '" height="20" rx="3" fill="none" stroke="#0a1a4d" stroke-width="2"/>';
    // legend of the three jobs per level
    s += '<text x="' + X + '" y="222" class="wn" style="stroke:none;font-size:11px;fill:#33406a">Each level: flex on, one fan, mounted boxes and grilles. Then commissioning.</text>';
    s += walkersSvg(Object.assign({}, o, { noNames: true, gy: 170 }), W, Math.max(X + 16, Math.min(W - 40, px)), 0);
    s += '</svg>';
    host.innerHTML = s;
    animate(host, Object.assign({}, o, { gy: 170 }));
  };
})();
