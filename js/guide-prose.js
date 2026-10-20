/** 攻略正文：品阶标签、提示框（不改 HTML 源文件） */
(function () {
  var root = document.querySelector(".guide-prose");
  if (!root || root.getAttribute("data-prose-enhanced") === "1") return;

  function mapTier(ch) {
    var t = ch === "？" ? "?" : ch.toLowerCase();
    if (t === "s" || t === "a" || t === "b" || t === "c" || t === "?") return t;
    return "other";
  }

  var h3Re = /^([?？]|[sabc])(.+?)([：:])(.*)$/;

  root.querySelectorAll("h3").forEach(function (h3) {
    var text = (h3.textContent || "").trim();
    var m = text.match(h3Re);
    if (!m) return;
    h3.textContent = "";
    var tier = document.createElement("span");
    tier.className = "guide-tier guide-tier--" + mapTier(m[1]);
    tier.textContent = m[1] === "？" ? "?" : m[1];
    h3.appendChild(tier);
    var name = document.createElement("span");
    name.className = "guide-entry-name";
    name.textContent = m[2];
    h3.appendChild(name);
    var colon = document.createElement("span");
    colon.className = "guide-entry-colon";
    colon.textContent = m[3];
    h3.appendChild(colon);
    if (m[4]) {
      var rest = document.createElement("span");
      rest.className = "guide-entry-rest";
      rest.textContent = m[4];
      h3.appendChild(rest);
    }
  });

  root.querySelectorAll("p").forEach(function (p) {
    if (p.closest(".guide-callout")) return;
    var text = (p.textContent || "").trim();
    if (!text) return;
    if (text.indexOf("※") === 0) {
      p.classList.add("guide-callout", "guide-callout--note");
    } else if (/^备注[：:]/.test(text)) {
      p.classList.add("guide-callout", "guide-callout--tip");
    } else if (/^(注意|谨慎)/.test(text)) {
      p.classList.add("guide-callout", "guide-callout--warn");
    } else if (/^当前版本[：:]/.test(text) || /^适用/.test(text)) {
      p.classList.add("guide-callout", "guide-callout--version");
    }
  });

  root.setAttribute("data-prose-enhanced", "1");
})();
