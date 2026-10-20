(function () {
  var listEl = document.getElementById("equipmentCardList");
  var countEl = document.getElementById("equipmentCount");
  var raw = window.EQUIPMENT_COMPENDIUM || [];
  var typeBtns = document.querySelectorAll("[data-equip-filter]");
  var starBtns = document.querySelectorAll("[data-equip-star]");
  var searchInput = document.getElementById("equipmentFilter");
  var currentType = "all";
  var currentStar = "all";
  var variantIndex = {};

  if (!listEl || !raw.length) return;

  var QUALITY_ORDER = { 普通: 0, 精致: 1, 罕见: 2, 无双: 3 };

  /** desp 颜色码；特殊词缀与无双同色，门派词缀多为绿色 */
  var QUALITY_COLOR_BY_NAME = {
    普通: "919191",
    精致: "5ED1FF",
    罕见: "E500F1",
    无双: "ff8d30",
    沉寂: "ff8d30",
    复苏: "ff8d30",
    嗜血: "ff8d30",
    吞噬: "ff8d30",
    涅槃: "ff8d30",
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sortVariants(a, b) {
    var qa = QUALITY_ORDER[a.qualityName] != null ? QUALITY_ORDER[a.qualityName] : 99;
    var qb = QUALITY_ORDER[b.qualityName] != null ? QUALITY_ORDER[b.qualityName] : 99;
    if (qa !== qb) return qa - qb;
    return String(a.id).localeCompare(String(b.id));
  }

  function buildGroups() {
    var map = {};
    raw.forEach(function (item) {
      var name = item.name || item.id;
      if (!map[name]) {
        map[name] = { name: name, variants: [] };
      }
      map[name].variants.push(item);
    });
    return Object.keys(map)
      .map(function (name) {
        var g = map[name];
        g.variants.sort(sortVariants);
        var lead = g.variants[g.variants.length - 1];
        g.type = lead.type;
        g.typeLabel = lead.typeLabel;
        return g;
      })
      .sort(function (a, b) {
        var sa = Math.max.apply(
          null,
          a.variants.map(function (v) {
            return v.star;
          })
        );
        var sb = Math.max.apply(
          null,
          b.variants.map(function (v) {
            return v.star;
          })
        );
        if (sb !== sa) return sb - sa;
        return a.name.localeCompare(b.name, "zh-CN");
      });
  }

  var groups = buildGroups();

  function attrLine(obj) {
    if (!obj || !obj.text) return '<span class="muted">—</span>';
    return escapeHtml(obj.text);
  }

  // 同名不同品质共用一张卡，而条目改值只写在「第一条同名」上，
  // 所以展示时取组内第一个非空的获取，切品质也不会漏掉玩家补的内容。
  function groupObtain(group) {
    for (var i = 0; i < group.variants.length; i++) {
      var v = group.variants[i].obtain;
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return "";
  }

  // 「获取」是留给玩家的留白：没有就渲染成空槽，
  // 协作层会在空槽里挂一个「补充」入口（见 js/wiki-collab.js 的 decorateEntryCards）。
  function obtainHtml(value) {
    var v = value == null ? "" : String(value).trim();
    return (
      '<p class="martial-obtain' +
      (v ? "" : " is-empty") +
      '" data-wiki-slot="obtain" data-wiki-slot-label="获取">' +
      "<strong>获取</strong> " +
      (v ? escapeHtml(v) : '<span class="martial-obtain-blank">待补充</span>') +
      "</p>"
    );
  }

  function starBadge(item) {
    return (
      '<span class="equip-star">' + escapeHtml(item.starLabel) + "</span>"
    );
  }

  function itemQualityColor(item) {
    if (!item) return "";
    var hex = item.qualityColor ? String(item.qualityColor).replace(/^#/, "").trim() : "";
    if (!hex && item.qualityName && QUALITY_COLOR_BY_NAME[item.qualityName]) {
      hex = QUALITY_COLOR_BY_NAME[item.qualityName];
    }
    return hex ? "#" + hex : "";
  }

  function qualityBadgeStyle(color) {
    if (!color) return "";
    var c = escapeHtml(color);
    return "border-color:" + c + ";color:" + c;
  }

  function qualityBadge(item) {
    if (!item.qualityName) return "";
    var color = itemQualityColor(item);
    var style = color ? ' style="' + qualityBadgeStyle(color) + '"' : "";
    return (
      '<span class="equip-quality-badge"' +
      style +
      ">" +
      escapeHtml(item.qualityName) +
      "</span>"
    );
  }

  function variantSwitcher(group, activeIdx) {
    if (group.variants.length <= 1) return "";
    return (
      '<div class="equip-variant-switch" role="tablist" aria-label="品质切换">' +
      group.variants
        .map(function (v, idx) {
          var color = itemQualityColor(v);
          var style = color ? ' style="' + qualityBadgeStyle(color) + '"' : "";
          return (
            '<button type="button" class="equip-variant-btn' +
            (idx === activeIdx ? " active" : "") +
            '" role="tab" data-group="' +
            escapeHtml(group.name) +
            '" data-idx="' +
            idx +
            '"' +
            style +
            ">" +
            escapeHtml(v.qualityName || "品质" + (idx + 1)) +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function variantMatchesFilters(v) {
    if (currentType !== "all" && String(v.type) !== currentType) return false;
    if (!matchStar(v)) return false;
    return true;
  }

  function matchStar(item) {
    if (currentStar === "all") return true;
    var starByLetter = { "?": 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6 };
    var want = starByLetter[currentStar];
    if (want !== undefined) return item.star === want;
    return String(item.star) === currentStar;
  }

  function groupMatchesSearch(group, q) {
    if (!q) return true;
    var obtain = groupObtain(group);
    return group.variants.some(function (v) {
      var hay =
        group.name +
        " " +
        (v.flavor || "") +
        " " +
        (v.qualityName || "") +
        " " +
        (v.typeLabel || "") +
        " " +
        obtain;
      [v.mainAttr, v.subAttr].forEach(function (a) {
        if (a && a.text) hay += " " + a.text;
      });
      (v.enhanceAttrs || []).forEach(function (a) {
        if (a.text) hay += " " + a.text;
      });
      return hay.toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderCardBody(item, opts) {
    opts = opts || {};
    var enhance =
      item.enhanceAttrs && item.enhanceAttrs.length
        ? '<div class="equip-enhance-chips" role="list">' +
          item.enhanceAttrs
            .map(function (a) {
              return (
                '<span class="equip-enhance-chip" role="listitem">' +
                escapeHtml(a.text) +
                "</span>"
              );
            })
            .join("") +
          "</div>"
        : '<p class="muted equip-no-enhance">无强化词条</p>';

    return (
      '<div class="equip-card-body">' +
      '<div class="equip-card-top">' +
      '<img class="equip-icon" src="' +
      escapeHtml("../../" + item.image) +
      '" alt="" width="56" height="56" loading="lazy" />' +
      '<div class="equip-title-block">' +
      '<div class="equip-title-row">' +
      '<h3 class="martial-name">' +
      escapeHtml(item.name) +
      "</h3>" +
      '<div class="equip-title-badges">' +
      starBadge(item) +
      (opts.showQuality !== false ? qualityBadge(item) : "") +
      "</div></div>" +
      '<p class="equip-meta"><span class="martial-type-tag equip-type-tag">' +
      escapeHtml(item.typeLabel) +
      "</span>" +
      (item.money
        ? ' <span class="equip-money">售出 ' + escapeHtml(item.money) + " 银</span>"
        : "") +
      "</p>" +
      "</div></div>" +
      '<dl class="equip-attr-dl">' +
      "<div><dt>主属性</dt><dd>" +
      attrLine(item.mainAttr) +
      "</dd></div>" +
      "<div><dt>副属性</dt><dd>" +
      attrLine(item.subAttr) +
      "</dd></div>" +
      "</dl>" +
      obtainHtml(opts.obtain) +
      '<div class="equip-enhance-wrap">' +
      '<h4 class="martial-effects-title">强化词条</h4>' +
      enhance +
      "</div>" +
      (item.flavor
        ? '<p class="martial-summary equip-flavor">' + escapeHtml(item.flavor) + "</p>"
        : "") +
      "</div>"
    );
  }

  function render() {
    var q = (searchInput && searchInput.value.trim().toLowerCase()) || "";
    var visible = groups.filter(function (group) {
      if (!groupMatchesSearch(group, q)) return false;
      return group.variants.some(variantMatchesFilters);
    });

    listEl.innerHTML = visible
      .map(function (group, i) {
        var idx = variantIndex[group.name];
        if (idx == null || idx >= group.variants.length) idx = 0;
        var filtered = group.variants.filter(variantMatchesFilters);
        if (filtered.length) {
          var pick = filtered[0];
          for (var j = 0; j < group.variants.length; j++) {
            if (group.variants[j].id === pick.id) {
              idx = j;
              break;
            }
          }
        }
        variantIndex[group.name] = idx;
        var item = group.variants[idx];
        var multi = group.variants.length > 1;
        return (
          '<article class="equip-card' +
          (multi ? " equip-card-multi" : "") +
          " equip-type-" +
          item.type +
          ' martial-animate-in" style="animation-delay:' +
          i * 0.02 +
          's" data-equip-group="' +
          escapeHtml(group.name) +
          '">' +
          variantSwitcher(group, idx) +
          '<div class="equip-card-main">' +
          renderCardBody(item, { showQuality: !!item.qualityName, obtain: groupObtain(group) }) +
          "</div></article>"
        );
      })
      .join("");

    if (countEl) countEl.textContent = "共 " + visible.length + " 件";
  }

  listEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".equip-variant-btn");
    if (!btn || !listEl.contains(btn)) return;
    e.stopPropagation();
    var name = btn.getAttribute("data-group");
    var idx = parseInt(btn.getAttribute("data-idx"), 10);
    if (!name || isNaN(idx)) return;
    variantIndex[name] = idx;
    var card = btn.closest(".equip-card");
    var group = null;
    for (var gi = 0; gi < groups.length; gi++) {
      if (groups[gi].name === name) {
        group = groups[gi];
        break;
      }
    }
    if (!card || !group || !group.variants[idx]) return;
    card.querySelectorAll(".equip-variant-btn").forEach(function (b) {
      b.classList.toggle("active", b === btn);
    });
    var item = group.variants[idx];
    var body = card.querySelector(".equip-card-body");
    if (body) {
      body.outerHTML = renderCardBody(item, {
        showQuality: !!item.qualityName,
        obtain: groupObtain(group),
      });
    }
  });

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

  bindFilter(typeBtns, "data-equip-filter", function (v) {
    currentType = v;
  });
  bindFilter(starBtns, "data-equip-star", function (v) {
    currentStar = v;
  });
  if (searchInput) searchInput.addEventListener("input", render);
  render();
  if (window.wikiApplyCompendiumQuery) window.wikiApplyCompendiumQuery("equipmentFilter");
})();
