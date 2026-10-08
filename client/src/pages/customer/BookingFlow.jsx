import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, Flame, MapPin, ShieldCheck, Star } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import { useSelector } from "react-redux";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import BadgeChip from "../../components/ui/BadgeChip.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { getCurrentLocation } from "../../utils/location.js";

function localDateTime(date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function addressWithLocation(address, location) {
  return {
    label: address.label || "",
    line1: address.line1,
    city: address.city,
    pincode: address.pincode,
    location: {
      type: "Point",
      coordinates: [location.lng, location.lat]
    }
  };
}

export default function BookingFlow() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const initialLocation = user?.address?.[0]?.location?.coordinates?.length === 2
    ? { lng: user.address[0].location.coordinates[0], lat: user.address[0].location.coordinates[1] }
    : null;
  const [service, setService] = useState(null);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [addressIndex, setAddressIndex] = useState(user?.address?.length ? "0" : "new");
  const [address, setAddress] = useState({ label: "Home", line1: "", city: "", pincode: "" });
  const [location, setLocation] = useState(initialLocation);
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [priceQuote, setPriceQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quoteClock, setQuoteClock] = useState(Date.now());
  const [quoteRefreshToken, setQuoteRefreshToken] = useState(0);

  useEffect(() => {
    let active = true;
    api.get(`/services/${id}`)
      .then(({ data }) => { if (active) setService(data.service); })
      .catch((error) => toast.error(error.response?.data?.message || "Service details could not be loaded."))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!location) return undefined;
    let active = true;
    setProvidersLoading(true);
    api.get(`/services/${id}/providers`, { params: location })
      .then(({ data }) => { if (active) setProviders(data.providers); })
      .catch((error) => { if (active) toast.error(error.response?.data?.message || "Providers could not be loaded."); })
      .finally(() => { if (active) setProvidersLoading(false); });
    return () => { active = false; };
  }, [id, location]);

  const selectedAddress = useMemo(() => {
    if (addressIndex !== "new" && user?.address?.[Number(addressIndex)]) {
      return user.address[Number(addressIndex)];
    }
    return address;
  }, [addressIndex, user?.address, address]);

  const quoteRequestKey = service && location && scheduledAt && new Date(scheduledAt) > new Date()
    ? `${id}:${location.lat}:${location.lng}:${new Date(scheduledAt).toISOString()}:${JSON.stringify(selectedAddress)}`
    : "";

  useEffect(() => {
    if (!quoteRequestKey || !location) {
      setPriceQuote(null);
      setQuoteLoading(false);
      setQuoteError("");
      return undefined;
    }
    let active = true;
    setPriceQuote(null);
    setQuoteError("");
    setQuoteLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const { data } = await api.post("/pricing/quote", {
          serviceId: id,
          lat: location.lat,
          lng: location.lng,
          scheduledAt: new Date(scheduledAt).toISOString()
        });
        if (active) setPriceQuote({ ...data, requestKey: quoteRequestKey });
      } catch (error) {
        if (active) setQuoteError(error.response?.data?.message || "A live price quote could not be loaded.");
      } finally {
        if (active) setQuoteLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [id, location, scheduledAt, quoteRequestKey, quoteRefreshToken]);

  useEffect(() => {
    if (!priceQuote) return undefined;
    const timer = setInterval(() => setQuoteClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [priceQuote]);

  function chooseAddress(value) {
    setAddressIndex(value);
    const savedLocation = value === "new"
      ? null
      : user?.address?.[Number(value)]?.location?.coordinates;
    setLocation(savedLocation?.length === 2
      ? { lng: savedLocation[0], lat: savedLocation[1] }
      : null);
  }

  async function useLocation() {
    setLocating(true);
    try {
      setLocation(await getCurrentLocation());
      toast.success("Using your current location to find nearby providers.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLocating(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!selectedAddress.line1?.trim() || !selectedAddress.city?.trim() || !selectedAddress.pincode?.trim()) {
      toast.error("Complete the service address before booking.");
      return;
    }
    if (!scheduledAt || new Date(scheduledAt) <= new Date()) {
      toast.error("Choose a future date and time.");
      return;
    }
    if (!location) {
      toast.error("Set the service location with “Use my location” before booking.");
      return;
    }
    if (!priceQuote || priceQuote.requestKey !== quoteRequestKey
      || new Date(priceQuote.expiresAt).getTime() <= Date.now()) {
      toast.error("Refresh the price quote before booking.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("/bookings", {
        service: id,
        ...(selectedProvider ? { provider: selectedProvider } : {}),
        address: addressWithLocation(selectedAddress, location),
        scheduledAt: new Date(scheduledAt).toISOString(),
        quoteId: priceQuote.quoteId,
        notes
      });
      toast.success("Your booking request is on its way.");
      navigate(`/bookings/${data.booking._id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Booking could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  const quoteSecondsLeft = priceQuote
    ? Math.max(0, Math.ceil((new Date(priceQuote.expiresAt).getTime() - quoteClock) / 1000))
    : 0;
  const quoteIsCurrent = Boolean(priceQuote && priceQuote.requestKey === quoteRequestKey && quoteSecondsLeft > 0);

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <Link to={`/services/${id}`} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-accent"><ArrowLeft size={16} /> Back to service</Link>
        {loading ? <div className="grid min-h-64 place-items-center"><Spinner label="Loading booking details" /></div> : !service ? (
          <div role="alert" className="mt-6 rounded-xl border border-rose-300/20 bg-rose-400/5 p-5 text-sm text-rose-200">Service unavailable.</div>
        ) : (
          <form onSubmit={submit} className="mt-7 grid items-start gap-7 lg:grid-cols-[1fr_360px]">
            <div className="grid gap-6">
              <Card className="grid gap-5 p-6 sm:p-8">
                <div><p className="text-xs font-bold tracking-[0.24em] text-accent">STEP 1 · WHEN</p><h1 className="mt-2 text-2xl font-semibold">Choose a time</h1></div>
                <div className="max-w-sm">
                  <Input label="Date and time" type="datetime-local" min={localDateTime(new Date(Date.now() + 60 * 60 * 1000))} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required />
                </div>
              </Card>
              <Card className="grid gap-5 p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-xs font-bold tracking-[0.24em] text-accent">STEP 2 · WHERE</p><h2 className="mt-2 text-xl font-semibold">Service address</h2></div>
                  <Button type="button" variant="secondary" onClick={useLocation} disabled={locating}><MapPin size={15} />{locating ? "Locating…" : "Use my location"}</Button>
                </div>
                <p className="text-xs text-slate-400">The service pin is required to find nearby professionals. Use this while at the service location, or choose a saved address that already has a location.</p>
                {location && <p className="text-xs text-accent">Service pin set: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p>}
                {user?.address?.length > 0 && (
                  <label className="grid max-w-md gap-2 text-sm font-medium text-slate-200">Saved address
                    <select value={addressIndex} onChange={(event) => chooseAddress(event.target.value)} className="w-full rounded-xl border border-white/10 bg-midnight px-3 py-3 text-sm text-white outline-none focus:border-accent/60">
                      {user.address.map((saved, index) => <option key={`${saved.label}-${index}`} value={String(index)}>{saved.label || `Address ${index + 1}`} — {saved.line1}, {saved.city}</option>)}
                      <option value="new">Enter a new address</option>
                    </select>
                  </label>
                )}
                {addressIndex === "new" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Address label" placeholder="Home, work…" value={address.label} onChange={(event) => setAddress({ ...address, label: event.target.value })} />
                    <Input label="Street address" placeholder="Street and house number" value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} required />
                    <Input label="City" value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} required />
                    <Input label="Postal / ZIP code" value={address.pincode} onChange={(event) => setAddress({ ...address, pincode: event.target.value })} required />
                  </div>
                )}
                {location && <p className="text-xs text-slate-500">Provider search area: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}. Change it with “Use my location”.</p>}
              </Card>
              <Card className="grid gap-5 p-6 sm:p-8">
                <div><p className="text-xs font-bold tracking-[0.24em] text-accent">STEP 3 · WHO</p><h2 className="mt-2 text-xl font-semibold">Choose a professional <span className="text-sm font-normal text-slate-500">(optional)</span></h2></div>
                {providersLoading ? <Spinner label="Finding available professionals" /> : providers.length ? (
                  <div className="grid gap-3">
                    <label className={`cursor-pointer rounded-xl border p-4 transition ${selectedProvider === "" ? "border-accent/50 bg-accent/[0.06]" : "border-white/10 bg-midnight/40"}`}>
                      <input type="radio" name="provider" value="" checked={selectedProvider === ""} onChange={() => setSelectedProvider("")} className="sr-only" />
                      <span className="font-medium">First available professional</span><span className="mt-1 block text-xs text-slate-400">Send your request to qualified nearby professionals.</span>
                    </label>
                    {providers.map((provider) => (
                      <label key={provider._id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 transition ${selectedProvider === provider.user?._id ? "border-accent/50 bg-accent/[0.06]" : "border-white/10 bg-midnight/40"}`}>
                        <input type="radio" name="provider" value={provider.user?._id} checked={selectedProvider === provider.user?._id} onChange={() => setSelectedProvider(provider.user?._id || "")} className="sr-only" />
                        <span><span className="block font-medium">{provider.user?.name || "Verified professional"}</span><span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400"><Star size={12} className="fill-amber-300 text-amber-300" />{Number(provider.ratingAvg || 0).toFixed(1)} · {Number(provider.distanceKm).toFixed(1)} km away</span></span>
                        <span className="flex flex-wrap justify-end gap-1">{provider.badges?.slice(0, 2).map((badge, index) => <BadgeChip key={`${badge.name}-${index}`} badge={badge} />)}</span>
                      </label>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-400">No nearby providers right now. You can still send an open request.</p>}
              </Card>
              <Card className="grid gap-4 p-6 sm:p-8">
                <h2 className="text-lg font-semibold">Anything else the pro should know?</h2>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={4} placeholder="Add details about the work, access instructions, or anything helpful…" className="w-full resize-y rounded-xl border border-white/10 bg-midnight/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent/60" />
              </Card>
            </div>
            <Card className="sticky top-5 p-6">
              <p className="text-xs font-bold tracking-[0.23em] text-accent">BOOKING SUMMARY</p>
              <h2 className="mt-3 text-lg font-semibold">{service.title}</h2>
              <p className="mt-1 text-sm text-slate-400">{service.durationMins} minutes · {service.unit}</p>
              <div aria-live="polite" className="my-5 min-h-36 space-y-3 border-y border-white/10 py-5 text-sm">
                {quoteLoading ? <p className="animate-pulse text-sm text-slate-400">Refreshing your live price…</p> : quoteIsCurrent ? (
                  <motion.div key={priceQuote.quoteId} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <PriceLine label="Service base" value={`₹${Number(priceQuote.breakdown.base).toLocaleString("en-IN")}`} />
                    <PriceLine
                      label={<span className="inline-flex items-center gap-1.5">{Number(priceQuote.breakdown.demandMultiplier) > 1.2 && <Flame size={14} className="text-orange-400" />}Demand surge · {Number(priceQuote.breakdown.demandMultiplier).toFixed(2)}×</span>}
                      value={Number(priceQuote.breakdown.demandMultiplier).toFixed(2) + "×"}
                    />
                    <PriceLine label={`Distance · ${priceQuote.breakdown.distanceKm == null ? "not available" : `${Number(priceQuote.breakdown.distanceKm).toFixed(1)} km`}`} value={`${Number(priceQuote.breakdown.distanceFactor).toFixed(2)}×`} />
                    <PriceLine label="Time of day" value={`${Number(priceQuote.breakdown.timeFactor).toFixed(2)}×`} />
                    <PriceLine label="Platform fee" value={`₹${Number(priceQuote.breakdown.platformFee).toLocaleString("en-IN")}`} />
                    <div className="flex justify-between border-t border-white/10 pt-3 text-base font-semibold text-white"><span>Live total</span><span>₹{Number(priceQuote.breakdown.total).toLocaleString("en-IN")}</span></div>
                  </motion.div>
                ) : quoteError ? (
                  <p role="alert" className="text-sm text-rose-200">{quoteError}</p>
                ) : (
                  <p className="text-sm text-slate-400">Choose a future time and set a service location to see your live price.</p>
                )}
              </div>
              <div className="mb-5 flex items-start gap-2 text-xs leading-5 text-slate-400"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-accent" />Your quoted price is held for 10 minutes. Payment is not collected in this phase.</div>
              {priceQuote && <p className={`mb-3 text-center text-xs ${quoteSecondsLeft ? "text-slate-400" : "text-rose-200"}`}>{quoteSecondsLeft ? `Quote valid for ${Math.floor(quoteSecondsLeft / 60)}:${String(quoteSecondsLeft % 60).padStart(2, "0")}` : "Quote expired — change the slot or refresh the page."}</p>}
              {(quoteError || (priceQuote && quoteSecondsLeft === 0)) && location && scheduledAt && (
                <button type="button" onClick={() => setQuoteRefreshToken((current) => current + 1)} disabled={quoteLoading} className="mb-3 w-full text-center text-xs font-semibold text-accent hover:text-white disabled:opacity-50">
                  {quoteLoading ? "Refreshing price…" : "Refresh price quote"}
                </button>
              )}
              <Button type="submit" disabled={submitting || !quoteIsCurrent} className="w-full">{submitting ? "Requesting…" : "Request booking"}</Button>
              <div className="mt-3 flex items-center justify-center gap-1 text-[11px] text-slate-500"><CalendarClock size={13} />{scheduledAt ? new Date(scheduledAt).toLocaleString() : "Choose a date and time"}</div>
            </Card>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}

function PriceLine({ label, value }) {
  return <div className="flex justify-between gap-3 text-slate-400"><span>{label}</span><span className="shrink-0 text-slate-200">{value}</span></div>;
}
