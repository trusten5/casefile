"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const DEFAULT_DEBOUNCE_MS = 400;

// Shared by every URL-driven filter bar (feed, applications, …): selects
// apply immediately, free-text fields debounce so we're not re-fetching on
// every keystroke. Client-side-only filters (e.g. ContactList's in-memory
// search) don't need this — there's no router navigation to debounce.
export function useUrlFilters<T extends Record<string, string>>(
  initial: T,
  buildUrl: (filters: T) => string,
  debounceMs: number = DEFAULT_DEBOUNCE_MS
) {
  const router = useRouter();
  const [filters, setFilters] = useState<T>(initial);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function applyImmediately(patch: Partial<T>) {
    clearTimeout(debounceRef.current);
    const next = { ...filters, ...patch };
    setFilters(next);
    router.replace(buildUrl(next));
  }

  function applyDebounced(patch: Partial<T>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => router.replace(buildUrl(next)), debounceMs);
  }

  return { filters, applyImmediately, applyDebounced };
}
