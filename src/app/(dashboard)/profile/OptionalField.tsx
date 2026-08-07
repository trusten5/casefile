"use client";

import { useState } from "react";

// Starts collapsed to a "+ Add X" button when there's no saved value yet —
// an already-filled field still just shows as a normal input so it stays
// editable. The input only needs a `name` for the surrounding <form> to pick
// it up on submit; collapsed fields simply aren't in the FormData at all,
// which the server action already treats the same as an empty string.
export function OptionalField({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
}) {
  const [expanded, setExpanded] = useState(Boolean(defaultValue));

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="rounded border border-dashed border-paper-line px-3 py-2 text-sm text-ink-soft hover:border-ink-soft hover:text-ink"
      >
        + {label}
      </button>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-xs text-ink-soft">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoFocus
        className="rounded border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
      />
    </label>
  );
}
