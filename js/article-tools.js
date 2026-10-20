(function () {
  var article = document.querySelector(".article-body.searchable-article, .article-body.guide-prose");
  if (!article) return;

  var header = document.querySelector(".article-header");
  if (header && !document.getElementById("articleSearch")) {
    var bar = document.createElement("div");
    bar.className = "article-toolbar";
    bar.innerHTML =
      '<input type="search" id="articleSearch" placeholder="在本篇搜索关键词…" aria-label="本篇搜索" />';
    header.insertAdjacentElement("afterend", bar);
  }

  var input = document.getElementById("articleSearch");
  if (input) {
    var nodes = article.querySelectorAll("p, li, h2, h3, h4, tr");
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      nodes.forEach(function (el) {
        if (!q) {
          el.classList.remove("search-hidden");
          return;
        }
        var show = (el.textContent || "").toLowerCase().indexOf(q) !== -1;
        el.classList.toggle("search-hidden", !show);
      });
    });
  }

})();
