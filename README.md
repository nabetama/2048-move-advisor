# 2048 Move Advisor

[日本語](README.ja.md)

A Chrome extension for [play2048.co](https://play2048.co/) that reads the current board and recommends the next move, prioritizing reaching the 2048 tile. The recommendation is displayed as an arrow. Auto mode can also play each recommended move at a controlled interval.

![Auto mode reached the 2048 tile with no power-ups](docs/images/auto-mode-2048-win.png)

*2048 reached in 1,010 moves without using power-ups.*

## Installation

1. Open `chrome://extensions/` in Chrome.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select this repository's directory.
5. Open or reload [play2048.co](https://play2048.co/).

The **2048 ADVISOR** panel will appear on the page. It recalculates the recommendation whenever the board changes. The extension supports both Standard mode on the home page and Classic mode at `/classic`.

## Auto Mode

Click **Auto Start** (`オート開始`) to let the extension play the recommended moves automatically. Click **Auto Stop** (`オート停止`) to return to manual play.

Auto mode stops automatically when:

- The 2048 tile is reached
- The game is over
- A move does not change the board
- The board can no longer be read

Before every automatic move, the extension verifies that the board still matches the board used to calculate the recommendation. This prevents a stale recommendation from being played after the board changes.

## How Recommendations Work

New tiles appear randomly, so there is no single guaranteed sequence of optimal moves. The extension uses expectimax search based on the standard probabilities of a 2 tile appearing 90% of the time and a 4 tile appearing 10% of the time.

The evaluation favors:

- Moves that create the 2048 tile
- Boards with more empty cells
- Keeping the highest tile in a corner
- Monotonic arrangements of larger tiles
- Available merges on future moves

The search runs in a Web Worker to keep the game responsive. Board data is processed entirely in the browser and is never sent anywhere.

## Development

Run the test suite with Node.js:

```sh
npm test
```
