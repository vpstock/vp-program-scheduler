/* Save online: the planner's edits are written to data/shared_edits.json in this GitHub repo, so they are kept
   and shown to everyone who opens the planner. Without an access token the edits stay in this browser only.
   The access token is typed in by the person using the planner and kept in this browser only. */
(function () {
  const OWNER = 'vpstock', REPO = 'vp-program-scheduler', PATH = 'data/shared_edits.json', BRANCH = 'main';
  const API = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + PATH;
  const KEYS = ['vp-sched-edits-v1', 'vp-sched-crew-v1', 'vp-sched-crewx-v1', 'vp-sched-addjobs-v1', 'vp-sched-offx-v1', 'vp-sched-log-v1', 'vp-sched-order-v1'];
  const TOK = 'vp-sched-ghtoken', SYNCED = 'vp-sched-synced-at', DIRTY = 'vp-sched-dirty';
  const st = { text: '', kind: 'info', remote: null, conflict: false, busy: false, timer: null, hydrating: false };
  let ls = null; try { ls = window.localStorage; ls.getItem('x'); } catch (e) { ls = null; }
  const rd = (k) => { try { return ls ? ls.getItem(k) : null; } catch (e) { return null; } };
  const origSet = Storage.prototype.setItem;
  const wr = (k, v) => { try { if (ls) origSet.call(ls, k, v); } catch (e) { /* storage blocked */ } };
  const rm = (k) => { try { if (ls) ls.removeItem(k); } catch (e) { /* storage blocked */ } };
  const hhmm = (iso) => new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, ' ');
  const snap = () => { const data = {}; KEYS.forEach((k) => { const v = rd(k); if (v === null) return; try { data[k] = JSON.parse(v); } catch (e) { data[k] = v; } }); return data; };
  const apply = (j) => {
    st.hydrating = true;
    KEYS.forEach((k) => { if (j.data && j.data[k] !== undefined) wr(k, typeof j.data[k] === 'string' ? j.data[k] : JSON.stringify(j.data[k])); else rm(k); });
    wr(SYNCED, j.saved_at); wr(DIRTY, '0'); st.hydrating = false;
  };
  const hasLocal = () => KEYS.some((k) => { const v = rd(k); return v && v !== '[]' && v !== '{}' && v !== 'null'; });
  const isDirty = () => rd(DIRTY) === '1' || (!rd(SYNCED) && hasLocal());

  // Any save of a planner key marks this browser as having changes not yet saved online.
  Storage.prototype.setItem = function (k, v) {
    origSet.call(this, k, v);
    if (this === ls && KEYS.indexOf(k) >= 0 && !st.hydrating) { wr(DIRTY, '1'); schedule(); }
  };

  const hydrate = async () => {
    try {
      const r = await fetch(PATH + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) { st.remote = null; return; }
      const j = await r.json(); st.remote = j;
      const at = rd(SYNCED) || '';
      if (!isDirty() && j.saved_at > at) apply(j);
      else if (isDirty() && j.saved_at > at) st.conflict = true;
    } catch (e) { /* no shared file yet, or offline */ }
  };
  window.vpSyncReady = hydrate();

  const decode = (b64) => decodeURIComponent(escape(atob(String(b64).replace(/\n/g, ''))));
  const encode = (s) => btoa(unescape(encodeURIComponent(s)));
  const push = async (force) => {
    const token = rd(TOK); if (!token || st.busy) return;
    st.busy = true; setStatus('Saving online...', 'info');
    const H = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };
    try {
      let sha = null;
      const g = await fetch(API + '?ref=' + BRANCH + '&t=' + Date.now(), { headers: H, cache: 'no-store' });
      if (g.status === 200) {
        const gj = await g.json(); sha = gj.sha;
        let rem = null; try { rem = JSON.parse(decode(gj.content)); } catch (e) { rem = null; }
        if (!force && rem && rem.saved_at > (rd(SYNCED) || '')) { st.remote = rem; st.conflict = true; setStatus('Newer changes were saved online by someone else.', 'warn'); return; }
      } else if (g.status !== 404) { throw new Error('read ' + g.status); }
      const payload = { saved_at: new Date().toISOString(), note: 'Edits made on the Project program scheduler. Written by the planner.', data: snap() };
      const body = { message: 'Planner edits saved from the browser', content: encode(JSON.stringify(payload, null, 1)), branch: BRANCH };
      if (sha) body.sha = sha;
      const p = await fetch(API, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, H), body: JSON.stringify(body) });
      if (p.ok) { wr(SYNCED, payload.saved_at); wr(DIRTY, '0'); st.conflict = false; setStatus('Saved online at ' + hhmm(payload.saved_at) + '.', 'ok'); }
      else if (p.status === 409 || p.status === 422) { setStatus('The online copy changed while saving. Trying again shortly.', 'warn'); setTimeout(() => push(force), 4000); }
      else if (p.status === 401) setStatus('GitHub did not accept the access token. It may have expired. Set it up again.', 'bad');
      else if (p.status === 403 || p.status === 404) setStatus('The access token cannot write to this repository. Check it has Contents: Read and write for vp-program-scheduler.', 'bad');
      else setStatus('Could not save online (error ' + p.status + '). Your changes are still saved in this browser.', 'bad');
    } catch (e) { setStatus('Could not reach GitHub. Your changes are still saved in this browser.', 'bad'); }
    finally { st.busy = false; }
  };
  function schedule() {
    if (!rd(TOK)) { setStatus('', 'info'); return; }
    setStatus('Changes waiting to be saved online...', 'info');
    clearTimeout(st.timer); st.timer = setTimeout(() => push(false), 6000);
  }

  // ---- the small status bar at the bottom left ----
  let bar = null, panel = null;
  function setStatus(t, k) { st.text = t; st.kind = k || 'info'; draw(); }
  const css = '.vpsync{position:fixed;left:12px;bottom:12px;z-index:50;max-width:min(420px,calc(100vw - 24px));font:13px/1.35 "Public Sans",Arial,sans-serif;color:#14181e}'
    + '.vpsync .pill{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;padding:6px 10px;border-radius:8px;background:#fff;border:1px solid #dfe4ec;box-shadow:0 2px 8px rgba(10,26,77,.12)}'
    + '.vpsync .pill.ok{border-color:#2b9348}.vpsync .pill.warn{border-color:#b45309;background:#fff4e6}.vpsync .pill.bad{border-color:#c0392b;background:#fdecea}'
    + '.vpsync button{font:inherit;padding:3px 9px;border:1px solid #0b4fd4;border-radius:8px;background:#fff;color:#0b4fd4;cursor:pointer}.vpsync button.pri{background:#0b4fd4;color:#fff}'
    + '.vpsync .pnl{margin-top:6px;padding:10px;border-radius:8px;background:#fff;border:1px solid #dfe4ec;box-shadow:0 2px 8px rgba(10,26,77,.12);display:flex;flex-direction:column;gap:6px}'
    + '.vpsync .pnl input{font:inherit;padding:5px 8px;border:1px solid #dfe4ec;border-radius:8px}.vpsync .pnl ol{margin:0 0 0 18px;padding:0;color:#333b47}.vpsync .pnl small{color:#6b7688}';
  function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
  function draw() {
    if (!bar) return;
    bar.textContent = '';
    const has = !!rd(TOK), dirty = isDirty();
    let text = st.text, kind = st.kind;
    if (!text) {
      if (st.conflict) { text = 'Newer changes were saved online by someone else.'; kind = 'warn'; }
      else if (!has) { text = dirty ? 'Your changes are saved in this browser only.' : 'Edits are saved in this browser only.'; }
      else if (dirty) { text = 'Changes not saved online yet.'; kind = 'warn'; }
      else if (rd(SYNCED)) { text = 'Saved online at ' + hhmm(rd(SYNCED)) + '.'; kind = 'ok'; }
      else { text = 'Saving online is on.'; kind = 'ok'; }
    }
    const pill = el('div', 'pill ' + kind); pill.setAttribute('role', 'status'); pill.appendChild(el('span', '', text));
    if (st.conflict) {
      const a = el('button', '', 'Load the online version'); a.onclick = () => { if (st.remote) { apply(st.remote); location.reload(); } };
      const b = el('button', '', 'Save mine over it'); b.onclick = () => { st.conflict = false; push(true); };
      pill.append(a, b);
    } else if (has && dirty) { const b = el('button', 'pri', 'Save now'); b.onclick = () => push(false); pill.appendChild(b); }
    const s = el('button', '', has ? 'Save online settings' : 'Set up saving online'); s.onclick = () => { openPanel = !openPanel; draw(); };
    pill.appendChild(s); bar.appendChild(pill);
    if (openPanel) {
      const p = el('div', 'pnl');
      p.appendChild(el('strong', '', 'Save the planner online'));
      p.appendChild(el('small', '', 'Your edits are written to data/shared_edits.json in the vpstock GitHub repo, so everyone who opens the planner sees them. You only need to do this once on each computer you edit from.'));
      const ol = el('ol'); ['On GitHub, open Settings, then Developer settings, then Personal access tokens, then Fine-grained tokens, then Generate new token.', 'Repository access: Only select repositories, then vp-program-scheduler.', 'Permissions: Repository permissions, Contents: Read and write.', 'Generate it, copy it, and paste it below.'].forEach((t) => ol.appendChild(el('li', '', t))); p.appendChild(ol);
      const inp = el('input'); inp.type = 'password'; inp.placeholder = has ? 'Token saved. Paste a new one to replace it' : 'Paste the access token here'; inp.autocomplete = 'off'; p.appendChild(inp);
      const row = el('div', 'pill'); row.style.border = '0'; row.style.padding = '0'; row.style.boxShadow = 'none';
      const sv = el('button', 'pri', 'Save token and save now'); sv.onclick = () => { const v = inp.value.trim(); if (!v) return; wr(TOK, v); openPanel = false; st.text = ''; wr(DIRTY, '1'); draw(); push(false); };
      row.appendChild(sv);
      if (has) { const rmv = el('button', '', 'Remove token'); rmv.onclick = () => { rm(TOK); openPanel = false; st.text = ''; draw(); }; row.appendChild(rmv); }
      p.appendChild(row);
      p.appendChild(el('small', '', 'The token stays in this browser only. It is limited to this one repository.'));
      bar.appendChild(p);
    }
  }
  let openPanel = false;
  const mount = () => {
    if (document.getElementById('vpsync')) return;
    const sty = document.createElement('style'); sty.textContent = css; document.head.appendChild(sty);
    bar = el('div', 'vpsync'); bar.id = 'vpsync'; document.body.appendChild(bar); draw();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.vpSync = { push, hydrate, state: st };

  // Check for edits saved online by someone else every few minutes, and show them if this browser has nothing unsaved.
  setInterval(async () => {
    const before = rd(SYNCED); await hydrate();
    if (rd(SYNCED) !== before) { location.reload(); return; }
    draw();
  }, 3 * 60 * 1000);
  window.vpSyncReady.then(draw);
})();
