(function () {
  var listEl = document.getElementById("internalCardList");
  var countEl = document.getElementById("internalCount");
  var data = window.INTERNAL_COMPENDIUM || [];
  var starBtns = document.querySelectorAll("[data-internal-star]");
  var searchInput = document.getElementById("internalFilter");
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

  function termsHtml(item, cardIndex) {
    var terms = item.terms || [];
    if (!terms.length) {
      return '<p class="muted martial-no-eff">无词条</p>';
    }
    return (
      '<ol class="martial-effect-list">' +
      terms
        .map(function (eff, i) {
          return (
            '<li class="martial-effect-item" style="animation-delay:' +
            (cardIndex * 0.04 + i * 0.06) +
            's">' +
            '<div class="martial-effect-head">' +
            '<span class="martial-effect-name">' +
            escapeHtml(eff.name || "—") +
            "</span>" +
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

  function goodSkillsHtml(item) {
    var pairs = item.goodSkills || [];
    if (!pairs.length) {
      return '<p class="muted martial-no-eff">无</p>';
    }
    return (
      '<ul class="internal-goodskill-list">' +
      pairs
        .map(function (p) {
          return (
            "<li><span class=\"internal-goodskill-name\">" +
            escapeHtml(p.skillName) +
            "</span> <span class=\"internal-goodskill-bonus\">" +
            escapeHtml(p.text) +
            "</span></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function starBadge(item) {
    if (item.starLabel === "?" || item.star == null || item.star < 0) {
      return '<span class="martial-star martial-star-unknown">?</span>';
    }
    var cls = "martial-star martial-star-" + item.star;
    return (
      '<span class="' +
      cls +
      '" title="品阶 ' +
      escapeHtml(item.starLabel) +
      '">' +
      escapeHtml(item.starLabel) +
      "</span>"
    );
  }

  function matchStar(item) {
    if (currentStar === "all") return true;
    if (currentStar === "?") {
      return item.starLabel === "?" || item.star === 0 || item.star < 0;
    }
    if (currentStar === "S") return item.star === 6;
    var letter = { C: 3, B: 4, A: 5 }[currentStar];
    if (letter !== undefined) return item.star === letter;
    return item.starLabel === currentStar;
  }

  function render() {
    var q = (searchInput && searchInput.value.trim().toLowerCase()) || "";
    var items = data.filter(function (item) {
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
        (item.starLabel || "") +
        " " +
        (item.obtain || "");
      (item.terms || []).forEach(function (e) {
        hay += " " + (e.name || "") + " " + (e.desc || "") + " " + (e.valueText || "");
      });
      (item.goodSkills || []).forEach(function (g) {
        hay += " " + g.skillName + " " + g.text;
      });
        (item.preSkills || []).forEach(function (p) {
        hay += " " + p.name;
      });
      if (item.specialNote) hay += " " + item.specialNote;
      return hay.toLowerCase().indexOf(q) !== -1;
    });

    listEl.innerHTML = items
      .map(function (item, cardIndex) {
        var preLine =
          item.preSkills && item.preSkills.length
            ? '<p class="internal-pre-line"><span class="internal-pre-label">前置内功</span> ' +
              preSkillsHtml(item.preSkills) +
              "</p>"
            : "";
        var goodBlock =
          item.goodSkills && item.goodSkills.length
            ? '<div class="martial-effects-wrap internal-goodskills-wrap">' +
              '<h4 class="martial-effects-title">配武功加成</h4>' +
              goodSkillsHtml(item) +
              "</div>"
            : "";
        return (
          '<article class="martial-card martial-type-internal internal-neigong-card martial-animate-in" style="animation-delay:' +
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
          '<span class="martial-type-tag">内功</span>' +
          "</header>" +
          (item.summary
            ? '<p class="martial-summary internal-neigong-summary">' +
              escapeHtml(item.summary) +
              "</p>"
            : "") +
          (item.specialNote
            ? '<p class="internal-special-note"><strong>特殊</strong> ' +
              escapeHtml(item.specialNote) +
              "</p>"
            : "") +
          (item.itemDesp
            ? '<p class="internal-manual-desp">' + escapeHtml(item.itemDesp) + "</p>"
            : "") +
          obtainHtml(item) +
          '<div class="martial-effects-wrap">' +
          '<h4 class="martial-effects-title">词条（满 9 级合计）</h4>' +
          termsHtml(item, cardIndex) +
          "</div>" +
          goodBlock +
          "</article>"
        );
      })
      .join("");

    if (countEl) countEl.textContent = "共 " + items.length + " 部";
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

  bindFilter(starBtns, "data-internal-star", function (v) {
    currentStar = v;
  });
  if (searchInput) searchInput.addEventListener("input", render);
  render();
  if (window.wikiApplyCompendiumQuery) window.wikiApplyCompendiumQuery("internalFilter");
})();
