"use client";

import { useMemo, useRef } from "react";
import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Color, Mesh, MeshStandardMaterial } from "three";

import { useStore } from "@/lib/store";

const STACK_X = -8;
const SLAB_GAP = 0.5;
const BAR_SCALE = 8; // world height for probability 1.0

function layerColor(i: number, n: number): Color {
  // blue at the input (layer 0) -> warm near the output.
  return new Color().setHSL(0.6 - (i / Math.max(1, n - 1)) * 0.42, 0.8, 0.5);
}

/**
 * Generation District: a vertical stack of transformer-layer slabs whose glow
 * is driven by the REAL per-layer mean activation magnitude of the current
 * generation step, plus a probability skyline of the real top-k candidates.
 * Everything is driven by recorded stream frames (replayable), never simulated.
 */
export default function TransformerDistrict() {
  const meta = useStore((s) => s.genMeta);
  const frames = useStore((s) => s.genFrames);
  const playIndex = useStore((s) => s.playIndex);
  const genStatus = useStore((s) => s.genStatus);

  const nLayers = meta?.num_layer_stats ?? 25;
  const topK = meta?.top_k ?? 10;

  const frame =
    playIndex >= 0 && playIndex < frames.length
      ? frames[playIndex]
      : frames.length
        ? frames[frames.length - 1]
        : null;

  const slabRefs = useRef<Array<Mesh | null>>([]);
  const barRefs = useRef<Array<Mesh | null>>([]);

  const stackHeight = (nLayers - 1) * SLAB_GAP;

  useFrame(() => {
    const stats = frame?.layer_stats ?? [];
    const max = stats.length ? Math.max(...stats) : 1;

    // Layer slabs: emissive brightness ~ normalized activation at that layer.
    slabRefs.current.forEach((m, i) => {
      if (!m) return;
      const norm = max > 0 ? (stats[i] ?? 0) / max : 0;
      const mat = m.material as MeshStandardMaterial;
      const target = 0.08 + norm * 2.4;
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * 0.15;
    });

    // Skyline bars: height ~ probability (unit-height box scaled on Y).
    const tk = frame?.topk ?? [];
    barRefs.current.forEach((m, k) => {
      if (!m) return;
      const target = (tk[k]?.prob ?? 0) * BAR_SCALE + 0.02;
      m.scale.y += (target - m.scale.y) * 0.2;
      m.position.y = m.scale.y / 2;
    });
  });

  const slabs = useMemo(
    () => Array.from({ length: nLayers }, (_, i) => layerColor(i, nLayers)),
    [nLayers],
  );

  const tk = frame?.topk ?? [];

  return (
    <group>
      {/* --- Transformer layer stack --- */}
      <Billboard position={[STACK_X, stackHeight + 1.6, 0]}>
        <Text fontSize={0.5} anchorX="center" color="#e6ecff" outlineWidth={0.02} outlineColor="#000000">
          Layers (activation magnitude)
        </Text>
      </Billboard>
      {slabs.map((c, i) => (
        <mesh
          key={i}
          ref={(el) => void (slabRefs.current[i] = el)}
          position={[STACK_X, i * SLAB_GAP, 0]}
        >
          <boxGeometry args={[5, 0.34, 5]} />
          <meshStandardMaterial
            color={c}
            emissive={c}
            emissiveIntensity={0.1}
            roughness={0.5}
            metalness={0.2}
          />
        </mesh>
      ))}
      <Billboard position={[STACK_X, -1.1, 0]}>
        <Text fontSize={0.3} anchorX="center" color="#8a97bd">
          layer 0 (embeddings) → layer {nLayers - 1}
        </Text>
      </Billboard>

      {/* --- Probability skyline (real top-k) --- */}
      <Billboard position={[4, 9.4, 0]}>
        <Text fontSize={0.5} anchorX="center" color="#e6ecff" outlineWidth={0.02} outlineColor="#000000">
          Next-token probabilities (top {topK})
        </Text>
      </Billboard>
      {Array.from({ length: topK }, (_, k) => {
        const x = 4 + (k - (topK - 1) / 2) * 1.5;
        const chosen = k === 0; // greedy: argmax is topk[0]
        const col = chosen ? "#ffd36e" : "#57d0ff";
        const cand = tk[k];
        return (
          <group key={k} position={[x, 0, 0]}>
            <mesh ref={(el) => void (barRefs.current[k] = el)} position={[0, 0, 0]}>
              <boxGeometry args={[1.05, 1, 1.05]} />
              <meshStandardMaterial
                color={col}
                emissive={col}
                emissiveIntensity={chosen ? 0.85 : 0.35}
                roughness={0.4}
                metalness={0.1}
              />
            </mesh>
            <Billboard position={[0, 8.9, 0]}>
              <Text
                fontSize={0.34}
                anchorX="center"
                color={chosen ? "#ffe6a0" : "#cfe8ff"}
                outlineWidth={0.015}
                outlineColor="#000000"
              >
                {cand ? cand.text.trim() || "␣" : ""}
              </Text>
              <Text position={[0, -0.42, 0]} fontSize={0.26} anchorX="center" color="#8a97bd">
                {cand ? `${(cand.prob * 100).toFixed(0)}%` : ""}
              </Text>
            </Billboard>
          </group>
        );
      })}

      {/* --- Generated text / status readout --- */}
      <Billboard position={[0, -3.4, 0]}>
        <Text
          fontSize={0.5}
          maxWidth={34}
          textAlign="center"
          anchorX="center"
          color="#b6f0c8"
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          {frames.length === 0
            ? genStatus === "streaming"
              ? "generating…"
              : "Enter a prompt and press Generate."
            : `“${frames
                .slice(0, (frame?.step ?? frames.length - 1) + 1)
                .filter((f) => !f.eos)
                .map((f) => f.chosen.text)
                .join("")
                .trim()}”`}
        </Text>
      </Billboard>
    </group>
  );
}
