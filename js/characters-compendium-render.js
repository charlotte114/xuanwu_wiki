(function () {
  var listEl = document.getElementById("characterCardList");
  var countEl = document.getElementById("characterCount");
  var list = window.CHARACTER_COMPENDIUM || [];
  var filterInput = document.getElementById("characterFilter");
  var typeBtns = document.querySelectorAll("[data-char-martial-filter]");
  var assetBase = "../../";
  var currentType = "all";

  if (!listEl || !list.length) return;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtNum(v) {
    if (v == null) return "—";
    var n = Number(v);
    if (Number.isNaN(n)) return "—";
    var s = n.toFixed(2).replace(/\.?0+$/, "");
    return s;
  }

  function martialTag(c) {
    var t = c.martialType || "";
    if (!t) return "";
    var cls = "char-martial-tag";
    if (t === "拳") cls += " char-martial-fist";
    else if (t === "剑") cls += " char-martial-sword";
    else if (t === "刀") cls += " char-martial-blade";
    else if (t === "主角" || t === "自选") cls += " char-martial-any";
    var label = t === "主角" || t === "自选" ? "主角" : t + "法";
    return '<span class="' + cls + '">' + escapeHtml(label) + "</span>";
  }

  function avatarHtml(c) {
    if (c.image && !c.wikiOnly) {
      var img = assetBase + c.image;
      return (
        '<img class="char-compendium-avatar" src="' +
        escapeHtml(img) +
        '" alt="' +
        escapeHtml(c.name) +
        '" loading="lazy" width="40" height="40" />'
      );
    }
    var initial = (c.name || "?").charAt(0);
    return '<div class="char-compendium-avatar char-avatar-placeholder">' + escapeHtml(initial) + "</div>";
  }

  function matchType(c) {
    if (currentType === "all") return true;
    if (currentType === "主角") {
      return c.martialType === "主角" || c.martialType === "自选";
    }
    return c.martialType === currentType;
  }

  function render() {
    var q = (filterInput && filterInput.value.trim().toLowerCase()) || "";
    var items = list.filter(function (c) {
      if (!matchType(c)) return false;
      if (!q) return true;
      var hay =
        (c.name || "") +
        " " +
        (c.gameName || "") +
        " " +
        (c.personalityName || "") +
        " " +
        (c.personalityDesc || "") +
        " " +
        (c.talentWiki || "") +
        " " +
        (c.obtain || "") +
        " " +
        (c.martialType || "") +
        " " +
        (c.growth || "");
      return hay.toLowerCase().indexOf(q) !== -1;
    });

    listEl.innerHTML = items
      .map(function (c, i) {
        var persBlock =
          c.personalityName || c.personalityDesc
            ? '<p class="char-compact-line char-personality-line">' +
              '<span class="char-label">天赋描述</span> ' +
            (c.personalityName
              ? '<strong class="char-personality-name">' + escapeHtml(c.personalityName) + "</strong> "
              : "") +
              (c.personalityDesc ? escapeHtml(c.personalityDesc) : "") +
              "</p>"
            : "";
        var talentBlock = c.talentWiki
          ? '<p class="char-compact-line char-talent-line">' +
            '<span class="char-label">天赋</span> ' +
            escapeHtml(c.talentWiki) +
            "</p>"
          : "";
        var obtainBlock = c.obtain
          ? '<p class="char-compact-line char-obtain-line">' +
            '<span class="char-label">入队</span> ' +
            escapeHtml(c.obtain) +
            "</p>"
          : "";

        return (
          '<article class="martial-card char-compendium-card">' +
          '<div class="char-card-head">' +
          '<div class="char-card-avatar-wrap">' +
          avatarHtml(c) +
          "</div>" +
          '<div class="char-card-title">' +
          '<div class="char-title-row">' +
          '<h3 class="martial-name char-card-name">' +
          escapeHtml(c.name) +
          "</h3>" +
          martialTag(c) +
          '<span class="char-growth-inline">血量成长 ' +
          fmtNum(c.hpXZ) +
          " · 攻击成长 " +
          fmtNum(c.powerXZ) +
          "</span>" +
          "</div>" +
          '<div class="char-card-details">' +
          persBlock +
          talentBlock +
          obtainBlock +
          "</div>" +
          "</div>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");

    if (countEl) {
      countEl.textContent = "共 " + items.length + " 名";
    }
  }

  typeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      typeBtns.forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      currentType = btn.getAttribute("data-char-martial-filter") || "all";
      render();
    });
  });

  if (filterInput) filterInput.addEventListener("input", render);
  render();
  if (window.wikiApplyCompendiumQuery) window.wikiApplyCompendiumQuery("characterFilter");
})();
