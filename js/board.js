/** Board geometry: 3 concentric horizontal rectangles + 4 spokes. */

export const BOARD = {
  viewBox: { w: 800, h: 560 },
  cx: 400,
  cy: 280,
  rects: [
    { w: 720, h: 480 },
    { w: 480, h: 320 },
    { w: 240, h: 160 },
  ],
};

/** @typedef {{ id: string, x: number, y: number }} Node */

/** @returns {{ nodes: Node[], edges: [string, string][] }} */
export function buildBoardGraph() {
  const { cx, cy, rects } = BOARD;
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();

  const addNode = (id, x, y) => {
    if (!nodeMap.has(id)) {
      const node = { id, x, y };
      nodeMap.set(id, node);
      nodes.push(node);
    }
    return id;
  };

  const addEdge = (a, b) => {
    if (a !== b) edges.push([a, b]);
  };

  const rectNodes = rects.map((rect, ri) => {
    const halfW = rect.w / 2;
    const halfH = rect.h / 2;
    const prefix = `r${ri}`;
    const ids = {
      tl: addNode(`${prefix}-tl`, cx - halfW, cy - halfH),
      tm: addNode(`${prefix}-tm`, cx, cy - halfH),
      tr: addNode(`${prefix}-tr`, cx + halfW, cy - halfH),
      rm: addNode(`${prefix}-rm`, cx + halfW, cy),
      br: addNode(`${prefix}-br`, cx + halfW, cy + halfH),
      bm: addNode(`${prefix}-bm`, cx, cy + halfH),
      bl: addNode(`${prefix}-bl`, cx - halfW, cy + halfH),
      lm: addNode(`${prefix}-lm`, cx - halfW, cy),
    };

    addEdge(ids.tl, ids.tm);
    addEdge(ids.tm, ids.tr);
    addEdge(ids.tr, ids.rm);
    addEdge(ids.rm, ids.br);
    addEdge(ids.br, ids.bm);
    addEdge(ids.bm, ids.bl);
    addEdge(ids.bl, ids.lm);
    addEdge(ids.lm, ids.tl);

    return ids;
  });

  const sides = ["tm", "rm", "bm", "lm"];
  for (const side of sides) {
    const outer = rectNodes[0][side];
    const middle = rectNodes[1][side];
    const inner = rectNodes[2][side];
    addEdge(outer, middle);
    addEdge(middle, inner);
  }

  return { nodes, edges };
}

/** @param {[string, string][]} edges @param {Node[]} nodes */
export function edgesToSegments(edges, nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set();
  const segments = [];

  for (const [a, b] of edges) {
    const key = [a, b].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const na = byId.get(a);
    const nb = byId.get(b);
    if (na && nb) segments.push({ x1: na.x, y1: na.y, x2: nb.x, y2: nb.y });
  }
  return segments;
}
