"use client";

import { useMemo, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text, Line } from "@react-three/drei";
import { Color, Vector3, QuadraticBezierCurve3, CatmullRomCurve3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { useStore } from "@/lib/store";
import { activeLayerOf, phaseInfo } from "@/lib/playback";
import TransformerStack, { type StackDims } from "./TransformerStack";
import KvCacheVolume from "./KvCacheVolume";
import { opColorOf, opKindOf, type OpKind } from "@/lib/sceneColors";

const GAP = 3.4;
const KV_CAP = 40;

const tmp = new Vector3();

export default function GenerationScene() {
  const meta = useStore((s) => s.genMeta);
  const archMeta = useStore((s) => s.arch?.metadata);
  const opIndex = useStore((s) => s.opIndex);
  const setOpIndex = useStore((s) => s.setOpIndex);
  const followMode = useStore((s) => s.followMode);
  const view2D = useStore((s) => s.view2D);
  const playIndex = useStore((s) => s.playIndex);
  const frame = useStore((s) => (s.playIndex >= 0 ? s.genFrames[s.playIndex] : null));
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null);
  const [hoveredKind, setHoveredKind] = useState<OpKind | null>(null);
  const sourceSelectedTensor = useStore((s) => s.sourceSelectedTensor);
  const setSourceSelectedTensor = useStore((s) => s.setSourceSelectedTensor);

  const nLayers = meta?.num_layers ?? 24;
  const catalog = meta?.op_catalog ?? [];
  const op = catalog.length ? catalog[Math.min(opIndex, catalog.length - 1)] : null;
  const activeLayer = activeLayerOf(op ?? undefined, nLayers);
  const activeKind = opKindOf(op?.op_key);

  // Real model dimensions drive every proportion in the stack geometry. Falls
  // back to the loaded model's own num_heads and Qwen2.5-0.5B defaults only if
  // architecture metadata hasn't arrived yet.
  const dims: StackDims = useMemo(
    () => ({
      numHeads: archMeta?.num_heads ?? 14,
      kvHeads: archMeta?.num_kv_heads ?? 2,
      headDim: archMeta?.head_dim ?? 64,
      hidden: archMeta?.hidden_size ?? 896,
      ffn: archMeta?.ffn_size ?? 4864,
      vocab: archMeta?.vocab_size ?? 151936,
    }),
    [archMeta],
  );

  // Real KV-cache phase for the token being replayed — drives the "new activity"
  // strip so decode visibly computes far fewer positions than pre-fill.
  const phase = phaseInfo(frame, meta?.prompt_len ?? 0, meta?.uses_kv_cache);
  const positions = phase ? Math.min(phase.positions, KV_CAP) : 0;

  // Real per-token intensity: mean |activation| at the active layer, normalized
  // within this token's own stats. Pure lighting cue — no data is altered.
  const statNorm = useMemo(() => {
    const ls = frame?.layer_stats;
    if (!ls || ls.length === 0 || activeLayer == null) return 0.5;
    const idx = Math.max(0, Math.min(activeLayer + 1, ls.length - 1));
    const max = Math.max(1e-6, ...ls);
    return Math.max(0, Math.min(ls[idx] / max, 1));
  }, [frame, activeLayer]);

  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const userOrbiting = useStore((s) => s.userOrbiting);
  const setUserOrbiting = useStore((s) => s.setUserOrbiting);

  // Always keep OrbitControls enabled so the user can rotate freely.
  // When they grab the canvas, pause the auto-follow glide for 2 seconds.
  useEffect(() => {
    if (!controls) return;
    controls.enabled = true;
    const onStart = () => { setUserOrbiting(true); };
    const onEnd = () => {
      // Resume follow after 2 s of no interaction
      setTimeout(() => setUserOrbiting(false), 2000);
    };
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);
    return () => {
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
    };
  }, [controls, setUserOrbiting]);

  const opCol: [number, number, number] = op
    ? opColorOf(op.op_key, activeKind ?? "norm")
    : [0.5, 0.6, 0.8];

  useFrame(() => {
    if (followMode && !userOrbiting && activeLayer != null && controls) {
      const y = -(activeLayer + 1) * GAP;
      const dest = view2D ? tmp.set(0, y, 11) : tmp.set(7, y + 1.2, 9);
      camera.position.lerp(dest, 0.07);
      controls.target.lerp(tmp.set(0, y, 0), 0.12);
      controls.update();
    }
  });

  const activeY = activeLayer != null ? -(activeLayer + 1) * GAP : 0;

  const handleSceneHover = (layer: number | null, kind: OpKind | null) => {
    setHoveredLayer(layer);
    setHoveredKind(kind);
  };

  const handleSceneClick = (layer: number, kind: OpKind) => {
    if (catalog.length === 0) return;
    const idx = catalog.findIndex((op) => {
      const opLayer = op.layer ?? (kind === "embedding" ? -1 : kind === "output" ? nLayers : null);
      return opLayer === layer && opKindOf(op.op_key) === kind;
    });
    if (idx >= 0) setOpIndex(idx);
  };

  return (
    <group>
      <TransformerStack
        nLayers={nLayers}
        dims={dims}
        activeLayer={activeLayer}
        activeKind={activeKind}
        opColor={opCol}
        statNorm={statNorm}
        gap={GAP}
        hoveredLayer={hoveredLayer}
        hoveredKind={hoveredKind}
        onHover={handleSceneHover}
        onClick={handleSceneClick}
      />

      {/* Stack endpoints labelled where the geometry begins/ends. */}
      <Billboard position={[-4.4, 0, 0]}>
        <Text fontSize={0.42} anchorX="right" color="#8a97bd">
          Embeddings
        </Text>
      </Billboard>
      <Billboard position={[-3, -(nLayers + 1) * GAP, 0]}>
        <Text fontSize={0.42} anchorX="right" color="#8a97bd">
          Output
        </Text>
      </Billboard>

      {op && activeLayer != null && (
        <Billboard position={[5.6, activeY, 0]}>
          <Text
            fontSize={0.5}
            anchorX="left"
            color="#e6ecff"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {op.label}
            {op.layer != null ? ` · Layer ${op.layer}` : ""}
          </Text>
        </Billboard>
      )}

      {/* KV-cache as a spatial volume: per-layer grid of cached positions.
          Pre-fill = warm wide band; decode = dim stale + bright new cell. */}
      {phase && activeLayer != null && (
        <KvCacheVolume
          nLayers={nLayers}
          gap={GAP}
          activeLayer={activeLayer}
        />
      )}

      {/* Attention arcs from active attention layer to tokens.
          Only shown during decode when an attention op is active and real KV positions exist. */}
      {activeLayer != null && activeKind === "attn" && phase && positions > 0 && (
        <group>
          {(() => {
            const nh = dims.numHeads;
            const kvh = dims.kvHeads;
            const kg = Math.max(1, Math.min(kvh, nh));
            const pg = Math.max(1, Math.round(nh / kg));
            const groupGap = 0.55;
            const groupSpan = (Math.PI * 2) / kg - groupGap;
            const Rc = 1.25;
            return Array.from({ length: Math.min(nh, 14) }, (_, h) => {
            const g = Math.floor(h / pg);
            const withinN = Math.min(pg, nh - g * pg);
            const i = h - g * pg;
            const gStart = g * ((Math.PI * 2) / kg) + groupGap / 2;
            const a = withinN > 1 ? gStart + (i / (withinN - 1)) * groupSpan : gStart + groupSpan / 2;
            const fromX = Rc * Math.sin(a);
            const fromZ = Rc * Math.cos(a);

            // Show arcs to the most-attended positions (simulated typical pattern)
            const attendedPositions = [];
            const n = Math.min(positions, 16);
            for (let p = 0; p < n; p++) {
              const relP = p / Math.max(1, n - 1);
              const weight = h === 0
                ? (p === n - 1 ? 0.05 : Math.exp(-3 * relP) * 0.7 + 0.08 * (1 - relP))
                : (p === 0 ? 0.6 : Math.exp(-2 * relP) * 0.15 + 0.05);
              if (weight < 0.08) continue;
              attendedPositions.push({ pos: p, weight });
            }

            const headColor = new Color().setHSL(h / dims.numHeads, 0.7, 0.55);

            return attendedPositions.map(({ pos: p, weight }) => {
              const toX = -6.4 + 0.24 * p + 0.5;
              const toY = activeY;
              const start = new Vector3(fromX, activeY, fromZ);
              const end = new Vector3(toX, toY, 0);
              const mid = start.clone().add(end).multiplyScalar(0.5);
              mid.y += Math.abs(activeY - toY) * 0.2 + 1.2;
              mid.z *= 0.3;
              const curve = new QuadraticBezierCurve3(start, mid, end);
              const pts = curve.getPoints(24);
              const opacity = 0.15 + weight * 0.7;
              return (
                <Line
                  key={`arc-${h}-${p}`}
                  points={pts}
                  color={headColor}
                  lineWidth={1}
                  transparent
                  opacity={opacity}
                />
              );
            });
            });
          })()}
        </group>
      )}

      {/* RoPE twist: a helical curve representing the rotary position encoding
          applied to Q/K at each attention layer. The spiral grows with position
          index, showing how RoPE encodes relative position through rotation. */}
      {activeKind === "attn" && activeLayer != null && (
        <group position={[3.6, activeY, 0]}>
          <Line
            points={(() => {
              const pts: Vector3[] = [];
              const turns = 2.5;
              const r = 0.35;
              const h = 1.6;
              const steps = 80;
              for (let i = 0; i <= steps; i++) {
                const t = (i / steps) * turns * Math.PI * 2;
                const y = (i / steps - 0.5) * h;
                pts.push(new Vector3(r * Math.cos(t), y, r * Math.sin(t)));
              }
              return pts;
            })()}
            color="#6fa8dc"
            lineWidth={1}
            transparent
            opacity={0.5}
          />
          {Array.from({ length: 4 }, (_, i) => {
            const t = (i / 4) * 2.5 * Math.PI * 2;
            const y = (i / 4 - 0.5) * 1.6;
            return (
              <mesh key={i} position={[0.35 * Math.cos(t), y, 0.35 * Math.sin(t)]}>
                <sphereGeometry args={[0.04, 6, 6]} />
                <meshBasicMaterial color="#6fa8dc" transparent opacity={0.3 + i * 0.15} />
              </mesh>
            );
          })}
          <Billboard position={[0.9, 0.9, 0]}>
            <Text fontSize={0.28} anchorX="left" color="#6fa8dc" outlineWidth={0.01} outlineColor="#000000">
              RoPE
            </Text>
          </Billboard>
        </group>
      )}

      {/* Source-mapped tensor highlight. */}
      {sourceSelectedTensor && (
        <Billboard position={[-8, -(nLayers + 0.5) * GAP, 0]}>
          <Text fontSize={0.32} anchorX="left" color="#8cf" outlineWidth={0.015} outlineColor="#000000">
            Source: {sourceSelectedTensor}
          </Text>
        </Billboard>
      )}

      {/* Which generated token this forward pass produces. */}
      {frame && (
        <Billboard position={[0, -(nLayers + 2.2) * GAP, 0]}>
          <Text
            fontSize={0.6}
            anchorX="center"
            color="#e6ecff"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {`token ${playIndex + 1}: “${frame.chosen.text.replace(/\n/g, "⏎")}”`}
          </Text>
        </Billboard>
      )}

      {/* Real top-k probability skyline at the output. Bar height = the real
          softmax probability streamed for this step; brightness also ∝ prob.
          Grayscale on purpose — probability is a second quantity and must not
          get its own colour (the one colour axis is layer/op depth). */}
      {frame && frame.topk?.length > 0 && (
        <group position={[0, -(nLayers + 3.4) * GAP, 0]}>
          <Billboard position={[0, 3.6, 0]}>
            <Text fontSize={0.34} anchorX="center" color="#8a97bd">
              next-token top-{frame.topk.length} · real probabilities
            </Text>
          </Billboard>
          {frame.topk.map((cand, i) => {
            const n = frame.topk.length;
            const h = Math.max(0.06, cand.prob * 3.2); // height = real prob
            const x = (i - (n - 1) / 2) * 0.62;
            const g = 0.32 + 0.62 * cand.prob; // brightness = real prob
            const col = new Color(g, g, Math.min(1, g * 1.03));
            return (
              <group key={i} position={[x, 0, 0]}>
                <mesh position={[0, h / 2, 0]}>
                  <boxGeometry args={[0.4, h, 0.4]} />
                  <meshStandardMaterial
                    color={col}
                    emissive={col}
                    emissiveIntensity={i === 0 ? 0.85 : 0.3}
                    roughness={0.5}
                    metalness={0.15}
                  />
                </mesh>
                <Billboard position={[0, h + 0.45, 0]}>
                  <Text
                    fontSize={0.26}
                    anchorX="center"
                    color={i === 0 ? "#ffffff" : "#9aa3b8"}
                    outlineWidth={0.012}
                    outlineColor="#000000"
                  >
                    {cand.text.replace(/\n/g, "⏎").trim().slice(0, 6) || "␣"}
                  </Text>
                  <Text position={[0, -0.3, 0]} fontSize={0.2} anchorX="center" color="#6f7a95">
                    {(cand.prob * 100).toFixed(1)}%
                  </Text>
                </Billboard>
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
}
