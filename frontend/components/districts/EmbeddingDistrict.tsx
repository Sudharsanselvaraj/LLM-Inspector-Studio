"use client";

import { useMemo, useRef } from "react";
import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Color, Group, Vector3 } from "three";

import { useStore } from "@/lib/store";
import type { Token } from "@/lib/types";

const tmp = new Vector3();

function label(t: Token): string {
  const s = t.text.trim();
  return s.length === 0 ? t.piece : s.length > 12 ? s.slice(0, 12) + "…" : s;
}

function nodeColor(i: number): Color {
  return new Color().setHSL((i * 0.13) % 1, 0.55, 0.62);
}

/**
 * Embedding District: places each token at its real PCA-projected 3D position
 * for the selected layer (0 = token embeddings). Scrubbing the layer morphs the
 * cloud — you watch the geometry change as tokens get contextualized. This is a
 * PROJECTION of 896-dim vectors; distances are approximate (surfaced in the UI).
 */
export default function EmbeddingDistrict() {
  const data = useStore((s) => s.data);
  const layer = useStore((s) => s.embeddingLayer);

  const coords = useMemo(() => {
    if (!data) return [];
    return data.hidden_states_3d?.[String(layer)] ?? data.embeddings_3d ?? [];
  }, [data, layer]);

  const refs = useRef<Array<Group | null>>([]);

  useFrame(() => {
    refs.current.forEach((g, i) => {
      const c = coords[i];
      if (g && c) g.position.lerp(tmp.set(c[0], c[1], c[2]), 0.12);
    });
  });

  if (!data) return null;

  return (
    <group>
      {/* Faint wireframe box framing the projected space [-8, 8]. */}
      <mesh>
        <boxGeometry args={[17, 17, 17]} />
        <meshBasicMaterial color="#1b2340" wireframe transparent opacity={0.35} />
      </mesh>

      <Billboard position={[0, 10.5, 0]}>
        <Text fontSize={0.6} anchorX="center" color="#e6ecff" outlineWidth={0.02} outlineColor="#000000">
          {layer === 0 ? "Token embeddings" : `Hidden state · layer ${layer}`}
        </Text>
        <Text position={[0, -0.85, 0]} fontSize={0.26} anchorX="center" color="#8a97bd">
          PCA projection — distances approximate
        </Text>
      </Billboard>

      {data.tokens.map((t, i) => {
        const c = nodeColor(i);
        return (
          <group key={i} ref={(el) => void (refs.current[i] = el)}>
            <mesh>
              <sphereGeometry args={[0.32, 24, 24]} />
              <meshStandardMaterial
                color={c}
                emissive={c}
                emissiveIntensity={0.35}
                roughness={0.4}
                metalness={0.15}
              />
            </mesh>
            <Billboard position={[0, 0.62, 0]}>
              <Text
                fontSize={0.4}
                anchorX="center"
                anchorY="bottom"
                color={t.is_special ? "#6d7aa0" : "#e6ecff"}
                outlineWidth={0.02}
                outlineColor="#000000"
              >
                {label(t)}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}
