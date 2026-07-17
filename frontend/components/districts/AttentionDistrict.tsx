"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Billboard, Text } from "@react-three/drei";
import {
  AdditiveBlending,
  Color,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";

import { useStore } from "@/lib/store";
import { ringPositions } from "@/lib/layout";
import type { Token } from "@/lib/types";

const UP = new Vector3(0, 1, 0);

/** Readable label for a token sphere. */
function tokenLabel(t: Token): string {
  const s = t.text.replace(/\n/g, "\\n").trim();
  if (s.length === 0) return t.piece; // whitespace-only piece -> show raw piece
  return s.length > 12 ? s.slice(0, 12) + "…" : s;
}

/** Distinct-ish node color per token index. */
function nodeColor(i: number): Color {
  return new Color().setHSL((i * 0.13) % 1, 0.5, 0.62);
}

interface Beam {
  matrix: Matrix4;
  color: Color;
}

export default function AttentionDistrict() {
  // These re-render on change (not per-frame), which is exactly when beams
  // must be rebuilt — switching layer/head/threshold or loading new data.
  const data = useStore((s) => s.data);
  const layer = useStore((s) => s.selectedLayer);
  const head = useStore((s) => s.selectedHead);
  const minWeight = useStore((s) => s.minWeight);

  const n = data?.tokens.length ?? 0;
  const positions = useMemo(() => ringPositions(n), [n]);

  // Self-attention weight per token (the diagonal) drives node glow.
  const selfWeights = useMemo(() => {
    if (!data) return [];
    const mat = data.attention[layer]?.[head];
    if (!mat) return [];
    return data.tokens.map((_, i) => mat[i]?.[i] ?? 0);
  }, [data, layer, head]);

  // Build one beam per (from -> to) causal pair above the weight threshold.
  const beams = useMemo<Beam[]>(() => {
    if (!data) return [];
    const mat = data.attention[layer]?.[head];
    if (!mat) return [];

    const out: Beam[] = [];
    const q = new Quaternion();
    const dir = new Vector3();
    const mid = new Vector3();

    for (let from = 0; from < n; from++) {
      // Causal attention: token `from` can only attend to `to <= from`.
      // Skip the diagonal (to === from) — shown as node glow instead.
      for (let to = 0; to < from; to++) {
        const w = mat[from]?.[to] ?? 0;
        if (w < minWeight) continue;

        const a = positions[from];
        const b = positions[to];
        dir.subVectors(b, a);
        const len = dir.length();
        mid.addVectors(a, b).multiplyScalar(0.5);
        q.setFromUnitVectors(UP, dir.clone().normalize());

        const radius = 0.015 + w * 0.22; // thickness ~ weight
        const matrix = new Matrix4().compose(
          mid.clone(),
          q.clone(),
          new Vector3(radius, len, radius),
        );
        // Brightness ~ weight; hue shifts blue -> cyan as weight rises.
        const color = new Color().setHSL(0.62 - 0.17 * w, 0.95, 0.25 + 0.55 * w);
        out.push({ matrix, color });
      }
    }
    return out;
  }, [data, layer, head, minWeight, positions, n]);

  const meshRef = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < beams.length; i++) {
      mesh.setMatrixAt(i, beams[i].matrix);
      mesh.setColorAt(i, beams[i].color);
    }
    mesh.count = beams.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [beams]);

  // Empty state: prompt in 3D space.
  if (!data) {
    return (
      <Billboard>
        <Text
          fontSize={0.9}
          color="#8a97bd"
          anchorX="center"
          anchorY="middle"
          maxWidth={16}
          textAlign="center"
        >
          Type a sentence to see real attention from a live forward pass.
        </Text>
      </Billboard>
    );
  }

  return (
    <group>
      {/* Attention beams — one InstancedMesh, one draw call.
          Keyed on count so the instance buffer resizes on layer/head switch. */}
      {beams.length > 0 && (
        <instancedMesh
          key={beams.length}
          ref={meshRef}
          args={[undefined as never, undefined as never, beams.length]}
          frustumCulled={false}
        >
          <cylinderGeometry args={[1, 1, 1, 6, 1, true]} />
          <meshBasicMaterial
            transparent
            opacity={0.92}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </instancedMesh>
      )}

      {/* Token nodes + billboarded labels. */}
      {data.tokens.map((t, i) => {
        const base = nodeColor(i);
        const glow = 0.25 + selfWeights[i] * 1.4;
        return (
          <group key={i} position={positions[i]}>
            <mesh>
              <sphereGeometry args={[0.3, 24, 24]} />
              <meshStandardMaterial
                color={base}
                emissive={base}
                emissiveIntensity={glow}
                roughness={0.4}
                metalness={0.15}
              />
            </mesh>
            <Billboard position={[0, 0.62, 0]}>
              <Text
                fontSize={0.42}
                anchorX="center"
                anchorY="bottom"
                color={t.is_special ? "#6d7aa0" : "#e6ecff"}
                outlineWidth={0.02}
                outlineColor="#000000"
              >
                {tokenLabel(t)}
              </Text>
              <Text
                position={[0, -0.02, 0]}
                fontSize={0.2}
                anchorX="center"
                anchorY="top"
                color="#5b678c"
              >
                {String(i)}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}
