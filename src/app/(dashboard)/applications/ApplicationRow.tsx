"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CompanyLogo } from "@/components/CompanyLogo";
import { UndoToast } from "@/components/UndoToast";
import { ROLE_TYPE_LABELS, ROLE_TYPE_STYLES } from "@/lib/roleType";
import { STATUSES, getSkippedStages } from "@/lib/applications";
import { updateApplicationStatus, deleteApplication } from "./actions";

const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));

// How long the "Removed. Undo" toast stays up before the delete actually commits.
const UNDO_MS = 5000;

type PendingChange = { next: string; checked: Set<string> };

export function ApplicationRow({
  applicationId,
  initialStatus,
  roleTitle,
  roleType,
  companyName,
  slug,
  logoUrl,
}: {
  applicationId: string;
  initialStatus: string;
  roleTitle: string;
  roleType: string | null;
  companyName: string;
  slug: string | null;
  logoUrl: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [pendingRemove, setPendingRemove] = useState(false);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [isPending, startTransition] = useTransition();
  const removeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function onStatusChange(next: string) {
    const skipped = getSkippedStages(status, next);
    if (skipped.length > 0) {
      setPending({ next, checked: new Set(skipped) });
      return;
    }
    commitChange(next, []);
  }

  function commitChange(next: string, backfillStages: string[]) {
    const previous = status;
    setStatus(next);
    setPending(null);
    startTransition(() => {
      updateApplicationStatus(applicationId, next, backfillStages).catch(() => setStatus(previous));
    });
  }

  function toggleSkipped(stage: string, checked: boolean) {
    setPending((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.checked);
      if (checked) next.add(stage);
      else next.delete(stage);
      return { ...prev, checked: next };
    });
  }

  function onRemove() {
    setPendingRemove(true);
    removeTimer.current = setTimeout(() => {
      startTransition(() => {
        deleteApplication(applicationId).catch(() => setPendingRemove(false));
      });
    }, UNDO_MS);
  }

  function onUndoRemove() {
    clearTimeout(removeTimer.current);
    setPendingRemove(false);
  }

  if (pendingRemove) {
    return <UndoToast message="Application removed." onUndo={onUndoRemove} />;
  }

  const skipped = pending ? getSkippedStages(status, pending.next) : [];

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {slug ? (
          <Link href={`/companies/${slug}`}>
            <CompanyLogo name={companyName} logoUrl={logoUrl} />
          </Link>
        ) : (
          <CompanyLogo name={companyName} logoUrl={logoUrl} />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words font-medium text-ink">{roleTitle}</p>
            {roleType && ROLE_TYPE_LABELS[roleType] && (
              <span
                className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${ROLE_TYPE_STYLES[roleType]}`}
              >
                {ROLE_TYPE_LABELS[roleType]}
              </span>
            )}
          </div>
          <p className="text-sm text-ink-soft">
            {slug ? (
              <Link href={`/companies/${slug}`} className="hover:underline">
                {companyName}
              </Link>
            ) : (
              companyName
            )}
          </p>
        </div>
      </div>

      <div className="relative flex shrink-0 items-center gap-2">
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          disabled={isPending}
          className="rounded border border-paper-line bg-paper px-3 py-2 text-sm text-ink disabled:opacity-50"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          disabled={isPending}
          className="text-sm text-ink-soft hover:text-status-rejected disabled:opacity-50"
        >
          Remove
        </button>

        {pending && (
          <div className="stamp-pop absolute right-0 top-full z-10 mt-2 w-64 p-3">
            <p className="text-sm text-ink">
              Jumping to {STATUS_LABEL[pending.next]} — did this go through these first?
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {skipped.map((stage) => (
                <label key={stage} className="flex items-center gap-2 text-sm text-ink-soft">
                  <input
                    type="checkbox"
                    checked={pending.checked.has(stage)}
                    onChange={(e) => toggleSkipped(stage, e.target.checked)}
                    className="h-4 w-4 rounded border-paper-line"
                  />
                  {STATUS_LABEL[stage]}
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => commitChange(pending.next, Array.from(pending.checked))}
                className="rounded bg-ink px-2 py-1 text-xs font-medium text-paper"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded border border-paper-line px-2 py-1 text-xs text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
