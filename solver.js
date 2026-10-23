(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.Solver2048 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DIRECTIONS = ["left", "down", "right", "up"];
  const STORAGE_CIPHER_KEY = "dGhlIGJyb3duIGZveCBqdW1wcyBvdmVyIHRoZSBsYXp5IGRvZw==";

  function cloneBoard(board) {
    return board.map((row) => row.slice());
  }

  function collapseLine(line) {
    const values = line.filter(Boolean);
    const result = [];
    let score = 0;
    for (let index = 0; index < values.length; index += 1) {
      if (values[index] === values[index + 1]) {
        const merged = values[index] * 2;
        result.push(merged);
        score += merged;
        index += 1;
      } else {
        result.push(values[index]);
      }
    }
    while (result.length < 4) result.push(0);
    return { line: result, score };
  }

  function applyMove(board, direction) {
    if (!DIRECTIONS.includes(direction)) throw new Error(`Unknown direction: ${direction}`);
    const next = Array.from({ length: 4 }, () => Array(4).fill(0));
    let score = 0;

    for (let lineIndex = 0; lineIndex < 4; lineIndex += 1) {
      const vertical = direction === "up" || direction === "down";
      const reverse = direction === "right" || direction === "down";
      let line = Array.from({ length: 4 }, (_, offset) =>
        vertical ? board[offset][lineIndex] : board[lineIndex][offset],
      );
      if (reverse) line.reverse();
      const collapsed = collapseLine(line);
      line = collapsed.line;
      score += collapsed.score;
      if (reverse) line.reverse();

      for (let offset = 0; offset < 4; offset += 1) {
        if (vertical) next[offset][lineIndex] = line[offset];
        else next[lineIndex][offset] = line[offset];
      }
    }

    const moved = next.some((row, y) => row.some((value, x) => value !== board[y][x]));
    return { board: next, moved, score };
  }

  function normalizeBoard(rows) {
    if (!Array.isArray(rows) || rows.length !== 4 || rows.some((row) => !Array.isArray(row) || row.length !== 4)) {
      return null;
    }
    let invalid = false;
    const board = rows.map((row) => row.map((cell) => {
      if (cell === null || cell === 0) return 0;
      const value = typeof cell === "number" ? cell : cell && cell.value;
      if (!Number.isInteger(value) || value < 2 || !Number.isInteger(Math.log2(value))) {
        invalid = true;
        return 0;
      }
      return value;
    }));
    return invalid ? null : board;
  }

  function fromGameObject(game) {
    if (!game || typeof game !== "object") return null;
    if (Array.isArray(game.board)) return normalizeBoard(game.board);
    if (game.grid && Array.isArray(game.grid.cells)) {
      const columns = game.grid.cells;
      if (columns.length !== 4) return null;
      const rows = Array.from({ length: 4 }, (_, y) =>
        Array.from({ length: 4 }, (_, x) => columns[x] && columns[x][y]),
      );
      return normalizeBoard(rows);
    }
    if (game.gameState) return fromGameObject(game.gameState);
    return null;
  }

  function restoreBase64Padding(value) {
    const trailing = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
    const padding = ["", "=", "=="][(trailing + 1) % 3];
    return value.slice(0, value.length - trailing) + padding;
  }

  function decodeCipher(value) {
    const padded = restoreBase64Padding(value);
    const binary = typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("binary");
    const bytes = Uint8Array.from(binary, (character, index) =>
      character.charCodeAt(0) ^ STORAGE_CIPHER_KEY.charCodeAt(index % STORAGE_CIPHER_KEY.length),
    );
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  }

  function decodeStoredGame(value) {
    if (typeof value !== "string" || !value) return null;
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch (_) {
      try {
        parsed = decodeCipher(value);
      } catch (_) {
        return null;
      }
    }
    const board = fromGameObject(parsed);
    return board ? { board, moveCount: Number(parsed.moveCount) || 0, raw: parsed } : null;
  }

  function storageKey(mode) {
    const input = `k-${mode}`;
    const bytes = new TextEncoder().encode(input);
    const checksum = Math.floor(10_000_000 * bytes.reduce((sum, byte) => sum + Math.sin(byte), 0)).toString(36);
    return Array.from(new TextEncoder().encode(input + checksum), (byte) =>
      byte.toString(36).split("").reverse().join(""),
    ).join("");
  }

  function getStorageValue(storage, key) {
    if (!storage) return null;
    return typeof storage.getItem === "function" ? storage.getItem(key) : storage[key];
  }

  function readBoardFromStorage(storage, pathname) {
    const mode = pathname && pathname.includes("classic") ? "classic" : "standard";
    const preferredKey = storageKey(mode);
    const current = decodeStoredGame(getStorageValue(storage, preferredKey));
    if (current) return current.board;
    const legacy = decodeStoredGame(getStorageValue(storage, "gameState"));
    return legacy ? legacy.board : null;
  }

  function emptyCells(board) {
    const cells = [];
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) if (board[y][x] === 0) cells.push({ x, y });
    }
    return cells;
  }

  function evaluateBoard(board) {
    const logs = board.map((row) => row.map((value) => value ? Math.log2(value) : 0));
    const maxTile = Math.max(...board.flat());
    const empties = emptyCells(board).length;
    if (maxTile >= 2048) return 10_000_000 + empties * 1000;

    let smoothness = 0;
    let mergePotential = 0;
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        if (x < 3 && board[y][x] && board[y][x + 1]) {
          smoothness -= Math.abs(logs[y][x] - logs[y][x + 1]);
          if (board[y][x] === board[y][x + 1]) mergePotential += logs[y][x];
        }
        if (y < 3 && board[y][x] && board[y + 1][x]) {
          smoothness -= Math.abs(logs[y][x] - logs[y + 1][x]);
          if (board[y][x] === board[y + 1][x]) mergePotential += logs[y][x];
        }
      }
    }

    const snakeWeights = [
      [15, 14, 13, 12],
      [8, 9, 10, 11],
      [7, 6, 5, 4],
      [0, 1, 2, 3],
    ];
    let snake = 0;
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) snake += logs[y][x] * snakeWeights[y][x];
    }
    const cornerBonus = board[0][0] === maxTile ? Math.log2(maxTile || 1) * 90 : 0;
    return empties * 280 + smoothness * 18 + mergePotential * 32 + snake * 5 + cornerBonus;
  }

  function chooseChanceCells(cells, limit) {
    if (cells.length <= limit) return cells;
    const selected = [];
    for (let index = 0; index < limit; index += 1) {
      selected.push(cells[Math.floor(index * cells.length / limit)]);
    }
    return selected;
  }

  function findBestMove(board, options) {
    if (Math.max(...board.flat()) >= 2048) {
      return { move: null, score: 10_000_000, depth: 0, alternatives: [], targetReached: true };
    }
    const settings = options || {};
    const maxDepth = settings.maxDepth || 4;
    const deadline = Date.now() + (settings.timeBudgetMs || 120);
    const budget = { remaining: settings.nodeBudget || 80_000, deadline };
    const ABORTED = Symbol("aborted");
    let best = null;

    for (const direction of DIRECTIONS) {
      const result = applyMove(board, direction);
      if (result.moved && Math.max(...result.board.flat()) >= 2048) {
        return {
          move: direction,
          score: 10_000_000 + result.score,
          depth: 1,
          alternatives: [{ move: direction, score: 10_000_000 + result.score }],
        };
      }
    }

    function exhausted() {
      if (budget.remaining <= 0 || Date.now() >= budget.deadline) return true;
      budget.remaining -= 1;
      return false;
    }

    function playerNode(current, depth) {
      if (depth <= 0) return evaluateBoard(current);
      if (exhausted()) return ABORTED;
      let value = -Infinity;
      for (const direction of DIRECTIONS) {
        const result = applyMove(current, direction);
        if (result.moved) {
          const child = chanceNode(result.board, depth - 1);
          if (child === ABORTED) return ABORTED;
          value = Math.max(value, child + result.score * 2);
        }
      }
      return value === -Infinity ? -1_000_000 : value;
    }

    function chanceNode(current, depth) {
      if (depth <= 0) return evaluateBoard(current);
      if (exhausted()) return ABORTED;
      const empties = emptyCells(current);
      if (!empties.length) return playerNode(current, depth);
      const cells = chooseChanceCells(empties, 6);
      let total = 0;
      for (const cell of cells) {
        for (const [tile, probability] of [[2, 0.9], [4, 0.1]]) {
          const next = cloneBoard(current);
          next[cell.y][cell.x] = tile;
          const child = playerNode(next, depth);
          if (child === ABORTED) return ABORTED;
          total += probability * child;
        }
      }
      return total / cells.length;
    }

    for (let depth = 1; depth <= maxDepth && Date.now() < deadline && budget.remaining > 0; depth += 1) {
      const ranked = [];
      let completed = true;
      for (const direction of DIRECTIONS) {
        const result = applyMove(board, direction);
        if (!result.moved) continue;
        const child = chanceNode(result.board, depth - 1);
        if (child === ABORTED) {
          completed = false;
          break;
        }
        const score = child + result.score * 2;
        ranked.push({ move: direction, score });
      }
      if (completed && ranked.length) {
        ranked.sort((a, b) => b.score - a.score);
        best = { ...ranked[0], depth, alternatives: ranked };
      }
      if (!completed) break;
    }
    return best || { move: null, score: -1_000_000, depth: 0, alternatives: [] };
  }

  return {
    DIRECTIONS,
    applyMove,
    decodeStoredGame,
    evaluateBoard,
    findBestMove,
    readBoardFromStorage,
    storageKey,
  };
});
