"use strict";

(function initMonstersGameV02() {
  const canvas = document.getElementById("monsters-canvas");
  const banner = document.getElementById("zone-banner");
  const menuPanel = document.getElementById("menu-panel");
  const inspectPopup = document.getElementById("inspect-popup");
  const hintMove = document.getElementById("hint-move");
  const hintMenu = document.getElementById("hint-menu");
  if (!canvas || !banner || !menuPanel || !inspectPopup || !hintMove || !hintMenu) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const TILE = 32;
  const WORLD_COLS = 40;
  const WORLD_ROWS = 70;
  const WORLD_WIDTH = WORLD_COLS * TILE;
  const WORLD_HEIGHT = WORLD_ROWS * TILE;
  const SAVE_KEY = "monsters-save-v0.2";

  const camera = {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
  };

  const zones = [
    { id: "town_a", name: "Starter Town", x: 0, y: TILE * 50, w: WORLD_WIDTH, h: TILE * 20 },
    { id: "route_1", name: "Route 1", x: 0, y: TILE * 18, w: WORLD_WIDTH, h: TILE * 32 },
    { id: "town_b", name: "North City", x: 0, y: 0, w: WORLD_WIDTH, h: TILE * 18 },
  ];

  const player = {
    x: WORLD_WIDTH / 2 - 12,
    y: WORLD_HEIGHT - TILE * 8,
    w: 24,
    h: 24,
    speed: 190,
    color: "#1e6dff",
    monsters: [],
    items: [],
  };

  const keysDown = new Set();
  const solids = [];
  const trees = [];
  const rocks = [];
  const buildings = [];
  const grassPatches = [];
  let routeCorridor = [];
  let townGround = [];
  let currentZoneId = "";
  let bannerTimeout = null;
  let inspectTimeout = null;
  let menuOpen = false;
  let inputSuspended = false;
  const cornerGlide = { active: false, vx: 0, vy: 0, timeLeft: 0 };
  let touchWalkActive = false;
  let touchWalkTarget = null;
  let lastTapAt = 0;
  let lastTapPos = null;
  let ignoreNextClick = false;

  const isMobile = window.matchMedia("(pointer: coarse)").matches;
  if (isMobile) {
    hintMove.textContent = "tap and hold to walk";
    hintMenu.textContent = "double tap for menu";
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function addRect(list, x, y, w, h, color) {
    list.push({ x, y, w, h, color });
  }

  function addSolid(x, y, w, h, color, type) {
    const item = { x, y, w, h, color, type };
    solids.push(item);
    return item;
  }

  function routeCenterX(y) {
    const t = (y - zones[1].y) / zones[1].h;
    const waveA = Math.sin(t * Math.PI * 2.2) * TILE * 6;
    const waveB = Math.sin(t * Math.PI * 5.1 + 0.8) * TILE * 2.2;
    return WORLD_WIDTH * 0.5 + waveA + waveB;
  }

  function buildRouteCorridor() {
    routeCorridor = [];
    for (let y = zones[1].y; y <= zones[1].y + zones[1].h; y += TILE) {
      routeCorridor.push({ x: routeCenterX(y), y });
    }
  }

  function buildWorld() {
    solids.length = 0;
    trees.length = 0;
    rocks.length = 0;
    buildings.length = 0;
    grassPatches.length = 0;
    townGround = [
      { ...zones[0], color: "#c2c8cf" },
      { ...zones[2], color: "#c2c8cf" },
    ];

    buildRouteCorridor();

    // Buildings
    const buildingData = [
      [TILE * 4, TILE * 58, TILE * 5, TILE * 4, "#b33b3b"],
      [TILE * 12, TILE * 56, TILE * 6, TILE * 5, "#bf4040"],
      [TILE * 24, TILE * 57, TILE * 5, TILE * 4, "#a83333"],
      [TILE * 31, TILE * 55, TILE * 5, TILE * 5, "#c44848"],
      [TILE * 3, TILE * 3, TILE * 6, TILE * 5, "#b53c3c"],
      [TILE * 13, TILE * 2, TILE * 5, TILE * 4, "#aa3636"],
      [TILE * 21, TILE * 4, TILE * 6, TILE * 5, "#be4545"],
      [TILE * 30, TILE * 2, TILE * 6, TILE * 4, "#a12f2f"],
      [TILE * 33, TILE * 10, TILE * 5, TILE * 4, "#c44d4d"],
    ];
    for (const [x, y, w, h, color] of buildingData) {
      buildings.push(addSolid(x, y, w, h, color, "building"));
    }

    // Goldenrod grass on route
    addRect(grassPatches, TILE * 4, TILE * 23, TILE * 5, TILE * 3, "#b99c34");
    addRect(grassPatches, TILE * 29, TILE * 27, TILE * 6, TILE * 4, "#c1a43c");
    addRect(grassPatches, TILE * 7, TILE * 34, TILE * 4, TILE * 3, "#b5952d");
    addRect(grassPatches, TILE * 27, TILE * 37, TILE * 6, TILE * 5, "#c0a23b");
    addRect(grassPatches, TILE * 10, TILE * 44, TILE * 5, TILE * 4, "#a98b25");

    const treeColors = ["#2c7a35", "#2f8b3d", "#347f44", "#246f31"];
    const rockColors = ["#835c35", "#8f6438", "#7a5630", "#9a7041"];

    // Solid border around each town except route opening
    function surroundTown(town, openingY, openingWidth) {
      const openingLeft = WORLD_WIDTH / 2 - openingWidth / 2;
      const openingRight = openingLeft + openingWidth;
      for (let x = 0; x < WORLD_WIDTH; x += TILE) {
        const topBlocked = !(x + TILE > openingLeft && x < openingRight && town === zones[0]);
        const bottomBlocked = !(x + TILE > openingLeft && x < openingRight && town === zones[2]);
        if (topBlocked) trees.push(addSolid(x, town.y, TILE, TILE, treeColors[(x / TILE) % 4], "tree"));
        if (bottomBlocked)
          trees.push(
            addSolid(
              x,
              town.y + town.h - TILE,
              TILE,
              TILE,
              treeColors[((x / TILE) + 2) % 4],
              "tree",
            ),
          );
      }
      for (let y = town.y + TILE; y < town.y + town.h - TILE; y += TILE) {
        rocks.push(addSolid(0, y, TILE, TILE, rockColors[(y / TILE) % 4], "rock"));
        rocks.push(
          addSolid(WORLD_WIDTH - TILE, y, TILE, TILE, rockColors[((y / TILE) + 1) % 4], "rock"),
        );
      }
    }

    surroundTown(zones[0], zones[0].y, TILE * 5);
    surroundTown(zones[2], zones[2].y + zones[2].h, TILE * 5);

    // Route side walls based on sinusoidal centerline
    const pathHalf = TILE * 3;
    const wallPushOut = TILE * 5;
    for (let y = zones[1].y; y <= zones[1].y + zones[1].h - TILE; y += TILE) {
      const center = routeCenterX(y + TILE / 2);
      const leftWallX = Math.floor((center - pathHalf - TILE - wallPushOut) / TILE) * TILE;
      const rightWallX = Math.ceil((center + pathHalf + wallPushOut) / TILE) * TILE;

      trees.push(addSolid(clamp(leftWallX, 0, WORLD_WIDTH - TILE), y, TILE, TILE, treeColors[1], "tree"));
      rocks.push(
        addSolid(clamp(leftWallX - TILE, 0, WORLD_WIDTH - TILE), y, TILE, TILE, rockColors[0], "rock"),
      );
      trees.push(
        addSolid(clamp(rightWallX, 0, WORLD_WIDTH - TILE), y, TILE, TILE, treeColors[2], "tree"),
      );
      rocks.push(
        addSolid(clamp(rightWallX + TILE, 0, WORLD_WIDTH - TILE), y, TILE, TILE, rockColors[2], "rock"),
      );
    }

    // Larger trees for variety
    trees.push(addSolid(TILE * 2, TILE * 25, TILE * 2, TILE * 2, treeColors[0], "tree"));
    trees.push(addSolid(TILE * 34, TILE * 39, TILE * 3, TILE * 3, treeColors[3], "tree"));
  }

  function getPlayerZone() {
    const center = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
    for (const zone of zones) {
      if (
        center.x >= zone.x &&
        center.x <= zone.x + zone.w &&
        center.y >= zone.y &&
        center.y <= zone.y + zone.h
      ) {
        return zone;
      }
    }
    return null;
  }

  function showZoneBanner(text) {
    banner.textContent = text;
    banner.classList.add("is-visible");
    if (bannerTimeout) clearTimeout(bannerTimeout);
    bannerTimeout = setTimeout(() => banner.classList.remove("is-visible"), 1800);
  }

  function showInspect(text, screenX, screenY) {
    inspectPopup.textContent = text;
    inspectPopup.style.left = `${screenX}px`;
    inspectPopup.style.top = `${screenY}px`;
    inspectPopup.classList.add("is-visible");
    if (inspectTimeout) clearTimeout(inspectTimeout);
    inspectTimeout = setTimeout(() => inspectPopup.classList.remove("is-visible"), 1300);
  }

  function toggleMenu() {
    menuOpen = !menuOpen;
    menuPanel.classList.toggle("is-open", menuOpen);
  }

  function saveGame() {
    const payload = {
      timestamp: Date.now(),
      player: { x: player.x, y: player.y, monsters: player.monsters, items: player.items },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  }

  function loadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data?.player) {
        player.x = clamp(Number(data.player.x) || player.x, 0, WORLD_WIDTH - player.w);
        player.y = clamp(Number(data.player.y) || player.y, 0, WORLD_HEIGHT - player.h);
        player.monsters = Array.isArray(data.player.monsters) ? data.player.monsters : [];
        player.items = Array.isArray(data.player.items) ? data.player.items : [];
      }
    } catch (_) {
      // ignore bad save
    }
  }

  function isBlocked(nextX, nextY) {
    const nextRect = { x: nextX, y: nextY, w: player.w, h: player.h };
    return solids.some((solid) => intersects(nextRect, solid));
  }

  function startCornerGlide(targetX, targetY) {
    const duration = 0.06;
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    cornerGlide.active = true;
    cornerGlide.timeLeft = duration;
    cornerGlide.vx = dx / duration;
    cornerGlide.vy = dy / duration;
  }

  function runCornerGlide(dt) {
    if (!cornerGlide.active) return false;
    const step = Math.min(dt, cornerGlide.timeLeft);
    player.x = clamp(player.x + cornerGlide.vx * step, 0, WORLD_WIDTH - player.w);
    player.y = clamp(player.y + cornerGlide.vy * step, 0, WORLD_HEIGHT - player.h);
    cornerGlide.timeLeft -= step;
    if (cornerGlide.timeLeft <= 0) {
      cornerGlide.active = false;
    }
    return true;
  }

  function attemptAxisMoveWithSlip(nextX, nextY, axis) {
    if (!isBlocked(nextX, nextY)) {
      player.x = nextX;
      player.y = nextY;
      return true;
    }

    const maxSlip = TILE * 0.5;
    const slipStep = 2;
    for (let slip = slipStep; slip <= maxSlip; slip += slipStep) {
      if (axis === "x") {
        const upY = clamp(player.y - slip, 0, WORLD_HEIGHT - player.h);
        if (!isBlocked(nextX, upY)) {
          startCornerGlide(nextX, upY);
          return true;
        }
        const downY = clamp(player.y + slip, 0, WORLD_HEIGHT - player.h);
        if (!isBlocked(nextX, downY)) {
          startCornerGlide(nextX, downY);
          return true;
        }
      } else {
        const leftX = clamp(player.x - slip, 0, WORLD_WIDTH - player.w);
        if (!isBlocked(leftX, nextY)) {
          startCornerGlide(leftX, nextY);
          return true;
        }
        const rightX = clamp(player.x + slip, 0, WORLD_WIDTH - player.w);
        if (!isBlocked(rightX, nextY)) {
          startCornerGlide(rightX, nextY);
          return true;
        }
      }
    }
    return false;
  }

  function movePlayerWithSlip(vx, vy) {
    const nextX = clamp(player.x + vx, 0, WORLD_WIDTH - player.w);
    attemptAxisMoveWithSlip(nextX, player.y, "x");

    const nextY = clamp(player.y + vy, 0, WORLD_HEIGHT - player.h);
    attemptAxisMoveWithSlip(player.x, nextY, "y");
  }

  function updateCamera() {
    camera.x = clamp(player.x + player.w / 2 - camera.width / 2, 0, WORLD_WIDTH - camera.width);
    camera.y = clamp(player.y + player.h / 2 - camera.height / 2, 0, WORLD_HEIGHT - camera.height);
  }

  function handleMovement(dt) {
    if (inputSuspended) return;
    if (runCornerGlide(dt)) return;

    if (touchWalkActive && touchWalkTarget) {
      const playerCenterX = player.x + player.w / 2;
      const playerCenterY = player.y + player.h / 2;
      const dx = touchWalkTarget.x - playerCenterX;
      const dy = touchWalkTarget.y - playerCenterY;
      const dist = Math.hypot(dx, dy);
      if (dist > 2) {
        const vx = (dx / dist) * player.speed * dt;
        const vy = (dy / dist) * player.speed * dt;
        movePlayerWithSlip(vx, vy);
      }
      return;
    }

    let xAxis = 0;
    let yAxis = 0;
    if (keysDown.has("KeyA")) xAxis -= 1;
    if (keysDown.has("KeyD")) xAxis += 1;
    if (keysDown.has("KeyW")) yAxis -= 1;
    if (keysDown.has("KeyS")) yAxis += 1;
    if (xAxis === 0 && yAxis === 0) return;
    const mag = Math.hypot(xAxis, yAxis);
    const vx = (xAxis / mag) * player.speed * dt;
    const vy = (yAxis / mag) * player.speed * dt;
    movePlayerWithSlip(vx, vy);
  }

  function describeAt(worldX, worldY) {
    const pointRect = { x: worldX, y: worldY, w: 1, h: 1 };
    const found = solids.find((obj) => intersects(pointRect, obj));
    if (found) {
      if (found.type === "building") return "Building";
      if (found.type === "tree") return "Tree";
      if (found.type === "rock") return "Boulder";
    }
    for (const patch of grassPatches) {
      if (intersects(pointRect, patch)) return "Tall Grass";
    }
    const zone = zones.find(
      (z) => worldX >= z.x && worldX <= z.x + z.w && worldY >= z.y && worldY <= z.y + z.h,
    );
    if (zone?.id.startsWith("town")) return "Town Ground";
    if (zone?.id === "route_1") return "Route Ground";
    return "Unknown";
  }

  function drawWorld() {
    ctx.clearRect(0, 0, camera.width, camera.height);

    // base world
    ctx.fillStyle = "#89c77a";
    ctx.fillRect(0, 0, camera.width, camera.height);

    // town gray areas
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    for (const tg of townGround) {
      ctx.fillStyle = tg.color;
      ctx.fillRect(tg.x, tg.y, tg.w, tg.h);
    }

    // sinusoidal route path
    ctx.strokeStyle = "#d2b487";
    ctx.lineWidth = TILE * 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(routeCorridor[0].x, routeCorridor[0].y);
    for (let i = 1; i < routeCorridor.length; i += 1) {
      ctx.lineTo(routeCorridor[i].x, routeCorridor[i].y);
    }
    ctx.stroke();

    // goldenrod patches
    for (const patch of grassPatches) {
      ctx.fillStyle = patch.color;
      ctx.fillRect(patch.x, patch.y, patch.w, patch.h);
    }

    // debug grid
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 1;
    for (let col = 0; col <= WORLD_COLS; col += 1) {
      const x = col * TILE;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let row = 0; row <= WORLD_ROWS; row += 1) {
      const y = row * TILE;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_WIDTH, y);
      ctx.stroke();
    }

    for (const solid of solids) {
      ctx.fillStyle = solid.color;
      ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
    }

    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x + player.w / 2, player.y + player.h / 2, player.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function updateZoneLabel() {
    const zone = getPlayerZone();
    if (zone && zone.id !== currentZoneId) {
      currentZoneId = zone.id;
      showZoneBanner(zone.name);
    }
  }

  function onKeyDown(event) {
    if (inputSuspended) {
      if (document.hasFocus()) {
        resumeInput();
      } else {
        return;
      }
    }
    if (event.code === "KeyE") {
      event.preventDefault();
      toggleMenu();
      return;
    }
    if (event.code === "KeyW" || event.code === "KeyA" || event.code === "KeyS" || event.code === "KeyD") {
      event.preventDefault();
      keysDown.add(event.code);
    }
  }

  function onKeyUp(event) {
    keysDown.delete(event.code);
  }

  function suspendInput() {
    inputSuspended = true;
    keysDown.clear();
  }

  function resumeInput() {
    inputSuspended = false;
    keysDown.clear();
  }

  function onCanvasClick(event) {
    if (ignoreNextClick) {
      ignoreNextClick = false;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    const canvasX = cssX * scaleX;
    const canvasY = cssY * scaleY;
    const worldX = camera.x + canvasX;
    const worldY = camera.y + canvasY;
    const thing = describeAt(worldX, worldY);
    showInspect(`${thing} (${Math.floor(worldX)}, ${Math.floor(worldY)})`, cssX, cssY);
  }

  function touchToWorld(touch) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cssX = touch.clientX - rect.left;
    const cssY = touch.clientY - rect.top;
    return {
      worldX: camera.x + cssX * scaleX,
      worldY: camera.y + cssY * scaleY,
      cssX,
      cssY,
    };
  }

  function onTouchStart(event) {
    if (event.touches.length !== 1) return;
    const now = performance.now();
    const touch = event.touches[0];
    const pos = touchToWorld(touch);
    const tappedNearLast =
      lastTapPos && Math.hypot(pos.cssX - lastTapPos.cssX, pos.cssY - lastTapPos.cssY) < 26;

    // Double-tap toggles menu
    if (now - lastTapAt < 300 && tappedNearLast) {
      toggleMenu();
      touchWalkActive = false;
      touchWalkTarget = null;
      lastTapAt = 0;
      lastTapPos = null;
      ignoreNextClick = true;
      event.preventDefault();
      return;
    }

    lastTapAt = now;
    lastTapPos = { cssX: pos.cssX, cssY: pos.cssY };
    touchWalkActive = true;
    touchWalkTarget = { x: pos.worldX, y: pos.worldY };
    ignoreNextClick = true;
    event.preventDefault();
  }

  function onTouchMove(event) {
    if (!touchWalkActive || event.touches.length !== 1) return;
    const pos = touchToWorld(event.touches[0]);
    touchWalkTarget = { x: pos.worldX, y: pos.worldY };
    event.preventDefault();
  }

  function onTouchEnd() {
    touchWalkActive = false;
    touchWalkTarget = null;
  }

  buildWorld();
  loadGame();
  updateCamera();
  updateZoneLabel();
  drawWorld();

  setInterval(saveGame, 5000);
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", suspendInput);
  window.addEventListener("focus", resumeInput);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      suspendInput();
    }
  });
  window.addEventListener("contextmenu", suspendInput);
  window.addEventListener("pointerdown", () => {
    if (inputSuspended && document.hasFocus()) {
      resumeInput();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!menuOpen) return;
    if (!menuPanel.contains(event.target)) {
      menuOpen = false;
      menuPanel.classList.remove("is-open");
    }
  });
  canvas.addEventListener("click", onCanvasClick);
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd, { passive: true });
  canvas.addEventListener("touchcancel", onTouchEnd, { passive: true });

  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    handleMovement(dt);
    updateCamera();
    updateZoneLabel();
    drawWorld();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
