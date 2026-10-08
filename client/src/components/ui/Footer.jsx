import { Link } from "react-router-dom";
import { Home } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.07] bg-midnight/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Link to="/app" className="inline-flex items-center gap-2 font-semibold tracking-wide text-slate-300">
          <Home size={16} className="text-accent" /> HOME DELIVERY
        </Link>
        <p>Trusted pros. Fair prices. Live tracking.</p>
      </div>
    </footer>
  );
}
