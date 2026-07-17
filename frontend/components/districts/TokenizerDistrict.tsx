"use client";

import { useEffect, useMemo, useRef } from "react";
import { Billboard, RoundedBox, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Color, Group } from "three";

import { useStore } from "@/lib/store";
import type { Token } from "@/lib/types";

const SPACING = 2.6;

function label(t: Token): string {
  const s = t.text.replace(/\n/g, "\\n");
  const trimmed = s.trim();
  return trimmed.length === 0 ? "␣" : trimmed;
}

function chipColor(i: number): Color {
  return new Color().setHSL((i * 0.13) % 1, 0.5, 0.55);
}

/**
 * Tokenizer District: shows the raw input string, then its tokens "breaking
 * apart" into separate chips. The chips start clustered at the center and ease
 * out to their row positions (a simple lerp animation, not physics).
 */
export default function TokenizerDistrict() {
  const data = useStore((s) => s.data);
  const tokens = data?.tokens ?? [];
  const n = tokens.length;

  const targets = useMemo(
    () => tokens.map((_, i) => (i - (n - 1) / 2) * SPACING),
    [n], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const refs = useRef<Array<Group | null>>([]);

  // On a new sentence, collapse chips to the center so they animate apart.
  useEffect(() => {
    refs.current.forEach((g) => g && (g.position.x = 0));
  }, [data?.sentence]);

  useFrame(() => {
    refs.current.forEach((g, i) => {
      if (g) g.position.x += (targets[i] - g.position.x) * 0.09;
    });
  });

  if (!data) return null;

  return (
    <group>
      {/* Raw input string above the tokens. */}
      <Billboard position={[0, 4.4, 0]}>
        <Text
          fontSize={0.6}
          maxWidth={30}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
          color="#e6ecff"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {`“${data.sentence}”`}
        </Text>
        <Text position={[0, -0.9, 0]} fontSize={0.28} color="#8a97bd" anchorX="center">
          tokenizer → {n} tokens
        </Text>
      </Billboard>

      {tokens.map((t, i) => {
        const c = chipColor(i);
        return (
          <group key={i} ref={(el) => void (refs.current[i] = el)}>
            <RoundedBox args={[2.0, 1.0, 0.35]} radius={0.16} smoothness={3}>
              <meshStandardMaterial
                color={c}
                emissive={c}
                emissiveIntensity={0.25}
                roughness={0.5}
                metalness={0.1}
              />
            </RoundedBox>
            <Billboard>
              <Text
                position={[0, 0, 0.24]}
                fontSize={0.42}
                anchorX="center"
                anchorY="middle"
                color="#0a0f1c"
              >
                {label(t)}
              </Text>
            </Billboard>
            <Text
              position={[0, -0.85, 0]}
              fontSize={0.22}
              anchorX="center"
              anchorY="middle"
              color="#5b678c"
            >
              #{t.id}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
