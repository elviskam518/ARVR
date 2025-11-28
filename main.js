// src/main.js
import * as THREE from 'three';
import { Game } from './game.js';

// ============================================
// Three.js 基础设置
// ============================================

let scene, camera, renderer;
let ground, raycaster, mouse;

function init() {
    console.log('Initializing Three.js...');
    
    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // 天空蓝
    
    // 创建相机（正交相机，俯视图）
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
    camera.position.set(0, 50, 0); // 从上往下看
    camera.lookAt(0, 0, 0);
    
    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-container').appendChild(renderer.domElement);
    
    // 添加光源
    addLights();
    
    // 创建地面
    createGround();
    
    // 创建边界
    createBoundaries();
    
    // 设置射线检测（用于鼠标点击）
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    // 监听事件
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('click', onMouseClick);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    
    // 初始化游戏逻辑（Game 来自 game.js）
    Game.init(scene, ground);
    
    // 开始渲染循环
    animate();
    
    console.log('Three.js initialized successfully!');
}

function addLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    scene.add(directionalLight);
}

function createGround() {
    const groundGeometry = new THREE.PlaneGeometry(40, 40);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x90EE90,
        roughness: 0.8
    });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground';
    scene.add(ground);
    
    const gridHelper = new THREE.GridHelper(40, 20, 0x000000, 0x444444);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);
}

function createBoundaries() {
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    
    const walls = [
        { pos: [0, 1, -20], rot: [0, 0, 0], size: [40, 2, 1] }, // 北
        { pos: [0, 1, 20], rot: [0, 0, 0], size: [40, 2, 1] },  // 南
        { pos: [-20, 1, 0], rot: [0, Math.PI / 2, 0], size: [40, 2, 1] }, // 西
        { pos: [20, 1, 0], rot: [0, Math.PI / 2, 0], size: [40, 2, 1] }   // 东
    ];
    
    walls.forEach(wall => {
        const geometry = new THREE.BoxGeometry(...wall.size);
        const mesh = new THREE.Mesh(geometry, wallMaterial);
        mesh.position.set(...wall.pos);
        mesh.rotation.set(...wall.rot);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
    });
}

// ============================================
// 鼠标交互
// ============================================

let previewMesh = null;

function onMouseClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(ground);
    
    if (intersects.length > 0) {
        const point = intersects[0].point;
        
        // 使用与 gridToWorld 完全对应的逆运算
        const gridX = Math.round((point.x + 20 - 1) / 2);
        const gridY = Math.round((point.z + 20 - 1) / 2);
        
        console.log(`Clicked at grid: (${gridX}, ${gridY})`);
        
        Game.placeAttraction(gridX, gridY);
    }
}

function onMouseMove(event) {
    // 如果现在没有选中的游乐设施，就把预览清掉
    if (!Game.selectedAttractionType) {
        if (previewMesh) {
            scene.remove(previewMesh);
            previewMesh = null;
        }
        return;
    }
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(ground);
    
    if (intersects.length > 0) {
        const point = intersects[0].point;
        const gridX = Math.round((point.x + 20 - 1) / 2);
        const gridY = Math.round((point.z + 20 - 1) / 2);
        
        showPreview(gridX, gridY);
    }
}

function showPreview(gridX, gridY) {
    if (previewMesh) {
        scene.remove(previewMesh);
    }
    
    const worldX = gridX * 2 - 20 + 1;
    const worldZ = gridY * 2 - 20 + 1;

    const canPlaceHere = Game.canPlace(gridX, gridY);
    const canAfford = Game.money >= Game.selectedAttractionCost;
    const ok = canPlaceHere && canAfford; // 两个都满足才是绿色
    
    const geometry = new THREE.BoxGeometry(1.5, 2, 1.5);
    const material = new THREE.MeshStandardMaterial({
        color: ok ? 0x00FF00 : 0xFF0000,
        transparent: true,
        opacity: 0.5
    });
    
    previewMesh = new THREE.Mesh(geometry, material);
    previewMesh.position.set(worldX, 1, worldZ);
    scene.add(previewMesh);
}

// ============================================
// 渲染循环
// ============================================

let lastTime = Date.now();

function animate() {
    requestAnimationFrame(animate);
    
    const currentTime = Date.now();
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    Game.update(deltaTime);
    
    renderer.render(scene, camera);
}

// ============================================
// 窗口大小调整
// ============================================

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

// ============================================
// 启动游戏
// ============================================

window.addEventListener('DOMContentLoaded', init);

window.addEventListener('DOMContentLoaded', () => {
    const uiPanel = document.getElementById('ui-panel');
    const toggleBtn = document.getElementById('toggle-ui');

    if (!uiPanel || !toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        uiPanel.classList.toggle('collapsed');

        // 面板折叠时，按钮箭头朝右；展开时箭头朝左
        if (uiPanel.classList.contains('collapsed')) {
            toggleBtn.textContent = '⮞';
        } else {
            toggleBtn.textContent = '⮜';
        }
    });
});
