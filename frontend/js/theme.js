(function () {
  var KEY = "yugem-theme",
    root = document.documentElement;
  function apply(t) {
    root.setAttribute("data-theme", t);
    var b = document.getElementById("themeToggle");
    if (b) b.innerHTML = t === "light" ? "🌙 Dark" : "☀️ Light";
  }
  apply(localStorage.getItem(KEY) || "dark");
  document.addEventListener("DOMContentLoaded", function () {
    var b = document.createElement("button");
    b.id = "themeToggle";
    b.type = "button";
    b.className = "theme-toggle";
    b.title = "Switch theme";
    b.onclick = function () {
      var t = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      localStorage.setItem(KEY, t);
      apply(t);
    };
    document.body.appendChild(b);
    apply(root.getAttribute("data-theme"));
  });
})();
