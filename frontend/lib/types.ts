// TypeScript mirrors of the backend response schemas (backend/app/schemas.py).

export interface Token {
  index: number;
  text: string;
  piece: string;
  id: number;
  is_special: boolean;
}

export interface Projection {
  method: string;
  note: string;
  embedding_explained_variance: number[];
}

export interface LogitLensEntry {
  text: string;
  token_id: number;
  prob: number;
}

export interface AnalyzeResponse {
  sentence: string;
  model: string;
  device: string;
  num_layers: number;
  num_heads: number;
  hidden_size: number;
  tokens: Token[];
  // attention[layer][head][from][to] — real softmax attention weights.
  attention: number[][][][];

  // Phase 2 geometry (PCA projections of real hidden states).
  embeddings_3d: [number, number, number][]; // [token] -> [x,y,z]
  hidden_states_3d: Record<string, [number, number, number][]>; // "layer" -> coords
  embedding_norms: number[];
  projection: Projection | null;

  // Phase 4: logit lens (v0.3).
  logit_lens: LogitLensEntry[][][]; // [layer][position][top-5]
}

export type District = "tokenizer" | "embedding" | "attention" | "generation";

// --- Overhaul: modes + architecture explorer ----------------------------- //
export type Mode = "explorer" | "generation" | "walkthrough" | "debugger";

export interface TensorInfo {
  name: string;
  shape: number[];
  dtype: string;
  n_params: number;
  offset?: number; // GGUF byte offset (optional)
  ggmlType?: number; // raw ggml type enum (for dequantization)
  // parsed client-side from the name:
  layer?: number | null;
  role?: string;
}

export interface ArchMetadata {
  architecture: string;
  name: string;
  total_params: number;
  num_layers: number;
  hidden_size: number;
  num_heads: number;
  num_kv_heads: number;
  head_dim: number;
  ffn_size: number | null;
  vocab_size: number;
  context_length: number | null;
  rope_theta: number | null;
  tie_word_embeddings?: boolean | null;
  torch_dtype?: string;
  // GGUF-only extras:
  quantization?: string;
  gguf_version?: number;
  file_size?: number;
  expert_count?: number | null;
  expert_used_count?: number | null;
}

export interface ArchitectureData {
  source: "model" | "gguf";
  model?: string;
  device?: string;
  metadata: ArchMetadata;
  tensor_count: number;
  tensors: TensorInfo[];
}

// --- Phase 3: streaming generation --------------------------------------- //
export interface TopKCandidate {
  id: number;
  text: string;
  logit: number;
  prob: number;
}

export interface OpCatalogEntry {
  index: number;
  op_key: string;
  label: string;
  layer: number | null;
  param_count: number;
  cumulative_params: number;
  in_dim: number | null;
  out_dim: number | null;
  bias_dim: number | null;
  weight_preview: number[][];
}

export interface GenMeta {
  model: string;
  device: string;
  architecture: string;
  num_layer_stats: number;
  num_layers: number;
  prompt_tokens: string[];
  prompt_len: number;
  max_new_tokens: number;
  top_k: number;
  decoding: string;
  uses_kv_cache?: boolean;
  op_catalog?: OpCatalogEntry[];
}

export interface TokenFrame {
  type: "token";
  step: number;
  chosen: { id: number; text: string; logprob: number };
  topk: TopKCandidate[];
  layer_stats: number[]; // real mean |activation| per layer (len = num_layer_stats)
  eos: boolean;
  // Real KV-cache accounting (present when the backend uses a cache).
  phase?: "prefill" | "decode";
  n_positions?: number; // tokens actually computed this step
  cache_len?: number; // cached positions reused this step
}

export type GenStatus = "idle" | "streaming" | "done" | "error";

// --- Trace format (v0.2 Record & Replay) ---------------------------------- //
export interface Trace {
  trace_version: number;
  created_at: string;
  model: string;
  meta: GenMeta;
  frames: TokenFrame[];
  done: { generated_text: string; total_steps: number } | null;
}

// --- v0.25 Hot-spot ranking ------------------------------------------------ //
export interface HotSpot {
  name: string;
  score: number; // Mean Abs Diff per element
  rank: number;
}

// --- v0.4 Debug snapshot --------------------------------------------------- //
export interface DebugSnapshotEntry {
  shape: number[];
  dtype: string;
  sample: number[];
  n_elements: number;
}

export interface DebugSnapshot {
  [modulePath: string]: DebugSnapshotEntry;
}
