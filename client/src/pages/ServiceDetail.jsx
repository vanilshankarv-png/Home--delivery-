import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Clock3, MapPin, Star } from "lucide-react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import api from "../api/axios.js";
import Navbar from "../components/ui/Navbar.jsx";
import Footer from "../components/ui/Footer.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import BadgeChip from "../components/ui/BadgeChip.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import CategoryIcon from "../components/catalog/CategoryIcon.jsx";
import { demoLocation, getCurrentLocation } from "../utils/location.js";

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const [service, setService] = useState(null);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [error, setError] = useState("");
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const [location, setLocation] = useState(demoLocation);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/services/${id}`)
      .then(({ data }) => { if (active) setService(data.service); })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "This service could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    setProvidersLoading(true);
    api.get(`/services/${id}/providers`, { params: location })
      .then(({ data }) => { if (active) setProviders(data.providers); })
      .catch((requestError) => {
        if (active) toast.error(requestError.response?.data?.message || "Nearby providers could not be loaded.");
      })
      .finally(() => { if (active) setProvidersLoading(false); });
    return () => { active = false; };
  }, [id, location]);

  async function useLocation() {
    setLocating(true);
    try {
      setLocation(await getCurrentLocation());
      setUsingCurrentLocation(true);
      toast.success("Showing providers near you.");
    } catch (locationError) {
      toast.error(locationError.message);
    } finally {
      setLocating(false);
    }
  }

  function bookNow() {
    if (!user) {
      navigate("/login");
      return;
    }
    navigate(`/services/${id}/book`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <Link to="/search" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-accent"><ArrowLeft size={16} /> Back to services</Link>
        {loading ? (
          <div className="grid min-h-[55vh] place-items-center"><Spinner label="Loading service" /></div>
        ) : error || !service ? (
          <div role="alert" className="mt-8 rounded-2xl border border-rose-300/20 bg-rose-400/5 p-6 text-rose-200">{error || "Service not found."}</div>
        ) : (
          <>
            <section className="mt-7 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="relative min-h-64 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/30 via-panel to-accent/10 sm:min-h-96">
                {service.images?.length ? (
                  <img src={service.images[0]} alt={service.title} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="absolute h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
                    <CategoryIcon slug={service.category?.slug} size={92} className="relative text-accent/80" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-midnight/90 to-transparent p-6">
                  <Badge level="verified">{service.category?.name || "Home service"}</Badge>
                </div>
              </div>
              <Card className="flex flex-col justify-center p-6 sm:p-8">
                <Badge level="verified">{service.category?.name || "Home service"}</Badge>
                <h1 className="mt-5 text-3xl font-semibold leading-tight sm:text-4xl">{service.title}</h1>
                <p className="mt-4 leading-7 text-slate-300">{service.description}</p>
                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-y border-white/10 py-5">
                  <span className="text-2xl font-semibold">₹{Number(service.basePrice).toLocaleString("en-IN")} <span className="text-sm font-normal text-slate-400">/ {service.unit}</span></span>
                  <span className="inline-flex items-center gap-1 text-sm text-slate-300"><Star size={15} className="fill-amber-300 text-amber-300" /> {Number(service.rating || 0).toFixed(1)}</span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-400"><Clock3 size={15} /> About {service.durationMins} min</span>
                </div>
                {service.tags?.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{service.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">{tag}</span>)}</div>}
                <Button className="mt-7 w-full sm:w-fit" onClick={bookNow}>Book Now</Button>
              </Card>
            </section>
            <section className="mt-14">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div><p className="text-xs font-bold tracking-[0.25em] text-accent">READY WHEN YOU ARE</p><h2 className="mt-2 text-2xl font-semibold">Nearby professionals</h2></div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={13} />{usingCurrentLocation ? "Your current location" : "Near Visakhapatnam"}</span>
                  <Button variant="secondary" disabled={locating} onClick={useLocation}><MapPin size={15} />{locating ? "Locating…" : "Use my location"}</Button>
                </div>
              </div>
              {providersLoading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />)}</div>
              ) : providers.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {providers.map((provider) => (
                    <Card key={provider._id} className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {provider.user?.avatar ? <img src={provider.user.avatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-lg font-semibold text-primary-light">{provider.user?.name?.slice(0, 1) || "P"}</span>}
                          <div><Link to={`/providers/${provider.user?._id || provider._id}`} className="font-semibold hover:text-accent">{provider.user?.name || "Verified professional"}</Link><p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400"><Star size={12} className="fill-amber-300 text-amber-300" />{Number(provider.ratingAvg || 0).toFixed(1)} · {provider.ratingCount || 0} reviews</p></div>
                        </div>
                        <BadgeCheck size={18} className="shrink-0 text-accent" />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(provider.badges || []).slice(0, 3).map((badge, index) => <BadgeChip key={`${badge.name}-${index}`} badge={badge} />)}
                      </div>
                      <p className="mt-4 text-xs text-slate-400">{Number(provider.distanceKm).toFixed(1)} km away · Available now</p>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                  <p className="font-medium">No verified pros nearby just yet</p>
                  <p className="mt-2 text-sm text-slate-400">Try another service or check again from a different location.</p>
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
