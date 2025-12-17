// src/game.js
import * as THREE from 'https://unpkg.com/three@0.164.0/build/three.module.js';
import { createAttractionMesh } from './attraction.js';
import { Visitor } from './visitor.js';
import { PathFinder } from './pathfinding.js';
import { getFacilityConfig } from './facilities.js';

export const Game = {
  scene: null,
  ground: null,
  gridWidth: 20,
  gridHeight: 20,
  grid: [],

  money: 10000,
  reputation: 0,
  happiness: 50,
  visitorCount: 0,

  selectedAttractionType: null,
  selectedAttractionCost: 0,

  visitors: [],
  spawnTimer: 0,
  spawnInterval: 1,
 baseSpawnInterval: 5,   // 声望为 0 时的基础间隔（秒）
  minSpawnInterval: 1.5,  // 最快刷怪（间隔下限）
  maxSpawnInterval: 8,    // 最慢刷怪（间隔上限）
  entranceGridX: 10,
  entranceGridY: 19,
  exitGridX: 10,
  exitGridY: 0,

  pathfinder: null,

  init(scene, ground) {
    this.scene = scene;
    this.ground = ground;

    this._initGrid();

    this.entranceGridX = Math.floor(this.gridWidth / 2);
    this.entranceGridY = this.gridHeight - 1;
    this.exitGridX = Math.floor(this.gridWidth / 2);
    this.exitGridY = 0;

    this.pathfinder = new PathFinder(this.grid, this.gridWidth, this.gridHeight);

    this._bindUI();
    this._updateUI();
    this._createEntranceExitMarkers();
  },

  _initGrid() {
    this.grid = [];
    for (let y = 0; y < this.gridHeight; y++) {
      const row = [];
      for (let x = 0; x < this.gridWidth; x++) row.push(null);
      this.grid.push(row);
    }
  },

  _gridToWorld(gridX, gridY) {
    const worldX = gridX * 2 - this.gridWidth;   // -20 .. +20
    const worldZ = gridY * 2 - this.gridHeight;
    return { worldX, worldZ };
  },

  _entranceWorldPos() {
    return this._gridToWorld(this.entranceGridX, this.entranceGridY);
  },

  _exitWorldPos() {
    return this._gridToWorld(this.exitGridX, this.exitGridY);
  },

  _createEntranceExitMarkers() {
    const entrancePos = this._entranceWorldPos();
    const exitPos = this._exitWorldPos();

    const makeMarker = (pos, color) => {
      const geo = new THREE.CylinderGeometry(0.7, 0.7, 0.1, 20);
      const mat = new THREE.MeshStandardMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.worldX, 0.05, pos.worldZ);
      mesh.rotation.x = -Math.PI / 2;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    };

    makeMarker(entrancePos, 0x4caf50);
    makeMarker(exitPos, 0xf44336);
  },

  _bindUI() {
    const buttons = document.querySelectorAll('.btn-attraction');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const cost = parseInt(btn.dataset.cost, 10);

        buttons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        this.selectedAttractionType = type;
        this.selectedAttractionCost = cost;

        const info = document.getElementById('info');
        if (info) {
          info.textContent = `Placing: ${type} (Cost: $${cost}) - click on the ground`;
        }
      });
    });
  },

  _updateUI() {
    const mSpan = document.getElementById('money');
    const rSpan = document.getElementById('reputation');
    const hSpan = document.getElementById('happiness');
    const vSpan = document.getElementById('visitor-count');
    const sSpan = document.getElementById('spawn-interval');

    if (mSpan) mSpan.textContent = Math.round(this.money);
      if (rSpan) {
    const rep = Math.round(this.reputation);
    rSpan.textContent = rep;
    if (rep < 0) rSpan.style.color = '#f44336';
    else if (rep > 50) rSpan.style.color = '#4caf50';
    else rSpan.style.color = '#fff';
  }
    if (hSpan) hSpan.textContent = Math.round(this.happiness);
    if (vSpan) vSpan.textContent = this.visitorCount;
    if (sSpan) sSpan.textContent = this.spawnInterval.toFixed(1);

    const updateButton = (selector, label) => {
      const btn = document.querySelector(selector);
      if (!btn) return;
      const cost = parseInt(btn.dataset.cost, 10);
      const locked = this.money < cost;
      btn.disabled = locked;
      btn.textContent = `${label} - $${cost}` + (locked ? ' [Locked]' : '');
    };

    updateButton("button[data-type='food']", '🍔 Food Stall');
    updateButton("button[data-type='carousel']", '🎠 Carousel');
    updateButton("button[data-type='ferris']", '🎡 Ferris Wheel');

    const selectedBtn = document.querySelector('.btn-attraction.selected');
    if (selectedBtn && selectedBtn.disabled) {
      selectedBtn.classList.remove('selected');
      this.selectedAttractionType = null;
      this.selectedAttractionCost = 0;
      const info = document.getElementById('info');
      if (info) info.textContent = 'Click on the ground to place attractions';
    }
  },

  canPlace(gridX, gridY) {
  // 1. 基本边界检查
  if (gridX < 0 || gridX >= this.gridWidth) return false;
  if (gridY < 0 || gridY >= this.gridHeight) return false;

  // 入口 / 出口不能放
  if ((gridX === this.entranceGridX && gridY === this.entranceGridY) ||
      (gridX === this.exitGridX && gridY === this.exitGridY)) {
    return false;
  }

  // 这一格必须是空的
  if (this.grid[gridY][gridX] !== null) return false;

  // 没选东西就别放
  if (!this.selectedAttractionType) return false;

  // 映射：类型 -> 可视尺寸（和 attraction.js 保持一致）
  const getVisualSize = (type) => {
    if (type === 'carousel') return 1.5;
    if (type === 'ferris')   return 3.5;
    return 1.2; // food 或默认
  };

  // 新设施的尺寸
  const newSize = getVisualSize(this.selectedAttractionType);

  // 2. 缓冲区检查：只要"新设施或邻居设施有一个是大于 1.8 的"，
  //    就不允许它们贴在一起（包括斜角相邻）
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      // 自己这格会在上面已经检查为空了，这里主要看周围
      const nx = gridX + dx;
      const ny = gridY + dy;

      if (nx < 0 || nx >= this.gridWidth || ny < 0 || ny >= this.gridHeight) {
        continue; // 允许靠墙，如果不想靠墙，可以在这里 return false
      }

      const existing = this.grid[ny][nx];
      if (!existing) continue; // 空的没事

      // 已有设施的可视尺寸
      const existingSize = getVisualSize(existing.type);
      if (newSize > 1.8 || existingSize > 1.8) {
        return false;
      }
    }
  }

  return true;
},


  // 找设施旁边一个可走的格子作为"游玩位置"
  _findWalkableNeighbor(fx, fy) {
    const dirs = [
      { x: fx + 1, y: fy },
      { x: fx - 1, y: fy },
      { x: fx,     y: fy + 1 },
      { x: fx,     y: fy - 1 }
    ];
    for (const c of dirs) {
      if (c.x < 0 || c.x >= this.gridWidth || c.y < 0 || c.y >= this.gridHeight) continue;
      if (this.grid[c.y][c.x] === null) return c;
    }
    return null;
  },

  placeAttraction(gridX, gridY) {
  if (!this.selectedAttractionType) return;
  if (!this.canPlace(gridX, gridY)) return;
  if (this.money < this.selectedAttractionCost) return;

  const cfg = getFacilityConfig(this.selectedAttractionType);

  const { worldX, worldZ } = this._gridToWorld(gridX, gridY);
  const mesh = createAttractionMesh(this.selectedAttractionType);

  // 设施很薄，高度 0.1，所以 y 放在 0.05
  mesh.position.set(worldX, cfg.height / 2, worldZ);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  this.scene.add(mesh);

  const facility = {
    type: cfg.type,
    gridX,
    gridY,
    mesh,
    income: cfg.income,
    happinessGain: cfg.happinessGain,
    playDuration: cfg.playDuration,
    capacity: cfg.capacity,
    currentPlayers: 0,
    playTile: { x: gridX, y: gridY }
  };

  this.grid[gridY][gridX] = facility;

  this.money -= this.selectedAttractionCost;
  this.happiness = Math.min(100, this.happiness + 1);
  this._updateUI();
  this._updateFacilityPanel();

},


  _getAllFacilities() {
    const result = [];
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const cell = this.grid[y][x];
        if (cell) result.push(cell);
      }
    }
    return result;
  },


    // 调试用：返回所有设施的状态
  getFacilityStates() {
    return this._getAllFacilities().map(f => ({
      type: f.type,
      gridX: f.gridX,
      gridY: f.gridY,
      capacity: f.capacity,
      currentPlayers: f.currentPlayers
    }));
  },

  _manhattan(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  },


  
_chooseFacilityTarget(visitor, startX, startY, options = {}) {
  const { skipLastType = true, excludeFacility = null } = options;

  const facilities = this._getAllFacilities().filter(f => f.playTile);
  if (facilities.length === 0) return null;

  const candidates = [];
  let totalWeight = 0;

  for (const f of facilities) {
    const pt = f.playTile;

    // ① 排除指定的设施（比如刚刚满员的那一家）
    if (excludeFacility && f === excludeFacility) {
      continue;
    }

    // ② 容量 / 拥挤度处理
    const cap = f.capacity ?? 1;
    const cur = f.currentPlayers ?? 0;

    // cap 不合理 或 已经满员 → 直接不考虑这个设施
    if (cap <= 0 || cur >= cap) {
      continue;
    }

    // 拥挤度（0 ~ 1）
    const crowd = cur / cap;
    // 拥挤惩罚：越挤，这个值越大
    const crowdCost = 1 + crowd * 3;   // 0 人 → 1；接近满 → 4

    // ③ 是否跳过“与上一次同类型”的设施
    if (skipLastType && visitor.lastType && f.type === visitor.lastType) {
      continue;
    }

    // ④ 距离 / 偏好 / 质量 / 随机
    const dist = this._manhattan(startX, startY, pt.x, pt.y);
    const distanceCost = 1 + dist;

    const pref = visitor.preference?.[f.type] ?? 1.0;   // 游客对这个类型的偏好
    const quality = f.happinessGain ?? 1;               // 设施本身“质量”

    const randomFactor = 0.5 + Math.random();           // 0.5 ~ 1.5 随机扰动

    // 核心评分：偏好 * 质量，除以 距离 和 拥挤度 的惩罚
    const baseScore = (pref * quality) / (distanceCost * crowdCost);
    const weight = Math.max(0, baseScore * randomFactor);

    if (weight <= 0) continue;

    candidates.push({ x: pt.x, y: pt.y, weight });
    totalWeight += weight;
  }

  if (!candidates.length || totalWeight <= 0) return null;

  // ⑤ 按权重随机抽一个，分数高的概率大
  let r = Math.random() * totalWeight;
  for (const c of candidates) {
    if (r <= c.weight) {
      return { x: c.x, y: c.y };
    }
    r -= c.weight;
  }

  const last = candidates[candidates.length - 1];
  return { x: last.x, y: last.y };
},
_calculateSpawnInterval() {
  const baseInterval = 4;      // 声望0时的基准：4秒
  const minInterval = 2;       // 最快（声望很高）：2秒
  const maxInterval = 6;       // 最慢（声望很低）：6秒
  
  // 定义声望的"满值"
  const maxPositiveRep = 100;  // 声望+100时达到最快(2秒)
  const maxNegativeRep = -50;  // 声望-50时达到最慢(6秒)
  
  let interval;
  
  if (this.reputation >= 0) {
    // ✅ 正声望：从 4秒 → 2秒（越火爆游客来得越快）
    const factor = Math.min(1, this.reputation / maxPositiveRep);
    interval = baseInterval - factor * (baseInterval - minInterval);
    // rep=0:   4 - 0*(4-2) = 4秒
    // rep=50:  4 - 0.5*(4-2) = 3秒
    // rep=100: 4 - 1*(4-2) = 2秒
    
  } else {
    // ❌ 负声望：从 4秒 → 6秒（口碑差游客来得慢）
    const factor = Math.min(1, Math.abs(this.reputation) / Math.abs(maxNegativeRep));
    interval = baseInterval + factor * (maxInterval - baseInterval);
    // rep=0:   4 + 0*(6-4) = 4秒
    // rep=-25: 4 + 0.5*(6-4) = 5秒
    // rep=-50: 4 + 1*(6-4) = 6秒
  }
  
  return interval;
}


,
_spawnVisitor() {
  const { worldX: sx, worldZ: sz } = this._entranceWorldPos();
  const start = { x: this.entranceGridX, y: this.entranceGridY };
  const exit  = { x: this.exitGridX,      y: this.exitGridY };

  // 先创建 visitor（无路径）
  const v = new Visitor(
    sx, sz,
    [],
    this.scene,
    (visitor, gx, gy) => this._onVisitorEnterTile(visitor, gx, gy)
  );

  // 用这个游客的偏好选一个设施
  const facilityTarget = this._chooseFacilityTarget(v, start.x, start.y);

  const waypoints = [start];
  if (facilityTarget) waypoints.push(facilityTarget);
  waypoints.push(exit);

  let fullPath = [];
  let ok = true;
  let current = waypoints[0];

  for (let i = 1; i < waypoints.length; i++) {
    const next = waypoints[i];
    const seg = this.pathfinder.findPath(current.x, current.y, next.x, next.y);
    if (!seg) { ok = false; break; }
    if (fullPath.length > 0) seg.shift();
    fullPath = fullPath.concat(seg);
    current = next;
  }

  if (!ok || fullPath.length === 0) {
    const direct = this.pathfinder.findPath(start.x, start.y, exit.x, exit.y) || [];
    fullPath = direct;
  }

  v.setPath(fullPath);
  this.visitors.push(v);
  this.visitorCount++;
  this._updateUI();
}

,

  _findFacilityAtTile(gx, gy) {
    const facilities = this._getAllFacilities();
    for (const f of facilities) {
      if (f.playTile && f.playTile.x === gx && f.playTile.y === gy) return f;
    }
    return null;
  },

_onVisitorEnterTile(visitor, gx, gy) {
  if (visitor.finished || visitor.playing) return;

  const facility = this._findFacilityAtTile(gx, gy);
  if (!facility) return;

  const cap = facility.capacity ?? 1;
  const cur = facility.currentPlayers ?? 0;

  // ================
  // A. 设施已满：重排路线
  // ================
  if (cur >= cap) {
    // 当前格子作为新的起点
    const start = { x: gx, y: gy };
    const exit  = { x: this.exitGridX, y: this.exitGridY };

    // ⭐ 用“允许同 type，但不能同一座”的规则选下一家
    const nextTarget = this._chooseFacilityTarget(
      visitor,
      gx,
      gy,
      {
        skipLastType: false,        // 类型可以重复
        excludeFacility: facility   // 但不能还是这一个设施
      }
    );

    // 如果完全没有其它设施可选：
    // 这里你说“不能直接离开公园”，那我们就什么都不改，让它继续走原来的 path
    if (!nextTarget) {
      return;
    }

    // 有下一家 → 从当前格子 → 下一家 → 再接回出口
    const waypoints = [start, nextTarget, exit];

    let fullPath = [];
    let ok = true;
    let current = waypoints[0];

    for (let i = 1; i < waypoints.length; i++) {
      const nxt = waypoints[i];
      const seg = this.pathfinder.findPath(current.x, current.y, nxt.x, nxt.y);
      if (!seg) { ok = false; break; }
      if (fullPath.length > 0) seg.shift();
      fullPath = fullPath.concat(seg);
      current = nxt;
    }

    if (ok && fullPath.length > 0) {
      visitor.setPath(fullPath);
    }
    // 不进入 playing，直接 return
    return;
  }

  // ================
  // B. 有空位：正常进场玩
  // ================
  facility.currentPlayers = cur + 1;

  visitor.playing = true;
  visitor.playTimer = facility.playDuration;
  visitor.currentFacility = facility;
  this._updateFacilityPanel();


  // 记录这次真正玩的设施
  visitor.lastFacility = facility;
  visitor.lastType = facility.type;

  // 视觉上站在设施中心
  visitor.mesh.position.x = facility.mesh.position.x;
  visitor.mesh.position.z = facility.mesh.position.z;
}



,

update(deltaTime) {
  // 生成新游客
  this.reputation = Math.max(-50, this.reputation - deltaTime * 0.1);
  this.spawnInterval = this._calculateSpawnInterval();
  this.spawnTimer += deltaTime;
  if (this.spawnTimer >= this.spawnInterval) {
    this.spawnTimer -= this.spawnInterval;
    this._spawnVisitor();
  }

  // 更新所有游客
  for (let i = this.visitors.length - 1; i >= 0; i--) {
    const v = this.visitors[i];

    if (v.playing) {
      // 正在玩设施：只减计时
      v.playTimer -= deltaTime;

if (v.playTimer <= 0 && v.currentFacility) {
  const f = v.currentFacility;

  // 释放一个名额
  f.currentPlayers = Math.max(0, (f.currentPlayers ?? 0) - 1);
  this._updateFacilityPanel();

  v.playing = false;
  v.currentFacility = null;

  // 结算收入 / 全局快乐 / 声望（简单版）
  this.money += f.income;
  this.happiness = Math.min(100, this.happiness + f.happinessGain);
  this.reputation += 0.5;

  // ⭐ 更新游客个人的快乐值
  // 根据偏好调整快乐值增长
  const pref = v.preference?.[f.type] ?? 1.0;
  const happinessChange = f.happinessGain * pref;
  v.happiness = Math.max(0, Math.min(100, v.happiness + happinessChange));
  
  // 记录刚刚玩的设施类型
  v.lastType = f.type;

  // -------------------------------------------------
  // 1️⃣ 找到设施旁边的空地格子，直接从那里开始规划
  // -------------------------------------------------
  let startX, startY;

  const fx = f.gridX;
  const fy = f.gridY;
  const escapeTile = this._findWalkableNeighbor(fx, fy);

  if (escapeTile) {
    startX = escapeTile.x;
    startY = escapeTile.y;
    
    const escapeWorld = this._gridToWorld(startX, startY);
    v.mesh.position.x = escapeWorld.worldX;
    v.mesh.position.z = escapeWorld.worldZ;
  } else {
    startX = v.lastGridX ?? this.exitGridX;
    startY = v.lastGridY ?? this.exitGridY;
  }

  const start = { x: startX, y: startY };
  const exit = { x: this.exitGridX, y: this.exitGridY };

  // -------------------------------------------------
  // 2️⃣ 根据游客快乐值决定行为：
  //    - happiness > 80: 非常满意，直接离开
  //    - happiness < 20: 非常不满，直接离开
  //    - 20 ≤ happiness ≤ 80: 继续找设施玩
  // -------------------------------------------------
  let fullPath = [];

  const shouldLeave = v.happiness > 80 || v.happiness < 20;

  if (shouldLeave) {
    // 快乐值过高或过低 → 直接去出口
    fullPath = this.pathfinder.findPath(start.x, start.y, exit.x, exit.y) || [];
  } else {
    // 快乐值在正常范围 → 继续找设施玩
    const nextTarget = this._chooseFacilityTarget(v, start.x, start.y);

    const waypoints = [start];
    if (nextTarget) waypoints.push(nextTarget);
    waypoints.push(exit);

    let ok = true;
    let current = waypoints[0];

    for (let j = 1; j < waypoints.length; j++) {
      const nxt = waypoints[j];
      const seg = this.pathfinder.findPath(current.x, current.y, nxt.x, nxt.y);
      if (!seg) { ok = false; break; }
      if (fullPath.length > 0) seg.shift();
      fullPath = fullPath.concat(seg);
      current = nxt;
    }

    if (!ok || fullPath.length === 0) {
      const direct =
        this.pathfinder.findPath(start.x, start.y, exit.x, exit.y) || [];
      fullPath = direct;
    }
  }

  // -------------------------------------------------
  // 3️⃣ 设置新路径
  // -------------------------------------------------
  v.setPath(fullPath);
  this._updateUI();
}

    } else {
      // 不在玩设施 → 按路径走
      v.update(deltaTime);
    }

    // 走到路径终点（通常是出口）后删除游客
    if (v.finished) {
  // ⭐ 根据快乐值给予奖惩
  if (v.happiness < 20) {
    // 很不满意 → 扣声望
        this.reputation -= 1;
  } else if (v.happiness > 80) {
    // 很满意 → 加声望
    this.reputation += 1;
  }
  
  this.scene.remove(v.mesh);
  this.visitors.splice(i, 1);
  this._updateUI();
}
  }
}
,
  // 在右侧面板显示每个设施的 当前人数 / 容量
_updateFacilityPanel() {
    const container = document.getElementById('facility-list');
    if (!container) return;

    const list = this._getAllFacilities();
    if (!list.length) {
      container.textContent = 'No facilities yet';
      return;
    }

    // 用简单的 HTML 列表展示
    const html = list.map((f, i) => {
      const name =
        f.type === 'food' ? '🍔 Food' :
        f.type === 'carousel' ? '🎠 Carousel' :
        f.type === 'ferris' ? '🎡 Ferris' :
        f.type;
      return `
        <div class="facility-row">
          <span>#${i + 1} ${name}</span>
          <span>(${f.gridX}, ${f.gridY})</span>
          <span>${f.currentPlayers} / ${f.capacity}</span>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

};