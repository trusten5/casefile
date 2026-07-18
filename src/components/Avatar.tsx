export function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tab font-display text-sm font-semibold text-ink-soft">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
