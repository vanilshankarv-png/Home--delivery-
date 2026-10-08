export default function ServiceSkeleton({ count = 6 }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
          <div className="h-40 animate-pulse bg-white/[0.06]" />
          <div className="grid gap-3 p-5">
            <div className="h-4 w-3/5 animate-pulse rounded bg-white/[0.08]" />
            <div className="h-3 w-full animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-white/[0.06]" />
            <div className="mt-2 h-4 w-2/5 animate-pulse rounded bg-white/[0.08]" />
          </div>
        </div>
      ))}
    </div>
  );
}
