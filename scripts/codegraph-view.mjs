import fs from 'node:fs';
import path from 'node:path';
import codegraph from '@colbymchenry/codegraph';
import { generateHTML } from './codegraph-view-template.mjs';

const { CodeGraph } = codegraph;

function parseArgs(argv) {
  const args = { depth: 2, mode: 'traverse' };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === '--project') { args.project = val; i++; }
    else if (key === '--symbol') { args.symbol = val; i++; }
    else if (key === '--depth') { args.depth = Number(val); i++; }
    else if (key === '--output') { args.output = val; i++; }
    else if (key === '--mode') { args.mode = val; i++; }
    else throw new Error(`Unknown argument: ${key}`);
  }
  if (!args.project) throw new Error('--project is required');
  if (!args.symbol) throw new Error('--symbol is required');
  if (!['traverse', 'callgraph'].includes(args.mode)) throw new Error('--mode must be "traverse" or "callgraph"');
  if (!Number.isInteger(args.depth) || args.depth < 1) throw new Error('--depth must be a positive integer');
  args.project = path.resolve(args.project);
  if (!args.output) args.output = path.join(args.project, '.codegraph', 'view.html');
  else args.output = path.resolve(args.output);
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  let cg;
  try {
    try {
      cg = await CodeGraph.open(args.project, { readOnly: true });
    } catch (e) {
      throw new Error(
        `Failed to open CodeGraph index in ${args.project}. Run "codegraph init" first.\n${e.message}`,
      );
    }

    const results = cg.searchNodes(args.symbol);
    if (results.length === 0) throw new Error(`No symbols found matching "${args.symbol}"`);

    const exactMatch = results.find(r => r.node.name === args.symbol);
    const best = exactMatch || results.sort((a, b) => b.score - a.score)[0];
    const nodeId = best.node.id;

    console.log(`Found symbol: ${best.node.name} (${best.node.kind}) score=${best.score}`);

    let subgraph;
    if (args.mode === 'callgraph') {
      subgraph = cg.getCallGraph(nodeId, args.depth);
    } else {
      subgraph = cg.traverse(nodeId, { maxDepth: args.depth, direction: 'both', includeStart: true });
    }

    const nodesMap = subgraph.nodes;

    const graphNodes = [];
    for (const [id, node] of nodesMap.entries()) {
      graphNodes.push({
        id,
        name: node.name,
        kind: node.kind,
        qualifiedName: node.qualifiedName,
        filePath: node.filePath,
        startLine: node.startLine,
        endLine: node.endLine,
      });
    }

    const graphEdges = subgraph.edges.map(e => ({
      source: e.source,
      target: e.target,
      kind: e.kind,
    }));

    const graphData = {
      symbol: args.symbol,
      depth: args.depth,
      mode: args.mode,
      nodes: graphNodes,
      edges: graphEdges,
      rootIds: [nodeId],
    };

    const html = generateHTML(graphData);

    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    fs.writeFileSync(args.output, html, 'utf-8');
    console.log(`Generated: ${args.output}`);
  } finally {
    cg?.close();
  }
}

main().catch(e => {
  console.error(e.message || e);
  process.exitCode = 1;
});
