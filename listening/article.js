/* 文章精读: the article list, the unit view and its three steps. Own storage key, own root element.
   Speech goes through the dictation's own speak(), so voice, accent and failure reports are the same everywhere.
   What the learner types reaches the page only through esc() or .value, is never read aloud, and leaves this browser only if they export it. */
(function (root) {
  "use strict";

  const C = root.WLIU_LISTENING_CORE, A = root.WLIU_ARTICLE_CORE;
  const { esc } = C;
  const { ARTICLES, BY_ID } = A;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  const GAP_MS = 400;
  const ICON_PLAY = '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M3.5 9.2v5.6h3.9l5.1 4.2V5L7.4 9.2z" fill="currentColor"/><path d="M15.8 8.6a4.8 4.8 0 0 1 0 6.8M18.4 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
  const VERDICT = { ok: "正确", alt: "正确，这种拼写也算对", near: "拼写对了，注意写法", homo: "同音词，这次算对" };
  const NO_GRAMMAR = "这里判断不了语法：网站没有服务器，也没有 AI，不会给句子打分。它只看四件表面的事：有没有写、有没有用目标搭配、开头是否大写、结尾有没有标点，而且只提醒，不拦你。语法和意思要靠你自己对照范句和自查清单。";
  const NO_SPEECH = "当前环境不支持语音朗读，这里不会假装播放。换用手机或电脑自带的浏览器打开这一页就能听。";

  const SHELL =
    '<div class="ls-sr" id="ar-live" role="status" aria-atomic="true"></div>' +
    '<div class="ls-warnbox" id="ar-save-warn" role="alert" hidden>无法保存到这个浏览器，刷新后这部分进度会丢失。可以到「每日听写」的设置里先导出备份。</div>' +
    '<div class="ls-warnbox ls-stack" id="ar-load-warn" role="alert" hidden></div>' +
    '<section class="ls-view" id="ar-list" aria-label="文章列表"></section>' +
    '<section class="ls-view" id="ar-unit" hidden aria-label="文章精读">' +
      '<div class="ls-s-top">' +
        '<h2 class="ls-s-title" id="ar-u-title" lang="en"></h2>' +
        '<div class="ls-s-right"><span class="ls-count" id="ar-count"></span><button type="button" class="ls-link" data-act="quit">退出</button></div>' +
      "</div>" +
      '<ol class="ar-steps" id="ar-steps" aria-label="三个步骤"></ol>' +
      '<div class="ls-warnbox" id="ar-speech-warn" role="alert" hidden>刚才没有读出声音，这台设备或浏览器可能没有可用的语音。先确认没有静音，再试一次。</div>' +
      '<div class="ls-view" id="ar-body"></div>' +
      '<div class="ar-foot"><button type="button" class="ls-btn ls-quiet ls-sm" id="ar-restart" data-act="restart">重新开始这篇</button></div>' +
    "</section>";

  const $ = (id) => document.getElementById(id);
  /* Emptied first and filled a moment later, so a message repeated word for word is still a change a screen reader announces. */
  let sayTimer = 0;
  function say(text) {
    const el = $("ar-live");
    if (!el) return;
    clearTimeout(sayTimer);
    el.textContent = "";
    if (text) sayTimer = setTimeout(() => { el.textContent = text; }, 60);
  }

  /* ---------- storage: its own keys, one set per profile, and nothing is read until mount knows the profile; a failed read or write never stops practice ---------- */
  let KEY = A.KEY, RECOVERY_KEY = A.RECOVERY_KEY;
  let saveFailed = false, copyFailed = false, armDiscard = false;
  function noteSave(ok) { saveFailed = !ok; const el = $("ar-save-warn"); if (el) el.hidden = ok; }
  /* Anything present that cannot be read is copied aside first, because the next save would otherwise overwrite it for good. */
  function loadStore() {
    try {
      const raw = localStorage.getItem(KEY), got = A.readStored(raw);
      copyFailed = false;
      if (got.damaged) {
        /* The page promises later saves will not overwrite the copy, so a different damaged text joins it rather than replacing it. */
        try {
          const had = localStorage.getItem(RECOVERY_KEY);
          if (had === null) localStorage.setItem(RECOVERY_KEY, raw);
          else if (had.indexOf(raw) === -1) localStorage.setItem(RECOVERY_KEY, had + "\n\n" + raw);
        } catch (e) { copyFailed = true; }
      }
      return got.store;
    } catch (e) { saveFailed = true; return A.blankStore(); }
  }
  function recoveryText() {
    try { return localStorage.getItem(RECOVERY_KEY); } catch (e) { return null; }
  }
  function paintLoadWarn() {
    const el = $("ar-load-warn");
    if (!el) return;
    const kept = recoveryText() !== null;
    el.hidden = !kept && !copyFailed;
    if (el.hidden) { el.innerHTML = ""; return; }
    el.innerHTML = kept
      ? '<div>这个浏览器里有一部分文章进度读不出来，可能已损坏或来自其他版本。能读的内容照常显示，读不出来的原始内容已另存一份，不会被之后的保存覆盖；「清空进度」会连它一起删除。' + (copyFailed ? "不过最新这一次读不出来的内容没能另存，下次保存会覆盖它们。" : "") + "</div>" +
        '<div class="ls-row"><button type="button" class="ls-link" data-act="recovery-export">导出原始内容</button>' +
        '<button type="button" class="ls-link" data-act="recovery-discard">' + (armDiscard ? "再点一次，删除这份原始内容" : "删除这份原始内容") + "</button></div>" +
        '<div id="ar-recovery-out"></div>'
      : "这个浏览器里有一部分文章进度读不出来，也没能另存一份。下次保存会覆盖它们。";
  }
  function exportRecovery() {
    const raw = recoveryText(), out = $("ar-recovery-out");
    if (raw === null || !out) return;
    const name = "article-recovery-" + C.today() + ".json";
    out.textContent = "";
    try {
      const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = name; a.style.display = "none";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      out.textContent = "已生成 " + name + "。";
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.className = "ls-export"; ta.readOnly = true; ta.rows = 6; ta.value = raw; ta.setAttribute("aria-label", "原始内容，可手动复制");
      out.appendChild(ta);
    }
  }
  /* Returns whether it really reached storage, so the page never claims a save that did not happen. */
  function saveStore() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); noteSave(true); return true; }
    catch (e) { noteSave(false); return false; }
  }

  /* ---------- outward events ---------- */
  const handlers = { view: [] };
  function emit(name, v) { handlers[name].forEach((fn) => { try { fn(v); } catch (e) { /* a shell bug must not stop practice */ } }); }
  function on(name, fn) { if (handlers[name]) handlers[name].push(fn); }

  /* ---------- state: the store holds everything worth keeping; ui only says what is on screen right now ---------- */
  const freshUi = () => ({ phase: "ask", last: null, hint: false });
  let App = null, store = A.blankStore(), unit = null, rec = null, ui = freshUi();
  let armRestart = false, armRestartTimer = 0, draftTimer = 0, draftDirty = false, gloss = null, reading = -1;
  /* Finished units sit outside practice, so the tabs and the switch-user control come back there. */
  const paintView = () => emit("view", unit && rec.at !== "sum" ? "session" : "home");
  const practising = () => (rec.at === "dict" || rec.at === "cloze") && (rec[rec.at].queue.length > 0 || ui.phase === "fb");

  /* ---------- speech: everything goes through App.speak; token retires a run of pieces the moment anything else happens ---------- */
  const voice = () => App.voiceInfo();
  let token = 0, gapTimer = 0;
  function retireRun() { token++; clearTimeout(gapTimer); reading = -1; }
  function stopVoice() { retireRun(); App.hush(); paintReadState(); }
  function sayShort(text, rate) { retireRun(); paintReadState(); App.speak(text, rate); }
  /* Long text goes piece by piece, because some engines stop a long utterance part way through. para says which paragraph, if it is one. */
  function sayLong(text, para) {
    retireRun();
    if (para !== undefined) reading = para;
    paintReadState();
    const my = token, chunks = A.speechChunks(text);
    const step = (i) => {
      if (my !== token) return;
      /* An utterance cut off from outside, by another tab for one, never reports back, and the page must not go on saying it is reading. */
      const giveUp = setTimeout(() => { if (my === token) { retireRun(); paintReadState(); } }, (10 + (chunks[i].split(/\s+/).length * 0.7) / C.RATE) * 1000);
      App.speak(chunks[i], C.RATE, (ok) => {
        clearTimeout(giveUp);
        if (my !== token) return;
        if (ok && i + 1 < chunks.length) gapTimer = setTimeout(() => step(i + 1), GAP_MS);
        else { reading = -1; paintReadState(); }
      });
    };
    step(0);
  }
  function paintSpeechWarn() {
    const el = $("ar-speech-warn");
    if (!el) return;
    const v = App ? voice() : { ok: false, failed: false };
    /* The dictation prompt has its own line, which also offers the switch to Chinese. */
    el.hidden = !(unit && v.ok && v.failed && !(rec.at === "dict" && practising()));
  }
  function onTts() {
    if (!unit) return;
    if (practising()) paintDrill();
    paintSpeechWarn();
  }

  /* ---------- list ---------- */
  function cardHTML(a) {
    const r = own(store.articles, a.id) ? store.articles[a.id] : null;
    const f = r ? A.stepFlags(r) : { dict: false, write: false, read: false }, done = [f.dict, f.write, f.read];
    const steps = A.STEPS.map((s, i) => "<li" + (done[i] ? ' class="is-done"' : "") + ">" + (done[i] ? "✓ " : "") + s.label + '<span class="ls-sr">' + (done[i] ? "，已完成" : "，未完成") + "</span></li>").join("");
    const headId = "ar-card-" + a.id;
    return '<section class="ls-card ar-card" aria-labelledby="' + headId + '">' +
      '<h3 class="ar-card-title" id="' + headId + '" lang="en">' + esc(a.title) + "</h3>" +
      '<div class="ls-note">' + a.words.length + " 词 · " + a.paragraphs.length + " 段</div>" +
      '<ol class="ar-card-steps" aria-label="三个步骤">' + steps + "</ol>" +
      '<div class="ls-row"><button type="button" class="ls-btn' + (f.read ? " ls-ghost" : "") + '" data-act="open" data-v="' + a.id + '" aria-describedby="' + headId + '">' + (!r ? "开始" : f.read ? "回看" : "继续") + "</button></div></section>";
  }
  function renderList() {
    const box = $("ar-list"), a = document.activeElement;
    const keep = a && box.contains(a) && a.dataset.act ? '[data-act="' + a.dataset.act + '"]' + (a.dataset.v ? '[data-v="' + a.dataset.v + '"]' : "") : "";
    let h = '<header class="ls-head"><div><h2 class="ls-home-title" id="ar-title" tabindex="-1">文章精读</h2><div class="ls-when">一篇文章三步走：先听写词汇，再写句子，最后读原文</div></div></header>';
    if (A.SKIPPED) h += '<div class="ls-warnbox">有 ' + A.SKIPPED + " 篇文章的数据不完整，没有显示。打开 tests/logic-test.html 可以看到原因。</div>";
    h += ARTICLES.length ? '<div class="ar-cards">' + ARTICLES.map(cardHTML).join("") + "</div>" : '<div class="ls-note">还没有文章。</div>';
    h += '<div class="ls-note">三步按顺序解锁，学过的步骤可以回看。文章里的词和 500 词词库分开，不影响每日任务、待攻克、EXP 和等级。读音沿用「每日听写」里选的口音。</div>';
    h += '<div class="ls-note">进度只保存在这个浏览器里，和听写进度一起导出、导入和清空，这些按钮在「每日听写」的设置里。</div>';
    box.innerHTML = h;
    if (keep) { const el = box.querySelector(keep); if (el) el.focus({ preventScroll: true }); }
  }

  /* ---------- moving around ---------- */
  function showUnit(on_) { $("ar-unit").hidden = !on_; $("ar-list").hidden = on_; }
  function openUnit(id, pressed) {
    const a = BY_ID.get(id);
    if (!a) return;
    stopVoice();
    unit = a;
    if (!own(store.articles, id)) store.articles[id] = A.blankRecord(a);
    rec = store.articles[id];
    store.open = id;
    saveStore();
    ui = freshUi();
    gloss = null;
    disarmRestart();
    $("ar-u-title").textContent = a.title;
    showUnit(true);
    renderUnit();
    paintView();
    arrive(pressed);
  }
  /* The unit is gone from the screen but stays open in the store only if the caller leaves store.open set. */
  function dropUnit() {
    stopVoice();
    unit = null; rec = null;
    showUnit(false);
    paintView();
  }
  function closeUnit() {
    flushDraft();
    store.open = "";
    saveStore();
    dropUnit();
    renderList();
    window.scrollTo(0, 0);
    $("ar-title").focus({ preventScroll: true });
  }
  function goTo(at, pressed) {
    if (!unit || !A.canAt(rec, at)) return;
    flushDraft();
    stopVoice();
    rec.at = at;
    saveStore();
    ui = freshUi();
    gloss = null;
    renderUnit();
    paintView();
    arrive(pressed);
  }
  /* Speech can only start from a press: on a reload it would fail, and the page would wrongly report that the device cannot speak. */
  function arrive(pressed) {
    window.scrollTo(0, 0);
    focusCurrent();
    if (rec.at === "read" && rec.read.para > 0) { const p = $("ar-p-" + rec.read.para); if (p) p.scrollIntoView({ block: "start" }); }
    /* The shell comes back around a finished unit, which can push the result off a small screen. */
    if (rec.at === "sum") $("ar-body").scrollIntoView({ block: "nearest" });
    if (pressed && rec.at === "dict" && rec.dict.queue.length && voice().mode === "audio") sayShort(rec.dict.queue[0], C.RATE);
  }
  function focusCurrent() {
    /* A fill-in's feedback hides the answer box, and Enter goes on from the button. */
    const el = !unit ? $("ar-title") : (ui.phase === "fb" && !isDict() && $("ar-submit")) || $("ar-input") || $("ar-next") || $("ar-focus");
    if (el) el.focus({ preventScroll: true });
  }
  function renderUnit() {
    paintSteps();
    paintRestart();
    $("ar-count").textContent = "";
    const at = rec.at;
    if (at === "dict" || at === "cloze") { if (rec[at].queue.length) renderDrill(); else renderDrillDone(); }
    else if (at === "write") { if (rec.write.cur) renderWriteItem(); else renderWriteDone(); }
    else if (at === "read") renderRead();
    else renderSum();
    paintSpeechWarn();
  }
  function paintSteps() {
    const boxes = A.stepBoxes(rec), cur = rec.at === "sum" ? -1 : A.screenStep(rec.at);
    $("ar-steps").innerHTML = A.STEPS.map((s, i) => {
      const b = boxes[i];
      return '<li><button type="button" class="ar-step' + (b.done ? " is-done" : "") + '" data-act="step" data-v="' + i + '"' + (i === cur ? ' aria-current="step"' : "") + (b.open ? "" : " disabled") + ">" +
        '<span class="ar-step-n" aria-hidden="true">' + (b.done ? "✓" : s.n) + "</span><span>" + s.label + "</span>" +
        '<span class="ls-sr">，第 ' + s.n + " 步，" + (b.done ? "已完成" : b.open ? "未完成" : "未解锁") + "</span></button></li>";
    }).join("");
  }
  function paintRestart() {
    const b = $("ar-restart");
    b.textContent = armRestart ? "再点一次，清空这篇的进度" : "重新开始这篇";
    b.classList.toggle("ls-danger", armRestart);
  }
  function disarmRestart() { clearTimeout(armRestartTimer); armRestart = false; if ($("ar-restart")) paintRestart(); }
  /* Step 2 has two parts; this says which one is showing and opens the second once the first is finished. */
  function partSwitch() {
    return '<div class="ls-seg" role="group" aria-label="写句子的两部分">' +
      '<button type="button" data-act="go" data-v="cloze" aria-pressed="' + (rec.at === "cloze") + '">填句子</button>' +
      '<button type="button" data-act="go" data-v="write" aria-pressed="' + (rec.at === "write") + '"' + (A.canAt(rec, "write") ? "" : " disabled") + ">造句</button></div>";
  }
  function nextButton(at, label) { return '<button type="button" class="ls-btn" id="ar-next" data-act="go" data-v="' + at + '">' + label + "</button>"; }

  /* ---------- steps 1 and 2a: one queue, two kinds of question ---------- */
  const isDict = () => rec.at === "dict";
  const curId = () => (ui.phase === "fb" ? ui.last.id : rec[rec.at].queue[0]);
  function renderDrill() {
    const d = rec[rec.at];
    let h = isDict() ? "" : partSwitch();
    if (d.score) h += '<div class="ls-note">再练一遍，不改变第一次的成绩。<button type="button" class="ls-link" data-act="again-stop">结束再练</button></div>';
    h += '<div class="ls-marks" id="ar-marks" aria-hidden="true"></div>' +
      '<div class="ls-card ' + (isDict() ? "ls-prompt" : "ls-pad ls-stack") + '" id="ar-prompt"></div>' +
      '<div class="ls-card ls-fb" id="ar-fb" hidden></div>' +
      '<form id="ar-form" autocomplete="off" novalidate>' +
        '<div class="ls-answer" id="ar-box">' +
          '<label class="ls-no" id="ar-no" for="ar-input">1</label>' +
          '<input id="ar-input" type="text" lang="en" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="go" maxlength="64" placeholder="' + answerPlaceholder() + '">' +
        "</div>" +
        '<div class="ls-actions">' +
          '<button class="ls-btn" type="submit" id="ar-submit">提交</button>' +
          '<button class="ls-btn ls-quiet" type="button" id="ar-skip" data-act="skip">不会，看答案</button>' +
        "</div>" +
      "</form>";
    $("ar-body").innerHTML = h;
    paintDrill();
  }
  function dictPromptHTML(w) {
    const v = voice();
    if (v.mode === "audio") {
      let h = '<button type="button" class="ls-play" data-act="play" aria-label="播放读音">' + ICON_PLAY + "</button>";
      h += '<div class="ls-row ls-center"><button type="button" class="ls-btn ls-quiet ls-sm" data-act="slow">慢速再听</button><button type="button" class="ls-btn ls-quiet ls-sm ar-wrap" data-act="hint">' + (ui.hint ? esc(w.zh) : "看中文提示") + "</button></div>";
      h += '<div class="ls-note">听到什么写什么。输入框空着时按回车也能重听。</div>';
      if (v.failed) h += '<div class="ls-warnbox">没能读出这个词。<button type="button" class="ls-link" data-act="mode-zh">换成看中文写英文</button></div>';
      return h;
    }
    const same = unit.words.filter((x) => x.zh === w.zh).length > 1;
    let h = '<div class="ls-zh-big">' + esc(w.zh) + "</div>";
    h += '<div class="ls-note">' + (same ? "写出英文。这个中文对应不止一个词，这里要的以 " + esc(w.en[0]) + " 开头。" : "写出英文拼写。") + "</div>";
    if (v.ok) h += '<button type="button" class="ls-btn ls-quiet ls-sm" data-act="play">听发音提示</button>';
    if (v.ok && v.failed) h += '<div class="ls-warnbox">没能读出声音。</div>';
    return h;
  }
  function dictFeedbackHTML(w, r) {
    const g = r.g, word = '<div class="ls-word" lang="en">' + esc(w.en) + "</div>";
    let h = "";
    if (r.ok) {
      h += '<div class="ls-verdict">✓ ' + VERDICT[g.r] + "</div>" + word;
      if (g.r === "alt") h += '<div class="ls-tip">文章和词表用的写法是 ' + esc(w.en) + "，这两种写法都算对，同一份答卷尽量统一。</div>";
      if (g.r === "near") h += '<div class="ls-tip">标准写法是 ' + esc(w.en) + "，连字符和空格要照这个写。</div>";
      if (g.r === "homo") h += '<div class="ls-tip">你写的 ' + esc(r.attempt) + " 是另一个同音词，这里要的是 " + esc(w.en) + "（" + esc(w.zh) + "）。考试时靠上下文分辨。</div>";
    } else {
      h += '<div class="ls-verdict">✗ ' + (g.r === "skip" ? "答案是" : "正确拼写") + "</div>" + word;
      if (g.r === "bad") h += fixLine(r.attempt, w.en);
      h += '<div class="ls-note">这个词后面还会再来一次，答对一次才算过。</div>';
    }
    return h + '<div class="ls-meaning"><span>' + esc(w.zh) + '</span><span class="ls-nt">' + esc(w.pos) + "</span></div>";
  }
  const yoursLine = (attempt) => '<div class="ls-fixline"><span class="ls-lbl">你写的</span><span class="ls-yours" lang="en">' + esc(attempt) + "</span></div>";
  function fixLine(attempt, answer) {
    const fx = C.fixHTML(attempt, answer);
    return fx
      ? '<div class="ls-fixline"><span class="ls-lbl">改正</span><span class="ls-fix" lang="en">' + fx + '</span></div><div class="ls-note">划掉的是多写的字母，下划线是漏写的字母。</div>'
      : yoursLine(attempt);
  }
  function partsHTML(parts) {
    return parts.map((p) => {
      if (p.blank) return '<span class="ar-blank' + (p.current ? " is-cur" : "") + '"><span class="ls-sr">' + (p.current ? "（这里要填）" : "（这个空后面再填）") + "</span></span>";
      return p.mark ? '<b class="ar-filled">' + esc(p.text) + "</b>" : esc(p.text);
    }).join("");
  }
  const partsText = (parts) => parts.map((p) => (p.blank ? "（空）" : p.text)).join("");
  function clozePromptHTML(c) {
    const fb = ui.phase === "fb", parts = A.clozeParts(unit, c, rec.cloze.queue, fb), left = A.blanksLeft(parts);
    /* The sentence comes last, right above the answer box, so its blank stays on screen when a phone keyboard takes the lower half. */
    let h = '<div class="ar-zh">' + esc(c.zh) + "</div>";
    if (c.note) h += '<div class="ar-grammar">语法提示：' + esc(c.note) + "</div>";
    if (!fb) h += '<div class="ls-note">填第 1 步听写过的词，也就是文章原文这里用的词，以 <span lang="en">' + esc(A.clozeStart(c)) + "</span> 开头。</div>";
    h += '<p class="ar-sentence" lang="en">' + partsHTML(parts) + "</p>";
    if (fb) {
      /* Hearing it would give away the blanks still to come, so the whole sentence and its sound wait until they are done. */
      if (left) h += '<div class="ls-note">这句里还有 ' + left + " 个空后面会问到，现在先遮住。都答完后可以看整句" + (voice().ok ? "、听整句" : "") + "。</div>";
      else if (voice().ok) h += '<div class="ls-row"><button type="button" class="ls-btn ls-quiet ls-sm" data-act="hear-sentence">听整句</button></div>';
      else h += '<div class="ls-note">' + NO_SPEECH + "</div>";
    }
    return h;
  }
  function clozeFeedbackHTML(c, r) {
    if (r.ok) return '<div class="ls-verdict">✓ 正确</div>';
    /* Something far from this word may be another word that is right in the sentence, so it is not shown as a misspelling of this one. */
    const yours = r.g.r !== "bad" ? "" : A.clozeNear(r.attempt, c) ? fixLine(r.attempt, c.answers[0]) : yoursLine(r.attempt) + '<div class="ls-note">如果你写的是另一个词，放在这里也可能说得通；这一步要练的是文章原文的词。</div>';
    return '<div class="ls-verdict">✗ ' + (r.g.r === "skip" ? "答案是" : "文章原文这里用的是") + '</div><div class="ls-word" lang="en">' + esc(c.answers[0]) + "</div>" + yours +
      '<div class="ls-note">这一题最后还会再来一次，答对一次才算过。</div>';
  }
  /* In audio mode a new word announces nothing: a screen reader talking over the spoken word would ruin the question. */
  function liveText(item, fb, passed, total) {
    if (isDict()) {
      if (fb) {
        const r = ui.last;
        return (r.ok ? VERDICT[r.g.r] + "。" : r.g.r === "skip" ? "答案是 " : "拼写错误，正确拼写是 ") + item.en + "，" + item.zh;
      }
      if (voice().mode === "zh") return "第 " + (passed + 1) + " 词，共 " + total + " 词。" + item.zh;
      return ui.hint ? item.zh : "";
    }
    const parts = A.clozeParts(unit, item, rec.cloze.queue, fb), text = partsText(parts);
    if (fb) return (ui.last.ok ? "正确。" : (ui.last.g.r === "skip" ? "答案是 " : "文章原文这里用的是 ") + item.answers[0] + "。") + text;
    return "第 " + (passed + 1) + " 题，共 " + total + " 题。" + text + "。" + item.zh + (item.note ? "。" + item.note : "") + "。填第 1 步听写过的词，以 " + A.clozeStart(item) + " 开头。";
  }
  function paintDrill() {
    const d = rec[rec.at], fb = ui.phase === "fb", total = d.order.length, passed = total - d.queue.length;
    const id = curId(), item = isDict() ? A.findWord(unit, id) : A.findCloze(unit, id);
    const no = fb ? ui.last.no : passed + 1; /* a right answer has already moved the queue while its feedback is showing */
    $("ar-count").textContent = passed + " / " + total;
    $("ar-no").textContent = String(no);
    $("ar-input").setAttribute("aria-label", isDict() ? "第 " + no + " 词，拼写" : "第 " + no + " 题，填缺的词");
    $("ar-marks").innerHTML = A.drillMarks(d, fb ? "" : id).map((m) => '<span class="ls-mk' + (m === "ok" ? " ls-ok" : m === "bad" ? " ls-bad" : m === "cur" ? " ls-cur" : "") + '">' + (m === "ok" ? "✓" : m === "bad" ? "✗" : "") + "</span>").join("");
    $("ar-prompt").innerHTML = isDict() ? dictPromptHTML(item) : clozePromptHTML(item);
    $("ar-body").classList.toggle("ls-fb-on", fb && isDict());
    const box = $("ar-fb");
    if (fb) {
      box.className = "ls-card ls-fb " + (ui.last.ok ? "ls-ok" : "ls-bad");
      box.innerHTML = isDict() ? dictFeedbackHTML(item, ui.last) : clozeFeedbackHTML(item, ui.last);
      box.hidden = false;
    } else { box.hidden = true; box.innerHTML = ""; }
    $("ar-submit").textContent = fb ? (d.queue.length ? "下一个" : "看结果") : "提交";
    $("ar-skip").hidden = fb;
    /* In the fill-in the answer now stands in the sentence, so the box only takes up room above the next button. */
    $("ar-box").hidden = fb && !isDict();
    say(liveText(item, fb, passed, total));
    paintSpeechWarn();
  }
  /* Focus moves use preventScroll, so a repaint that grows the page has to bring the answer box and its button back on screen. */
  function keepForm() {
    const form = $("ar-form");
    if (!form) return;
    form.scrollIntoView({ block: "nearest" });
    /* A phone keyboard can shrink only the visual viewport, which that call may not account for. */
    const vv = window.visualViewport;
    if (vv) { const over = form.getBoundingClientRect().bottom + 12 - (vv.offsetTop + vv.height); if (over > 0) window.scrollBy(0, over); }
  }
  /* Saved at once, so a reload picks up at the next question. */
  function answerDrill(val, g, ok) {
    const d = rec[rec.at];
    ui.last = { id: d.queue[0], ok, attempt: String(val).trim(), g, no: d.order.length - d.queue.length + 1 };
    ui.phase = "fb";
    A.drillAnswer(d, ok);
    saveStore();
    paintDrill();
    if (isDict()) {
      $("ar-input").focus({ preventScroll: true }); /* 不会 is about to disappear from under the focus */
      keepForm();
      if (!ok && voice().mode === "audio") sayShort(ui.last.id, C.RATE);
      return;
    }
    /* The sentence is the lesson here: moving focus off the box lets a phone close its keyboard, and Enter still goes on to the next one. */
    $("ar-submit").focus({ preventScroll: true });
    keepForm();
    $("ar-prompt").scrollIntoView({ block: "nearest" });
  }
  function nextDrill() {
    const d = rec[rec.at];
    stopVoice();
    ui = freshUi();
    if (!d.queue.length) {
      renderUnit();
      window.scrollTo(0, 0);
      focusCurrent();
      say(doneLine());
      return;
    }
    const inp = $("ar-input");
    inp.value = "";
    paintDrill();
    window.scrollTo(0, 0); /* the prompt, which may have been scrolled past for the last feedback, is the question */
    keepForm();
    inp.focus({ preventScroll: true }); /* synchronous so the mobile keyboard opens */
    if (isDict() && voice().mode === "audio") sayShort(d.queue[0], C.RATE);
  }
  function doneLine() {
    const s = rec[rec.at].score;
    return (isDict() ? "词汇听写完成，第一次就拼对 " : "填句子完成，第一次就填对 ") + s[0] + " / " + s[1] + "。";
  }
  const answerPlaceholder = () => (isDict() ? "在这里拼写" : "在这里写缺的词");
  /* A second empty submit restarts the wait, so the message cannot end up taken for the normal text. */
  let nudgeTimer = 0;
  function nudge() {
    const box = $("ar-box"), inp = $("ar-input");
    clearTimeout(nudgeTimer);
    box.classList.add("ls-nudge"); inp.placeholder = isDict() ? "先写下拼写" : "先写下缺的词";
    nudgeTimer = setTimeout(() => {
      const nowBox = $("ar-box"), nowInp = $("ar-input");
      if (nowBox) nowBox.classList.remove("ls-nudge");
      if (nowInp && unit) nowInp.placeholder = answerPlaceholder();
    }, 1400);
  }
  function onSubmit(e) {
    e.preventDefault();
    if (!unit || !practising()) return;
    if (ui.phase === "fb") { nextDrill(); return; }
    const val = $("ar-input").value, id = rec[rec.at].queue[0];
    if (isDict()) {
      const m = voice().mode, g = A.gradeWord(val, A.findWord(unit, id), m);
      if (g.r === "empty") { if (m === "audio") sayShort(id, C.RATE); else nudge(); return; }
      answerDrill(val, g, C.isRight(g));
      return;
    }
    const g = A.gradeCloze(val, A.findCloze(unit, id));
    if (g.r === "empty") { nudge(); return; }
    answerDrill(val, g, g.r === "ok");
  }
  function renderDrillDone() {
    const dict = isDict(), s = rec[rec.at].score;
    let h = dict ? "" : partSwitch();
    h += '<section class="ls-card ls-sum" aria-labelledby="ar-done-h"><h2 class="ls-mark" id="ar-done-h">' + (dict ? "词汇听写完成" : "填句子完成") + "</h2>" +
      '<div class="ls-score">' + s[0] + "<small> / " + s[1] + "</small></div>" +
      '<div class="ls-note">第一次就' + (dict ? "拼对" : "填对") + "的数量。没答对的都已经补到答对一次。</div>" +
      '<div class="ls-row">' + (dict ? nextButton("cloze", "继续：写句子") : nextButton("write", "继续：造句")) + '<button type="button" class="ls-btn ls-quiet" data-act="again">再练一遍</button></div>' +
      '<div class="ls-note">再练不会改变这里的第一次成绩。</div></section>';
    if (dict) {
      const can = voice().ok;
      h += '<section class="ls-card ls-pad ls-stack" aria-labelledby="ar-words-h"><h2 class="ls-mark" id="ar-words-h">这篇文章的词</h2>' + (can ? '<div class="ls-note">点单词听发音。</div>' : "") + '<div class="ls-wl">' +
        unit.words.map((w) => "<div>" + (can ? '<button type="button" class="ls-link ls-w ar-link-w" lang="en" data-act="say-word" data-v="' + esc(w.en) + '">' + esc(w.en) + "</button>" : '<span class="ls-w" lang="en">' + esc(w.en) + "</span>") +
          '<span class="ls-from">' + esc(w.pos) + '</span><span class="ls-zh">' + esc(w.zh) + "</span></div>").join("") + "</div></section>";
    } else {
      h += '<section class="ls-card ls-pad ls-stack" aria-labelledby="ar-sents-h"><h2 class="ls-mark" id="ar-sents-h">' + (voice().ok ? "再听一遍这些句子" : "这些句子") + '</h2><ul class="ar-list">' +
        A.clozeSentences(unit).map((x, i) => '<li><div class="ar-sentence" lang="en">' + esc(x.text) + '</div><div class="ar-zh">' + esc(x.zh) + "</div>" +
          (voice().ok ? '<div class="ls-row"><button type="button" class="ls-btn ls-quiet ls-sm" data-act="say-sent" data-v="' + i + '">听整句</button></div>' : "") + "</li>").join("") + "</ul></section>";
    }
    $("ar-body").classList.remove("ls-fb-on");
    $("ar-body").innerHTML = h;
  }

  /* ---------- step 2b ---------- */
  function ensureEntry(id) {
    if (!own(rec.write.items, id)) rec.write.items[id] = { t: "", shown: false, done: false };
    return rec.write.items[id];
  }
  function renderWriteItem() {
    const w = A.writeItem(unit, rec.write.cur), e = A.writeEntry(rec, w.id), i = unit.writing.indexOf(w);
    let h = partSwitch();
    h += '<section class="ls-card ls-pad ls-stack" aria-labelledby="ar-focus">' +
      '<div class="ls-sec-h"><h2 class="ls-mark" id="ar-focus" tabindex="-1">造句</h2><span class="ls-count">' + (i + 1) + " / " + unit.writing.length + "</span></div>" +
      '<dl class="ar-facts"><div><dt>句型</dt><dd>' + esc(w.pattern) + '</dd></div><div><dt>目标词</dt><dd class="ls-w" lang="en">' + esc(w.word) + "</dd></div><div><dt>要表达的意思</dt><dd>" + esc(w.prompt_zh) + "</dd></div></dl></section>";
    h += '<div class="ar-compare" id="ar-compare">' +
      '<section class="ls-card ls-pad ls-stack" aria-label="我的句子"><label for="ar-w-text">我的句子（英文）</label>' +
        '<textarea class="ar-text" id="ar-w-text" rows="4" lang="en" maxlength="' + A.LIMITS.text + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>' +
        '<div class="ls-stack" id="ar-hints" hidden></div><div class="ls-note">' + NO_GRAMMAR + '</div><div class="ls-note">写的句子只保存在这个浏览器里，不会被朗读，也不会发送到任何地方。</div></section>' +
      '<section class="ls-card ls-pad ls-stack" id="ar-models" aria-labelledby="ar-m-h" hidden><h2 class="ls-mark" id="ar-m-h" tabindex="-1">范句</h2>' +
        '<ol class="ar-list">' + w.models.map((m, k) => '<li><span lang="en">' + esc(m) + "</span>" + (voice().ok ? ' <button type="button" class="ls-link" data-act="say-model" data-v="' + k + '">听</button>' : "") + "</li>").join("") + "</ol>" +
        '<h2 class="ls-mark">自查清单</h2><ul class="ar-list">' + w.check.map((c) => "<li>" + esc(c) + "</li>").join("") + "</ul></section>" +
      "</div>";
    h += '<div class="ls-row" id="ar-w-actions"></div>';
    $("ar-body").classList.remove("ls-fb-on");
    $("ar-body").innerHTML = h;
    $("ar-w-text").value = e.t;
    paintWrite(w);
  }
  function paintHints(w) {
    const e = A.writeEntry(rec, w.id), box = $("ar-hints");
    box.hidden = !e.shown;
    if (!e.shown) return "";
    const hints = A.softHints(e.t, w);
    box.innerHTML = hints.length
      ? hints.map((x) => '<div class="ls-tip">' + esc(x.msg) + "</div>").join("") + '<div class="ls-note">这些只是提醒，不影响往下走。</div>'
      : '<div class="ls-note">四项表面检查都过了。这不代表语法正确，语法还要你自己对照。</div>';
    return box.textContent;
  }
  function paintWrite(w) {
    const shown = A.writeEntry(rec, w.id).shown;
    $("ar-models").hidden = !shown;
    $("ar-compare").classList.toggle("is-open", shown);
    paintHints(w);
    $("ar-w-actions").innerHTML = shown
      ? '<button type="button" class="ls-btn" data-act="write-done">' + (rec.write.done ? "保存修改" : "这句完成") + '</button><span class="ls-note">可以先改自己的句子，改好再点。</span>'
      : '<button type="button" class="ls-btn" data-act="reveal">写好了，看范句</button>';
  }
  function reveal() {
    const w = A.writeItem(unit, rec.write.cur);
    ensureEntry(w.id).shown = true;
    flushDraft();
    saveStore();
    paintWrite(w);
    say(paintHints(w));
    $("ar-m-h").focus();
  }
  function writeDone() {
    stopVoice(); /* a model still being read would run on over the next sentence */
    const e = ensureEntry(rec.write.cur);
    e.done = true; e.shown = true;
    rec.write.cur = rec.write.done ? "" : A.nextWriteId(unit, rec);
    const finished = !rec.write.cur && !rec.write.done;
    if (!rec.write.cur) rec.write.done = true;
    flushDraft();
    saveStore();
    renderUnit();
    window.scrollTo(0, 0);
    focusCurrent();
    say(finished ? "造句完成，写了 " + A.writtenCount(unit, rec) + " 句。" : "");
  }
  function renderWriteDone() {
    const n = A.writtenCount(unit, rec);
    let h = partSwitch();
    h += '<section class="ls-card ls-sum" aria-labelledby="ar-done-h"><h2 class="ls-mark" id="ar-done-h">造句完成</h2>' +
      '<div class="ls-score">' + n + "<small> / " + unit.writing.length + " 句</small></div>" +
      '<div class="ls-note">这是写下的句子数，不是对的句子数：语法这里判断不了。</div>' +
      '<div class="ls-row">' + nextButton("read", "继续：阅读原文") + "</div></section>";
    h += '<section class="ls-card ls-pad ls-stack" aria-labelledby="ar-mine-h"><h2 class="ls-mark" id="ar-mine-h">我写的句子</h2><ul class="ar-list">' +
      unit.writing.map((w) => {
        const t = A.writeEntry(rec, w.id).t.trim();
        return "<li><div class=\"ls-note\">" + esc(w.pattern) + "</div>" +
          (t ? '<div class="ar-user" lang="en">' + esc(t) + "</div>" : '<div class="ls-note">没有写。</div>') +
          "<details><summary>范句</summary>" + w.models.map((m) => '<div lang="en">' + esc(m) + "</div>").join("") + "</details>" +
          '<div class="ls-row"><button type="button" class="ls-link" data-act="edit" data-v="' + w.id + '">修改</button></div></li>';
      }).join("") + "</ul></section>";
    $("ar-body").classList.remove("ls-fb-on");
    $("ar-body").innerHTML = h;
  }
  function flushDraft() {
    clearTimeout(draftTimer);
    if (draftDirty) { draftDirty = false; saveStore(); }
  }
  function onInput(e) {
    if (!unit || !e.target || e.target.id !== "ar-w-text" || !rec.write.cur) return;
    const w = A.writeItem(unit, rec.write.cur);
    ensureEntry(w.id).t = e.target.value;
    draftDirty = true;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(flushDraft, 400);
    paintHints(w);
  }

  /* ---------- step 3 ---------- */
  function paintGloss() {
    const el = $("ar-gloss");
    if (!el) return;
    if (!gloss) { el.textContent = "点文章里高亮的词，这里显示中文和词性" + (voice().ok ? "，并读出这个词。" : "。"); el.classList.remove("is-on"); return; }
    const w = A.findWord(unit, gloss.en);
    el.classList.add("is-on");
    el.innerHTML = '<span class="ls-w" lang="en">' + esc(gloss.form) + "</span>" + (gloss.form.toLowerCase() === w.en.toLowerCase() ? "" : ' <span class="ls-nt">原形 <span lang="en">' + esc(w.en) + "</span></span>") +
      ' <span class="ls-lno">' + esc(w.pos) + "</span> <span>" + esc(w.zh) + "</span>";
  }
  function paintReadState() {
    const el = $("ar-read-state");
    if (el) el.textContent = reading >= 0 && unit ? "正在朗读 " + unit.paragraphs[reading].label + " 段" : "";
  }
  function renderRead() {
    const v = voice(), cur = rec.read.para;
    let h = '<section class="ls-card ls-pad ls-stack" aria-labelledby="ar-focus"><h2 class="ls-mark" id="ar-focus" tabindex="-1">阅读原文</h2>' +
      '<div class="ls-note">把刚才听写过、写过的词放回文章里再读一遍。高亮的词都能点。</div>' + (v.ok ? "" : '<div class="ls-note">' + NO_SPEECH + "</div>") + "</section>";
    h += '<div class="ar-toolbar" id="ar-toolbar">' +
      '<div class="ls-seg" role="group" aria-label="当前段落">' + unit.paragraphs.map((p, i) => '<button type="button" data-act="para" data-v="' + i + '" aria-pressed="' + (i === cur) + '">' + esc(p.label) + "</button>").join("") + "</div>" +
      (v.ok ? '<div class="ls-row"><button type="button" class="ls-btn ls-quiet ls-sm" data-act="read-para">朗读这一段</button><button type="button" class="ls-btn ls-quiet ls-sm" data-act="read-stop">停止</button><span class="ls-note" id="ar-read-state"></span></div>' : "") +
      '<div class="ar-gloss" id="ar-gloss" role="status"></div></div>';
    h += '<div class="ls-card ls-pad ar-article">' + unit.paragraphs.map((p, i) => {
      const body = A.markWords(p.text, unit.words).map((x) => (x.en ? '<button type="button" class="ar-word" data-act="word" data-v="' + esc(x.en) + '">' + esc(x.text) + "</button>" : esc(x.text))).join("");
      return '<section class="ar-para' + (i === cur ? " is-cur" : "") + '" id="ar-p-' + i + '" data-act="para" data-v="' + i + '"' + (i === cur ? ' aria-current="true"' : "") + '><span class="ar-label">' + esc(p.label) + '</span><p lang="en">' + body + "</p></section>";
    }).join("") + "</div>";
    h += '<div class="ls-row"><button type="button" class="ls-btn" data-act="read-done">读完了</button></div>';
    $("ar-body").classList.remove("ls-fb-on");
    $("ar-body").innerHTML = h;
    paintGloss();
    paintReadState();
  }
  /* Choosing a paragraph from the row of letters scrolls to it; a tap on the paragraph itself is already there. */
  function setPara(i, scroll) {
    if (i !== rec.read.para) {
      stopVoice();
      rec.read.para = i;
      saveStore();
      $("ar-toolbar").querySelectorAll('[data-act="para"]').forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.v === i)));
      $("ar-body").querySelectorAll(".ar-para").forEach((p, k) => {
        p.classList.toggle("is-cur", k === i);
        if (k === i) p.setAttribute("aria-current", "true"); else p.removeAttribute("aria-current");
      });
    }
    /* Not "nearest": for a paragraph taller than the space under the toolbar that would land on its last lines. */
    if (scroll) { const p = $("ar-p-" + i); if (p) p.scrollIntoView({ block: "start" }); }
  }
  function activateWord(b) {
    const form = b.textContent;
    setPara(+b.closest(".ar-para").dataset.v, false);
    gloss = { en: b.dataset.v, form };
    $("ar-body").querySelectorAll(".ar-word").forEach((x) => x.classList.toggle("is-on", x.dataset.v === gloss.en));
    paintGloss();
    if (voice().ok) sayShort(form, C.RATE);
  }

  /* ---------- the unit's result: only what was saved ---------- */
  function renderSum() {
    const n = A.unitNumbers(unit, rec);
    const pair = (p) => (p ? p[0] + "<small> / " + p[1] + "</small>" : "-");
    const h = '<section class="ls-card ls-sum" aria-labelledby="ar-focus"><h2 class="ls-s-title" id="ar-focus" tabindex="-1">这一篇学完了</h2>' +
      '<dl class="ls-reward-stats ar-stats">' +
        "<div><dt>词汇听写，第一次拼对</dt><dd>" + pair(n.dict) + "</dd></div>" +
        "<div><dt>填句子，第一次填对</dt><dd>" + pair(n.cloze) + "</dd></div>" +
        "<div><dt>写下的句子</dt><dd>" + n.written + "<small> 句</small></dd></div></dl>" +
      '<div class="ls-note">这些数字只属于这篇文章，不影响每日任务、待攻克、EXP 和等级。上面的步骤都可以点开回看。</div>' +
      '<div class="ls-row"><button type="button" class="ls-btn" data-act="quit">回到文章列表</button></div></section>';
    $("ar-body").classList.remove("ls-fb-on");
    $("ar-body").innerHTML = h;
  }

  /* ---------- events ---------- */
  function onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const act = b.dataset.act, v = b.dataset.v;
    const refocus = () => { const inp = ui.phase === "fb" && !isDict() ? $("ar-submit") : $("ar-input"); if (inp) inp.focus({ preventScroll: true }); };
    if (act === "recovery-export") { exportRecovery(); return; }
    if (act === "recovery-discard") {
      if (!armDiscard) { armDiscard = true; paintLoadWarn(); const again = $("ar-load-warn").querySelector('[data-act="recovery-discard"]'); if (again) again.focus({ preventScroll: true }); return; }
      armDiscard = false;
      try { localStorage.removeItem(RECOVERY_KEY); } catch (err) { /* the warning simply stays */ }
      /* The same text is still under the main key until a save replaces it, and the next load would copy it straight back. */
      if (saveStore()) copyFailed = false;
      paintLoadWarn();
      focusCurrent();
      return;
    }
    if (act === "open") { openUnit(v, true); return; }
    if (!unit) return;
    if (act === "quit") closeUnit();
    else if (act === "step") { const at = A.stepTarget(rec, +v); if (at !== rec.at) goTo(at, true); }
    else if (act === "go") { if (v !== rec.at) goTo(v, true); }
    else if (act === "restart") {
      clearTimeout(armRestartTimer);
      if (!armRestart) { armRestart = true; armRestartTimer = setTimeout(disarmRestart, 5000); paintRestart(); return; }
      disarmRestart();
      store.articles[unit.id] = rec = A.blankRecord(unit);
      goTo("dict", true);
      say("这篇已经重新开始。");
    }
    else if (act === "play") { sayShort(curId(), C.RATE); refocus(); }
    else if (act === "slow") { sayShort(curId(), C.SLOW); refocus(); }
    else if (act === "hint") { ui.hint = true; paintDrill(); refocus(); }
    else if (act === "mode-zh") { App.setMode("zh"); paintDrill(); refocus(); }
    else if (act === "skip" && ui.phase === "ask") answerDrill("", { r: "skip" }, false);
    else if (act === "hear-sentence" && ui.last) { sayLong(A.clozeSentence(A.findCloze(unit, ui.last.id))); refocus(); }
    else if (act === "say-word") sayShort(v, C.RATE);
    else if (act === "say-sent") sayLong(A.clozeSentences(unit)[+v].text);
    else if (act === "again" && rec[rec.at]) {
      const ids = isDict() ? A.shuffled(A.wordIds(unit)) : A.clozeIds(unit);
      A.drillAgain(rec[rec.at], ids);
      goTo(rec.at, true);
    }
    else if (act === "again-stop" && rec[rec.at]) {
      A.drillStop(rec[rec.at]);
      goTo(rec.at, false);
    }
    else if (act === "reveal") reveal();
    else if (act === "write-done") writeDone();
    else if (act === "edit") { rec.write.cur = v; goTo("write", false); }
    else if (act === "say-model") sayLong(A.writeItem(unit, rec.write.cur).models[+v]);
    else if (act === "para") setPara(+v, b.tagName === "BUTTON");
    else if (act === "word") activateWord(b);
    else if (act === "read-para") sayLong(unit.paragraphs[rec.read.para].text, rec.read.para);
    else if (act === "read-stop") stopVoice();
    else if (act === "read-done") {
      rec.read.done = true;
      goTo("sum", false);
      say("这一篇学完了。");
    }
  }

  /* Someone who left a unit open comes back to it when this section is opened. */
  function resume(pressed) {
    /* Practice hides the tabs, so focus cannot stay on the tab that was just pressed. */
    /* The listening mode can have changed on the dictation tab meanwhile, so the question is drawn again. It speaks nothing. */
    if (unit) { if (practising()) paintDrill(); if (rec.at !== "sum") focusCurrent(); return; }
    if (store.open && BY_ID.has(store.open)) openUnit(store.open, pressed === true);
  }
  /* Silence everything when this section stops being the one on screen. */
  function hush() { flushDraft(); if (App) stopVoice(); }

  function mount(el, app, profile) {
    /* Without its data this section has nothing to show, and reading saved progress against an empty list would report it as damaged. The shell hides the tab when mount fails. */
    if (!root.WLIU_ARTICLE_DATA) throw new Error("article data did not load");
    KEY = root.WLIU_PROFILE.keyFor(A.KEY, profile);
    RECOVERY_KEY = root.WLIU_PROFILE.keyFor(A.RECOVERY_KEY, profile);
    store = loadStore();
    App = app;
    el.classList.add("ls-app");
    el.innerHTML = SHELL;
    el.addEventListener("click", onClick);
    el.addEventListener("input", onInput);
    el.addEventListener("submit", onSubmit);
    if (saveFailed) noteSave(false);
    paintLoadWarn();
    renderList();
    App.on("tts", onTts);
    App.on("speech", (v) => el.classList.toggle("is-speaking", v));
    /* Travels with the dictation's export, import and clear. A file without this part leaves it alone. */
    App.shareProgress({
      note: "导出、导入和清空也包括文章精读的进度。",
      read: () => store,
      describe: (raw) => {
        if (raw === undefined) return "文件里没有文章精读的进度，现有的文章进度不变。";
        const got = A.importable(raw);
        return got ? "文章精读 " + A.startedCount(got) + " 篇有进度，会一起覆盖现有的文章进度。" : "文件里的文章精读进度读不出来，现有的文章进度不变。";
      },
      restore: (raw) => {
        const got = A.importable(raw);
        if (!got) return;
        flushDraft();
        if (unit) dropUnit();
        store = got;
        saveStore();
        renderList();
      },
      clear: () => {
        flushDraft();
        if (unit) dropUnit();
        store = A.blankStore();
        /* Clearing everything includes the raw copy, which can hold the learner's own sentences. */
        try { localStorage.removeItem(RECOVERY_KEY); } catch (e) { /* the warning simply stays */ }
        armDiscard = false;
        copyFailed = false;
        saveStore();
        paintLoadWarn();
        renderList();
      }
    });
    /* Another tab saved: last write wins, but a list at rest can pick it up. */
    window.addEventListener("storage", (e) => {
      if (e.key === KEY || e.key === RECOVERY_KEY || e.key === null) {
        if (!unit) { store = loadStore(); renderList(); }
        paintLoadWarn();
      }
    });
    window.addEventListener("pagehide", hush);
    /* Focus moves use preventScroll, and a phone may honour that while its keyboard slides up over the box. A pinch zoom also shrinks this viewport, so a scale other than 1 does not count. */
    const vv = window.visualViewport;
    if (vv) {
      let tall = vv.height, across = vv.width;
      vv.addEventListener("resize", () => {
        if (vv.width !== across) { across = vv.width; tall = vv.height; return; }
        tall = Math.max(tall, vv.height);
        if (tall - vv.height > 120 && Math.abs(vv.scale - 1) < 0.01 && unit && practising() && document.activeElement === $("ar-input")) keepForm();
      });
    }
    /* A phone can drop a page in the background without any further notice. */
    document.addEventListener("visibilitychange", () => { if (document.hidden) flushDraft(); });
  }

  root.WLIU_ARTICLE = { mount, on, hush, focusCurrent, resume, inSession: () => !!unit && rec.at !== "sum" };
})(window);
