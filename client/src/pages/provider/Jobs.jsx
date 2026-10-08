import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, MapPin, Radio, Star } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import socket from "../../socket/socket.js";
import { useSelector } from "react-redux";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { BookingStatus } from "../customer/MyBookings.jsx";
import LiveShare from "../../components/provider/LiveShare.jsx";

const nextStatus = {
  ACCEPTED: "EN_ROUTE",
  EN_ROUTE: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED"
};
const nextLabel = {
  ACCEPTED: "Start route",
  EN_ROUTE: "Start service",
  IN_PROGRESS: "Mark complete"
};

export default function Jobs() {
  const token = useSelector((state) => state.auth.token);
  const user = useSelector((state) => state.auth.user);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const loadJobs = useCallback(async () => {
    setError("");
    try {
      const { data } = await api.get("/bookings");
      setBookings(data.bookings);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Jobs could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  useEffect(() => {
    if (!token) return undefined;
    if (!socket.connected) socket.connect();
    const onNewJob = (job) => {
      setBookings((current) => current.some((booking) => booking._id === job._id) ? current : [job, ...current]);
      toast("A new nearby job is available.", { icon: "🔔" });
    };
    const onUpdate = (updated) => {
      setBookings((current) => current.map((booking) => booking._id === updated._id ? updated : booking));
    };
    const onConnect = () => loadJobs();
    socket.on("job:new", onNewJob);
    socket.on("booking:status", onUpdate);
    socket.on("connect", onConnect);
    return () => {
      socket.off("job:new", onNewJob);
      socket.off("booking:status", onUpdate);
      socket.off("connect", onConnect);
    };
  }, [token, loadJobs]);

  async function respond(booking, action) {
    setBusyId(booking._id);
    try {
      const { data } = await api.put(`/bookings/${booking._id}/accept`, { action });
      setBookings((current) => current.map((item) => item._id === booking._id ? data.booking : item));
      toast.success(action === "accept" ? "Job accepted." : "Job declined.");
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Unable to respond to this job.");
      if (requestError.response?.status === 409) await loadJobs();
    } finally {
      setBusyId(null);
    }
  }

  async function updateStatus(booking, status) {
    setBusyId(booking._id);
    try {
      const { data } = await api.put(`/bookings/${booking._id}/status`, { status });
      setBookings((current) => current.map((item) => item._id === booking._id ? data.booking : item));
      toast.success(`Job updated: ${status.replaceAll("_", " ").toLowerCase()}.`);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Job status could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-bold tracking-[0.26em] text-accent">PROVIDER WORKSPACE</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-3xl font-semibold">Jobs & requests</h1><p className="mt-2 text-sm text-slate-400">Accept nearby requests and keep customers up to date.</p></div>
          <span className="inline-flex items-center gap-2 text-xs text-slate-500"><Radio size={14} className={socket.connected ? "text-emerald-300" : "text-slate-500"} />{socket.connected ? "Live updates connected" : "Connecting to live updates"}</span>
        </div>
        {loading ? <div className="grid min-h-64 place-items-center"><Spinner label="Loading jobs" /></div> : error ? (
          <div role="alert" className="mt-7 rounded-xl border border-rose-300/20 bg-rose-400/5 p-5 text-sm text-rose-200">{error}</div>
        ) : bookings.length ? (
          <div className="mt-7 grid gap-4">
            {bookings.map((booking) => {
              const assignedToMe = String(booking.provider?._id || booking.provider || "") === String(user?._id || user?.id || "");
              const isOpen = booking.status === "PENDING" && (!booking.provider || assignedToMe);
              const actionStatus = nextStatus[booking.status];
              return (
                <Card key={booking._id} className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><p className="text-xs font-bold tracking-wide text-accent">{isOpen ? "NEW REQUEST" : "YOUR JOB"}</p><h2 className="mt-1 text-lg font-semibold">{booking.service?.title || "Home service"}</h2><p className="mt-1 text-sm text-slate-400">Customer: {booking.customer?.name || "Home Delivery customer"}</p></div>
                    <BookingStatus status={booking.status} />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.07] pt-4 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5"><CalendarClock size={14} className="text-accent" />{new Date(booking.scheduledAt).toLocaleString()}</span>
                    <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-accent" />{booking.address?.city}, {booking.address?.pincode}</span>
                    <span className="inline-flex items-center gap-1.5"><Star size={14} className="text-accent" />₹{Number(booking.priceSnapshot?.total || 0).toLocaleString("en-IN")}</span>
                  </div>
                  {booking.notes && <p className="mt-4 text-sm text-slate-300">Customer notes: {booking.notes}</p>}
                  {assignedToMe && ["EN_ROUTE", "IN_PROGRESS"].includes(booking.status) && (
                    <div className="mt-4">
                      <LiveShare booking={booking} status={booking.status} />
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {isOpen && <><Button variant="ghost" disabled={busyId === booking._id} onClick={() => respond(booking, "reject")}>Decline</Button><Button disabled={busyId === booking._id} onClick={() => respond(booking, "accept")}>Accept job</Button></>}
                    {!isOpen && actionStatus && <Button disabled={busyId === booking._id} onClick={() => updateStatus(booking, actionStatus)}>{nextLabel[booking.status]}</Button>}
                    <Link to={`/bookings/${booking._id}`}><Button variant="secondary">Details <ArrowRight size={15} /></Button></Link>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <h2 className="font-semibold">No jobs to show</h2><p className="mt-2 text-sm text-slate-400">New requests will appear here as they come in.</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
