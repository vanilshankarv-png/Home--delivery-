import { LoaderCircle } from "lucide-react";

export default function Spinner({ label = "Loading", className = "" }) {
  return (
    <div role="status" className={`inline-flex items-center gap-3 text-sm text-slate-300 ${className}`}>
      <LoaderCircle aria-hidden="true" className="animate-spin text-accent" size={20} />
      <span>{label}</span>
    </div>
  );
}
