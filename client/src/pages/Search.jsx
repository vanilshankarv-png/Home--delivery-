import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MapPin, Search as SearchIcon, SlidersHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/axios.js";
import Navbar from "../components/ui/Navbar.jsx";
import Footer from "../components/ui/Footer.jsx";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import ServiceCard from "../components/catalog/ServiceCard.jsx";
import ServiceSkeleton from "../components/catalog/ServiceSkeleton.jsx";
import { getCurrentLocation } from "../utils/location.js";

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramsKey = searchParams.toString();
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "popular");
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    api.get("/categories")
      .then(({ data }) => setCategories(data.categories))
      .catch((requestError) => toast.error(requestError.response?.data?.message || "Categories could not be loaded."));
  }, []);

  useEffect(() => {
    const current = new URLSearchParams(paramsKey);
    setQuery(current.get("q") || "");
    setCategory(current.get("category") || "");
    setMinPrice(current.get("minPrice") || "");
    setMaxPrice(current.get("maxPrice") || "");
    setSort(current.get("sort") || "popular");
    setLoading(true);
    setError("");
    api.get("/services/search", { params: Object.fromEntries(current.entries()) })
      .then(({ data }) => {
        setServices(data.services);
        setPagination(data.pagination || { page: 1, pages: 1, total: data.services.length });
      })
      .catch((requestError) => {
        setServices([]);
        setError(requestError.response?.data?.message || "Services could not be loaded. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [paramsKey]);

  function submitFilters(event) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (query.trim()) next.set("q", query.trim());
    if (category) next.set("category", category);
    if (minPrice) next.set("minPrice", minPrice);
    if (maxPrice) next.set("maxPrice", maxPrice);
    if (sort) next.set("sort", sort);
    if (searchParams.has("lat") && searchParams.has("lng")) {
      next.set("lat", searchParams.get("lat"));
      next.set("lng", searchParams.get("lng"));
    }
    setSearchParams(next);
  }

  async function useLocation() {
    setLocating(true);
    try {
      const position = await getCurrentLocation();
      const next = new URLSearchParams(searchParams);
      next.set("lat", position.lat);
      next.set("lng", position.lng);
      setSearchParams(next);
      toast.success("Using your current location.");
    } catch (locationError) {
      toast.error(locationError.message);
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8">
          <p className="text-xs font-bold tracking-[0.26em] text-accent">FIND YOUR HOME PRO</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{query ? `Results for “${query}”` : "Explore home services"}</h1>
          <p className="mt-2 text-sm text-slate-400">{pagination.total} service{pagination.total === 1 ? "" : "s"} to make home feel easier.</p>
        </div>
        <div className="grid items-start gap-8 lg:grid-cols-[260px_1fr]">
          <aside>
            <form onSubmit={submitFilters} className="grid gap-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur">
              <div className="flex items-center gap-2 font-semibold"><SlidersHorizontal size={17} className="text-accent" /> Filters</div>
              <label className="grid gap-2 text-sm font-medium text-slate-200">
                Search
                <span className="relative">
                  <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Service or keyword" className="w-full rounded-xl border border-white/10 bg-midnight/70 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-accent/60" />
                </span>
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-200">
                Category
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-xl border border-white/10 bg-midnight px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-accent/60">
                  <option value="">All categories</option>
                  {categories.map((item) => <option key={item._id} value={item.slug}>{item.name}</option>)}
                </select>
              </label>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium text-slate-200">Price range (₹)</legend>
                <div className="grid grid-cols-2 gap-2">
                  <Input aria-label="Minimum price" type="number" min="0" placeholder="Min" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
                  <Input aria-label="Maximum price" type="number" min="0" placeholder="Max" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
                </div>
              </fieldset>
              <label className="grid gap-2 text-sm font-medium text-slate-200">
                Sort by
                <select value={sort} onChange={(event) => setSort(event.target.value)} className="w-full rounded-xl border border-white/10 bg-midnight px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-accent/60">
                  <option value="popular">Most popular</option>
                  <option value="rating">Top rated</option>
                  <option value="price">Price: low to high</option>
                </select>
              </label>
              <Button type="submit" className="w-full">Apply filters</Button>
              <button type="button" onClick={useLocation} disabled={locating} className="inline-flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-accent disabled:opacity-50">
                <MapPin size={14} /> {locating ? "Finding you…" : "Use my location"}
              </button>
            </form>
          </aside>
          <section aria-live="polite">
            {loading ? <ServiceSkeleton count={6} /> : error ? (
              <div role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-400/5 p-6 text-sm text-rose-200">{error}</div>
            ) : services.length ? (
              <>
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {services.map((service, index) => <ServiceCard key={service._id} service={service} index={index} />)}
                </div>
                {pagination.pages > 1 && (
                  <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5 text-sm text-slate-400">
                    <span>Page {pagination.page} of {pagination.pages}</span>
                    <div className="flex gap-2">
                      <Button variant="secondary" disabled={pagination.page <= 1} onClick={() => { const next = new URLSearchParams(searchParams); next.set("page", pagination.page - 1); setSearchParams(next); }}>Previous</Button>
                      <Button variant="secondary" disabled={pagination.page >= pagination.pages} onClick={() => { const next = new URLSearchParams(searchParams); next.set("page", pagination.page + 1); setSearchParams(next); }}>Next</Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
                <h2 className="text-lg font-semibold">No services found</h2>
                <p className="mt-2 text-sm text-slate-400">Try a different search or loosen your filters.</p>
                <Link to="/search" className="mt-5 inline-block text-sm font-semibold text-accent hover:text-white">Clear filters</Link>
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
