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
.node { position: absolute; background: #1e293b; border: 2px solid #475569; border-radius: 8px; padding: 8px 12px; cursor: default; white-space: nowrap; user-select: none; transition: box-shadow 0.15s; min-width: 100px; }
.node:hover { box-shadow: 0 0 12px rgba(255,255,255,0.15); z-index: 10; }
.node.root { border-width: 3px; }
.node .name { font-size: 14px; font-weight: 600; }
.node .badge { display: inline-block; font-size: 10px; padding: 1px 5px; border-radius: 4px; margin-left: 6px; color: #fff; opacity: 0.85; vertical-align: middle; }
.node .file { font-size: 11px; color: #94a3b8; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
</style>
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

const adj = new Map();
nodes.forEach(n => adj.set(n.id, []));
edges.forEach(e => {
  if (adj.has(e.source)) adj.get(e.source).push(e.target);
  if (adj.has(e.target)) adj.get(e.target).push(e.source);
});

const layers = new Map();
const queue = [];
GRAPH_DATA.rootIds.forEach(id => {
  if (adj.has(id) && !layers.has(id)) {
    layers.set(id, 0);
    queue.push(id);
  }
});

for (let head = 0; head < queue.length; head++) {
  const id = queue[head];
  const nextLayer = layers.get(id) + 1;
  adj.get(id).forEach(neighbor => {
    if (!layers.has(neighbor)) {
      layers.set(neighbor, nextLayer);
      queue.push(neighbor);
    }
  });
}

nodes.forEach(n => {
  if (!layers.has(n.id)) layers.set(n.id, 0);
});

const layerGroups = new Map();
nodes.forEach(n => {
  const l = layers.get(n.id);
  if (!layerGroups.has(l)) layerGroups.set(l, []);
  layerGroups.get(l).push(n);
});

const sortedLayers = [...layerGroups.keys()].sort((a, b) => a - b);
sortedLayers.forEach(l => {
  layerGroups.get(l).sort((a, b) => {
    const nameA = String(a.name);
    const nameB = String(b.name);
    if (nameA !== nameB) return nameA < nameB ? -1 : 1;
    return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
  });
});

const NODE_W = 220;
const NODE_H = 60;
const H_GAP = 60;
const V_GAP = 100;
const PAD = 60;

const nodePos = new Map();
let maxX = 0, maxY = 0;
const maxLayerWidth = Math.max(...sortedLayers.map(l => {
  const count = layerGroups.get(l).length;
  return count * NODE_W + (count - 1) * H_GAP;
}));

sortedLayers.forEach((l, li) => {
  const group = layerGroups.get(l);
  const totalW = group.length * NODE_W + (group.length - 1) * H_GAP;
  group.forEach((n, ni) => {
    const x = PAD + (maxLayerWidth - totalW) / 2 + ni * (NODE_W + H_GAP);
    const y = PAD + li * (NODE_H + V_GAP);
    nodePos.set(n.id, { x, y });
    if (x + NODE_W > maxX) maxX = x + NODE_W;
    if (y + NODE_H > maxY) maxY = y + NODE_H;
  });
});

const world = document.getElementById('world');
const canvas = document.getElementById('edges');
const viewport = document.getElementById('viewport');

const cw = maxX + PAD * 2;
const ch = maxY + PAD * 2;
world.style.width = cw + 'px';
world.style.height = ch + 'px';
canvas.width = cw;
canvas.height = ch;
canvas.style.width = cw + 'px';
canvas.style.height = ch + 'px';

nodes.forEach(n => {
  const pos = nodePos.get(n.id);
  const div = document.createElement('div');
  div.className = 'node' + (rootSet.has(n.id) ? ' root' : '');
  const color = KIND_COLORS[n.kind] || '#6b7280';
  div.style.left = pos.x + 'px';
  div.style.top = pos.y + 'px';
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

  world.appendChild(div);
});

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

const ctx = canvas.getContext('2d');

function drawEdges() {
  ctx.clearRect(0, 0, cw, ch);
  edges.forEach(e => {
    const sp = nodePos.get(e.source);
    const tp = nodePos.get(e.target);
    const sx = sp.x + NODE_W / 2, sy = sp.y + NODE_H / 2;
    const tx = tp.x + NODE_W / 2, ty = tp.y + NODE_H / 2;

    const color = EDGE_COLORS[e.kind] || '#9ca3af';
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
drawEdges();

const edgeKinds = [...new Set(edges.map(e => e.kind))];
const legend = document.getElementById('legend');
legend.innerHTML = '<div style="font-weight:600;margin-bottom:4px">Edge types</div>' +
  edgeKinds.map(k => '<div class="item"><div class="swatch" style="background:' + (EDGE_COLORS[k] || '#9ca3af') + '"></div>' + esc(k) + '</div>').join('');

let scale = 1, tx = 0, ty = 0;
let dragging = false, dragX = 0, dragY = 0;

function applyTransform() {
  world.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
}

const vw = viewport.clientWidth;
const vh = viewport.clientHeight;
if (cw > 0 && ch > 0) {
  const fitScale = Math.min(vw / cw, vh / ch, 1);
  scale = fitScale * 0.9;
  tx = (vw - cw * scale) / 2;
  ty = (vh - ch * scale) / 2;
  applyTransform();
}

viewport.addEventListener('wheel', function(e) {
  e.preventDefault();
  const rect = viewport.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const oldScale = scale;
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  scale = Math.max(0.05, Math.min(5, scale * factor));
  tx = mx - (mx - tx) * (scale / oldScale);
  ty = my - (my - ty) * (scale / oldScale);
  applyTransform();
}, { passive: false });

viewport.addEventListener('mousedown', function(e) {
  if (e.target === viewport || e.target === world || e.target === canvas) {
    dragging = true;
    dragX = e.clientX;
    dragY = e.clientY;
    viewport.classList.add('dragging');
  }
});
window.addEventListener('mousemove', function(e) {
  if (!dragging) return;
  tx += e.clientX - dragX;
  ty += e.clientY - dragY;
  dragX = e.clientX;
  dragY = e.clientY;
  applyTransform();
});
window.addEventListener('mouseup', function() {
  dragging = false;
  viewport.classList.remove('dragging');
});
</script>
</body>
</html>`;
}
