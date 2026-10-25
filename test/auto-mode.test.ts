import { test } from "vitest";
import assert from "node:assert/strict";

import { createAutoController, keyboardEventForMove } from "../src/auto-mode";

function fakeClock() {
  let nextId = 1;
  const tasks = new Map();
  return {
    setTimer(fn) {
      const id = nextId++;
      tasks.set(id, fn);
      return id;
    },
    clearTimer(id) {
      tasks.delete(id);
    },
    runNext() {
      const entry = tasks.entries().next().value;
      if (!entry) return false;
      const [id, fn] = entry;
      tasks.delete(id);
      fn();
      return true;
    },
  };
}

test("moves map to the keyboard codes used by play2048.co", () => {
  assert.deepEqual(keyboardEventForMove("up"), { key: "ArrowUp", code: "ArrowUp" });
  assert.deepEqual(keyboardEventForMove("right"), { key: "ArrowRight", code: "ArrowRight" });
  assert.deepEqual(keyboardEventForMove("down"), { key: "ArrowDown", code: "ArrowDown" });
  assert.deepEqual(keyboardEventForMove("left"), { key: "ArrowLeft", code: "ArrowLeft" });
});

test("auto controller dispatches a recommendation only after it starts", () => {
  const clock = fakeClock();
  const moves = [];
  let hash = "before";
  const auto = createAutoController({
    dispatchMove: (move) => moves.push(move),
    getBoardHash: () => hash,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  auto.suggest("left", hash);
  assert.equal(clock.runNext(), false);

  auto.start();
  auto.suggest("left", hash);
  assert.deepEqual(moves, []);
  clock.runNext();
  assert.deepEqual(moves, ["left"]);
});

test("auto controller cancels a stale recommendation when the board changes", () => {
  const clock = fakeClock();
  const moves = [];
  let hash = "before";
  const auto = createAutoController({
    dispatchMove: (move) => moves.push(move),
    getBoardHash: () => hash,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  auto.start();
  auto.suggest("up", hash);
  hash = "after";
  clock.runNext();

  assert.deepEqual(moves, []);
});

test("auto controller stops when a dispatched move does not change the board", () => {
  const clock = fakeClock();
  const states = [];
  const auto = createAutoController({
    dispatchMove() {},
    getBoardHash: () => "unchanged",
    onStateChange: (state) => states.push(state),
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  auto.start();
  auto.suggest("down", "unchanged");
  clock.runNext();
  clock.runNext();

  assert.equal(auto.isActive(), false);
  assert.equal(states.at(-1).reason, "stalled");
});

test("auto controller stops if the board disappears before dispatch", () => {
  const clock = fakeClock();
  const moves = [];
  let hash = "before";
  const auto = createAutoController({
    dispatchMove: (move) => moves.push(move),
    getBoardHash: () => hash,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  auto.start();
  auto.suggest("left", hash);
  hash = null;
  clock.runNext();

  assert.deepEqual(moves, []);
  assert.equal(auto.isActive(), false);
});

test("auto controller stops if the board disappears while awaiting a move", () => {
  const clock = fakeClock();
  let hash = "before";
  const auto = createAutoController({
    dispatchMove() {},
    getBoardHash: () => hash,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  auto.start();
  auto.suggest("right", hash);
  clock.runNext();
  hash = null;
  clock.runNext();

  assert.equal(auto.isActive(), false);
});
