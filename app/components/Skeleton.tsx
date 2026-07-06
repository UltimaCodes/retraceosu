// pulsing placeholder while a report crunches
export function ReportSkeleton({ note }: { note?: string }) {
  return (
    <div className="mt-6 space-y-4">
      {note && <p className="text-sm text-white/40">{note}</p>}
      <div className="animate-pulse space-y-4">
        <div className="h-24 rounded-xl bg-white/5" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="h-16 rounded-lg bg-white/5" />
          <div className="h-16 rounded-lg bg-white/5" />
          <div className="h-16 rounded-lg bg-white/5" />
          <div className="h-16 rounded-lg bg-white/5" />
        </div>
        <div className="h-72 rounded-xl bg-white/5" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-48 rounded-xl bg-white/5" />
          <div className="h-48 rounded-xl bg-white/5" />
        </div>
      </div>
    </div>
  );
}
