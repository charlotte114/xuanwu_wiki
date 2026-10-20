(function () {
  var mount = document.getElementById("wikiNav");
  if (!mount) return;

  var depth = parseInt(document.body.getAttribute("data-wiki-depth") || "0", 10);
  var active = mount.getAttribute("data-active") || "";
  var prefix = depth === 0 ? "" : depth === 1 ? "../" : "../../";

  var guides = [
    { id: "full-guide", label: "玄武版全攻略", href: "articles/full-guide-xuanwu.html" },
    { id: "integrated-guide", label: "玄武攻略整合", href: "articles/xuanwu-integrated-guide.html" },
    { id: "beginner", label: "开局入门到精通", href: "articles/beginner-master.html" },
    { id: "early-internal", label: "前期内功推荐", href: "articles/early-internal-guide-206.html" },
    { id: "weapons", label: "武器获取 2.06", href: "articles/weapons-xuanwu-206.html" },
  ];

  var compendium = [
    { id: "compendium-characters", label: "角色图鉴", href: "pages/compendium/characters.html" },
    { id: "compendium-skills", label: "武功图鉴", href: "pages/compendium/skills.html" },
    { id: "compendium-arts", label: "技艺图鉴", href: "pages/compendium/arts.html" },
    { id: "compendium-internal", label: "内功图鉴", href: "pages/compendium/internal.html" },
    { id: "compendium-equipment", label: "装备图鉴", href: "pages/compendium/equipment.html" },
  ];

  function link(href, label, id, extra) {
    var cls = "nav-link" + (active === id ? " active" : "") + (extra ? " " + extra : "");
    return '<a class="' + cls + '" href="' + prefix + href + '">' + label + "</a>";
  }

  var html = '<p class="nav-section">导航</p>';
  html += link("index.html", "首页", "home");
  // 「攻略大全」是全站唯一的攻略入口：静态攻略与玩家投稿都在这一页，
  // 不再单开「玩家攻略」一项（它已并入攻略大全）。
  html += link("pages/guide-list.html", "攻略大全", "guide-list");
  html += link("pages/map.html", "世界地图", "map");
  html += link("pages/compendium.html", "图鉴", "compendium");
  html += link("pages/panel-attack.html", "面板攻击", "panel-attack");
  // 2026-10-18 转纯静态：投稿入口已关闭，导航里不再露出「投稿攻略」；
  // 「贡献者」保留，那一页现在只按攻略大全的作者静态生成，不连库。
  html += link("pages/contributors.html", "贡献者", "contributors");
  html += '<p class="nav-section">攻略</p>';
  guides.forEach(function (g) {
    html += link(g.href, g.label, g.id);
  });
  if (active.indexOf("compendium") === 0 && active !== "compendium") {
    html += '<p class="nav-section">图鉴分类</p>';
    compendium.forEach(function (c) {
      html += link(c.href, c.label, c.id);
    });
  }

  mount.innerHTML = html;
})();
