"use client";

import { useEffect, useRef, useState } from "react";
import { getGraph, seedGraph, getPrerequisites, GraphNode, GraphEdge } from "@/lib/api";
import { RefreshCw, GitBranch, Layers, Info, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, SurfaceCard } from "@/components/ui/PagePrimitives";

const BLOOM_COLORS: Record<string, string> = {
  Remember:   "#4ade80",
  Understand: "#818cf8",
  Apply:      "#f97316",
  Analyze:    "#22d3ee",
  Evaluate:   "#f43f5e",
  Create:     "#eab308",
};

export default function GraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes]       = useState<GraphNode[]>([]);
  const [edges, setEdges]       = useState<GraphEdge[]>([]);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [prereqs, setPrereqs]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [seeding, setSeeding]   = useState(false);
  const nodesRef = useRef<GraphNode[]>([]);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => { loadGraph(); }, []);

  async function loadGraph() {
    setLoading(true);
    try {
      const raw = await getGraph();
      // Guard: if backend returns unexpected shape (e.g. array), fall back safely
      const data = {
        nodes: Array.isArray(raw?.nodes) ? raw.nodes : [],
        edges: Array.isArray(raw?.edges) ? raw.edges : [],
      };
      setNodes(data.nodes);
      setEdges(data.edges);
      nodesRef.current = data.nodes;

      const pos: Record<string, { x: number; y: number }> = {};
      data.nodes.forEach((n, i) => {
        pos[n.id] = {
          x: n.x ?? 400 + Math.cos((i / data.nodes.length) * Math.PI * 2) * 220,
          y: n.y ?? 280 + Math.sin((i / data.nodes.length) * Math.PI * 2) * 180,
        };
      });
      setPositions(pos);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      await seedGraph();
      await loadGraph();
    } finally {
      setSeeding(false);
    }
  }

  async function handleNodeClick(node: GraphNode) {
    setSelected(node);
    try {
      const data = await getPrerequisites(node.id);
      setPrereqs(data.prerequisites ?? []);
    } catch {
      setPrereqs([]);
    }
  }

  // ── Canvas renderer ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw edges
    edges.forEach(edge => {
      const src = positions[edge.source];
      const dst = positions[edge.target];
      if (!src || !dst) return;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(dst.x, dst.y);
      ctx.strokeStyle = "rgba(74,222,128,0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const angle = Math.atan2(dst.y - src.y, dst.x - src.x);
      const arrowLen = 10;
      ctx.beginPath();
      ctx.moveTo(dst.x, dst.y);
      ctx.lineTo(
        dst.x - arrowLen * Math.cos(angle - 0.4),
        dst.y - arrowLen * Math.sin(angle - 0.4)
      );
      ctx.lineTo(
        dst.x - arrowLen * Math.cos(angle + 0.4),
        dst.y - arrowLen * Math.sin(angle + 0.4)
      );
      ctx.closePath();
      ctx.fillStyle = "rgba(74,222,128,0.4)";
      ctx.fill();
    });

    // draw nodes
    nodes.forEach(node => {
      const pos = positions[node.id];
      if (!pos) return;

      const isSelected = selected?.id === node.id;
      const isPrereq   = prereqs.some(p => p.id === node.id);
      const color      = BLOOM_COLORS[node.bloom] ?? "#6b7280";
      const radius     = isSelected ? 36 : 28;

      if (isSelected || isPrereq) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? `${color}30` : "rgba(129,140,248,0.15)";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#111318";
      ctx.fill();
      ctx.strokeStyle = isSelected ? color : `${color}80`;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      ctx.fillStyle = isSelected ? color : "#e8eaf0";
      ctx.font = `${isSelected ? "600" : "500"} 11px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.label, pos.x, pos.y);

      ctx.fillStyle = `${color}90`;
      ctx.font = "9px monospace";
      ctx.fillText(node.bloom, pos.x, pos.y + radius + 12);
    });

  }, [nodes, edges, positions, selected, prereqs]);

  // ── Click detection ──────────────────────────────────────────────
  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const clicked = nodes.find(node => {
      const pos = positions[node.id];
      if (!pos) return false;
      return Math.sqrt((mx - pos.x) ** 2 + (my - pos.y) ** 2) < 32;
    });

    if (clicked) handleNodeClick(clicked);
    else { setSelected(null); setPrereqs([]); }
  }

  const bloomLevels = [...new Set(nodes.map(n => n.bloom))];

  return (
    <PageShell className="max-w-6xl">
      <PageHeader
        title="Knowledge Graph"
        subtitle="Neo4j-powered topic dependency map"
        badge="Tools · Graph"
        actions={
          <div className="flex gap-2">
            <Button
              onClick={loadGraph}
              variant="outline"
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw size={14} className={`mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={handleSeed}
              disabled={seeding}
              className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
            >
              <Plus size={14} className="mr-2" />
              {seeding ? "Seeding..." : "Seed Sample Graph"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-6">

        {/* Graph canvas */}
        <SurfaceCard className="col-span-2 overflow-hidden p-0">

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 border-b border-border/70 px-4 py-3">
            <span className="text-xs text-muted-foreground">Bloom's Taxonomy:</span>
            {Object.entries(BLOOM_COLORS).map(([level, color]) => (
              <div key={level} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: color }}
                />
                <span className="text-[11px] text-muted-foreground">{level}</span>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex h-80 items-center justify-center gap-3 text-muted-foreground">
              <RefreshCw size={16} className="animate-spin" /> Loading graph...
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex h-80 flex-col items-center justify-center gap-3 text-muted-foreground">
              <GitBranch size={32} />
              <div className="text-sm">No topics yet</div>
              <Button
                onClick={handleSeed}
                size="sm"
                className="bg-emerald-500 text-black"
              >
                Seed Sample Graph
              </Button>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={700}
              height={500}
              onClick={handleCanvasClick}
              className="w-full cursor-pointer"
              style={{ background: "transparent" }}
            />
          )}
        </SurfaceCard>

        {/* Side panel */}
        <div className="space-y-4">

          {/* Stats */}
          <SurfaceCard className="p-4">
            <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
              Graph Stats
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Topics",       val: nodes.length,       color: "text-emerald-400" },
                { label: "Dependencies", val: edges.length,       color: "text-violet-400"  },
                { label: "Bloom Levels", val: bloomLevels.length, color: "text-cyan-400"    },
                { label: "DB",           val: "Neo4j",            color: "text-orange-400"  },
              ].map(s => (
                <div
                  key={s.label}
                  className="rounded-lg border border-border/70 bg-muted/40 p-3"
                >
                  <div className={`text-lg font-bold ${s.color}`}>{s.val}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </SurfaceCard>

          {/* Selected node info */}
          {selected ? (
            <SurfaceCard className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: BLOOM_COLORS[selected.bloom] ?? "#6b7280" }}
                />
                <div className="font-semibold text-foreground">{selected.label}</div>
              </div>
              <div className="mb-3 text-xs text-muted-foreground">
                Bloom's Level:{" "}
                <span style={{ color: BLOOM_COLORS[selected.bloom] }}>
                  {selected.bloom}
                </span>
              </div>

              {prereqs.length > 0 ? (
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                    Must learn first:
                  </div>
                  <div className="space-y-1.5">
                    {prereqs.map((p, idx) => (
                      <div
                        key={p.id ?? `prereq-${idx}`}
                        className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2"
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: BLOOM_COLORS[p.bloom] ?? "#6b7280" }}
                        />
                        <span className="text-xs text-foreground">{p.label}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {p.distance} step{p.distance > 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info size={11} />
                  No prerequisites — this is a foundational topic
                </div>
              )}
            </SurfaceCard>
          ) : (
            <SurfaceCard className="p-4 text-center">
              <Layers size={24} className="mx-auto mb-2 text-muted-foreground" />
              <div className="text-xs text-muted-foreground">
                Click any node to see its prerequisites
              </div>
            </SurfaceCard>
          )}

          {/* Cypher query display */}
          <SurfaceCard className="p-4">
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Live Cypher Query
            </div>
            <div className="whitespace-pre rounded-lg bg-muted p-3 font-mono text-[11px] leading-relaxed text-cyan-500">
              {selected
                ? `MATCH path = (p:Topic)\n-[:REQUIRED_FOR*1..]->\n(t:Topic {id: "${selected.id}"})\nRETURN DISTINCT p, length(path)`
                : `MATCH (a:Topic)\n-[:REQUIRED_FOR]->(b:Topic)\nRETURN a, b`
              }
            </div>
          </SurfaceCard>

        </div>
      </div>
    </PageShell>
  );
}