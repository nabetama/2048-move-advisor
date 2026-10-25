import { findBestMove } from "./solver";

self.addEventListener("message", (event) => {
  const { id, board, boardHash } = event.data || {};
  try {
    const result = findBestMove(board, {
      maxDepth: 5,
      nodeBudget: 120000,
      timeBudgetMs: 140,
    });
    self.postMessage({ id, boardHash, result });
  } catch (error) {
    self.postMessage({ id, boardHash, error: error instanceof Error ? error.message : String(error) });
  }
});
