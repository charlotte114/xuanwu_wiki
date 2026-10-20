(function () {
  var table = document.getElementById("compendiumTable");
  if (!table || !window.COMPENDIUM) return;
  var kind = table.getAttribute("data-kind");
  var rows = window.COMPENDIUM[kind];
  if (!rows) return;
  var tbody = table.querySelector("tbody");
  if (!tbody) return;
  tbody.innerHTML = rows
    .map(function (r) {
      return (
        "<tr>" +
        r.map(function (c) {
          return "<td>" + escapeHtml(c) + "</td>";
        }).join("") +
        "</tr>"
      );
    })
    .join("");

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
})();
