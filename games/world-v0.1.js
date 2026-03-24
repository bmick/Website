"use strict";

(function initWorldGame() {
  const canvas = document.getElementById("world-canvas");
  const banner = document.getElementById("zone-banner");
  if (!canvas || !banner) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const TILE = 32;
  const WORLD_COLS = 40;
  const WORLD_ROWS = 70;
  const WORLD_WIDTH = WORLD_COLS * TILE;
  const WORLD_HEIGHT = WORLD_ROWS * TILE;

  const camera = {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
  };

  const player = {
    x: WORLD_WIDTH / 2 - 12,
    y: WORLD_HEIGHT - TILE * 8,
    w: 24,
    h: 24,
    speed: 190,
    color: "#1e6dff",
  };

  const keysDown = new Set();

  const zones = [
    { id: "town_a", name: "Starter Town", x: 0, y: TILE * 50, w: WORLD_WIDTH, h: TILE * 20 },
    { id: "route_1", name: "Route 1", x: 0, y: TILE * 18, w: WORLD_WIDTH, h: TILE * 32 },
    { id: "town_b", name: "North City", x: 0, y: 0, w: WORLD_WIDTH, h: TILE * 18 },
  ];

  const groundPatches = [];
  const solids = [];

  function addRect(list, x, y, w, h, color) {
    list.push({ x, y, w, h, color });
  }

  function buildWorld() {
    // Town A buildings (4)
    addRect(solids, TILE * 4, TILE * 58, TILE * 5, TILE * 4, "#b33b3b");
    addRect(solids, TILE * 12, TILE * 56, TILE * 6, TILE * 5, "#bf4040");
    addRect(solids, TILE * 24, TILE * 57, TILE * 5, TILE * 4, "#a83333");
    addRect(solids, TILE * 31, TILE * 55, TILE * 5, TILE * 5, "#c44848");

    // Town B buildings (5), larger spread
    addRect(solids, TILE * 3, TILE * 3, TILE * 6, TILE * 5, "#b53c3c");
    addRect(solids, TILE * 13, TILE * 2, TILE * 5, TILE * 4, "#aa3636");
    addRect(solids, TILE * 21, TILE * 4, TILE * 6, TILE * 5, "#be4545");
    addRect(solids, TILE * 30, TILE * 2, TILE * 6, TILE * 4, "#a12f2f");
    addRect(solids, TILE * 33, TILE * 10, TILE * 5, TILE * 4, "#c44d4d");

    // Route grass patches (visual only)
    addRect(groundPatches, TILE * 3, TILE * 22, TILE * 5, TILE * 4, "#5ea64f");
    addRect(groundPatches, TILE * 29, TILE * 26, TILE * 6, TILE * 4, "#4f9a45");
    addRect(groundPatches, TILE * 6, TILE * 33, TILE * 4, TILE * 3, "#68b85a");
    addRect(groundPatches, TILE * 27, TILE * 36, TILE * 6, TILE * 5, "#5ba350");
    addRect(groundPatches, TILE * 10, TILE * 43, TILE * 5, TILE * 4, "#509946");

    // Trees / bushes along route (including 2x2, 3x3)
    const treeColors = ["#2c7a35", "#2f8b3d", "#347f44", "#246f31"];
    const bushColors = ["#4b934b", "#56a056", "#4f9a54"];
    addRect(solids, TILE * 0, TILE * 19, TILE * 3, TILE * 3, treeColors[0]);
    addRect(solids, TILE * 37, TILE * 20, TILE * 3, TILE * 3, treeColors[1]);
    addRect(solids, TILE * 1, TILE * 28, TILE * 2, TILE * 2, treeColors[2]);
    addRect(solids, TILE * 35, TILE * 30, TILE * 2, TILE * 2, treeColors[0]);
    addRect(solids, TILE * 2, TILE * 39, TILE * 3, TILE * 3, treeColors[3]);
    addRect(solids, TILE * 34, TILE * 41, TILE * 3, TILE * 3, treeColors[1]);
    addRect(solids, TILE * 1, TILE * 46, TILE * 2, TILE * 2, bushColors[0]);
    addRect(solids, TILE * 36, TILE * 47, TILE * 2, TILE * 2, bushColors[1]);
    addRect(solids, TILE * 7, TILE * 24, TILE * 1, TILE * 1, bushColors[2]);
    addRect(solids, TILE * 30, TILE * 40, TILE * 1, TILE * 1, bushColors[0]);

    // Boulders
    const rockColors = ["#835c35", "#8f6438", "#7a5630", "#9a7041"];
    addRect(solids, TILE * 8, TILE * 20, TILE * 2, TILE * 1, rockColors[0]);
    addRect(solids, TILE * 30, TILE * 23, TILE * 2, TILE * 1, rockColors[1]);
    addRect(solids, TILE * 9, TILE * 31, TILE * 2, TILE * 1, rockColors[2]);
    addRect(solids, TILE * 29, TILE * 35, TILE * 2, TILE * 1, rockColors[3]);
    addRect(solids, TILE * 11, TILE * 44, TILE * 2, TILE * 1, rockColors[0]);
    addRect(solids, TILE * 28, TILE * 46, TILE * 2, TILE * 1, rockColors[2]);
  }

  buildWorld();

  const routePathPoints = [
    { x: TILE * 20, y: TILE * 49 },
    { x: TILE * 11, y: TILE * 43 },
    { x: TILE * 30, y: TILE * 36 },
    { x: TILE * 9, y: TILE * 30 },
    { x: TILE * 28, y: TILE * 24 },
    { x: TILE * 20, y: TILE * 18 },
  ];

  let currentZoneId = "";
  let bannerTimeout = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function showZoneBanner(text) {
    banner.textContent = text;
    banner.classList.add("is-visible");
    if (bannerTimeout) clearTimeout(bannerTimeout);
    bannerTimeout = setTimeout(() => {
      banner.classList.remove("is-visible");
    }, 1800);
  }

  function getPlayerZone() {
    const center = {
      x: player.x + player.w / 2,
      y: player.y + player.h / 2,
    };
    for (const zone of zones) {
      const inZone =
        center.x >= zone.x &&
        center.x <= zone.x + zone.w &&
        center.y >= zone.y &&
        center.y <= zone.y + zone.h;
      if (inZone) return zone;
    }
    return null;
  }

  function isBlocked(nextX, nextY) {
    const nextRect = { x: nextX, y: nextY, w: player.w, h: player.h };
    return solids.some((solid) => intersects(nextRect, solid));
  }

  function handleMovement(dt) {
    let xAxis = 0;
    let yAxis = 0;
    if (keysDown.has("ArrowLeft") || keysDown.has("KeyA")) xAxis -= 1;
    if (keysDown.has("ArrowRight") || keysDown.has("KeyD")) xAxis += 1;
    if (keysDown.has("ArrowUp") || keysDown.has("KeyW")) yAxis -= 1;
    if (keysDown.has("ArrowDown") || keysDown.has("KeyS")) yAxis += 1;

    if (xAxis === 0 && yAxis === 0) return;

    const magnitude = Math.hypot(xAxis, yAxis);
    const velocityX = (xAxis / magnitude) * player.speed * dt;
    const velocityY = (yAxis / magnitude) * player.speed * dt;

    const nextX = clamp(player.x + velocityX, 0, WORLD_WIDTH - player.w);
    if (!isBlocked(nextX, player.y)) {
      player.x = nextX;
    }

    const nextY = clamp(player.y + velocityY, 0, WORLD_HEIGHT - player.h);
    if (!isBlocked(player.x, nextY)) {
      player.y = nextY;
    }
  }

  function updateCamera() {
    camera.x = clamp(player.x + player.w / 2 - camera.width / 2, 0, WORLD_WIDTH - camera.width);
    camera.y = clamp(player.y + player.h / 2 - camera.height / 2, 0, WORLD_HEIGHT - camera.height);
  }

  function drawGround() {
    ctx.fillStyle = "#89c77a";
    ctx.fillRect(0, 0, camera.width, camera.height);
  }

  function drawRoutePath() {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    ctx.strokeStyle = "#d2b487";
    ctx.lineWidth = TILE * 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(routePathPoints[0].x, routePathPoints[0].y);
    for (let i = 1; i < routePathPoints.length; i += 1) {
      ctx.lineTo(routePathPoints[i].x, routePathPoints[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawPatches() {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    for (const patch of groundPatches) {
      ctx.fillStyle = patch.color;
      ctx.fillRect(patch.x, patch.y, patch.w, patch.h);
    }
    ctx.restore();
  }

  function drawSolids() {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    for (const solid of solids) {
      ctx.fillStyle = solid.color;
      ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
    }
    ctx.restore();
  }

  function drawGrid() {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
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
    ctx.restore();
  }

  function drawPlayer() {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, camera.width, camera.height);
    drawGround();
    drawRoutePath();
    drawPatches();
    drawGrid(); // debug grid visible for now
    drawSolids();
    drawPlayer();
  }

  function updateZoneLabel() {
    const zone = getPlayerZone();
    if (!zone) return;
    if (zone.id !== currentZoneId) {
      currentZoneId = zone.id;
      showZoneBanner(zone.name);
    }
  }

  function onKeyDown(event) {
    if (
      event.code === "ArrowUp" ||
      event.code === "ArrowDown" ||
      event.code === "ArrowLeft" ||
      event.code === "ArrowRight" ||
      event.code === "KeyW" ||
      event.code === "KeyA" ||
      event.code === "KeyS" ||
      event.code === "KeyD"
    ) {
      event.preventDefault();
      keysDown.add(event.code);
    }
  }

  function onKeyUp(event) {
    keysDown.delete(event.code);
  }

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);

  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    handleMovement(dt);
    updateCamera();
    updateZoneLabel();
    render();

    requestAnimationFrame(frame);
  }

  updateCamera();
  updateZoneLabel();
  render();
  requestAnimationFrame(frame);
})();
