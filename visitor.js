// src/visitor.js
import * as THREE from 'three';

export class Visitor {
    // onEnterTile: 每次到达路径格子中心时回调
    constructor(startWorldX, startWorldZ, gridPath, scene, onEnterTile) {
        this.scene = scene;
        this.speed = 3;

        const geo = new THREE.SphereGeometry(0.4, 12, 12);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff66aa });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.mesh.position.set(startWorldX, 0.4, startWorldZ);
        scene.add(this.mesh);

        // 路径相关
        this.gridPath = gridPath;   // [{x,y}, ...]
        this.currentIndex = 0;
        this.finished = false;

        // ⭐ 游客个人 happiness
        this.happiness = 50;

        // 玩设施状态
        this.playing = false;
        this.playTimer = 0;

        // 已经玩过的设施 type
        this.playedTypes = new Set();

        // 当前正在玩的具体设施
        this.currentFacility = null;

        // 最近一次所在的网格（给 Game 重新规划路径用）
        this.lastGridX = null;
        this.lastGridY = null;

        this.onEnterTile = onEnterTile;
    }

    // ⭐ 允许 Game 在游客玩完后重新设定路径
    setPath(newGridPath) {
        this.gridPath = newGridPath || [];
        this.currentIndex = 0;
        this.finished = false;
    }

    // 网格坐标 → 世界坐标（保持和 Game 一致）
    gridToWorld(gx, gy) {
        const wx = gx * 2 - 20 + 1;
        const wz = gy * 2 - 20 + 1;
        return new THREE.Vector3(wx, 0.4, wz);
    }

    update(dt) {
        if (this.finished) return;

        // 玩设施时不移动，计时由 Game 控制
        if (this.playing) {
            return;
        }

        if (!this.gridPath || this.gridPath.length === 0) {
            this.finished = true;
            return;
        }

        if (this.currentIndex >= this.gridPath.length) {
            this.finished = true;
            return;
        }

        const targetGrid = this.gridPath[this.currentIndex];
        const targetPos = this.gridToWorld(targetGrid.x, targetGrid.y);

        const pos = this.mesh.position;
        const dir = new THREE.Vector3().subVectors(targetPos, pos);
        const dist = dir.length();

        if (dist < 0.05) {
            // ⭐ 记录当前位置网格
            this.lastGridX = targetGrid.x;
            this.lastGridY = targetGrid.y;

            // 这一帧视为进入这个格子
            if (this.onEnterTile) {
                this.onEnterTile(this, targetGrid.x, targetGrid.y);
            }

            this.currentIndex++;
            if (this.currentIndex >= this.gridPath.length) {
                this.finished = true;
            }
            return;
        }

        dir.normalize();
        pos.addScaledVector(dir, this.speed * dt);
    }
}
