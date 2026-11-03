/* The screen between login and the room: the intro video, then hello world on white.
   It only plays media and reports its timing; progress and the room belong to js/site.js. */
(function (root) {
  "use strict";

  const LAND = "assets/loader-intro.mp4", PORT = "assets/loader-intro-portrait.mp4";
  const START_WAIT_MS = 1500, STALL_MS = 700, VIDEO_MAX_MS = 5500, HELLO_MS = 1200, FADE_MS = 500, SAFETY_MS = 8000, PRESS_GRACE_MS = 350;
  const calm = () => root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lean = () => { const c = navigator.connection; return !!(c && c.saveData); };
  const pick = () => (root.innerHeight > root.innerWidth ? PORT : LAND);

  /* Fetched while the login page waits, so the first frame is ready when the button is pressed.
     Called again at play, because the window may have rotated since. */
  let early = null;
  function prepare() {
    if (calm() || lean()) return null;
    if (!early) {
      early = document.createElement("video");
      early.className = "wl-loader-video";
      early.muted = true;
      early.defaultMuted = true;
      early.playsInline = true;
      early.preload = "auto";
      early.setAttribute("playsinline", "");
      early.setAttribute("muted", "");
      early.setAttribute("aria-hidden", "true");
    }
    const want = pick();
    if (early.getAttribute("src") !== want) { early.src = want; early.load(); }
    return early;
  }

  function play(opts) {
    const reveal = opts && opts.reveal, done = opts && opts.done, html = document.documentElement;
    const box = document.createElement("div");
    box.className = "wl-loader";
    const hello = document.createElement("p");
    hello.className = "wl-loader-hello";
    hello.lang = "en";
    hello.setAttribute("role", "status");
    const video = prepare();
    if (video) box.appendChild(video);
    box.appendChild(hello);
    document.body.appendChild(box);
    /* A fixed box cannot cover a page scrollbar, and the room behind it scrolls once it opens. */
    html.classList.add("wl-loading");

    let stage = "video", revealed = false, finished = false, stallTimer = 0;
    const opened = performance.now(), timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
    const doReveal = () => { if (revealed) return; revealed = true; try { if (reveal) reveal(); } catch (e) { /* the page below stays usable */ } };

    function finish() {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      clearTimeout(stallTimer);
      document.removeEventListener("keydown", onKey);
      box.removeEventListener("click", skip);
      doReveal();
      if (video) { try { video.pause(); video.removeAttribute("src"); video.load(); } catch (e) { /* nothing left to stop */ } }
      box.remove();
      html.classList.remove("wl-loading");
      early = null;
      try { if (done) done(); } catch (e) { /* the room is already showing */ }
    }
    function fadeOut(ms) {
      stage = "fade";
      box.style.setProperty("--wl-loader-fade", ms + "ms");
      box.classList.add("is-leaving");
      later(finish, ms);
    }
    function showHello() {
      if (stage !== "video") return;
      stage = "hello";
      clearTimeout(stallTimer);
      box.classList.add("is-white");
      if (video) video.pause();
      hello.textContent = "hello world";
      doReveal();
      later(() => { fadeOut(FADE_MS); }, HELLO_MS);
    }
    /* On click rather than pointerdown, so no click is left over to land on the room behind. The press that logged in does not count. */
    function skip() {
      if (stage === "fade" || performance.now() - opened < PRESS_GRACE_MS) return;
      timers.forEach(clearTimeout);
      timers.length = 0;
      clearTimeout(stallTimer);
      box.classList.add("is-white");
      if (video) video.pause();
      doReveal();
      fadeOut(200);
    }
    function onKey(e) {
      if (e.repeat || e.key === "Tab" || e.key === "Shift") return;
      e.preventDefault();
      skip();
    }
    document.addEventListener("keydown", onKey);
    box.addEventListener("click", skip);
    /* Hidden tabs pause video and animation frames, so the way out cannot depend on them. */
    later(finish, SAFETY_MS);

    if (!video) { showHello(); return; }
    let started = false;
    video.addEventListener("playing", () => { started = true; clearTimeout(stallTimer); box.classList.add("is-playing"); });
    /* A slow connection goes to the white screen rather than crawling through the video. */
    video.addEventListener("waiting", () => { if (started) { clearTimeout(stallTimer); stallTimer = setTimeout(showHello, STALL_MS); } });
    video.addEventListener("ended", showHello, { once: true });
    video.addEventListener("error", showHello, { once: true });
    later(() => { if (!started) showHello(); }, START_WAIT_MS);
    later(showHello, VIDEO_MAX_MS);
    const p = video.play();
    if (p && p.catch) p.catch(showHello);
  }

  root.WLIU_LOADER = { play, prepare };
})(window);
