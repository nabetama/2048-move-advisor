export const directions = ["left", "down", "right", "up"] as const;

export type Direction = (typeof directions)[number];
export type Board = number[][];

export interface MoveResult {
  board: Board;
  moved: boolean;
  score: number;
}

export interface RankedMove {
  move: Direction;
  score: number;
}

export interface SolverResult {
  move: Direction | null;
  score: number;
  depth: number;
  alternatives: RankedMove[];
}

export interface SearchOptions {
  maxDepth?: number;
  nodeBudget?: number;
  timeBudgetMs?: number;
}

export interface AutoState {
  active: boolean;
  reason: "manual" | "paused" | "stalled" | "boardUnavailable" | "gameOver" | null;
}

export interface WorkerRequest {
  id: number;
  board: Board;
  boardHash: string;
}

export interface WorkerResponse {
  id: number;
  boardHash: string;
  result?: SolverResult;
  error?: string;
}

export type TimerId = number | ReturnType<typeof setTimeout>;

export interface AutoControllerOptions {
  dispatchMove: (move: Direction) => void;
  getBoardHash: () => string | null;
  onStateChange?: (state: AutoState) => void;
  setTimer?: (callback: () => void, delayMs: number) => TimerId;
  clearTimer?: (timer: TimerId) => void;
  delayMs?: number;
  watchdogMs?: number;
}

export interface AutoController {
  boardChanged(): void;
  isActive(): boolean;
  start(): void;
  stop(reason?: Exclude<AutoState["reason"], null>): void;
  suggest(move: Direction, boardHash: string): void;
}
