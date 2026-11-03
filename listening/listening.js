/* Daily listening app: views, session flow, speech and local storage. Mounted into one root element;
   every listener is delegated to that root so nothing leaks into the surrounding site. */
(function (root) {
  "use strict";

  const C = root.WLIU_LISTENING_CORE;
  const { LISTS, OFFSETS, RATE, SLOW, ACCENTS, REGION, SAMPLE, LAST_DAY, ITEMS, ZH_COUNT,
    learnDay, listItems, topic, today, fmtDate, plausibleStart, esc, grade, isRight, fixHTML, blank, sane, sanePrefs, parseImport, EXP_MAX, masteredCount, rankOf, rankUp } = C;

  const ICON_PLAY = '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M3.5 9.2v5.6h3.9l5.1 4.2V5L7.4 9.2z" fill="currentColor"/><path d="M15.8 8.6a4.8 4.8 0 0 1 0 6.8M18.4 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
  const STORAGE_NOTE = "进度只保存在这台设备的浏览器里，换设备或清除浏览器数据都不会保留。可以用「导出进度」备份。";
  const IMPORT_FAIL = "这个文件不是这里导出的进度，没有改动。";
  const IMPORT_LIMIT = 1024 * 1024;

  const VERDICT = { ok: "正确", alt: "正确，美式拼写也算对", near: "拼写对了，注意写法", homo: "同音词，这次算对" };

  const SHELL =
    '<div class="ls-sr" id="ls-live" role="status" aria-atomic="true"></div>' +
    '<div class="ls-warnbox" id="ls-save-warn" role="alert" hidden>无法保存进度，刷新后会丢失</div>' +
    '<section class="ls-view" id="ls-home" aria-label="每日任务面板"></section>' +
    '<section class="ls-view" id="ls-session" hidden aria-label="听写">' +
      '<div class="ls-s-top">' +
        '<div class="ls-s-title" id="ls-s-title"></div>' +
        '<div class="ls-s-right"><span class="ls-count" id="ls-s-count"></span><button type="button" class="ls-link" data-act="quit">退出</button></div>' +
      "</div>" +
      '<div class="ls-marks" id="ls-s-marks" aria-hidden="true"></div>' +
      '<div class="ls-card ls-prompt" id="ls-s-prompt"></div>' +
      '<div class="ls-card ls-fb" id="ls-s-fb" hidden></div>' +
      '<form id="ls-s-form" autocomplete="off" novalidate>' +
        '<div class="ls-answer" id="ls-s-box">' +
          '<label class="ls-no" id="ls-s-no" for="ls-s-input">1</label>' +
          '<input id="ls-s-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="go" maxlength="64" placeholder="在这里拼写">' +
        "</div>" +
        '<div class="ls-actions">' +
          '<button class="ls-btn" type="submit" id="ls-s-submit">提交</button>' +
          '<button class="ls-btn ls-quiet" type="button" id="ls-s-skip" data-act="skip">不会，看答案</button>' +
        "</div>" +
      "</form>" +
    "</section>" +
    '<section class="ls-view" id="ls-sum" hidden aria-label="本轮结果"></section>';

  const $ = (id) => document.getElementById(id);
  /* The live region is always rendered, so screen readers announce changes to its text. */
  function say(text) { const el = $("ls-live"); if (el && el.textContent !== text) el.textContent = text; }

  /* ---------- storage: this browser only, one set of keys per profile, and nothing is read until mount knows the profile ---------- */
  let KEY = C.KEY, PKEY = C.PKEY;
  let saveFailed = false;
  function noteSave(ok) {
    saveFailed = !ok;
    const el = $("ls-save-warn");
    if (el) el.hidden = !saveFailed;
  }
  function loadLocal() {
    try { return sane(JSON.parse(localStorage.getItem(KEY) || "null")); }
    catch (e) { if (!(e instanceof SyntaxError)) saveFailed = true; return null; }
  }
  function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); noteSave(true); } catch (e) { noteSave(false); } }
  function loadPrefs() { try { return JSON.parse(localStorage.getItem(PKEY) || "null"); } catch (e) { return null; } }
  function savePrefs() { try { localStorage.setItem(PKEY, JSON.stringify(prefs)); } catch (e) { noteSave(false); } }

  let S = blank();
  let prefs = sanePrefs(null);
  const M = C.model(() => S);
  const { status, daysOf, learned, doneToday, dayNo, wrongItems, allWrong, firstReview, plan, taskItems } = M;

  /* ---------- outward events for the site shell ---------- */
  const handlers = { view: [], speech: [], change: [] };
  function emit(name, value) { handlers[name].forEach((fn) => { try { fn(value); } catch (e) { /* a shell bug must not stop practice */ } }); }
  function on(name, fn) { if (handlers[name]) handlers[name].push(fn); }

  function persist() { saveLocal(); }
  /* Notes and export text describe the state they were made from, so any change to the state retires them. */
  function dropNotes() { exportText = ""; exportOffer = false; ioMsg = ""; ioBad = false; startMsg = ""; }
  function touch() { S.u = Date.now(); persist(); dropNotes(); emit("change"); }

  /* ---------- speech ---------- */
  const tts = { ok: "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function", voices: [], failed: false };
  const mode = () => (tts.ok ? prefs.mode : "zh");
  const langOf = (v) => String(v.lang || "").replace("_", "-").toLowerCase();
  let speaking = false, speakGuard = 0, startGuard = 0, goTimer = 0, appRoot = null;
  /* Reflects real utterance start and end events. Browsers expose no audio samples for speech. */
  function setSpeaking(v) {
    clearTimeout(speakGuard);
    if (v) speakGuard = setTimeout(() => setSpeaking(false), 6000);
    if (speaking === v) return;
    speaking = v;
    if (appRoot) appRoot.classList.toggle("is-speaking", v);
    emit("speech", v);
  }
  function loadVoices() {
    try { tts.voices = (window.speechSynthesis.getVoices() || []).filter((v) => /^en(-|$)/.test(langOf(v))); }
    catch (e) { tts.voices = []; }
  }
  function pickVoice() {
    const want = prefs.accent.toLowerCase();
    const same = tts.voices.filter((v) => langOf(v) === want);
    const pool = same.length ? same : tts.voices;
    const voice = pool.find((v) => /enhanced|premium|natural|neural/i.test(v.name)) || pool.find((v) => v.localService) || pool[0] || null;
    return { voice, exact: same.length > 0 };
  }
  function speak(text, rate) {
    if (!tts.ok) return;
    const synth = window.speechSynthesis;
    clearTimeout(startGuard);
    const go = () => {
      try {
        const u = new SpeechSynthesisUtterance(text);
        const p = pickVoice();
        if (p.voice) { u.voice = p.voice; u.lang = p.voice.lang; } else { u.lang = prefs.accent; }
        u.rate = rate;
        u.onstart = () => { clearTimeout(guard); setSpeaking(true); if (tts.failed) { tts.failed = false; repaintSpeech(); } };
        u.onend = () => { clearTimeout(guard); setSpeaking(false); };
        u.onerror = (e) => {
          clearTimeout(guard);
          setSpeaking(false);
          if (e && (e.error === "interrupted" || e.error === "canceled")) return;
          tts.failed = true;
          repaintSpeech();
        };
        /* No start event means no sound was produced, and a network voice that cannot connect may never report an error. */
        const guard = startGuard = setTimeout(() => {
          try { synth.cancel(); } catch (e) { /* nothing to stop */ }
          setSpeaking(false);
          tts.failed = true;
          repaintSpeech();
        }, 8000);
        synth.speak(u);
      } catch (e) { clearTimeout(startGuard); tts.failed = true; repaintSpeech(); }
    };
    /* Cancel then wait: some engines drop an utterance queued in the same tick as a cancel. */
    const waiting = goTimer;
    clearTimeout(goTimer);
    goTimer = 0;
    try { if (waiting || synth.speaking || synth.pending) { synth.cancel(); goTimer = setTimeout(() => { goTimer = 0; go(); }, 60); } else go(); } catch (e) { go(); }
  }
  function repaintSpeech() { if (view === "session" && sess) { paintSession(); keepForm(); } else if (view === "home") renderHome(); }
  function hush() { clearTimeout(startGuard); clearTimeout(goTimer); goTimer = 0; try { if (tts.ok) window.speechSynthesis.cancel(); } catch (e) { /* nothing to stop */ } setSpeaking(false); }

  /* ---------- view state: kept in variables because home re-renders replace its DOM ---------- */
  let view = "home", sess = null, picked = 0, armReset = false, armTimer = 0, wrongOpen = false, renderedDay = "";
  let ioMsg = "", ioBad = false, exportText = "", exportOffer = false, startMsg = "";
  let homeStale = false, rendering = false, pointerDown = false, renderAfterPointer = false, pointerTimer = 0;
  let pendingImport = null, armImport = false, armImportTimer = 0;
  const wide = window.matchMedia ? window.matchMedia("(min-width: 760px)") : { matches: false };
  const lhtml = (k) => '<span class="ls-lno">L' + k + "</span>" + esc(topic(k));

  function show(v) {
    view = v;
    $("ls-home").hidden = v !== "home";
    $("ls-session").hidden = v !== "session";
    $("ls-sum").hidden = v !== "sum";
    emit("view", v);
  }
  function segBtn(act, v, label, on_, off) {
    return '<button type="button" data-act="' + act + '" data-v="' + v + '" aria-pressed="' + (on_ ? "true" : "false") + '"' + (off ? " disabled" : "") + ">" + label + "</button>";
  }

  function taskRow(task) {
    const k = task.k, items = taskItems(task), done = doneToday(k), last = S.last[k];
    const tag = task.type === "new" ? '<span class="ls-tag ls-new">新学</span>' : task.type === "catch" ? '<span class="ls-tag ls-cu">补学</span>' : '<span class="ls-tag ls-rev">复习</span>';
    let meta;
    if (task.type === "review") meta = items.length === 25 && firstReview(k) ? "第 1 次复习：全部 25 词" : items.length ? "只练待攻克 " + items.length + " 词" : "待攻克已清空";
    else if (task.type === "catch") meta = "原定第 " + learnDay(k) + " 天 · 25 词";
    else meta = "25 词";
    let right;
    if (done) {
      if (last && last[2] === today()) meta = "今天已完成 · 对 " + last[0] + "/" + last[1];
      right = items.length ? '<button type="button" class="ls-btn ls-ghost" data-act="task" data-type="' + task.type + '" data-k="' + k + '">再练</button>' : '<span class="ls-done">✓ 完成</span>';
    } else if (!items.length) {
      right = '<span class="ls-done">✓ 已掌握</span>';
    } else {
      right = '<button type="button" class="ls-btn" data-act="task" data-type="' + task.type + '" data-k="' + k + '">开始</button>';
    }
    return '<div class="ls-task ls-task-' + task.type + '">' + tag + '<div class="ls-t-body"><div class="ls-t-name">' + lhtml(k) + '</div><div class="ls-t-meta">' + meta + "</div></div>" + right + "</div>";
  }

  function voiceLine() {
    if (!tts.voices.length) return "读音：点「试听」确认这台设备能发音。";
    const p = pickVoice();
    if (!p.voice) return "读音：系统默认的英文声音。";
    const reg = (langOf(p.voice).split("-")[1] || "").toUpperCase();
    const where = REGION[reg] ? "（" + REGION[reg] + "）" : "";
    const label = ACCENTS.find((a) => a[0] === prefs.accent)[1];
    return (p.exact ? "读音：" : "这台设备没有" + label + "，改用：") + esc(p.voice.name) + where + "。";
  }

  function modeCard() {
    const m = mode();
    let h = '<section class="ls-card ls-pad ls-stack" aria-label="听写方式"><h2 class="ls-mark">听写方式</h2>';
    h += '<div class="ls-seg" role="group" aria-label="听写方式">' + segBtn("mode", "audio", "听音写词", m === "audio", !tts.ok) + segBtn("mode", "zh", "看中文写英文", m === "zh", false) + "</div>";
    if (!tts.ok) {
      h += '<div class="ls-warnbox">当前环境读不出单词。用手机自带的浏览器（Safari 或 Chrome）打开这一页就能听音；也可以先用「看中文写英文」。</div>';
    } else if (m === "audio") {
      h += '<div class="ls-seg" role="group" aria-label="口音">' + ACCENTS.map((a) => segBtn("accent", a[0], a[1], prefs.accent === a[0], false)).join("") + "</div>";
      h += '<div class="ls-note">' + voiceLine() + ' <button type="button" class="ls-link" data-act="test">试听</button><br>考试里各种口音都有，熟了以后隔几天换一种。</div>';
      if (tts.failed) h += '<div class="ls-warnbox">刚才没有读出声音。先确认手机没开静音；还不行，换一种口音试试，或用手机自带的浏览器打开这一页。</div>';
    } else {
      h += '<div class="ls-note">看中文写出英文，适合没法出声的时候。</div>';
    }
    return h + "</section>";
  }

  function wrongCard() {
    const list = allWrong(), n = list.length;
    let h = '<section class="ls-card ls-pad ls-stack" aria-label="待攻克"><div class="ls-sec-h"><h2 class="ls-mark">待攻克</h2><span class="ls-big-n' + (n ? "" : " ls-zero") + '">' + n + "</span></div>";
    if (!n) return h + '<div class="ls-note">暂时没有待攻克的词。练习时拼错或点「不会」的词会自动收进来，之后答对一次就移出。</div></section>';
    h += '<div class="ls-note">拼错或点「不会」的词都在这里，答对一次就攻克。</div>';
    h += '<div class="ls-row"><button type="button" class="ls-btn" data-act="wrong">攻克全部</button></div>';
    h += '<details id="ls-wrong-list"' + (wrongOpen ? " open" : "") + "><summary>查看待攻克的词</summary><div class=\"ls-wl\">" +
      list.map((it) => '<div><span class="ls-w">' + esc(it.word) + '</span><span class="ls-zh">' + esc(it.zh) + '</span><span class="ls-from">L' + it.k + "</span></div>").join("") + "</div></details>";
    return h + "</section>";
  }

  function counts(k) {
    let ok = 0, bad = 0;
    listItems(k).forEach((it) => { const s = status(it.id); if (s === 1) ok++; else if (s === 0) bad++; });
    return { ok, bad };
  }
  function tile(k) {
    const c = counts(k), seen = c.ok + c.bad;
    const st = seen ? "✓" + c.ok + " ✗" + c.bad + (seen < 25 ? " · 未练" + (25 - seen) : "") : "未练";
    return '<button type="button" class="ls-tile" data-act="pick" data-k="' + k + '" aria-pressed="' + (picked === k ? "true" : "false") + '">' +
      '<span class="ls-lno">L' + k + " · 第 " + learnDay(k) + " 天</span>" +
      '<span class="ls-tt">' + esc(topic(k)) + "</span>" +
      '<span class="ls-st">' + st + "</span>" +
      '<span class="ls-bar" aria-hidden="true"><i class="ls-b-ok" style="width:' + c.ok * 4 + '%"></i><i class="ls-b-bad" style="width:' + c.bad * 4 + '%"></i></span>' +
      "</button>";
  }
  function pickPanel(k) {
    const n = wrongItems(k).length;
    return '<div class="ls-card ls-pick"><div class="ls-t-name">' + lhtml(k) + '</div><div class="ls-row">' +
      '<button type="button" class="ls-btn" data-act="list-all" data-k="' + k + '">全部 25 词</button>' +
      '<button type="button" class="ls-btn ls-ghost" data-act="list-wrong" data-k="' + k + '"' + (n ? "" : " disabled") + ">只练待攻克 " + n + "</button>" +
      '<button type="button" class="ls-link" data-act="pick" data-k="' + k + '">收起</button></div></div>';
  }
  function listsSection(learnedCount) {
    const tiles = [], cols = wide.matches ? 4 : 2;
    for (let k = 1; k <= LISTS.length; k++) tiles.push(tile(k));
    if (picked) { const i = picked - 1; tiles.splice(Math.min(i - (i % cols) + cols, tiles.length), 0, pickPanel(picked)); }
    return '<section class="ls-stack" aria-label="全部词表"><div class="ls-sec-h"><h2 class="ls-mark">全部词表</h2><span class="ls-note">已学 ' + learnedCount + " / " + LISTS.length + ' 组 · 点一组自选练习</span></div><div class="ls-grid">' + tiles.join("") + "</div></section>";
  }

  function transferBlock() {
    let h = '<div class="ls-row"><button type="button" class="ls-btn ls-quiet" data-act="export">导出进度</button>' +
      '<button type="button" class="ls-btn ls-quiet" data-act="import">导入进度</button>' +
      '<input type="file" id="ls-import-file" class="ls-sr" accept=".json,application/json" tabindex="-1" aria-label="选择进度文件"></div>';
    if (ioMsg) h += '<div class="' + (ioBad ? "ls-warnbox" : "ls-note") + '">' + esc(ioMsg) + "</div>";
    if (exportOffer) h += '<div class="ls-note">如果没有开始下载，<button type="button" class="ls-link" data-act="export-show">显示内容，手动复制</button>。</div>';
    if (exportText) h += '<textarea class="ls-export" id="ls-export-text" readonly rows="6" aria-label="进度内容，可手动复制">' + esc(exportText) + "</textarea>";
    if (pendingImport) {
      const st = pendingImport.state;
      const learnedN = LISTS.filter((_, i) => (st.l[i + 1] || []).length > 0).length;
      const wrongN = ITEMS.filter((it) => st.w[it.id] && st.w[it.id][0] === 0).length;
      h += '<div class="ls-confirm" role="group" aria-label="确认导入"><div id="ls-confirm-text">这个文件里：开始日期 ' + (st.start ? fmtDate(st.start) : "未设置") + "，已学 " + learnedN + " 组，待攻克 " + wrongN + " 个。</div>" +
        '<div class="ls-row"><button type="button" class="ls-btn ls-quiet' + (armImport ? " ls-danger" : "") + '" data-act="import-confirm" aria-describedby="ls-confirm-text">' + (armImport ? "再点一次，覆盖当前进度" : "覆盖当前进度") + "</button>" +
        '<button type="button" class="ls-link" data-act="import-cancel">取消</button></div></div>';
    }
    return h;
  }
  function settingsCard() {
    let h = '<section class="ls-card ls-pad ls-stack" aria-label="设置"><h2 class="ls-mark">设置</h2>';
    h += '<div class="ls-row"><label for="ls-start-date">开始日期（第 1 天）</label><input type="date" id="ls-start-date" value="' + (S.start || today()) + '"></div>';
    if (startMsg) h += '<div class="ls-warnbox">' + esc(startMsg) + "</div>";
    h += '<div class="ls-note">' + STORAGE_NOTE + "</div>";
    h += transferBlock();
    h += '<div class="ls-row"><button type="button" class="ls-btn ls-quiet' + (armReset ? " ls-danger" : "") + '" data-act="reset">' + (armReset ? "再点一次，清空全部进度" : "清空进度") + "</button></div>";
    return h + "</section>";
  }

  /* Keeps keyboard focus on the same control when home is rebuilt. */
  function focusKey() {
    const a = document.activeElement, home = $("ls-home");
    if (!a || !home || !home.contains(a)) return null;
    if (a.id) return "#" + a.id;
    if (a.tagName === "SUMMARY") return "#ls-wrong-list summary";
    if (!a.dataset.act) return null;
    return '[data-act="' + a.dataset.act + '"]' + (a.dataset.k ? '[data-k="' + a.dataset.k + '"]' : "") + (a.dataset.v ? '[data-v="' + a.dataset.v + '"]' : "") + (a.dataset.type ? '[data-type="' + a.dataset.type + '"]' : "");
  }

  function renderHome(force) {
    /* Rebuilding would replace the date field and restart whatever segment is being typed. */
    const active = document.activeElement;
    if (force !== true && active && active.id === "ls-start-date") { homeStale = true; emit("change"); return; }
    homeStale = false;
    const t = today(), p = plan(), N = p.N, keep = focusKey();
    renderedDay = t;
    const learnedCount = LISTS.filter((_, i) => learned(i + 1)).length;
    let h = '<header class="ls-head"><div><h2 class="ls-home-title" tabindex="-1" id="ls-title">任务面板</h2><div class="ls-when">' + fmtDate(t) + "</div></div>";
    if (N >= 1 && N <= LAST_DAY) h += '<div class="ls-dayno" role="img" aria-label="第 ' + N + " 天，共 " + LAST_DAY + ' 天"><span>第</span><b>' + N + "</b><span>天 / " + LAST_DAY + "</span></div>";
    h += "</header>";
    h += '<section class="ls-card" aria-label="每日任务"><div class="ls-card-h"><h2 class="ls-mark">每日任务</h2>' + (p.tasks.length ? '<span class="ls-note">共 ' + p.tasks.length + " 项</span>" : "") + "</div>";
    if (N < 1) h += '<div class="ls-msg ls-note">排期从 ' + fmtDate(S.start) + ' 开始。想现在就开始，可以<button type="button" class="ls-link" data-act="start-today">改成今天</button>。</div>';
    else if (N > LAST_DAY) h += '<div class="ls-msg ls-note">' + LAST_DAY + " 天的排期已经走完。接下来每天把待攻克练一遍，直到清空。</div>";
    else if (!p.tasks.length) h += '<div class="ls-msg ls-note">今天没有排到任务。可以练待攻克，或者在下面任选一组。</div>';
    else h += '<div class="ls-tasks">' + p.tasks.map(taskRow).join("") + "</div>";
    if (!S.start) h += '<div class="ls-msg ls-note">第一次开始练习的那天记为第 1 天，之后的新学和复习按排期自动出现。</div>';
    h += "</section>";
    h += '<div class="ls-duo">' + modeCard() + wrongCard() + "</div>" + listsSection(learnedCount) + settingsCard();
    rendering = true;
    $("ls-home").innerHTML = h;
    rendering = false;
    const d = $("ls-wrong-list");
    if (d) d.addEventListener("toggle", () => { wrongOpen = d.open; });
    if (keep) focusHome(keep);
    emit("change");
  }

  function focusHome(sel) { const el = $("ls-home").querySelector(sel); if (el) el.focus({ preventScroll: true }); }

  /* ---------- session ---------- */
  const cur = () => sess.items[sess.idx];
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function startSession(opt) {
    if (!opt.items.length) return;
    if (!S.start) { S.start = today(); touch(); }
    sess = { titleHTML: opt.titleHTML, k: opt.k || 0, items: shuffle(opt.items.slice()), idx: 0, res: [], phase: "ask", hint: false, m0: masteredCount(S) };
    picked = 0;
    show("session");
    $("ls-s-title").innerHTML = sess.titleHTML;
    const inp = $("ls-s-input");
    inp.value = "";
    paintSession();
    window.scrollTo(0, 0);
    keepForm();
    inp.focus({ preventScroll: true }); /* synchronous so the mobile keyboard opens */
    if (mode() === "audio") speak(cur().word, RATE);
  }
  function promptHTML(it) {
    if (mode() === "audio") {
      let h = '<button type="button" class="ls-play" data-act="play" aria-label="播放读音">' + ICON_PLAY + "</button>";
      h += '<div class="ls-row ls-center"><button type="button" class="ls-btn ls-quiet ls-sm" data-act="slow">慢速再听</button><button type="button" class="ls-btn ls-quiet ls-sm" data-act="hint">' + (sess.hint ? esc(it.zh) : "看中文提示") + "</button></div>";
      h += '<div class="ls-note">听到什么写什么。输入框空着时按回车也能重听。</div>';
      if (tts.failed) h += '<div class="ls-warnbox">没能读出这个词。<button type="button" class="ls-link" data-act="mode" data-v="zh">换成看中文写英文</button></div>';
      return h;
    }
    let h = '<div class="ls-zh-big">' + esc(it.zh) + "</div>";
    h += '<div class="ls-note">' + (ZH_COUNT[it.zh] > 1 ? "写出英文。这个中文对应两个词，这里要的以 " + esc(it.word[0]) + " 开头。" : "写出英文拼写。") + "</div>";
    if (tts.ok) h += '<button type="button" class="ls-btn ls-quiet ls-sm" data-act="play">听发音提示</button>';
    if (tts.ok && tts.failed) h += '<div class="ls-warnbox">没能读出声音。</div>';
    return h;
  }
  function feedbackHTML(it, r) {
    const g = r.g;
    let h = "";
    if (r.ok) {
      h += '<div class="ls-verdict">✓ ' + VERDICT[g.r] + "</div>";
      h += '<div class="ls-word">' + esc(it.word) + "</div>";
      if (g.r === "alt") h += '<div class="ls-tip">词表用英式拼写；考试里英式、美式都算对，同一份答卷尽量统一。</div>';
      if (g.r === "near") h += '<div class="ls-tip">标准写法是 ' + esc(it.word) + "，连字符和空格要照这个写。</div>";
      if (g.r === "homo") h += '<div class="ls-tip">你写的 ' + esc(r.attempt) + " 是另一个同音词，这里要的是 " + esc(it.word) + "（" + esc(it.zh) + "）。考试时靠上下文分辨。</div>";
    } else {
      h += '<div class="ls-verdict">✗ ' + (g.r === "skip" ? "答案是" : "正确拼写") + "</div>";
      h += '<div class="ls-word">' + esc(it.word) + "</div>";
      if (g.r === "bad") {
        const fx = fixHTML(r.attempt, it.word);
        if (fx) h += '<div class="ls-fixline"><span class="ls-lbl">改正</span><span class="ls-fix">' + fx + '</span></div><div class="ls-note">划掉的是多写的字母，下划线是漏写的字母。</div>';
        else h += '<div class="ls-fixline"><span class="ls-lbl">你写的</span><span class="ls-yours">' + esc(r.attempt) + "</span></div>";
      }
    }
    h += '<div class="ls-meaning"><span>' + esc(it.zh) + "</span>" + (it.note ? '<span class="ls-nt">' + esc(it.note) + "</span>" : "") + "</div>";
    return h;
  }
  /* In audio mode a new word announces nothing: a screen reader talking over the spoken word would ruin the question. */
  function liveText(it, fbPhase) {
    if (fbPhase) {
      const r = sess.res[sess.idx];
      const head = r.ok ? VERDICT[r.g.r] + "。" : r.g.r === "skip" ? "答案是 " : "拼写错误，正确拼写是 ";
      return head + it.word + "，" + it.zh;
    }
    const nth = "第 " + (sess.idx + 1) + " 词，共 " + sess.items.length + " 词。";
    if (mode() === "zh") return nth + it.zh + (ZH_COUNT[it.zh] > 1 ? "，以 " + it.word[0] + " 开头" : "");
    return sess.hint ? it.zh : "";
  }
  function paintSession() {
    const it = cur(), total = sess.items.length, fbPhase = sess.phase === "fb";
    $("ls-s-count").textContent = (sess.idx + 1) + " / " + total;
    $("ls-s-no").textContent = String(sess.idx + 1);
    $("ls-s-input").setAttribute("aria-label", "第 " + (sess.idx + 1) + " 词，拼写");
    $("ls-s-marks").innerHTML = sess.items.map((x, i) => {
      const r = sess.res[i];
      return '<span class="ls-mk' + (r ? (r.ok ? " ls-ok" : " ls-bad") : i === sess.idx ? " ls-cur" : "") + '">' + (r ? (r.ok ? "✓" : "✗") : "") + "</span>";
    }).join("");
    $("ls-s-prompt").innerHTML = promptHTML(it);
    $("ls-session").classList.toggle("ls-fb-on", fbPhase);
    const fb = $("ls-s-fb");
    if (fbPhase) { const r = sess.res[sess.idx]; fb.className = "ls-card ls-fb " + (r.ok ? "ls-ok" : "ls-bad"); fb.innerHTML = feedbackHTML(it, r); fb.hidden = false; }
    else { fb.hidden = true; fb.innerHTML = ""; }
    $("ls-s-submit").textContent = fbPhase ? (sess.idx + 1 >= total ? "看结果" : "下一个") : "提交";
    $("ls-s-skip").hidden = fbPhase;
    say(liveText(it, fbPhase));
  }
  /* Focus moves use preventScroll, so a repaint that grows the page has to bring the answer box and its button back on screen. */
  function keepForm() {
    const form = $("ls-s-form");
    form.scrollIntoView({ block: "nearest" });
    /* A phone keyboard can shrink only the visual viewport, which that call may not account for. */
    const vv = window.visualViewport;
    if (vv) { const over = form.getBoundingClientRect().bottom + 12 - (vv.offsetTop + vv.height); if (over > 0) window.scrollBy(0, over); }
  }
  function record(it, ok) {
    const prev = S.w[it.id];
    S.w[it.id] = [ok ? 1 : 0, (prev ? prev[1] : 0) + (ok ? 0 : 1), today()];
    touch();
  }
  function answer(val, g) {
    const it = cur(), ok = isRight(g);
    sess.res[sess.idx] = { ok, attempt: String(val).trim(), g };
    record(it, ok);
    sess.phase = "fb";
    paintSession();
    keepForm();
    if (!ok && mode() === "audio") speak(it.word, RATE);
  }
  function nudge() {
    const box = $("ls-s-box"), inp = $("ls-s-input");
    box.classList.add("ls-nudge"); inp.placeholder = "先写下拼写";
    setTimeout(() => { box.classList.remove("ls-nudge"); inp.placeholder = "在这里拼写"; }, 1400);
  }
  function next() {
    if (sess.idx + 1 >= sess.items.length) { finish(); return; }
    sess.idx++; sess.phase = "ask"; sess.hint = false;
    const inp = $("ls-s-input");
    inp.value = "";
    paintSession();
    window.scrollTo(0, 0); /* the prompt, which may have been scrolled past for the last feedback, is the question */
    keepForm();
    inp.focus({ preventScroll: true });
    if (mode() === "audio") speak(cur().word, RATE);
  }
  function finish() {
    const t = today(), total = sess.items.length, okc = sess.res.filter((r) => r && r.ok).length;
    if (sess.k) {
      const d = daysOf(sess.k).slice();
      if (d.indexOf(t) === -1) d.push(t);
      S.l[sess.k] = d.sort();
      S.last[sess.k] = [okc, total, t];
      touch();
    }
    renderSummary(okc, total);
    const line = renderReward(okc, total);
    show("sum");
    say("");
    window.scrollTo(0, 0);
    focusCurrent();
    /* After the focus move, which would otherwise talk over it. */
    setTimeout(() => { if (view === "sum" && $("ls-reward")) say(line); }, 150);
  }
  /* Reward window: only numbers from this session and the saved state. Returns the line for the live region. */
  function renderReward(okc, total) {
    const m0 = sess.m0, m1 = masteredCount(S), gain = m1 - m0, r = rankOf(m1), up = rankUp(m0, m1);
    const gainText = (gain > 0 ? "+" : "") + gain;
    const nextText = r.next ? "距" + r.next + "还差 " + r.toNext + " 词" : "已到最高等级";
    const box = document.createElement("section");
    box.className = "ls-reward";
    box.id = "ls-reward";
    box.setAttribute("aria-labelledby", "ls-reward-title");
    box.innerHTML = '<div class="ls-reward-head"><h2 class="ls-mark" id="ls-reward-title" tabindex="-1">本轮结算</h2></div>' +
      (up ? '<div class="ls-reward-up"><b>' + up + "</b><span>等级提升：" + rankOf(m0).rank + " → " + up + "</span></div>" : "") +
      '<dl class="ls-reward-stats"><div><dt>本轮答对</dt><dd>' + okc + "<small> / " + total + "</small></dd></div>" +
      "<div><dt>EXP 变化</dt><dd>" + gainText + "</dd></div>" +
      "<div><dt>已掌握</dt><dd>" + m1 + "<small> / " + EXP_MAX + "</small></dd></div>" +
      "<div><dt>当前等级</dt><dd>" + r.rank + "</dd></div></dl>" +
      '<div class="ls-reward-bar" aria-hidden="true"><i style="--from:' + (m0 / EXP_MAX).toFixed(4) + ";--to:" + (m1 / EXP_MAX).toFixed(4) + '"></i></div>' +
      '<div class="ls-reward-foot"><span class="ls-note">' + nextText + '</span><span class="ls-row"><span class="ls-kbd">按 Esc 关闭</span><button type="button" class="ls-btn ls-sm" data-act="reward-close">收下</button></span></div>';
    $("ls-sum").insertBefore(box, $("ls-sum").firstChild);
    return "本轮结算：答对 " + okc + " / " + total + "，EXP 变化 " + gainText + "，已掌握 " + m1 + " / " + EXP_MAX + "，等级 " + r.rank + "。" + (up ? "等级提升到 " + up + "。" : "");
  }
  function closeReward() {
    const box = $("ls-reward");
    if (!box) return;
    const a = document.activeElement, hadFocus = !a || a === document.body || box.contains(a);
    box.remove();
    say("");
    /* Someone already tabbed on into the results keeps their place. */
    if (hadFocus) { const t = $("ls-sum-title"); if (t) t.focus({ preventScroll: true }); }
  }
  function renderSummary(okc, total) {
    const wrong = sess.items.map((it, i) => ({ it, r: sess.res[i] })).filter((x) => x.r && !x.r.ok);
    let h = '<section class="ls-card ls-sum"><h2 class="ls-s-title" id="ls-sum-title" tabindex="-1">' + sess.titleHTML + " · 完成</h2>";
    h += '<div class="ls-score">' + okc + "<small> / " + total + "</small></div>";
    h += '<div class="ls-note">正确率 ' + Math.round((okc / total) * 100) + "%" + (wrong.length ? "，拼错的 " + wrong.length + " 个词已收进待攻克。" : "，全部拼对。") + "</div>";
    h += '<div class="ls-marks" aria-hidden="true">' + sess.items.map((_, i) => { const ok = sess.res[i] && sess.res[i].ok; return '<span class="ls-mk ' + (ok ? "ls-ok" : "ls-bad") + '">' + (ok ? "✓" : "✗") + "</span>"; }).join("") + "</div>";
    if (sess.k) {
      const base = learnDay(sess.k);
      h += '<div class="ls-note">这一组在排期里的复习日：' + OFFSETS.map((o) => "第 " + (base + o) + " 天").join("、") + "。</div>";
    }
    if (wrong.length) {
      h += '<div class="ls-wl">' + wrong.map((x) => '<div><span class="ls-w">' + esc(x.it.word) + '</span><span class="ls-zh">' + esc(x.it.zh) + '</span><span class="ls-from">L' + x.it.k + '</span><span class="ls-yours">' + (x.r.attempt ? "你写的：<s>" + esc(x.r.attempt) + "</s>" : "没写") + "</span></div>").join("") + "</div>";
    }
    h += '<div class="ls-row">' + (wrong.length ? '<button type="button" class="ls-btn" data-act="retry">再攻克这 ' + wrong.length + " 个词</button>" : "") +
      '<button type="button" class="ls-btn' + (wrong.length ? " ls-ghost" : "") + '" data-act="home">回到任务面板</button></div></section>';
    $("ls-sum").innerHTML = h;
  }
  function goHome() { hush(); sess = null; show("home"); say(""); renderHome(); window.scrollTo(0, 0); focusCurrent(); }
  function focusCurrent() {
    const el = view === "session" ? $("ls-s-input") : view === "sum" ? ($("ls-reward-title") || $("ls-sum-title")) : $("ls-title");
    if (el) el.focus({ preventScroll: true });
  }
  /* Home left open past midnight: a window kept in front never fires visibilitychange. */
  function refreshDay() { if (view === "home" && today() !== renderedDay) renderHome(); }

  /* ---------- export and import ---------- */
  function exportJSON() { return JSON.stringify({ app: "ielts-dictation", exportedAt: new Date().toISOString(), state: S, prefs }, null, 2); }
  function doExport() {
    const name = "ielts-progress-" + today() + ".json", text = exportJSON();
    exportText = ""; ioBad = false;
    try {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = name; a.style.display = "none";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      ioMsg = "已生成 " + name + "。"; exportOffer = true;
    } catch (e) {
      /* In-app webviews can refuse downloads: fall back to text the visitor can copy. */
      ioMsg = "这个环境不能直接下载，请手动复制下面的内容保存。"; exportOffer = false; exportText = text;
    }
    say(ioMsg);
    renderHome();
  }
  function disarmImport() { clearTimeout(armImportTimer); armImport = false; }
  function importFail() { pendingImport = null; disarmImport(); ioMsg = IMPORT_FAIL; ioBad = true; exportOffer = false; exportText = ""; say(IMPORT_FAIL); if (view === "home") renderHome(); }
  function readImport(file) {
    if (!file) return;
    if (file.size > IMPORT_LIMIT) { importFail(); return; }
    const reader = new FileReader();
    reader.onerror = importFail;
    reader.onload = () => {
      const parsed = parseImport(String(reader.result));
      if (!parsed) { importFail(); return; }
      pendingImport = parsed; disarmImport();
      ioMsg = ""; ioBad = false; exportOffer = false; exportText = "";
      if (view === "home") { renderHome(); focusHome('[data-act="import-confirm"]'); }
    };
    reader.readAsText(file);
  }
  function applyImport() {
    S = pendingImport.state; /* replaces, never merges; keeps the imported timestamp */
    if (pendingImport.prefs) { prefs.mode = pendingImport.prefs.mode; prefs.accent = pendingImport.prefs.accent; savePrefs(); }
    saveLocal();
    pendingImport = null; disarmImport(); picked = 0;
    ioMsg = "已导入。"; ioBad = false; exportText = ""; exportOffer = false; startMsg = "";
    say(ioMsg);
    renderHome();
    focusHome('[data-act="import"]');
  }

  /* ---------- events ---------- */
  function onSubmit(e) {
    e.preventDefault();
    if (!sess) return;
    if (sess.phase === "fb") { next(); return; }
    const val = $("ls-s-input").value, g = grade(val, cur(), mode());
    if (g.r === "empty") { if (mode() === "audio") speak(cur().word, RATE); else nudge(); return; }
    answer(val, g);
  }
  function onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const act = b.dataset.act, k = +b.dataset.k || 0;
    const refocus = () => { const inp = $("ls-s-input"); if (inp) inp.focus({ preventScroll: true }); };
    if (act === "task") {
      const type = b.dataset.type, items = taskItems({ type, k });
      const label = type === "new" ? "新学" : type === "catch" ? "补学" : items.length === 25 ? "复习" : "复习待攻克";
      startSession({ k, items, titleHTML: label + " · " + lhtml(k) });
    } else if (act === "list-all") startSession({ k, items: listItems(k), titleHTML: lhtml(k) + " · 全部" });
    else if (act === "list-wrong") startSession({ k, items: wrongItems(k), titleHTML: lhtml(k) + " · 待攻克" });
    else if (act === "wrong") startSession({ k: 0, items: allWrong(), titleHTML: "待攻克" });
    else if (act === "retry" && sess) {
      /* Reads the finished session's items before startSession replaces it. */
      const items = sess.items.filter((_, i) => sess.res[i] && !sess.res[i].ok);
      startSession({ k: sess.k, items, titleHTML: sess.titleHTML.replace(/ · 重练$/, "") + " · 重练" });
    }
    else if (act === "home" || act === "quit") goHome();
    else if (act === "reward-close") closeReward();
    else if (act === "mode") {
      prefs.mode = b.dataset.v; savePrefs();
      if (view === "session" && sess) { paintSession(); refocus(); if (mode() === "audio" && sess.phase === "ask") speak(cur().word, RATE); }
      else renderHome();
    }
    else if (act === "accent") { prefs.accent = b.dataset.v; savePrefs(); renderHome(); speak(SAMPLE, RATE); }
    else if (act === "test") speak(SAMPLE, RATE);
    else if (act === "play" && sess) { speak(cur().word, RATE); refocus(); }
    else if (act === "slow" && sess) { speak(cur().word, SLOW); refocus(); }
    else if (act === "hint" && sess) { sess.hint = true; paintSession(); refocus(); }
    else if (act === "skip" && sess && sess.phase === "ask") { answer("", { r: "skip" }); refocus(); }
    else if (act === "pick") { picked = picked === k ? 0 : k; renderHome(); }
    else if (act === "start-today") { S.start = today(); touch(); renderHome(); }
    else if (act === "reset") {
      clearTimeout(armTimer);
      if (!armReset) { armReset = true; armTimer = setTimeout(() => { armReset = false; if (view === "home") renderHome(); }, 5000); }
      else { armReset = false; S = blank(); picked = 0; touch(); }
      renderHome();
    }
    else if (act === "export") doExport();
    else if (act === "export-show") { exportText = exportJSON(); exportOffer = false; renderHome(); const ta = $("ls-export-text"); if (ta) { ta.focus({ preventScroll: true }); ta.select(); } }
    else if (act === "import") { const f = $("ls-import-file"); if (f) f.click(); }
    else if (act === "import-cancel") { pendingImport = null; disarmImport(); renderHome(); focusHome('[data-act="import"]'); }
    else if (act === "import-confirm" && pendingImport) {
      clearTimeout(armImportTimer);
      if (!armImport) { armImport = true; armImportTimer = setTimeout(() => { armImport = false; if (view === "home") renderHome(); }, 5000); renderHome(); }
      else applyImport();
    }
  }
  function onChange(e) {
    const t = e.target;
    if (!t) return;
    /* The start date is not handled here: a date field fires change for every typed digit. See commitStart. */
    if (t.id === "ls-import-file") { const file = t.files && t.files[0]; t.value = ""; readImport(file); }
  }

  /* Applies the start date once editing ends, on blur or Enter. Partial values never reach the schedule. */
  function commitStart(el, now) {
    if (el.value !== el.defaultValue) {
      if (plausibleStart(el.value)) { S.start = el.value; touch(); }
      else { startMsg = "这个日期不太对，已恢复原来的开始日期。"; say(startMsg); }
      homeStale = true;
    }
    if (!homeStale) return;
    if (now) { renderHome(true); return; }
    /* After the blur, so focus has landed and can be restored. A rebuild during a press would swallow its click. */
    setTimeout(() => { if (pointerDown) renderAfterPointer = true; else if (view === "home") renderHome(); }, 0);
  }
  function onFocusOut(e) {
    const t = e.target;
    /* Focus still on the field means the window lost focus, not the field. */
    if (!rendering && t && t.id === "ls-start-date" && document.activeElement !== t) commitStart(t, false);
  }
  function onKeydown(e) {
    if (e.key === "Enter" && e.target && e.target.id === "ls-start-date") { e.preventDefault(); commitStart(e.target, true); }
  }
  function trackPointer() {
    document.addEventListener("pointerdown", () => { clearTimeout(pointerTimer); pointerDown = true; }, true);
    const up = () => {
      /* A tap's mousedown, blur and click all follow pointerup, so this waits past them. */
      clearTimeout(pointerTimer);
      pointerTimer = setTimeout(() => {
        pointerDown = false;
        if (renderAfterPointer) { renderAfterPointer = false; if (view === "home") renderHome(); }
      }, 350);
    };
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
  }
  /* A date picked in the calendar popup leaves focus on the field, so it may still be uncommitted when the page goes. */
  function saveStartOnLeave() {
    const el = $("ls-start-date");
    if (el && el.value !== el.defaultValue && plausibleStart(el.value)) { S.start = el.value; el.defaultValue = el.value; touch(); }
  }

  function summary() {
    const p = plan();
    const open = p.tasks.filter((t) => !doneToday(t.k) && taskItems(t).length).length;
    return {
      date: today(), day: p.N, lastDay: LAST_DAY, inRange: p.N >= 1 && p.N <= LAST_DAY,
      tasks: p.tasks.length, open, wrong: allWrong().length,
      learned: LISTS.filter((_, i) => learned(i + 1)).length, lists: LISTS.length,
      mode: mode(), accent: (ACCENTS.find((a) => a[0] === prefs.accent) || ACCENTS[0])[1], speech: tts.ok, mastered: masteredCount(S), expMax: EXP_MAX, rank: rankOf(masteredCount(S))
    };
  }

  function mount(el, profile) {
    KEY = root.WLIU_PROFILE.keyFor(C.KEY, profile);
    PKEY = root.WLIU_PROFILE.keyFor(C.PKEY, profile);
    S = loadLocal() || blank();
    prefs = sanePrefs(loadPrefs());
    appRoot = el;
    el.classList.add("ls-app");
    el.innerHTML = SHELL;
    el.addEventListener("click", onClick);
    el.addEventListener("change", onChange);
    el.addEventListener("focusout", onFocusOut);
    el.addEventListener("keydown", onKeydown);
    trackPointer();
    /* The reward window never traps anything: Esc closes it from wherever focus has gone. */
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && view === "sum" && $("ls-reward")) closeReward(); });
    $("ls-s-form").addEventListener("submit", onSubmit);
    if (saveFailed) noteSave(false);

    if (tts.ok) {
      loadVoices();
      const onVoices = () => { loadVoices(); if (view === "home") renderHome(); };
      try { window.speechSynthesis.addEventListener("voiceschanged", onVoices); } catch (e) { window.speechSynthesis.onvoiceschanged = onVoices; }
    }
    /* The pick panel sits after its tile's row, so a column change has to re-splice it. */
    if (wide.addEventListener) wide.addEventListener("change", () => { if (view === "home" && picked) renderHome(); });
    /* Another tab saved: last write wins, but a home screen at rest can pick it up. */
    window.addEventListener("storage", (e) => {
      if ((e.key === KEY || e.key === null) && view === "home") { S = loadLocal() || blank(); dropNotes(); renderHome(); }
    });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshDay(); });
    window.addEventListener("focus", refreshDay);
    window.addEventListener("pageshow", refreshDay);
    window.addEventListener("pagehide", () => { saveStartOnLeave(); hush(); });

    if (location.protocol === "file:") root.__dictTest = { grade, fixHTML, plan, taskItems, learnDay, LAST_DAY, ITEMS, state: () => S, setStart: (s) => { S.start = s; } };

    renderHome();
    show("home");
  }

  /* Read-only: lets 听句概括 use the same voice and accent choice. */
  function voiceInfo() { loadVoices(); const p = pickVoice(); return { voice: p.voice, exact: p.exact, accent: prefs.accent }; }

  root.WLIU_LISTENING = { mount, on, summary, hush, focusCurrent, refreshDay, voiceInfo, inSession: () => view === "session" };
})(window);
