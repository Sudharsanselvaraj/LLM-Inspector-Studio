"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import { Color, Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { useStore } from "@/lib/store";

// Vertical tower of layer slabs. The layer whose operation is currently being
// walked lights up in the op's colour; the follow camera tracks it. Everything
// is driven by the real op catalog + recorded generation.
const OP_COLORS: Record<string, [number, number, number]> = {
  embedding: [0.6, 0.4, 0.95],
  norm: [0.55, 0.6, 0.72],
  "attn.q": [0.3, 0.7, 1],
  "attn.k": [0.3, 0.85, 0.9],
  "attn.v": [0.3, 0.9, 0.6],
  attention: [0.4, 0.8, 1],
  "attn.o": [0.6, 0.7, 1],
  "mlp.gate": [1, 0.72, 0.3],
  "mlp.up": [1, 0.6, 0.3],
  "mlp.down": [0.95, 0.45, 0.5],
  output: [0.9, 0.4, 0.95],
};
const GAP = 1.5;
const tmp = new Vector3();

export default function GenerationScene() {
  const meta = useStore((s) => s.genMeta);
  const opIndex = useStore((s) => s.opIndex);
  const followMode = useStore((s) => s.followMode);
  const view2D = useStore((s) => s.view2D);

  const nLayers = meta?.num_layers ?? 24;
  const catalog = meta?.op_catalog ?? [];
  const op = catalog.length ? catalog[Math.min(opIndex, catalog.length - 1)] : null;
  const activeLayer =
    op == null
      ? null
      : op.layer != null
        ? op.layer
        : op.op_key === "embedding"
          ? -1
          : op.op_key === "output"
            ? nLayers
            : null;

  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const slabRefs = useRef<Array<Mesh | null>>([]);

  const rows = useMemo(() => {
    const arr: { y: number; key: number; label: string | null }[] = [];
    for (let i = -1; i <= nLayers; i++)
      arr.push({
        y: -(i + 1) * GAP,
        key: i,
        label: i === -1 ? "Embeddings" : i === nLayers ? "Output" : null,
      });
    return arr;
  }, [nLayers]);

  useEffect(() => {
    if (controls) controls.enabled = !followMode;
  }, [controls, followMode]);

  const opCol: [number, number, number] = op
    ? OP_COLORS[op.op_key] ?? [0.5, 0.6, 0.8]
    : [0.5, 0.6, 0.8];

  useFrame(() => {
    slabRefs.current.forEach((m, idx) => {
      if (!m) return;
      const key = idx - 1;
      const isActive = key === activeLayer;
      const mat = m.material as MeshStandardMaterial;
      mat.emissiveIntensity += ((isActive ? 1.7 : 0.05) - mat.emissiveIntensity) * 0.2;
    });
    if (followMode && activeLayer != null && controls) {
      const y = -(activeLayer + 1) * GAP;
      const dest = view2D ? tmp.set(0, y, 16) : tmp.set(11, y + 1.5, 13);
      camera.position.lerp(dest, 0.07);
      controls.target.lerp(tmp.set(0, y, 0), 0.12);
      controls.update();
    }
  });

  return (
    <group>
      {rows.map((r, idx) => {
        const isActive = r.key === activeLayer;
        const base = isActive
          ? new Color(...opCol)
          : new Color(0.42, 0.46, 0.54);
        return (
          <group key={idx} position={[0, r.y, 0]}>
            <mesh ref={(el) => void (slabRefs.current[idx] = el)}>
              <boxGeometry args={[8, 0.72, 8]} />
              <meshStandardMaterial
                color={base}
                emissive={base}
                emissiveIntensity={isActive ? 1.7 : 0.05}
                roughness={0.5}
                metalness={0.2}
              />
            </mesh>
            {r.label && (
              <Billboard position={[-5.4, 0, 0]}>
                <Text fontSize={0.42} anchorX="right" color="#8a97bd">
                  {r.label}
                </Text>
              </Billboard>
            )}
          </group>
        );
      })}

      {op && activeLayer != null && (
        <Billboard position={[5.6, -(activeLayer + 1) * GAP, 0]}>
          <Text
            fontSize={0.5}
            anchorX="left"
            color="#e6ecff"
            outlineWidth={0.02}
            outlineColor="#05060a"
          >
            {op.label}
            {op.layer != null ? ` · Layer ${op.layer}` : ""}
          </Text>
        </Billboard>
      )}
    </group>
  );
}
