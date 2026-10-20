/** 首页 Hero：随机图鉴一条（懒加载 compendium-autolink.js） */
(function () {
  var el = document.getElementById("heroSpotlight");
  if (!el) return;

  function render() {
    if (!window.COMPENDIUM_AUTOLINK || !COMPENDIUM_AUTOLINK.length) return;
    var pool = COMPENDIUM_AUTOLINK.filter(function (e) {
      return e.url && e.url.indexOf("compendium/") !== -1;
    });
    if (!pool.length) pool = COMPENDIUM_AUTOLINK;
    var pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) return;
    var href = pick.url;
    if (pick.q) {
      href += (href.indexOf("?") >= 0 ? "&" : "?") + "q=" + encodeURIComponent(pick.q);
    }
    el.innerHTML =
      '今日一查：<a href="' +
      href +
      '">' +
      pick.name +
      "</a> · 顶栏搜索可直达图鉴";
    el.hidden = false;
  }

  if (window.wikiEnsureCompendiumAutolink) {
    window.wikiEnsureCompendiumAutolink(render);
  } else {
    render();
  }
})();
