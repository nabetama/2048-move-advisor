importScripts("solver.js");

self.addEventListener("message", (event) => {
  const { id, board, boardHash } = event.data || {};
  try {
    const result = self.Solver2048.findBestMove(board, {
      maxDepth: 5,
      nodeBudget: 120000,
      timeBudgetMs: 140,
    });
    self.postMessage({ id, boardHash, result });
  } catch (error) {
    self.postMessage({ id, boardHash, error: error instanceof Error ? error.message : String(error) });
  }
});
