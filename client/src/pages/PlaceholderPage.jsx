import { Link } from "react-router-dom";
import { ArrowRight, Home } from "lucide-react";

const pageCopy = {
  home: {
    eyebrow: "HOME SERVICES, REIMAGINED",
    title: "Your home, in good hands.",
    description: "Book trusted local professionals for the things that make a house feel like home."
  },
  app: {
    eyebrow: "YOUR HOME DELIVERY",
    title: "Services that show up.",
    description: "Explore home services, manage bookings, and connect with verified professionals."
  },
  login: {
    eyebrow: "WELCOME BACK",
    title: "Good to have you home.",
    description: "Sign-in is coming soon. Your Home Delivery account experience starts here."
  },
  register: {
    eyebrow: "MAKE YOURSELF AT HOME",
    title: "Let's get you started.",
    description: "Account registration is coming soon. Find the right help for your home."
  }
};

export default function PlaceholderPage({ page }) {
  const content = pageCopy[page] || pageCopy.home;

  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-midnight bg-hero-glow px-6 text-white">
      <div className="absolute -left-32 top-1/3 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      <section className="relative mx-auto w-full max-w-6xl py-24">
        <Link to="/" className="mb-16 inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-white/80">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-accent">
            <Home size={18} />
          </span>
          HOME DELIVERY
        </Link>
        <p className="mb-5 text-xs font-bold tracking-[0.3em] text-accent">{content.eyebrow}</p>
        <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight sm:text-7xl">
          {content.title}
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">{content.description}</p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            to={page === "login" || page === "register" ? "/app" : "/app"}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold shadow-glow transition hover:bg-primary-dark"
          >
            Explore services <ArrowRight size={18} />
          </Link>
          {page !== "login" && (
            <Link to="/login" className="rounded-xl border border-white/15 px-6 py-3 font-semibold text-white/85 transition hover:bg-white/5">
              Sign in
            </Link>
          )}
        </div>
        <p className="mt-16 text-sm text-slate-500">Plumbing · Electrical · Cleaning · Repairs</p>
      </section>
    </main>
  );
}
