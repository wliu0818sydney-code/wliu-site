/* Listening core: schedule, grading, dates and state validation. No DOM, no speech, no storage.
   The rules here carry over unchanged from the first version of this dictation tool. Behaviour that looks like a
   bug is intended: missed reviews do not carry over, and catch-up does not shift review days. */
(function (root) {
  "use strict";

  const DATA = root.WLIU_LISTENING_DATA;
  const LISTS = DATA.lists, ALT = DATA.alt, HOMO = DATA.homo;

  const OFFSETS = [1, 2, 4, 7, 15];
  const RATE = 0.9, SLOW = 0.6;
  const KEY = "ielts-dictation-v1", PKEY = "ielts-dictation-prefs";
  const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const ACCENTS = [["en-GB", "英音"], ["en-AU", "澳音"], ["en-US", "美音"]];
  const REGION = { GB: "英国", AU: "澳大利亚", US: "美国", IE: "爱尔兰", NZ: "新西兰", CA: "加拿大", IN: "印度", ZA: "南非", SG: "新加坡" };
  const SAMPLE = "accommodation";

  /* 5 days on, 2 off. */
  const learnDay = (k) => Math.floor((k - 1) / 5) * 7 + ((k - 1) % 5) + 1;
  const LAST_DAY = learnDay(LISTS.length) + OFFSETS[OFFSETS.length - 1];

  /* The id "k-n" is a storage contract: never reorder lists or words. */
  const ITEMS = [];
  LISTS.forEach((list, li) => {
    list[1].forEach((w, wi) => {
      ITEMS.push({ k: li + 1, n: wi + 1, id: (li + 1) + "-" + (wi + 1), word: w[0], zh: w[1], note: w[2] || "", alts: ALT[w[0]] || [], homo: HOMO[w[0]] || [] });
    });
  });
  const BY_ID = Object.create(null), ZH_COUNT = Object.create(null);
  ITEMS.forEach((it) => { BY_ID[it.id] = it; ZH_COUNT[it.zh] = (ZH_COUNT[it.zh] || 0) + 1; });
  const listItems = (k) => ITEMS.filter((it) => it.k === k);
  const topic = (k) => LISTS[k - 1][0];

  /* ---------- dates: local calendar days, never UTC. Math.round absorbs DST (Sydney). ---------- */
  const pad2 = (n) => String(n).padStart(2, "0");
  const iso = (d) => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  const parseISO = (s) => { const p = String(s).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const today = () => iso(new Date());
  const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  const fmtDate = (s) => { const d = parseISO(s); return (d.getMonth() + 1) + " 月 " + d.getDate() + " 日 " + WEEK[d.getDay()]; };
  const validISO = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseISO(s).getTime());
  /* validISO accepts 2026-13-45; the round trip does not. Used for imported files. */
  const strictISO = (s) => validISO(s) && iso(parseISO(s)) === s;
  /* A start date a person could mean. A date field passes through values like 0002-11-02 while a year is typed. */
  const plausibleStart = (s) => { if (!strictISO(s)) return false; const y = +s.slice(0, 4); return y >= 2000 && y <= new Date().getFullYear() + 5; };

  /* ---------- grading ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s || "").normalize("NFKC").replace(/[‘’ʼ]/g, "'").replace(/[‐-―−]/g, "-").trim().replace(/\s+/g, " ").toLowerCase();
  const loose = (s) => norm(s).replace(/[\s-]/g, "");

  /* ok: exact. alt: accepted US spelling. near: only hyphens or spaces differ. homo: a same-sounding word (audio mode only). */
  function grade(input, it, mode) {
    const a = norm(input);
    if (!a) return { r: "empty" };
    if (a === norm(it.word)) return { r: "ok" };
    if (it.alts.some((x) => norm(x) === a)) return { r: "alt" };
    if ([it.word].concat(it.alts).some((x) => loose(x) === loose(a))) return { r: "near" };
    if (mode === "audio" && it.homo.some((x) => norm(x) === a)) return { r: "homo" };
    return { r: "bad" };
  }
  const isRight = (g) => g.r === "ok" || g.r === "alt" || g.r === "near" || g.r === "homo";

  /* Lowercases one UTF-16 unit at a time and keeps any unit whose lowercase form is longer (U+0130), so indices still line up with the original. */
  const lowerKeep = (s) => s.split("").map((c) => { const l = c.toLowerCase(); return l.length === 1 ? l : c; }).join("");

  /* Letter-level correction: struck letters were extra, underlined letters were missing. */
  function fixHTML(attempt, word) {
    const a = String(attempt).trim(), b = String(word);
    const A = lowerKeep(a), B = lowerKeep(b), n = A.length, m = B.length;
    if (!n) return null;
    const dp = [];
    for (let i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    if (dp[0][0] < Math.ceil(m * 0.5)) return null;
    const ops = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { ops.push(["=", b[j]]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(["-", a[i]]); i++; }
      else { ops.push(["+", b[j]]); j++; }
    }
    while (i < n) ops.push(["-", a[i++]]);
    while (j < m) ops.push(["+", b[j++]]);
    let html = "", cur = "", buf = "";
    const put = () => {
      if (!buf) return;
      const t = esc(buf).replace(/ /g, " ");
      html += cur === "=" ? t : cur === "-" ? "<del>" + t + "</del>" : "<ins>" + t + "</ins>";
      buf = "";
    };
    ops.forEach((o) => { if (o[0] !== cur) { put(); cur = o[0]; } buf += o[1]; });
    put();
    return html;
  }

  /* ---------- state shape ---------- */
  const blank = () => ({ v: 1, start: null, u: 0, w: {}, l: {}, last: {} });
  const isListKey = (k) => /^[1-9]\d*$/.test(k) && +k >= 1 && +k <= LISTS.length;

  /* Validates a stored document and drops anything unknown. strict adds the checks used for imported
     files: dates must round-trip and counters must be sensible numbers. */
  function sane(o, strict) {
    if (!o || typeof o !== "object" || o.v !== 1) return null;
    const okDate = strict ? strictISO : validISO;
    const stamp = (x) => { const t = String(x || ""); return strict && !strictISO(t) ? "" : t; };
    const num = (x) => { const v = +x || 0; return strict ? (isFinite(v) && v > 0 ? v : 0) : v; };
    const s = blank();
    if (okDate(o.start)) s.start = o.start;
    s.u = typeof o.u === "number" && isFinite(o.u) ? o.u : 0;
    if (o.w && typeof o.w === "object") for (const id in o.w) { const r = o.w[id]; if (BY_ID[id] && Array.isArray(r)) s.w[id] = [r[0] ? 1 : 0, num(r[1]), stamp(r[2])]; }
    if (o.l && typeof o.l === "object") for (const k in o.l) { if (isListKey(k) && Array.isArray(o.l[k])) { const d = o.l[k].filter(okDate).sort(); if (d.length || !strict) s.l[k] = d; } }
    if (o.last && typeof o.last === "object") for (const k in o.last) { const r = o.last[k]; if (isListKey(k) && Array.isArray(r)) s.last[k] = [num(r[0]), num(r[1]), stamp(r[2])]; }
    return s;
  }
  function sanePrefs(p) {
    const out = { mode: "audio", accent: "en-GB" };
    if (p && typeof p === "object") {
      if (p.mode === "audio" || p.mode === "zh") out.mode = p.mode;
      if (ACCENTS.some((a) => a[0] === p.accent)) out.accent = p.accent;
    }
    return out;
  }
  /* Accepts an export envelope or a bare state. Returns { state, prefs } (prefs may be null) or null. */
  function parseImport(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { return null; }
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    if (o.app !== undefined) {
      if (o.app !== "ielts-dictation") return null;
      const st = sane(o.state, true);
      return st ? { state: st, prefs: o.prefs ? sanePrefs(o.prefs) : null } : null;
    }
    const st = sane(o, true);
    return st ? { state: st, prefs: null } : null;
  }

  /* ---------- schedule: reads state through getState and the calendar through todayFn, so tests can move time. ---------- */
  function model(getState, todayFn) {
    const now = todayFn || today;
    const status = (id) => { const S = getState(); return S.w[id] ? S.w[id][0] : -1; }; // 1 right, 0 wrong, -1 not yet
    const daysOf = (k) => getState().l[k] || [];
    const learned = (k) => daysOf(k).length > 0;
    const doneToday = (k) => daysOf(k).indexOf(now()) !== -1;
    const dayNo = () => { const S = getState(); return S.start ? diffDays(S.start, now()) + 1 : 1; };
    const wrongItems = (k) => listItems(k).filter((it) => status(it.id) === 0);
    const allWrong = () => ITEMS.filter((it) => status(it.id) === 0);
    const firstReview = (k) => daysOf(k).filter((d) => d !== now()).length <= 1;

    /* Today's tasks from the 41-day schedule: new list, lists fallen behind, spaced reviews (+1, +2, +4, +7, +15 days). */
    function plan() {
      const N = dayNo(), t = now(), tasks = [];
      if (N < 1 || N > LAST_DAY) return { N, tasks };
      for (let k = 1; k <= LISTS.length; k++) if (learnDay(k) === N) tasks.push({ type: "new", k });
      for (let k = 1; k <= LISTS.length; k++) if (learnDay(k) < N && (!learned(k) || daysOf(k)[0] === t)) tasks.push({ type: "catch", k });
      for (let k = 1; k <= LISTS.length; k++) {
        if (OFFSETS.indexOf(N - learnDay(k)) !== -1 && learned(k) && daysOf(k)[0] !== t) tasks.push({ type: "review", k });
      }
      return { N, tasks };
    }
    /* First review covers the whole list; later reviews only the words still marked wrong. */
    function taskItems(task) {
      if (task.type !== "review") return listItems(task.k);
      return firstReview(task.k) ? listItems(task.k) : wrongItems(task.k);
    }
    return { status, daysOf, learned, doneToday, dayNo, wrongItems, allWrong, firstReview, plan, taskItems };
  }

  /* ---------- game layer: a read-only presentation of the state above. Nothing here writes or changes any rule. ---------- */
  const EXP_MAX = 500;
  const RANKS = [["一阶", 0], ["二阶", 50], ["三阶", 150], ["四阶", 250], ["五阶", 350], ["六阶", 450]];
  /* Mastered = words whose saved status is right. */
  const masteredCount = (S) => ITEMS.filter((it) => S && S.w && S.w[it.id] && S.w[it.id][0] === 1).length;
  /* Pure: the rank for a mastered-word count, and how far away the next one is. */
  function rankOf(mastered) {
    const n = typeof mastered === "number" && isFinite(mastered) && mastered > 0 ? mastered : 0;
    let i = 0;
    while (i + 1 < RANKS.length && n >= RANKS[i + 1][1]) i++;
    const up = RANKS[i + 1] || null;
    return { rank: RANKS[i][0], index: i, min: RANKS[i][1], next: up ? up[0] : null, nextAt: up ? up[1] : null, toNext: up ? up[1] - n : 0 };
  }
  /* The new rank when a change really crossed upward over a boundary, otherwise null. */
  function rankUp(before, after) {
    const a = rankOf(before), b = rankOf(after);
    return b.index > a.index ? b.rank : null;
  }

  root.WLIU_LISTENING_CORE = {
    LISTS, OFFSETS, RATE, SLOW, KEY, PKEY, WEEK, ACCENTS, REGION, SAMPLE, LAST_DAY, ITEMS, BY_ID, ZH_COUNT,
    learnDay, listItems, topic, iso, parseISO, today, diffDays, fmtDate, validISO, strictISO, plausibleStart,
    esc, norm, loose, grade, isRight, fixHTML, blank, sane, sanePrefs, parseImport, model,
    EXP_MAX, RANKS, masteredCount, rankOf, rankUp
  };
})(window);
