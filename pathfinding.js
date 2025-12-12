// src/pathfinding.js

export class PathFinder {
    constructor(grid, gridWidth, gridHeight) {
        this.grid = grid;
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;
    }

    // 判断一个格子是不是 walkable
    isWalkable(x, y) {
        if (x < 0 || x >= this.gridWidth) return false;
        if (y < 0 || y >= this.gridHeight) return false;

        const cell = this.grid[y][x];
        // null 表示空地 → 可以走；有设施就不能走
        return cell === null;
    }

    // A* 主函数：从 (sx,sy) → (ex,ey)
    findPath(sx, sy, ex, ey) {
        // ⭐ Allow starting from facility tiles (visitors leave from there)
        const startOnFacility = !this.isWalkable(sx, sy);
        
        const open = [];
        const closed = new Set();

        // 数据结构：每个 node = { x, y, g, h, f, parent }
        const startNode = { x: sx, y: sy, g: 0, h: this.heuristic(sx, sy, ex, ey), parent: null };
        startNode.f = startNode.g + startNode.h;

        open.push(startNode);

        while (open.length > 0) {
            // 找到 f 最小的 node
            open.sort((a, b) => a.f - b.f);
            const current = open.shift();
            const key = `${current.x},${current.y}`;
            closed.add(key);

            // 到终点了
            if (current.x === ex && current.y === ey) {
                return this.reconstructPath(current);
            }

            // 四方向邻居
            const neighbors = [
                { x: current.x + 1, y: current.y },
                { x: current.x - 1, y: current.y },
                { x: current.x,     y: current.y + 1 },
                { x: current.x,     y: current.y - 1 }
            ];

            for (const nb of neighbors) {
                const nk = `${nb.x},${nb.y}`;
                const isEnd = (nb.x === ex && nb.y === ey);
                const isStart = (nb.x === sx && nb.y === sy);

                // ⭐ Start and end tiles can be facilities; middle tiles must be walkable
                if (!isEnd && !isStart && !this.isWalkable(nb.x, nb.y)) continue;
                if (closed.has(nk)) continue;

                const g = current.g + 1;
                const h = this.heuristic(nb.x, nb.y, ex, ey);
                const f = g + h;

                const exist = open.find(n => n.x === nb.x && n.y === nb.y);
                if (exist && exist.g <= g) continue;

                open.push({
                    x: nb.x,
                    y: nb.y,
                    g,
                    h,
                    f,
                    parent: current
                });
            }
        }

        return null; // 无路可走
    }

    // 曼哈顿距离
    heuristic(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    reconstructPath(node) {
        const path = [];
        while (node) {
            path.push({ x: node.x, y: node.y });
            node = node.parent;
        }
        return path.reverse();
    }
}