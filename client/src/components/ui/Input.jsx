export default function Input({ label, id, error, className = "", ...props }) {
  const inputId = id || props.name;

  return (
    <div className="grid gap-2">
      {label && <label htmlFor={inputId} className="text-sm font-medium text-slate-200">{label}</label>}
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`w-full rounded-xl border border-white/10 bg-midnight/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-accent/60 focus:ring-2 focus:ring-accent/15 ${error ? "border-rose-400/70" : ""} ${className}`}
        {...props}
      />
      {error && <p id={`${inputId}-error`} className="text-sm text-rose-300">{error}</p>}
    </div>
  );
}
