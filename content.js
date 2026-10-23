(function () {
  "use strict";

  if (document.getElementById("solver-2048-advisor")) return;

  const arrows = {
    up: "↑",
    right: "→",
    down: "↓",
    left: "←",
  };

  const host = document.createElement("div");
  host.id = "solver-2048-advisor";
  host.style.position = "fixed";
  host.style.zIndex = "2147483647";
  host.style.top = "12px";
  host.style.right = "12px";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { color-scheme: light; }
      .panel {
        box-sizing: border-box;
        width: 196px;
        padding: 14px;
        border: 1px solid rgba(119, 110, 101, .2);
        border-radius: 14px;
        background: rgba(250, 248, 239, .97);
        color: #776e65;
        box-shadow: 0 10px 30px rgba(31, 27, 24, .18);
        font: 600 14px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-align: center;
        backdrop-filter: blur(8px);
      }
      .header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .title { font-size: 14px; font-weight: 800; letter-spacing: .01em; }
      .toggle {
        border: 0; border-radius: 8px; padding: 5px 8px; cursor: pointer;
        background: #eee4da; color: #776e65; font: inherit; font-size: 11px;
      }
      .toggle:hover { background: #ede0c8; }
      .recommendation {
        display: grid; place-items: center; min-height: 92px; margin-top: 9px;
        border-radius: 11px; background: #8f7a66; color: #f9f6f2;
      }
      .arrow { font-size: 54px; font-weight: 900; line-height: .9; }
      .status { padding: 20px 6px; font-size: 13px; font-weight: 650; }
      .details { margin-top: 9px; font-size: 11px; font-weight: 600; color: #8f7a66; }
      .auto-toggle {
        width: 100%; margin-top: 9px; border: 0; border-radius: 9px; padding: 9px;
        cursor: pointer; background: #edc22e; color: #fff; font: inherit; font-size: 12px;
      }
      .auto-toggle:hover { background: #f2b179; }
      .auto-toggle.active { background: #f65e3b; }
      .hidden { display: none; }
    </style>
    <section class="panel" aria-label="2048 次の一手" aria-live="polite">
      <div class="header">
        <span class="title">2048 ADVISOR</span>
        <button class="toggle" type="button">一時停止</button>
      </div>
      <div class="recommendation">
        <div class="move hidden">
          <div class="arrow"></div>
        </div>
        <div class="status">盤面を読み取っています…</div>
      </div>
      <div class="details">2048達成を優先</div>
      <button class="auto-toggle" type="button">オート開始</button>
    </section>
  `;

  const moveElement = shadow.querySelector(".move");
  const arrowElement = shadow.querySelector(".arrow");
  const statusElement = shadow.querySelector(".status");
  const detailsElement = shadow.querySelector(".details");
  const toggle = shadow.querySelector(".toggle");
  const autoToggle = shadow.querySelector(".auto-toggle");

  let paused = false;
  let lastBoardHash = "";
  let requestId = 0;
  let worker = null;
  let workerFailed = false;
  let currentResult = null;
  let currentBoard = null;

  const autoController = self.Auto2048.createAutoController({
    dispatchMove,
    getBoardHash,
    onStateChange(state) {
      autoToggle.textContent = state.active ? "オート停止" : "オート開始";
      autoToggle.classList.toggle("active", state.active);
      if (state.reason === "stalled") {
        setStatus("オートを停止しました");
        detailsElement.textContent = "盤面が動きませんでした";
      }
    },
  });

  function setStatus(message) {
    moveElement.classList.add("hidden");
    statusElement.classList.remove("hidden");
    statusElement.textContent = message;
  }

  function showMove(result, board) {
    currentResult = result;
    currentBoard = board;
    if (result && result.targetReached) {
      autoController.stop("targetReached");
      setStatus("2048達成！");
      detailsElement.textContent = "目標を達成しました";
      return;
    }
    if (!result || !result.move) {
      autoController.stop("gameOver");
      setStatus("動かせる手がありません");
      detailsElement.textContent = "ゲームオーバー";
      return;
    }
    const maxTile = Math.max(...board.flat());
    const emptyCount = board.flat().filter((value) => value === 0).length;
    arrowElement.textContent = arrows[result.move];
    statusElement.classList.add("hidden");
    moveElement.classList.remove("hidden");
    const autoLabel = autoController.isActive() ? "オート実行中・" : "";
    detailsElement.textContent = `${autoLabel}最大 ${maxTile}・空き ${emptyCount}・探索 ${result.depth}手先`;
    autoController.suggest(result.move, board.flat().join(","));
  }

  function getBoardHash() {
    const board = readBoard();
    return board ? board.flat().join(",") : null;
  }

  function dispatchMove(move) {
    const eventInit = self.Auto2048.keyboardEventForMove(move);
    window.dispatchEvent(new KeyboardEvent("keydown", {
      ...eventInit,
      bubbles: true,
      cancelable: true,
    }));
    window.dispatchEvent(new KeyboardEvent("keyup", {
      ...eventInit,
      bubbles: true,
      cancelable: true,
    }));
  }

  function createWorker() {
    try {
      const instance = new Worker(chrome.runtime.getURL("worker.js"));
      instance.addEventListener("message", (event) => {
        if (!event.data || event.data.id !== requestId || paused) return;
        const board = readBoard();
        if (!board) return;
        if (board.flat().join(",") !== event.data.boardHash) {
          lastBoardHash = "";
          scan();
          return;
        }
        if (event.data.error) {
          runFallback(event.data.id, board, event.data.boardHash);
          return;
        }
        showMove(event.data.result, board);
      });
      instance.addEventListener("error", () => {
        instance.terminate();
        worker = null;
        workerFailed = true;
        lastBoardHash = "";
        scan();
      }, { once: true });
      return instance;
    } catch (_) {
      workerFailed = true;
      return null;
    }
  }

  function readBoard() {
    try {
      return self.Solver2048.readBoardFromStorage(localStorage, location.pathname);
    } catch (_) {
      return null;
    }
  }

  function runFallback(id, board, boardHash) {
    setTimeout(() => {
      if (id !== requestId || paused) return;
      const currentBoard = readBoard();
      if (!currentBoard) return;
      if (currentBoard.flat().join(",") !== boardHash) {
        lastBoardHash = "";
        scan();
        return;
      }
      try {
        const result = self.Solver2048.findBestMove(board, {
          maxDepth: 4,
          nodeBudget: 40000,
          timeBudgetMs: 60,
        });
        showMove(result, board);
      } catch (_) {
        setStatus("計算に失敗しました");
      }
    }, 0);
  }

  function analyze(board) {
    requestId += 1;
    const id = requestId;
    const boardHash = board.flat().join(",");
    setStatus("次の一手を計算中…");
    detailsElement.textContent = "2048達成を優先";
    if (!worker && !workerFailed) worker = createWorker();
    if (worker) {
      worker.postMessage({ id, board, boardHash });
      return;
    }
    runFallback(id, board, boardHash);
  }

  function scan() {
    if (paused) return;
    const board = readBoard();
    if (!board) {
      autoController.stop("boardUnavailable");
      lastBoardHash = "";
      setStatus("ゲーム開始を待っています");
      detailsElement.textContent = "Standard / Classic 対応";
      return;
    }
    const hash = board.flat().join(",");
    if (hash === lastBoardHash) return;
    autoController.boardChanged();
    lastBoardHash = hash;
    analyze(board);
  }

  function positionPanel() {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.right + 216 < window.innerWidth) {
      host.style.left = `${Math.round(rect.right + 14)}px`;
      host.style.right = "auto";
      host.style.top = `${Math.max(12, Math.round(rect.top))}px`;
    } else {
      host.style.left = "auto";
      host.style.right = "12px";
      host.style.top = "12px";
    }
  }

  toggle.addEventListener("click", () => {
    paused = !paused;
    toggle.textContent = paused ? "再開" : "一時停止";
    if (paused) {
      autoController.stop("paused");
      requestId += 1;
      setStatus("一時停止中");
      detailsElement.textContent = "提案の更新を停止しています";
    } else {
      lastBoardHash = "";
      scan();
    }
  });

  autoToggle.addEventListener("click", () => {
    if (autoController.isActive()) {
      autoController.stop("manual");
      if (currentResult && currentBoard) showMove(currentResult, currentBoard);
      return;
    }
    if (paused) {
      paused = false;
      toggle.textContent = "一時停止";
    }
    autoController.start();
    const currentHash = getBoardHash();
    if (currentResult && currentBoard && currentHash === currentBoard.flat().join(",")) {
      showMove(currentResult, currentBoard);
    } else {
      lastBoardHash = "";
      scan();
    }
  });

  window.addEventListener("resize", positionPanel, { passive: true });
  window.addEventListener("keyup", () => setTimeout(scan, 90), { passive: true });
  window.addEventListener("storage", scan);
  setInterval(scan, 350);
  setInterval(positionPanel, 1500);
  positionPanel();
  scan();
})();
