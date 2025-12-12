// src/main.js
import * as THREE from 'https://unpkg.com/three@0.164.0/build/three.module.js';
import { Game } from './game.js';

let scene, camera, renderer, ground, raycaster, mouse;
let lastTime = 0;

let previewMesh = null;

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = 50;
  camera = new THREE.OrthographicCamera(
    (frustumSize * aspect) / -2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    frustumSize / -2,
    1,
    1000
  );
  camera.position.set(0, 50, 0);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.getElementById('game-container').appendChild(renderer.domElement);

  addLights();
  createGround();
  createBoundaries();

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  window.addEventListener('resize', onWindowResize);
  renderer.domElement.addEventListener('click', onMouseClick);

  // ⭐ 新增：鼠标移动显示预览
  renderer.domElement.addEventListener('mousemove', onMouseMove);

  Game.init(scene, ground);

  lastTime = performance.now();
  animate();
}

function addLights() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(10, 20, 10);
  dir.castShadow = true;
  dir.shadow.camera.left = -30;
  dir.shadow.camera.right = 30;
  dir.shadow.camera.top = 30;
  dir.shadow.camera.bottom = -30;
  scene.add(dir);
}

function createGround() {
  const geo = new THREE.PlaneGeometry(40, 40);
  const mat = new THREE.MeshStandardMaterial({ color: 0x90ee90, roughness: 0.8 });
  ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  const gridHelper = new THREE.GridHelper(40, 20, 0x000000, 0x444444);
  gridHelper.position.y = 0.01;
  scene.add(gridHelper);
}

function createBoundaries() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
  const walls = [
    { pos: [0, 1, -20], rot: [0, 0, 0], size: [40, 2, 1] },
    { pos: [0, 1,  20], rot: [0, 0, 0], size: [40, 2, 1] },
    { pos: [-20, 1, 0], rot: [0, Math.PI / 2, 0], size: [40, 2, 1] },
    { pos: [ 20, 1, 0], rot: [0, Math.PI / 2, 0], size: [40, 2, 1] }
  ];
  walls.forEach(w => {
    const geo = new THREE.BoxGeometry(...w.size);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...w.pos);
    mesh.rotation.set(...w.rot);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  });
}

function onMouseClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(ground);
  if (!hits.length) return;

  const p = hits[0].point;
  // 反推网格坐标：要和 Game._gridToWorld 对应（每格 2 units）
  const gridX = Math.round((p.x + 20) / 2);
  const gridY = Math.round((p.z + 20) / 2);

  Game.placeAttraction(gridX, gridY);
}

function onMouseMove(event) {
  // 没选中任何设施 → 不显示预览
  if (!Game.selectedAttractionType) {
    if (previewMesh) {
      scene.remove(previewMesh);
      previewMesh = null;
    }
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(ground);
  if (!hits.length) return;

  const p = hits[0].point;
  const gridX = Math.round((p.x + 20) / 2);
  const gridY = Math.round((p.z + 20) / 2);

  showPreview(gridX, gridY);
}

// ⭐ 新增：预览方块（绿色/红色），尺寸和设施一致
function showPreview(gridX, gridY) {
  if (previewMesh) {
    scene.remove(previewMesh);
    previewMesh = null;
  }

  // 和 attraction.js 的 size 对应
  let size = 1.2;
  if (Game.selectedAttractionType === 'carousel') size = 1.5;
  if (Game.selectedAttractionType === 'ferris') size = 3.5;

  const canPlace = Game.canPlace(gridX, gridY);
  const canAfford = Game.money >= Game.selectedAttractionCost;
  const ok = canPlace && canAfford;

  const geometry = new THREE.BoxGeometry(size, 2, size);
  const material = new THREE.MeshStandardMaterial({
    color: ok ? 0x00ff00 : 0xff0000,
    transparent: true,
    opacity: 0.5
  });

  previewMesh = new THREE.Mesh(geometry, material);

  // 注意：这里用的世界坐标要和 grid 公式一致
  const worldX = gridX * 2 - 20;
  const worldZ = gridY * 2 - 20;
  previewMesh.position.set(worldX, 1, worldZ);

  scene.add(previewMesh);
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  Game.update(dt);
  renderer.render(scene, camera);
}

function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = 50;
  camera.left = (frustumSize * aspect) / -2;
  camera.right = (frustumSize * aspect) / 2;
  camera.top = frustumSize / 2;
  camera.bottom = frustumSize / -2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('DOMContentLoaded', init);
