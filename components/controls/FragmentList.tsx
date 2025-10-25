"use client";

import type { ContentFragment } from "@/types/content";

interface FragmentListProps {
  fragments: ContentFragment[];
}

export default function FragmentList({ fragments }: FragmentListProps) {
  return (
    <div className="controls-card">
      <h2>Document Structure</h2>
      <p>Each row mirrors the fragments rendered in the preview pane.</p>
      <ol style={{ margin: 0, paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {fragments.map((fragment, index) => (
          <li key={fragment.id} style={{ fontSize: "0.95rem" }}>
            <strong style={{ display: "block" }}>
              {index + 1}. {fragment.label ?? fragment.id}
            </strong>
            <span style={{ color: "#6b7280" }}>
              {fragment.type === "markdown" ? "Markdown fragment" : "Embedded PDF"}
            </span>
            {"note" in fragment && fragment.note ? (
              <span style={{ display: "block", color: "#2563eb", marginTop: "0.25rem" }}>{fragment.note}</span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
