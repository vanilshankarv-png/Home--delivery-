import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, CalendarDays, Star, Wallet } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import { updateUser } from "../../store/authSlice.js";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import BadgeChip from "../../components/ui/BadgeChip.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

const money = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function ProviderDashboard() {
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const dispatch = useDispatch();
  const [bookings, setBookings] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [availabilityBusy, setAvailabilityBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [bookingResponse, earningsResponse, providerResponse] = await Promise.all([
        api.get("/bookings"),
        api.get("/payouts"),
        api.get(`/providers/${user?._id || user?.id}/badges`)
      ]);
      setBookings(bookingResponse.data.bookings || []);
      setEarnings(earningsResponse.data);
      setProfile(providerResponse.data.provider);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Provider dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [user?._id, user?.id]);

  useEffect(() => { if (token) void load(); }, [load, token]);

  async function toggleAvailability(event) {
    const isAvailable = event.target.checked;
    setAvailabilityBusy(true);
    try {
      const { data } = await api.put("/users/profile", { isAvailable });
      dispatch(updateUser(data.user));
      toast.success(isAvailable ? "You are available for new jobs." : "You are offline for new jobs.");
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Availability could not be updated.");
    } finally {
      setAvailabilityBusy(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-midnight text-white"><Navbar /><div className="grid min-h-[70vh] place-items-center"><Spinner label="Loading provider dashboard" /></div></div>;
  const today = new Date();
  const todaysJobs = bookings.filter((booking) => {
    const scheduled = new Date(booking.scheduledAt);
    return scheduled.toDateString() === today.toDateString() && !["CANCELLED", "REJECTED"].includes(booking.status);
  });
  const activeJobs = bookings.filter((booking) => ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"].includes(booking.status));
  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white"><Navbar /><main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.24em] text-accent">PROVIDER WORKSPACE</p><h1 className="mt-2 text-3xl font-semibold">Welcome, {user?.name?.split(" ")[0] || "professional"}</h1><p className="mt-2 text-sm text-slate-400">Your jobs, earnings, and availability at a glance.</p></div><label className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"><span className={`h-2.5 w-2.5 rounded-full ${user?.isAvailable ? "bg-emerald-300" : "bg-slate-500"}`} /><span>{user?.isAvailable ? "Available" : "Offline"}</span><input type="checkbox" checked={Boolean(user?.isAvailable)} disabled={availabilityBusy} onChange={toggleAvailability} aria-label="Set provider availability" className="h-4 w-4 accent-accent" /></label></div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: "Today's jobs", value: todaysJobs.length, icon: CalendarDays }, { label: "Active jobs", value: activeJobs.length, icon: BriefcaseBusiness }, { label: "Available balance", value: money(earnings?.walletBalance), icon: Wallet }, { label: "Average rating", value: `${Number(profile?.ratingAvg || 0).toFixed(1)} / 5`, icon: Star }].map(({ label, value, icon: Icon }) => <Card key={label} className="p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent"><Icon size={19} /></span><p className="mt-4 text-sm text-slate-400">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></Card>)}
      </section>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Today's schedule</h2><p className="mt-1 text-xs text-slate-500">{today.toLocaleDateString()}</p></div><Link to="/provider/jobs" className="inline-flex items-center gap-1 text-sm text-accent">All jobs <ArrowRight size={14} /></Link></div>{todaysJobs.length ? <div className="mt-4 grid gap-3">{todaysJobs.map((booking) => <Link key={booking._id} to={`/bookings/${booking._id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] p-4 hover:border-accent/30"><div><p className="font-medium">{booking.service?.title || "Home service"}</p><p className="mt-1 text-xs text-slate-500">{new Date(booking.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {booking.address?.city}</p></div><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">{booking.status.replaceAll("_", " ")}</span></Link>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No jobs scheduled for today.</p>}<Link to="/provider/jobs"><Button variant="secondary" className="mt-4 w-full">View job board</Button></Link></Card>
        <Card className="p-5 sm:p-6"><div className="flex items-center gap-2"><BadgeCheck size={18} className="text-accent" /><h2 className="font-semibold">Your professional profile</h2></div><p className="mt-3 text-sm text-slate-400">{profile?.ratingCount || 0} customer reviews · {profile?.jobsDone || 0} completed jobs</p><div className="mt-4 flex flex-wrap gap-2">{(profile?.badges || []).map((badge, index) => <BadgeChip key={`${badge.name}-${index}`} badge={badge} />)}</div><Link to={`/providers/${user?._id || user?.id}`} className="mt-5 inline-flex text-sm text-accent hover:underline">View public profile</Link><div className="mt-6 border-t border-white/10 pt-5"><p className="text-xs uppercase tracking-wider text-slate-500">Payouts</p><p className="mt-2 text-lg font-semibold">{money(earnings?.pendingPayouts)} pending</p><Link to="/provider/earnings"><Button className="mt-3 w-full">Manage earnings</Button></Link></div></Card>
      </div>
    </main><Footer /></div>
  );
}
