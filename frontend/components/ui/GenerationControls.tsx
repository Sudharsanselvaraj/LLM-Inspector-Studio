"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

const DEFAULT_PROMPT = "Name one primary color. Answer in one word.";

export default function GenerationControls() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const start = useStore((s) => s.startGeneration);
  const status = useStore((s) => s.genStatus);

  const streaming = status === "streaming";

  return (
    <div className="panel selector">
      <form
        className="sentence-form"
        style={{ marginTop: 0, flexDirection: "column", alignItems: "stretch" }}
        onSubmit={(e) => {
          e.preventDefault();
          const p = prompt.trim();
          if (p && !streaming) start(p);
        }}
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Prompt for the model to generate from…"
          spellCheck={false}
          style={{ minWidth: 0 }}
        />
        <button
          className="primary"
          type="submit"
          disabled={streaming}
          style={{ width: "100%" }}
        >
          {streaming ? "Generating…" : "Generate"}
        </button>
      </form>
      <div className="footer-note" style={{ marginTop: 8 }}>
        Streams a real greedy generation over WebSocket — one message per token,
        each carrying the top-k probabilities and per-layer activation stats.
      </div>
    </div>
  );
}
