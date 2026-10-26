import { createAutoController, keyboardEventForMove } from "./auto-mode";
import { findBestMove, readBoardFromStorage } from "./solver";
import workerUrl from "./worker.ts?script&module";

  if (!document.getElementById("solver-2048-advisor")) {

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
    <section class="panel" aria-label="2048 move advisor" aria-live="polite">
      <div class="header">
        <span class="title">2048 ADVISOR</span>
        <button class="toggle" type="button">Pause</button>
      </div>
      <div class="recommendation">
        <div class="move hidden">
          <div class="arrow"></div>
        </div>
        <div class="status">Reading board…</div>
      </div>
      <div class="details">Prioritizing 2048</div>
      <button class="auto-toggle" type="button">Auto Start</button>
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

  const autoController = createAutoController({
    dispatchMove,
    getBoardHash,
    onStateChange(state) {
      autoToggle.textContent = state.active ? "Auto Stop" : "Auto Start";
      autoToggle.classList.toggle("active", state.active);
      if (state.reason === "stalled") {
        setStatus("Auto mode stopped");
        detailsElement.textContent = "The board did not change";
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
      setStatus("2048 reached!");
      detailsElement.textContent = "Goal achieved";
      return;
    }
    if (!result || !result.move) {
      autoController.stop("gameOver");
      setStatus("No moves left");
      detailsElement.textContent = "Game over";
      return;
    }
    const maxTile = Math.max(...board.flat());
    const emptyCount = board.flat().filter((value) => value === 0).length;
    arrowElement.textContent = arrows[result.move];
    statusElement.classList.add("hidden");
    moveElement.classList.remove("hidden");
    const autoLabel = autoController.isActive() ? "Auto mode • " : "";
    detailsElement.textContent = `${autoLabel}Max ${maxTile} • Empty ${emptyCount} • Depth ${result.depth}`;
    autoController.suggest(result.move, board.flat().join(","));
  }

  function getBoardHash() {
    const board = readBoard();
    return board ? board.flat().join(",") : null;
  }

  function dispatchMove(move) {
    const eventInit = keyboardEventForMove(move);
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
      const instance = new Worker(chrome.runtime.getURL(workerUrl), { type: "module" });
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
      return readBoardFromStorage(localStorage, location.pathname);
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
        const result = findBestMove(board, {
          maxDepth: 4,
          nodeBudget: 40000,
          timeBudgetMs: 60,
        });
        showMove(result, board);
      } catch (_) {
        setStatus("Calculation failed");
      }
    }, 0);
  }

  function analyze(board) {
    requestId += 1;
    const id = requestId;
    const boardHash = board.flat().join(",");
    setStatus("Calculating next move…");
    detailsElement.textContent = "Prioritizing 2048";
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
      setStatus("Waiting for game…");
      detailsElement.textContent = "Standard and Classic supported";
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
    toggle.textContent = paused ? "Resume" : "Pause";
    if (paused) {
      autoController.stop("paused");
      requestId += 1;
      setStatus("Paused");
      detailsElement.textContent = "Recommendation updates are paused";
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
      toggle.textContent = "Pause";
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

}
