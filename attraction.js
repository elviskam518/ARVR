// src/attraction.js
import * as THREE from 'https://unpkg.com/three@0.164.0/build/three.module.js';
import { getFacilityConfig } from './facilities.js';

export function createAttractionMesh(type) {
  const cfg = getFacilityConfig(type);

  const geometry = new THREE.BoxGeometry(cfg.size, cfg.height, cfg.size);
  const material = new THREE.MeshStandardMaterial({ color: cfg.color });
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}
