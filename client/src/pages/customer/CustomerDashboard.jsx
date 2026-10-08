import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, ClipboardList, CreditCard, MapPin, Pencil, Sparkles } from "lucide-react";
import { useSelector } from "react-redux";
import api from "../../api/axios.js";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

export default function CustomerDashboard() {
  const user = useSelector((state) => state.auth.user);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.get("/bookings"), api.get("/payments/history")])
      .then(([bookingResponse, paymentResponse]) => {
        setBookings(bookingResponse.data.bookings || []);
        setPayments(paymentResponse.data.payments || []);
      })
      .catch((requestError) => setError(requestError.response?.data?.message || "Your dashboard could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  const upcoming = bookings.filter((booking) => ["PENDING", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"].includes(booking.status));
  const needsPayment = bookings.filter((booking) => booking.status === "COMPLETED" && booking.paymentStatus !== "PAID");
  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white"><Navbar /><main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.24em] text-accent">YOUR HOME</p><h1 className="mt-2 text-3xl font-semibold">Hello, {user?.name?.split(" ")[0] || "there"}</h1><p className="mt-2 text-sm text-slate-400">A handy overview of your home services.</p></div><Link to="/app"><Button><Sparkles size={16} /> Explore services</Button></Link></div>
      {loading ? <div className="grid min-h-64 place-items-center"><Spinner label="Loading your dashboard" /></div> : error ? <p role="alert" className="mt-6 rounded-xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p> : <>
        <section className="mt-7 grid gap-4 sm:grid-cols-3">{[{ label: "Upcoming bookings", value: upcoming.length, icon: CalendarDays }, { label: "Payment due", value: needsPayment.length, icon: CreditCard }, { label: "Services booked", value: bookings.length, icon: ClipboardList }].map(({ label, value, icon: Icon }) => <Card key={label} className="p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent"><Icon size={19} /></span><p className="mt-4 text-sm text-slate-400">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></Card>)}</section>
        <Card className="mt-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold tracking-[0.2em] text-accent">MY HOME</p><h2 className="mt-1 text-lg font-semibold">Saved addresses</h2></div>
            <Link to="/profile"><Button variant="secondary"><Pencil size={15} /> Edit home details</Button></Link>
          </div>
          {user?.address?.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {user.address.map((address, index) => (
                <div key={`${address._id || address.label || "address"}-${index}`} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-accent"><MapPin size={16} /><span className="text-sm font-medium text-slate-200">{address.label || `Address ${index + 1}`}</span></div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{[address.line1, address.city, address.pincode].filter(Boolean).join(", ") || "Complete this saved address in your profile."}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
              Add a saved address to make booking a home service easier.
              <Link to="/profile" className="ml-2 font-medium text-accent hover:underline">Add address</Link>
            </div>
          )}
        </Card>
        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]"><Card className="p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="font-semibold">Recent bookings</h2><Link to="/bookings" className="inline-flex items-center gap-1 text-sm text-accent">All bookings <ArrowRight size={14} /></Link></div>{bookings.length ? <div className="mt-4 grid gap-3">{bookings.slice(0, 5).map((booking) => <Link key={booking._id} to={`/bookings/${booking._id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] p-4 hover:border-accent/30"><div><p className="font-medium">{booking.service?.title || "Home service"}</p><p className="mt-1 text-xs text-slate-500">{new Date(booking.scheduledAt).toLocaleString()}</p></div><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">{booking.status.replaceAll("_", " ")}</span></Link>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No bookings yet. Find a trusted professional for your next home project.</p>}</Card>
          <Card className="p-5 sm:p-6"><h2 className="font-semibold">Your account</h2><div className="mt-4 rounded-xl bg-white/[0.03] p-4"><p className="text-xs text-slate-500">Recent payments</p><p className="mt-2 text-xl font-semibold">{payments.length}</p><Link to="/payments/history" className="mt-2 inline-flex text-sm text-accent hover:underline">Payment history</Link></div><div className="mt-3 rounded-xl bg-white/[0.03] p-4"><p className="text-xs text-slate-500">Need a hand?</p><p className="mt-2 text-sm text-slate-300">Check your booking conversations or open a dispute for a completed job.</p><Link to="/disputes"><Button variant="secondary" className="mt-3 w-full">View disputes</Button></Link></div></Card></section>
      </>}
    </main><Footer /></div>
  );
}
