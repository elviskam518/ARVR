// src/game.js
import * as THREE from 'three';
import { createAttractionMesh } from './attraction.js';
import { Visitor } from './visitor.js';
import { PathFinder } from './pathfinding.js';

export const Game = {
    scene: null,
    ground: null,
    gridWidth: 20,
    gridHeight: 20,
    grid: [],
    // ⭐ 记录每个格子是否是某个设施的“可游玩位置”
    playTileGrid: [],
    
    money: 1000,
    reputation: 0,
    happiness: 50,
    visitorCount: 0,
    
    selectedAttractionType: null,
    selectedAttractionCost: 0,

    visitors: [],
    spawnTimer: 0,
    spawnInterval: 4,
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
        this.playTileGrid = [];

        for (let y = 0; y < this.gridHeight; y++) {
            const row = [];
            const playRow = [];
            for (let x = 0; x < this.gridWidth; x++) {
                row.push(null);
                playRow.push(null);
            }
            this.grid.push(row);
            this.playTileGrid.push(playRow);
        }
    },

    _gridToWorld(gridX, gridY) {
        const worldX = gridX * 2 - 20 + 1;
        const worldZ = gridY * 2 - 20 + 1;
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

        const entranceGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.1, 20);
        const entranceMat = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
        const entranceMesh = new THREE.Mesh(entranceGeo, entranceMat);
        entranceMesh.position.set(entrancePos.worldX, 0.05, entrancePos.worldZ);
        entranceMesh.rotation.x = -Math.PI / 2;
        entranceMesh.receiveShadow = true;
        this.scene.add(entranceMesh);

        const exitGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.1, 20);
        const exitMat = new THREE.MeshStandardMaterial({ color: 0xf44336 });
        const exitMesh = new THREE.Mesh(exitGeo, exitMat);
        exitMesh.position.set(exitPos.worldX, 0.05, exitPos.worldZ);
        exitMesh.rotation.x = -Math.PI / 2;
        exitMesh.receiveShadow = true;
        this.scene.add(exitMesh);
    },
    
    _bindUI() {
        const attractionButtons = document.querySelectorAll('.btn-attraction');
        attractionButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                const cost = parseInt(btn.dataset.cost, 10);
                
                attractionButtons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                
                this.selectedAttractionType = type;
                this.selectedAttractionCost = cost;
                
                const info = document.getElementById('info');
                if (info) {
                    info.textContent = `Placing: ${type} (Cost: $${cost}) - click on the ground`;
                }
            });
        });
        
        const heatmapBtn = document.getElementById('btn-heatmap');
        if (heatmapBtn) {
            heatmapBtn.addEventListener('click', () => {
                console.log('Toggle heatmap (TODO)');
            });
        }

        const accessibleBtn = document.getElementById('btn-accessible');
        if (accessibleBtn) {
            accessibleBtn.addEventListener('click', () => {
                console.log('Show accessible routes (TODO)');
            });
        }
    },
    
    _updateUI() {
        const mSpan = document.getElementById('money');
        const rSpan = document.getElementById('reputation');
        const hSpan = document.getElementById('happiness');
        const vSpan = document.getElementById('visitor-count');

        if (mSpan) mSpan.textContent = this.money;
        if (rSpan) rSpan.textContent = this.reputation;
        if (hSpan) hSpan.textContent = this.happiness;
        if (vSpan) vSpan.textContent = this.visitorCount;

        const foodBtn = document.querySelector("button[data-type='food']");
        const carouselBtn = document.querySelector("button[data-type='carousel']");
        const ferrisBtn = document.querySelector("button[data-type='ferris']");

        if (foodBtn) {
            const cost = parseInt(foodBtn.dataset.cost, 10);
            foodBtn.disabled = this.money < cost;
            foodBtn.textContent = foodBtn.disabled
                ? `🍔 Food Stall - $${cost} [Locked]`
                : `🍔 Food Stall - $${cost}`;
        }

        if (carouselBtn) {
            const cost = parseInt(carouselBtn.dataset.cost, 10);
            carouselBtn.disabled = this.money < cost;
            carouselBtn.textContent = carouselBtn.disabled
                ? `🎠 Carousel - $${cost} [Locked]`
                : `🎠 Carousel - $${cost}`;
        }

        if (ferrisBtn) {
            const cost = parseInt(ferrisBtn.dataset.cost, 10);
            ferrisBtn.disabled = this.money < cost;
            ferrisBtn.textContent = ferrisBtn.disabled
                ? `🎡 Ferris Wheel - $${cost} [Locked]`
                : `🎡 Ferris Wheel - $${cost}`;
        }

        const selectedBtn = document.querySelector('.btn-attraction.selected');
        if (selectedBtn && selectedBtn.disabled) {
            selectedBtn.classList.remove('selected');
            this.selectedAttractionType = null;
            this.selectedAttractionCost = 0;
            const info = document.getElementById('info');
            if (info) info.textContent = 'Click on the ground to place attractions';
        }
    },
    
    // 单格检查（可能其他地方会用到）
    canPlace(gridX, gridY) {
        if (gridX < 0 || gridX >= this.gridWidth) return false;
        if (gridY < 0 || gridY >= this.gridHeight) return false;

        if ((gridX === this.entranceGridX && gridY === this.entranceGridY) ||
            (gridX === this.exitGridX && gridY === this.exitGridY)) {
            return false;
        }

        return this.grid[gridY][gridX] === null;
    },

    // 矩形区域能不能放下（w×h 设施）
    _canPlaceRect(gridX, gridY, w, h) {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const x = gridX + dx;
                const y = gridY + dy;
                if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) {
                    return false;
                }
                if (this.grid[y][x] !== null) {
                    return false;
                }
                if ((x === this.entranceGridX && y === this.entranceGridY) ||
                    (x === this.exitGridX && y === this.exitGridY)) {
                    return false;
                }
            }
        }
        return true;
    },

    // 按类型固定颜色
    _updateFacilityColor(cell) {
        if (!cell || !cell.mesh || !cell.mesh.material) return;

        let color;
        switch (cell.type) {
            case 'food':
                color = 0xffc107; // 金黄
                break;
            case 'carousel':
                color = 0x2196f3; // 蓝
                break;
            case 'ferris':
                color = 0x9c27b0; // 紫
                break;
            default:
                color = 0x4caf50; // 默认绿
        }
        cell.mesh.material.color.setHex(color);
    },

    placeAttraction(gridX, gridY) {
        if (!this.selectedAttractionType) return;

        // ⭐ 设施尺寸：food / carousel 1×1，ferris 2×2
        let sizeW = 1;
        let sizeH = 1;
        if (this.selectedAttractionType === 'ferris') {
            sizeW = 2;
            sizeH = 2;
        }

        if (!this._canPlaceRect(gridX, gridY, sizeW, sizeH)) {
            console.log('Cannot place here (rect blocked).');
            return;
        }

        if (this.money < this.selectedAttractionCost) {
            console.log('Not enough money.');
            return;
        }
        
        const { worldX, worldZ } = this._gridToWorld(gridX, gridY);
        
        const mesh = createAttractionMesh(this.selectedAttractionType);
        mesh.position.set(worldX, 1, worldZ);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        let income = 20;
        let happinessGain = 2;
        let playDuration = 2;
        let capacity = 3;

        if (this.selectedAttractionType === 'carousel') {
            income = 40;
            happinessGain = 4;
            playDuration = 3;
            capacity = 5;
        } else if (this.selectedAttractionType === 'ferris') {
            income = 60;
            happinessGain = 6;
            playDuration = 4;
            capacity = 8;
        }
        
        // ⭐ 主设施对象（放在左上角 cell 上）
        const facility = {
            type: this.selectedAttractionType,
            mesh,
            income,
            happinessGain,
            playDuration,
            capacity,
            currentPlayers: 0,
            sizeW,
            sizeH,
            playTiles: []
        };

        // 占用矩形区域：左上角是主 cell，其余是 part
        for (let dy = 0; dy < sizeH; dy++) {
            for (let dx = 0; dx < sizeW; dx++) {
                const gx2 = gridX + dx;
                const gy2 = gridY + dy;

                if (dx === 0 && dy === 0) {
                    this.grid[gy2][gx2] = facility;
                } else {
                    this.grid[gy2][gx2] = {
                        isPart: true,
                        parent: facility
                    };
                }
            }
        }

        // ⭐ 在设施下面一排，按宽度生成可游玩格子（playTiles）
        const playY = gridY + sizeH;
        if (playY >= 0 && playY < this.gridHeight) {
            for (let dx = 0; dx < sizeW; dx++) {
                const px = gridX + dx;
                if (this.grid[playY][px] === null) {
                    facility.playTiles.push({ x: px, y: playY });
                    this.playTileGrid[playY][px] = facility;
                }
            }
        }

        this._updateFacilityColor(facility);
        
        this.money -= this.selectedAttractionCost;
        this.reputation += 1;
        this.happiness = Math.min(100, this.happiness + 1);
        this._updateUI();
    },

    _getAllFacilities() {
        const result = [];
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const cell = this.grid[y][x];
                if (cell && !cell.isPart) { // 只算主设施
                    result.push({ x, y, cell });
                }
            }
        }
        return result;
    },

    _findWalkableNeighbor(fx, fy) {
        const candidates = [
            { x: fx + 1, y: fy },
            { x: fx - 1, y: fy },
            { x: fx,     y: fy + 1 },
            { x: fx,     y: fy - 1 }
        ];

        for (const c of candidates) {
            if (c.x < 0 || c.x >= this.gridWidth || c.y < 0 || c.y >= this.gridHeight) continue;
            if (this.grid[c.y][c.x] === null) {
                return c;
            }
        }
        return null;
    },

    // 曼哈顿距离
    _manhattan(ax, ay, bx, by) {
        return Math.abs(ax - bx) + Math.abs(ay - by);
    },

    // ⭐ 计算某个设施对当前游客的“吸引力分数”
    _scoreFacility(startX, startY, fx, fy, cell) {
        if (!cell.playTiles || cell.playTiles.length === 0) return 0;

        // 在所有 playTiles 中找一个离游客最近的
        let bestTarget = null;
        let bestDist = Infinity;
        for (const pt of cell.playTiles) {
            const d = this._manhattan(startX, startY, pt.x, pt.y);
            if (d < bestDist) {
                bestDist = d;
                bestTarget = pt;
            }
        }

        const distance = bestDist;
        const quality = (cell.happinessGain || 1);

        const cap = cell.capacity || 1;
        const cur = cell.currentPlayers || 0;
        const crowd = cur / cap;    // 0 ~ 1

        const distanceCost = distance + 1;
        const crowdCost = 1 + crowd * 2;
        const score = quality / (distanceCost * crowdCost);

        return { score, targetX: bestTarget.x, targetY: bestTarget.y };
    },

    // ⭐ 从所有设施中挑一个“最值得去”的目标
    _chooseFacilityTarget(startX, startY) {
        const facilities = this._getAllFacilities();
        if (facilities.length === 0) return null;

        let bestScore = 0;
        let bestTarget = null;

        for (const f of facilities) {
            const { x: fx, y: fy, cell } = f;
            const result = this._scoreFacility(startX, startY, fx, fy, cell);
            if (!result) continue;

            if (result.score > bestScore) {
                bestScore = result.score;
                bestTarget = { x: result.targetX, y: result.targetY };
            }
        }

        if (!bestTarget || bestScore < 0.05) {
            return null;
        }

        return bestTarget;
    },

    _spawnVisitor() {
        const { worldX: sx, worldZ: sz } = this._entranceWorldPos();

        const entrance = { x: this.entranceGridX, y: this.entranceGridY };
        const exit     = { x: this.exitGridX,      y: this.exitGridY };

        const waypoints = [entrance];

        const facilityTarget = this._chooseFacilityTarget(entrance.x, entrance.y);
        if (facilityTarget) {
            waypoints.push(facilityTarget);
        }

        waypoints.push(exit);

        let fullPath = [];
        let ok = true;
        let current = waypoints[0];

        for (let i = 1; i < waypoints.length; i++) {
            const next = waypoints[i];
            const segment = this.pathfinder.findPath(current.x, current.y, next.x, next.y);
            if (!segment) {
                ok = false;
                break;
            }
            if (fullPath.length > 0) segment.shift();
            fullPath = fullPath.concat(segment);
            current = next;
        }

        if (!ok || fullPath.length === 0) {
            const direct = this.pathfinder.findPath(entrance.x, entrance.y, exit.x, exit.y);
            if (!direct) {
                console.warn('No path found at all for visitor');
                return;
            }
            fullPath = direct;
        }

        const v = new Visitor(
            sx,
            sz,
            fullPath,
            this.scene,
            (visitor, gx, gy) => this._onVisitorEnterTile(visitor, gx, gy)
        );

        this.visitors.push(v);
        this.visitorCount += 1;
        this._updateUI();
    },

    _onVisitorEnterTile(visitor, gx, gy) {
        if (visitor.finished || visitor.playing) return;

        visitor.lastGridX = gx;
        visitor.lastGridY = gy;

        if (gy < 0 || gy >= this.gridHeight || gx < 0 || gx >= this.gridWidth) return;

        // ⭐ 只从 playTileGrid 中查这个格子对应的设施
        let foundCell = this.playTileGrid[gy][gx];
        if (!foundCell) return;

        if (foundCell.isPart && foundCell.parent) {
            foundCell = foundCell.parent;
        }

        // 已经玩过这种 type
        if (visitor.playedTypes && visitor.playedTypes.has(foundCell.type)) {
            return;
        }

        const cap = foundCell.capacity || 1;
        const cur = foundCell.currentPlayers || 0;
        if (cur >= cap) {
            return;
        }

        // ⭐ 100% 会玩（只要有空位）
        if (visitor.playedTypes) {
            visitor.playedTypes.add(foundCell.type);
        }

        foundCell.currentPlayers = (foundCell.currentPlayers || 0) + 1;
        this._updateFacilityColor(foundCell);

        visitor.playing = true;
        visitor.playTimer = foundCell.playDuration || 2;
        visitor.currentFacility = foundCell;

        const gain = foundCell.happinessGain || 1;

        if (visitor.happiness == null) visitor.happiness = 50;
        visitor.happiness = Math.max(0, Math.min(100, visitor.happiness + gain));

        this.happiness = Math.min(100, this.happiness + gain);

        this.money += foundCell.income || 10;
        this.reputation += 0.5;

        this._updateUI();
    },
    
    update(deltaTime) {
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer -= this.spawnInterval;
            this._spawnVisitor();
        }

        for (let i = this.visitors.length - 1; i >= 0; i--) {
            const v = this.visitors[i];

            if (v.playing) {
                v.playTimer -= deltaTime;
                if (v.playTimer <= 0) {
                    v.playing = false;

                    if (v.currentFacility) {
                        v.currentFacility.currentPlayers =
                            Math.max(0, (v.currentFacility.currentPlayers || 0) - 1);
                        this._updateFacilityColor(v.currentFacility);
                        v.currentFacility = null;
                    }

                    // ⭐ happiness 在 (20, 80) 之间 → 再找一个设施
                    const h = v.happiness ?? 50;
                    if (h > 20 && h < 80) {
                        const startX = v.lastGridX ?? this.exitGridX;
                        const startY = v.lastGridY ?? this.exitGridY;

                        const waypoints = [{ x: startX, y: startY }];
                        const facilityTarget = this._chooseFacilityTarget(startX, startY);
                        if (facilityTarget) {
                            waypoints.push(facilityTarget);
                        }
                        waypoints.push({ x: this.exitGridX, y: this.exitGridY });

                        let newPath = [];
                        let ok = true;
                        let current = waypoints[0];

                        for (let j = 1; j < waypoints.length; j++) {
                            const next = waypoints[j];
                            const segment = this.pathfinder.findPath(current.x, current.y, next.x, next.y);
                            if (!segment) {
                                ok = false;
                                break;
                            }
                            if (newPath.length > 0) segment.shift();
                            newPath = newPath.concat(segment);
                            current = next;
                        }

                        if (ok && newPath.length > 0 && typeof v.setPath === 'function') {
                            v.setPath(newPath);
                            continue;
                        }
                    }
                }
                continue;
            }

            v.update(deltaTime);

            if (v.finished) {
                if (v.currentFacility) {
                    v.currentFacility.currentPlayers =
                        Math.max(0, (v.currentFacility.currentPlayers || 0) - 1);
                    this._updateFacilityColor(v.currentFacility);
                    v.currentFacility = null;
                }

                this.scene.remove(v.mesh);
                this.visitors.splice(i, 1);
            }
        }
    }
};
