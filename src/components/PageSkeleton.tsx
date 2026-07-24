// Generic route-loading fallback — shown instantly on navigation while a
// force-dynamic page's Supabase queries are still in flight, via each
// route's loading.tsx. One shared shape instead of a bespoke skeleton per
// page: close enough to any list/dashboard layout to avoid a layout jump
// when the real content swaps in.
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-48 rounded bg-tab/40" />
      <div className="mt-2 h-4 w-72 rounded bg-tab/30" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-14 rounded-lg border border-paper-line bg-tab/10" />
        ))}
      </div>
    </div>
  );
}
