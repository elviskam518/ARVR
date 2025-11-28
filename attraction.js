import * as THREE from 'three';

export function createAttractionMesh(type) {
    let color = 0xffffff;
    let height = 2;
    let size = 1.5;   // ⭐ 默认占 1 格宽度

    switch (type) {
        case 'food':
            color = 0xffc107;
            height = 1.5;
            size = 1.5;
            break;
        case 'carousel':
            color = 0x2196f3;
            height = 2.5;
            size = 1.5;
            break;
        case 'ferris':
            color = 0x9c27b0;
            height = 3;
            size = 3.5;   // ⭐ 宽和深都变大 ≈ 2 个格子的视觉宽度
            break;
        default:
            color = 0xffffff;
            size = 1.5;
    }
    
    const geometry = new THREE.BoxGeometry(size, height, size);
    const material = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
}
