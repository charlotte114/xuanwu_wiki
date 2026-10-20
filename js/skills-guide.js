(function () {
  var data = window.SKILLS_GUIDE_DATA || [];
  var listEl = document.getElementById("skillCardList");
  var countEl = document.getElementById("skillCount");
  var filterBtns = document.querySelectorAll("[data-skill-filter]");
  var pageSearch = document.getElementById("skillPageSearch");
  var currentFilter = "all";

  if (!listEl) return;

  function catLabel(item) {
    if (item.roleTag) return item.roleTag;
    var map = {
      role: "主角",
      partner: "伙伴增幅",
      team: "全队增益",
      debuff: "负面",
    };
    return map[item.cat] || item.cat;
  }

  function render() {
    var q = (pageSearch && pageSearch.value.trim().toLowerCase()) || "";
    var items = data.filter(function (item) {
      if (currentFilter !== "all" && item.cat !== currentFilter) return false;
      if (!q) return true;
      var hay = (item.name + item.attr + item.obtain).toLowerCase();
      return hay.indexOf(q) !== -1;
    });

    listEl.innerHTML = items
      .map(function (item) {
        var attr = item.attr;
        var attrRow =
          attr && attr !== "无"
            ? '<p class="skill-attr"><strong>属性</strong> ' + escapeHtml(attr) + "</p>"
            : "";
        return (
          '<article class="skill-card skill-cat-' +
          item.cat +
          '" data-cat="' +
          item.cat +
          '">' +
          '<header class="skill-card-head">' +
          '<h3 class="skill-name">' +
          escapeHtml(item.name) +
          "</h3>" +
          '<span class="skill-cat-tag">' +
          escapeHtml(catLabel(item)) +
          "</span>" +
          "</header>" +
          attrRow +
          '<p class="skill-obtain"><strong>获取</strong> ' +
          escapeHtml(item.obtain || "—") +
          "</p>" +
          "</article>"
        );
      })
      .join("");

    if (countEl) {
      countEl.textContent = "共 " + items.length + " 项";
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      filterBtns.forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-skill-filter") || "all";
      render();
    });
  });

  if (pageSearch) {
    pageSearch.addEventListener("input", render);
  }

  render();
  if (window.wikiApplyCompendiumQuery) window.wikiApplyCompendiumQuery("skillPageSearch");
})();
