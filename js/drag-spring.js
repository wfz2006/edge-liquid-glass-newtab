/* Small damped release motion for draggable cards. Keep movement in x/y data;
   callers remain responsible for applying it with left/top on filtered glass. */
(function (global) {
  "use strict";

  var STIFFNESS = 0.22;
  var DAMPING = 0.80;
  var REST_DISTANCE = 0.15;
  var REST_SPEED = 0.15;

  global.LGDragSpring = {
    release: function (state, vx, vy) {
      if (!state) return;
      state.vx = Number(vx || 0) * 0.6;
      state.vy = Number(vy || 0) * 0.6;
    },
    step: function (state) {
      if (!state) return 0;
      var px = state.cx;
      var py = state.cy;
      state.vx = (state.vx + (state.tx - state.cx) * STIFFNESS) * DAMPING;
      state.vy = (state.vy + (state.ty - state.cy) * STIFFNESS) * DAMPING;
      state.cx += state.vx;
      state.cy += state.vy;
      return Math.hypot(state.cx - px, state.cy - py);
    },
    atRest: function (state, speed) {
      if (!state) return true;
      return Math.abs(state.tx - state.cx) < REST_DISTANCE &&
        Math.abs(state.ty - state.cy) < REST_DISTANCE &&
        speed < REST_SPEED;
    }
  };
})(window);
