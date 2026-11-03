/* 听句概括: views, speech and the optional YouTube player. Own storage key, own root element.
   User text reaches the page only through esc() or textContent, and leaves this browser only if the visitor exports it.
   The YouTube script is requested only from loadPlayer(), which only runs from a click. Captions are never read. */
(function (root) {
  "use strict";

  const C = root.WLIU_LISTENING_CORE, Y = root.WLIU_SUMMARY_CORE;
  const { esc } = C;
  const { DATA, PASSAGES, BY_ID } = Y;

  const RATE = C.RATE, SLOW_RATE = 0.7, GAP_MS = 700;
  const ICON_PLAY = '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M3.5 9.2v5.6h3.9l5.1 4.2V5L7.4 9.2z" fill="currentColor"/><path d="M15.8 8.6a4.8 4.8 0 0 1 0 6.8M18.4 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
  const NOTICE = "此模式仅供个人练习；视频和字幕归原权利方所有，本站不存储视频或字幕，请遵守来源平台与内容方的规则；TED 等内容可能禁止截断、商业使用或用于 AI，公开传播或盈利前请先取得许可。";
  const NOT_AI = "这是你自己对照要点的自评，不是 AI 判分，也不影响 EXP 和等级。";
  const EMPTY_PROMPT = "先写下你听到的大意，一两句就行，中文或英文都可以。这次不算失败，也没有记录。";

  const SHELL =
    '<div class="ls-sr" id="sm-live" role="status" aria-atomic="true"></div>' +
    '<div class="ls-warnbox" id="sm-save-warn" role="alert" hidden>无法保存到这个浏览器，刷新后这部分记录会丢失。可以先用导出备份。</div>' +
    '<div class="ls-warnbox ls-stack" id="sm-load-warn" role="alert" hidden></div>' +
    '<input type="file" id="sm-import-file" class="ls-sr" accept=".json,application/json" tabindex="-1" aria-label="选择要导入的记录文件">' +
    '<div class="ls-view" id="sm-top">' +
      '<header class="ls-head"><div><h2 class="ls-home-title" id="sm-title" tabindex="-1">听句概括</h2><div class="ls-when">听一句或几句英语，用自己的话说出意思</div></div></header>' +
      '<div class="ls-seg" role="group" aria-label="素材来源">' +
        '<button type="button" data-act="mode" data-v="own" aria-pressed="true">原创素材</button>' +
        '<button type="button" data-act="mode" data-v="video" aria-pressed="false">自带视频</button>' +
      "</div>" +
    "</div>" +
    '<div class="ls-view" id="sm-m1"></div>' +
    '<div class="ls-view" id="sm-m2" hidden>' +
      '<div class="ls-warnbox sm-notice">' + NOTICE + "</div>" +
      '<section class="ls-card ls-pad ls-stack" aria-labelledby="sm-v1"><h2 class="ls-mark" id="sm-v1">1 · 粘贴你自己的视频链接</h2>' +
        '<label for="sm-url">YouTube 链接</label>' +
        '<input class="sm-input" id="sm-url" type="url" inputmode="url" autocomplete="off" spellcheck="false" maxlength="' + Y.LIMITS.url + '" placeholder="https://www.youtube.com/watch?v=…">' +
        '<div class="ls-row"><button type="button" class="ls-btn" data-act="load-player">加载 YouTube 播放器</button></div>' +
        '<div class="ls-note">点这个按钮之后，浏览器才会连接 YouTube；在此之前不会向它发送任何请求。不会自动播放。点击加载即表示你同意 <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube 服务条款</a>，数据处理适用 <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google 隐私权政策</a>；连接后 YouTube 可能写入 Cookie，你粘贴的链接里的视频 ID 也会发给它。</div>' +
        '<div class="ls-warnbox" id="sm-url-msg" role="alert" hidden></div>' +
        '<div id="sm-player-note" class="ls-note" role="status"></div>' +
        '<div class="sm-player-wrap" id="sm-player-wrap" hidden><div id="sm-player-slot"></div></div>' +
        '<div class="ls-warnbox" id="sm-player-err" role="alert" hidden><span id="sm-player-err-text"></span> <a id="sm-open-link" href="#" target="_blank" rel="noopener noreferrer">到 YouTube 打开这个视频</a></div>' +
      "</section>" +
      '<section class="ls-card ls-pad ls-stack" aria-labelledby="sm-v2"><h2 class="ls-mark" id="sm-v2">2 · 选一个片段</h2>' +
        '<div class="sm-times">' +
          '<div class="ls-stack"><label for="sm-start">起点（分:秒）</label><input class="sm-input" id="sm-start" type="text" inputmode="text" autocomplete="off" placeholder="0:30" maxlength="8"><button type="button" class="ls-btn ls-quiet ls-sm" data-act="mark-start" disabled>标记起点</button></div>' +
          '<div class="ls-stack"><label for="sm-end">终点（分:秒）</label><input class="sm-input" id="sm-end" type="text" inputmode="text" autocomplete="off" placeholder="0:45" maxlength="8"><button type="button" class="ls-btn ls-quiet ls-sm" data-act="mark-end" disabled>标记终点</button></div>' +
        "</div>" +
        '<div class="ls-row"><button type="button" class="ls-btn" data-act="play-seg" disabled>播放片段</button><button type="button" class="ls-btn ls-ghost" data-act="replay-seg" disabled>重播</button><span class="ls-note" id="sm-seg-count"></span></div>' +
        '<div class="ls-warnbox" id="sm-seg-msg" role="alert" hidden></div>' +
        '<div class="ls-note" id="sm-seg-status" role="status"></div>' +
        '<div class="ls-note sm-clock" id="sm-seg-clock"></div>' +
        '<div class="ls-note">YouTube 的文档说明，跳转到起点时可能提前最多约 2 秒，所以开头可能多听到一点；要从更准的位置开始，可以把起点标晚一点。到终点后本站会暂停视频。</div>' +
      "</section>" +
      '<section class="ls-card ls-pad ls-stack" aria-labelledby="sm-v3"><h2 class="ls-mark" id="sm-v3">3 · 概括，再自己核对</h2>' +
        '<label for="sm-v-summary">我听到的大意（中文或英文）</label>' +
        '<textarea class="sm-text" id="sm-v-summary" rows="3" maxlength="' + Y.LIMITS.text + '"></textarea>' +
        '<div class="ls-note">写完之后，在播放器里自己打开字幕（CC）再听一遍，把漏掉的内容记在下面。本站不读取、不保存字幕。</div>' +
        '<label for="sm-v-missed">我漏掉了什么</label>' +
        '<textarea class="sm-text" id="sm-v-missed" rows="2" maxlength="' + Y.LIMITS.text + '"></textarea>' +
        '<label for="sm-v-title">标题（可选，自己起）</label>' +
        '<input class="sm-input" id="sm-v-title" type="text" autocomplete="off" maxlength="' + Y.LIMITS.title + '">' +
        '<div class="ls-row"><button type="button" class="ls-btn" data-act="save-clip">保存到这台设备</button></div>' +
        '<div class="ls-note">只保存视频 ID、你写的标题、起止时间和笔记，不保存视频或字幕。</div>' +
        '<div class="ls-note" id="sm-clip-msg" role="status"></div>' +
      "</section>" +
      '<section class="ls-card ls-pad ls-stack" aria-labelledby="sm-v4" id="sm-clips-card"><h2 class="ls-mark" id="sm-v4" tabindex="-1">已保存的片段</h2><div class="ls-note">最多保存 ' + Y.LIMITS.clips + ' 条。</div><div id="sm-clips"></div></section>' +
    "</div>";

  const $ = (id) => document.getElementById(id);
  /* Emptied first and filled a moment later, so a message repeated word for word is still a change a screen reader announces. */
  let sayTimer = 0;
  function say(text) {
    const el = $("sm-live");
    if (!el) return;
    clearTimeout(sayTimer);
    el.textContent = "";
    sayTimer = setTimeout(() => { el.textContent = text; }, 60);
  }

  /* ---------- storage: its own keys, one set per profile, and nothing is read until mount knows the profile; a failed read or write never stops practice ---------- */
  let KEY = Y.KEY, RECOVERY_KEY = Y.RECOVERY_KEY;
  let saveFailed = false, copyFailed = false, armDiscard = false;
  function noteSave(ok) { saveFailed = !ok; const el = $("sm-save-warn"); if (el) el.hidden = ok; }
  /* Anything present that cannot be read is copied aside first, because the next save would otherwise overwrite it for good. */
  function loadStore() {
    try {
      const raw = localStorage.getItem(KEY), got = Y.readStored(raw);
      copyFailed = false;
      if (got.damaged) {
        try { localStorage.setItem(RECOVERY_KEY, raw); } catch (e) { copyFailed = true; }
      }
      return got.store;
    } catch (e) { saveFailed = true; return Y.blankStore(); }
  }
  function recoveryText() {
    try { return localStorage.getItem(RECOVERY_KEY); } catch (e) { return null; }
  }
  function paintLoadWarn() {
    const el = $("sm-load-warn");
    if (!el) return;
    const kept = recoveryText() !== null;
    el.hidden = !kept && !copyFailed;
    if (el.hidden) { el.innerHTML = ""; return; }
    el.innerHTML = kept
      ? '<div>这个浏览器里有一部分概括记录读不出来，可能已损坏或来自其他版本。能读的内容照常显示，读不出来的原始内容已另存一份，不会被之后的保存覆盖。</div>' +
        '<div class="ls-row"><button type="button" class="ls-link" data-act="recovery-export">导出原始内容</button>' +
        '<button type="button" class="ls-link" data-act="recovery-discard">' + (armDiscard ? "再点一次，删除这份原始内容" : "删除这份原始内容") + "</button></div>" +
        '<div id="sm-recovery-msg"></div><div id="sm-recovery-text"></div>'
      : "这个浏览器里有一部分概括记录读不出来，也没能另存一份。下次保存会覆盖它们。";
  }
  /* Returns whether it really reached storage, so the page never claims a save that did not happen. */
  function saveStore() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); noteSave(true); return true; }
    catch (e) { noteSave(false); return false; }
  }
  let store = Y.blankStore();

  /* ---------- outward events ---------- */
  const handlers = { view: [], speech: [] };
  function emit(name, v) { handlers[name].forEach((fn) => { try { fn(v); } catch (e) { /* a shell bug must not stop practice */ } }); }
  function on(name, fn) { if (handlers[name]) handlers[name].push(fn); }

  let App = null, mode = "own", level = "one", sess = null, active = false;

  /* ---------- speech: one utterance per sentence, counted only from real start events ---------- */
  const tts = { ok: "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function", failed: false };
  let play = null, token = 0, live = false;
  function setLive(v) { if (live !== v) { live = v; emit("speech", v); } }
  function clearPlayTimers() { if (play) { clearTimeout(play.startGuard); clearTimeout(play.endGuard); clearTimeout(play.gap); } }
  function stopSpeech() {
    token++;
    clearPlayTimers();
    play = null;
    try { if (tts.ok) window.speechSynthesis.cancel(); } catch (e) { /* nothing to stop */ }
    setLive(false);
  }
  function speechFailed() {
    stopSpeech();
    tts.failed = true;
    paintPlay();
    say("没有读出声音。");
  }
  function speakSentence(my, i) {
    if (my !== token || !play) return;
    const synth = window.speechSynthesis, text = play.sentences[i], rate = play.rate;
    play.idx = i; play.waiting = true;
    paintPlay();
    let u;
    try {
      u = new SpeechSynthesisUtterance(text);
      const info = App.voiceInfo();
      if (info.voice) { u.voice = info.voice; u.lang = info.voice.lang; } else u.lang = info.accent;
      u.rate = rate;
    } catch (e) { speechFailed(); return; }
    play.u = u; /* held so the engine's events are not lost when the object would otherwise be collected */
    u.onstart = () => {
      if (my !== token || !play) return;
      clearTimeout(play.startGuard);
      play.waiting = false;
      tts.failed = false;
      setLive(true);
      if (!play.counted && play.count && sess) { play.counted = true; sess.plays++; if (rate < RATE) sess.slowPlays++; }
      paintPlay();
    };
    u.onend = () => {
      if (my !== token || !play) return;
      clearTimeout(play.startGuard); clearTimeout(play.endGuard);
      setLive(false);
      if (i + 1 < play.sentences.length) {
        play.idx = -1;
        paintPlay();
        play.gap = setTimeout(() => speakSentence(my, i + 1), GAP_MS);
      } else {
        play = null;
        if (sess) sess.ended = true;
        paintPlay();
      }
    };
    u.onerror = (e) => {
      if (my !== token) return;
      if (e && (e.error === "interrupted" || e.error === "canceled")) return;
      speechFailed();
    };
    /* No start event means no sound was produced, and an engine that never ends counts as failed rather than as heard. */
    play.startGuard = setTimeout(() => { if (my === token) speechFailed(); }, 8000);
    const words = text.split(/\s+/).length;
    play.endGuard = setTimeout(() => { if (my === token) speechFailed(); }, (10 + (words * 0.7) / rate) * 1000);
    try { synth.resume(); synth.speak(u); } catch (e) { speechFailed(); }
  }
  function playPassage(rate, count) {
    if (!tts.ok || !sess) return;
    stopSpeech();
    sess.ended = false;
    const my = token;
    play = { sentences: sess.p.sentences, rate, count, counted: false, idx: 0, waiting: true };
    paintPlay();
    /* Cancel then wait: some engines drop an utterance queued in the same tick as a cancel. */
    setTimeout(() => speakSentence(my, 0), 60);
  }

  function voiceNote() {
    if (!tts.ok) return "";
    const info = App.voiceInfo(), label = (C.ACCENTS.find((a) => a[0] === info.accent) || C.ACCENTS[0])[1];
    if (!info.voice) return "读音：系统默认的英文声音。口音在「每日听写」的听写方式里切换。";
    const reg = String(info.voice.lang || "").replace("_", "-").split("-")[1] || "";
    const where = C.REGION[reg.toUpperCase()] ? "（" + C.REGION[reg.toUpperCase()] + "）" : "";
    return (info.exact ? "读音：" : "这台设备没有" + label + "，改用：") + info.voice.name + where + "。口音在「每日听写」的听写方式里切换。";
  }
  const speechUsable = () => tts.ok && !tts.failed;
  function noSpeechHTML() {
    const why = tts.ok
      ? "刚才没有读出声音，这台设备或浏览器可能没有可用的语音。先确认没有静音，再试一次。"
      : "当前环境不支持语音朗读，这里不会假装播放。换用手机或电脑自带的浏览器打开这一页就能听。";
    return '<div class="ls-warnbox">' + why + "</div>";
  }

  /* ---------- mode 1 home ---------- */
  const topicLabel = (p) => DATA.topics[p.topic];
  const levelOf = (id) => DATA.levels.find((l) => l.id === id);
  function pName(p) { return levelOf(p.level).label + " · 第 " + (Y.inLevel(p.level).indexOf(p) + 1) + " 段"; }
  let armClear = false, armClearTimer = 0, historyOpen = false, m1Msg = "";

  function refocusIn(el, sel) { const t = el.querySelector(sel); if (t) t.focus({ preventScroll: true }); }
  function focusKey(box) {
    const a = document.activeElement;
    if (!a || !box.contains(a)) return null;
    if (a.tagName === "SUMMARY") return "summary";
    if (!a.dataset.act) return null;
    return '[data-act="' + a.dataset.act + '"]' + (a.dataset.v ? '[data-v="' + a.dataset.v + '"]' : "");
  }
  function passageTile(p, last) {
    const st = last ? "上次听到 " + last.hits + " / " + p.keys.length + " 要点" : "未练";
    return '<button type="button" class="ls-tile" data-act="open" data-v="' + p.id + '">' +
      '<span class="ls-lno">第 ' + (Y.inLevel(p.level).indexOf(p) + 1) + " 段</span>" +
      '<span class="ls-tt">' + esc(topicLabel(p)) + "</span>" +
      '<span class="ls-st' + (last && last.hits < p.keys.length ? " sm-st-miss" : "") + '">' + st + "</span></button>";
  }
  function renderM1Home() {
    const box = $("sm-m1"), keep = focusKey(box), last = Y.latestById(store.attempts), missed = Y.missedIds(store.attempts);
    let h = '<section class="ls-card ls-pad ls-stack" aria-labelledby="sm-lv-h"><h2 class="ls-mark" id="sm-lv-h">选择难度</h2>';
    h += '<div class="ls-note">先听，原文不显示；写下大意后再对照要点。素材都是本站原创的。' + NOT_AI + "</div>";
    if (!speechUsable()) h += noSpeechHTML();
    else h += '<div class="ls-note">' + esc(voiceNote()) + "</div>";
    h += '<div class="ls-seg" role="group" aria-label="难度">' + DATA.levels.map((l) =>
      '<button type="button" data-act="level" data-v="' + l.id + '" aria-pressed="' + (level === l.id) + '">' + esc(l.label) + "</button>").join("") + "</div>";
    const done = Y.inLevel(level).filter((p) => last.has(p.id)).length;
    h += '<div class="ls-note">' + esc(levelOf(level).range) + "，共 5 段，练过 " + done + " 段。</div>";
    h += '<div class="sm-tiles">' + Y.inLevel(level).map((p) => passageTile(p, last.get(p.id))).join("") + "</div></section>";

    h += '<section class="ls-card ls-pad ls-stack" aria-labelledby="sm-miss-h"><div class="ls-sec-h"><h2 class="ls-mark" id="sm-miss-h">没听全的</h2><span class="ls-big-n' + (missed.length ? "" : " ls-zero") + '">' + missed.length + "</span></div>";
    if (missed.length) h += '<div class="ls-note">最近一次没有听到全部要点的段落。全部听到后自动移出。</div><div class="ls-row"><button type="button" class="ls-btn" data-act="retry-missed">重练这 ' + missed.length + " 段</button></div>";
    else h += '<div class="ls-note">' + (store.attempts.length ? "最近一次都听到了全部要点。" : "还没有记录。自评时标了「没听到」的段落会出现在这里。") + "</div>";
    h += "</section>";

    h += '<section class="ls-card ls-pad ls-stack" aria-labelledby="sm-his-h"><h2 class="ls-mark" id="sm-his-h" tabindex="-1">我的记录</h2>';
    h += '<div class="ls-note">只保存在这个浏览器里，和听写进度分开存放，不会上传。共 ' + store.attempts.length + " 条，最多保留 " + Y.LIMITS.attempts + " 条，超出后最旧的会被移除。</div>";
    const importBtn = '<button type="button" class="ls-btn ls-quiet" data-act="import">导入记录</button>';
    if (!store.attempts.length) h += '<div class="ls-row">' + importBtn + "</div>";
    else {
      const rows = store.attempts.slice(-20).reverse().map((a) => {
        const p = BY_ID.get(a.id);
        return '<li><div class="sm-his-top"><span>' + esc(a.date) + " · " + esc(pName(p)) + "</span><span>听到 " + a.hits + " / " + p.keys.length + " · 重听 " + a.replays + " 次</span></div>" +
          '<div class="sm-user">' + esc(a.text) + "</div></li>";
      }).join("");
      h += '<details id="sm-history"' + (historyOpen ? " open" : "") + "><summary>查看最近 " + Math.min(20, store.attempts.length) + ' 条</summary><ol class="sm-list">' + rows + "</ol></details>";
      h += '<div class="ls-row"><button type="button" class="ls-btn ls-quiet" data-act="export-attempts">导出记录</button>' + importBtn +
        '<button type="button" class="ls-btn ls-quiet' + (armClear ? " ls-danger" : "") + '" data-act="clear-attempts">' + (armClear ? "再点一次，清空概括记录" : "清空概括记录") + "</button></div>";
    }
    if (m1Msg) h += '<div class="ls-note">' + esc(m1Msg) + "</div>";
    h += "</section>";
    box.innerHTML = h;
    const d = $("sm-history");
    if (d) d.addEventListener("toggle", () => { historyOpen = d.open; });
    if (keep) refocusIn(box, keep);
  }

  /* ---------- mode 1 session ---------- */
  function setSessionView(on_) {
    $("sm-top").hidden = on_;
    emit("view", on_ ? "session" : "home");
  }
  function openPassage(id, queue) {
    const p = BY_ID.get(id);
    if (!p) return;
    stopSpeech();
    sess = { p, phase: "listen", plays: 0, slowPlays: 0, readOnly: false, text: "", marks: p.keys.map(() => null), queue: queue || null, saved: false, stored: false };
    level = p.level;
    m1Msg = "";
    setSessionView(true);
    renderListen();
    window.scrollTo(0, 0);
    $("sm-s-title").focus({ preventScroll: true });
  }
  function closeSession() {
    stopSpeech();
    sess = null;
    setSessionView(false);
    renderM1Home();
    window.scrollTo(0, 0);
    $("sm-title").focus({ preventScroll: true });
  }
  function sessionTop(sub) {
    return '<div class="ls-s-top"><h2 class="ls-s-title" id="sm-s-title" tabindex="-1">' + esc(pName(sess.p)) + " · " + esc(topicLabel(sess.p)) + " · " + sub + '</h2>' +
      '<div class="ls-s-right"><button type="button" class="ls-link" data-act="quit">退出</button></div></div>';
  }
  function renderListen() {
    let h = sessionTop("听");
    h += '<div class="ls-card ls-prompt">' +
      '<button type="button" class="ls-play" id="sm-play" data-act="play" aria-label="播放">' + ICON_PLAY + "</button>" +
      '<div class="ls-row ls-center"><button type="button" class="ls-btn ls-quiet ls-sm" id="sm-slow" data-act="slow">慢速重听</button>' +
      '<button type="button" class="ls-btn ls-quiet ls-sm" id="sm-stop" data-act="stop">停止</button></div>' +
      '<div class="sm-play-state" id="sm-play-state"></div>' +
      '<div class="sm-plays" id="sm-plays"></div></div>';
    h += '<div id="sm-tts-warn"></div><div id="sm-read-only"></div>';
    h += '<form id="sm-form" class="ls-stack" novalidate autocomplete="off"><label for="sm-text">用自己的话写下大意（中文或英文）</label>' +
      '<textarea class="sm-text" id="sm-text" rows="4" maxlength="' + Y.LIMITS.text + '"></textarea>' +
      '<div class="ls-warnbox" id="sm-hint" role="alert" hidden></div>' +
      '<div class="ls-actions"><button class="ls-btn" type="submit">提交，看要点</button></div></form>';
    $("sm-m1").innerHTML = h;
    $("sm-text").value = sess.text;
    paintPlay();
  }
  /* Updates only the status parts of the listening view, so whatever is being typed is never disturbed. */
  function paintPlay() {
    if (!sess) return;
    if (sess.phase !== "listen") { paintReviewPlay(); return; }
    const state = $("sm-play-state");
    if (!state) return;
    const usable = speechUsable();
    $("sm-play").disabled = !tts.ok;
    $("sm-slow").disabled = !tts.ok;
    paintStop($("sm-play"));
    const oldHint = $("sm-hint");
    if (oldHint && oldHint.dataset.k === "listen" && (sess.plays || sess.readOnly)) oldHint.hidden = true;
    $("sm-play").setAttribute("aria-label", sess.plays ? "重听" : "播放");
    const n = sess.p.sentences.length;
    state.textContent = !tts.ok ? "无法朗读" : !play ? (sess.ended ? "这一遍读完了，可以重听" : sess.plays ? "已停止，可以重听" : "点上面的按钮开始听") :
      play.waiting ? "正在准备声音…" : play.idx < 0 ? "句间停顿…" : n > 1 ? "正在读第 " + (play.idx + 1) + " / " + n + " 句" : "正在朗读";
    $("sm-plays").textContent = sess.plays
      ? "已听 " + sess.plays + " 遍（重听 " + (sess.plays - 1) + " 次" + (sess.slowPlays ? "，其中慢速 " + sess.slowPlays + " 遍" : "") + "）"
      : "还没有听";
    const warn = $("sm-tts-warn");
    const wantWarn = !usable && !sess.readOnly;
    if (wantWarn && !warn.firstChild) warn.innerHTML = '<div class="ls-stack">' + noSpeechHTML() + '<div class="ls-row"><button type="button" class="ls-btn ls-ghost" data-act="read-only">改为阅读原文（不计入记录）</button></div></div>';
    else if (!wantWarn && warn.firstChild) warn.innerHTML = "";
    const ro = $("sm-read-only");
    if (sess.readOnly && !ro.firstChild) ro.innerHTML = '<div class="ls-card ls-pad ls-stack"><div class="ls-warnbox">阅读模式：这不是听力练习，这一次不计入记录。</div><div class="sm-orig" lang="en">' + esc(Y.passageText(sess.p)) + "</div></div>";
  }
  /* Stop disables itself when nothing is playing; a keyboard user on it must not be left on a dead control. */
  function paintStop(next) {
    const b = $("sm-stop");
    if (!b) return;
    const had = document.activeElement === b;
    b.disabled = !play;
    if (had && b.disabled && next) next.focus({ preventScroll: true });
  }
  function nudge(msg, kind) {
    const hint = $("sm-hint");
    hint.textContent = msg;
    hint.dataset.k = kind || "";
    hint.hidden = false;
  }
  function onSubmit(e) {
    e.preventDefault();
    if (!sess || sess.phase !== "listen") return;
    const box = $("sm-text"), val = box.value.trim();
    sess.text = box.value;
    if (!sess.readOnly && !sess.plays) { nudge(tts.ok ? "你还没有听这一段。先点播放；如果读不出声音，页面会给出阅读选项。" : "这台设备读不出声音。可以点「改为阅读原文」，这一次不计入记录。", "listen"); return; }
    if (!val) { nudge(EMPTY_PROMPT); box.focus(); return; }
    stopSpeech();
    sess.text = val;
    sess.phase = "review";
    renderReview();
    window.scrollTo(0, 0);
    $("sm-s-title").focus({ preventScroll: true });
    say("已提交。下面是要点、参考概括和原文，请逐条自评。");
  }
  function keyRow(i) {
    const m = sess.marks[i], off = sess.saved ? " disabled" : "";
    return '<li class="sm-key"><span class="sm-key-t" id="sm-key-' + i + '">' + esc(sess.p.keys[i]) + "</span>" +
      '<div class="ls-seg sm-key-seg" role="group" aria-labelledby="sm-key-' + i + '">' +
      '<button type="button" data-act="key" data-i="' + i + '" data-v="1" aria-pressed="' + (m === 1) + '"' + off + ">听到</button>" +
      '<button type="button" data-act="key" data-i="' + i + '" data-v="0" aria-pressed="' + (m === 0) + '"' + off + ">没听到</button>" +
      "</div></li>";
  }
  function renderReview() {
    const p = sess.p, total = p.keys.length;
    let h = sessionTop("对照");
    if (sess.readOnly) h += '<div class="ls-warnbox">阅读模式：这一次不计入记录。</div>';
    h += '<section class="ls-card ls-pad ls-stack" aria-label="你写的概括"><h2 class="ls-mark">你写的概括</h2><div class="sm-user">' + esc(sess.text) + "</div></section>";
    h += '<section class="ls-card ls-pad ls-stack" aria-labelledby="sm-k-h"><h2 class="ls-mark" id="sm-k-h">要点自评</h2><div class="ls-note">' + NOT_AI + '</div><ol class="sm-keys">' + p.keys.map((_, i) => keyRow(i)).join("") + "</ol>";
    if (!sess.saved) h += '<div class="ls-warnbox" id="sm-hint" role="alert" hidden></div><div class="ls-row"><button type="button" class="ls-btn" data-act="finish">完成自评</button></div>';
    h += "</section>";
    if (sess.saved) {
      const hits = Y.countHits(sess.marks), missed = hits < total;
      h += '<section class="ls-card ls-sum" aria-labelledby="sm-r-h"><h2 class="ls-s-title" id="sm-r-h" tabindex="-1">结果</h2><div class="ls-score">' + hits + "<small> / " + total + ' 要点听到</small></div>';
      h += '<div class="ls-note">' + NOT_AI + "</div>";
      h += '<div class="ls-note">' + (sess.readOnly ? "阅读模式，没有保存，不计入记录。" : sess.stored ? "已保存在这台设备：今天，听到 " + hits + " / " + total + "，重听 " + Math.max(0, sess.plays - 1) + " 次。" : "这次没能保存到浏览器，刷新后会丢失。") + "</div>";
      if (sess.trimmed) h += '<div class="ls-note">记录已满 ' + Y.LIMITS.attempts + " 条，最旧的一条被移除了。</div>";
      /* A finished retry queue has nothing to go on to, so it offers the list instead of promising another passage. */
      const queueDone = sess.queue && !sess.queue.length;
      h += '<div class="ls-row">' + (queueDone ? "" : '<button type="button" class="ls-btn" data-act="next">' + (sess.queue ? "下一段没听全的" : "下一段") + "</button>") +
        '<button type="button" class="ls-btn ' + (queueDone ? "" : "ls-ghost") + '" data-act="again">' + (missed ? "重练这一段" : "再练一次这段") + "</button>" +
        '<button type="button" class="ls-btn ls-quiet" data-act="quit">回到列表</button></div></section>';
    }
    h += '<section class="ls-card ls-pad ls-stack" aria-labelledby="sm-ref-h"><h2 class="ls-mark" id="sm-ref-h">参考概括</h2><div>' + esc(p.zh) + '</div><div lang="en">' + esc(p.en) + "</div></section>";
    h += '<section class="ls-card ls-pad ls-stack" aria-labelledby="sm-o-h"><h2 class="ls-mark" id="sm-o-h">原文</h2><div class="sm-orig" lang="en">' + esc(Y.passageText(p)) + "</div>";
    if (tts.ok) h += '<div class="ls-row"><button type="button" class="ls-btn ls-quiet ls-sm" data-act="review-play">对照原文再听</button><button type="button" class="ls-btn ls-quiet ls-sm" data-act="stop" id="sm-stop">停止</button><span class="ls-note">提交后再听不计入重听次数。</span></div><div id="sm-review-warn"></div>';
    h += "</section>";
    $("sm-m1").innerHTML = h;
    paintReviewPlay();
  }
  function paintReviewPlay() {
    paintStop($("sm-m1").querySelector('[data-act="review-play"]'));
    const warn = $("sm-review-warn");
    if (!warn) return;
    /* Only after this button was tried, so a failure from the listening step is not shown as new. */
    const want = !!sess.triedReview && tts.failed;
    if (want && !warn.firstChild) warn.innerHTML = noSpeechHTML();
    else if (!want && warn.firstChild) warn.innerHTML = "";
  }
  function finishAssess() {
    const hits = Y.countHits(sess.marks);
    if (hits === null) {
      const left = sess.marks.filter((m) => m === null).length;
      nudge("还有 " + left + " 个要点没有选择。");
      return;
    }
    sess.saved = true;
    if (!sess.readOnly) {
      /* plays >= 1 is guaranteed here because submit requires it, so replays is never negative. */
      sess.trimmed = store.attempts.length >= Y.LIMITS.attempts;
      const rec = Y.addAttempt(store, { date: C.today(), id: sess.p.id, hits, replays: Math.max(0, sess.plays - 1), text: sess.text });
      sess.stored = !!rec && saveStore();
    }
    stopSpeech();
    renderReview();
    const r = $("sm-r-h");
    if (r) { r.focus({ preventScroll: true }); r.scrollIntoView({ block: "center" }); }
    say("听到 " + hits + " / " + sess.p.keys.length + " 个要点。这是自评，不是 AI 判分。");
  }
  function nextPassage() {
    if (sess.queue && sess.queue.length) { const q = sess.queue.slice(), id = q.shift(); openPassage(id, q); return; }
    if (sess.queue) { closeSession(); return; }
    const list = Y.inLevel(sess.p.level), i = list.indexOf(sess.p);
    openPassage(list[(i + 1) % list.length].id);
  }

  /* ---------- export: a local download, with text to copy where a webview refuses it ---------- */
  function offerExport(kind, name, msgFn, fallbackHost) {
    offerText(Y.exportDoc(kind, store, new Date().toISOString()), name, msgFn, fallbackHost);
  }
  function offerText(text, name, msgFn, fallbackHost) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = name; a.style.display = "none";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      msgFn("已生成 " + name + "。");
    } catch (e) {
      msgFn("这个环境不能直接下载，请手动复制下面的内容保存。");
      fallbackHost(text);
    }
  }

  /* ---------- import: only this section's own export files; adds, never replaces ---------- */
  const IMPORT_LIMIT = 8 * 1024 * 1024;
  function finishImport(msg) {
    renderClips();
    if (!sess && mode === "own") { m1Msg = msg; renderM1Home(); }
    if (mode === "own") say(msg);
    else $("sm-clip-export-msg").textContent = msg;
  }
  function readImport(file) {
    if (!file) return;
    const notOurs = "这个文件不是这里导出的记录，没有改动。";
    if (file.size > IMPORT_LIMIT) { finishImport(notOurs); return; }
    const reader = new FileReader();
    reader.onerror = () => finishImport("读不了这个文件，没有改动。");
    reader.onload = () => {
      const doc = Y.parseExport(String(reader.result));
      if (!doc) { finishImport(notOurs); return; }
      const r = Y.mergeExport(store, doc);
      const extra = (r.dupes ? "，" + r.dupes + " 条已经存在" : "") + (doc.bad ? "，" + doc.bad + " 条无效，已跳过" : "") + (r.skipped ? "，" + r.skipped + " 条超出上限，没有导入" : "");
      const what = doc.kind === "clips" ? "片段" : "概括记录";
      if (!r.added) { finishImport("没有新内容可导入" + extra + "，没有改动。"); return; }
      const ok = saveStore();
      finishImport("已导入 " + r.added + " 条" + what + extra + "。" + (ok ? "" : "没能写入浏览器，刷新后会丢失。"));
    };
    reader.readAsText(file);
  }

  /* ---------- mode 2: player ---------- */
  const API_URL = "https://www.youtube.com/iframe_api";
  const NOCOOKIE = "https://www.youtube-nocookie.com";
  const PLAYING = 1, ENDED = 0, PAUSED = 2, BUFFERING = 3;
  /* How long after leaving a starting segment a late start of playback still counts as that segment rather than the visitor's own press. */
  const LATE_START_MS = 5000;
  let player = null, playerReady = false, loadedId = "", apiState = "none", apiHooked = false, apiScript = null, apiTimer = 0, readyTimer = 0, pendingId = "";
  let playerGen = 0, pauseUntil = 0, mountEl = null;
  let seg = null, segTimer = 0, segPlays = 0, lastSeg = null, armDelete = -1, armDeleteTimer = 0;

  function showMsg(id, text) { const el = $(id); el.textContent = text || ""; el.hidden = !text; }
  function setPlayerNote(text) { $("sm-player-note").textContent = text || ""; }
  function showPlayerErr(text, id) {
    $("sm-player-err-text").textContent = text;
    const link = $("sm-open-link");
    if (id && Y.validId(id)) { link.href = Y.watchUrl(id); link.hidden = false; } else link.hidden = true;
    $("sm-player-err").hidden = false;
  }
  function clearPlayerErr() { $("sm-player-err").hidden = true; }
  function paintSegButtons() {
    ["mark-start", "mark-end", "play-seg"].forEach((a) => { $("sm-m2").querySelector('[data-act="' + a + '"]').disabled = !playerReady; });
    $("sm-m2").querySelector('[data-act="replay-seg"]').disabled = !playerReady || !lastSeg;
    $("sm-seg-count").textContent = segPlays ? "本次已播放片段 " + segPlays + " 次" : "";
  }

  function loadPlayer() {
    const parsed = Y.parseYouTube($("sm-url").value);
    if (!parsed.ok) { showMsg("sm-url-msg", parsed.msg); $("sm-url").focus(); return; }
    showMsg("sm-url-msg", "");
    clearPlayerErr();
    if (location.protocol === "file:") setPlayerNote("从本地文件直接打开时，YouTube 可能拒绝嵌入。如果失败，请通过 http(s) 地址访问这一页。");
    pendingId = parsed.id;
    if (player && playerReady) {
      stopSegment();
      if (loadedId !== parsed.id) { loadedId = parsed.id; lastSeg = null; segPlays = 0; $("sm-seg-status").textContent = ""; player.cueVideoById({ videoId: parsed.id }); }
      setPlayerNote("播放器已就绪，视频 ID：" + parsed.id + "。不会自动播放。");
      paintSegButtons();
      return;
    }
    if (player) { setPlayerNote("播放器还在启动，请稍候…"); return; } /* its onReady cues whatever pendingId says */
    if (root.YT && root.YT.Player) { createPlayer(); return; }
    if (apiState === "loading") return;
    apiState = "loading";
    setPlayerNote("正在连接 YouTube…");
    /* Installed once: a retry after a failed load must not chain a second handler that makes a second player. */
    if (!apiHooked) {
      apiHooked = true;
      const prior = root.onYouTubeIframeAPIReady;
      root.onYouTubeIframeAPIReady = () => {
        if (typeof prior === "function") { try { prior(); } catch (e) { /* not ours */ } }
        clearTimeout(apiTimer);
        if (apiState !== "loading") return; /* arrived after we gave up: the next click uses it */
        apiState = "ready";
        createPlayer();
      };
    }
    const apiFail = () => {
      clearTimeout(apiTimer);
      apiState = "none";
      if (apiScript) { apiScript.remove(); apiScript = null; }
      setPlayerNote("");
      showPlayerErr("连接不上 YouTube，播放器没有加载。可能是网络或浏览器阻止了它，本站不会绕过。", pendingId);
    };
    apiScript = document.createElement("script");
    apiScript.src = API_URL;
    apiScript.async = true;
    apiScript.onerror = apiFail;
    apiTimer = setTimeout(apiFail, 20000);
    document.head.appendChild(apiScript);
  }
  /* Throws away a player that never became ready, so the load button really starts again. */
  function resetPlayer() {
    const old = player;
    player = null;
    playerReady = false;
    playerGen++;
    try { if (old && old.destroy) old.destroy(); } catch (e) { /* it never worked anyway */ }
    const wrap = $("sm-player-wrap");
    wrap.innerHTML = '<div id="sm-player-slot"></div>';
    wrap.hidden = true;
    paintSegButtons();
  }
  const videoShowing = () => mode === "video" && !!mountEl && !mountEl.hidden;
  function createPlayer() {
    if (player) return;
    clearTimeout(apiTimer);
    const gen = ++playerGen;
    $("sm-player-wrap").hidden = false;
    loadedId = pendingId;
    const vars = { autoplay: 0, controls: 1, playsinline: 1, rel: 0 };
    if (/^https?:$/.test(location.protocol)) vars.origin = location.origin;
    setPlayerNote("正在启动播放器…");
    clearTimeout(readyTimer);
    readyTimer = setTimeout(() => {
      if (gen === playerGen && !playerReady) { resetPlayer(); setPlayerNote(""); showPlayerErr("播放器长时间没有就绪，可能被网络或浏览器阻止了。可以再点一次「加载 YouTube 播放器」重试。", loadedId); }
    }, 20000);
    try {
      player = new root.YT.Player("sm-player-slot", {
        width: "100%", height: "100%", host: NOCOOKIE, videoId: loadedId, playerVars: vars,
        events: {
          onReady: () => {
            if (gen !== playerGen) return;
            clearTimeout(readyTimer);
            playerReady = true;
            clearPlayerErr();
            if (pendingId !== loadedId) { loadedId = pendingId; player.cueVideoById({ videoId: loadedId }); }
            setPlayerNote("播放器已就绪，视频 ID：" + loadedId + "。不会自动播放。YouTube 的品牌和控件都保留在播放器里。");
            paintSegButtons();
          },
          onError: (e) => { if (gen === playerGen) onPlayerError(e && e.data); },
          onStateChange: (e) => {
            if (gen !== playerGen) return;
            /* A play request already on its way when the visitor left arrives after the pause, so it is stopped here. */
            if ((e.data === PLAYING || e.data === BUFFERING) && (!videoShowing() || performance.now() < pauseUntil)) {
              if (e.data === PLAYING) pauseUntil = 0;
              try { player.pauseVideo(); } catch (err) { /* player already gone */ }
              return;
            }
            if (seg && e.data === ENDED) finishSegment("视频结束了");
          }
        }
      });
    } catch (e) {
      clearTimeout(readyTimer);
      resetPlayer();
      setPlayerNote("");
      showPlayerErr("播放器启动失败。", loadedId);
    }
  }
  function onPlayerError(code) {
    stopSegment();
    let text;
    /* YouTube also reports these codes for some videos that are simply unavailable, so the message does not claim to know which. */
    if (code === 101 || code === 150) text = "这个视频不能在这里播放：所有者可能禁止在其他网站嵌入，也可能视频已不可用。";
    else if (code === 153) text = "YouTube 拒绝了这次嵌入请求（缺少来源信息），这里放不了。";
    else if (code === 100) text = "找不到这个视频，它可能已被删除或设为私有。";
    else if (code === 5) text = "这个视频无法在当前浏览器的播放器里播放。";
    else if (code === 2) text = "YouTube 认为这个视频 ID 无效。";
    else text = "播放器报告了错误（代码 " + code + "）。";
    showPlayerErr(text, loadedId);
  }

  /* ---------- mode 2: segment ---------- */
  function markTime(which) {
    if (!playerReady) return;
    const t = player.getCurrentTime();
    if (typeof t !== "number" || !isFinite(t)) return;
    $(which).value = Y.fmtTime(Y.round1(t));
    showMsg("sm-seg-msg", "");
  }
  function readSegment() {
    return { start: Y.parseTime($("sm-start").value), end: Y.parseTime($("sm-end").value) };
  }
  /* The status is a live region and only carries events; the running time goes in the clock, which is not announced. */
  function segStatus(text) { $("sm-seg-status").textContent = text; }
  function segClock(text) { $("sm-seg-clock").textContent = text; }
  function stopSegment() {
    clearInterval(segTimer);
    segTimer = 0;
    seg = null;
    segClock("");
  }
  function finishSegment(reason) {
    const target = seg ? seg.end : 0;
    stopSegment();
    segStatus(reason + "（终点 " + Y.fmtTime(target) + "）。");
    const line = () => {
      if (seg || !player || !playerReady) return;
      segClock("当前位置 " + Y.fmtTime(player.getCurrentTime()));
    };
    line();
    setTimeout(line, 500); /* the player reports its position a moment after it has really stopped */
  }
  function playSegment(range) {
    showMsg("sm-seg-msg", "");
    if (!playerReady) { showMsg("sm-seg-msg", "请先加载播放器。"); return; }
    const parsed = Y.parseYouTube($("sm-url").value);
    if (parsed.ok && parsed.id !== loadedId) { showMsg("sm-seg-msg", "链接已经改了，请先点「加载 YouTube 播放器」。"); return; }
    const dur = player.getDuration();
    const check = Y.checkSegment(range.start, range.end, dur);
    if (!check.ok) { showMsg("sm-seg-msg", check.msg); return; }
    stopSegment();
    lastSeg = { start: range.start, end: range.end };
    segPlays++;
    paintSegButtons();
    pauseUntil = 0;
    seg = { start: range.start, end: range.end, t0: performance.now(), below: false, played: false, waitSaid: false, pausedSaid: false };
    segStatus("正在跳到 " + Y.fmtTime(range.start) + "…");
    player.seekTo(range.start, true);
    player.playVideo();
    segTimer = setInterval(segTick, 100);
  }
  function segTick() {
    if (!seg || !player) return;
    const since = performance.now() - seg.t0, state = player.getPlayerState(), t = player.getCurrentTime();
    if (state !== PLAYING) {
      /* Blocked autoplay policy or a paused player: say so, and keep watching for the visitor pressing play. */
      if (!seg.played && since > 6000 && !seg.waitSaid) { seg.waitSaid = true; segStatus("视频还没有开始播放，可以直接点播放器里的播放键。"); }
      if (seg.played && state === PAUSED && !seg.pausedSaid) { seg.pausedSaid = true; segStatus("视频已暂停。继续播放的话，到 " + Y.fmtTime(seg.end) + " 暂停。"); }
      return;
    }
    if (!seg.played || seg.pausedSaid) segStatus((seg.played ? "片段继续" : "片段开始") + "，到 " + Y.fmtTime(seg.end) + " 暂停。");
    seg.played = true;
    seg.pausedSaid = false;
    /* Just after a seek the reported position can still be the old one, which on a replay is already past the end. */
    if (t < seg.end) seg.below = true;
    if (t >= seg.end - 0.05 && (seg.below || since > 1500)) {
      player.pauseVideo();
      finishSegment("已在终点暂停");
      return;
    }
    segClock("当前位置 " + Y.fmtTime(t));
  }
  function pauseVideoForLeave() {
    const running = !!seg, starting = running && !seg.played;
    stopSegment();
    if (running) segStatus("已离开这个页面，片段已暂停。");
    /* A segment still starting may report paused or buffering now and begin playing a moment later. */
    if (starting) pauseUntil = performance.now() + LATE_START_MS;
    try {
      if (player && playerReady) {
        const state = player.getPlayerState();
        if (running || state === PLAYING || state === BUFFERING) player.pauseVideo();
      }
    } catch (e) { /* player already gone */ }
  }

  /* ---------- mode 2: saved clips ---------- */
  /* Text in the video form that a reload would lose: anything other than the form as it was last saved or loaded from a clip. */
  const FORM_FIELDS = ["sm-url", "sm-start", "sm-end", "sm-v-summary", "sm-v-missed", "sm-v-title"];
  const formText = () => FORM_FIELDS.map((id) => { const el = $(id); return el ? el.value.trim() : ""; }).join("\n");
  let settledForm = "";
  function hasDraft() { const now = formText(); return /\S/.test(now) && now !== settledForm; }
  function saveClip() {
    const msg = $("sm-clip-msg");
    msg.textContent = "";
    const parsed = Y.parseYouTube($("sm-url").value);
    if (!parsed.ok) { msg.textContent = "没有保存：" + parsed.msg; return; }
    const r = readSegment(), check = Y.checkSegment(r.start, r.end);
    if (!check.ok) { msg.textContent = "没有保存：" + check.msg; return; }
    /* These are notes the visitor wrote, so reaching the limit never quietly deletes the oldest. */
    if (store.clips.length >= Y.LIMITS.clips) { msg.textContent = "没有保存：已经有 " + Y.LIMITS.clips + " 条片段，到上限了。请先删除一些；需要留底的话可以先导出。"; return; }
    const c = Y.addClip(store, {
      videoId: parsed.id, title: $("sm-v-title").value, start: r.start, end: r.end,
      notes: { summary: $("sm-v-summary").value, missed: $("sm-v-missed").value }
    });
    if (!c) { msg.textContent = "没有保存：这条内容无效。"; return; }
    const ok = saveStore();
    msg.textContent = ok ? "已保存到这台设备。" : "没能写入浏览器，刷新后会丢失，请先导出。";
    $("sm-v-summary").value = ""; $("sm-v-missed").value = ""; $("sm-v-title").value = "";
    if (ok) settledForm = formText();
    renderClips();
  }
  function renderClips() {
    const box = $("sm-clips"), keep = focusKey(box);
    const io = (exportBtn) => '<div class="ls-row">' + exportBtn + '<button type="button" class="ls-btn ls-quiet" data-act="import">导入 JSON</button></div><div class="ls-note" id="sm-clip-export-msg" role="status"></div><div id="sm-clip-export"></div>';
    if (!store.clips.length) { box.innerHTML = '<div class="ls-note">还没有保存的片段。</div>' + io(""); if (keep) refocusIn(box, keep); return; }
    const rows = store.clips.map((c, i) => ({ c, i })).reverse().map(({ c, i }) =>
      "<li>" +
        '<div class="sm-his-top"><span class="sm-clip-name">' + esc(c.title || "未命名片段") + "</span><span>" + esc(Y.fmtTime(c.start)) + " 到 " + esc(Y.fmtTime(c.end)) + "</span></div>" +
        '<div class="ls-note">视频 ID：<span class="ls-w">' + esc(c.videoId) + "</span></div>" +
        (c.notes.summary ? '<div class="ls-lbl">我听到的大意</div><div class="sm-user">' + esc(c.notes.summary) + "</div>" : "") +
        (c.notes.missed ? '<div class="ls-lbl">我漏掉了什么</div><div class="sm-user">' + esc(c.notes.missed) + "</div>" : "") +
        '<div class="ls-row"><button type="button" class="ls-btn ls-quiet ls-sm" data-act="clip-use" data-v="' + i + '">载入</button>' +
        '<button type="button" class="ls-btn ls-quiet ls-sm' + (armDelete === i ? " ls-danger" : "") + '" data-act="clip-del" data-v="' + i + '">' + (armDelete === i ? "再点一次，删除" : "删除") + "</button>" +
        '<a class="ls-note" href="' + esc(Y.watchUrl(c.videoId)) + '" target="_blank" rel="noopener noreferrer">到 YouTube 打开</a></div>' +
      "</li>").join("");
    box.innerHTML = '<ol class="sm-list">' + rows + "</ol>" + io('<button type="button" class="ls-btn ls-quiet" data-act="export-clips">导出 JSON</button>');
    if (keep) refocusIn(box, keep);
  }
  function useClip(i) {
    const c = store.clips[i];
    if (!c) return;
    $("sm-url").value = Y.watchUrl(c.videoId);
    $("sm-start").value = Y.fmtTime(c.start);
    $("sm-end").value = Y.fmtTime(c.end);
    $("sm-v-title").value = c.title;
    $("sm-v-summary").value = c.notes.summary;
    $("sm-v-missed").value = c.notes.missed;
    settledForm = formText();
    showMsg("sm-seg-msg", "");
    showMsg("sm-url-msg", "");
    $("sm-clip-msg").textContent = "已载入，保存时会另存一条。" + (playerReady ? "" : "要播放的话，请先点「加载 YouTube 播放器」。");
    if (playerReady && loadedId !== c.videoId) loadPlayer();
    $("sm-v1").scrollIntoView({ block: "start" });
    $("sm-url").focus({ preventScroll: true });
  }

  /* ---------- events ---------- */
  function setMode(v) {
    mode = v;
    $("sm-top").querySelectorAll('[data-act="mode"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
    $("sm-m1").hidden = v !== "own";
    $("sm-m2").hidden = v !== "video";
    if (v === "own") pauseVideoForLeave(); else stopSpeech();
    if (v === "video") renderClips(); else if (!sess) renderM1Home();
  }
  function onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const act = b.dataset.act, v = b.dataset.v;
    if (act === "mode") setMode(v);
    else if (act === "level") { level = v; renderM1Home(); }
    else if (act === "open") openPassage(v);
    else if (act === "retry-missed") { const q = Y.missedIds(store.attempts); const id = q.shift(); if (id) openPassage(id, q); }
    else if (act === "play") playPassage(RATE, true);
    else if (act === "slow") playPassage(SLOW_RATE, true);
    else if (act === "review-play") { if (sess) sess.triedReview = true; playPassage(RATE, false); }
    else if (act === "stop") { stopSpeech(); paintPlay(); say("已停止。"); }
    else if (act === "import") { const f = $("sm-import-file"); if (f) f.click(); }
    else if (act === "recovery-export") {
      const raw = recoveryText();
      if (raw !== null) offerText(raw, "listen-summary-recovery-" + C.today() + ".json", (m) => { $("sm-recovery-msg").textContent = m; }, (text) => {
        const ta = document.createElement("textarea");
        ta.className = "ls-export"; ta.readOnly = true; ta.rows = 6; ta.value = text; ta.setAttribute("aria-label", "原始内容，可手动复制");
        $("sm-recovery-text").appendChild(ta);
      });
    }
    else if (act === "recovery-discard") {
      if (!armDiscard) { armDiscard = true; paintLoadWarn(); refocusIn($("sm-load-warn"), '[data-act="recovery-discard"]'); return; }
      armDiscard = false;
      try { localStorage.removeItem(RECOVERY_KEY); } catch (e) { /* the warning simply stays */ }
      paintLoadWarn();
      focusCurrent();
    }
    else if (act === "read-only" && sess) { sess.readOnly = true; stopSpeech(); paintPlay(); say("阅读模式，这一次不计入记录。"); }
    else if (act === "key" && sess && !sess.saved) {
      const i = +b.dataset.i;
      sess.marks[i] = v === "1" ? 1 : 0;
      b.parentNode.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const hint = $("sm-hint"); if (hint) hint.hidden = true;
    }
    else if (act === "finish" && sess) finishAssess();
    else if (act === "next" && sess) nextPassage();
    else if (act === "again" && sess) openPassage(sess.p.id, sess.queue);
    else if (act === "quit") closeSession();
    else if (act === "export-attempts") {
      offerExport("attempts", "listen-summary-attempts-" + C.today() + ".json", (m) => { m1Msg = m; say(m); renderM1Home(); }, (text) => {
        const ta = document.createElement("textarea");
        ta.className = "ls-export"; ta.readOnly = true; ta.rows = 6; ta.value = text; ta.setAttribute("aria-label", "记录内容，可手动复制");
        $("sm-m1").appendChild(ta);
      });
    }
    else if (act === "clear-attempts") {
      clearTimeout(armClearTimer);
      if (!armClear) { armClear = true; armClearTimer = setTimeout(() => { armClear = false; if (!sess && mode === "own") renderM1Home(); }, 5000); }
      else {
        armClear = false; store.attempts = []; m1Msg = saveStore() ? "概括记录已清空。听写进度没有变化。" : "没能写入浏览器。";
        renderM1Home();
        say(m1Msg);
        $("sm-his-h").focus({ preventScroll: true }); /* the button pressed no longer exists */
        return;
      }
      renderM1Home();
    }
    else if (act === "load-player") loadPlayer();
    else if (act === "mark-start") markTime("sm-start");
    else if (act === "mark-end") markTime("sm-end");
    else if (act === "play-seg") {
      const r = readSegment();
      if (r.start === null) { showMsg("sm-seg-msg", Y.checkSegment(null, 0).msg); return; }
      if (r.end === null) { showMsg("sm-seg-msg", Y.checkSegment(0, null).msg); return; }
      playSegment(r);
    }
    else if (act === "replay-seg" && lastSeg) playSegment(lastSeg);
    else if (act === "save-clip") saveClip();
    else if (act === "clip-use") useClip(+v);
    else if (act === "clip-del") {
      const i = +v;
      clearTimeout(armDeleteTimer);
      if (armDelete !== i) { armDelete = i; armDeleteTimer = setTimeout(() => { armDelete = -1; renderClips(); }, 5000); renderClips(); return; }
      armDelete = -1;
      store.clips.splice(i, 1);
      const ok = saveStore();
      renderClips();
      $("sm-clip-msg").textContent = ok ? "已删除。" : "没能写入浏览器。";
      /* Rows show newest first, so the older neighbour takes this row's place on screen. */
      const nextDel = store.clips.length ? $("sm-clips").querySelector('[data-act="clip-del"][data-v="' + Math.max(0, i - 1) + '"]') : null;
      (nextDel || $("sm-v4")).focus({ preventScroll: true });
    }
    else if (act === "export-clips") {
      const host = $("sm-clip-export");
      host.textContent = "";
      offerExport("clips", "listen-summary-clips-" + C.today() + ".json", (m) => { $("sm-clip-export-msg").textContent = m; }, (text) => {
        const ta = document.createElement("textarea");
        ta.className = "ls-export"; ta.readOnly = true; ta.rows = 6; ta.value = text; ta.setAttribute("aria-label", "片段内容，可手动复制");
        host.appendChild(ta);
      });
    }
  }
  function onInput(e) {
    if (sess && e.target && e.target.id === "sm-text") {
      sess.text = e.target.value;
      const hint = $("sm-hint"); if (hint) hint.hidden = true;
    }
  }
  function onSubmitAny(e) { if (e.target && e.target.id === "sm-form") onSubmit(e); }
  function onChange(e) {
    const t = e.target;
    if (t && t.id === "sm-import-file") { const file = t.files && t.files[0]; t.value = ""; readImport(file); }
  }

  function mount(el, app, profile) {
    KEY = root.WLIU_PROFILE.keyFor(Y.KEY, profile);
    RECOVERY_KEY = root.WLIU_PROFILE.keyFor(Y.RECOVERY_KEY, profile);
    store = loadStore();
    App = app;
    mountEl = el;
    el.classList.add("ls-app");
    el.innerHTML = SHELL;
    el.addEventListener("click", onClick);
    el.addEventListener("input", onInput);
    el.addEventListener("submit", onSubmitAny);
    el.addEventListener("change", onChange);
    if (saveFailed) noteSave(false);
    paintLoadWarn();
    renderM1Home();
    renderClips();
    if (tts.ok) {
      const onVoices = () => { if (!sess && mode === "own") renderM1Home(); };
      try { window.speechSynthesis.addEventListener("voiceschanged", onVoices); } catch (e) { window.speechSynthesis.onvoiceschanged = onVoices; }
    }
    window.addEventListener("storage", (e) => {
      if (e.key === KEY || e.key === RECOVERY_KEY || e.key === null) { store = loadStore(); paintLoadWarn(); renderClips(); if (!sess && mode === "own") renderM1Home(); }
    });
    window.addEventListener("pagehide", hush);
  }
  /* Silence everything when this section stops being the one on screen. */
  function hush() { stopSpeech(); paintPlay(); pauseVideoForLeave(); }
  function focusCurrent() {
    const el = sess ? $("sm-s-title") : $("sm-title");
    if (el) el.focus({ preventScroll: true });
  }

  root.WLIU_SUMMARY = { mount, on, hush, focusCurrent, hasDraft, inSession: () => !!sess };
})(window);
