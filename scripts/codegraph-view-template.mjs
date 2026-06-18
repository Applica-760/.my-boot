const KIND_COLORS = {
  class: '#3b82f6',
  function: '#22c55e',
  method: '#14b8a6',
  interface: '#a855f7',
  enum: '#f59e0b',
  variable: '#6b7280',
  property: '#ec4899',
  type_alias: '#06b6d4',
  module: '#8b5cf6',
  namespace: '#8b5cf6',
};

const EDGE_COLORS = {
  calls: '#3b82f6',
  imports: '#22c55e',
  extends: '#f97316',
  implements: '#a855f7',
  references: '#9ca3af',
  type_of: '#14b8a6',
  contains: '#6b7280',
  overrides: '#ef4444',
};

function escapeForScript(data) {
  const json = JSON.stringify(JSON.stringify(data));
  return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function escapeHTML(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function generateHTML(graphData) {
  const escaped = escapeForScript(graphData);
  const sym = escapeHTML(graphData.symbol);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CodeGraph: ${sym}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0f172a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; overflow: hidden; }
#header { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: #1e293b; padding: 8px 16px; display: flex; align-items: center; gap: 16px; border-bottom: 1px solid #334155; font-size: 13px; }
#header h1 { font-size: 15px; font-weight: 600; }
#header .meta { color: #94a3b8; }
#legend { position: fixed; bottom: 12px; left: 12px; z-index: 100; background: #1e293bee; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; font-size: 12px; }
#legend .item { display: flex; align-items: center; gap: 6px; margin: 3px 0; }
#legend .swatch { width: 20px; height: 3px; border-radius: 2px; }
#viewport { position: absolute; top: 40px; left: 0; right: 0; bottom: 0; overflow: hidden; cursor: grab; }
#viewport.dragging { cursor: grabbing; }
#world { position: absolute; transform-origin: 0 0; }
canvas { position: absolute; top: 0; left: 0; pointer-events: none; }
.node { position: absolute; background: #1e293b; border: 2px solid #475569; border-radius: 8px; padding: 8px 12px; cursor: grab; white-space: nowrap; user-select: none; transition: box-shadow 0.15s; min-width: 100px; }
.node:hover { box-shadow: 0 0 12px rgba(255,255,255,0.15); z-index: 10; }
.node.dragging-node { cursor: grabbing; }
.node.root { border-width: 3px; }
.node .name { font-size: 14px; font-weight: 600; }
.node .badge { display: inline-block; font-size: 10px; padding: 1px 5px; border-radius: 4px; margin-left: 6px; color: #fff; opacity: 0.85; vertical-align: middle; }
.node .file { font-size: 11px; color: #94a3b8; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
</style>
<script src="https://unpkg.com/d3-dispatch@3"></script>
<script src="https://unpkg.com/d3-quadtree@3"></script>
<script src="https://unpkg.com/d3-timer@3"></script>
<script src="https://unpkg.com/d3-force@3"></script>
</head>
<body>
<div id="header">
  <h1>CodeGraph</h1>
  <span class="meta">symbol: <strong>${sym}</strong></span>
  <span class="meta">depth: ${graphData.depth}</span>
  <span class="meta">mode: ${escapeHTML(graphData.mode)}</span>
  <span class="meta">nodes: ${graphData.nodes.length}</span>
</div>
<div id="legend"></div>
<div id="viewport">
  <div id="world">
    <canvas id="edges"></canvas>
  </div>
</div>
<script>
const GRAPH_DATA = JSON.parse(${escaped});

const KIND_COLORS = ${JSON.stringify(KIND_COLORS)};
const EDGE_COLORS = ${JSON.stringify(EDGE_COLORS)};

const nodes = GRAPH_DATA.nodes;
const edges = GRAPH_DATA.edges;
const rootSet = new Set(GRAPH_DATA.rootIds);

const NODE_W = 220;
const NODE_H = 60;

const world = document.getElementById('world');
const canvas = document.getElementById('edges');
const viewport = document.getElementById('viewport');

const vw = viewport.clientWidth;
const vh = viewport.clientHeight;
const centerX = vw / 2;
const centerY = vh / 2;

world.style.width = vw + 'px';
world.style.height = vh + 'px';
canvas.width = vw;
canvas.height = vh;
canvas.style.width = vw + 'px';
canvas.style.height = vh + 'px';

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Build simulation nodes with initial positions
const simNodes = nodes.map(n => {
  const isRoot = rootSet.has(n.id);
  return {
    id: n.id,
    x: isRoot ? centerX : centerX + (Math.random() - 0.5) * vw * 0.5,
    y: isRoot ? centerY : centerY + (Math.random() - 0.5) * vh * 0.5,
    data: n
  };
});

const nodeById = new Map(simNodes.map(n => [n.id, n]));

// Build simulation links
const simLinks = edges.filter(e => nodeById.has(e.source) && nodeById.has(e.target)).map(e => ({
  source: e.source,
  target: e.target,
  kind: e.kind
}));

// Create DOM elements for each node
const nodeDivs = new Map();
simNodes.forEach(sn => {
  const n = sn.data;
  const div = document.createElement('div');
  div.className = 'node' + (rootSet.has(n.id) ? ' root' : '');
  const color = KIND_COLORS[n.kind] || '#6b7280';
  div.style.width = NODE_W + 'px';
  div.style.borderColor = color;
  if (rootSet.has(n.id)) div.style.boxShadow = '0 0 8px ' + color + '66';
  const shortFile = n.filePath ? n.filePath.split('/').slice(-2).join('/') : '';
  div.innerHTML = '<div class="name">' + esc(n.name) + '<span class="badge" style="background:' + color + '">' + esc(n.kind || '') + '</span></div>'
    + (shortFile ? '<div class="file">' + esc(shortFile) + (n.startLine != null ? ':' + n.startLine : '') + '</div>' : '');
  div.title = [
    n.qualifiedName || n.name,
    'Kind: ' + (n.kind || 'unknown'),
    'File: ' + (n.filePath || ''),
    'Lines: ' + (n.startLine != null ? n.startLine + (n.endLine != null ? '-' + n.endLine : '') : ''),
    'ID: ' + n.id,
  ].join('\\n');

  div.dataset.nodeId = n.id;
  world.appendChild(div);
  nodeDivs.set(n.id, div);
});

const ctx = canvas.getContext('2d');

function drawEdges() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  simLinks.forEach(link => {
    const s = typeof link.source === 'object' ? link.source : nodeById.get(link.source);
    const t = typeof link.target === 'object' ? link.target : nodeById.get(link.target);
    if (!s || !t) return;
    const sx = s.x + NODE_W / 2, sy = s.y + NODE_H / 2;
    const tx = t.x + NODE_W / 2, ty = t.y + NODE_H / 2;

    const color = EDGE_COLORS[link.kind] || '#9ca3af';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    const angle = Math.atan2(ty - sy, tx - sx);
    const aw = 8, ah = 5;
    const ax = tx - Math.cos(angle) * 20;
    const ay = ty - Math.sin(angle) * 20;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ax + Math.cos(angle) * aw, ay + Math.sin(angle) * aw);
    ctx.lineTo(ax + Math.cos(angle + Math.PI / 2) * ah, ay + Math.sin(angle + Math.PI / 2) * ah);
    ctx.lineTo(ax + Math.cos(angle - Math.PI / 2) * ah, ay + Math.sin(angle - Math.PI / 2) * ah);
    ctx.closePath();
    ctx.fill();
  });
}

function updatePositions() {
  simNodes.forEach(sn => {
    const div = nodeDivs.get(sn.id);
    if (div) {
      div.style.left = sn.x + 'px';
      div.style.top = sn.y + 'px';
    }
  });
  drawEdges();
}

// d3-force simulation
const simulation = d3.forceSimulation(simNodes)
  .force('link', d3.forceLink(simLinks).id(d => d.id).distance(180).strength(0.4))
  .force('charge', d3.forceManyBody().strength(-600).distanceMax(800))
  .force('center', d3.forceCenter(centerX, centerY).strength(0.05))
  .force('collide', d3.forceCollide().radius(NODE_W / 2 + 20).strength(0.7))
  .on('tick', updatePositions);

// Fit-to-viewport after simulation stabilizes
simulation.on('end', function() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  simNodes.forEach(sn => {
    if (sn.x < minX) minX = sn.x;
    if (sn.y < minY) minY = sn.y;
    if (sn.x + NODE_W > maxX) maxX = sn.x + NODE_W;
    if (sn.y + NODE_H > maxY) maxY = sn.y + NODE_H;
  });
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  if (contentW > 0 && contentH > 0) {
    const fitScale = Math.min(vw / contentW, vh / contentH, 1) * 0.85;
    scale = fitScale;
    panTx = (vw - contentW * scale) / 2 - minX * scale;
    panTy = (vh - contentH * scale) / 2 - minY * scale;
    applyTransform();
  }
});

// Legend
const edgeKinds = [...new Set(edges.map(e => e.kind))];
const legend = document.getElementById('legend');
legend.innerHTML = '<div style="font-weight:600;margin-bottom:4px">Edge types</div>' +
  edgeKinds.map(k => '<div class="item"><div class="swatch" style="background:' + (EDGE_COLORS[k] || '#9ca3af') + '"></div>' + esc(k) + '</div>').join('');

// Pan & zoom state
let scale = 1, panTx = 0, panTy = 0;
let panning = false, panStartX = 0, panStartY = 0;

function applyTransform() {
  world.style.transform = 'translate(' + panTx + 'px,' + panTy + 'px) scale(' + scale + ')';
}

// Zoom
viewport.addEventListener('wheel', function(e) {
  e.preventDefault();
  const rect = viewport.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const oldScale = scale;
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  scale = Math.max(0.05, Math.min(5, scale * factor));
  panTx = mx - (mx - panTx) * (scale / oldScale);
  panTy = my - (my - panTy) * (scale / oldScale);
  applyTransform();
}, { passive: false });

// Node drag state
let draggedNode = null;
let nodeDragStartX = 0, nodeDragStartY = 0;

// Pan: only starts on background (viewport, world, or canvas)
viewport.addEventListener('mousedown', function(e) {
  if (e.target === viewport || e.target === world || e.target === canvas) {
    panning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    viewport.classList.add('dragging');
  }
});

// Node drag: starts on .node elements
world.addEventListener('mousedown', function(e) {
  const nodeEl = e.target.closest('.node');
  if (!nodeEl) return;
  e.stopPropagation();
  const nodeId = nodeEl.dataset.nodeId;
  const sn = nodeById.get(nodeId);
  if (!sn) return;

  draggedNode = sn;
  nodeDragStartX = e.clientX;
  nodeDragStartY = e.clientY;
  nodeEl.classList.add('dragging-node');

  // Fix the node position and reheat
  sn.fx = sn.x;
  sn.fy = sn.y;
  simulation.alphaTarget(0.3).restart();
});

window.addEventListener('mousemove', function(e) {
  if (panning) {
    panTx += e.clientX - panStartX;
    panTy += e.clientY - panStartY;
    panStartX = e.clientX;
    panStartY = e.clientY;
    applyTransform();
    return;
  }
  if (draggedNode) {
    const dx = (e.clientX - nodeDragStartX) / scale;
    const dy = (e.clientY - nodeDragStartY) / scale;
    nodeDragStartX = e.clientX;
    nodeDragStartY = e.clientY;
    draggedNode.fx += dx;
    draggedNode.fy += dy;
  }
});

window.addEventListener('mouseup', function() {
  if (panning) {
    panning = false;
    viewport.classList.remove('dragging');
  }
  if (draggedNode) {
    const nodeEl = nodeDivs.get(draggedNode.id);
    if (nodeEl) nodeEl.classList.remove('dragging-node');
    // Unfix the node
    draggedNode.fx = null;
    draggedNode.fy = null;
    draggedNode = null;
    simulation.alphaTarget(0);
  }
});
</script>
</body>
</html>`;
}
