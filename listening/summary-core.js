/* 听句概括 logic: link parsing, time parsing, segment checks and storage validation. No DOM, no speech, no storage, no network.
   Its data lives under its own key and nothing here reads or writes the dictation state, so results cannot move EXP or rank. */
(function (root) {
  "use strict";

  const C = root.WLIU_LISTENING_CORE;
  const DATA = root.WLIU_SUMMARY_DATA;
  const KEY = "wliu-listen-summary-v1";
  const RECOVERY_KEY = KEY + "-recovery";
  const LIMITS = { attempts: 500, clips: 200, text: 2000, title: 120, url: 2048 };
  const MAX_TIME = 999 * 60 + 59.9, MIN_SEGMENT = 1;

  const PASSAGES = DATA.passages;
  const BY_ID = new Map(PASSAGES.map((p) => [p.id, p]));
  const inLevel = (lv) => PASSAGES.filter((p) => p.level === lv);
  const passageText = (p) => p.sentences.join(" ");

  /* ---------- video links ---------- */
  const ID_RE = /^[A-Za-z0-9_-]{11}$/;
  /* Reserved words the player uses in embed paths. Both happen to be 11 characters long. */
  const NOT_IDS = new Set(["videoseries", "live_stream"]);
  const WATCH_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com"]);
  const NOCOOKIE_HOSTS = new Set(["www.youtube-nocookie.com", "youtube-nocookie.com"]);
  const LINK_MSG = {
    empty: "请先粘贴一个 YouTube 视频链接。",
    format: "这不是有效的链接。请粘贴以 https:// 开头的完整 YouTube 链接。",
    https: "只接受 https:// 开头的链接。",
    host: "只接受 YouTube 的链接（youtube.com、youtu.be、youtube-nocookie.com）。",
    path: "只接受 YouTube 视频的观看、短链接或嵌入地址，例如 https://www.youtube.com/watch?v=视频ID。",
    id: "这个链接里没有有效的 11 位视频 ID。"
  };
  const linkFail = (code) => ({ ok: false, code, msg: LINK_MSG[code] });
  const validId = (id) => typeof id === "string" && ID_RE.test(id) && !NOT_IDS.has(id);

  /* Whitespace, controls, NBSP-range characters, backslash and the Unicode line separators. */
  function hasUnsafeChar(s) {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c <= 32 || (c >= 127 && c <= 160) || c === 92 || c === 8232 || c === 8233) return true;
    }
    return false;
  }

  function parseYouTube(input) {
    if (typeof input !== "string") return linkFail("empty");
    const s = input.trim();
    if (!s) return linkFail("empty");
    /* The URL parser silently removes tabs and newlines and turns backslashes into slashes, so these never get as far as it. */
    if (s.length > LIMITS.url || hasUnsafeChar(s)) return linkFail("format");
    let u;
    try { u = new URL(s); } catch (e) { return linkFail("format"); }
    if (u.protocol !== "https:") return linkFail("https");
    if (u.username || u.password || u.port) return linkFail("host");
    const host = u.hostname, path = u.pathname;
    let id = null, m;
    if (host === "youtu.be") {
      m = /^\/([^/]+)\/?$/.exec(path);
      if (!m) return linkFail("path");
      id = m[1];
    } else if (NOCOOKIE_HOSTS.has(host)) {
      m = /^\/embed\/([^/]+)\/?$/.exec(path);
      if (!m) return linkFail("path");
      id = m[1];
    } else if (WATCH_HOSTS.has(host)) {
      if (/^\/watch\/?$/.test(path)) {
        const all = u.searchParams.getAll("v");
        if (all.length !== 1) return linkFail("id");
        id = all[0];
      } else {
        m = /^\/(?:embed|shorts)\/([^/]+)\/?$/.exec(path);
        if (!m) return linkFail("path");
        id = m[1];
      }
    } else return linkFail("host");
    return validId(id) ? { ok: true, id } : linkFail("id");
  }
  /* Only ever built from an id that has passed validId. */
  const watchUrl = (id) => "https://www.youtube.com/watch?v=" + id;

  /* ---------- times ---------- */
  const round1 = (n) => Math.round(n * 10) / 10;
  /* m:ss with an optional tenth. NFKC folds the full-width colon and digits a Chinese keyboard produces. */
  function parseTime(input) {
    if (typeof input !== "string") return null;
    const m = /^(\d{1,3}):([0-5]\d)(?:\.(\d))?$/.exec(input.normalize("NFKC").trim());
    if (!m) return null;
    return round1(+m[1] * 60 + +m[2] + (m[3] ? +m[3] / 10 : 0));
  }
  function fmtTime(sec) {
    if (typeof sec !== "number" || !isFinite(sec) || sec < 0) return "";
    const tenths = Math.round(sec * 10), d = tenths % 10, whole = (tenths - d) / 10;
    return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0") + (d ? "." + d : "");
  }
  const isTime = (n) => typeof n === "number" && isFinite(n) && n >= 0 && n <= MAX_TIME;
  const SEG_MSG = {
    start: "起点无效，请用 分:秒 的格式，例如 1:05。",
    end: "终点无效，请用 分:秒 的格式，例如 1:20。",
    order: "终点要晚于起点。",
    short: "片段太短，至少要 " + MIN_SEGMENT + " 秒。",
    past: "这段时间超出了视频长度。"
  };
  /* duration is optional: pass it when the player knows it. */
  function checkSegment(start, end, duration) {
    const fail = (code) => ({ ok: false, code, msg: SEG_MSG[code] });
    if (!isTime(start)) return fail("start");
    if (!isTime(end)) return fail("end");
    if (end <= start) return fail("order");
    /* Compared in whole tenths, the precision times are kept in: 4.1 - 3.1 is 0.9999999999999996 as a float. */
    if (Math.round(end * 10) - Math.round(start * 10) < MIN_SEGMENT * 10) return fail("short");
    if (typeof duration === "number" && isFinite(duration) && duration > 0 && end > duration + 0.5) return fail("past");
    return { ok: true };
  }

  /* ---------- stored shape: every field is rebuilt by hand, so nothing unexpected survives ---------- */
  const blankStore = () => ({ v: 1, attempts: [], clips: [] });
  const cleanText = (x, max) => (typeof x === "string" ? x.trim().slice(0, max) : "");
  function saneAttempt(o) {
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const p = typeof o.id === "string" ? BY_ID.get(o.id) : null;
    if (!p || !C.strictISO(o.date)) return null;
    const count = (x) => (Number.isInteger(x) && x >= 0 ? x : null);
    const hits = count(o.hits), replays = count(o.replays);
    if (hits === null || replays === null || hits > p.keys.length) return null;
    const text = cleanText(o.text, LIMITS.text);
    if (!text) return null;
    return { date: o.date, id: p.id, hits, replays, text };
  }
  function saneClip(o) {
    if (!o || typeof o !== "object" || Array.isArray(o) || !validId(o.videoId)) return null;
    if (!checkSegment(o.start, o.end).ok) return null;
    const n = o.notes && typeof o.notes === "object" ? o.notes : {};
    return {
      videoId: o.videoId, title: cleanText(o.title, LIMITS.title), start: round1(o.start), end: round1(o.end),
      notes: { summary: cleanText(n.summary, LIMITS.text), missed: cleanText(n.missed, LIMITS.text) }
    };
  }
  function saneStore(o) {
    const s = blankStore();
    if (!o || typeof o !== "object" || o.v !== 1) return s;
    if (Array.isArray(o.attempts)) s.attempts = o.attempts.map(saneAttempt).filter(Boolean).slice(-LIMITS.attempts);
    if (Array.isArray(o.clips)) s.clips = o.clips.map(saneClip).filter(Boolean).slice(-LIMITS.clips);
    return s;
  }
  /* A raw stored string to a store. damaged means something present could not be kept, so the raw text is worth saving before the next write. */
  function readStored(raw) {
    if (raw === null || raw === undefined) return { store: blankStore(), damaged: false };
    let o;
    try { o = JSON.parse(raw); } catch (e) { return { store: blankStore(), damaged: true }; }
    const s = saneStore(o);
    if (!o || typeof o !== "object" || o.v !== 1) return { store: s, damaged: true };
    const rows = (x) => (x === undefined ? 0 : Array.isArray(x) ? x.length : -1);
    const a = rows(o.attempts), c = rows(o.clips);
    return { store: s, damaged: a < 0 || c < 0 || a !== s.attempts.length || c !== s.clips.length };
  }
  /* Both return the cleaned record, or null when it was refused and the store is untouched. The oldest entries go first at the limit. */
  function addAttempt(store, o) {
    const a = saneAttempt(o);
    if (!a) return null;
    store.attempts.push(a);
    if (store.attempts.length > LIMITS.attempts) store.attempts.splice(0, store.attempts.length - LIMITS.attempts);
    return a;
  }
  function addClip(store, o) {
    const c = saneClip(o);
    if (!c) return null;
    store.clips.push(c);
    if (store.clips.length > LIMITS.clips) store.clips.splice(0, store.clips.length - LIMITS.clips);
    return c;
  }

  /* ---------- reading attempts ---------- */
  function latestById(attempts) {
    const m = new Map();
    attempts.forEach((a) => m.set(a.id, a));
    return m;
  }
  /* Passages whose most recent attempt did not catch every key point, in passage order. */
  function missedIds(attempts) {
    const last = latestById(attempts);
    return PASSAGES.filter((p) => last.has(p.id) && last.get(p.id).hits < p.keys.length).map((p) => p.id);
  }
  /* Sum of a finished self-assessment, or null while any point is unmarked. */
  function countHits(marks) {
    if (!Array.isArray(marks) || !marks.length || marks.some((m) => m !== 1 && m !== 0)) return null;
    return marks.filter((m) => m === 1).length;
  }

  /* ---------- passage data contract: returns a list of problems, empty when fine ---------- */
  function checkPassages(data) {
    const errs = [], seen = new Set();
    if (!data || !Array.isArray(data.passages) || !Array.isArray(data.levels) || !data.topics) return ["bad root"];
    if (data.passages.length !== 15) errs.push("expected 15 passages, got " + data.passages.length);
    data.levels.forEach((lv) => {
      const n = data.passages.filter((p) => p.level === lv.id).length;
      if (n !== 5) errs.push("level " + lv.id + " has " + n);
    });
    data.passages.forEach((p) => {
      const tag = String(p && p.id);
      if (!p || typeof p.id !== "string" || !/^[a-z]+-\d+$/.test(p.id)) { errs.push(tag + ": id"); return; }
      if (seen.has(p.id)) errs.push(tag + ": duplicate id");
      seen.add(p.id);
      const lv = data.levels.find((l) => l.id === p.level);
      if (!lv) errs.push(tag + ": level");
      if (!data.topics[p.topic]) errs.push(tag + ": topic");
      if (!Array.isArray(p.sentences) || p.sentences.some((s) => typeof s !== "string" || !s.trim())) errs.push(tag + ": sentences");
      else {
        if (lv && (p.sentences.length < lv.min || p.sentences.length > lv.max)) errs.push(tag + ": sentence count");
        /* Each array entry is read aloud as one sentence. */
        if (p.sentences.some((s) => !/[.?!]$/.test(s) || /[.?!]\s+[A-Z]/.test(s))) errs.push(tag + ": not one sentence per entry");
        /* No figures, so nothing can read as a statistic claimed to be fact. */
        if (p.sentences.some((s) => /\d|%|\bper ?cent\b/i.test(s))) errs.push(tag + ": contains a figure");
        if (/[㐀-鿿]/.test(p.sentences.join(""))) errs.push(tag + ": sentences must be English");
      }
      if (!Array.isArray(p.keys) || p.keys.length < 2 || p.keys.length > 4 || p.keys.some((k) => typeof k !== "string" || !/[㐀-鿿]/.test(k))) errs.push(tag + ": keys");
      if (typeof p.zh !== "string" || !/[㐀-鿿]/.test(p.zh) || p.zh.length > 60) errs.push(tag + ": zh");
      if (typeof p.en !== "string" || !p.en.trim() || /[㐀-鿿]/.test(p.en) || p.en.split(/\s+/).length > 20) errs.push(tag + ": en");
    });
    return errs;
  }

  const exportDoc = (kind, store, when) => JSON.stringify({ app: "wliu-listen-summary", kind, exportedAt: when, [kind]: store[kind] }, null, 2);

  /* Reads back only this section's own export files. Every row goes through the same check as stored data. */
  function parseExport(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { return null; }
    if (!o || typeof o !== "object" || Array.isArray(o) || o.app !== "wliu-listen-summary") return null;
    if (o.kind !== "attempts" && o.kind !== "clips") return null;
    const given = o[o.kind];
    if (!Array.isArray(given)) return null;
    const rows = given.map(o.kind === "attempts" ? saneAttempt : saneClip).filter(Boolean);
    if (given.length && !rows.length) return null;
    return { kind: o.kind, rows, bad: given.length - rows.length };
  }
  /* Adds only what is not already there and never removes anything: rows that do not fit under the limit are left out and counted. */
  function mergeExport(store, doc) {
    const list = store[doc.kind], seen = new Set(list.map((x) => JSON.stringify(x))), fresh = [];
    doc.rows.forEach((r) => { const k = JSON.stringify(r); if (!seen.has(k)) { seen.add(k); fresh.push(r); } });
    const room = Math.max(0, LIMITS[doc.kind] - list.length), take = room ? fresh.slice(-room) : [];
    list.push(...take);
    /* "Most recent attempt" means last in the list, so an imported older attempt must not land after a newer one. */
    if (doc.kind === "attempts") list.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    return { added: take.length, dupes: doc.rows.length - fresh.length, skipped: fresh.length - take.length };
  }

  root.WLIU_SUMMARY_CORE = {
    KEY, RECOVERY_KEY, readStored, parseExport, mergeExport, LIMITS, MIN_SEGMENT, DATA, PASSAGES, BY_ID, inLevel, passageText,
    parseYouTube, validId, watchUrl, parseTime, fmtTime, checkSegment, round1,
    blankStore, saneAttempt, saneClip, saneStore, addAttempt, addClip,
    latestById, missedIds, countHits, checkPassages, exportDoc
  };
})(window);
