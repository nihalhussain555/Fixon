/* Loaded synchronously in <head> so the saved theme is applied before paint.
 * Light is the FIXON default (white/purple/orange storefront); dark is
 * opt-in and remembered per visitor.
 * Also flags reduced-motion preferences on <html> before any animation runs. */
(function () {
  var root = document.documentElement;
  var stored = null;
  try {
    stored = localStorage.getItem("fixon_theme");
  } catch (e) {
    /* private mode / file restrictions: fall back to the default */
  }
  var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  var theme = stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light";
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  root.classList.add("js");
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.setAttribute("data-motion", "reduced");
  }
})();
