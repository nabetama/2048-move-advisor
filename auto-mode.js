(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.Auto2048 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const KEYBOARD_EVENTS = {
    up: { key: "ArrowUp", code: "ArrowUp" },
    right: { key: "ArrowRight", code: "ArrowRight" },
    down: { key: "ArrowDown", code: "ArrowDown" },
    left: { key: "ArrowLeft", code: "ArrowLeft" },
  };

  function keyboardEventForMove(move) {
    const event = KEYBOARD_EVENTS[move];
    if (!event) throw new Error(`Unknown move: ${move}`);
    return { ...event };
  }

  function createAutoController(options) {
    const dispatchMove = options.dispatchMove;
    const getBoardHash = options.getBoardHash;
    const onStateChange = options.onStateChange || function () {};
    const setTimer = options.setTimer || setTimeout;
    const clearTimer = options.clearTimer || clearTimeout;
    const delayMs = options.delayMs || 650;
    const watchdogMs = options.watchdogMs || 1200;
    let active = false;
    let actionTimer = null;
    let watchdogTimer = null;

    function clearTimers() {
      if (actionTimer !== null) clearTimer(actionTimer);
      if (watchdogTimer !== null) clearTimer(watchdogTimer);
      actionTimer = null;
      watchdogTimer = null;
    }

    function start() {
      if (active) return;
      active = true;
      onStateChange({ active: true, reason: null });
    }

    function stop(reason) {
      const wasActive = active;
      active = false;
      clearTimers();
      if (wasActive) onStateChange({ active: false, reason: reason || "manual" });
    }

    function boardChanged() {
      clearTimers();
    }

    function suggest(move, boardHash) {
      if (!active) return;
      clearTimers();
      actionTimer = setTimer(() => {
        actionTimer = null;
        if (!active) return;
        const currentHash = getBoardHash();
        if (currentHash === null) {
          stop("boardUnavailable");
          return;
        }
        if (currentHash !== boardHash) return;
        dispatchMove(move);
        watchdogTimer = setTimer(() => {
          watchdogTimer = null;
          if (!active) return;
          const watchedHash = getBoardHash();
          if (watchedHash === null) stop("boardUnavailable");
          else if (watchedHash === boardHash) stop("stalled");
        }, watchdogMs);
      }, delayMs);
    }

    return {
      boardChanged,
      isActive: () => active,
      start,
      stop,
      suggest,
    };
  }

  return { createAutoController, keyboardEventForMove };
});
