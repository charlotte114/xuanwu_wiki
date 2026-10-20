/**
 * 图鉴 sticky 筛选栏：顶栏收起/展开；向下滚动时自动收起，避免挡住列表。
 */
(function () {
  var SCROLL_COLLAPSE_PX = 72;
  var SCROLL_DELTA = 28;

  function setCollapsed(root, collapsed) {
    root.classList.toggle("is-collapsed", collapsed);
    var btn = root.querySelector(".compendium-toolbar-toggle");
    if (btn) {
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.textContent = collapsed ? "展开筛选" : "收起筛选";
    }
  }

  function bindSummary(root) {
    var countEl = root.querySelector(
      ".martial-count, .skill-count, #characterCount, #skillCount"
    );
    var sumEl = root.querySelector(".compendium-toolbar-summary");
    if (!countEl || !sumEl) return;
    function sync() {
      var t = (countEl.textContent || "").trim();
      sumEl.textContent = t;
    }
    sync();
    if (typeof MutationObserver !== "undefined") {
      var mo = new MutationObserver(sync);
      mo.observe(countEl, { childList: true, characterData: true, subtree: true });
    }
  }

  function initToolbar(root) {
    if (!root || root.dataset.toolbarInit === "1") return;
    root.dataset.toolbarInit = "1";

    var panel = document.createElement("div");
    panel.className = "compendium-toolbar-panel";
    while (root.firstChild) {
      panel.appendChild(root.firstChild);
    }

    var compact = document.createElement("div");
    compact.className = "compendium-toolbar-compact";
    compact.innerHTML =
      '<span class="compendium-toolbar-hint">筛选</span>' +
      '<span class="compendium-toolbar-summary" aria-live="polite"></span>' +
      '<button type="button" class="compendium-toolbar-toggle" aria-expanded="true">收起筛选</button>';

    root.appendChild(compact);
    root.appendChild(panel);
    root.classList.add("compendium-toolbar-root");

    bindSummary(root);

    var btn = compact.querySelector(".compendium-toolbar-toggle");
    var userPinnedOpen = false;
    var lastScrollY = window.scrollY || 0;

    btn.addEventListener("click", function () {
      var collapsed = root.classList.contains("is-collapsed");
      if (collapsed) {
        userPinnedOpen = true;
        setCollapsed(root, false);
        lastScrollY = window.scrollY || 0;
      } else {
        userPinnedOpen = false;
        setCollapsed(root, true);
      }
    });

    window.addEventListener(
      "scroll",
      function () {
        var y = window.scrollY || 0;
        if (y < SCROLL_COLLAPSE_PX) {
          if (root.classList.contains("is-collapsed") && !userPinnedOpen) {
            setCollapsed(root, false);
          }
          lastScrollY = y;
          return;
        }
        if (userPinnedOpen) {
          if (y - lastScrollY > SCROLL_DELTA) {
            userPinnedOpen = false;
          } else {
            lastScrollY = y;
            return;
          }
        }
        if (y - lastScrollY > SCROLL_DELTA && !root.classList.contains("is-collapsed")) {
          setCollapsed(root, true);
        }
        lastScrollY = y;
      },
      { passive: true }
    );
  }

  function init() {
    document.querySelectorAll(".compendium-sticky-toolbar").forEach(initToolbar);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
