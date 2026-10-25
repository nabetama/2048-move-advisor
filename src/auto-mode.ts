import type { AutoController, AutoControllerOptions, AutoState, Direction, TimerId } from "./types";

  const KEYBOARD_EVENTS = {
    up: { key: "ArrowUp", code: "ArrowUp" },
    right: { key: "ArrowRight", code: "ArrowRight" },
    down: { key: "ArrowDown", code: "ArrowDown" },
    left: { key: "ArrowLeft", code: "ArrowLeft" },
  };

export function keyboardEventForMove(move: Direction): { key: string; code: string } {
    const event = KEYBOARD_EVENTS[move];
    if (!event) throw new Error(`Unknown move: ${move}`);
    return { ...event };
  }

export function createAutoController(options: AutoControllerOptions): AutoController {
    const dispatchMove = options.dispatchMove;
    const getBoardHash = options.getBoardHash;
    const onStateChange = options.onStateChange ?? (() => {});
    const setTimer = options.setTimer ?? setTimeout;
    const clearTimer = options.clearTimer ?? clearTimeout;
    const delayMs = options.delayMs ?? 650;
    const watchdogMs = options.watchdogMs ?? 1200;
    let active = false;
    let actionTimer: TimerId | null = null;
    let watchdogTimer: TimerId | null = null;

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

    function stop(reason?: Exclude<AutoState["reason"], null>) {
      const wasActive = active;
      active = false;
      clearTimers();
      if (wasActive) onStateChange({ active: false, reason: reason || "manual" });
    }

    function boardChanged() {
      clearTimers();
    }

    function suggest(move: Direction, boardHash: string) {
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
