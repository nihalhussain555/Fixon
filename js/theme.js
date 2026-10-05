/* Loaded synchronously in <head> so the saved theme is applied before paint.
 * Dark is the FIXON default; light is opt-in and remembered per visitor.
 * Also flags reduced-motion preferences on <html> before any animation runs. */
(function () {
  var root = document.documentElement;
  var stored = null;
  try {
    stored = localStorage.getItem("fixon_theme");
  } catch (e) {
    /* private mode / file restrictions: fall back to the default */
  }
  var prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  var theme = stored === "light" || stored === "dark" ? stored : prefersLight ? "light" : "dark";
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  root.classList.add("js");
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.setAttribute("data-motion", "reduced");
  }
})();
