(function () {
  var data = window.MAP_QUEST_DATA;
  var regionRoot = document.getElementById("mapQuestRegions");
  var panel = document.getElementById("mapQuestPanel");
  var titleEl = document.getElementById("mapQuestPlaceTitle");
  var contentEl = document.getElementById("mapQuestContent");
  if (!data || !regionRoot || !panel || !titleEl || !contentEl) return;

  var sectionById = Object.create(null);
  (data.sections || []).forEach(function (s) {
    sectionById[s.id] = s;
  });

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderFighterStats(fighters) {
    if (!fighters || !fighters.length) {
      return '<p class="muted">—</p>';
    }
    return fighters
      .map(function (f) {
        return (
          '<div class="map-dungeon-fighter">' +
          (fighters.length > 1
            ? '<div class="map-dungeon-fighter-name">' + escapeHtml(f.name) + "</div>"
            : "") +
          '<dl class="map-dungeon-floor-meta map-dungeon-fighter-meta">' +
          '<div class="map-dungeon-meta-item"><dt>血量</dt><dd>' +
          escapeHtml(f.hp != null ? f.hp : "—") +
          "</dd></div>" +
          '<div class="map-dungeon-meta-item"><dt>攻击</dt><dd>' +
          escapeHtml(f.power != null ? f.power : "—") +
          "</dd></div>" +
          '<div class="map-dungeon-meta-item map-dungeon-meta-skill"><dt>武功</dt><dd>' +
          escapeHtml(f.skill || "—") +
          "</dd></div>" +
          "</dl></div>"
        );
      })
      .join("");
  }

  function renderBossCard(opts) {
    var runMeta = "";
    if (opts.waves || opts.exp || opts.weaken) {
      runMeta =
        '<dl class="map-dungeon-floor-meta map-dungeon-run-meta">' +
        (opts.waves
          ? '<div class="map-dungeon-meta-item"><dt>波次</dt><dd>' +
            escapeHtml(opts.waves) +
            "</dd></div>"
          : "") +
        (opts.exp
          ? '<div class="map-dungeon-meta-item"><dt>经验</dt><dd>' +
            escapeHtml(opts.exp) +
            "</dd></div>"
          : "") +
        (opts.weaken
          ? '<div class="map-dungeon-meta-item map-dungeon-meta-weaken"><dt>削弱条件</dt><dd>' +
            escapeHtml(opts.weaken) +
            "</dd></div>"
          : "") +
        "</dl>";
    }
    var hpNoteRow = opts.hpNote
      ? '<div class="map-dungeon-meta-item"><dt>攻略血量</dt><dd>' +
        escapeHtml(opts.hpNote) +
        "</dd></div>"
      : "";
    return (
      '<article class="map-dungeon-floor"' +
      (opts.id ? ' id="' + escapeHtml(opts.id) + '"' : "") +
      ">" +
      '<div class="map-dungeon-floor-head">' +
      (opts.orderLabel
        ? '<span class="map-dungeon-floor-num">' + escapeHtml(opts.orderLabel) + "</span>"
        : "") +
      '<h4 class="map-dungeon-floor-boss">' +
      escapeHtml(opts.boss) +
      "</h4>" +
      (opts.tag
        ? '<p class="muted map-dungeon-boss-tag">' + escapeHtml(opts.tag) + "</p>"
        : "") +
      "</div>" +
      renderFighterStats(opts.fighters) +
      runMeta +
      '<dl class="map-dungeon-floor-meta map-dungeon-drop-meta">' +
      hpNoteRow +
      (opts.hideChest
        ? ""
        : '<div class="map-dungeon-meta-item"><dt>宝箱掉落</dt><dd>' +
          escapeHtml(opts.chestDrop || "无") +
          "</dd></div>") +
      '<div class="map-dungeon-meta-item map-dungeon-meta-drop"><dt>飘字掉落</dt><dd>' +
      escapeHtml(opts.textDrop || "—") +
      "</dd></div>" +
      (opts.mechanic
        ? '<div class="map-dungeon-meta-item map-dungeon-meta-mechanic"><dt>机制详解</dt><dd>' +
          escapeHtml(opts.mechanic) +
          "</dd></div>"
        : "") +
      "</dl></article>"
    );
  }

  function placeMatchesDungeon(place, d) {
    return d && (place.id === d.placeId || place.name === d.placeId);
  }

  function renderDungeonData(d) {
    if (!d) return "";
    var cards = "";
    if (d.floors && d.floors.length) {
      cards = d.floors
        .map(function (f) {
          return renderBossCard({
            id: "dungeon-floor-" + f.floor,
            orderLabel: "第 " + f.floor + " 关",
            boss: f.boss,
            fighters: [
              {
                name: f.boss,
                hp: f.hp,
                power: f.power,
                skill: f.skill,
              },
            ],
            chestDrop: "无",
            textDrop: f.drop,
          });
        })
        .join("");
    } else if (d.sections && d.sections.length) {
      cards = d.sections
        .map(function (sec) {
          var inner = (sec.bosses || [])
            .map(function (b) {
              var orderLabel =
                d.dungeonKind === "wulong"
                  ? "序号 " + b.order
                  : "BOSS " + b.order;
              return renderBossCard({
                id: "dungeon-boss-" + (d.placeId || "x") + "-" + b.order,
                orderLabel: orderLabel,
                boss: b.boss,
                fighters: b.fighters,
                chestDrop: b.chestDrop,
                textDrop: b.textDrop,
                mechanic: b.mechanic,
                hideChest: b.hideChest,
                waves: b.waves,
                exp: b.exp,
                weaken: b.weaken,
                hpNote: b.hpNote,
                tag: b.tag,
              });
            })
            .join("");
          return (
            '<div class="map-dungeon-section">' +
            '<h4 class="map-dungeon-section-title">' +
            escapeHtml(sec.title) +
            "</h4>" +
            '<div class="map-dungeon-list">' +
            inner +
            "</div></div>"
          );
        })
        .join("");
    }
    if (!cards) return "";
    var footnotes = (d.footnotes || [])
      .map(function (fn) {
        return '<li>' + escapeHtml(fn) + "</li>";
      })
      .join("");
    return (
      '<article class="map-dungeon-block">' +
      "<h3>" +
      escapeHtml(d.title || "副本") +
      "</h3>" +
      (d.note ? '<p class="muted map-dungeon-note">' + escapeHtml(d.note) + "</p>" : "") +
      (footnotes ? '<ul class="map-dungeon-footnotes muted">' + footnotes + "</ul>" : "") +
      (d.sections ? cards : '<div class="map-dungeon-list">' + cards + "</div>") +
      "</article>"
    );
  }

  function renderIslandGuide(place) {
    var g = window.MAP_GUIDE_XUANWU_ISLAND;
    if (!placeMatchesDungeon(place, g)) {
      return { html: "", notes: [] };
    }
    var flowBody = (g.flow || [])
      .map(function (sec) {
        var paras = (sec.paragraphs || [])
          .map(function (p) {
            return '<p class="map-island-step">' + escapeHtml(p) + "</p>";
          })
          .join("");
        return (
          '<section class="map-island-flow-section" id="xuanwu-flow-' +
          escapeHtml(sec.id) +
          '">' +
          '<h4 class="map-dungeon-section-title">' +
          escapeHtml(sec.title) +
          "</h4>" +
          paras +
          "</section>"
        );
      })
      .join("");
    var flowHtml =
      '<article class="map-island-flow-block map-dungeon-block">' +
      "<h3>" +
      escapeHtml(g.flowTitle || "流程攻略") +
      "</h3>" +
      (g.flowNote
        ? '<p class="muted map-dungeon-note">' + escapeHtml(g.flowNote) + "</p>"
        : "") +
      flowBody +
      "</article>";
    var dropHtml = renderDungeonData({
      placeId: g.placeId,
      title: g.dropTitle || "掉落一览",
      note: g.dropNote,
      footnotes: g.footnotes,
      sections: g.sections,
    });
    var notes = [];
    if (g.source) notes.push("来源：" + g.source);
    if (g.dropNote) notes.push(g.dropNote);
    return { html: flowHtml + dropHtml, notes: notes };
  }

  function renderPlaceDungeons(place) {
    var island = renderIslandGuide(place);
    var sources = [
      window.MAP_DUNGEON_LUOHAN,
      window.MAP_DUNGEON_MINGLI,
      window.MAP_DUNGEON_WULONG,
      window.MAP_DUNGEON_BAIHU,
      window.MAP_DUNGEON_FENGMING,
      window.MAP_DUNGEON_WUJIAN,
      window.MAP_DUNGEON_HUALUNJIAN,
    ];
    var html = "";
    var notes = [];
    sources.forEach(function (d) {
      if (!placeMatchesDungeon(place, d)) return;
      html += renderDungeonData(d);
      if (d.note) notes.push(d.note);
    });
    return {
      html: island.html + html,
      notes: island.notes.concat(notes),
    };
  }

  function formatParagraph(p) {
    var t = escapeHtml(p);
    if (/^支线\d*[：:]/.test(p) || /^支线任务/.test(p)) {
      return '<p class="map-quest-side">' + t + "</p>";
    }
    if (/^①|^②|^③|^④/.test(p) || /^分支[一二]/.test(p)) {
      return '<p class="map-quest-sub">' + t + "</p>";
    }
    return "<p>" + t + "</p>";
  }

  function renderPlace(place) {
    if (!place) return;
    var dungeonPack = renderPlaceDungeons(place);
    var dungeonHtml = dungeonPack.html;
    var hasIsland =
      window.MAP_GUIDE_XUANWU_ISLAND &&
      placeMatchesDungeon(place, window.MAP_GUIDE_XUANWU_ISLAND);
    titleEl.textContent =
      place.name +
      (hasIsland ? " · 流程 / 掉落" : dungeonHtml ? " · 副本" : "") +
      " · 主线 / 支线（原版）";
    var html = dungeonHtml;
    var ids = place.sectionIds || [];
    if (!ids.length && !dungeonHtml) {
      html =
        '<p class="muted">该地点在《江湖风云录原版攻略大全》剧情篇中暂无独立章节；门派武功、副本等可在 <a href="../articles/full-guide-xuanwu.html">玄武版全攻略</a> 查阅。</p>';
    } else if (ids.length) {
      ids.forEach(function (sid) {
        var sec = sectionById[sid];
        if (!sec) return;
        html += '<article class="map-quest-block" id="quest-' + escapeHtml(sec.id) + '">';
        html += "<h3>" + escapeHtml(sec.title) + "</h3>";
        html += '<div class="map-quest-body">';
        (sec.paragraphs || []).forEach(function (p) {
          html += formatParagraph(p);
        });
        html += "</div></article>";
      });
    }
    if (dungeonPack.notes.length) {
      html +=
        '<p class="map-quest-source muted">副本数据：' +
        escapeHtml(dungeonPack.notes.join(" ")) +
        "</p>";
    }
    if (ids.length) {
      html +=
        '<p class="map-quest-source muted">剧情来源：' + escapeHtml(data.source || "") + "</p>";
    } else if (!dungeonHtml) {
      html +=
        '<p class="map-quest-source muted">来源：' + escapeHtml(data.source || "") + "</p>";
    }
    contentEl.innerHTML = html;
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    document.querySelectorAll(".map-place-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-place-id") === place.id);
    });
    if (history.replaceState) {
      var url = new URL(window.location.href);
      url.searchParams.set("place", place.name);
      history.replaceState(null, "", url.pathname + url.search);
    }
  }

  function buildRegions() {
    var byRegion = Object.create(null);
    (data.places || []).forEach(function (p) {
      if (!byRegion[p.region]) byRegion[p.region] = [];
      byRegion[p.region].push(p);
    });
    var frag = document.createDocumentFragment();
    Object.keys(byRegion).forEach(function (region) {
      var card = document.createElement("section");
      card.className = "wiki-card map-region-card";
      var h2 = document.createElement("h2");
      h2.id = "map-region-" + region;
      h2.textContent = region;
      card.appendChild(h2);
      var grid = document.createElement("div");
      grid.className = "map-city-grid";
      byRegion[region].forEach(function (place) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "map-place-btn";
        btn.setAttribute("data-place-id", place.id);
        btn.textContent = place.name;
        btn.addEventListener("click", function () {
          renderPlace(place);
        });
        grid.appendChild(btn);
      });
      card.appendChild(grid);
      frag.appendChild(card);
    });
    regionRoot.textContent = "";
    regionRoot.appendChild(frag);
  }

  buildRegions();

  var q = new URLSearchParams(window.location.search).get("place");
  if (q) {
    var hit = (data.places || []).find(function (p) {
      return p.name === q || p.id === q;
    });
    if (hit) renderPlace(hit);
  }
})();
