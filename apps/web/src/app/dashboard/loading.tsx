export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 rounded-lg bg-line" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 rounded-xl bg-line" /><div className="h-24 rounded-xl bg-line" /><div className="h-24 rounded-xl bg-line" />
      </div>
      <div className="h-32 rounded-xl bg-line" />
    </div>
  );
}
