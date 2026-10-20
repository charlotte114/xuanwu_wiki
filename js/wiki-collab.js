/*!
 * wiki-collab.js — 玩家协作层
 * 能力：登录态显示 / 整页图文编辑 / 提交待审版本 / 应用已通过的线上内容
 * 依赖：js/wiki-cloud.js（云服务客户端）
 *
 * 页面约定：需要支持编辑的区域，在 HTML 里加 data-wiki-edit 属性即可，
 * 同一页面可以有多个区域，按 DOM 顺序提交与还原。
 */
(function () {
  if (window.__wikiCollabBooted) return;
  window.__wikiCollabBooted = true;

  var NICK_KEY = "wiki_collab_nick";
  var RETURN_KEY = "wiki_collab_return";
  // 静态托管不下发 Cache-Control，浏览器会按 Last-Modified 启发式缓存。
  // 页面类资源没法靠 URL 自动失效，这里统一挂版本号，改版后不必让用户手动清缓存。
  // 注意：与 js/wiki.js 里的 COLLAB_VER 保持一致。
  var ASSET_VER = "20261018a";

  var DROP_TAGS = {
    SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, LINK: 1, META: 1,
    FORM: 1, INPUT: 1, BUTTON: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1,
    BASE: 1, NOSCRIPT: 1, TEMPLATE: 1, CANVAS: 1, SVG: 1, VIDEO: 1, AUDIO: 1
  };
  // NAV / TIME 必须放行：首页「副本」那一栏的网格容器就是 <nav class="home-tile-grid">，
  // 名单里漏掉它时，清洗会把这个容器剥掉、只留里面的方块，
  // 方块于是从「一排 5 个」退化成通栏一行行（2026-10-14 的实际事故）。
  // TIME 是「最近更新」里日期的语义标签，剥掉后日期会失去右对齐。
  var ALLOWED_TAGS = {
    A: 1, P: 1, DIV: 1, SPAN: 1, NAV: 1, TIME: 1,
    H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
    UL: 1, OL: 1, LI: 1, BR: 1, HR: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1,
    S: 1, DEL: 1, BLOCKQUOTE: 1, CODE: 1, PRE: 1, TABLE: 1, THEAD: 1,
    TBODY: 1, TR: 1, TD: 1, TH: 1, IMG: 1, FIGURE: 1, FIGCAPTION: 1,
    SMALL: 1, SUP: 1, SUB: 1, MARK: 1, DL: 1, DT: 1, DD: 1, CAPTION: 1
  };
  var ALLOWED_ATTRS = {
    href: 1, src: 1, alt: 1, title: 1, class: 1, colspan: 1, rowspan: 1,
    target: 1, rel: 1, width: 1, height: 1, loading: 1, datetime: 1,
    "aria-label": 1, "aria-hidden": 1
  };

  var state = {
    client: null,
    session: null,
    isAdmin: false,
    pageKey: "",
    rows: null
  };

  function siteBase() {
    var sheet = document.querySelector('link[rel="stylesheet"][href*="wiki.css"]');
    if (!sheet) return "";
    return sheet.getAttribute("href").replace(/css\/wiki\.css\/?(?:\?[^"']*)?$/, "");
  }

  function url(rel) {
    try {
      return new URL(siteBase() + rel, location.href).href;
    } catch (e) {
      return siteBase() + rel;
    }
  }

  // 由 page_key（如 pages/guide-list.html）还原成绝对地址，供「我的提交 / 审核台」跳转使用
  function pageUrl(pageKey) {
    return url(String(pageKey == null ? "" : pageKey));
  }

  function currentPageKey() {
    var p = location.pathname.replace(/^\/+/, "");
    if (!p || /\/$/.test(p)) p += "index.html";
    try {
      p = decodeURIComponent(p);
    } catch (e) {}
    return p;
  }

  function editableRegions() {
    var main = document.querySelector("main.wiki-main") || document.body;
    return Array.prototype.slice.call(main.querySelectorAll("[data-wiki-edit]"));
  }

  function sanitizeInto(src, dest, doc) {
    var kids = Array.prototype.slice.call(src.childNodes);
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (n.nodeType === 3) {
        dest.appendChild(doc.createTextNode(n.nodeValue));
        continue;
      }
      if (n.nodeType !== 1) continue;
      var tag = n.tagName.toUpperCase();
      if (DROP_TAGS[tag]) continue;
      if (!ALLOWED_TAGS[tag]) {
        sanitizeInto(n, dest, doc);
        continue;
      }
      var el = doc.createElement(tag.toLowerCase());
      var attrs = n.attributes;
      for (var j = 0; j < attrs.length; j++) {
        var name = attrs[j].name.toLowerCase();
        if (!ALLOWED_ATTRS[name]) continue;
        var val = attrs[j].value;
        if ((name === "href" || name === "src") && /^\s*(javascript|vbscript|data):/i.test(val)) continue;
        el.setAttribute(name, val);
      }
      if (tag === "A" && el.getAttribute("target")) {
        el.setAttribute("rel", "noopener noreferrer");
      }
      sanitizeInto(n, el, doc);
      dest.appendChild(el);
    }
  }

  function sanitize(html) {
    var doc = new DOMParser().parseFromString(String(html == null ? "" : html), "text/html");
    var out = doc.createElement("div");
    sanitizeInto(doc.body, out, doc);
    return out.innerHTML;
  }

  // 兜底修复：老存档里首页方块的网格容器被清洗剥掉后，方块会变成通栏一行行
  // （见 ALLOWED_TAGS 处的说明）。回填之后把直接散落在区域里的 .home-tile
  // 重新收进网格容器，保证「一排 5 个」的排布不依赖存档的正确性。
  // 内容正常（方块本就在容器里）时这里是空操作。
  function regroupTiles(root) {
    if (!root || !root.children) return;
    var kids = Array.prototype.slice.call(root.children);
    var run = [];
    function flush() {
      if (!run.length) return;
      var wrap = document.createElement("nav");
      wrap.className = "home-tile-grid home-tile-grid--row5 home-dungeon-nav";
      root.insertBefore(wrap, run[0]);
      for (var k = 0; k < run.length; k++) wrap.appendChild(run[k]);
      run = [];
    }
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (n.tagName === "A" && n.classList && n.classList.contains("home-tile")) {
        run.push(n);
      } else {
        flush();
      }
    }
    flush();
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fmtTime(value) {
    if (!value) return "";
    var d = new Date(value);
    if (isNaN(d.getTime())) return "";
    function pad(n) {
      return n < 10 ? "0" + n : String(n);
    }
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  // 站点自带攻略只登记到日期（没有时分）。硬套 fmtTime 会把它当成 UTC 零点，
  // 变成一个假的「08:00」；这里原样输出日期。
  function contribWhen(value) {
    var s = String(value == null ? "" : value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return value ? fmtTime(value) : "";
  }

  function decodeRegions(value) {
    if (Array.isArray(value)) return value.map(function (v) { return String(v == null ? "" : v); });
    if (typeof value === "string") {
      try {
        var parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map(function (v) { return String(v == null ? "" : v); });
      } catch (e) {}
    }
    return [];
  }

  function nick() {
    try {
      return localStorage.getItem(NICK_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function setNick(v) {
    try {
      if (v) localStorage.setItem(NICK_KEY, v);
    } catch (e) {}
  }

  var barEls = null;

  function buildBar() {
    if (barEls) return barEls;
    // 登录页 / 审核台 / 我的提交这类工具页不挂协作条：
    // 它们本身没有可编辑正文，挂了只会多出一个会误提交本页的按钮。
    if (document.body && document.body.hasAttribute("data-wiki-utility")) return null;
    var shell = document.querySelector(".wiki-shell");
    if (!shell) return null;

    var bar = el("div", "wiki-collab-bar");
    bar.id = "wikiCollabBar";

    var info = el("span", "wiki-collab-info");
    info.id = "wikiCollabInfo";
    info.textContent = "内容由玩家协作维护";

    var actions = el("div", "wiki-collab-actions");

    var submitLink = el("a", "wiki-collab-btn wiki-collab-btn--ghost", "投稿攻略");
    submitLink.id = "wikiCollabSubmitLink";
    submitLink.href = url("pages/submit-guide.html") + "?v=" + ASSET_VER;
    submitLink.title = "写一篇攻略投稿，审核通过后发布在「攻略大全 · 玩家攻略」";

    // 历史对所有人开放（未登录也能看），因为「谁在什么时候改了什么」本身就是公开信息，
    // 也是社区相互校对的基础。回退按钮只在审核员登录后出现。
    var histBtn = el("button", "wiki-collab-btn wiki-collab-btn--ghost", "历史");
    histBtn.type = "button";
    histBtn.id = "wikiCollabHistoryBtn";
    histBtn.title = "查看这一页的全部修订记录，可对比任意版本或还原";

    var editBtn = el("button", "wiki-collab-btn wiki-collab-btn--primary", "编辑本页");
    editBtn.type = "button";
    editBtn.id = "wikiCollabEditBtn";

    var reviewLink = el("a", "wiki-collab-btn wiki-collab-btn--ghost", "审核台");
    reviewLink.id = "wikiCollabReviewLink";
    reviewLink.href = url("pages/review.html") + "?v=" + ASSET_VER;
    reviewLink.hidden = true;

    var mineLink = el("a", "wiki-collab-btn wiki-collab-btn--ghost", "我的提交");
    mineLink.id = "wikiCollabMineLink";
    mineLink.href = url("pages/my-submissions.html") + "?v=" + ASSET_VER;
    mineLink.hidden = true;

    var userSpan = el("span", "wiki-collab-user", "未登录");
    userSpan.id = "wikiCollabUser";

    var authBtn = el("button", "wiki-collab-btn wiki-collab-btn--ghost", "登录");
    authBtn.type = "button";
    authBtn.id = "wikiCollabAuthBtn";

    actions.appendChild(submitLink);
    actions.appendChild(histBtn);
    actions.appendChild(editBtn);
    actions.appendChild(reviewLink);
    actions.appendChild(mineLink);
    actions.appendChild(userSpan);
    actions.appendChild(authBtn);
    bar.appendChild(info);
    bar.appendChild(actions);

    var body = shell.querySelector(".wiki-body");
    if (body) shell.insertBefore(bar, body);
    else shell.appendChild(bar);

    authBtn.addEventListener("click", function () {
      if (state.session) {
        if (!state.client) return;
        state.client.auth.signOut().then(function () {
          try {
            sessionStorage.removeItem(RETURN_KEY);
          } catch (e) {}
          location.reload();
        });
      } else {
        try {
          sessionStorage.setItem(RETURN_KEY, location.href);
        } catch (e) {}
        location.href = url("pages/login.html");
      }
    });

    editBtn.addEventListener("click", openEditor);
    histBtn.addEventListener("click", openHistory);

    barEls = {
      bar: bar,
      info: info,
      edit: editBtn,
      hist: histBtn,
      submit: submitLink,
      review: reviewLink,
      mine: mineLink,
      user: userSpan,
      auth: authBtn
    };
    return barEls;
  }

  function renderBar() {
    var els = buildBar();
    if (!els) return;
    // 攻略阅读页没有可编辑正文，「编辑本页」在这个页面没有意义，
    // 那页由自己的「改进本篇」按钮负责跳转，这里只保留登录态与投稿入口。
    var articleView = !!(document.body && document.body.hasAttribute("data-wiki-article-view"));

    // 没有历史目标的页面（图鉴、工具页、无 page_key 的页）不显示「历史」，
    // 免得点开一看是空的。
    if (els.hist) els.hist.hidden = !historyTarget();

    if (!state.session) {
      els.user.textContent = "未登录";
      els.auth.textContent = "登录";
      els.edit.hidden = true;
      els.review.hidden = true;
      els.mine.hidden = true;
      if (articleView) els.info.textContent = "本文由玩家投稿 · 登录后可补充修改";
      return;
    }

    var who = nick() || "已登录玩家";
    els.user.textContent = who + (state.isAdmin ? " · 审核员" : "");
    els.auth.textContent = "退出";
    els.edit.hidden = articleView;
    els.review.hidden = !state.isAdmin;
    els.mine.hidden = false;

    var count = editableRegions().length;
    els.edit.textContent = count ? "编辑本页" : "提交修正建议";

    if (articleView) {
      els.info.textContent = "本文由玩家投稿 · 文末可「改进本篇」";
    } else if (compendiumConfig()) {
      // 图鉴页的内容按条目改，提示一下入口在哪
      els.info.textContent = "点条目右上角「纠错」可修正这一条";
    }
  }

  function setInfo(text) {
    var els = buildBar();
    if (els) els.info.textContent = text;
  }

  function showBadge(row) {
    var main = document.querySelector("main.wiki-main");
    if (!main || document.getElementById("wikiCollabBadge")) return;
    var badge = el("p", "wiki-collab-badge");
    badge.id = "wikiCollabBadge";
    var when = fmtTime(row.updated_at);
    badge.textContent = "本页内容由玩家协作维护";
    if (when) badge.textContent += " · 最近更新 " + when;
    if (row.updated_by_name) badge.textContent += " · " + row.updated_by_name;
    main.insertBefore(badge, main.firstChild);
  }

  function showNoteCard(note, row) {
    var main = document.querySelector("main.wiki-main");
    if (!main || document.getElementById("wikiCollabNote")) return;
    var card = el("section", "wiki-card wiki-collab-note");
    card.id = "wikiCollabNote";
    card.appendChild(el("h2", null, "玩家补充"));
    var body = el("div", "wiki-collab-note-body");
    body.innerHTML = sanitize(note);
    card.appendChild(body);
    var meta = el("p", "muted wiki-collab-note-meta");
    var bits = [];
    if (row.updated_by_name) bits.push(row.updated_by_name);
    var when = fmtTime(row.updated_at);
    if (when) bits.push(when);
    meta.textContent = bits.join(" · ");
    if (bits.length) card.appendChild(meta);
    main.appendChild(card);
  }

  var overlay = null;

  function buildOverlay() {
    if (overlay) return overlay;
    var box = el("div", "wiki-collab-overlay");
    box.id = "wikiCollabOverlay";
    box.hidden = true;

    var dialog = el("div", "wiki-collab-dialog");
    var head = el("div", "wiki-collab-dialog-head");
    var title = el("h2", null, "编辑本页");
    var close = el("button", "wiki-collab-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "关闭");
    head.appendChild(title);
    head.appendChild(close);

    var tools = el("div", "wiki-collab-tools");
    [
      ["bold", "加粗"], ["italic", "斜体"], ["underline", "下划线"],
      ["formatBlock:h2", "小标题"], ["formatBlock:h3", "次标题"],
      ["insertUnorderedList", "无序列表"], ["insertOrderedList", "有序列表"],
      ["removeFormat", "清除格式"]
    ].forEach(function (pair) {
      var cmd = pair[0].split(":")[0];
      var arg = pair[0].split(":")[1];
      var btn = el("button", "wiki-collab-tool", pair[1]);
      btn.type = "button";
      btn.dataset.cmd = cmd;
      if (arg) btn.dataset.arg = arg;
      tools.appendChild(btn);
    });
    var linkBtn = el("button", "wiki-collab-tool", "插入链接");
    linkBtn.type = "button";
    linkBtn.dataset.cmd = "createLink";
    tools.appendChild(linkBtn);

    var fields = el("div", "wiki-collab-fields");
    fields.id = "wikiCollabFields";

    var hint = el("p", "wiki-collab-hint", "只改需要更新的部分即可，其余内容保持原样。提交后需审核通过才会显示在网站上。");

    var noteWrap = el("label", "wiki-collab-labelled");
    noteWrap.appendChild(el("span", null, "修改说明（选填）"));
    var noteInput = document.createElement("textarea");
    noteInput.id = "wikiCollabNoteInput";
    noteInput.rows = 3;
    noteInput.placeholder = "例如：补充了洛阳宅邸钓鱼的收益说明";
    noteWrap.appendChild(noteInput);

    var nickWrap = el("label", "wiki-collab-labelled");
    nickWrap.appendChild(el("span", null, "你的昵称"));
    var nickInput = document.createElement("input");
    nickInput.id = "wikiCollabNickInput";
    nickInput.type = "text";
    nickInput.maxLength = 24;
    nickInput.placeholder = "群昵称或游戏 ID";
    nickWrap.appendChild(nickInput);

    var msg = el("p", "wiki-collab-msg");
    msg.id = "wikiCollabMsg";

    var foot = el("div", "wiki-collab-dialog-foot");
    var cancel = el("button", "wiki-collab-btn wiki-collab-btn--ghost", "取消");
    cancel.type = "button";
    cancel.id = "wikiCollabCancel";
    var submit = el("button", "wiki-collab-btn wiki-collab-btn--primary", "提交审核");
    submit.type = "button";
    submit.id = "wikiCollabSubmit";
    foot.appendChild(cancel);
    foot.appendChild(submit);

    dialog.appendChild(head);
    dialog.appendChild(tools);
    dialog.appendChild(hint);
    dialog.appendChild(fields);
    dialog.appendChild(noteWrap);
    dialog.appendChild(nickWrap);
    dialog.appendChild(msg);
    dialog.appendChild(foot);
    box.appendChild(dialog);
    document.body.appendChild(box);

    close.addEventListener("click", closeEditor);
    cancel.addEventListener("click", closeEditor);
    box.addEventListener("click", function (e) {
      if (e.target === box) closeEditor();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !box.hidden) closeEditor();
    });

    tools.addEventListener("mousedown", function (e) {
      if (e.target.dataset && e.target.dataset.cmd) e.preventDefault();
    });
    tools.addEventListener("click", function (e) {
      var cmd = e.target.dataset && e.target.dataset.cmd;
      if (!cmd) return;
      var arg = e.target.dataset.arg || null;
      try {
        if (cmd === "createLink") {
          var href = window.prompt("请输入链接地址（可站内相对路径，如 ../articles/xxx.html）");
          if (!href) return;
          document.execCommand("createLink", false, href);
          return;
        }
        document.execCommand(cmd, false, arg);
      } catch (err) {}
      setMsg("");
    });

    submit.addEventListener("click", submitEdit);

    overlay = { box: box, fields: fields, note: noteInput, nick: nickInput, msg: msg, title: title };
    return overlay;
  }

  function setMsg(text, kind) {
    var o = overlay;
    if (!o) return;
    o.msg.textContent = text || "";
    o.msg.className = "wiki-collab-msg" + (kind ? " is-" + kind : "");
  }

  function closeEditor() {
    if (overlay) {
      overlay.box.hidden = true;
      overlay.fields.textContent = "";
    }
  }

  // preload 用于「继续修改」：把上次提交的内容直接载入编辑器。
  // 形如 { regions: ["<p>…</p>"], note: "修改说明", text: "建议模式下的正文" }
  function openEditor(preload) {
    if (!state.session) {
      try {
        sessionStorage.setItem(RETURN_KEY, location.href);
      } catch (e) {}
      location.href = url("pages/login.html");
      return;
    }
    var o = buildOverlay();
    var regions = editableRegions();
    var pre = preload || null;
    var preset = pre && Array.isArray(pre.regions) ? pre.regions : [];
    var refreshers = [];
    o.fields.textContent = "";
    o.note.value = pre && pre.note ? pre.note : "";
    o.nick.value = nick();
    setMsg("");

    if (!regions.length) {
      o.title.textContent = "提交修正建议";
      var wrap = el("div", "wiki-collab-field");
      wrap.appendChild(el("span", "wiki-collab-field-label", "本页为脚本生成的图表 / 工具页，请在下方写清楚需要修正的内容"));
      var ta = document.createElement("textarea");
      ta.id = "wikiCollabSuggestion";
      ta.rows = 6;
      ta.placeholder = "例如：罗汉洞掉落表里，紫金宝戒的掉率写错了，应该是……";
      if (pre && pre.text) ta.value = pre.text;
      wrap.appendChild(ta);
      o.fields.appendChild(wrap);
    } else {
      o.title.textContent = "编辑本页";
      regions.forEach(function (region, i) {
        var wrapField = el("div", "wiki-collab-field");
        var label = region.getAttribute("data-wiki-label") || "正文";
        wrapField.appendChild(el("span", "wiki-collab-field-label", "第 " + (i + 1) + " 段 · " + label));
        var host = el("div", "wiki-collab-editor");
        host.contentEditable = "true";
        host.spellcheck = false;
        // 继续修改时用上次提交的内容覆盖编辑区；基线仍是本页当前内容，
        // 这样预览里的差异就是「相对线上页面一共改了什么」，与审核台看到的完全一致。
        var presetHtml = preset.length === regions.length ? sanitize(preset[i]) : "";
        host.innerHTML = presetHtml || region.innerHTML;
        wrapField.appendChild(host);

        // 改动预览：只展示「哪些字被改掉了、哪些字是新写的」，未改动时整块隐藏
        var baseline = sanitize(region.innerHTML);
        var wrap = document.createElement("details");
        wrap.className = "wiki-collab-diffwrap";
        wrap.hidden = true;
        var sum = document.createElement("summary");
        var diffBody = el("div", "wiki-collab-diff");
        wrap.appendChild(sum);
        wrap.appendChild(diffBody);
        wrapField.appendChild(wrap);

        var refresh = debounce(function () {
          var res = window.WikiCollab.diff(baseline, sanitize(host.innerHTML));
          if (!res.changed) {
            wrap.hidden = true;
            wrap.open = false;
            diffBody.textContent = "";
            sum.textContent = "改动预览";
            return;
          }
          wrap.hidden = false;
          wrap.open = true;
          sum.textContent = "改动预览 · " + res.label;
          diffBody.innerHTML = res.html;
        }, 260);

        host.addEventListener("input", refresh);
        refreshers.push(refresh);

        o.fields.appendChild(wrapField);
      });
    }
    o.box.hidden = false;
    if (preset.length) refreshers.forEach(function (fn) { fn(); });
    var first = o.fields.querySelector(".wiki-collab-editor");
    if (first) first.focus();
  }

  function collectRegions() {
    var hosts = overlay ? overlay.fields.querySelectorAll(".wiki-collab-editor") : [];
    var out = [];
    Array.prototype.forEach.call(hosts, function (h) {
      out.push(sanitize(h.innerHTML));
    });
    return out;
  }

  function submitEdit() {
    if (!state.client || !state.session) {
      setMsg("登录状态已失效，请重新登录后再提交。", "error");
      return;
    }
    var noteInput = overlay.note;
    var suggestion = document.getElementById("wikiCollabSuggestion");
    var regions = collectRegions();
    var note = (noteInput.value || "").trim();
    // baseline = 玩家动手之前的原始内容，随提交一起存档。
    // 有了它，审核台无论线上有没有已发布版本，都能精确算出「改了哪些字」。
    var baseline = [];
    var totals = { added: 0, removed: 0, regions: 0 };

    if (!regions.length) {
      var text = suggestion ? (suggestion.value || "").trim() : "";
      if (!text) {
        setMsg("请先填写需要修正的内容。", "error");
        return;
      }
      note = text + (note ? "\n\n补充说明：" + note : "");
    } else {
      var slots = editableRegions();
      var changed = false;
      regions.forEach(function (html, i) {
        baseline.push(sanitize(slots[i] ? slots[i].innerHTML : ""));
      });
      regions.forEach(function (html, i) {
        var res = window.WikiCollab.diff(baseline[i], html);
        if (!res.changed) return;
        changed = true;
        totals.added += res.added;
        totals.removed += res.removed;
        totals.regions += 1;
      });
      if (!changed) {
        setMsg("内容没有变化，无需提交。", "error");
        return;
      }
    }

    var name = (overlay.nick.value || "").trim() || "热心玩家";
    setNick(name);

    var btn = document.getElementById("wikiCollabSubmit");
    btn.disabled = true;
    setMsg("正在提交…");

    var payload = {
      page_key: state.pageKey,
      page_title: document.title,
      regions: regions,
      baseline: baseline,
      note: note || null,
      owner_name: name,
      base_version: state.rows ? state.rows.version || null : null
    };

    state.client.database
      .from("wiki_submissions")
      .insert(payload)
      .select()
      .then(function (res) {
        btn.disabled = false;
        if (res.error) {
          setMsg("提交失败：" + (res.error.message || "请稍后重试"), "error");
          return;
        }
        var detail = totals.regions
          ? totals.added || totals.removed
            ? "本次共 " + totals.regions + " 段有改动：新增 " + totals.added + " 字、删除 " + totals.removed + " 字。"
            : "本次共 " + totals.regions + " 段有改动（仅段落或换行调整）。"
          : "";
        setMsg("已提交，等待审核通过后展示在本页。" + detail, "ok");
        setInfo("本页有待审提交，等待审核");
        window.setTimeout(closeEditor, 1400);
      });
  }

  function applyApproved(client) {
    // 没有数据库（纯静态预览、环境没配好）时整层降级：页面照常显示静态内容，
    // 只是没有存档回填。守卫放在这里而不是各调用点，boot 链才不会中途抛错断掉。
    if (!client || !client.database) return Promise.resolve(null);
    return client.database
      .from("wiki_pages")
      .select("*")
      .eq("page_key", state.pageKey)
      .maybeSingle()
      .then(function (res) {
        if (res.error) return null;
        var row = res.data;
        if (!row) return null;
        state.rows = row;

        var regions = decodeRegions(row.regions);
        var slots = editableRegions();
        if (regions.length && regions.length === slots.length) {
          slots.forEach(function (slot, i) {
            slot.innerHTML = sanitize(regions[i]);
            regroupTiles(slot);
          });
        }
        if (row.note) showNoteCard(row.note, row);
        showBadge(row);
        setInfo("本页内容由玩家协作维护 · 更新 " + (fmtTime(row.updated_at) || "—"));
        return row;
      });
  }

  // 「继续修改」：从「我的提交」带着 ?wiki_resume=<id> 回到本页时，
  // 自动把上次提交的内容重新载入编辑器，省得重敲一遍。
  // 只认属于当前登录账号、且页面匹配的那条提交（越权或错页一律忽略）。
  function maybeResume(client) {
    var m = /[?&]wiki_resume=(\d+)/.exec(location.search || "");
    if (!m) return Promise.resolve(false);
    var id = m[1];
    // 只摘掉 wiki_resume 这一个参数，其余查询参数原样保留（例如资源版本号 ?v=），
    // 否则刷新或转发时会把页面已有的参数一并弄丢。
    stripParam("wiki_resume");
    if (!state.session || !client.database) return Promise.resolve(false);
    return client.database
      .from("wiki_submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(
        function (res) {
          var sub = res && !res.error ? res.data : null;
          if (!sub || sub.page_key !== state.pageKey) return false;
          var regions = decodeRegions(sub.regions);
          openEditor({
            regions: regions,
            note: regions.length ? sub.note || "" : "",
            text: regions.length ? "" : sub.note || ""
          });
          return true;
        },
        function () {
          return false;
        }
      );
  }

  var authWatchBound = false;

  // 订阅云端登录态变化：会话异步恢复、令牌刷新、其它标签页登录或退出时都重绘界面。
  // 每次事件都重新向 SDK 取一次真实会话，不依赖事件参数结构。
  function watchAuth(client) {
    if (authWatchBound) return;
    if (!client || !client.auth || typeof client.auth.onAuthStateChange !== "function") return;
    authWatchBound = true;
    try {
      client.auth.onAuthStateChange(function () {
        window.WikiCloud.session().then(function (session) {
          state.session = session || null;
          if (!state.session) {
            state.isAdmin = false;
            renderBar();
            return;
          }
          renderBar();
          if (client.database) {
            client.database.rpc("wiki_i_am_admin").then(
              function (res) {
                state.isAdmin = !res.error && res.data === true;
                renderBar();
              },
              function () {}
            );
          }
        });
      });
    } catch (e) {}
  }

  function boot() {
    if (!window.WikiCloud) return;
    state.pageKey = currentPageKey();
    window.WIKI_COLLAB_PAGE_KEY = state.pageKey;

    window.WikiCloud.ready().then(function (client) {
      state.client = client;
      buildBar();
      if (!client) {
        renderBar();
        setInfo("云服务未加载，在线编辑暂不可用");
        return;
      }

      // 登录态变化时同步界面（含首次异步恢复会话、其它标签页登录/退出）
      watchAuth(client);

      // 修复记录：原实现在 .then(function (navigating) {...}) 里把 navigating 当参数，
      // 却在后续两个回调里继续引用它 —— 那是各自独立的作用域，读取未声明变量会抛
      // ReferenceError，整条链进入 .catch，renderBar() 之后再无第二次绘制，
      // 界面就永远停在初始的「未登录 / 无编辑本页」。
      // 现在改为：navigating 只作为上一个 .then 的返回值向后传递，不在回调间共享变量名。
      // 同时用 Promise.resolve() 起链、并在最外层兜一个 .catch，确保 renderBar 一定执行。
      Promise.resolve()
        .then(function () {
          return client.auth.handleWechatWebCallback();
        })
        .catch(function () {
          return null;
        })
        .then(function (res) {
          if (res && res.data) {
            try {
              history.replaceState(null, "", location.pathname);
            } catch (e) {}
            var back = null;
            try {
              back = sessionStorage.getItem(RETURN_KEY);
              sessionStorage.removeItem(RETURN_KEY);
            } catch (e) {}
            if (back && back !== location.href) {
              location.replace(back);
              return true;
            }
          }
          return false;
        })
        .then(function (navigating) {
          if (navigating) return null;
          return window.WikiCloud.session();
        })
        .then(function (session) {
          state.session = session || null;
          if (!state.session || !client.database) return null;
          return client.database.rpc("wiki_i_am_admin").then(
            function (res) {
              state.isAdmin = !res.error && res.data === true;
            },
            function () {
              state.isAdmin = false;
            }
          );
        })
        .then(function () {
          renderBar();
          return applyApproved(client);
        })
        .then(function () {
          return maybeResume(client);
        })
        .then(function () {
          return loadEntryOverrides(client);
        })
        .then(function () {
          maybeResumeEntry();
        })
        .then(function () {
          // 攻略大全（pages/guide-list.html）：静态攻略 + 投稿攻略合成一份清单。
          // 只有该页有容器，其余页面直接跳过。
          return loadGuides(client);
        })
        .then(function () {
          // 贡献者排行榜：只有 pages/contributors.html 有容器
          return loadContributors(client);
        });
    }).catch(function () {
      renderBar();
    });
  }

  /* ---------------- 图鉴条目：按条目纠错 ---------------- */
  //
  // 五个图鉴页的正文是各自的 JS 数据数组渲染出来的，而且筛选/搜索会整块重绘，
  // 所以在页面上直接改 DOM 没用 —— 下一次输入就没了。
  // 这里的做法是「改数据」：审核通过的字段值写回数据数组，再触发一次重绘；
  // 「玩家补充」不参与渲染，在重绘之后作为独立区块追加到对应卡片上。
  var COMPENDIUM_PAGES = {
    "pages/compendium/arts.html": {
      data: "SKILLS_GUIDE_DATA",
      list: "#skillCardList",
      card: ".skill-card",
      nameEl: ".skill-name",
      search: "#skillPageSearch",
      key: ["name"],
      fields: [
        { key: "roleTag", label: "分类标签" },
        { key: "attr", label: "属性", long: true },
        { key: "obtain", label: "获取", long: true }
      ]
    },
    "pages/compendium/characters.html": {
      data: "CHARACTER_COMPENDIUM",
      list: "#characterCardList",
      card: ".char-compendium-card",
      nameEl: ".char-card-name",
      search: "#characterFilter",
      key: ["id"],
      fields: [
        { key: "personalityName", label: "天赋名" },
        { key: "personalityDesc", label: "天赋描述", long: true },
        { key: "talentWiki", label: "天赋" },
        { key: "obtain", label: "入队方式", long: true }
      ],
      // 数据里还有一个 personality 合并字段，分项改完同步一次，避免两处对不上
      after: function (item) {
        item.personality =
          (item.personalityName || "") + (item.personalityDesc ? "：" + item.personalityDesc : "");
      }
    },
    "pages/compendium/internal.html": {
      data: "INTERNAL_COMPENDIUM",
      list: "#internalCardList",
      card: ".internal-neigong-card",
      nameEl: ".martial-name",
      search: "#internalFilter",
      key: ["id"],
      fields: [
        { key: "summary", label: "总述", long: true },
        { key: "specialNote", label: "特殊", long: true },
        { key: "itemDesp", label: "秘籍描述", long: true },
        { key: "obtain", label: "获取", long: true }
      ]
    },
    "pages/compendium/skills.html": {
      data: "MARTIAL_COMPENDIUM",
      list: "#martialCardList",
      card: ".martial-skill-card",
      nameEl: ".martial-name",
      search: "#martialFilter",
      key: ["id"],
      fields: [
        { key: "summary", label: "总述", long: true },
        { key: "itemDesp", label: "秘籍描述", long: true },
        { key: "obtain", label: "获取", long: true }
      ]
    },
    // 装备卡按「名称」分组、同名不同品质共用一张卡，改别的字段容易改错品质；
    // 只开「获取」这一项 —— 它本来就属于整件装备，玩家最想补的也是掉落与出处。
    "pages/compendium/equipment.html": {
      data: "EQUIPMENT_COMPENDIUM",
      list: "#equipmentCardList",
      card: ".equip-card",
      nameEl: ".martial-name",
      search: "#equipmentFilter",
      key: ["name"],
      fields: [{ key: "obtain", label: "获取", long: true }]
    }
  };

  var NOTE_FIELD = { key: "playerNote", label: "玩家补充", long: true };

  var entryState = {
    overrides: {},   // entry_key -> { fields: {...}, title }
    editor: null,
    current: null
  };

  function compendiumConfig() {
    return COMPENDIUM_PAGES[state.pageKey] || null;
  }

  function fieldList(cfg) {
    return (cfg.fields || []).concat([NOTE_FIELD]);
  }

  function isEntryField(cfg, key) {
    if (key === NOTE_FIELD.key) return true;
    return (cfg.fields || []).some(function (f) { return f.key === key; });
  }

  function entryArray(cfg) {
    var arr = window[cfg.data];
    return Array.isArray(arr) ? arr : [];
  }

  function entryKeyOf(cfg, item) {
    return cfg.key
      .map(function (k) { return String(item[k] == null ? "" : item[k]); })
      .join("|");
  }

  function entryByKey(cfg, key) {
    var arr = entryArray(cfg);
    for (var i = 0; i < arr.length; i++) {
      if (entryKeyOf(cfg, arr[i]) === key) return arr[i];
    }
    return null;
  }

  // 卡片上只有名字，靠名字反查数据条目（同一页内名字重复的极少，取第一条）
  function entryByName(cfg, name) {
    var arr = entryArray(cfg);
    for (var i = 0; i < arr.length; i++) {
      if (String(arr[i].name) === name) return arr[i];
    }
    return null;
  }

  // 当前生效值 = 数据原值，或已被审核通过的覆盖值
  function effectiveValue(cfg, item, fieldKey) {
    var ov = entryState.overrides[entryKeyOf(cfg, item)];
    if (ov && ov.fields && Object.prototype.hasOwnProperty.call(ov.fields, fieldKey)) {
      return String(ov.fields[fieldKey] == null ? "" : ov.fields[fieldKey]);
    }
    return String(item[fieldKey] == null ? "" : item[fieldKey]);
  }

  function stripParam(name) {
    try {
      var kept = (location.search || "").replace(/^\?/, "").split("&").filter(function (kv) {
        return kv && kv.indexOf(name + "=") !== 0;
      });
      history.replaceState(null, "", location.pathname + (kept.length ? "?" + kept.join("&") : "") + location.hash);
    } catch (e) {}
  }

  function applyEntryOverrides() {
    var cfg = compendiumConfig();
    if (!cfg) return 0;
    var n = 0;
    Object.keys(entryState.overrides).forEach(function (k) {
      var item = entryByKey(cfg, k);
      if (!item) return;
      var fields = entryState.overrides[k].fields || {};
      Object.keys(fields).forEach(function (f) {
        // 玩家补充不写进数据（渲染脚本不认识它），重绘后单独挂；
        // 其余字段走白名单，避免把任意属性写进数据对象。
        if (f === NOTE_FIELD.key || !isEntryField(cfg, f)) return;
        item[f] = fields[f];
        n += 1;
      });
      if (typeof cfg.after === "function") {
        try { cfg.after(item); } catch (e) {}
      }
    });
    return n;
  }

  // 借页面自己的筛选框触发一次重绘：渲染脚本把 render 挂在它的 input 事件上
  function rerenderCompendium(cfg) {
    var box = document.querySelector(cfg.search);
    if (!box) return;
    try {
      box.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (e) {}
  }

  function decorateEntryCards() {
    var cfg = compendiumConfig();
    if (!cfg) return;
    var list = document.querySelector(cfg.list);
    if (!list) return;

    Array.prototype.forEach.call(list.querySelectorAll(cfg.card), function (card) {
      var nameEl = card.querySelector(cfg.nameEl);
      var name = nameEl ? nameEl.textContent.trim() : "";
      var item = name ? entryByName(cfg, name) : null;
      if (!item) return;

      var key = entryKeyOf(cfg, item);
      card.setAttribute("data-wiki-entry", key);
      card.classList.add("wiki-entry-host");

      var ov = entryState.overrides[key];
      var note = ov && ov.fields ? ov.fields[NOTE_FIELD.key] : "";
      if (note && !card.querySelector(".wiki-entry-note")) {
        var block = el("div", "wiki-entry-note");
        block.appendChild(el("strong", null, "玩家补充"));
        block.appendChild(el("p", null, note));
        card.appendChild(block);
      }

      // 按钮挂在名字后面（标题行），每次判定「按钮还在不在」而不是「卡片处理过没有」：
      // 装备卡切品质时只替换卡片内部的 body，卡片元素本身不会重建。
      var anchor = nameEl && nameEl.parentElement ? nameEl.parentElement : card;
      if (anchor.querySelector(".wiki-entry-btn")) return;

      var btn = el("button", "wiki-entry-btn", "纠错");
      btn.type = "button";
      btn.title = "修正「" + name + "」这条的内容";
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        openEntryEditor(cfg, item);
      });
      anchor.appendChild(btn);

      // 页面上留白的字段（如「获取」）：卡片先空着，这里补一个直达入口，
      // 玩家点一下就能填 —— 不用先点「纠错」再在对话框里找那一栏。
      Array.prototype.forEach.call(card.querySelectorAll("[data-wiki-slot]"), function (slot) {
        if (!slot.classList.contains("is-empty")) return;
        if (slot.querySelector(".wiki-entry-slot-btn")) return;
        var fieldKey = slot.getAttribute("data-wiki-slot");
        var slotLabel = slot.getAttribute("data-wiki-slot-label") || "这一项";
        var slotBtn = el("button", "wiki-entry-btn wiki-entry-slot-btn", "补充");
        slotBtn.type = "button";
        slotBtn.title = "补充「" + name + "」的" + slotLabel;
        slotBtn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          openEntryEditor(cfg, item, fieldKey);
        });
        slot.appendChild(slotBtn);
      });
    });
  }

  var entryObserver = null;

  function watchCompendium() {
    var cfg = compendiumConfig();
    if (!cfg || entryObserver) return;
    var list = document.querySelector(cfg.list);
    if (!list || typeof MutationObserver !== "function") return;
    // 列表整体重绘（筛选/搜索）和卡片内部局部替换都要重新挂一次入口，
    // 所以观察子树；装饰函数自带「已挂过就跳过」的判断，不会循环触发。
    entryObserver = new MutationObserver(function () {
      decorateEntryCards();
    });
    entryObserver.observe(list, { childList: true, subtree: true });
    decorateEntryCards();
  }

  function loadEntryOverrides(client) {
    var cfg = compendiumConfig();
    if (!cfg || !client || !client.database) return Promise.resolve(false);
    return client.database
      .from("wiki_entries")
      .select("*")
      .eq("page_key", state.pageKey)
      .then(
        function (res) {
          var rows = res && !res.error && Array.isArray(res.data) ? res.data : [];
          rows.forEach(function (row) {
            entryState.overrides[String(row.entry_key)] = {
              fields: row.fields && typeof row.fields === "object" ? row.fields : {},
              title: row.entry_title || ""
            };
          });
          applyEntryOverrides();
          rerenderCompendium(cfg);
          decorateEntryCards();
          watchCompendium();
          return true;
        },
        function () {
          watchCompendium();
          return false;
        }
      );
  }

  function buildEntryEditor() {
    if (entryState.editor) return entryState.editor;
    var box = el("div", "wiki-collab-overlay");
    box.id = "wikiEntryOverlay";
    box.hidden = true;

    var dialog = el("div", "wiki-collab-dialog");
    var head = el("div", "wiki-collab-dialog-head");
    var title = el("h2", null, "纠错");
    var close = el("button", "wiki-collab-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "关闭");
    // 条目也有修订历史：改错了同样要能还原。
    // 入口放在标题行右侧，因为它属于「这一条」，而不是整页。
    var headActions = el("div", "wiki-collab-head-actions");
    var histBtn = el("button", "wiki-collab-btn wiki-collab-btn--ghost", "历史");
    histBtn.type = "button";
    histBtn.id = "wikiEntryHistoryBtn";
    histBtn.title = "查看这一条的修订历史，可对比任意版本或还原";
    headActions.appendChild(histBtn);
    headActions.appendChild(close);
    head.appendChild(title);
    head.appendChild(headActions);

    var hint = el(
      "p",
      "wiki-collab-hint",
      "只改需要更正的地方，其余保持原样。提交后需审核通过才会显示在网站上。"
    );

    var fields = el("div", "wiki-entry-fields");

    var noteWrap = el("label", "wiki-collab-labelled");
    noteWrap.appendChild(el("span", null, "修改说明（选填）"));
    var noteInput = document.createElement("textarea");
    noteInput.id = "wikiEntryNote";
    noteInput.rows = 2;
    noteInput.placeholder = "例如：实测 5 级免伤是 12%，不是 14%";
    noteWrap.appendChild(noteInput);

    var nickWrap = el("label", "wiki-collab-labelled");
    nickWrap.appendChild(el("span", null, "你的昵称"));
    var nickInput = document.createElement("input");
    nickInput.id = "wikiEntryNick";
    nickInput.type = "text";
    nickInput.maxLength = 24;
    nickInput.placeholder = "群昵称或游戏 ID";
    nickWrap.appendChild(nickInput);

    var msg = el("p", "wiki-collab-msg");
    msg.id = "wikiEntryMsg";

    var foot = el("div", "wiki-collab-dialog-foot");
    var cancel = el("button", "wiki-collab-btn wiki-collab-btn--ghost", "取消");
    cancel.type = "button";
    var submit = el("button", "wiki-collab-btn wiki-collab-btn--primary", "提交审核");
    submit.type = "button";
    foot.appendChild(cancel);
    foot.appendChild(submit);

    dialog.appendChild(head);
    dialog.appendChild(hint);
    dialog.appendChild(fields);
    dialog.appendChild(noteWrap);
    dialog.appendChild(nickWrap);
    dialog.appendChild(msg);
    dialog.appendChild(foot);
    box.appendChild(dialog);
    document.body.appendChild(box);

    close.addEventListener("click", closeEntryEditor);
    cancel.addEventListener("click", closeEntryEditor);
    box.addEventListener("click", function (e) {
      if (e.target === box) closeEntryEditor();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !box.hidden) closeEntryEditor();
    });
    submit.addEventListener("click", submitEntryEdit);

    entryState.editor = {
      box: box,
      title: title,
      hist: histBtn,
      fields: fields,
      note: noteInput,
      nick: nickInput,
      msg: msg,
      submit: submit
    };
    return entryState.editor;
  }

  function setEntryMsg(text, kind) {
    var o = entryState.editor;
    if (!o) return;
    o.msg.textContent = text || "";
    o.msg.className = "wiki-collab-msg" + (kind ? " is-" + kind : "");
  }

  function closeEntryEditor() {
    var o = entryState.editor;
    if (!o) return;
    o.box.hidden = true;
    o.fields.textContent = "";
  }

  function openEntryEditor(cfg, item, focusField) {
    if (!state.session) {
      try {
        sessionStorage.setItem(RETURN_KEY, location.href);
      } catch (e) {}
      location.href = url("pages/login.html");
      return;
    }
    var o = buildEntryEditor();
    var key = entryKeyOf(cfg, item);
    entryState.current = { cfg: cfg, key: key, title: String(item.name || "") };

    o.title.textContent = "纠错 · " + (item.name || "");
    o.fields.textContent = "";
    o.note.value = "";
    o.nick.value = nick();
    setEntryMsg("");
    // 每次打开都重新绑定：历史目标跟着当前条目走
    o.hist.onclick = function () {
      openHistoryFor("entry", key, (item.name || "这一条") + " · 图鉴条目");
    };

    fieldList(cfg).forEach(function (f) {
      var before = effectiveValue(cfg, item, f.key);
      var wrap = el("div", "wiki-collab-field");
      wrap.dataset.field = f.key;
      wrap.appendChild(el("span", "wiki-collab-field-label", f.label));

      var input = f.long ? document.createElement("textarea") : document.createElement("input");
      if (f.long) input.rows = 3;
      else input.type = "text";
      input.className = "wiki-entry-input";
      input.value = before;
      wrap.appendChild(input);

      var dwrap = document.createElement("details");
      dwrap.className = "wiki-collab-diffwrap";
      dwrap.hidden = true;
      var sum = document.createElement("summary");
      var dbody = el("div", "wiki-collab-diff");
      dwrap.appendChild(sum);
      dwrap.appendChild(dbody);
      wrap.appendChild(dwrap);

      var refresh = debounce(function () {
        // 字段是纯文本，先转义再比对：diff 内部按 HTML 解析，不转义会被当成标签吞掉
        var res = window.WikiCollab.diff(escHtml(before), escHtml(input.value));
        if (!res.changed) {
          dwrap.hidden = true;
          dwrap.open = false;
          dbody.textContent = "";
          return;
        }
        dwrap.hidden = false;
        dwrap.open = true;
        sum.textContent = "改动预览 · " + res.label;
        dbody.innerHTML = res.html;
      }, 220);

      input.addEventListener("input", refresh);
      o.fields.appendChild(wrap);
    });

    o.box.hidden = false;
    // 从「补充」入口进来的，光标直接落在那一栏上
    var target = focusField
      ? o.fields.querySelector('.wiki-collab-field[data-field="' + focusField + '"] .wiki-entry-input')
      : null;
    if (target) {
      if (target.scrollIntoView) {
        try { target.scrollIntoView({ block: "nearest" }); } catch (e) {}
      }
      target.focus();
      return;
    }
    var first = o.fields.querySelector(".wiki-entry-input");
    if (first) first.focus();
  }

  function submitEntryEdit() {
    var o = entryState.editor;
    var cur = entryState.current;
    if (!o || !cur) return;
    if (!state.client || !state.session) {
      setEntryMsg("登录状态已失效，请重新登录后再提交。", "error");
      return;
    }
    var cfg = cur.cfg;
    var item = entryByKey(cfg, cur.key);
    if (!item) {
      setEntryMsg("这条内容已经不在页面上了，请刷新后重试。", "error");
      return;
    }

    var fields = {};
    var base = {};
    var added = 0;
    var removed = 0;
    var changed = 0;

    Array.prototype.forEach.call(o.fields.querySelectorAll(".wiki-collab-field"), function (wrap) {
      var key = wrap.dataset.field;
      if (!key || !isEntryField(cfg, key)) return;
      var input = wrap.querySelector(".wiki-entry-input");
      if (!input) return;
      var before = effectiveValue(cfg, item, key);
      var after = String(input.value == null ? "" : input.value).trim();
      if (after === before) return;
      fields[key] = after;
      base[key] = before;
      var res = window.WikiCollab.diff(escHtml(before), escHtml(after));
      added += res.added;
      removed += res.removed;
      changed += 1;
    });

    if (!changed) {
      setEntryMsg("内容没有变化，无需提交。", "error");
      return;
    }

    var name = (o.nick.value || "").trim() || "热心玩家";
    setNick(name);
    o.submit.disabled = true;
    setEntryMsg("正在提交…");

    state.client.database
      .from("wiki_submissions")
      .insert({
        kind: "entry",
        page_key: state.pageKey,
        page_title: document.title,
        entry_key: cur.key,
        entry_title: cur.title,
        fields: fields,
        base_fields: base,
        regions: [],
        baseline: [],
        note: (o.note.value || "").trim() || null,
        owner_name: name
      })
      .select()
      .then(function (res) {
        o.submit.disabled = false;
        if (res && res.error) {
          setEntryMsg("提交失败：" + (res.error.message || "请稍后重试"), "error");
          return;
        }
        setEntryMsg(
          "已提交 " + changed + " 处改动（新增 " + added + " 字、删除 " + removed + " 字），等待审核。",
          "ok"
        );
        setInfo("本页有待审的条目纠错，等待审核");
        window.setTimeout(closeEntryEditor, 1600);
      });
  }

  // 「我的提交」里点「继续修改」回到本页时，直接把这条的编辑器打开
  function maybeResumeEntry() {
    var m = /[?&]wiki_entry=([^&#]+)/.exec(location.search || "");
    if (!m) return false;
    stripParam("wiki_entry");
    var cfg = compendiumConfig();
    if (!cfg || !state.session) return false;
    var key;
    try {
      key = decodeURIComponent(m[1]);
    } catch (e) {
      key = m[1];
    }
    var item = entryByKey(cfg, key);
    if (!item) return false;
    openEntryEditor(cfg, item);
    return true;
  }

  function compendiumFields(pageKey) {
    var cfg = COMPENDIUM_PAGES[pageKey];
    if (!cfg) return [];
    return fieldList(cfg).map(function (f) {
      return { key: f.key, label: f.label };
    });
  }



  /* ---------------- 玩家攻略投稿 ---------------- */
  //
  // 投稿的攻略不可能写进静态 HTML（静态站没法「新增一篇文章」），
  // 所以走数据库：审核通过后存进 wiki_articles，
  // 「攻略大全」的清单、站内搜索、pages/player-article.html 都从库里读。
  // 写作入口是独立页面 pages/submit-guide.html（整页表单，适合长文）。

  // 投稿表单的分类，同时也是「攻略大全」筛选条的顺序。
  // 静态攻略要占住「综合总览」（全攻略、攻略整合）和「内功心法」（前期内功推荐），
  // 所以这两类必须在这里，否则一按分类收窄，站点自带的攻略就全被藏起来了。
  var GUIDE_CATEGORIES = [
    "开局入门", "综合总览", "门派武学", "内功心法", "任务支线", "资源获取", "副本挑战", "装备打造", "其他"
  ];

  // 投稿字段与审核台 / 我的提交展示用的中文名，顺序即展示顺序
  var GUIDE_FIELDS = [
    { key: "title", label: "标题" },
    { key: "category", label: "分类" },
    { key: "summary", label: "一句话简介" },
    { key: "tags", label: "标签" },
    { key: "body", label: "正文", long: true }
  ];

  // 写作模板：给玩家一个「照着填」的骨架，比空白页好上手，
  // 也能把「适用版本 / 前置条件 / 实测数据」这些关键信息固定下来。
  var GUIDE_TEMPLATE = [
    "<h2>适用版本</h2>",
    "<p>例如：玄武版 2.06，2026 年 10 月更新后实测仍然有效。如果不是最新版，注明你在哪个版本测试的。</p>",
    "<h2>前置条件</h2>",
    "<p>需要的基础等级、门派、已完成的支线、必备道具等。</p>",
    "<h2>具体做法</h2>",
    "<ol>",
    "<li>第一步：从哪里出发、找谁、做什么。</li>",
    "<li>第二步：关键操作，写明选项或坐标。</li>",
    "<li>第三步：收尾与存档提醒。</li>",
    "</ol>",
    "<h2>注意事项</h2>",
    "<p>容易踩的坑、常见的失败原因。</p>",
    "<h2>实测数据</h2>",
    "<p>收益、掉率、耗时等。注明测试次数和条件，数据才可信。</p>"
  ].join("");

  function guideFields() {
    return GUIDE_FIELDS.map(function (f) {
      return { key: f.key, label: f.label };
    });
  }

  function articleUrl(key) {
    return url("pages/player-article.html") + "?slug=" + encodeURIComponent(String(key == null ? "" : key));
  }

  function guideListUrl() {
    return url("pages/guide-list.html");
  }

  /* 攻略大全（pages/guide-list.html）—— 全站唯一的攻略入口
   *
   * 清单由两部分合成：
   *   ① 站点创始就有的静态攻略：正文写死在 articles/*.html 里，这里只登记元数据
   *   ② 玩家投稿、审核通过后存进 wiki_articles 的攻略
   * 二者都是玩家写的攻略，所以列在同一份清单里、共用一套分类 / 标签 / 搜索 / 排序，
   * 不区分「官方 vs 玩家投稿」，也不再单独开区块贴标签。
   * 目录是自动索引：新增攻略走「投稿」，修正单篇走文章末尾的「改进本篇」，
   * 因此这一页不标记 data-wiki-edit（索引不该靠手改 HTML 维护）。
   *
   * 静态攻略的分类取自 GUIDE_CATEGORIES（与投稿表单同一套），否则筛选条一收窄，
   * 站点自带的攻略就全被藏起来；摘要与首页方块上的说明保持一致，两边不打架。
   */

  var STATIC_GUIDES = [
    {
      key: "static:full-guide",
      title: "玄武版全攻略（截止 10.30）",
      summary: "门派、副本与整体路线的总览，新人建议先读这一篇。",
      category: "综合总览",
      tags: ["总览", "门派", "副本"],
      author: "真纯",
      updatedAt: "2026-06-13",
      url: "../articles/full-guide-xuanwu.html"
    },
    {
      key: "static:integrated-guide",
      title: "玄武攻略整合",
      summary: "角色成长、技艺、令牌与四条结局线，一篇读到底。",
      category: "综合总览",
      tags: ["角色", "技艺", "令牌", "结局线"],
      author: "龙神之庭--魂之挽歌",
      updatedAt: "2026-10-01",
      url: "../articles/xuanwu-integrated-guide.html"
    },
    {
      key: "static:beginner",
      title: "开局从入门到精通",
      summary: "前期资源与路线的精简版，开局少走弯路。",
      category: "开局入门",
      tags: ["开局", "资源", "路线"],
      author: "祈多你欠我的拿什么还 等群友",
      updatedAt: "2026-10-01",
      url: "../articles/beginner-master.html"
    },
    {
      key: "static:early-internal",
      title: "玄武版前期内功推荐（2.06）",
      summary: "2.06 内功取舍：cbas 与任督二脉怎么选。",
      category: "内功心法",
      tags: ["内功", "任督", "2.06"],
      author: "ETERNAL",
      updatedAt: "2026-10-03",
      url: "../articles/early-internal-guide-206.html"
    },
    {
      key: "static:weapons",
      title: "玄武版武器获取（2.06）",
      summary: "刀、剑、拳三类武器的铸造与掉落来源。",
      category: "装备打造",
      tags: ["武器", "铸造", "2.06"],
      author: "ETERNAL",
      updatedAt: "2026-10-01",
      url: "../articles/weapons-xuanwu-206.html"
    }
  ];

  // 静态攻略登记成与投稿完全相同的结构，才能一起筛选 / 排序 / 搜索
  function staticGuideItem(g) {
    var ms = g.updatedAt ? new Date(g.updatedAt).getTime() : 0;
    return {
      key: g.key,
      title: g.title,
      summary: g.summary || "",
      category: g.category || "",
      tags: (g.tags || []).slice(),
      author: g.author || "匿名玩家",
      updatedAt: g.updatedAt || "",
      updatedMs: isNaN(ms) ? 0 : ms,
      version: 1,
      views: 0,
      url: g.url,
      seeded: true // 站点自带：没有版本号与浏览数，卡片上也就不显示这两项
    };
  }

  function staticGuideItems() {
    return STATIC_GUIDES.map(staticGuideItem);
  }

  // 清单 = 静态攻略（随页面一起到，立刻可见）+ 投稿攻略（等一次网络往返）
  function allGuides(rows) {
    return staticGuideItems().concat(normalizeGuides(rows));
  }

  // 站内搜索索引是静态生成的，玩家攻略只能运行时补进去。
  // 注意：js/wiki.js 的 collectHits 改成每次读 window.WIKI_SEARCH_INDEX，
  // 否则它在加载时就把索引拷进闭包了，这里推的条目搜不到。
  function indexPlayerGuides(rows) {
    var index = window.WIKI_SEARCH_INDEX;
    if (!Array.isArray(index)) return;
    var seen = Object.create(null);
    index.forEach(function (entry) {
      seen[String(entry.url || "")] = 1;
    });
    rows.forEach(function (row) {
      var u = "pages/player-article.html?slug=" + encodeURIComponent(row.article_key);
      if (seen[u]) return;
      seen[u] = 1;
      index.push({
        title: row.title || row.article_key,
        url: u,
        keys: [row.category, row.tags, row.author_name].filter(Boolean).join(" ")
      });
    });
  }

  function loadGuides(client) {
    var view = mountGuideLibrary();
    if (!view) return Promise.resolve([]); // 不在攻略大全页
    if (!client || !client.database) {
      // 没有数据库也要把站点自带的攻略留在页面上，别让清单整个空掉
      view.setError();
      return Promise.resolve([]);
    }
    return Promise.resolve()
      .then(function () {
        return client.database
          .from("wiki_articles")
          .select("article_key,title,summary,category,tags,author_name,version,created_at,updated_at,view_count")
          .order("updated_at", { ascending: false })
          .limit(500);
      })
      .then(function (res) {
        // 查询出错（表不存在、无权限、网络失败）与「一篇投稿都没有」是两回事：
        // 取不到投稿时只标记这一点，站点自带的攻略继续留在页面上。
        if (!res || res.error || !Array.isArray(res.data)) {
          view.setError();
          return [];
        }
        view.setData(res.data);
        // 全站搜索也吃这批数据，否则投稿攻略只能在本页里搜到
        indexPlayerGuides(res.data);
        return res.data;
      })
      .catch(function () {
        view.setError();
        return [];
      });
  }

  /* -------------- 攻略清单的筛选 / 排序 / 渲染（pages/guide-list.html） -------------- */
  //
  // 清单就是「攻略大全」本身：静态攻略和投稿攻略一起铺开，
  // 按分类 / 标签 / 关键词收窄，按时间或热度排序。
  // 数据量不大（最多几百篇），全部拉回浏览器内存里过滤，省掉服务端分页和搜索接口；
  // 静态页只留容器，渲染与交互全部由本层接管。

  var GUIDE_SORTS = [
    { key: "new", label: "最新更新" },
    { key: "hot", label: "最多人看" },
    { key: "title", label: "标题排序" }
  ];

  // 标签是玩家随手写的，分隔符五花八门（空格、逗号、顿号、斜杠），统一拆开
  function guideTags(row) {
    return String((row && row.tags) == null ? "" : row.tags)
      .split(/[\s,，、;；/|]+/)
      .map(function (t) {
        return t.trim();
      })
      .filter(Boolean);
  }

  function normalizeGuide(row) {
    if (!row || !row.article_key) return null;
    var when = row.updated_at || row.created_at || "";
    var ms = when ? new Date(when).getTime() : 0;
    return {
      key: String(row.article_key),
      title: row.title || row.article_key,
      summary: row.summary || "",
      category: row.category || "",
      tags: guideTags(row),
      author: row.author_name || "匿名玩家",
      updatedAt: when,
      updatedMs: isNaN(ms) ? 0 : ms,
      version: Number(row.version) > 0 ? Number(row.version) : 1,
      views: Number(row.view_count) > 0 ? Number(row.view_count) : 0,
      url: articleUrl(row.article_key)
    };
  }

  function normalizeGuides(rows) {
    return (rows || [])
      .map(normalizeGuide)
      .filter(Boolean);
  }

  // 纯过滤 + 排序：不碰 DOM，方便单独测试。
  // q 同时命中标题、简介、分类、作者、标签，玩家只需记得大概叫什么就能搜到。
  function filterGuides(items, opt) {
    opt = opt || {};
    var q = String(opt.q || "").trim().toLowerCase();
    var category = opt.category || "";
    var tag = opt.tag || "";
    var sort = opt.sort || "new";

    var out = (items || []).filter(function (it) {
      if (category && it.category !== category) return false;
      if (tag && it.tags.indexOf(tag) === -1) return false;
      if (!q) return true;
      var hay = [it.title, it.summary, it.category, it.author, it.tags.join(" ")]
        .join(" ")
        .toLowerCase();
      return hay.indexOf(q) !== -1;
    });

    out.sort(function (a, b) {
      if (sort === "hot") {
        // 并列时不再用 key 兜底排序：Array#sort 是稳定排序，
        // 保持原顺序才能让静态攻略维持站点的推荐次序。
        return b.views - a.views || b.updatedMs - a.updatedMs;
      }
      if (sort === "title") {
        return a.title.localeCompare(b.title, "zh-Hans-CN");
      }
      return b.updatedMs - a.updatedMs;
    });
    return out;
  }

  // 筛选条上的计数：哪一类各有多少篇、哪些标签被用得最多
  function guideFacets(items) {
    var list = items || [];
    var catOrder = [];
    var catCount = Object.create(null);
    var tagCount = Object.create(null);

    list.forEach(function (it) {
      if (it.category) {
        if (catCount[it.category] == null) {
          catCount[it.category] = 0;
          catOrder.push(it.category);
        }
        catCount[it.category]++;
      }
      it.tags.forEach(function (t) {
        tagCount[t] = (tagCount[t] || 0) + 1;
      });
    });

    // 分类按投稿表单里的固定顺序排，没在清单里的排到最后（老数据可能用了别的分类名）
    catOrder.sort(function (a, b) {
      var ia = GUIDE_CATEGORIES.indexOf(a);
      var ib = GUIDE_CATEGORIES.indexOf(b);
      if (ia === -1) ia = 999;
      if (ib === -1) ib = 999;
      return ia - ib || a.localeCompare(b, "zh-Hans-CN");
    });

    var tags = Object.keys(tagCount).sort(function (a, b) {
      return tagCount[b] - tagCount[a] || a.localeCompare(b, "zh-Hans-CN");
    });

    return { categories: catOrder, catCount: catCount, tags: tags, tagCount: tagCount };
  }

  // 筛选条件写回地址栏（replaceState，不堆历史记录），
  // 这样「按标签筛出来的这一页」可以直接复制给别人。
  function readLibraryQuery() {
    var s = location.search || "";
    function get(name) {
      var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(s);
      if (!m) return "";
      try {
        return decodeURIComponent(m[1].replace(/\+/g, " "));
      } catch (e) {
        return m[1];
      }
    }
    var sort = get("sort");
    if (sort !== "hot" && sort !== "title") sort = "new";
    return { q: get("q"), category: get("cat"), tag: get("tag"), sort: sort };
  }

  function mountGuideLibrary() {
    var host = document.getElementById("guideLibList");
    if (!host) return null; // 不在攻略大全页

    var cond = readLibraryQuery();
    // 站点自带的攻略立即上屏，不等网络 —— 这一页任何时候都该有东西可读
    var all = staticGuideItems();
    var loading = true;
    var failed = false;

    var searchEl = document.getElementById("guideLibSearch");
    var sortEl = document.getElementById("guideLibSort");
    var catsEl = document.getElementById("guideLibCats");
    var tagsEl = document.getElementById("guideLibTags");
    var emptyEl = document.getElementById("guideLibEmpty");
    var emptyTitle = document.getElementById("guideLibEmptyTitle");
    var emptyHint = document.getElementById("guideLibEmptyHint");
    var resetBtn = document.getElementById("guideLibReset");
    var emptyPost = document.getElementById("guideLibEmptyPost");
    var retryBtn = document.getElementById("guideLibRetry");
    var countEl = document.getElementById("guideLibCount");

    if (sortEl) {
      sortEl.textContent = "";
      GUIDE_SORTS.forEach(function (s) {
        var o = el("option", null, s.label);
        o.value = s.key;
        sortEl.appendChild(o);
      });
      sortEl.value = cond.sort;
    }
    if (searchEl) searchEl.value = cond.q || "";

    function syncUrl() {
      var parts = [];
      if (cond.q) parts.push("q=" + encodeURIComponent(cond.q));
      if (cond.category) parts.push("cat=" + encodeURIComponent(cond.category));
      if (cond.tag) parts.push("tag=" + encodeURIComponent(cond.tag));
      if (cond.sort && cond.sort !== "new") parts.push("sort=" + encodeURIComponent(cond.sort));
      try {
        history.replaceState(null, "", location.pathname + (parts.length ? "?" + parts.join("&") : ""));
      } catch (e) {}
    }

    function chip(label, active, onClick) {
      var b = el("button", "wiki-lib-chip" + (active ? " is-active" : ""), label);
      b.type = "button";
      b.addEventListener("click", onClick);
      return b;
    }

    function renderFacets(facets) {
      if (catsEl) {
        catsEl.textContent = "";
        catsEl.appendChild(
          chip("全部 " + all.length, !cond.category && !cond.tag, function () {
            cond.category = "";
            cond.tag = "";
            update();
          })
        );
        facets.categories.forEach(function (c) {
          catsEl.appendChild(
            chip(c + " " + facets.catCount[c], cond.category === c, function () {
              cond.category = cond.category === c ? "" : c;
              update();
            })
          );
        });
      }
      if (tagsEl) {
        var hot = facets.tags.slice(0, 12);
        // 选中的标签若不在热门里（静态攻略的标签、冷门标签），也补一个进去：
        // 否则筛选确实生效了，条上却看不到自己在筛什么，也点不掉。
        if (cond.tag && hot.indexOf(cond.tag) === -1) hot = [cond.tag].concat(hot);
        tagsEl.textContent = "";
        tagsEl.hidden = !hot.length;
        hot.forEach(function (t) {
          tagsEl.appendChild(
            chip("#" + t + " " + facets.tagCount[t], cond.tag === t, function () {
              cond.tag = cond.tag === t ? "" : t;
              update();
            })
          );
        });
      }
    }

    // 这里不再有骨架屏：静态攻略随页面一起到，先渲染出来，投稿到达后整块替换。
    // 骨架屏留给正文页（pages/player-article.html），那种「什么都没有」的空白才需要它。

    // 空状态分三种：投稿取不到（重试）、清单一篇都没有（引导投稿）、筛选没命中（引导改条件）。
    // 混用同一句文案会让玩家以为是搜索坏了，或者以为站点是空的。
    function renderEmpty(list) {
      if (!emptyEl) return;
      var emptyLib = !failed && all.length === 0;
      var noMatch = !failed && all.length > 0 && list.length === 0;
      emptyEl.hidden = !(failed || emptyLib || noMatch);
      if (emptyTitle) {
        emptyTitle.textContent = failed
          ? "玩家投稿没能载入。"
          : emptyLib
          ? "这里还没有攻略。"
          : "没有匹配的攻略。";
      }
      if (emptyHint) {
        emptyHint.textContent = failed
          ? "上面列的是站点自带的攻略；玩家投稿这次没取到，重试一下通常就好。"
          : emptyLib
          ? "投稿通过审核后就会出现在这里 —— 有实测数据或独家打法都可以写。"
          : "换个关键词试试，或者把筛选条件清空。";
      }
      if (resetBtn) resetBtn.hidden = failed || emptyLib;
      if (emptyPost) emptyPost.hidden = failed || !emptyLib;
      if (retryBtn) retryBtn.hidden = !failed;
    }

    function renderCards(list) {
      host.textContent = "";
      renderEmpty(list);

      if (countEl) {
        countEl.textContent = loading
          ? "正在载入投稿…"
          : failed
          ? "共 " + all.length + " 篇 · 投稿未载入"
          : list.length === all.length
          ? "共 " + all.length + " 篇"
          : "匹配 " + list.length + " / " + all.length + " 篇";
      }

      list.forEach(function (it) {
        var card = el("article", "wiki-lib-card");

        var head = el("div", "wiki-lib-card-head");
        var title = el("a", "wiki-lib-card-title", it.title);
        title.href = it.url;
        head.appendChild(title);
        if (it.category) head.appendChild(el("span", "wiki-lib-cat", it.category));
        card.appendChild(head);

        if (it.summary) card.appendChild(el("p", "wiki-lib-summary", it.summary));

        if (it.tags.length) {
          var row = el("p", "wiki-lib-tags");
          it.tags.forEach(function (t) {
            var c = el("button", "wiki-lib-tag", t);
            c.type = "button";
            c.addEventListener("click", function () {
              cond.tag = cond.tag === t ? "" : t;
              update();
            });
            row.appendChild(c);
          });
          card.appendChild(row);
        }

        var bits = ["作者 " + it.author];
        // 静态攻略只登记到日期，也没有版本号与浏览数，别硬编一个出来
        var when = it.seeded ? String(it.updatedAt || "").slice(0, 10) : fmtTime(it.updatedAt);
        if (when) bits.push("更新 " + when);
        if (!it.seeded) {
          if (it.version > 1) bits.push("第 " + it.version + " 版");
          bits.push(it.views > 0 ? it.views + " 次浏览" : "暂无浏览");
        }
        card.appendChild(el("p", "wiki-lib-meta", bits.join(" · ")));

        host.appendChild(card);
      });
    }

    function update() {
      var list = filterGuides(all, cond);
      if (!failed) renderFacets(guideFacets(all));
      renderCards(list);
      if (!failed) syncUrl();
    }

    if (searchEl) {
      searchEl.addEventListener(
        "input",
        debounce(function () {
          cond.q = searchEl.value.trim();
          update();
        }, 160)
      );
    }
    if (sortEl) {
      sortEl.addEventListener("change", function () {
        cond.sort = sortEl.value;
        update();
      });
    }

    var resetEl = document.getElementById("guideLibReset");
    if (resetEl) {
      resetEl.addEventListener("click", function () {
        cond.q = "";
        cond.category = "";
        cond.tag = "";
        cond.sort = "new";
        if (searchEl) searchEl.value = "";
        if (sortEl) sortEl.value = "new";
        update();
      });
    }

    // 失败时给一条出路：这里不做局部重拉（要重新走一遍 boot 链），
    // 直接刷新页面最简单，也不会留下半截状态。
    if (retryBtn) {
      retryBtn.addEventListener("click", function () {
        location.reload();
      });
    }

    update();

    return {
      setData: function (rows) {
        all = allGuides(rows);
        failed = false;
        loading = false;
        update();
      },
      setError: function () {
        // 投稿取不到时保留站点自带的攻略，只把「投稿未载入」标出来
        all = staticGuideItems();
        failed = true;
        loading = false;
        update();
      },
      data: function () {
        return all;
      }
    };
  }

  /* ---------------- 贡献者排行榜（pages/contributors.html） ---------------- */
  //
  // 「像真 wiki 一样人人共建」的前提是让贡献被看见。但榜单得记在**内容的作者**头上，
  // 而不是**按按钮的人**头上：数据库触发器留在 wiki_revisions.author_name 里的，是最后
  // 动手的人——批准投稿的管理员替他按了保存，于是玩家的心血全被算到了管理员名下。
  // 所以这里重新归属一次：
  //   · 攻略 → 归署名作者（wiki_articles.author_name）
  //   · 改动 → 优先归该页面/该条目的投稿人（已通过的投稿，来自公开视图 wiki_contrib_public）；
  //            找不到投稿记录的（管理员直接改的页面）才回落成修订流水里那个动手的人
  //   · 文章首版＝这篇攻略的发布本身，已经计入「攻略」，不再重复算一次改动
  //   · 同一目标、同一内容（content_hash 相同）的反复保存只算一次
  // 读的全是公开表/视图，聚合放在前端，不新增表、不动权限。

  function contributorName(name) {
    var s = String(name == null ? "" : name).trim();
    return s || "匿名玩家";
  }

  // 投稿与修订共用同一套归属键：页面按 page_key，条目再带上 entry_key
  function revisionOwnerKey(kind, pageKey, subKey) {
    if (kind === "entry") return "entry::" + String(pageKey == null ? "" : pageKey) + "::" + String(subKey == null ? "" : subKey);
    if (kind === "page") return "page::" + String(pageKey == null ? "" : pageKey);
    return "";
  }

  // 纯聚合：三批原始行 → 按名字归并的贡献者数组，按总贡献降序，只依赖入参、不碰 DOM。
  // 第四批是「站点自带的攻略」——那几篇不在数据库里（作者只写在 STATIC_GUIDES 里），
  // 得手动补上去，否则攻略大全上的老作者在榜上永远看不到。
  function aggregateContributors(revisions, articles, submissions, seededGuides) {
    var byName = Object.create(null);
    var seeds = seededGuides || staticGuideItems();

    function ensure(name) {
      var key = contributorName(name);
      if (!byName[key]) {
        byName[key] = {
          name: key,
          edits: 0,
          guides: 0,
          pageEdits: 0,
          entryEdits: 0,
          articleEdits: 0,
          lastActive: "",
          lastActiveMs: 0
        };
      }
      return byName[key];
    }

    function touch(p, when) {
      var ms = when ? new Date(when).getTime() : 0;
      if (!isNaN(ms) && ms > p.lastActiveMs) {
        p.lastActiveMs = ms;
        p.lastActive = when;
      }
    }

    // 站点自带的攻略：先按 STATIC_GUIDES 记一笔，同名者会与数据库里的记录并成一条
    (seeds || []).forEach(function (g) {
      if (!g) return;
      var p = ensure(g.author);
      p.guides++;
      touch(p, g.updatedAt);
    });

    // 攻略：记在署名作者名下
    var articleAuthor = Object.create(null);
    (articles || []).forEach(function (a) {
      if (!a) return;
      var key = String(a.article_key == null ? "" : a.article_key);
      if (key) articleAuthor[key] = contributorName(a.author_name);
      var p = ensure(a.author_name);
      p.guides++;
      touch(p, a.created_at);
    });

    // 已通过的投稿：页面/条目 → 投稿人。同一个键上出现两个不同名字时不敢认账，回落动手人。
    var ownerOf = Object.create(null);
    var disputed = Object.create(null);
    (submissions || []).forEach(function (s) {
      if (!s) return;
      var k = revisionOwnerKey(s.kind, s.page_key, s.entry_key);
      if (!k) return;
      var nm = contributorName(s.owner_name);
      if (ownerOf[k] === undefined) ownerOf[k] = nm;
      else if (ownerOf[k] !== nm) disputed[k] = true;
    });

    var seen = Object.create(null);

    // 一律按时间从早到晚处理：去重取「第一次」、以及「文章首版＝发布」的判定，
    // 都不该受查询返回顺序影响（线上就是倒序回来的）。
    var ordered = (revisions || []).slice().sort(function (a, b) {
      var ta = a && a.created_at ? new Date(a.created_at).getTime() : 0;
      var tb = b && b.created_at ? new Date(b.created_at).getTime() : 0;
      if (isNaN(ta)) ta = 0;
      if (isNaN(tb)) tb = 0;
      return ta - tb;
    });

    ordered.forEach(function (r) {
      if (!r) return;

      // 同内容反复保存（content_hash 相同）只算第一次。
      // 先登记再判首版，首版之后那些一字未改的保存才会一并折叠掉。
      if (r.content_hash) {
        var sig = String(r.kind || "") + "::" + String(r.target_key == null ? "" : r.target_key) + "::" + String(r.content_hash);
        if (seen[sig]) return;
        seen[sig] = 1;
      }

      // 文章首版＝这篇攻略的发布本身，已经计入「攻略」，不再重复算一次改动
      if (r.kind === "article" && Number(r.version) === 1) return;

      var owner = "";
      if (r.kind === "article") {
        owner = articleAuthor[String(r.target_key == null ? "" : r.target_key)] || "";
      } else {
        var ok = revisionOwnerKey(r.kind, r.page_key || r.target_key, r.sub_key);
        if (ok && ownerOf[ok] !== undefined && !disputed[ok]) owner = ownerOf[ok];
      }

      var p = ensure(owner || r.author_name);
      p.edits++;
      if (r.kind === "page") p.pageEdits++;
      else if (r.kind === "entry") p.entryEdits++;
      else if (r.kind === "article") p.articleEdits++;
      touch(p, r.created_at);
    });

    var list = Object.keys(byName).map(function (k) {
      var p = byName[k];
      p.total = p.edits + p.guides;
      return p;
    });

    list.sort(function (a, b) {
      return b.total - a.total || b.lastActiveMs - a.lastActiveMs || a.name.localeCompare(b.name);
    });
    return list;
  }

  function mountContributors() {
    var host = document.getElementById("contributorList");
    if (!host) return null;

    var statsEdits = document.getElementById("statEdits");
    var statsGuides = document.getElementById("statGuides");
    var statsPeople = document.getElementById("statPeople");
    var emptyEl = document.getElementById("contributorEmpty");
    var errorEl = document.getElementById("contributorError");
    var retryBtn = document.getElementById("contributorRetry");

    function setStats(edits, guides, people) {
      if (statsEdits) statsEdits.textContent = String(edits);
      if (statsGuides) statsGuides.textContent = String(guides);
      if (statsPeople) statsPeople.textContent = String(people);
    }

    function kindChips(p) {
      var chips = [];
      if (p.guides > 0) chips.push({ label: "攻略 " + p.guides, cls: "wiki-contrib-chip--guide" });
      if (p.edits > 0) chips.push({ label: "改动 " + p.edits, cls: "wiki-contrib-chip--edit" });
      var parts = [];
      if (p.pageEdits > 0) parts.push("页面 " + p.pageEdits);
      if (p.entryEdits > 0) parts.push("条目 " + p.entryEdits);
      if (p.articleEdits > 0) parts.push("攻略修订 " + p.articleEdits);
      return { chips: chips, detail: parts.join(" · ") };
    }

    // 分摊比例条：长度＝本人贡献 ÷ 榜首，色段＝攻略与改动的构成
    function renderMeter(p, maxTotal) {
      var track = el("div", "wiki-contrib-meter");
      if (!maxTotal || !p.total) return track;
      var bar = el("div", "wiki-contrib-meter-bar");
      bar.style.width = Math.max(8, Math.round((p.total / maxTotal) * 100)) + "%";
      var guidePct = Math.round((p.guides / p.total) * 100);
      if (p.guides > 0) {
        var seg = el("span", "wiki-contrib-meter-seg wiki-contrib-meter-seg--guide");
        seg.style.width = guidePct + "%";
        bar.appendChild(seg);
      }
      if (p.edits > 0) {
        var seg2 = el("span", "wiki-contrib-meter-seg wiki-contrib-meter-seg--edit");
        seg2.style.width = (100 - guidePct) + "%";
        bar.appendChild(seg2);
      }
      track.appendChild(bar);
      return track;
    }

    function renderItem(p, rank, maxTotal) {
      var li = el("li", "wiki-contrib-item");
      if (rank <= 3) li.classList.add("wiki-contrib-item--top");

      var badge = el("span", "wiki-contrib-rank", String(rank));
      if (rank <= 3) badge.classList.add("wiki-contrib-rank--top" + rank);
      li.appendChild(badge);

      var body = el("div", "wiki-contrib-body");
      var nameRow = el("div", "wiki-contrib-name");
      nameRow.appendChild(el("span", "wiki-contrib-nick", p.name));
      if (rank === 1) nameRow.appendChild(el("span", "wiki-contrib-crown", "榜首"));
      body.appendChild(nameRow);

      var kc = kindChips(p);
      var chipsRow = el("div", "wiki-contrib-chips");
      kc.chips.forEach(function (c) {
        chipsRow.appendChild(el("span", "wiki-contrib-chip " + c.cls, c.label));
      });
      body.appendChild(chipsRow);
      if (kc.detail) body.appendChild(el("div", "wiki-contrib-detail", kc.detail));

      body.appendChild(renderMeter(p, maxTotal));
      li.appendChild(body);

      li.appendChild(el("div", "wiki-contrib-when", p.lastActiveMs ? (contribWhen(p.lastActive) || "—") : "—"));
      return li;
    }

    function renderSkeleton() {
      host.textContent = "";
      if (emptyEl) emptyEl.hidden = true;
      if (errorEl) errorEl.hidden = true;
      for (var i = 0; i < 3; i++) {
        var card = el("div", "wiki-contrib-item wiki-contrib-item--skeleton");
        card.appendChild(el("div", "wiki-sk-line wiki-sk-line--title"));
        card.appendChild(el("div", "wiki-sk-line"));
        host.appendChild(card);
      }
    }

    function render(list) {
      host.textContent = "";
      var rows = list || [];
      if (!rows.length) {
        if (emptyEl) emptyEl.hidden = false;
        if (errorEl) errorEl.hidden = true;
        setStats(0, 0, 0);
        return;
      }
      if (emptyEl) emptyEl.hidden = true;
      if (errorEl) errorEl.hidden = true;

      var totalEdits = 0;
      var totalGuides = 0;
      var maxTotal = 0;
      rows.forEach(function (p) {
        totalEdits += p.edits;
        totalGuides += p.guides;
        if (p.total > maxTotal) maxTotal = p.total;
      });
      setStats(totalEdits, totalGuides, rows.length);

      rows.forEach(function (p, i) {
        host.appendChild(renderItem(p, i + 1, maxTotal));
      });
    }

    renderSkeleton();

    if (retryBtn) {
      retryBtn.addEventListener("click", function () {
        location.reload();
      });
    }

    return {
      setData: function (rows) {
        render(rows);
      },
      setError: function () {
        host.textContent = "";
        if (emptyEl) emptyEl.hidden = true;
        if (errorEl) errorEl.hidden = false;
        setStats(0, 0, 0);
      }
    };
  }

  function loadContributors(client) {
    var view = mountContributors();
    if (!view) return Promise.resolve([]);
    if (!client || !client.database) {
      view.setData([]);
      return Promise.resolve([]);
    }
    return Promise.all([
      Promise.resolve()
        .then(function () {
          return client.database
            .from("wiki_revisions")
            .select("author_name,kind,title,target_key,page_key,sub_key,version,content_hash,created_at")
            .order("created_at", { ascending: false })
            .limit(500);
        })
        .catch(function () {
          return null;
        }),
      Promise.resolve()
        .then(function () {
          return client.database
            .from("wiki_articles")
            .select("article_key,author_name,title,created_at")
            .order("created_at", { ascending: false })
            .limit(500);
        })
        .catch(function () {
          return null;
        }),
      // 只读视图，仅暴露已通过投稿的归属信息（不含 owner_id / 正文）。
      // 这一批查不到不算致命：拿不到就把改动记在修订流水里的动手人头上。
      Promise.resolve()
        .then(function () {
          return client.database
            .from("wiki_contrib_public")
            .select("owner_name,kind,page_key,entry_key,status")
            .limit(500);
        })
        .catch(function () {
          return null;
        })
    ]).then(function (results) {
      var revRes = results[0];
      var artRes = results[1];
      var subRes = results[2];
      var revisions = revRes && !revRes.error && Array.isArray(revRes.data) ? revRes.data : null;
      var articles = artRes && !artRes.error && Array.isArray(artRes.data) ? artRes.data : null;
      var submissions = subRes && !subRes.error && Array.isArray(subRes.data) ? subRes.data : [];
      if (revisions == null || articles == null) {
        view.setError();
        return [];
      }
      var list = aggregateContributors(revisions, articles, submissions);
      view.setData(list);
      return list;
    });
  }

  /* ---------------- 文本差异（改动预览 / 改动明细共用） ---------------- */

  function escHtml(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // 参与「换行」计算的块级标签：块与块之间视为一次换行
  var BLOCK_TAGS = {
    P: 1, DIV: 1, LI: 1, UL: 1, OL: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
    TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, BLOCKQUOTE: 1, PRE: 1, FIGURE: 1,
    FIGCAPTION: 1, SECTION: 1, ARTICLE: 1, HEADER: 1, FOOTER: 1, MAIN: 1,
    DL: 1, DT: 1, DD: 1, HR: 1, CAPTION: 1
  };

  // 从 HTML 里取纯文本，用于比对。
  // 关键点：不能直接用 textContent —— 源码里 <p> 之间的换行和缩进会混进正文，
  // 只调整排版就被判成「内容改动」，差异全是噪音。
  // 这里按块级标签重建换行、把行内空白折叠成单空格，再合并连续换行。
  function textOf(html) {
    var doc = new DOMParser().parseFromString(String(html == null ? "" : html), "text/html");
    if (!doc.body) return "";
    var buf = [];

    (function walk(node) {
      var kids = node.childNodes;
      for (var i = 0; i < kids.length; i++) {
        var n = kids[i];
        if (n.nodeType === 3) {
          buf.push(String(n.nodeValue).replace(/[ \t\u00a0\u3000\r\n]+/g, " "));
          continue;
        }
        if (n.nodeType !== 1) continue;
        var tag = n.tagName.toUpperCase();
        if (tag === "SCRIPT" || tag === "STYLE") continue;
        if (tag === "BR") {
          buf.push("\n");
          continue;
        }
        var block = !!BLOCK_TAGS[tag];
        if (block) buf.push("\n");
        walk(n);
        if (block) buf.push("\n");
      }
    })(doc.body);

    return buf
      .join("")
      .replace(/[ \t\u00a0\u3000]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  // 分词：中文按单字，西文/数字按整词，换行与其余符号各自成一个 token。
  // 中文没有词间空格，按字比对才看得出「具体改了哪几个字」。
  function tokenize(text) {
    var out = [];
    var re = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]|[A-Za-z0-9]+|\n|[^\S\n]+|[\s\S]/g;
    var m;
    var s = String(text == null ? "" : text);
    while ((m = re.exec(s)) !== null) out.push(m[0]);
    return out;
  }

  function pushOp(ops, type, value) {
    if (!value) return;
    var last = ops[ops.length - 1];
    if (last && last.t === type) last.v += value;
    else ops.push({ t: type, v: value });
  }

  // token 级 LCS 差异。先剪掉公共前后缀（日常小改动能让中间段极短），
  // 中间段规模过大时退化为「整段替换」，避免长页面把主线程算卡。
  function diffTokens(a, b) {
    var n = a.length;
    var m = b.length;
    var i;
    var head = 0;
    while (head < n && head < m && a[head] === b[head]) head++;
    var tail = 0;
    while (tail < n - head && tail < m - head && a[n - 1 - tail] === b[m - 1 - tail]) tail++;

    var midA = a.slice(head, n - tail);
    var midB = b.slice(head, m - tail);
    var mid = [];

    if (midA.length && midB.length && midA.length * midB.length <= 400000) {
      var w = midB.length + 1;
      var dp = new Int32Array((midA.length + 1) * w);
      var r;
      var c;
      for (r = midA.length - 1; r >= 0; r--) {
        for (c = midB.length - 1; c >= 0; c--) {
          dp[r * w + c] =
            midA[r] === midB[c]
              ? dp[(r + 1) * w + (c + 1)] + 1
              : Math.max(dp[(r + 1) * w + c], dp[r * w + (c + 1)]);
        }
      }
      var x = 0;
      var y = 0;
      while (x < midA.length && y < midB.length) {
        if (midA[x] === midB[y]) {
          pushOp(mid, "=", midA[x]);
          x++;
          y++;
        } else if (dp[(x + 1) * w + y] >= dp[x * w + (y + 1)]) {
          pushOp(mid, "-", midA[x]);
          x++;
        } else {
          pushOp(mid, "+", midB[y]);
          y++;
        }
      }
      while (x < midA.length) pushOp(mid, "-", midA[x++]);
      while (y < midB.length) pushOp(mid, "+", midB[y++]);
    } else {
      pushOp(mid, "-", midA.join(""));
      pushOp(mid, "+", midB.join(""));
    }

    var ops = [];
    for (i = 0; i < head; i++) pushOp(ops, "=", a[i]);
    for (i = 0; i < mid.length; i++) pushOp(ops, mid[i].t, mid[i].v);
    for (i = n - tail; i < n; i++) pushOp(ops, "=", a[i]);
    return ops;
  }

  // 输入两段 HTML，输出内联差异：<del>=删除、<ins>=新增，并给出增删字数。
  // 字数只统计可见字符（不含空白），否则「新增一段」会连着换行一起算进去，读起来对不上。
  function diffPages(beforeHtml, afterHtml) {
    var before = textOf(beforeHtml);
    var after = textOf(afterHtml);
    var ops = diffTokens(tokenize(before), tokenize(after));
    var added = 0;
    var removed = 0;
    var html = "";
    ops.forEach(function (op) {
      if (op.t === "=") {
        html += escHtml(op.v);
      } else if (op.t === "-") {
        removed += op.v.replace(/\s/g, "").length;
        html += '<del class="wiki-diff-del">' + escHtml(op.v) + "</del>";
      } else {
        added += op.v.replace(/\s/g, "").length;
        html += '<ins class="wiki-diff-add">' + escHtml(op.v) + "</ins>";
      }
    });
    var changed = before !== after;
    return {
      html: html,
      added: added,
      removed: removed,
      changed: changed,
      label:
        added || removed
          ? "新增 " + added + " 字，删除 " + removed + " 字"
          : "仅有段落或换行调整"
    };
  }

  function debounce(fn, ms) {
    var timer = null;
    return function () {
      var self = this;
      var args = arguments;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        timer = null;
        fn.apply(self, args);
      }, ms);
    };
  }

  /* ---------------- 修订历史与回退 ---------------- */
  //
  // 每次内容生效，数据库触发器（public.wiki_rev_capture）都会自动存下一版完整快照，
  // 前端只负责「看」和「回退」。历史对所有访客公开 —— 任何一次改动都能追溯到人、时间和内容，
  // 这是开放编辑的前提：敢让人随便改，是因为改坏了能一键还原。
  // 回退仅审核员可用；前端隐藏按钮只是体面，真正的闸门是数据库函数 wiki_revert_revision。
  //
  // 三张内容表共用一张 wiki_revisions，用 kind 区分：page（页面）/ entry（图鉴条目）/ article（攻略）。

  var historyState = {
    kind: "",
    key: "",
    label: "",
    rows: [],
    selected: null,
    view: "preview"
  };

  var historyEls = null;

  function historyClient() {
    if (state.client) return Promise.resolve(state.client);
    if (window.WikiCloud && typeof window.WikiCloud.ready === "function") {
      return Promise.resolve()
        .then(function () {
          return window.WikiCloud.ready();
        })
        .catch(function () {
          return null;
        });
    }
    return Promise.resolve(null);
  }

  // 当前页面对应的历史目标。
  // 图鉴页的正文来自各自的 JS 数据数组、不在 wiki_pages 里，页面级历史对它没有意义
  // （条目的历史在条目编辑弹层里看），所以这里返回 null，让「历史」按钮自动隐藏。
  function historyTarget() {
    if (document.body && document.body.hasAttribute("data-wiki-article-view")) {
      var m = /[?&]slug=([^&#]*)/.exec(location.search || "");
      if (!m) return null;
      var key = "";
      try {
        key = decodeURIComponent(m[1]);
      } catch (e) {
        key = m[1];
      }
      return key ? { kind: "article", key: key, label: "本篇攻略" } : null;
    }
    if (compendiumConfig()) return null;
    if (editableRegions().length) {
      return { kind: "page", key: currentPageKey(), label: "本页" };
    }
    return null;
  }

  // 一版快照 → 可阅读、可比较的 HTML（会再走一次 sanitize，避免历史里的旧内容带进脏标签）
  function snapshotHtml(kind, snap) {
    snap = snap || {};
    if (kind === "page") {
      return decodeRegions(snap.regions)
        .map(function (h) {
          return sanitize(h);
        })
        .join("");
    }
    if (kind === "entry") {
      var rows = [];
      if (snap.entry_title) rows.push('<p class="wiki-history-title">' + escHtml(snap.entry_title) + "</p>");
      var f = snap.fields || {};
      Object.keys(f).forEach(function (k) {
        if (f[k] == null || f[k] === "") return;
        rows.push("<p><strong>" + escHtml(k) + "</strong>：" + escHtml(String(f[k])) + "</p>");
      });
      return rows.join("") || "<p>（这一版没有可显示的字段）</p>";
    }
    var out = [];
    if (snap.title) out.push('<p class="wiki-history-title">' + escHtml(snap.title) + "</p>");
    var meta = [];
    if (snap.category) meta.push("分类：" + snap.category);
    if (snap.tags) meta.push("标签：" + snap.tags);
    if (meta.length) out.push("<p><strong>" + escHtml(meta.join(" · ")) + "</strong></p>");
    if (snap.summary) out.push("<p>" + escHtml(snap.summary) + "</p>");
    if (snap.body) out.push(sanitize(snap.body));
    return out.join("") || "<p>（这一版没有内容）</p>";
  }

  // 一版快照 → 纯文本，用于展示与对比摘要
  function snapshotText(kind, snap) {
    if (kind === "page") {
      return decodeRegions(snap && snap.regions)
        .map(function (h) {
          return textOf(h);
        })
        .join("\n\n");
    }
    return textOf(snapshotHtml(kind, snap));
  }

  function buildHistoryOverlay() {
    if (historyEls) return historyEls;

    var box = el("div", "wiki-collab-overlay");
    box.id = "wikiHistoryOverlay";
    box.hidden = true;

    var dialog = el("div", "wiki-collab-dialog wiki-history-dialog");
    var head = el("div", "wiki-collab-dialog-head");
    var title = el("h2", null, "修订历史");
    var close = el("button", "wiki-collab-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "关闭");
    head.appendChild(title);
    head.appendChild(close);

    var sub = el("p", "wiki-history-sub");
    sub.id = "wikiHistorySub";

    var body = el("div", "wiki-history-body");
    var list = el("ul", "wiki-history-list");
    list.id = "wikiHistoryList";
    var panel = el("div", "wiki-history-panel");
    panel.id = "wikiHistoryPanel";
    body.appendChild(list);
    body.appendChild(panel);

    var msg = el("p", "wiki-collab-msg");
    msg.id = "wikiHistoryMsg";

    var foot = el("div", "wiki-collab-dialog-foot");
    var footInfo = el("span", "wiki-history-footinfo");
    footInfo.id = "wikiHistoryFootInfo";
    var compareBtn = el("button", "wiki-collab-btn wiki-collab-btn--ghost", "与当前版本对比");
    compareBtn.type = "button";
    compareBtn.id = "wikiHistoryCompare";
    var revertBtn = el("button", "wiki-collab-btn wiki-collab-btn--primary", "回退到此版本");
    revertBtn.type = "button";
    revertBtn.id = "wikiHistoryRevert";
    var doneBtn = el("button", "wiki-collab-btn wiki-collab-btn--ghost", "关闭");
    doneBtn.type = "button";
    doneBtn.id = "wikiHistoryDone";
    foot.appendChild(footInfo);
    foot.appendChild(compareBtn);
    foot.appendChild(revertBtn);
    foot.appendChild(doneBtn);

    dialog.appendChild(head);
    dialog.appendChild(sub);
    dialog.appendChild(body);
    dialog.appendChild(msg);
    dialog.appendChild(foot);
    box.appendChild(dialog);
    document.body.appendChild(box);

    close.addEventListener("click", closeHistory);
    doneBtn.addEventListener("click", closeHistory);
    box.addEventListener("click", function (e) {
      if (e.target === box) closeHistory();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && historyEls && !historyEls.overlay.hidden) closeHistory();
    });
    compareBtn.addEventListener("click", showHistoryDiff);
    revertBtn.addEventListener("click", revertSelected);

    historyEls = {
      overlay: box,
      sub: sub,
      list: list,
      panel: panel,
      msg: msg,
      footInfo: footInfo,
      compare: compareBtn,
      revert: revertBtn
    };
    return historyEls;
  }

  function setHistoryMsg(text, isError) {
    if (!historyEls) return;
    historyEls.msg.textContent = text || "";
    historyEls.msg.className = "wiki-collab-msg" + (isError ? " is-error" : "");
  }

  function loadHistory() {
    var kind = historyState.kind;
    var key = historyState.key;
    return historyClient()
      .then(function (client) {
        if (!client) return [];
        return client.database
          .from("wiki_revisions")
          .select("id,kind,target_key,title,version,author_name,source,revert_of,created_at")
          .eq("kind", kind)
          .eq("target_key", key)
          .order("version", { ascending: false })
          .limit(60);
      })
      .then(function (res) {
        return res && !res.error && Array.isArray(res.data) ? res.data : [];
      })
      .catch(function () {
        return [];
      });
  }

  function loadRevision(id) {
    return historyClient()
      .then(function (client) {
        if (!client) return null;
        return client.database
          .from("wiki_revisions")
          .select("id,kind,target_key,title,snapshot,version,author_name,source,revert_of,created_at")
          .eq("id", id)
          .limit(1);
      })
      .then(function (res) {
        return res && !res.error && Array.isArray(res.data) && res.data.length ? res.data[0] : null;
      })
      .catch(function () {
        return null;
      });
  }

  function revertTo(id) {
    return historyClient()
      .then(function (client) {
        // 注意：rpc 挂在 client.database 上，不是 client 上（与 boot 里的调用保持一致）
        var db = client && client.database;
        if (!db || typeof db.rpc !== "function") {
          return { ok: false, message: "云服务不可用，暂时无法回退。" };
        }
        return Promise.resolve(db.rpc("wiki_revert_revision", { p_revision_id: id }))
          .then(function (res) {
            if (res && !res.error && res.data && res.data.ok) return { ok: true, data: res.data };
            var m = res && res.error && res.error.message;
            return { ok: false, message: m || "回退失败。" };
          })
          .catch(function (e) {
            return { ok: false, message: (e && e.message) || "回退失败。" };
          });
      })
      .catch(function (e) {
        return { ok: false, message: (e && e.message) || "回退失败。" };
      });
  }

  function renderHistoryList() {
    var els = historyEls;
    if (!els) return;
    els.list.textContent = "";
    if (!historyState.rows.length) {
      els.list.appendChild(el("li", "wiki-history-empty", "还没有修订记录。"));
      return;
    }
    var latestId = historyState.rows[0].id;
    historyState.rows.forEach(function (row) {
      var li = el("li", "wiki-history-item");
      li.dataset.id = String(row.id);
      li.setAttribute("tabindex", "0");
      if (historyState.selected === row.id) li.classList.add("is-active");
      if (row.id === latestId) li.classList.add("is-current");

      var ver = el("div", "wiki-history-ver", "第 " + row.version + " 版");
      if (row.id === latestId) {
        ver.appendChild(el("span", "wiki-history-tag", "当前"));
      } else if (row.source === "revert") {
        ver.appendChild(el("span", "wiki-history-tag wiki-history-tag--revert", "回退"));
      }
      li.appendChild(ver);

      var bits = [];
      if (row.author_name) bits.push(row.author_name);
      if (row.created_at) bits.push(fmtTime(row.created_at));
      li.appendChild(el("div", "wiki-history-meta", bits.join(" · ")));

      li.addEventListener("click", function () {
        selectRevision(row.id);
      });
      els.list.appendChild(li);
    });
  }

  function updateHistoryActions() {
    var els = historyEls;
    if (!els) return;
    var latest = historyState.rows[0];
    var sel = historyState.selected;
    var isOld = !!(sel && latest && sel !== latest.id);
    els.compare.hidden = !isOld;
    els.revert.hidden = !state.isAdmin;
    els.revert.disabled = !isOld;
    els.footInfo.textContent = historyState.rows.length
      ? "共 " + historyState.rows.length + " 个版本"
      : "";
  }

  function selectRevision(id) {
    if (!historyEls) return;
    historyState.selected = id;
    historyState.view = "preview";
    renderHistoryList();
    updateHistoryActions();
    setHistoryMsg("");
    historyEls.panel.textContent = "";
    historyEls.panel.appendChild(el("p", "wiki-history-loading", "正在读取这一版…"));

    var kind = historyState.kind;
    var key = historyState.key;
    loadRevision(id).then(function (row) {
      if (!historyEls) return;
      if (historyState.selected !== id || historyState.kind !== kind || historyState.key !== key) return;
      if (!row) {
        historyEls.panel.textContent = "";
        historyEls.panel.appendChild(el("p", "wiki-history-loading", "这一版读取失败了，可能是网络问题。"));
        return;
      }
      historyEls.panel.textContent = "";
      historyEls.panel.appendChild(
        el(
          "div",
          "wiki-history-preview-head",
          "第 " + row.version + " 版 · " + (row.author_name || "匿名玩家") + " · " + fmtTime(row.created_at)
        )
      );
      var content = el("div", "wiki-history-content");
      content.innerHTML = sanitize(snapshotHtml(kind, row.snapshot || {}));
      historyEls.panel.appendChild(content);
    });
  }

  function showHistoryDiff() {
    var els = historyEls;
    if (!els) return;
    var latest = historyState.rows[0];
    var sel = historyState.selected;
    if (!latest || !sel || sel === latest.id) return;

    historyState.view = "diff";
    setHistoryMsg("");
    els.panel.textContent = "";
    els.panel.appendChild(el("p", "wiki-history-loading", "正在比对…"));

    var kind = historyState.kind;
    var key = historyState.key;
    Promise.all([loadRevision(sel), loadRevision(latest.id)]).then(function (pair) {
      if (!historyEls) return;
      if (historyState.kind !== kind || historyState.key !== key || historyState.selected !== sel) return;
      var from = pair[0];
      var to = pair[1];
      els.panel.textContent = "";
      if (!from || !to) {
        els.panel.appendChild(el("p", "wiki-history-loading", "对比失败，可能是网络问题。"));
        return;
      }
      var d = diffPages(snapshotHtml(kind, from.snapshot || {}), snapshotHtml(kind, to.snapshot || {}));
      els.panel.appendChild(
        el(
          "div",
          "wiki-history-preview-head",
          "第 " + from.version + " 版 → 当前（第 " + to.version + " 版） · 新增 " + d.added + " 字，删除 " + d.removed + " 字"
        )
      );
      var box = el("div", "wiki-history-diff");
      box.innerHTML = d.changed ? d.html : '<p class="muted">这一版与当前内容相同。</p>';
      els.panel.appendChild(box);
    });
  }

  function revertSelected() {
    var els = historyEls;
    if (!els) return;
    var sel = historyState.selected;
    var latest = historyState.rows[0];
    if (!sel || !latest || sel === latest.id) return;
    var row = null;
    historyState.rows.forEach(function (r) {
      if (r.id === sel) row = r;
    });
    if (!row) return;
    if (!window.confirm("确认回退到第 " + row.version + " 版？当前内容会被这一版覆盖，这次回退本身也会记入历史。")) {
      return;
    }
    els.revert.disabled = true;
    setHistoryMsg("正在回退…");
    revertTo(sel).then(function (res) {
      if (historyEls) historyEls.revert.disabled = false;
      if (!res.ok) {
        setHistoryMsg(res.message || "回退失败。", true);
        return;
      }
      setHistoryMsg("已回退到第 " + row.version + " 版，正在刷新页面…");
      window.setTimeout(function () {
        location.reload();
      }, 700);
    });
  }

  function openHistoryFor(kind, key, label) {
    var els = buildHistoryOverlay();
    historyState.kind = kind;
    historyState.key = key;
    historyState.label = label || "本页";
    historyState.rows = [];
    historyState.selected = null;
    historyState.view = "preview";

    els.overlay.hidden = false;
    els.sub.textContent = (label || "本页") + " · 每一次改动都留在这里，可以对比，也可以还原。";
    els.list.textContent = "";
    els.list.appendChild(el("li", "wiki-history-empty", "正在加载历史…"));
    els.panel.textContent = "";
    els.footInfo.textContent = "";
    els.compare.hidden = true;
    els.revert.hidden = true;
    setHistoryMsg("");

    loadHistory().then(function (rows) {
      if (!historyEls) return;
      if (historyState.kind !== kind || historyState.key !== key) return;
      historyState.rows = rows;
      renderHistoryList();
      updateHistoryActions();
      if (rows.length) {
        selectRevision(rows[0].id);
      } else {
        els.panel.appendChild(
          el("p", "wiki-history-loading", "这一页还没有修订记录 —— 第一次改动生效后就会出现在这里。")
        );
      }
    });
  }

  function openHistory() {
    var t = historyTarget();
    if (!t) return;
    openHistoryFor(t.kind, t.key, t.label);
  }

  function closeHistory() {
    if (historyEls) historyEls.overlay.hidden = true;
  }

  /* ---------------- 纯静态模式（不连云服务） ----------------
   * 站点转为纯静态后，「攻略大全」与「贡献者」两页仍要能看，但数据全部来自
   * STATIC_GUIDES —— 一次网络请求都不发。wiki.js 只在 window.WikiCloud 不存在时调用这两个函数，
   * 所以它们与下面的云链路互不干扰：将来恢复登录，这两句也不会碍事。
   */
  function renderStaticGuides() {
    var view = mountGuideLibrary();
    if (!view) return null;
    view.setData([]); // 没有投稿可拉，只留站点自带的攻略
    return view;
  }

  function renderStaticContributors() {
    var view = mountContributors();
    if (!view) return null;
    // 没有修订流水、没有投稿视图，只剩「攻略大全」那几篇的作者
    view.setData(aggregateContributors([], [], [], staticGuideItems()));
    // 纯静态下没有「内容改动」可言，留一张恒为 0 的统计卡只会让人以为坏掉了，直接收起来
    var editsNum = document.getElementById("statEdits");
    if (editsNum && editsNum.parentElement) editsNum.parentElement.style.display = "none";
    return view;
  }

  window.WikiCollab = {
    sanitize: sanitize,
    regroupTiles: regroupTiles,
    decodeRegions: decodeRegions,
    pageKey: currentPageKey,
    pageUrl: pageUrl,
    fmtTime: fmtTime,
    siteBase: siteBase,
    url: url,
    textOf: textOf,
    diff: diffPages,
    debounce: debounce,
    compendiumFields: compendiumFields,
    guideCategories: function () {
      return GUIDE_CATEGORIES.slice();
    },
    guideTemplate: function () {
      return GUIDE_TEMPLATE;
    },
    guideFields: guideFields,
    articleUrl: articleUrl,
    guideListUrl: guideListUrl,
    history: {
      open: openHistory,
      openFor: openHistoryFor,
      target: historyTarget,
      snapshotHtml: snapshotHtml,
      snapshotText: snapshotText,
      list: loadHistory,
      get: loadRevision,
      revert: revertTo,
      close: closeHistory
    },
    guideLibrary: {
      catalog: allGuides,
      seeded: staticGuideItems,
      normalize: normalizeGuides,
      filter: filterGuides,
      facets: guideFacets,
      tags: guideTags,
      sorts: function () {
        return GUIDE_SORTS.slice();
      }
    },
    contributors: {
      aggregate: aggregateContributors
    },
    // 纯静态模式的入口（wiki.js 调用）
    renderStaticGuides: renderStaticGuides,
    renderStaticContributors: renderStaticContributors,
    nick: nick,
    setNick: setNick
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
