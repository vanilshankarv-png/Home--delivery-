import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, Check, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import socket from "../../socket/socket.js";
import { useSelector } from "react-redux";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { BookingStatus } from "./MyBookings.jsx";
import ChatBox from "../../components/chat/ChatBox.jsx";
import ReviewModal from "../../components/reviews/ReviewModal.jsx";

export default function BookingDetail() {
  const { id } = useParams();
  const token = useSelector((state) => state.auth.token);
  const user = useSelector((state) => state.auth.user);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);

  const loadBooking = useCallback(async () => {
    try {
      const { data } = await api.get(`/bookings/${id}`);
      setBooking(data.booking);
      setScheduledAt(data.booking.scheduledAt ? new Date(new Date(data.booking.scheduledAt).getTime() - new Date(data.booking.scheduledAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Booking details could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadBooking(); }, [loadBooking]);

  useEffect(() => {
    if (!token) return undefined;
    if (!socket.connected) socket.connect();
    const joinRoom = () => socket.emit("booking:join", id, (result) => {
      if (!result?.success) toast.error(result?.message || "Live booking updates are unavailable.");
    });
    const receiveUpdate = (updated) => {
      if (String(updated._id) === id) setBooking(updated);
    };
    socket.on("connect", joinRoom);
    socket.on("booking:status", receiveUpdate);
    if (socket.connected) joinRoom();
    return () => {
      socket.emit("booking:leave", id);
      socket.off("connect", joinRoom);
      socket.off("booking:status", receiveUpdate);
    };
  }, [id, token]);

  async function cancelBooking() {
    setBusy(true);
    try {
      const { data } = await api.put(`/bookings/${id}/cancel`, { reason: "Cancelled by customer." });
      setBooking(data.booking);
      toast.success("Booking cancelled.");
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Booking could not be cancelled.");
    } finally {
      setBusy(false);
    }
  }

  async function reschedule(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put(`/bookings/${id}/reschedule`, { scheduledAt: new Date(scheduledAt).toISOString() });
      setBooking(data.booking);
      toast.success("Booking rescheduled.");
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Booking could not be rescheduled.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <Link to="/bookings" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-accent"><ArrowLeft size={16} /> My bookings</Link>
        {loading ? <div className="grid min-h-64 place-items-center"><Spinner label="Loading booking" /></div> : error ? (
          <div role="alert" className="mt-6 rounded-xl border border-rose-300/20 bg-rose-400/5 p-5 text-sm text-rose-200">{error}</div>
        ) : booking ? (
          <div className="mt-7 grid items-start gap-6 lg:grid-cols-[1fr_340px]">
            <Card className="p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-bold tracking-[0.24em] text-accent">BOOKING DETAILS</p><h1 className="mt-2 text-2xl font-semibold">{booking.service?.title}</h1><p className="mt-1 text-sm text-slate-400">Reference {booking._id}</p></div>
                <BookingStatus status={booking.status} />
              </div>
              <div className="mt-6 grid gap-3 border-y border-white/10 py-5 text-sm text-slate-300">
                <p className="flex items-center gap-2"><CalendarClock size={16} className="text-accent" />{new Date(booking.scheduledAt).toLocaleString()}</p>
                <p className="flex items-center gap-2"><MapPin size={16} className="text-accent" />{booking.address?.line1}, {booking.address?.city} {booking.address?.pincode}</p>
                <p>Professional: {booking.provider ? <Link to={`/providers/${booking.provider._id}`} className="text-accent hover:underline">{booking.provider.name}</Link> : "Request sent to nearby professionals"}</p>
                {booking.provider && ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"].includes(booking.status) && user?.role === "customer" && (
                  <Link to={`/bookings/${id}/track`} className="inline-flex w-fit items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent hover:bg-accent/15"><MapPin size={15} />Track your professional</Link>
                )}
                {booking.notes && <p className="text-slate-400">Notes: {booking.notes}</p>}
              </div>
              <div className="mt-6">
                <h2 className="mb-5 font-semibold">Booking timeline</h2>
                <ol className="space-y-0">
                  {(booking.timeline || []).map((item, index) => (
                    <motion.li key={`${item.status}-${item.at}-${index}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.08 }} className="relative flex gap-4 pb-6 last:pb-0">
                      {index !== booking.timeline.length - 1 && <span className="absolute bottom-0 left-[11px] top-6 w-px bg-white/10" />}
                      <span className="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent"><Check size={13} /></span>
                      <span><span className="block text-sm font-medium">{String(item.status).replaceAll("_", " ")}</span><span className="mt-1 block text-xs text-slate-500">{new Date(item.at).toLocaleString()}</span></span>
                    </motion.li>
                  ))}
                </ol>
              </div>
            </Card>
            <div className="grid gap-5">
              <Card className="p-6">
                <h2 className="font-semibold">Price summary</h2>
                <div className="mt-4 flex justify-between border-t border-white/10 pt-4 text-sm text-slate-300"><span>Service</span><span>₹{Number(booking.priceSnapshot?.base || 0).toLocaleString("en-IN")}</span></div>
                <div className="mt-3 flex justify-between text-sm font-semibold"><span>Total</span><span>₹{Number(booking.priceSnapshot?.total || 0).toLocaleString("en-IN")}</span></div>
                {user?.role === "customer" && booking.status === "COMPLETED" && booking.paymentStatus !== "PAID" && (
                  <Link to={`/bookings/${id}/checkout`} className="mt-5 block"><Button className="w-full">Pay for completed booking</Button></Link>
                )}
                {user?.role === "customer" && booking.paymentStatus === "PAID" && (
                  <Link to="/payments/history" className="mt-5 block"><Button variant="secondary" className="w-full">View payment receipt</Button></Link>
                )}
                {["COMPLETED", "PAID"].includes(booking.status) && user?.role === "customer" && (
                  <Button variant="secondary" className="mt-3 w-full" onClick={() => setReviewOpen(true)}>Rate this service</Button>
                )}
                {["COMPLETED", "PAID"].includes(booking.status) && (
                  <Link to={`/bookings/${id}/dispute`} className="mt-3 block"><Button variant="ghost" className="w-full">Raise a dispute</Button></Link>
                )}
                {booking.status === "DISPUTED" && <Link to="/disputes" className="mt-3 block"><Button variant="secondary" className="w-full">View dispute thread</Button></Link>}
              </Card>
              {["PENDING", "ACCEPTED"].includes(booking.status) && (
                <Card className="grid gap-4 p-6">
                  <h2 className="font-semibold">Manage booking</h2>
                  {user?.role === "customer" && <form onSubmit={reschedule} className="grid gap-3">
                    <Input aria-label="New appointment time" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required />
                    <Button type="submit" variant="secondary" disabled={busy}>Reschedule</Button>
                  </form>}
                  <Button variant="ghost" disabled={busy} onClick={cancelBooking}>Cancel booking</Button>
                </Card>
              )}
            </div>
          </div>
        ) : null}
      </main>
      {booking?.provider && <ChatBox bookingId={id} booking={booking} peer={user?._id === booking.customer?._id ? booking.provider : booking.customer} />}
      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        bookingId={id}
        serviceTitle={booking?.service?.title}
      />
      <Footer />
    </div>
  );
}
