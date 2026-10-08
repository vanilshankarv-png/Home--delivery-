import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import api from "../../api/axios.js";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

export default function Invoice() {
  const { paymentId } = useParams();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/payments/${paymentId}`)
      .then(({ data }) => setPayment(data.payment))
      .catch((requestError) => setError(requestError.response?.data?.message || "Invoice could not be loaded."))
      .finally(() => setLoading(false));
  }, [paymentId]);

  const booking = payment?.booking || {};
  const price = booking.priceSnapshot || {};
  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white print:bg-white print:text-black">
      <div className="print:hidden"><Navbar /></div>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-6 flex items-center justify-between print:hidden"><Link to="/payments/history" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-accent"><ArrowLeft size={16} /> Payment history</Link><Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print invoice</Button></div>
        {loading ? <div className="grid min-h-56 place-items-center"><Spinner label="Loading invoice" /></div> : error ? <p role="alert" className="rounded-xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p> : payment && (
          <Card className="invoice-sheet p-7 sm:p-10 print:border-0 print:bg-white print:shadow-none">
            <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-6 sm:flex-row print:border-slate-200"><div><p className="text-xs font-bold tracking-[0.24em] text-accent print:text-slate-600">HOME DELIVERY</p><h1 className="mt-2 text-3xl font-semibold">Invoice</h1></div><div className="text-sm sm:text-right"><p className="font-medium">{payment.invoiceNo}</p><p className="mt-1 text-slate-400 print:text-slate-600">{new Date(payment.createdAt).toLocaleDateString()}</p><p className="mt-1 font-semibold text-emerald-300 print:text-emerald-700">{payment.status.toUpperCase()}</p></div></header>
            <section className="grid gap-6 border-b border-white/10 py-6 sm:grid-cols-2 print:border-slate-200"><div><p className="text-xs uppercase tracking-wider text-slate-500">Billed to</p><p className="mt-2 font-medium">{payment.customer?.name}</p><p className="mt-1 text-sm text-slate-400 print:text-slate-600">{payment.customer?.email}</p></div><div><p className="text-xs uppercase tracking-wider text-slate-500">Booking</p><p className="mt-2 font-medium">{booking.service?.title || "Home service"}</p><p className="mt-1 text-sm text-slate-400 print:text-slate-600">{booking._id}</p></div></section>
            <section className="space-y-3 py-6 text-sm">{[["Service subtotal", price.subtotal ?? (payment.amount - payment.platformFee)], ["Platform fee", price.platformFee ?? payment.platformFee], ["Total paid", payment.amount]].map(([label, amount], index) => <div key={label} className={`flex justify-between ${index === 2 ? "border-t border-white/10 pt-4 text-base font-semibold print:border-slate-200" : "text-slate-400 print:text-slate-600"}`}><span>{label}</span><span className={index === 2 ? "text-white print:text-black" : ""}>₹{Number(amount || 0).toLocaleString("en-IN")}</span></div>)}</section>
            <footer className="border-t border-white/10 pt-5 text-xs text-slate-500 print:border-slate-200">Payment ID: {payment.razorpayPaymentId || "Demo payment"} · Thank you for choosing Home Delivery.</footer>
          </Card>
        )}
      </main>
      <div className="print:hidden"><Footer /></div>
    </div>
  );
}
