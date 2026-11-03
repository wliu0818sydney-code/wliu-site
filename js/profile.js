/* Who is practising in this browser. There are no passwords and no sync: the name only picks which saved progress to use,
   and anyone on this device who types the same name sees it. No DOM. */
(function (root) {
  "use strict";

  const KEY = "wliu-site-profile", TAB_KEY = "wliu-site-tab-profile", MAX_NAME = 20;
  /* Control, format (zero-width, bidi) and line-separator characters. */
  const BAD_CHAR = /[\p{C}\p{Zl}\p{Zp}]/u;

  function normalize(raw) {
    const text = (typeof raw === "string" ? raw : "").normalize("NFKC").trim();
    if (!text) return { ok: false, code: "empty" };
    /* Checked before the spaces collapse, because \s also matches tabs, line separators and U+FEFF and would hide them. */
    if (BAD_CHAR.test(text)) return { ok: false, code: "chars" };
    const name = text.replace(/\s+/g, " ");
    if (Array.from(name).length > MAX_NAME) return { ok: false, code: "long" };
    return { ok: true, name, id: name.toLowerCase() };
  }

  /* A guest keeps the plain key, so progress from before there were profiles stays with the guest. */
  const keyFor = (base, profile) => (profile && profile.kind === "user" ? base + "@" + encodeURIComponent(profile.id) : base);

  function stored(area, key) {
    try {
      const o = JSON.parse(area().getItem(key));
      return o && typeof o === "object" ? o : null;
    } catch (e) { return null; }
  }
  const local = () => localStorage, tab = () => sessionStorage;
  /* Who this tab logged in as. Each tab keeps its own, so a login elsewhere cannot change it on a reload.
     Every field is rebuilt by hand, so nothing unexpected in storage survives. */
  function read() {
    const o = stored(tab, TAB_KEY);
    if (!o) return null;
    if (o.kind === "guest") return { kind: "guest" };
    if (o.kind !== "user") return null;
    const n = normalize(o.name);
    return n.ok && n.name === o.name && n.id === o.id ? { kind: "user", name: n.name, id: n.id } : null;
  }
  /* The last name used anywhere in this browser, for the login form. */
  function lastName() {
    const o = stored(local, KEY), n = o ? normalize(o.kind === "user" ? o.name : o.last) : null;
    return n && n.ok ? n.name : "";
  }
  /* Returns whether this tab will remember it. A guest still remembers the last user's name, for the login form. */
  function save(profile) {
    let doc = null;
    if (profile && profile.kind === "guest") doc = { kind: "guest", last: lastName() || undefined };
    else if (profile && profile.kind === "user") {
      const n = normalize(profile.name);
      if (n.ok) doc = { kind: "user", name: n.name, id: n.id };
    }
    if (!doc) return false;
    const text = JSON.stringify(doc);
    try { local().setItem(KEY, text); } catch (e) { /* the form just will not be filled in next time */ }
    try { tab().setItem(TAB_KEY, text); return true; } catch (e) { return false; }
  }

  root.WLIU_PROFILE = { normalize, keyFor, read, save, lastName };
})(window);
