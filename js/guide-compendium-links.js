(function () {
  if (!window.COMPENDIUM_AUTOLINK) return;

  var articles = document.querySelectorAll(".xuanwu-integrated-guide, .early-internal-guide");
  if (!articles.length) return;

  var entries = window.COMPENDIUM_AUTOLINK.slice().sort(function (a, b) {
    return b.name.length - a.name.length;
  });

  var byName = {};
  entries.forEach(function (e) {
    if (!byName[e.name]) byName[e.name] = e;
  });

  var internalEntries = entries.filter(function (e) {
    return (e.url || "").indexOf("internal") !== -1;
  });

  function resolveHref(entry) {
    var depth = parseInt(document.body.getAttribute("data-wiki-depth") || "0", 10);
    var prefix = depth === 0 ? "" : depth === 1 ? "../" : "../../";
    var url = entry.url;
    if (!url.startsWith("http") && prefix && !url.startsWith("../")) {
      url = prefix + url;
    }
    if (entry.q) {
      url += (url.indexOf("?") >= 0 ? "&" : "?") + "q=" + encodeURIComponent(entry.q);
    }
    return url;
  }

  function linkNameInElement(el, name, entry) {
    entry = entry || byName[name];
    if (!entry || el.querySelector("a")) return;
    var text = el.textContent;
    if (text.indexOf(name) === -1) return;
    var href = resolveHref(entry);
    var safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    el.innerHTML = el.innerHTML.replace(
      new RegExp(safe),
      '<a href="' + href + '">' + name + "</a>"
    );
  }

  function lookupInternal(raw) {
    if (!raw) return null;
    if (byName[raw] && byName[raw].url.indexOf("internal") !== -1) return byName[raw];
    var best = null;
    var bestScore = 0;
    internalEntries.forEach(function (e) {
      var n = e.name;
      var score = 0;
      if (n === raw) score = 100;
      else if (n.indexOf(raw) === 0) score = 80 + raw.length;
      else if (raw.indexOf(n) === 0) score = 70 + n.length;
      else if (raw.length >= 2 && n.indexOf(raw) !== -1) score = 50 + raw.length;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    });
    return best;
  }

  function nameFromInternalH3(h3) {
    var nameEl = h3.querySelector(".guide-entry-name");
    if (nameEl) return (nameEl.textContent || "").trim();
    var t = (h3.textContent || "").trim();
    var m = t.match(/^([?？]|[sabc])(.+?)[：:]/);
    return m ? m[2].trim() : null;
  }

  function linkInternalH3(h3) {
    if (h3.querySelector("a")) return;
    var raw = nameFromInternalH3(h3);
    if (!raw) return;
    var entry = lookupInternal(raw);
    if (!entry) return;
    var href = resolveHref(entry);
    var nameEl = h3.querySelector(".guide-entry-name");
    if (nameEl) {
      var a = document.createElement("a");
      a.href = href;
      a.textContent = nameEl.textContent;
      nameEl.textContent = "";
      nameEl.appendChild(a);
      return;
    }
    linkNameInElement(h3, raw, entry);
  }

  function initIntegrated(article) {
    article.querySelectorAll(".guide-char-entry").forEach(function (p) {
      var m = (p.textContent || "").match(/^([^，,]+)/);
      if (m) linkNameInElement(p, m[1].trim());
    });

    article.querySelectorAll("h3").forEach(function (h3) {
      var name = (h3.textContent || "").trim();
      if (byName[name]) linkNameInElement(h3, name);
    });

    var tokenH2 = article.querySelector("#武器来源与令牌");
    if (tokenH2) {
      var el = tokenH2.nextElementSibling;
      while (el && el.tagName !== "H2") {
        if (el.tagName === "P") {
          TOKEN_LINE: for (var i = 0; i < entries.length; i++) {
            var t = entries[i];
            if (t.url.indexOf("weapons-xuanwu") === -1) continue;
            if ((el.textContent || "").indexOf(t.name) === 0) {
              linkNameInElement(el, t.name);
              break TOKEN_LINE;
            }
          }
        }
        el = el.nextElementSibling;
      }
    }
  }

  function initEarlyInternal(article) {
    article.querySelectorAll("h3").forEach(linkInternalH3);
    article.querySelectorAll("p").forEach(function (p) {
      if (p.querySelector("a")) return;
      var text = (p.textContent || "").trim();
      if (!text || text.length > 80) return;
      var m = text.match(/^([?？]|[sabc])([^：:]{2,12})[：:]/);
      if (!m) return;
      var entry = lookupInternal(m[2].trim());
      if (entry) linkNameInElement(p, m[2].trim(), entry);
    });
  }

  articles.forEach(function (article) {
    if (article.classList.contains("xuanwu-integrated-guide")) initIntegrated(article);
    if (article.classList.contains("early-internal-guide")) initEarlyInternal(article);
  });
})();
