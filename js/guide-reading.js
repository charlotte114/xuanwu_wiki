/** 长攻略：顶栏阅读进度 + 桌面端右侧 sticky 目录 */
(function () {
  var main = document.querySelector(".wiki-main");
  var toc = main && main.querySelector("nav.toc");
  var prose = document.querySelector(
    ".full-guide-prose, .xuanwu-integrated-guide, .early-internal-guide"
  );
  if (!main || !toc || !prose || main.getAttribute("data-guide-reading") === "1") return;
  main.setAttribute("data-guide-reading", "1");

  var progress = document.createElement("div");
  progress.className = "guide-read-progress";
  progress.setAttribute("aria-hidden", "true");
  var progressBar = document.createElement("span");
  progress.appendChild(progressBar);
  document.body.appendChild(progress);

  function updateProgress() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    var pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    progressBar.style.width = Math.min(100, Math.max(0, pct)) + "%";
  }

  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  var bodyWrap = document.createElement("div");
  bodyWrap.className = "guide-layout-body";
  while (main.firstChild) bodyWrap.appendChild(main.firstChild);
  main.appendChild(bodyWrap);

  var rail = document.createElement("aside");
  rail.className = "guide-toc-rail";
  rail.setAttribute("aria-label", "文章目录");
  var railTitle = document.createElement("strong");
  railTitle.className = "guide-toc-rail-title";
  railTitle.textContent = "目录";
  rail.appendChild(railTitle);
  var railList = document.createElement("ul");
  railList.className = "guide-toc-rail-list";

  var tocLinks = toc.querySelectorAll('a[href^="#"]');
  var sectionEls = [];
  tocLinks.forEach(function (a) {
    var id = (a.getAttribute("href") || "").slice(1);
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;
    sectionEls.push(target);
    var li = document.createElement("li");
    var link = document.createElement("a");
    link.href = "#" + id;
    link.textContent = a.textContent || id;
    link.addEventListener("click", function (e) {
      e.preventDefault();
      try {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        target.scrollIntoView(true);
      }
      history.replaceState(null, "", "#" + id);
    });
    li.appendChild(link);
    railList.appendChild(li);
  });
  rail.appendChild(railList);
  main.classList.add("has-guide-toc-rail");
  main.appendChild(rail);

  var railAnchors = railList.querySelectorAll("a");

  function setActiveRail(id) {
    railAnchors.forEach(function (link) {
      var on = (link.getAttribute("href") || "") === "#" + id;
      link.classList.toggle("is-active", on);
    });
  }

  if (sectionEls.length && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        var visible = entries
          .filter(function (e) {
            return e.isIntersecting;
          })
          .sort(function (a, b) {
            return a.boundingClientRect.top - b.boundingClientRect.top;
          });
        if (visible[0] && visible[0].target.id) {
          setActiveRail(visible[0].target.id);
        }
      },
      {
        rootMargin: "-20% 0px -65% 0px",
        threshold: 0,
      }
    );
    sectionEls.forEach(function (el) {
      observer.observe(el);
    });
  }
})();
