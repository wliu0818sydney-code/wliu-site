/* Site shell: theme, entry screen, listening wave, clock and the progress panel.
   Nothing here touches the listening logic; it only mounts the app, listens to its events and shows what it reports. */
(function () {
  "use strict";

  /* Owner details. Anything left empty is simply not shown; fill these in by hand, never with placeholder text. */
  const SITE = {
    bio: "", /* one sentence about the owner for the about window */
    /* Optional decorative images, as paths from index.html. Original or properly licensed art only; see the README.
       Setting either one replaces the rooftop figure; a slot left empty shows nothing. */
    art: { left: "", right: "" }
  };

  /* Paint before anything can return early. If every image fails to load, the rooftop figure comes back. */
  function paintArt() {
    const root = document.documentElement;
    const pathFor = (side) => { const p = SITE.art && SITE.art[side]; return typeof p === "string" ? p.trim() : ""; };
    document.querySelectorAll("[data-art-slot]").forEach((slot) => {
      const path = pathFor(slot.dataset.artSlot);
      if (!path) return;
      const img = new Image();
      img.className = "wl-art";
      img.alt = "";
      img.addEventListener("error", () => {
        img.remove();
        if (!document.querySelector(".wl-art")) root.classList.remove("wl-has-art");
      });
      img.src = path;
      slot.appendChild(img);
      root.classList.add("wl-has-art");
    });
  }
  paintArt();

  /* The theme key stays as it was so saved themes keep working. */
  const THEME_KEY = "wliu-site-theme", ENTERED_KEY = "wliu-site-entered";
  const html = document.documentElement, body = document.body;
  const $ = (id) => document.getElementById(id);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pad2 = (n) => String(n).padStart(2, "0");
  const token = (name) => getComputedStyle(html).getPropertyValue(name).trim();
  const App = window.WLIU_LISTENING, Sum = window.WLIU_SUMMARY;
  /* Which section of the main window is showing, and whether each one is mid-practice. */
  let tab = "dictation", dictView = "home", sumView = "home";

  /* The app did not load or start: drop the entry screen, whose button could do nothing, and say so. */
  function appFailed() {
    html.classList.remove("wl-entry-open");
    $("wl-entry").hidden = true;
    $("wl-listen").innerHTML = '<p class="wl-noscript" role="alert">听写内容没有加载成功，请刷新页面再试一次。</p>';
  }
  if (!App) { appFailed(); return; }

  /* ---------- clock ---------- */
  let shownMinute = "", shownDay = "";
  function paintClock(d) {
    const minute = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    if (minute !== shownMinute) { shownMinute = minute; document.querySelectorAll("[data-clock]").forEach((el) => { el.textContent = minute; }); }
  }
  function tickClock() {
    const d = new Date(), day = d.toDateString();
    paintClock(d);
    if (day !== shownDay) {
      shownDay = day;
      App.refreshDay();
      readouts();
    }
    setTimeout(tickClock, 60000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 20);
  }

  /* ---------- theme: night is the default whatever the system says ---------- */
  function currentTheme() { return html.getAttribute("data-theme") === "light" ? "light" : "dark"; }
  function paintThemeButtons() {
    const now = currentTheme();
    document.querySelectorAll("[data-theme-set]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeSet === now)));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", token("--wl-sky-0"));
    drawScope(0);
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme-set]");
    if (!b) return;
    html.setAttribute("data-theme", b.dataset.themeSet);
    try { localStorage.setItem(THEME_KEY, b.dataset.themeSet); } catch (err) { /* theme lasts for this page only */ }
    paintThemeButtons();
  });

  /* ---------- listening wave: flat unless a word is actually being spoken ---------- */
  const scope = $("wl-meter"), scopeState = $("wl-meter-state");
  let live = false, level = 0, scopeRaf = 0;
  function drawScope(now) {
    if (scope.clientWidth === 0) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2), w = scope.clientWidth, h = scope.clientHeight;
    const pw = Math.round(w * ratio), ph = Math.round(h * ratio);
    if (scope.width !== pw || scope.height !== ph) { scope.width = pw; scope.height = ph; }
    const ctx = scope.getContext("2d"), mid = h / 2;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = level > 0.02 ? token("--wl-accent") : token("--wl-line-strong");
    ctx.beginPath();
    for (let x = 4; x <= w - 4; x += 9) {
      const edge = Math.sin((Math.PI * x) / w);
      const v = Math.abs(Math.sin(x * 0.08 + now * 0.011) * 0.6 + Math.sin(x * 0.19 - now * 0.017) * 0.28 + Math.sin(x * 0.035 + now * 0.006) * 0.22);
      const half = 1 + level * h * 0.42 * edge * v;
      ctx.moveTo(x, mid - half);
      ctx.lineTo(x, mid + half);
    }
    ctx.stroke();
  }
  function scopeLoop(now) {
    level += ((live ? 1 : 0) - level) * 0.14;
    if (!live && level < 0.012) { level = 0; drawScope(now); scopeRaf = 0; return; }
    drawScope(now);
    scopeRaf = requestAnimationFrame(scopeLoop);
  }
  function onSpeech(v) {
    live = v;
    scopeState.textContent = v ? "播放中" : "待机";
    if (reduced.matches) { level = v ? 1 : 0; drawScope(0); return; }
    if (!scopeRaf) scopeRaf = requestAnimationFrame(scopeLoop);
  }

  /* ---------- entry screen: standby, loading, room ---------- */
  const gate = $("wl-entry"), room = $("wl-room"), status = $("wl-entry-status");
  const LOAD_MS = 1500;
  let gateDone = false, loadTimers = [];
  function loadedLine() {
    const s = App.summary();
    return "已掌握 " + s.mastered + " / " + s.expMax + " 词 · 等级 " + s.rank.rank;
  }
  function skipLoading(e) {
    if (e.type === "keydown" && (e.key === "Tab" || e.key === "Shift")) return;
    if (e.type === "keydown") e.preventDefault();
    finishGate();
  }
  function startLoading() {
    gate.dataset.stage = "loading";
    status.textContent = "正在进入…";
    document.addEventListener("keydown", skipLoading);
    gate.addEventListener("pointerdown", skipLoading);
    if (reduced.matches) {
      /* no sweep: the line appears and the crossfade carries it */
      status.textContent = loadedLine();
      loadTimers.push(setTimeout(finishGate, 800));
      return;
    }
    loadTimers.push(setTimeout(() => { status.textContent = loadedLine(); }, LOAD_MS * 0.6));
    loadTimers.push(setTimeout(finishGate, LOAD_MS));
  }
  function finishGate() {
    if (gateDone) return;
    gateDone = true;
    loadTimers.forEach(clearTimeout);
    document.removeEventListener("keydown", skipLoading);
    gate.removeEventListener("pointerdown", skipLoading);
    try { sessionStorage.setItem(ENTERED_KEY, "1"); } catch (e) { /* the entry simply shows again next time */ }
    room.removeAttribute("inert");
    room.removeAttribute("aria-hidden");
    html.classList.remove("wl-entry-open");
    room.classList.add("is-entering");
    gate.classList.add("is-leaving");
    setTimeout(() => { gate.hidden = true; }, 480);
    setTimeout(() => { room.classList.remove("is-entering"); }, 1100);
    drawScope(0);
    window.scrollTo(0, 0);
    if (tab === "summary") Sum.focusCurrent(); else App.focusCurrent();
  }
  function initGate() {
    if (html.classList.contains("wl-entered")) { gateDone = true; gate.hidden = true; return; }
    room.setAttribute("inert", "");
    room.setAttribute("aria-hidden", "true");
    $("wl-start").addEventListener("click", startLoading);
    $("wl-start").focus({ preventScroll: true });
  }

  /* ---------- progress panel: only what the app actually knows ---------- */
  function readouts() {
    const s = App.summary(), set = (id, v) => { const el = $(id); if (el && el.textContent !== v) el.textContent = v; };
    set("r-date", s.date);
    set("r-day", s.inRange ? "第 " + s.day + " / " + s.lastDay + " 天" : s.day < 1 ? "未开始" : "排期已走完");
    set("r-tasks", s.tasks ? "待完成 " + s.open + " / " + s.tasks : "无");
    set("r-wrong", s.wrong + " 个");
    set("r-lists", s.learned + " / " + s.lists + " 组");
    set("r-mode", s.mode === "audio" ? "听音 · " + s.accent : "看中文");

    const bar = $("wl-exp-bar");
    set("wl-exp-num", s.mastered + " / " + s.expMax);
    set("wl-rank", s.rank.rank);
    set("wl-rank-next", s.rank.next ? "距" + s.rank.next + "还差 " + s.rank.toNext + " 词" : "已到最高等级");
    $("wl-exp-fill").style.setProperty("--exp", (s.mastered / s.expMax).toFixed(4));
    bar.setAttribute("aria-valuemax", String(s.expMax));
    bar.setAttribute("aria-valuenow", String(s.mastered));
    bar.setAttribute("aria-valuetext", "已掌握 " + s.mastered + " / " + s.expMax + " 词，等级 " + s.rank.rank);
    document.querySelectorAll("#wl-exp-marks [data-at]").forEach((el) => el.classList.toggle("is-on", s.mastered >= +el.dataset.at));
  }

  /* ---------- wiring ---------- */
  function paintSession() {
    body.classList.toggle("wl-session", (tab === "summary" ? sumView : dictView) === "session");
    drawScope(0);
  }
  App.on("view", (v) => { dictView = v; paintSession(); });
  App.on("speech", onSpeech);
  App.on("change", readouts);
  try { App.mount($("wl-listen")); } catch (e) { appFailed(); return; }

  /* 听句概括 sits beside the dictation. If it fails to start, the dictation carries on without the switch. */
  function setTab(next) {
    if (next === tab) return;
    if (tab === "summary") Sum.hush(); else App.hush();
    tab = next;
    $("wl-listen").hidden = next !== "dictation";
    $("wl-summary").hidden = next !== "summary";
    document.querySelectorAll("#wl-tabs [data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === next)));
    paintSession();
    try { history.replaceState(null, "", next === "summary" ? "#summary" : location.pathname + location.search); } catch (e) { /* the section just is not remembered across a reload */ }
  }
  if (Sum) {
    try {
      Sum.on("view", (v) => { sumView = v; paintSession(); });
      Sum.on("speech", onSpeech);
      Sum.mount($("wl-summary"), App);
      $("wl-tabs").hidden = false;
      $("wl-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) setTab(b.dataset.tab); });
      if (location.hash === "#summary") setTab("summary");
      /* Only these two hashes pick a section; #wl-about-title and the like leave it alone. */
      window.addEventListener("hashchange", () => {
        const was = tab;
        if (location.hash === "#summary") setTab("summary"); else if (!location.hash) setTab("dictation");
        if (gateDone && tab !== was) { if (tab === "summary") Sum.focusCurrent(); else App.focusCurrent(); }
      });
    } catch (e) { $("wl-tabs").hidden = true; $("wl-summary").hidden = true; }
  }

  if (SITE.bio) { const bio = $("wl-bio"); bio.textContent = SITE.bio; bio.hidden = false; }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { drawScope(0); }, 120);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { paintClock(new Date()); readouts(); }
  });

  tickClock();
  paintThemeButtons();
  readouts();
  initGate();
})();
