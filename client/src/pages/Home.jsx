import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, Clock3, MapPin, RefreshCw, Search as SearchIcon, ShieldCheck, Sparkles, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import api from "../api/axios.js";
import Navbar from "../components/ui/Navbar.jsx";
import Footer from "../components/ui/Footer.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import CategoryIcon from "../components/catalog/CategoryIcon.jsx";
import ServiceCard from "../components/catalog/ServiceCard.jsx";
import ServiceSkeleton from "../components/catalog/ServiceSkeleton.jsx";
import { getCurrentLocation } from "../utils/location.js";

const highlights = [
  { icon: ShieldCheck, title: "Verified professionals", copy: "The right skills and a little extra peace of mind, every time." },
  { icon: Clock3, title: "On your schedule", copy: "Find a time that works for your home and your day." },
  { icon: MapPin, title: "Know who's on the way", copy: "Stay in the loop from booking to doorstep." }
];

export default function Home() {
  const navigate = useNavigate();
  const suggestionRef = useRef(null);
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [popular, setPopular] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [error, setError] = useState("");

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [categoryResponse, popularResponse] = await Promise.all([
        api.get("/categories"),
        api.get("/services/popular")
      ]);
      setCategories(categoryResponse.data.categories);
      setPopular(popularResponse.data.services);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "We couldn't connect to the services server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setSuggestions([]);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      api.get("/services/search", { params: { q: normalized, ...location } })
        .then(({ data }) => {
          if (active) setSuggestions(data.services.slice(0, 5));
        })
        .catch((requestError) => {
          if (active) toast.error(requestError.response?.data?.message || "Search suggestions could not be loaded.");
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, location]);

  useEffect(() => {
    function closeSuggestions(event) {
      if (!suggestionRef.current?.contains(event.target)) setSuggestionsOpen(false);
    }
    document.addEventListener("pointerdown", closeSuggestions);
    return () => document.removeEventListener("pointerdown", closeSuggestions);
  }, []);

  function submitSearch(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (location) {
      params.set("lat", location.lat);
      params.set("lng", location.lng);
    }
    setSuggestionsOpen(false);
    navigate(`/search?${params.toString()}`);
  }

  async function useLocation() {
    setLocating(true);
    try {
      setLocation(await getCurrentLocation());
      toast.success("Using your current location.");
    } catch (locationError) {
      toast.error(locationError.message);
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="min-h-screen bg-midnight text-white">
      <Navbar />
      <main className="relative isolate overflow-hidden bg-hero-glow">
        <div className="pointer-events-none absolute -right-40 top-0 -z-10 h-[32rem] w-[32rem] rounded-full bg-primary/15 blur-[100px]" />
        <section className="mx-auto grid min-h-[590px] max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Badge level="verified">Trusted home services</Badge>
            <h1 className="mt-7 max-w-2xl text-5xl font-semibold leading-[1.08] tracking-tight sm:text-7xl">
              More time for <span className="bg-gradient-to-r from-primary-light to-accent bg-clip-text text-transparent">feeling at home.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              From the quick fix to the weekend reset, book trusted local pros who make home feel easy.
            </p>
            <div ref={suggestionRef} className="relative mt-9 max-w-2xl">
              <form onSubmit={submitSearch} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-panel/80 p-2 shadow-2xl shadow-black/20 backdrop-blur-xl sm:flex-row">
                <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
                  <SearchIcon size={20} className="shrink-0 text-accent" />
                  <input
                    value={query}
                    onFocus={() => setSuggestionsOpen(true)}
                    onChange={(event) => { setQuery(event.target.value); setSuggestionsOpen(true); }}
                    aria-label="Search home services"
                    aria-autocomplete="list"
                    placeholder="What do you need help with?"
                    className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => { setQuery(""); setSuggestions([]); setSuggestionsOpen(false); }}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  )}
                </label>
                <Button type="submit" className="shrink-0"><span className="sm:hidden">Search services</span><span className="hidden sm:inline">Search</span><ArrowRight size={17} /></Button>
              </form>
              {suggestionsOpen && suggestions.length > 0 && (
                <div role="listbox" className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-white/10 bg-panel shadow-2xl">
                  {suggestions.map((service) => (
                    <button
                      key={service._id}
                      type="button"
                      role="option"
                      aria-selected="false"
                      onClick={() => { setSuggestionsOpen(false); navigate(`/services/${service._id}`); }}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-white/[0.06]"
                    >
                      <span><span className="block text-sm font-medium text-white">{service.title}</span><span className="mt-1 block text-xs text-slate-400">{service.category?.name}</span></span>
                      <span className="shrink-0 text-sm text-slate-300">₹{Number(service.basePrice).toLocaleString("en-IN")}</span>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={useLocation} disabled={locating} className="mt-3 inline-flex items-center gap-2 px-1 text-xs font-medium text-slate-400 transition hover:text-accent disabled:opacity-60">
                <MapPin size={14} /> {locating ? "Finding you…" : location ? "Using your location" : "Use my location"}
              </button>
            </div>
            <div className="mt-5 flex items-center gap-2 text-sm text-slate-400">
              <BadgeCheck size={17} className="text-accent" /> Quality pros, clear pricing, no guesswork
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.15 }} className="relative mx-auto w-full max-w-lg">
            <div className="absolute inset-8 rounded-full bg-primary/20 blur-3xl" />
            <Card className="relative overflow-hidden p-6 sm:p-8">
              <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-accent/10 blur-2xl" />
              <div className="relative flex items-center justify-between">
                <div><p className="text-sm text-slate-400">Your home, taken care of</p><h2 className="mt-1 text-xl font-semibold">Explore by category</h2></div>
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary-light"><Sparkles size={21} /></span>
              </div>
              {loading ? (
                <div className="relative mt-7 grid grid-cols-2 gap-3">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-white/[0.05]" />)}</div>
              ) : (
                <div className="relative mt-7 grid grid-cols-2 gap-3">
                  {categories.map((category, index) => (
                    <Link key={category._id} to={`/search?category=${encodeURIComponent(category.slug)}`} className="rounded-xl border border-white/10 bg-midnight/60 p-4 transition hover:border-accent/30 hover:bg-white/5">
                      <span className={`mb-4 grid h-10 w-10 place-items-center rounded-xl ${index % 2 ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary-light"}`}><CategoryIcon slug={category.slug} size={19} /></span>
                      <span className="block text-sm font-medium text-slate-100">{category.name}</span>
                    </Link>
                  ))}
                </div>
              )}
              <Link to="/search" className="relative mt-5 flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5">
                Browse all services <ArrowRight size={16} className="text-accent" />
              </Link>
            </Card>
          </motion.div>
        </section>
        {error && (
          <section role="alert" className="mx-auto max-w-7xl px-5 pb-8 sm:px-8">
            <div className="flex flex-col gap-4 rounded-2xl border border-rose-300/20 bg-panel/80 p-5 shadow-lg shadow-black/10 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <h2 className="font-semibold text-white">Unable to load services</h2>
                <p className="mt-1 text-sm text-slate-400">{error}</p>
              </div>
              <Button type="button" variant="secondary" onClick={() => void loadCatalog()} disabled={loading} className="shrink-0">
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                {loading ? "Trying again…" : "Try again"}
              </Button>
            </div>
          </section>
        )}
        <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div><p className="text-xs font-bold tracking-[0.25em] text-accent">LOVED BY YOUR NEIGHBORS</p><h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Popular services</h2></div>
            <Link to="/search?sort=popular" className="inline-flex items-center gap-1 text-sm font-medium text-slate-300 hover:text-accent">View all <ArrowRight size={15} /></Link>
          </div>
          {loading ? <ServiceSkeleton count={3} /> : popular.length ? (
            <div className="-mx-1 flex snap-x gap-5 overflow-x-auto px-1 pb-4">
              {popular.map((service, index) => <div key={service._id} className="w-[min(84vw,330px)] shrink-0 snap-start"><ServiceCard service={service} index={index} /></div>)}
            </div>
          ) : !error ? <p className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">No popular services are available yet.</p> : null}
        </section>
        <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-20 sm:grid-cols-3 sm:px-8">
          {highlights.map(({ icon: Icon, title, copy }, index) => (
            <Card key={title} className="p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-accent/15 bg-accent/10 text-accent"><Icon size={20} /></span>
              <h2 className="mt-5 font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
            </Card>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
