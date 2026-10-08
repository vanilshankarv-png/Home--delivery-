import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import Card from "../ui/Card.jsx";
import Footer from "../ui/Footer.jsx";

export default function AuthShell({ eyebrow, title, description, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-midnight bg-hero-glow text-white">
      <header className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-3 text-sm font-semibold tracking-wide text-white">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-accent/20 bg-accent/10 text-accent"><Home size={19} /></span>
          HOME <span className="text-accent">DELIVERY</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <section className="w-full max-w-lg">
          <div className="mb-7 text-center">
            <p className="text-xs font-bold tracking-[0.28em] text-accent">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
          </div>
          <Card className="p-6 sm:p-8">{children}</Card>
        </section>
      </main>
      <Footer />
    </div>
  );
}
