"use client";

import { createPortal } from "react-dom";

export function UndoToast({ message, onUndo }: { message: string; onUndo: () => void }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded bg-ink px-4 py-2 text-sm text-paper shadow-[4px_4px_0_var(--paper-line)]">
        {message}
        <button type="button" onClick={onUndo} className="font-medium underline">
          Undo
        </button>
      </div>
    </div>,
    document.body
  );
}
