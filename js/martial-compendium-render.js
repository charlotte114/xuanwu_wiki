(function () {
  var listEl = document.getElementById("martialCardList");
  var countEl = document.getElementById("martialCount");
  var data = window.MARTIAL_COMPENDIUM || [];
  var typeBtns = document.querySelectorAll("[data-martial-filter]");
  var starBtns = document.querySelectorAll("[data-martial-star]");
  var searchInput = document.getElementById("martialFilter");
  var currentType = "all";
  var currentStar = "all";

  if (!listEl || !data.length) return;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function preSkillsHtml(pre) {
    if (!pre || !pre.length) return '<span class="muted">无</span>';
    return pre
      .map(function (p) {
        return escapeHtml(p.name);
      })
      .join("、");
  }

  // 「获取」是留给玩家的留白：数据里没有就渲染成空槽，
  // 协作层会在空槽里挂一个「补充」入口（见 js/wiki-collab.js 的 decorateEntryCards）。
  function obtainHtml(item) {
    var v = item.obtain == null ? "" : String(item.obtain).trim();
    return (
      '<p class="martial-obtain' +
      (v ? "" : " is-empty") +
      '" data-wiki-slot="obtain" data-wiki-slot-label="获取">' +
      "<strong>获取</strong> " +
      (v ? escapeHtml(v) : '<span class="martial-obtain-blank">待补充</span>') +
      "</p>"
    );
  }

  function movesHtml(item, cardIndex) {
    var moves = item.moves || [];
    if (!moves.length) {
      return '<p class="muted martial-no-eff">无招式描述</p>';
    }
    return (
      '<ol class="martial-effect-list">' +
      moves
        .map(function (eff, i) {
          var unlock =
            eff.unlock != null
              ? '<span class="martial-unlock">Lv.' + escapeHtml(eff.unlock) + "</span>"
              : "";
          return (
            '<li class="martial-effect-item" style="animation-delay:' +
            (cardIndex * 0.04 + i * 0.06) +
            's">' +
            '<div class="martial-effect-head">' +
            '<span class="martial-effect-name">' +
            escapeHtml(eff.name || "—") +
            "</span>" +
            unlock +
            "</div>" +
            (eff.desc
              ? '<p class="martial-effect-desc">' + escapeHtml(eff.desc) + "</p>"
              : "") +
            "</li>"
          );
        })
        .join("") +
      "</ol>"
    );
  }

  function starBadge(item) {
    if (item.star == null || item.star < 0) {
      return '<span class="martial-star martial-star-unknown">?</span>';
    }
    var label = item.starLabel || "?";
    var cls = "martial-star martial-star-" + item.star;
    return (
      '<span class="' +
      cls +
      '" title="品阶 ' +
      escapeHtml(label) +
      " · star " +
      item.star +
      '">' +
      escapeHtml(label) +
      "</span>"
    );
  }

  function pctFromRate(v) {
    if (v == null || v === "") return null;
    var n = Number(v);
    if (Number.isNaN(n)) return null;
    if (n === Math.round(n)) return String(Math.round(n)) + "%";
    return n + "%";
  }

  function pctFromCritMultiplier(v) {
    if (v == null || v === "") return null;
    var n = Number(v);
    if (Number.isNaN(n)) return null;
    var pct = n * 100;
    if (Math.abs(pct - Math.round(pct)) < 1e-6) return String(Math.round(pct)) + "%";
    return pct.toFixed(1).replace(/\.0$/, "") + "%";
  }

  function matchStar(item) {
    if (currentStar === "all") return true;
    var starByLetter = { "?": 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6 };
    var want = starByLetter[currentStar];
    if (want !== undefined) {
      if (currentStar === "?") {
        return item.star === 0 || item.star == null || item.star < 0;
      }
      return item.star === want;
    }
    return String(item.star) === currentStar;
  }

  function render() {
    var q = (searchInput && searchInput.value.trim().toLowerCase()) || "";
    var items = data.filter(function (item) {
      if (currentType !== "all" && String(item.type) !== currentType) return false;
      if (!matchStar(item)) return false;
      if (!q) return true;
      var hay =
        item.name +
        " " +
        (item.itemName || "") +
        " " +
        (item.summary || "") +
        " " +
        (item.itemDesp || "") +
        " " +
        (item.typeLabel || "") +
        " " +
        (item.starLabel || "") +
        " " +
        (item.obtain || "");
      (item.moves || []).forEach(function (e) {
        hay += " " + (e.name || "") + " " + (e.desc || "");
      });
      return hay.toLowerCase().indexOf(q) !== -1;
    });

    listEl.innerHTML = items
      .map(function (item, cardIndex) {
        var critPct = pctFromRate(item.baoji);
        var burstPct = pctFromCritMultiplier(item.baojiEffect);
        var preLine =
          item.preSkills && item.preSkills.length
            ? '<p class="internal-pre-line"><span class="internal-pre-label">前置武功</span> ' +
              preSkillsHtml(item.preSkills) +
              "</p>"
            : "";
        return (
          '<article class="martial-card martial-skill-card martial-type-' +
          item.type +
          ' martial-animate-in" style="animation-delay:' +
          cardIndex * 0.03 +
          's">' +
          '<header class="martial-card-head">' +
          "<div>" +
          '<div class="martial-title-row">' +
          '<h3 class="martial-name">' +
          escapeHtml(item.name) +
          "</h3>" +
          starBadge(item) +
          "</div>" +
          '<p class="martial-item">' +
          (item.itemName
            ? "秘籍：" + escapeHtml(item.itemName)
            : '<span class="muted">—</span>') +
          "</p>" +
          preLine +
          "</div>" +
          '<span class="martial-type-tag">' +
          escapeHtml(item.typeLabel) +
          "</span>" +
          "</header>" +
          (item.summary
            ? '<p class="martial-summary martial-skill-summary">' +
              escapeHtml(item.summary) +
              "</p>"
            : "") +
          (item.itemDesp && item.itemDesp !== item.summary
            ? '<p class="internal-manual-desp martial-manual-desp">' +
              escapeHtml(item.itemDesp) +
              "</p>"
            : "") +
          obtainHtml(item) +
          '<dl class="martial-stats">' +
          "<div><dt>威力</dt><dd>" +
          escapeHtml(item.power) +
          "</dd></div>" +
          "<div><dt>速度</dt><dd>" +
          escapeHtml(item.speed) +
          "</dd></div>" +
          "<div><dt>范围</dt><dd>" +
          escapeHtml(item.modeLabel) +
          "</dd></div>" +
          "<div><dt>破招</dt><dd>" +
          escapeHtml(item.sbGdLabel) +
          "</dd></div>" +
          "<div><dt>暴击</dt><dd>" +
          (critPct ? escapeHtml(critPct) : '<span class="muted">—</span>') +
          "</dd></div>" +
          "<div><dt>爆伤</dt><dd>" +
          (burstPct ? escapeHtml(burstPct) : '<span class="muted">—</span>') +
          "</dd></div>" +
          "</dl>" +
          '<div class="martial-effects-wrap">' +
          '<h4 class="martial-effects-title">招式</h4>' +
          movesHtml(item, cardIndex) +
          "</div>" +
          "</article>"
        );
      })
      .join("");

    if (countEl) {
      countEl.textContent = "共 " + items.length + " 部";
    }
  }

  function bindFilter(btns, attr, setter) {
    btns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        btns.forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");
        setter(btn.getAttribute(attr) || "all");
        render();
      });
    });
  }

  bindFilter(typeBtns, "data-martial-filter", function (v) {
    currentType = v;
  });
  bindFilter(starBtns, "data-martial-star", function (v) {
    currentStar = v;
  });

  if (searchInput) {
    searchInput.addEventListener("input", render);
  }

  render();
  if (window.wikiApplyCompendiumQuery) window.wikiApplyCompendiumQuery("martialFilter");
})();
