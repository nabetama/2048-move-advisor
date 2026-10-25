import { test } from "vitest";
import assert from "node:assert/strict";

import { applyMove, decodeStoredGame, findBestMove, readBoardFromStorage, storageKey } from "../src/solver";

test("left move merges each tile only once", () => {
  const result = applyMove([
    [2, 2, 2, 2],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], "left");

  assert.deepEqual(result.board[0], [4, 4, 0, 0]);
  assert.equal(result.score, 8);
  assert.equal(result.moved, true);
});

test("a move that does not change the board is invalid", () => {
  const result = applyMove([
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [512, 1024, 2, 4],
    [8, 16, 32, 64],
  ], "left");

  assert.equal(result.moved, false);
});

test("right, up, and down moves preserve orientation", () => {
  const horizontal = [
    [2, 2, 4, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  assert.deepEqual(applyMove(horizontal, "right").board[0], [0, 0, 4, 4]);

  const vertical = [
    [2, 0, 0, 0],
    [2, 0, 0, 0],
    [4, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  assert.deepEqual(applyMove(vertical, "up").board.map((row) => row[0]), [4, 4, 0, 0]);
  assert.deepEqual(applyMove(vertical, "down").board.map((row) => row[0]), [0, 0, 4, 4]);
});

test("stored current game format is converted to a numeric board", () => {
  const stored = JSON.stringify({
    board: [
      [{ value: 2 }, null, null, { value: 4 }],
      [null, null, null, null],
      [null, { value: 8 }, null, null],
      [null, null, null, null],
    ],
    moveCount: 7,
  });

  assert.deepEqual(decodeStoredGame(stored).board, [
    [2, 0, 0, 4],
    [0, 0, 0, 0],
    [0, 8, 0, 0],
    [0, 0, 0, 0],
  ]);
});

test("obfuscated current-site storage is decoded", () => {
  const encoded = "H2UKAyg1LltYaD8OazE7GhAmYEtWKh0ZFhUuWgoYOhVlJicDNg5uKDctHFllKScaNltGHxImBBksZXBIVE5IGzwrNitJGCwECDsdGRYVLloKGDoVZSYnAzYObig3LRxZZSknGjZbU0gIK0QCPCsmJD8fRhgmMT81CjYsBUZtBUUe==";
  const decoded = decodeStoredGame(encoded);

  assert.equal(decoded.moveCount, 42);
  assert.equal(decoded.board[1][2], 16);
});

test("current-site mode maps to its persisted storage key", () => {
  assert.equal(storageKey("standard"), "z2917383p223s2p263s2v2f163c3e3");
  assert.equal(storageKey("classic"), "z291r203p27373x2r2j1x2c3r2r2");
});

test("malformed tile values reject the stored board", () => {
  const stored = JSON.stringify({
    board: [
      [{ value: 3 }, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
  });

  assert.equal(decodeStoredGame(stored), null);
});

test("legacy gameState format is converted to a numeric board", () => {
  const storage = {
    gameState: JSON.stringify({
      grid: {
        cells: [
          [{ value: 2 }, { value: 4 }, null, null],
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ],
      },
    }),
  };

  assert.deepEqual(readBoardFromStorage(storage, "/classic"), [
    [2, 0, 0, 0],
    [4, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
});

test("advisor takes an available move that creates 2048", () => {
  const board = [
    [1024, 1024, 4, 2],
    [512, 256, 128, 64],
    [32, 16, 8, 4],
    [2, 4, 2, 4],
  ];

  const result = findBestMove(board, { maxDepth: 3, nodeBudget: 20000 });
  assert.equal(result.move, "left");
  assert.ok(result.score > 1_000_000);
});

test("advisor reports completion when 2048 is already present", () => {
  const result = findBestMove([
    [2048, 4, 2, 0],
    [512, 256, 128, 64],
    [32, 16, 8, 4],
    [2, 4, 2, 4],
  ]);

  assert.equal(result.move, null);
  assert.equal(result.targetReached, true);
});

test("an exhausted search keeps the last fully completed depth", () => {
  const result = findBestMove([
    [2, 4, 8, 16],
    [0, 2, 4, 8],
    [0, 0, 2, 4],
    [0, 0, 0, 2],
  ], { maxDepth: 5, nodeBudget: 1, timeBudgetMs: 1000 });

  assert.equal(result.depth, 1);
});

test("advisor reports no move on a game-over board", () => {
  const result = findBestMove([
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [512, 1024, 2, 4],
    [8, 16, 32, 64],
  ]);

  assert.equal(result.move, null);
});
