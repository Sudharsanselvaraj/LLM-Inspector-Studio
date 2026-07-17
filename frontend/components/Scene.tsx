"use client";

import { useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { useStore } from "@/lib/store";
import TensorCloud from "./scenes/TensorCloud";
import GenerationScene from "./scenes/GenerationScene";
import WalkthroughScene from "./scenes/WalkthroughScene";
import Effects from "./Effects";

/** Dev aid: expose scene stats + an on-demand framebuffer grab for verification. */
function DebugExpose() {
  const { scene, camera, gl } = useThree();
  useFrame(() => {
    (window as unknown as Record<string, unknown>).__ns = {
      children: scene.children.length,
      camPos: camera.position.toArray().map((v) => +v.toFixed(2)),
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
    };
  });
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__grabFB = () => {
      const ctx = gl.getContext();
      const w = ctx.drawingBufferWidth;
      const h = ctx.drawingBufferHeight;
      if (!w || !h) return null;
      const buf = new Uint8Array(w * h * 4);
      ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, buf);
      const flipped = new Uint8ClampedArray(w * h * 4);
      for (let row = 0; row < h; row++) {
        const s = row * w * 4;
        flipped.set(buf.subarray(s, s + w * 4), (h - 1 - row) * w * 4);
      }
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      off.getContext("2d")!.putImageData(new ImageData(flipped, w, h), 0, 0);
      return off.toDataURL("image/png");
    };
  }, [gl]);
  return null;
}

export default function Scene() {
  const mode = useStore((s) => s.mode);
  const quality = useStore((s) => s.quality);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 60], fov: 50, near: 0.1, far: 4000 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 80, 320]} />
      <ambientLight intensity={0.7} />
      <pointLight position={[20, 20, 30]} intensity={1.0} />

      {mode === "explorer" && <TensorCloud />}
      {mode === "generation" && <GenerationScene />}
      {mode === "walkthrough" && <WalkthroughScene />}

      <DebugExpose />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={2} maxDistance={2000} />

      {/* Bloom only in generation cinematic mode — off in the explorer (perf). */}
      {mode === "generation" && quality === "cinematic" && <Effects />}
    </Canvas>
  );
}
