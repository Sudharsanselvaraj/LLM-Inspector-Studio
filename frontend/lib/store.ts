import { create } from "zustand";
import { analyzeSentence, fetchArchitecture } from "./api";
import { layerAnchors, anchorPosFor } from "./playback";
import { wsGenerate } from "./ws";
import { cueDistrict, cueToken, setMuted as setSoundMuted } from "./sound";
import { annotateTensors } from "./tensorName";
import type {
  AnalyzeResponse,
  ArchitectureData,
  District,
  GenMeta,
  GenStatus,
  Mode,
  TokenFrame,
} from "./types";

interface NeuroState {
  data: AnalyzeResponse | null;
  loading: boolean;
  error: string | null;

  // Top-level app mode (replaces the district flythrough).
  mode: Mode;
  setMode: (m: Mode) => void;

  // --- Architecture Explorer ------------------------------------------- //
  arch: ArchitectureData | null;
  archLoading: boolean;
  archError: string | null;
  loadArchitecture: () => Promise<void>; // model-backed source (/architecture)
  loadGgufFile: (file: File) => Promise<void>; // client-side GGUF drag-drop
  setArch: (a: ArchitectureData | null) => void;
  selectedTensor: string | null;
  hoveredTensor: string | null;
  setSelectedTensor: (name: string | null) => void;
  setHoveredTensor: (name: string | null) => void;
  // explorer controls
  pointBudget: number;
  pointSize: number;
  colorBy: "layer" | "role";
  showConnections: boolean;
  showLayerBoxes: boolean;
  setPointBudget: (n: number) => void;
  setPointSize: (n: number) => void;
  setColorBy: (c: "layer" | "role") => void;
  setShowConnections: (b: boolean) => void;
  setShowLayerBoxes: (b: boolean) => void;

  // Which district the camera is visiting.
  currentDistrict: District;
  setDistrict: (d: District) => void;

  // Phase 4: cinematic / accessibility settings.
  quality: "cinematic" | "performance";
  toggleQuality: () => void;
  muted: boolean;
  toggleMuted: () => void;

  // Attention District controls
  selectedLayer: number;
  selectedHead: number;
  minWeight: number; // only draw beams with weight >= this

  // Embedding District controls
  embeddingLayer: number; // which layer's hidden state to project (0 = embeddings)

  setLayer: (l: number) => void;
  setHead: (h: number) => void;
  setMinWeight: (w: number) => void;
  setEmbeddingLayer: (l: number) => void;
  analyze: (sentence: string) => Promise<void>;

  // --- Phase 3: generation ---------------------------------------------- //
  genStatus: GenStatus;
  genMeta: GenMeta | null;
  genFrames: TokenFrame[]; // recorded real frames (for replay)
  genText: string;
  genError: string | null;
  playIndex: number; // which recorded frame is displayed
  isPlaying: boolean;

  startGeneration: (prompt: string) => void;
  setPlayIndex: (i: number) => void;
  stepPlay: (dir: 1 | -1) => void;
  togglePlay: () => void;
  replay: () => void;

  // Op-walkthrough playback (Generation panel).
  opIndex: number;
  opPlaying: boolean;
  followMode: boolean;
  view2D: boolean;
  playSpeed: number; // animation-speed multiplier (pacing only, never data)
  autoStarted: boolean; // has autoplay kicked off for the current trace?
  setOpIndex: (i: number) => void;
  stepOp: (dir: 1 | -1) => void;
  toggleOpPlay: () => void;
  toggleFollow: () => void;
  toggleView2D: () => void;
  setPlaySpeed: (n: number) => void;
  setAutoStarted: (b: boolean) => void;
  skipToNextLayer: () => void;
  skipToNextToken: () => void;

  // Optional overlays (off/neutral by default where the addendum asks).
  showEquations: boolean; // per-layer LaTeX (kept on: it's the spec's teaching content)
  devMode: boolean; // raw sampled tensor values + indices for the active op
  brightness: number; // global scene-brightness multiplier (user preference)
  toggleEquations: () => void;
  toggleDevMode: () => void;
  setBrightness: (n: number) => void;

  // Educational walkthrough.
  wtChapter: number;
  wtModel: string;
  wtPlaying: boolean; // chapter autoplay (reuses the playback engine's pacing)
  setWtChapter: (i: number) => void;
  nextChapter: () => void;
  prevChapter: () => void;
  setWtModel: (id: string) => void;
  toggleWtPlay: () => void;
}

let genSocket: WebSocket | null = null;

export const useStore = create<NeuroState>((set) => ({
  data: null,
  loading: false,
  error: null,

  mode: "explorer",
  setMode: (m) => set({ mode: m }),

  arch: null,
  archLoading: false,
  archError: null,
  loadArchitecture: async () => {
    set({ archLoading: true, archError: null });
    try {
      const raw = await fetchArchitecture();
      const arch = { ...raw, tensors: annotateTensors(raw.tensors) };
      set({ arch, archLoading: false });
    } catch (e) {
      set({
        archLoading: false,
        archError: e instanceof Error ? e.message : "Failed to load architecture",
      });
    }
  },
  loadGgufFile: async (file) => {
    set({ archLoading: true, archError: null });
    try {
      const { parseGgufFile } = await import("./gguf/parser");
      const data = await parseGgufFile(file);
      set({
        arch: { ...data, tensors: annotateTensors(data.tensors) },
        archLoading: false,
        selectedTensor: null,
        hoveredTensor: null,
        mode: "explorer",
      });
    } catch (e) {
      set({
        archLoading: false,
        archError: e instanceof Error ? e.message : "GGUF parse failed",
      });
    }
  },
  setArch: (a) =>
    set({
      arch: a ? { ...a, tensors: annotateTensors(a.tensors) } : null,
      selectedTensor: null,
      hoveredTensor: null,
    }),
  selectedTensor: null,
  hoveredTensor: null,
  setSelectedTensor: (name) => set({ selectedTensor: name }),
  setHoveredTensor: (name) => set({ hoveredTensor: name }),
  pointBudget: 250_000,
  pointSize: 0.9,
  colorBy: "layer",
  showConnections: false,
  showLayerBoxes: false,
  setPointBudget: (n) => set({ pointBudget: n }),
  setPointSize: (n) => set({ pointSize: n }),
  setColorBy: (c) => set({ colorBy: c }),
  setShowConnections: (b) => set({ showConnections: b }),
  setShowLayerBoxes: (b) => set({ showLayerBoxes: b }),

  currentDistrict: "attention",
  setDistrict: (d) =>
    set((s) => {
      if (d !== s.currentDistrict) cueDistrict();
      return { currentDistrict: d };
    }),

  quality: "cinematic",
  toggleQuality: () =>
    set((s) => ({
      quality: s.quality === "cinematic" ? "performance" : "cinematic",
    })),
  muted: true, // sound is opt-in
  toggleMuted: () =>
    set((s) => {
      const muted = !s.muted;
      setSoundMuted(muted);
      return { muted };
    }),

  selectedLayer: 0,
  selectedHead: 0,
  minWeight: 0.05,
  embeddingLayer: 0,

  setLayer: (l) => set({ selectedLayer: l }),
  setHead: (h) => set({ selectedHead: h }),
  setMinWeight: (w) => set({ minWeight: w }),
  setEmbeddingLayer: (l) => set({ embeddingLayer: l }),

  analyze: async (sentence) => {
    set({ loading: true, error: null });
    try {
      const data = await analyzeSentence(sentence);
      // Clamp any existing selection to the new data's valid range.
      set((s) => ({
        data,
        loading: false,
        selectedLayer: Math.min(s.selectedLayer, data.num_layers - 1),
        selectedHead: Math.min(s.selectedHead, data.num_heads - 1),
        // hidden_states_3d has entries 0..num_layers (embeddings + each layer).
        embeddingLayer: Math.min(s.embeddingLayer, data.num_layers),
      }));
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Request failed",
      });
    }
  },

  // --- Phase 3: generation ------------------------------------------------ //
  genStatus: "idle",
  genMeta: null,
  genFrames: [],
  genText: "",
  genError: null,
  playIndex: -1,
  isPlaying: false,

  opIndex: 0,
  opPlaying: false,
  followMode: true,
  view2D: false,
  playSpeed: 0.5,
  autoStarted: false,
  setOpIndex: (i) =>
    set((s) => {
      const n = s.genMeta?.op_catalog?.length ?? 0;
      return { opIndex: Math.max(0, Math.min(i, Math.max(0, n - 1))), opPlaying: false };
    }),
  // Manual step is op-by-op (fine-grained) and pauses autoplay.
  stepOp: (dir) =>
    set((s) => {
      const n = s.genMeta?.op_catalog?.length ?? 0;
      return {
        opIndex: Math.max(0, Math.min(s.opIndex + dir, Math.max(0, n - 1))),
        opPlaying: false,
      };
    }),
  toggleOpPlay: () =>
    set((s) => {
      const n = s.genMeta?.op_catalog?.length ?? 0;
      if (n === 0) return {};
      // Restart from the top only if we're truly at the very end of the trace.
      const atLastOp = s.opIndex >= n - 1;
      const atLastToken = s.playIndex >= s.genFrames.length - 1;
      const rewind = !s.opPlaying && atLastOp && atLastToken;
      return {
        opPlaying: !s.opPlaying,
        opIndex: rewind ? 0 : s.opIndex,
        playIndex: rewind ? 0 : s.playIndex,
      };
    }),
  toggleFollow: () => set((s) => ({ followMode: !s.followMode })),
  toggleView2D: () => set((s) => ({ view2D: !s.view2D })),
  setPlaySpeed: (n) => set({ playSpeed: Math.max(0.25, Math.min(n, 4)) }),
  setAutoStarted: (b) => set({ autoStarted: b }),

  // Skip = jump straight to the next layer/token without animating the ops in
  // between (the follow camera then eases to the new target).
  skipToNextLayer: () =>
    set((s) => {
      const cat = s.genMeta?.op_catalog ?? [];
      const nLayers = s.genMeta?.num_layers ?? 0;
      if (cat.length === 0) return {};
      const anchors = layerAnchors(cat, nLayers);
      const pos = anchorPosFor(anchors, s.opIndex);
      if (pos < anchors.length - 1) return { opIndex: anchors[pos + 1] };
      // Past the last layer: roll to the next token's forward pass.
      if (s.playIndex < s.genFrames.length - 1)
        return { playIndex: s.playIndex + 1, opIndex: 0 };
      return {};
    }),
  skipToNextToken: () =>
    set((s) => {
      if (s.playIndex < s.genFrames.length - 1)
        return { playIndex: s.playIndex + 1, opIndex: 0 };
      return {};
    }),

  showEquations: true,
  devMode: false,
  brightness: 1,
  toggleEquations: () => set((s) => ({ showEquations: !s.showEquations })),
  toggleDevMode: () => set((s) => ({ devMode: !s.devMode })),
  setBrightness: (n) => set({ brightness: Math.max(0.3, Math.min(n, 2.5)) }),

  wtChapter: 0,
  wtModel: "qwen05",
  wtPlaying: false,
  // Manual chapter changes stop chapter autoplay so it doesn't fight the user.
  setWtChapter: (i) => set({ wtChapter: Math.max(0, i), wtPlaying: false }),
  nextChapter: () => set((s) => ({ wtChapter: s.wtChapter + 1 })),
  prevChapter: () => set((s) => ({ wtChapter: Math.max(0, s.wtChapter - 1), wtPlaying: false })),
  setWtModel: (id) => set({ wtModel: id }),
  toggleWtPlay: () => set((s) => ({ wtPlaying: !s.wtPlaying })),

  startGeneration: (prompt) => {
    genSocket?.close();
    set({
      genStatus: "streaming",
      genMeta: null,
      genFrames: [],
      genText: "",
      genError: null,
      playIndex: -1,
      isPlaying: false,
      opIndex: 0,
      opPlaying: false,
      autoStarted: false,
    });

    genSocket = wsGenerate(prompt, { maxNewTokens: 40, topK: 10, trace: true }, {
      onFrame: (raw) => {
        const f = raw as { type: string } & Record<string, unknown>;
        if (f.type === "meta") {
          set({ genMeta: raw as unknown as GenMeta });
        } else if (f.type === "token") {
          set((s) => {
            const frames = [...s.genFrames, raw as unknown as TokenFrame];
            cueToken(frames.length);
            // Before autoplay takes over, track the newest token so the strip
            // shows generation live; once autoplay starts it owns the cursor.
            return {
              genFrames: frames,
              playIndex: s.autoStarted ? s.playIndex : frames.length - 1,
            };
          });
        } else if (f.type === "done") {
          set({
            genStatus: "done",
            genText: String((f as Record<string, unknown>).generated_text ?? ""),
          });
        } else if (f.type === "error") {
          set({
            genStatus: "error",
            genError: String((f as Record<string, unknown>).message ?? "error"),
          });
        }
      },
      onError: () =>
        set((s) =>
          s.genStatus === "streaming"
            ? { genStatus: "error", genError: "connection error" }
            : {},
        ),
    });
  },

  setPlayIndex: (i) =>
    set((s) => ({
      playIndex: Math.max(0, Math.min(i, s.genFrames.length - 1)),
      isPlaying: false,
    })),

  stepPlay: (dir) =>
    set((s) => ({
      playIndex: Math.max(0, Math.min(s.playIndex + dir, s.genFrames.length - 1)),
      isPlaying: false,
    })),

  togglePlay: () =>
    set((s) => {
      if (s.genFrames.length === 0) return {};
      // If at the end, restart from the beginning on play.
      const atEnd = s.playIndex >= s.genFrames.length - 1;
      return {
        isPlaying: !s.isPlaying,
        playIndex: !s.isPlaying && atEnd ? 0 : s.playIndex,
      };
    }),

  replay: () =>
    set((s) => (s.genFrames.length ? { playIndex: 0, isPlaying: true } : {})),
}));
