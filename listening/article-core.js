/* 文章精读 logic: answer checks, the practice queue, blanks, highlighting, speech chunks and storage validation. No DOM, no speech, no storage, no network.
   Its data lives under its own key and nothing here reads or writes the dictation state, so results cannot move the schedule, 待攻克, EXP or levels. */
(function (root) {
  "use strict";

  const C = root.WLIU_LISTENING_CORE;
  const DATA = root.WLIU_ARTICLE_DATA || { articles: [] };
  const KEY = "wliu-article-v1";
  const RECOVERY_KEY = KEY + "-recovery";
  const LIMITS = { text: 1000, chunkWords: 24 };
  const STEPS = [{ n: 1, label: "词汇听写" }, { n: 2, label: "写句子" }, { n: 3, label: "阅读原文" }];
  const SCREENS = ["dict", "cloze", "write", "read", "sum"];

  const isObj = (o) => !!o && typeof o === "object" && !Array.isArray(o);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isText = (x) => typeof x === "string" && x.trim() !== "";
  const textList = (x) => Array.isArray(x) && x.length > 0 && x.every(isText);
  const hasZh = (x) => /[㐀-鿿]/.test(x);
  const isId = (x) => typeof x === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x);

  /* ---------- whole words: a letter, digit or hyphen next to a match means it is part of a longer word ---------- */
  const isWordChar = (c) => !!c && /[\p{L}\p{N}-]/u.test(c);
  const isLetter = (c) => !!c && /\p{L}/u.test(c);
  const isApostrophe = (c) => c === "'" || c === "’";
  /* An apostrophe between letters holds a word together ("can't", "o'clock"). The one exception is 's, which leaves the word before it whole ("the environment's health"). */
  function runsOn(text, end) {
    if (isWordChar(text[end])) return true;
    if (!isApostrophe(text[end]) || !isLetter(text[end + 1])) return false;
    return !(text[end + 1].toLowerCase() === "s" && !isWordChar(text[end + 2]));
  }
  const runsIn = (text, start) => isWordChar(text[start - 1]) || (isApostrophe(text[start - 1]) && isLetter(text[start - 2]));
  function indexOfWhole(text, phrase, from) {
    let i = text.indexOf(phrase, from);
    while (i !== -1) {
      if (!runsIn(text, i) && !runsOn(text, i + phrase.length)) return i;
      i = text.indexOf(phrase, i + 1);
    }
    return -1;
  }
  /* Ignores case and spacing, the way the dictation compares answers. A dash is punctuation although norm() writes it as a hyphen, so it goes first. */
  const hasPhrase = (text, phrase) => { const p = C.norm(phrase); return !!p && indexOfWhole(C.norm(String(text || "").replace(/[\u2013-\u2015]|-{2,}/g, " ")), p, 0) !== -1; };

  /* ---------- step 1: the dictation's own grade(), so its rules hold here too ---------- */
  const wordIds = (a) => a.words.map((w) => w.en);
  const findWord = (a, id) => a.words.find((w) => w.en === id) || null;
  /* homo is optional: same-sounding words accepted when the word was only heard. */
  const wordItem = (w) => ({ id: w.en, word: w.en, zh: w.zh, note: w.pos, alts: w.accept.filter((x) => C.norm(x) !== C.norm(w.en)), homo: Array.isArray(w.homo) ? w.homo.filter(isText) : [] });
  const gradeWord = (input, w, mode) => C.grade(input, wordItem(w), mode);

  /* ---------- step 2a ---------- */
  const clozeIds = (a) => a.cloze.map((c) => c.id);
  const findCloze = (a, id) => a.cloze.find((c) => c.id === id) || null;
  const clozeSentence = (c) => c.before + c.answers[0] + c.after;
  /* The exact form: no allowance for hyphens or spaces here, unlike the dictation. */
  function gradeCloze(input, c) {
    const a = C.norm(input);
    if (!a) return { r: "empty" };
    return c.answers.some((x) => C.norm(x) === a) ? { r: "ok" } : { r: "bad" };
  }
  /* The first letters of the answer, as a cue. One letter would not do: Nevertheless starts like Nonetheless. */
  const clozeStart = (c) => c.answers[0].slice(0, 2).trim();
  /* Letters to add, drop or change to turn one text into the other. */
  function editDistance(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row;
    }
    return prev[b.length];
  }
  /* A slip in the spelling or the form, as opposed to a different word. */
  const isNearMiss = (input, answer) => editDistance(C.norm(input), C.norm(answer)) <= 2;
  /* In a fill-in the word itself in some other form is a slip too, however many letters that takes: "stress" for "stressing", or "outlining", which drops a final e. */
  const clozeNear = (input, c) => C.norm(input).startsWith(C.norm(c.word).replace(/e$/, "")) || [c.word].concat(c.answers).some((x) => isNearMiss(input, x));
  /* The item's sentence cut up around its blanks: { text }, { text, mark } for the revealed answer, or { blank, current }.
     Items can share a sentence, so any other item still in pending keeps a blank, or its answer would be on show before it is asked. */
  function clozeParts(a, item, pending, reveal) {
    const s = clozeSentence(item), hide = new Set(pending), parts = [];
    const cuts = a.cloze.filter((c) => clozeSentence(c) === s && (c === item || hide.has(c.id)))
      .map((c) => ({ from: c.before.length, to: c.before.length + c.answers[0].length, current: c === item }))
      .sort((x, y) => x.from - y.from);
    let at = 0;
    cuts.forEach((k) => {
      if (k.from > at) parts.push({ text: s.slice(at, k.from) });
      if (k.current && reveal) parts.push({ text: s.slice(k.from, k.to), mark: true });
      else parts.push({ blank: true, current: k.current });
      at = k.to;
    });
    if (at < s.length) parts.push({ text: s.slice(at) });
    return parts;
  }
  const blanksLeft = (parts) => parts.filter((p) => p.blank).length;
  /* Each distinct sentence once, in the order they come up. */
  function clozeSentences(a) {
    const seen = new Set(), out = [];
    a.cloze.forEach((c) => { const text = clozeSentence(c); if (!seen.has(text)) { seen.add(text); out.push({ text, zh: c.zh, para: c.para }); } });
    return out;
  }

  /* ---------- the practice queue used by steps 1 and 2a ----------
     queue[0] is being asked. A miss goes to the back and stays counted as missed; a right answer leaves. score is set once, when the
     first run is over, so practising again cannot rewrite it. */
  const newDrill = (ids) => ({ order: ids.slice(), queue: ids.slice(), miss: [], score: null });
  function drillAnswer(d, ok) {
    const id = d.queue.shift();
    if (id === undefined) return;
    if (!ok) {
      if (d.miss.indexOf(id) === -1) d.miss.push(id);
      d.queue.push(id);
    }
    if (!d.queue.length && !d.score) d.score = [d.order.length - d.miss.length, d.order.length];
  }
  function drillAgain(d, ids) { d.order = ids.slice(); d.queue = ids.slice(); d.miss = []; }
  /* Only for a run after the first: leaving the first run early would leave it without a score. */
  function drillStop(d) { if (d.score) d.queue = []; }
  /* One entry per item: "ok", "bad" (missed, not yet right), "cur" or "". */
  const drillMarks = (d, cur) => d.order.map((id) => (id === cur ? "cur" : d.queue.indexOf(id) === -1 ? "ok" : d.miss.indexOf(id) !== -1 ? "bad" : ""));
  function shuffled(list, rng) {
    const a = list.slice(), r = rng || Math.random;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ---------- step 2b: surface checks only. Nothing here can tell whether a sentence is grammatical, and the page says so. ---------- */
  function softHints(text, item) {
    const t = String(text === null || text === undefined ? "" : text).trim();
    if (!t) return [{ code: "empty", msg: "还没有写句子。" }];
    const out = [];
    if (!item.mustInclude.some((p) => hasPhrase(t, p))) out.push({ code: "include", msg: "没有找到目标搭配：" + item.mustInclude.join(" / ") + "。" });
    /* A sentence may open with a quotation mark or a number. */
    if (!/^["'“‘(\[]*[\p{Lu}\p{N}]/u.test(t)) out.push({ code: "capital", msg: "句子开头一般要大写。" });
    if (!/[.?!]["'”’)\]]*$/.test(t)) out.push({ code: "end", msg: "句子结尾要有英文标点（. ? !）。" });
    return out;
  }
  const writeItem = (a, id) => a.writing.find((w) => w.id === id) || null;
  const writeEntry = (rec, id) => (own(rec.write.items, id) ? rec.write.items[id] : { t: "", shown: false, done: false });
  /* The next one not marked done, in order. */
  function nextWriteId(a, rec) {
    const w = a.writing.find((x) => !writeEntry(rec, x.id).done);
    return w ? w.id : "";
  }
  const writtenCount = (a, rec) => a.writing.filter((w) => { const e = writeEntry(rec, w.id); return e.done && e.t.trim() !== ""; }).length;

  /* ---------- step 3 ---------- */
  /* The text cut into { text } and { text, en } for each word form found. Forms match exactly as listed, as whole words; longest first where they overlap. */
  function markWords(text, words) {
    const spans = [], parts = [];
    words.forEach((w) => w.forms.forEach((f) => {
      for (let i = indexOfWhole(text, f, 0); i !== -1; i = indexOfWhole(text, f, i + f.length)) spans.push({ from: i, to: i + f.length, en: w.en });
    }));
    spans.sort((x, y) => x.from - y.from || y.to - x.to);
    let at = 0;
    spans.forEach((s) => {
      if (s.from < at) return;
      if (s.from > at) parts.push({ text: text.slice(at, s.from) });
      parts.push({ text: text.slice(s.from, s.to), en: s.en });
      at = s.to;
    });
    if (at < text.length) parts.push({ text: text.slice(at) });
    return parts;
  }
  const NOT_AN_END = /(?:^|[\s(.“"‘'])(?:[A-Za-z]|e\.g|i\.e|etc|vs|mr|mrs|ms|dr|prof|st|no|fig)\.$/i;
  function splitSentences(text) {
    const s = String(text).trim(), out = [], re = /[.?!]+[”"’')\]]*\s+/g;
    let from = 0, m;
    while ((m = re.exec(s))) {
      const end = m.index + m[0].length;
      if (!/^[“"‘'(\[]*[A-Z0-9]/.test(s.slice(end))) continue;
      if (NOT_AN_END.test(s.slice(from, m.index + 1))) continue;
      out.push(s.slice(from, end).trim());
      from = end;
    }
    if (from < s.length) out.push(s.slice(from).trim());
    return out;
  }
  const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;
  /* Pieces short enough to speak in one go: some engines stop a long utterance after about 15 seconds, so a long sentence is cut at its commas. */
  function speechChunks(text) {
    const out = [];
    splitSentences(text).forEach((s) => {
      if (wordCount(s) <= LIMITS.chunkWords) { out.push(s); return; }
      let cur = "";
      /* A stretch with no comma to cut at is cut at the limit, which can fall mid-phrase but keeps the piece short. */
      const flush = (t) => { const w = t.split(/\s+/); for (let i = 0; i < w.length; i += LIMITS.chunkWords) out.push(w.slice(i, i + LIMITS.chunkWords).join(" ")); };
      s.replace(/([;:,][”"’')\]]?)\s+/g, "$1\n").split("\n").forEach((p) => {
        if (cur && wordCount(cur) + wordCount(p) > LIMITS.chunkWords) { flush(cur); cur = p; }
        else cur = cur ? cur + " " + p : p;
      });
      if (cur) flush(cur);
    });
    return out;
  }

  /* ---------- steps unlock in order ---------- */
  function stepFlags(rec) {
    const dict = !!rec.dict.score, cloze = dict && !!rec.cloze.score, write = cloze && rec.write.done, read = write && rec.read.done;
    return { dict, cloze, write, read };
  }
  function canAt(rec, at) {
    const f = stepFlags(rec);
    return at === "dict" || (at === "cloze" && f.dict) || (at === "write" && f.cloze) || (at === "read" && f.write) || (at === "sum" && f.read);
  }
  const furthestAt = (rec) => ["sum", "read", "write", "cloze"].find((at) => canAt(rec, at)) || "dict";
  /* What the three-step bar shows: whether each is finished and whether it can be opened. */
  function stepBoxes(rec) {
    const f = stepFlags(rec);
    return [{ done: f.dict, open: true }, { done: f.write, open: f.dict }, { done: f.read, open: f.write }];
  }
  /* The screen a step button leads to. Step 2 is the first unfinished part, or its start when both are finished. */
  function stepTarget(rec, i) {
    const f = stepFlags(rec);
    if (i === 0) return "dict";
    if (i === 1) return f.cloze && !f.write ? "write" : "cloze";
    return "read";
  }
  const screenStep = (at) => (at === "dict" ? 0 : at === "cloze" || at === "write" ? 1 : 2);
  /* True numbers from what was saved: first-try results are null until that step has been finished. */
  const unitNumbers = (a, rec) => ({ dict: rec.dict.score, cloze: rec.cloze.score, written: writtenCount(a, rec), writeTotal: a.writing.length });

  /* ---------- stored shape: every field is rebuilt by hand, so nothing unexpected survives ---------- */
  const blankStore = () => ({ v: 1, open: "", articles: {} });
  function blankRecord(a, rng) {
    return {
      at: "dict",
      dict: newDrill(shuffled(wordIds(a), rng)),
      cloze: newDrill(clozeIds(a)), /* the data's order is deliberate: it spreads out items that share a sentence */
      write: { cur: a.writing[0].id, items: {}, done: false },
      read: { para: 0, done: false }
    };
  }
  function saneDrill(o, ids) {
    if (!isObj(o)) return null;
    const known = new Set(ids);
    const pick = (x) => (Array.isArray(x) ? Array.from(new Set(x.filter((id) => known.has(id)))) : []);
    const seen = pick(o.order), fresh = ids.filter((id) => seen.indexOf(id) === -1);
    const s = o.score;
    const score = Array.isArray(s) && s.length === 2 && Number.isInteger(s[0]) && Number.isInteger(s[1]) && s[0] >= 0 && s[0] <= s[1] && s[1] > 0 ? [s[0], s[1]] : null;
    const d = { order: seen.concat(fresh), queue: pick(o.queue), miss: pick(o.miss), score };
    /* Words added to the article since this run began are still to do; a finished step stays finished. */
    if (!score) d.queue = d.queue.concat(fresh);
    if (!d.queue.length && !d.score) d.score = [d.order.length - d.miss.length, d.order.length];
    return d;
  }
  function saneWrite(o, a) {
    const src = isObj(o) ? o : {}, given = isObj(src.items) ? src.items : {}, out = { cur: "", items: {}, done: src.done === true };
    a.writing.forEach((w) => {
      if (!own(given, w.id) || !isObj(given[w.id])) return;
      const e = given[w.id], t = typeof e.t === "string" ? e.t.slice(0, LIMITS.text) : "";
      out.items[w.id] = { t, shown: e.shown === true, done: e.done === true };
    });
    const r = { write: out };
    if (typeof src.cur === "string" && writeItem(a, src.cur)) out.cur = src.cur;
    if (!out.done) {
      if (!out.cur || writeEntry(r, out.cur).done) out.cur = nextWriteId(a, r);
      if (!out.cur) out.done = true;
    }
    return out;
  }
  function saneRead(o, a) {
    const src = isObj(o) ? o : {};
    return { para: Number.isInteger(src.para) && src.para >= 0 && src.para < a.paragraphs.length ? src.para : 0, done: src.done === true };
  }
  function saneRecord(o, a) {
    const src = isObj(o) ? o : {}, base = blankRecord(a);
    const rec = { at: "dict", dict: saneDrill(src.dict, wordIds(a)) || base.dict, cloze: saneDrill(src.cloze, clozeIds(a)) || base.cloze, write: saneWrite(src.write, a), read: saneRead(src.read, a) };
    /* A later step cannot be finished before an earlier one. */
    if (!rec.dict.score) rec.cloze = base.cloze;
    if (!rec.cloze.score) rec.write.done = false;
    if (!rec.write.done) rec.read.done = false;
    if (!rec.write.done && !rec.write.cur) rec.write.cur = nextWriteId(a, rec) || a.writing[0].id;
    rec.at = SCREENS.indexOf(src.at) !== -1 && canAt(rec, src.at) ? src.at : furthestAt(rec);
    return rec;
  }
  function saneStore(o) {
    const s = blankStore();
    if (!isObj(o) || o.v !== 1) return s;
    if (isObj(o.articles)) ARTICLES.forEach((a) => { if (own(o.articles, a.id) && isObj(o.articles[a.id])) s.articles[a.id] = saneRecord(o.articles[a.id], a); });
    if (typeof o.open === "string" && own(s.articles, o.open)) s.open = o.open;
    return s;
  }
  /* Whether anything present was left out, so the raw text is worth keeping before the next write replaces it. */
  function lostSomething(o, s) {
    if (o.articles === undefined) return false;
    if (!isObj(o.articles)) return true;
    return Object.keys(o.articles).some((id) => {
      if (!own(s.articles, id)) return true;
      const rec = o.articles[id];
      if (["dict", "cloze", "write", "read"].some((k) => rec[k] !== undefined && !isObj(rec[k]))) return true;
      const items = isObj(rec.write) ? rec.write.items : undefined;
      if (items === undefined) return false;
      return !isObj(items) || Object.keys(items).length !== Object.keys(s.articles[id].write.items).length;
    });
  }
  /* A raw stored string to a store. damaged means something present could not be kept. */
  function readStored(raw) {
    if (raw === null || raw === undefined) return { store: blankStore(), damaged: false };
    let o;
    try { o = JSON.parse(raw); } catch (e) { return { store: blankStore(), damaged: true }; }
    const store = saneStore(o);
    return { store, damaged: !isObj(o) || o.v !== 1 || lostSomething(o, store) };
  }
  /* The articles part of an export file: a clean store, or null when it cannot be used. An empty list is a real export from someone who had started nothing.
     Every record this site saves has an order for both drills, so a list without one such record holds nothing to restore, and must not replace real progress with nothing. */
  function importable(raw) {
    if (!isObj(raw) || raw.v !== 1 || !isObj(raw.articles)) return null;
    const store = saneStore(raw), hasOrder = (d) => isObj(d) && Array.isArray(d.order);
    const usable = Object.keys(store.articles).some((id) => hasOrder(raw.articles[id].dict) && hasOrder(raw.articles[id].cloze));
    return usable || !Object.keys(raw.articles).length ? store : null;
  }
  const startedCount = (store) => Object.keys(store.articles).length;

  /* ---------- article data contract: returns a list of problems, empty when fine ---------- */
  /* Anything here would stop an article from rendering, so an entry with one of these is left out of the list. */
  function shapeProblems(a) {
    if (!isObj(a) || !isId(a.id)) return ["article id: lower-case letters, digits and hyphens only"];
    const errs = [], need = (ok, what) => { if (!ok) errs.push(a.id + ": " + what); };
    const rows = (x, each) => Array.isArray(x) && x.length > 0 && x.every((r) => isObj(r) && each(r));
    need(isText(a.title), "title");
    need(rows(a.paragraphs, (p) => isText(p.label) && isText(p.text)), "paragraphs");
    need(rows(a.words, (w) => isText(w.en) && isText(w.zh) && isText(w.pos) && textList(w.forms) && textList(w.accept)), "words");
    need(rows(a.cloze, (c) => isId(c.id) && isText(c.word) && isText(c.para) && typeof c.before === "string" && typeof c.after === "string" && textList(c.answers) && isText(c.zh) && typeof c.note === "string"), "cloze");
    need(rows(a.writing, (w) => isId(w.id) && isText(w.word) && isText(w.pattern) && isText(w.prompt_zh) && textList(w.mustInclude) && textList(w.models) && textList(w.check)), "writing");
    return errs;
  }
  function checkArticles(data) {
    if (!isObj(data) || !Array.isArray(data.articles)) return ["bad root"];
    const errs = [], seen = new Set(), dupes = (xs) => new Set(xs).size !== xs.length;
    data.articles.forEach((a) => {
      const shape = shapeProblems(a);
      if (shape.length) { errs.push.apply(errs, shape); return; }
      const need = (ok, what) => { if (!ok) errs.push(a.id + ": " + what); };
      need(!seen.has(a.id), "duplicate article id");
      seen.add(a.id);
      need(!dupes(a.paragraphs.map((p) => p.label)), "duplicate paragraph label");
      need(!dupes(wordIds(a)), "duplicate word");
      need(!dupes(clozeIds(a)), "duplicate cloze id");
      need(!dupes(a.writing.map((w) => w.id)), "duplicate writing id");
      const all = a.paragraphs.map((p) => p.text).join("\n");
      a.words.forEach((w) => {
        w.forms.forEach((f) => need(indexOfWhole(all, f, 0) !== -1, w.en + ": form not found in the text: " + f));
        need(C.norm(w.accept[0]) === C.norm(w.en), w.en + ": accept must start with en");
        need(w.homo === undefined || textList(w.homo), w.en + ": homo must be a list of words");
        need(hasZh(w.zh), w.en + ": zh");
        need(a.cloze.filter((c) => c.word === w.en).length === 1, w.en + ": needs exactly one cloze item");
      });
      a.cloze.forEach((c) => {
        const p = a.paragraphs.find((x) => x.label === c.para);
        need(!!findWord(a, c.word), c.id + ": word is not in words");
        need(!!p, c.id + ": para is not a paragraph label");
        if (p) need(p.text.indexOf(clozeSentence(c)) !== -1, c.id + ": before + answers[0] + after is not in that paragraph");
        need(hasZh(c.zh), c.id + ": zh");
        a.cloze.forEach((d) => {
          if (d === c || clozeSentence(d) !== clozeSentence(c)) return;
          const c2 = c.before.length + c.answers[0].length, d2 = d.before.length + d.answers[0].length;
          if (c.before.length < d2 && d.before.length < c2) errs.push(a.id + ": " + c.id + " overlaps " + d.id);
        });
      });
      a.writing.forEach((w) => {
        need(hasZh(w.prompt_zh), w.id + ": prompt_zh");
        w.models.forEach((m) => softHints(m, w).forEach((h) => errs.push(a.id + ": " + w.id + " model fails the " + h.code + " check: " + m)));
      });
    });
    return errs;
  }

  /* An entry that cannot be rendered is left out, not fatal; the list says so and the test page says why. A repeated id keeps the first. */
  const ALL = Array.isArray(DATA.articles) ? DATA.articles : [];
  const ARTICLES = [], BY_ID = new Map();
  ALL.forEach((a) => { if (!shapeProblems(a).length && !BY_ID.has(a.id)) { ARTICLES.push(a); BY_ID.set(a.id, a); } });
  const SKIPPED = ALL.length - ARTICLES.length;

  root.WLIU_ARTICLE_CORE = {
    KEY, RECOVERY_KEY, LIMITS, STEPS, ARTICLES, BY_ID, SKIPPED,
    hasPhrase, indexOfWhole, wordIds, findWord, wordItem, gradeWord,
    clozeIds, findCloze, clozeSentence, gradeCloze, clozeStart, isNearMiss, clozeNear, clozeParts, blanksLeft, clozeSentences,
    newDrill, drillAnswer, drillAgain, drillStop, drillMarks, shuffled,
    softHints, writeItem, writeEntry, nextWriteId, writtenCount,
    markWords, splitSentences, speechChunks,
    stepFlags, canAt, furthestAt, stepBoxes, stepTarget, screenStep, unitNumbers,
    blankStore, blankRecord, saneDrill, saneRecord, saneStore, readStored, importable, startedCount,
    shapeProblems, checkArticles
  };
})(window);
