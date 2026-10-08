const styles = {
  bronze: "border-orange-300/20 bg-orange-400/10 text-orange-200",
  silver: "border-slate-200/20 bg-slate-200/10 text-slate-100",
  gold: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  verified: "border-accent/25 bg-accent/10 text-accent"
};

export default function Badge({ level = "verified", children, className = "" }) {
  const normalizedLevel = level.toLowerCase();
  const label = children || (normalizedLevel === "verified"
    ? "Verified"
    : `${normalizedLevel[0].toUpperCase()}${normalizedLevel.slice(1)}`);

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${styles[normalizedLevel] || styles.verified} ${className}`}>
      {normalizedLevel === "verified" && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      {label}
    </span>
  );
}
