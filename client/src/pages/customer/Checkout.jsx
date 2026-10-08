import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { loadScript } from "../../utils/loadScript.js";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, CreditCard, ShieldCheck, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import { useSelector } from "react-redux";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

const confettiPieces = Array.from({ length: 22 }, (_, index) => index);

export default function Checkout() {
  const { bookingId } = useParams();
  const user = useSelector((state) => state.auth.user);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get(`/bookings/${bookingId}`)
      .then(({ data }) => {
        if (active) {
          setBooking(data.booking);
          if (data.booking.paymentStatus === "PAID" || data.booking.status === "PAID") {
            setResult({ success: true, alreadyPaid: true });
          }
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "Booking details could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingId]);

  async function verifyPayment(paymentFields) {
    const { data } = await api.post("/payments/verify", paymentFields);
    setResult({ success: true, payment: data.payment });
    setBooking((current) => current ? { ...current, status: "PAID", paymentStatus: "PAID" } : current);
  }

  async function pay() {
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post("/payments/create-order", { bookingId });
      const payment = data.payment;
      setMockMode(payment.isMock);
      if (payment.isMock) {
        await new Promise((resolve) => setTimeout(resolve, 650));
        await verifyPayment({
          razorpay_order_id: payment.razorpayOrderId,
          ...payment.mockPayment
        });
        return;
      }

      const scriptLoaded = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      if (!scriptLoaded || !window.Razorpay) throw new Error("Razorpay Checkout could not be loaded. Check your connection and try again.");
      const checkout = new window.Razorpay({
        key: payment.keyId,
        amount: Math.round(payment.amount * 100),
        currency: payment.currency,
        name: "Home Delivery",
        description: booking.service?.title || "Completed home service",
        order_id: payment.razorpayOrderId,
        prefill: { name: user?.name, email: user?.email, contact: user?.phone },
        theme: { color: "#35d9f2" },
        handler: async (response) => {
          try {
            await verifyPayment(response);
          } catch (requestError) {
            setError(requestError.response?.data?.message || "Payment verification failed. Contact support before retrying.");
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => setSubmitting(false)
        }
      });
      checkout.on("payment.failed", async (failure) => {
        try {
          await api.post("/payments/verify", {
            razorpay_order_id: payment.razorpayOrderId,
            status: "failed"
          });
        } catch (requestError) {
          console.error("Unable to record failed checkout:", requestError);
        }
        setResult({ success: false, message: failure.error?.description || "Payment was not completed." });
        setSubmitting(false);
      });
      checkout.open();
    } catch (requestError) {
      const message = requestError.response?.data?.message || requestError.message || "Checkout could not be started.";
      setError(message);
      setResult({ success: false, message });
      setSubmitting(false);
      toast.error(message);
    }
  }

  function retry() {
    setResult(null);
    setError("");
  }

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <Link to={`/bookings/${bookingId}`} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-accent"><ArrowLeft size={16} /> Booking details</Link>
        {loading ? <div className="grid min-h-64 place-items-center"><Spinner label="Loading checkout" /></div> : error && !booking ? (
          <div role="alert" className="mt-7 rounded-xl border border-rose-300/20 bg-rose-400/5 p-5 text-sm text-rose-200">{error}</div>
        ) : result ? (
          <AnimatePresence mode="wait">
            <motion.div key={result.success ? "success" : "failure"} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="relative mt-8">
              {result.success ? (
                <>
                  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                    {confettiPieces.map((piece) => <motion.i key={piece} className="absolute top-8 h-2 w-2 rounded-sm bg-accent" initial={{ x: "50vw", y: 0, rotate: 0, opacity: 1 }} animate={{ x: `${(piece * 41) % 90}vw`, y: 340 + piece * 7, rotate: 540, opacity: 0 }} transition={{ duration: 1.6 + (piece % 5) * 0.2, delay: (piece % 7) * 0.04 }} />)}
                  </div>
                  <Card className="relative z-10 grid justify-items-center gap-4 p-8 text-center sm:p-12">
                    <BadgeCheck size={52} className="text-emerald-300" />
                    <h1 className="text-2xl font-semibold">Payment successful</h1>
                    <p className="max-w-md text-sm text-slate-400">{result.alreadyPaid ? "This booking is already paid." : "Your payment has been verified and your provider credited."}</p>
                    <div className="mt-2 flex flex-wrap justify-center gap-3">
                      <Link to="/payments/history"><Button variant="secondary">Payment history</Button></Link>
                      {result.payment?._id && <Link to={`/payments/${result.payment._id}/invoice`}><Button>View invoice</Button></Link>}
                      <Link to={`/bookings/${bookingId}`}><Button variant="ghost">Back to booking</Button></Link>
                    </div>
                  </Card>
                </>
              ) : (
                <Card className="relative z-10 grid justify-items-center gap-4 p-8 text-center sm:p-12">
                  <XCircle size={48} className="text-rose-300" />
                  <h1 className="text-2xl font-semibold">Payment not completed</h1>
                  <p className="max-w-md text-sm text-slate-400">{result.message || error || "Try again when you are ready."}</p>
                  <div className="flex flex-wrap justify-center gap-3"><Button onClick={retry}>Try again</Button><Link to={`/bookings/${bookingId}`}><Button variant="secondary">Booking details</Button></Link></div>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        ) : booking ? (
          <div className="mx-auto mt-8 max-w-xl">
            <Card className="p-6 sm:p-8">
              <p className="text-xs font-bold tracking-[0.24em] text-accent">SECURE CHECKOUT</p>
              <h1 className="mt-3 text-2xl font-semibold">Complete your payment</h1>
              <p className="mt-2 text-sm text-slate-400">{booking.service?.title} · Completed {new Date(booking.timeline?.findLast?.((item) => item.status === "COMPLETED")?.at || booking.updatedAt).toLocaleDateString()}</p>
              <div className="my-6 flex items-center justify-between border-y border-white/10 py-5"><span className="text-sm text-slate-400">Amount due</span><strong className="text-2xl">₹{Number(booking.priceSnapshot?.total || 0).toLocaleString("en-IN")}</strong></div>
              {booking.status !== "COMPLETED" && booking.status !== "PAID" && <p role="alert" className="mb-4 text-sm text-amber-200">Payments are available after the provider marks the job complete.</p>}
              {error && <p role="alert" className="mb-4 text-sm text-rose-200">{error}</p>}
              <Button onClick={pay} disabled={submitting || booking.status !== "COMPLETED" || booking.paymentStatus === "PAID"} className="w-full">
                <CreditCard size={17} />{submitting ? "Processing…" : "Pay securely"}
              </Button>
              <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck size={14} />{mockMode ? "Demo checkout · No real charge" : "Payment processed securely by Razorpay"}</p>
            </Card>
          </div>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
