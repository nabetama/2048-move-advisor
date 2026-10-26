import { test } from "vitest";
import assert from "node:assert/strict";
import { isKeepGoingControl } from "../src/win-dialog";

test("recognizes the Standard keep-going button", () => {
  assert.equal(isKeepGoingControl({
    tagName: "BUTTON",
    text: "Keep Going",
    classes: [],
  }), true);
});

test("recognizes the Classic keep-playing link", () => {
  assert.equal(isKeepGoingControl({
    tagName: "A",
    text: "Keep going",
    classes: ["keep-playing-button"],
  }), true);
});

test("does not recognize unrelated controls", () => {
  assert.equal(isKeepGoingControl({ tagName: "BUTTON", text: "New Game", classes: [] }), false);

});
