/** 图鉴页 URL ?q= 预填搜索框 */
(function () {
  window.wikiApplyCompendiumQuery = function (inputId) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var q = new URLSearchParams(window.location.search).get("q");
    if (!q) return;
    input.value = q;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
})();
