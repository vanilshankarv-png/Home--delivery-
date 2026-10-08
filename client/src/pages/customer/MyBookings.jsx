import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, ClipboardList, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import { useSelector } from "react-redux";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

const tabs = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Upcoming", value: "ACCEPTED,EN_ROUTE,IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED,PAID" },
  { label: "Cancelled", value: "CANCELLED,REJECTED" }
];

const statusStyles = {
  ACCEPTED: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
  CANCELLED: "border-rose-300/20 bg-rose-300/10 text-rose-200",
  COMPLETED: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  EN_ROUTE: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
  IN_PROGRESS: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  PAID: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  PENDING: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  REJECTED: "border-rose-300/20 bg-rose-300/10 text-rose-200"
};

export function BookingStatus({ status }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status] || "border-white/10 bg-white/5 text-slate-300"}`}>
      {String(status || "").replaceAll("_", " ")}
    </span>
  );
}

export default function MyBookings() {
  const user = useSelector((state) => state.auth.user);
  const [activeTab, setActiveTab] = useState("");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/bookings", { params: activeTab ? { status: activeTab } : {} });
      setBookings(data.bookings);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Bookings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  async function cancelBooking(booking) {
    try {
      await api.put(`/bookings/${booking._id}/cancel`, { reason: "Cancelled by customer." });
      toast.success("Booking cancelled.");
      await loadBookings();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Booking could not be cancelled.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-bold tracking-[0.26em] text-accent">{user?.role === "provider" ? "YOUR WORK" : "YOUR HOME SERVICES"}</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-3xl font-semibold">My bookings</h1><p className="mt-2 text-sm text-slate-400">Stay up to date on service requests and appointments.</p></div>
          <Link to={user?.role === "provider" ? "/provider/jobs" : "/search"}><Button>{user?.role === "provider" ? "Browse open jobs" : "Book a service"} <ArrowRight size={16} /></Button></Link>
        </div>
        <div role="tablist" aria-label="Filter bookings" className="mt-8 flex gap-2 overflow-x-auto border-b border-white/10 pb-3">
          {tabs.map((tab) => (
            <button key={tab.label} type="button" role="tab" aria-selected={activeTab === tab.value} onClick={() => setActiveTab(tab.value)} className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${activeTab === tab.value ? "bg-primary text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <section aria-live="polite" className="mt-6">
          {loading ? <div className="grid min-h-64 place-items-center"><Spinner label="Loading bookings" /></div> : error ? (
            <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-400/5 p-5 text-sm text-rose-200">{error}</div>
          ) : bookings.length ? (
            <div className="grid gap-4">
              {bookings.map((booking) => (
                <Card key={booking._id} className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><p className="text-xs text-slate-500">{booking.service?.category?.name || "HOME SERVICE"}</p><h2 className="mt-1 text-lg font-semibold">{booking.service?.title || "Home service"}</h2><p className="mt-1 text-sm text-slate-400">{user?.role === "provider" ? `Customer: ${booking.customer?.name || "Customer"}` : `Professional: ${booking.provider?.name || "Finding a professional"}`}</p></div>
                    <BookingStatus status={booking.status} />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.07] pt-4 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5"><CalendarClock size={14} className="text-accent" />{new Date(booking.scheduledAt).toLocaleString()}</span>
                    <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-accent" />{booking.address?.city}, {booking.address?.pincode}</span>
                    <span className="inline-flex items-center gap-1.5"><ClipboardList size={14} className="text-accent" />₹{Number(booking.priceSnapshot?.total || 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {user?.role === "customer" && ["PENDING", "ACCEPTED"].includes(booking.status) && <Button variant="ghost" onClick={() => cancelBooking(booking)}>Cancel booking</Button>}
                    <Link to={`/bookings/${booking._id}`}><Button variant="secondary">View details <ArrowRight size={15} /></Button></Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
              <ClipboardList size={28} className="mx-auto text-accent" /><h2 className="mt-4 font-semibold">Nothing here yet</h2><p className="mt-2 text-sm text-slate-400">Your bookings will appear here.</p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
