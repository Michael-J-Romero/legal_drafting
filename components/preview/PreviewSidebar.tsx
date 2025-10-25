"use client";

import type { DocumentFragment } from "@/types/fragments";

interface PreviewSidebarProps {
  fragments: DocumentFragment[];
}

const PreviewSidebar: React.FC<PreviewSidebarProps> = ({ fragments }) => {
  return (
    <aside className="preview-sidebar" aria-label="Document outline">
      <div className="card">
        <h2>Document Outline</h2>
        <ul>
          {fragments.map((fragment) => (
            <li key={`outline-${fragment.id}`}>
              {fragment.kind === "markdown"
                ? fragment.label ?? fragment.id
                : fragment.title ?? "PDF attachment"}
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h2>Workflow</h2>
        <p>
          Preview the merged document, print directly from the browser, or export the assembled
          fragments to a single PDF when the compiler is implemented.
        </p>
      </div>
    </aside>
  );
};

export default PreviewSidebar;
