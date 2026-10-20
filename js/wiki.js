(function () {
  if (location.protocol === "file:") {
    var vp = document.querySelector('meta[name="viewport"]');
    if (vp) {
      vp.setAttribute(
        "content",
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
      );
    }
  }

  // 页头品牌不再插图标：那枚 32px 的玄武小图在这个尺寸下糊成一团，页头只留站名。
  // （assets/images/xuanwu-mark.webp 因此暂时没人用了，留着备用。）

  function wikiScriptBase() {
    var proseSheet = document.querySelector('link[rel="stylesheet"][href*="wiki.css"]');
    if (!proseSheet) return "";
    return proseSheet.getAttribute("href").replace(/css\/wiki\.css\/?(?:\?[^"']*)?$/, "");
  }

  function wikiEnsureCompendiumAutolink(done) {
    if (window.COMPENDIUM_AUTOLINK) {
      if (done) done();
      return;
    }
    if (!window.__wikiAutolinkPromise) {
      window.__wikiAutolinkPromise = new Promise(function (resolve) {
        var s = document.createElement("script");
        s.src = wikiScriptBase() + "js/compendium-autolink.js";
        s.async = true;
        s.onload = function () {
          resolve();
        };
        s.onerror = function () {
          resolve();
        };
        document.head.appendChild(s);
      });
    }
    window.__wikiAutolinkPromise.then(function () {
      if (done) done();
    });
  }
  window.wikiEnsureCompendiumAutolink = wikiEnsureCompendiumAutolink;

  const navToggle = document.getElementById("navToggle");
  const sidebar = document.getElementById("sidebar");
  const searchInput = document.getElementById("globalSearch");

  if (navToggle && sidebar) {
    navToggle.addEventListener("click", function () {
      sidebar.classList.toggle("open");
    });
    document.addEventListener("click", function (e) {
      if (
        sidebar.classList.contains("open") &&
        !sidebar.contains(e.target) &&
        e.target !== navToggle
      ) {
        sidebar.classList.remove("open");
      }
    });
  }

  /** 站内搜索：输入下拉候选 + 回车跳转 */
  if (searchInput) {
    const pages = window.WIKI_SEARCH_INDEX || [];
    const SUGGEST_LIMIT = 8;
    var suggestEl = null;
    var suggestTimer = null;
    var activeSuggest = -1;
    var lastHits = [];

    function resolveUrl(path) {
      if (!path || /^https?:\/\//i.test(path)) return path;
      if (path.startsWith("../")) return path;
      return wikiScriptBase() + path;
    }

    function urlKindLabel(url) {
      if (!url) return "站内";
      if (url.indexOf("player-article") !== -1) return "玩家攻略";
      if (url.indexOf("characters") !== -1) return "角色图鉴";
      if (url.indexOf("skills.html") !== -1) return "武功图鉴";
      if (url.indexOf("internal") !== -1) return "内功图鉴";
      if (url.indexOf("equipment") !== -1) return "装备图鉴";
      if (url.indexOf("arts") !== -1) return "技艺图鉴";
      if (url.indexOf("weapons") !== -1) return "武器获取";
      if (url.indexOf("articles/") !== -1) return "攻略";
      if (url.indexOf("guide-list") !== -1) return "导航";
      if (url.indexOf("compendium") !== -1) return "图鉴";
      return "站内";
    }

    function buildDestUrl(path, queryParam) {
      var dest = resolveUrl(path);
      if (!queryParam) return dest;
      dest += (dest.indexOf("?") >= 0 ? "&" : "?") + "q=" + encodeURIComponent(queryParam);
      return dest;
    }

    function scoreName(name, q) {
      var n = (name || "").toLowerCase();
      if (!n || n.indexOf(q) === -1) return 0;
      if (n === q) return 100;
      if (n.indexOf(q) === 0) return 86;
      return 62;
    }

    function scorePageEntry(p, q) {
      var title = (p.title || "").toLowerCase();
      var best = 0;
      if (title === q) best = 92;
      else if (title.indexOf(q) === 0) best = 78;
      else if (title.indexOf(q) !== -1) best = Math.max(best, 56);
      (p.keys || "")
        .toLowerCase()
        .split(/\s+/)
        .forEach(function (k) {
          if (!k) return;
          if (k === q) best = Math.max(best, 88);
          else if (k.indexOf(q) === 0) best = Math.max(best, 72);
          else if (k.indexOf(q) !== -1) best = Math.max(best, 52);
        });
      if (best && p.url.indexOf("compendium/") !== -1) best += 1;
      return best;
    }

    function collectHits(rawQ, limit) {
      var q = (rawQ || "").trim().toLowerCase();
      if (!q) return [];
      var autolink = window.COMPENDIUM_AUTOLINK || [];
      var hits = [];
      var seen = Object.create(null);

      autolink.forEach(function (e) {
        var sc = scoreName(e.name, q);
        if (!sc) return;
        var key = (e.url || "") + "\0" + (e.q || e.name || "");
        if (seen[key]) return;
        seen[key] = true;
        hits.push({
          score: sc,
          title: e.name,
          meta: urlKindLabel(e.url),
          url: buildDestUrl(e.url, e.q || e.name),
        });
      });

      // 每次搜索都重新读全局索引：玩家攻略是运行时从数据库取回后才推进去的，
      // 若沿用加载时拷贝的常量，这些条目永远搜不到。
      (window.WIKI_SEARCH_INDEX || pages).forEach(function (p) {
        var sc = scorePageEntry(p, q);
        if (!sc) return;
        var queryParam = null;
        if (p.url.indexOf("compendium/") !== -1) {
          var keys = (p.keys || "").toLowerCase().split(/\s+/);
          if (keys.indexOf(q) !== -1) queryParam = rawQ.trim();
        }
        var key = p.url + "\0" + (queryParam || "");
        if (seen[key] && sc < 90) return;
        seen[key] = true;
        hits.push({
          score: sc,
          title: p.title,
          meta: urlKindLabel(p.url),
          url: buildDestUrl(p.url, queryParam),
        });
      });

      hits.sort(function (a, b) {
        return b.score - a.score;
      });
      return hits.slice(0, limit);
    }

    function goToHit(hit) {
      if (!hit || !hit.url) return;
      window.location.href = hit.url;
    }

    function runGlobalSearch() {
      var raw = searchInput.value.trim();
      const q = raw.toLowerCase();
      if (!q) return;
      wikiEnsureCompendiumAutolink(function () {
        if (activeSuggest >= 0 && lastHits[activeSuggest]) {
          goToHit(lastHits[activeSuggest]);
          return;
        }
        var hits = collectHits(raw, 1);
        if (hits[0]) {
          goToHit(hits[0]);
          return;
        }
        const links = Array.from(document.querySelectorAll("a[href]"));
        const linkHit = links.find(function (a) {
          return (a.textContent || "").toLowerCase().includes(q);
        });
        if (linkHit) linkHit.click();
      });
    }

    function ensureSuggestBox() {
      if (suggestEl) return suggestEl;
      var wrap = searchInput.parentElement;
      if (!wrap) return null;
      wrap.classList.add("wiki-search-anchor");
      suggestEl = document.createElement("div");
      suggestEl.id = "globalSearchSuggest";
      suggestEl.className = "wiki-search-suggest";
      suggestEl.setAttribute("role", "listbox");
      suggestEl.hidden = true;
      wrap.appendChild(suggestEl);
      return suggestEl;
    }

    function setActiveSuggest(idx) {
      activeSuggest = idx;
      if (!suggestEl) return;
      var items = suggestEl.querySelectorAll(".wiki-search-suggest-item");
      items.forEach(function (btn, i) {
        btn.classList.toggle("is-active", i === idx);
        if (i === idx) btn.setAttribute("aria-selected", "true");
        else btn.removeAttribute("aria-selected");
      });
    }

    function hideSuggest() {
      activeSuggest = -1;
      lastHits = [];
      if (suggestEl) suggestEl.hidden = true;
    }

    function renderSuggest(raw) {
      var box = ensureSuggestBox();
      if (!box) return;
      var hits = collectHits(raw, SUGGEST_LIMIT);
      lastHits = hits;
      activeSuggest = -1;
      box.textContent = "";
      if (!hits.length) {
        box.hidden = true;
        return;
      }
      hits.forEach(function (hit, i) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wiki-search-suggest-item";
        btn.setAttribute("role", "option");
        btn.dataset.index = String(i);
        var title = document.createElement("span");
        title.className = "wiki-search-suggest-title";
        title.textContent = hit.title;
        var meta = document.createElement("span");
        meta.className = "wiki-search-suggest-meta";
        meta.textContent = hit.meta;
        btn.appendChild(title);
        btn.appendChild(meta);
        btn.addEventListener("mousedown", function (e) {
          e.preventDefault();
        });
        btn.addEventListener("click", function () {
          goToHit(hit);
        });
        box.appendChild(btn);
      });
      box.hidden = false;
    }

    function scheduleSuggest() {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(function () {
        var raw = searchInput.value.trim();
        if (raw.length < 1) hideSuggest();
        else {
          wikiEnsureCompendiumAutolink(function () {
            renderSuggest(raw);
          });
        }
      }, 90);
    }

    searchInput.addEventListener("input", scheduleSuggest);
    searchInput.addEventListener("focus", function () {
      wikiEnsureCompendiumAutolink();
      if (searchInput.value.trim()) scheduleSuggest();
    });
    searchInput.addEventListener("blur", function () {
      setTimeout(hideSuggest, 160);
    });

    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        hideSuggest();
        return;
      }
      if (!suggestEl || suggestEl.hidden || !lastHits.length) {
        if (e.key === "Enter") runGlobalSearch();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        var next = activeSuggest + 1;
        if (next >= lastHits.length) next = 0;
        setActiveSuggest(next);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        var prev = activeSuggest - 1;
        if (prev < 0) prev = lastHits.length - 1;
        setActiveSuggest(prev);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        runGlobalSearch();
      }
    });

    document.addEventListener("click", function (e) {
      var wrap = searchInput.parentElement;
      if (wrap && !wrap.contains(e.target)) hideSuggest();
    });

    var wrap = searchInput.parentElement;
    if (wrap && !document.getElementById("globalSearchBtn")) {
      wrap.classList.add("wiki-search-wrap");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = "globalSearchBtn";
      btn.className = "wiki-search-btn";
      btn.textContent = "搜索";
      btn.setAttribute("aria-label", "搜索");
      wrap.appendChild(btn);
      btn.addEventListener("click", runGlobalSearch);
    }
  }

  function scrollTopPosition() {
    return (
      window.scrollY ||
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0
    );
  }

  function scrollPageToTop() {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      window.scrollTo(0, 0);
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  (function applyDistributionNotice() {
    var legal =
      "玩家同人整理，非官方授权；图鉴由群友/解包数据整理，仅供查阅，请勿商用或二次售卖完整数据包/APK。";
    document.querySelectorAll(".wiki-footer").forEach(function (el) {
      if (el.getAttribute("data-wiki-legal") === "1") return;
      el.setAttribute("data-wiki-legal", "1");
      var p = el.querySelector("p");
      if (!p) {
        p = document.createElement("p");
        el.appendChild(p);
      }
      if (p.querySelector(".wiki-footer-legal")) return;
      var span = document.createElement("span");
      span.className = "wiki-footer-legal";
      span.textContent = legal;
      p.appendChild(span);
    });
    document.querySelectorAll(".sidebar-note").forEach(function (el) {
      if (el.getAttribute("data-wiki-legal") === "1") return;
      if ((el.textContent || "").indexOf("请勿商用") !== -1) return;
      el.setAttribute("data-wiki-legal", "1");
      el.textContent = (el.textContent || "").trim() + " · 请勿商用";
    });
  })();

  if (!document.getElementById("backToTop")) {
    var topBtn = document.createElement("button");
    topBtn.type = "button";
    topBtn.id = "backToTop";
    topBtn.className = "back-to-top";
    topBtn.setAttribute("aria-label", "回到顶部");
    topBtn.textContent = "顶部";
    document.body.appendChild(topBtn);
    topBtn.addEventListener("click", scrollPageToTop);

    function updateTopBtn() {
      topBtn.classList.toggle("visible", scrollTopPosition() > 320);
    }

    window.addEventListener("scroll", updateTopBtn, { passive: true });
    document.addEventListener("scroll", updateTopBtn, { passive: true });
    updateTopBtn();
  }

  var compendiumSearchIds = [
    "martialFilter",
    "internalFilter",
    "equipmentFilter",
    "characterFilter",
    "skillPageSearch",
  ];
  var onCompendiumPage = compendiumSearchIds.some(function (id) {
    return document.getElementById(id);
  });
  function loadWikiScript(file, onload) {
    var s = document.createElement("script");
    s.src = wikiScriptBase() + file;
    s.async = false;
    if (onload) s.onload = onload;
    document.body.appendChild(s);
  }

  if (document.querySelector(".guide-prose")) {
    loadWikiScript("js/guide-prose.js", function () {
      if (document.querySelector(".xuanwu-integrated-guide, .early-internal-guide")) {
        wikiEnsureCompendiumAutolink(function () {
          loadWikiScript("js/guide-compendium-links.js");
        });
      }
    });
  }

  if (
    document.querySelector("main .toc") &&
    document.querySelector(".full-guide-prose, .xuanwu-integrated-guide, .early-internal-guide")
  ) {
    loadWikiScript("js/guide-reading.js");
  }

  if (!onCompendiumPage) {
    var articleQ = new URLSearchParams(window.location.search).get("q");
    if (articleQ) {
      var article = document.querySelector(".searchable-article");
      if (article) {
        var nodes = article.querySelectorAll("h2, h3, h4, p, li, .weapon-entry");
        for (var i = 0; i < nodes.length; i++) {
          if ((nodes[i].textContent || "").indexOf(articleQ) !== -1) {
            nodes[i].classList.add("wiki-query-highlight");
            try {
              nodes[i].scrollIntoView({ block: "start", behavior: "smooth" });
            } catch (e) {
              nodes[i].scrollIntoView(true);
            }
            break;
          }
        }
      }
    }
  }

  (function initWikiEasterEgg() {
    if (document.getElementById("wikiEasterEggBite")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "wikiEasterEggBite";
    btn.className = "wiki-easter-egg-bite";
    btn.textContent = "咬咬？";
    btn.setAttribute("aria-label", "咬咬？");
    var reveal = document.createElement("div");
    reveal.className = "wiki-easter-egg-bite-reveal";
    reveal.hidden = true;
    reveal.textContent = "区区？！";
    btn.addEventListener("click", function () {
      reveal.hidden = false;
      btn.classList.add("is-open");
      window.setTimeout(function () {
        reveal.hidden = true;
        btn.classList.remove("is-open");
      }, 2200);
    });
    document.body.appendChild(btn);
    document.body.appendChild(reveal);
  })();

  // 2026-10-18 起本站转为「纯静态」：不再加载云服务，也不再挂登录 / 投稿 / 审核 / 纠错。
  //
  // 原因是云数据库按资源点计量，而旧实现里**每个游客打开任意一页**都会触发若干次查询
  // （applyApproved、loadEntryOverrides 等不看登录态直接发请求），3,000 点/月的免费额度
  // 很容易被吃光 —— 那正是整站登录与投稿同时瘫痪的根因。
  //
  // 现在只有「攻略大全」和「贡献者」两页需要本地渲染，才按需加载 wiki-collab.js；
  // 并且**不加载 wiki-cloud.js**，于是它内部的 boot() 会因为 window.WikiCloud 不存在
  // 直接 return，全程零云端请求。协作层代码原样保留，将来要恢复登录只需把这一段改回去。
  var COLLAB_VER = "20261018a";
  var needGuideLib = !!document.getElementById("guideLibList");
  var needContributors = !!document.getElementById("contributorList");
  if (needGuideLib || needContributors) {
    loadWikiScript("js/wiki-collab.js?v=" + COLLAB_VER, function () {
      var C = window.WikiCollab;
      if (!C) return;
      if (needGuideLib && typeof C.renderStaticGuides === "function") C.renderStaticGuides();
      if (needContributors && typeof C.renderStaticContributors === "function") {
        C.renderStaticContributors();
      }
    });
  }
})();
