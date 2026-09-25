(function () {
  "use strict";
  var form = document.getElementById("searchForm");
  if (!form || !window.ResizeObserver) return;
  // CSS 尺寸过渡的每帧同步局部贴图，避免舒展时沿用旧尺寸的折射边缘。
  // 只观察表面本身；绝对定位的光学子层更新不会改变它的布局尺寸。
  new ResizeObserver(function () {
    if (form.__lgId && window.LiquidGlass) window.LiquidGlass.refresh([form]);
  }).observe(form);
})();
