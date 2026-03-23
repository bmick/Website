"use strict";

(function initSnakeGame() {
  const GRID_SIZE = 10;
  const BASE_TICK_MS = 500;
  const BASE_SPEED_LEVEL = 3;
  const MAX_SPEED_LEVEL = 11;
  const SPEED_FACTOR = 1.25;
  const WIN_LENGTH = 10;
  const COUNTDOWN_START = 3;
  const SWIPE_MIN_PX = 20;

  const boardEl = document.getElementById("snake-board");
  const overlayEl = document.getElementById("snake-overlay");
  const pauseBtn = document.getElementById("snake-pause");
  const restartBtn = document.getElementById("snake-restart");
  const speedSliderEl = document.getElementById("snake-speed");
  const speedValueEl = document.getElementById("snake-speed-value");

  if (
    !boardEl ||
    !overlayEl ||
    !pauseBtn ||
    !restartBtn ||
    !speedSliderEl ||
    !speedValueEl
  ) {
    return;
  }

  const cells = [];
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i += 1) {
    const cell = document.createElement("div");
    cell.className = "snake-cell";
    boardEl.appendChild(cell);
    cells.push(cell);
  }

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const OPPOSITE = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };

  const KEY_TO_DIR = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    W: "up",
    s: "down",
    S: "down",
    a: "left",
    A: "left",
    d: "right",
    D: "right",
  };

  let snake = [];
  let direction = "right";
  const directionQueue = [];
  let food = null;
  let timerId = null;
  let isPaused = false;
  let isCountdown = false;
  let gameOver = false;
  let speedLevel = BASE_SPEED_LEVEL;
  let touchTracking = null;

  function toIndex(pos) {
    return pos.y * GRID_SIZE + pos.x;
  }

  function positionsEqual(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function clearBoardClasses() {
    for (const cell of cells) {
      cell.className = "snake-cell";
    }
  }

  function renderBoard() {
    clearBoardClasses();
    if (food) {
      cells[toIndex(food)].classList.add("snake-cell--food");
    }
    for (let i = snake.length - 1; i >= 0; i -= 1) {
      const segment = snake[i];
      cells[toIndex(segment)].classList.add("snake-cell--body");
    }
    cells[toIndex(snake[0])].classList.remove("snake-cell--body");
    cells[toIndex(snake[0])].classList.add("snake-cell--head");
  }

  function showOverlay(text) {
    overlayEl.textContent = text;
    overlayEl.classList.add("is-visible");
  }

  function hideOverlay() {
    overlayEl.textContent = "";
    overlayEl.classList.remove("is-visible");
  }

  function setPausedVisual(paused) {
    pauseBtn.textContent = paused ? "Resume" : "Pause";
    pauseBtn.classList.toggle("is-paused", paused);
  }

  function stopTimer() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function randomOpenSquare() {
    const occupied = new Set(snake.map((seg) => `${seg.x},${seg.y}`));
    const open = [];
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const key = `${x},${y}`;
        if (!occupied.has(key)) {
          open.push({ x, y });
        }
      }
    }
    if (open.length === 0) {
      return null;
    }
    return open[Math.floor(Math.random() * open.length)];
  }

  function getTickMs() {
    const stepsFromBase = speedLevel - BASE_SPEED_LEVEL;
    return BASE_TICK_MS / SPEED_FACTOR ** stepsFromBase;
  }

  function applySpeedFromSlider() {
    const parsed = Number.parseInt(speedSliderEl.value, 10);
    if (Number.isNaN(parsed)) {
      return;
    }
    speedLevel = Math.min(MAX_SPEED_LEVEL, Math.max(1, parsed));
    speedValueEl.textContent = String(speedLevel);
  }

  function scheduleTick() {
    stopTimer();
    if (gameOver || isPaused || isCountdown) {
      return;
    }
    timerId = setTimeout(tick, getTickMs());
  }

  function endGame(message) {
    gameOver = true;
    stopTimer();
    showOverlay(message);
  }

  function tick() {
    if (gameOver || isPaused || isCountdown) {
      return;
    }

    if (directionQueue.length > 0) {
      direction = directionQueue.shift();
    }
    const head = snake[0];
    const step = DIRS[direction];
    const next = { x: head.x + step.x, y: head.y + step.y };

    const outOfBounds =
      next.x < 0 || next.y < 0 || next.x >= GRID_SIZE || next.y >= GRID_SIZE;
    if (outOfBounds) {
      endGame("You Lose");
      return;
    }

    const willEat = food && positionsEqual(next, food);
    const bodyToCheck = willEat ? snake : snake.slice(0, -1);
    const hitsSelf = bodyToCheck.some((seg) => positionsEqual(seg, next));
    if (hitsSelf) {
      endGame("You Lose");
      return;
    }

    snake.unshift(next);

    if (willEat) {
      if (snake.length >= WIN_LENGTH) {
        renderBoard();
        endGame("You Win");
        return;
      }
      food = randomOpenSquare();
    } else {
      snake.pop();
    }

    renderBoard();
    scheduleTick();
  }

  function tryEnqueueDirection(nextDir, maxQueueLength = 1) {
    if (gameOver || isCountdown) {
      return false;
    }

    const compareDir =
      directionQueue.length > 0
        ? directionQueue[directionQueue.length - 1]
        : direction;

    if (nextDir === compareDir) {
      return false;
    }

    if (snake.length > 1 && OPPOSITE[compareDir] === nextDir) {
      return false;
    }

    if (directionQueue.length >= maxQueueLength) {
      return false;
    }

    directionQueue.push(nextDir);
    return true;
  }

  function requestDirection(nextDir) {
    // Keep controls responsive but predictable: one buffered turn by default.
    tryEnqueueDirection(nextDir, 1);
  }

  function onKeyDown(event) {
    const mapped = KEY_TO_DIR[event.key];
    if (!mapped) {
      return;
    }
    event.preventDefault();
    requestDirection(mapped);
  }

  function directionFromDelta(dx, dy) {
    if (Math.abs(dx) < SWIPE_MIN_PX && Math.abs(dy) < SWIPE_MIN_PX) {
      return null;
    }
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx > 0 ? "right" : "left";
    }
    return dy > 0 ? "down" : "up";
  }

  function onTouchStart(event) {
    if (event.touches.length !== 1) {
      touchTracking = null;
      return;
    }
    const touch = event.touches[0];
    touchTracking = {
      anchorX: touch.clientX,
      anchorY: touch.clientY,
      dirs: [],
    };
  }

  function onTouchMove(event) {
    if (!touchTracking || event.touches.length !== 1) {
      return;
    }
    const touch = event.touches[0];
    const dx = touch.clientX - touchTracking.anchorX;
    const dy = touch.clientY - touchTracking.anchorY;
    const nextDir = directionFromDelta(dx, dy);
    if (!nextDir) {
      return;
    }

    event.preventDefault();

    const lastDir = touchTracking.dirs[touchTracking.dirs.length - 1];
    if (nextDir === lastDir || nextDir === OPPOSITE[lastDir]) {
      return;
    }

    if (touchTracking.dirs.length < 2) {
      touchTracking.dirs.push(nextDir);
      touchTracking.anchorX = touch.clientX;
      touchTracking.anchorY = touch.clientY;
    }
  }

  function onTouchEnd() {
    if (!touchTracking || touchTracking.dirs.length === 0) {
      touchTracking = null;
      return;
    }

    const first = touchTracking.dirs[0];
    const second = touchTracking.dirs[1];

    const firstQueued = tryEnqueueDirection(first, 1);
    if (firstQueued && second) {
      tryEnqueueDirection(second, 2);
    }

    touchTracking = null;
  }

  function runCountdownThenStart() {
    isCountdown = true;
    isPaused = false;
    setPausedVisual(false);

    let value = COUNTDOWN_START;
    showOverlay(String(value));

    const countdownStep = () => {
      value -= 1;
      if (value > 0) {
        showOverlay(String(value));
        setTimeout(countdownStep, 1000);
        return;
      }
      hideOverlay();
      isCountdown = false;
      scheduleTick();
    };

    setTimeout(countdownStep, 1000);
  }

  function resetGame() {
    stopTimer();
    gameOver = false;
    direction = "right";
    directionQueue.length = 0;
    snake = [
      { x: 4, y: 5 },
      { x: 3, y: 5 },
      { x: 2, y: 5 },
    ];
    food = randomOpenSquare();
    renderBoard();
    runCountdownThenStart();
  }

  pauseBtn.addEventListener("click", () => {
    if (gameOver || isCountdown) {
      return;
    }
    isPaused = !isPaused;
    setPausedVisual(isPaused);
    if (isPaused) {
      stopTimer();
      showOverlay("Paused");
    } else {
      hideOverlay();
      scheduleTick();
    }
  });

  restartBtn.addEventListener("click", () => {
    resetGame();
  });

  speedSliderEl.addEventListener("input", () => {
    applySpeedFromSlider();
    if (!gameOver && !isPaused && !isCountdown) {
      scheduleTick();
    }
  });

  window.addEventListener("keydown", onKeyDown, { passive: false });
  boardEl.addEventListener("touchstart", onTouchStart, { passive: true });
  boardEl.addEventListener("touchmove", onTouchMove, { passive: false });
  boardEl.addEventListener("touchend", onTouchEnd, { passive: true });
  boardEl.addEventListener("touchcancel", onTouchEnd, { passive: true });

  speedSliderEl.value = String(BASE_SPEED_LEVEL);
  applySpeedFromSlider();
  resetGame();
})();
