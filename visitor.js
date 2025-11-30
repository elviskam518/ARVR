// src/visitor.js
import * as THREE from 'https://unpkg.com/three@0.164.0/build/three.module.js';

export class Visitor {
  constructor(startWorldX, startWorldZ, gridPath, scene, onEnterTile) {
    this.scene = scene;
    this.gridPath = gridPath || [];
    this.currentIndex = 0;
    this.finished = false;

    this.speed = 3;

    // 玩设施状态
    this.playing = false;
    this.playTimer = 0;
    this.currentFacility = null;

    // 只玩一次：玩过就不再玩
    this.hasPlayed = false;

    // ⭐ 每个游客自己的偏好（0.5 ~ 1.1）
    this.preference = {
      food:     0.5 + Math.random() * 0.6,
      carousel: 0.5 + Math.random() * 0.6,
      ferris:   0.5 + Math.random() * 0.6
    };

    const geo = new THREE.SphereGeometry(0.25, 12, 12); // 高约 0.5
    const mat = new THREE.MeshStandardMaterial({ color: 0xff66aa });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;

    this.baseY = 0.25;
    this.mesh.position.set(startWorldX, this.baseY, startWorldZ);
    scene.add(this.mesh);

    this.onEnterTile = onEnterTile;
  }

  // 允许 Game 重新设定路径
  setPath(newGridPath) {
    this.gridPath = newGridPath || [];
    this.currentIndex = 0;
    this.finished = false;
  }

  // 网格 → 世界坐标（和 Game 一致）
  gridToWorld(gx, gy) {
    const wx = gx * 2 - 20;
    const wz = gy * 2 - 20;
    return new THREE.Vector3(wx, this.baseY, wz);
  }

  update(dt) {
    // 在玩 / 已结束就不走路
    if (this.finished || this.playing) return;

    if (!this.gridPath.length || this.currentIndex >= this.gridPath.length) {
      this.finished = true;
      return;
    }

    const targetGrid = this.gridPath[this.currentIndex];
    const targetPos = this.gridToWorld(targetGrid.x, targetGrid.y);
    const pos = this.mesh.position;
    const dir = new THREE.Vector3().subVectors(targetPos, pos);
    const dist = dir.length();

    if (dist < 0.05) {
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
