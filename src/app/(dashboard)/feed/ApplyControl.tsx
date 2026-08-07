"use client";

import { useEffect, useRef, useState } from "react";

function ExternalLinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="3" />
    </svg>
  );
}

// Opening a posting in a new tab and coming back is a strong "did you apply?"
// signal — cheaper to ask than to make the user remember to check a box.
export function ApplyControl({
  url,
  initialApplied,
  onApply,
  onReportBroken,
}: {
  url: string;
  initialApplied: boolean;
  onApply: () => Promise<void>;
  onReportBroken: () => Promise<void>;
}) {
  const [applied, setApplied] = useState(initialApplied);
  const [showPrompt, setShowPrompt] = useState(false);
  const [pending, setPending] = useState(false);
  const [reported, setReported] = useState(false);
  const awaitingReturn = useRef(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible" && awaitingReturn.current) {
        awaitingReturn.current = false;
        setShowPrompt(true);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (!showPrompt) return;
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowPrompt(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showPrompt]);

  function markApplied() {
    setApplied(true);
    setShowPrompt(false);
    setPending(true);
    onApply().finally(() => setPending(false));
  }

  function reportBroken() {
    setShowPrompt(false);
    setReported(true);
    onReportBroken();
  }

  if (reported) {
    return <p className="text-sm text-ink-soft">Reported — thanks, we&apos;ll take a look.</p>;
  }

  return (
    <div className="relative flex items-center gap-3">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          if (!applied) awaitingReturn.current = true;
        }}
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink"
      >
        Apply
        <ExternalLinkIcon />
      </a>
      <label className="flex items-center gap-1.5 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={applied}
          disabled={applied || pending}
          onChange={() => !applied && markApplied()}
          className="h-4 w-4 rounded border-paper-line"
        />
        Applied
      </label>
      <div className="group relative">
        <button
          type="button"
          onClick={reportBroken}
          aria-label="Report broken link"
          className="text-ink-soft hover:text-status-rejected"
        >
          <FlagIcon />
        </button>
        <span className="stamp-pop pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap px-2 py-1 text-xs text-ink opacity-0 transition-opacity group-hover:opacity-100">
          Report broken link
        </span>
      </div>

      {showPrompt && (
        <div
          ref={popupRef}
          className="stamp-pop absolute right-0 top-full z-10 mt-2 w-52 p-3"
        >
          <p className="text-sm text-ink">Did you apply?</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={markApplied}
              className="rounded bg-ink px-2 py-1 text-xs font-medium text-paper"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setShowPrompt(false)}
              className="rounded border border-paper-line px-2 py-1 text-xs text-ink"
            >
              Not yet
            </button>
          </div>
          <button
            type="button"
            onClick={reportBroken}
            className="mt-2 text-xs text-ink-soft underline hover:text-status-rejected"
          >
            Report broken link instead
          </button>
        </div>
      )}
    </div>
  );
}
