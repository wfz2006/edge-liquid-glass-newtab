/* Move draggable glass through layout offsets. Applying transform to the same
   element as an SVG backdrop-filter can leave stale compositor samples. */
(function (global) {
  "use strict";

  global.LGDragPosition = {
    apply: function (el, x, y) {
      if (!el) return;
      el.style.transform = "";
      el.style.left = Number(x || 0) + "px";
      el.style.top = Number(y || 0) + "px";
    }
  };
})(window);
