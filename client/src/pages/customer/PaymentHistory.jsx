import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, ReceiptText } from "lucide-react";
import api from "../../api/axios.js";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Card from "../../components/ui/Card.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import Button from "../../components/ui/Button.jsx";

export default function PaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/payments/history")
      .then(({ data }) => setPayments(data.payments || []))
      .catch((requestError) => setError(requestError.response?.data?.message || "Payment history could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-accent"><ArrowLeft size={16} /> Home</Link>
        <div className="mt-7 flex items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.24em] text-accent">ACCOUNT</p><h1 className="mt-2 text-3xl font-semibold">Payment history</h1></div><ReceiptText className="text-accent" size={28} /></div>
        {loading ? <div className="grid min-h-56 place-items-center"><Spinner label="Loading payments" /></div> : error ? <p role="alert" className="mt-6 rounded-xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p> : payments.length === 0 ? (
          <Card className="mt-7 p-8 text-center text-sm text-slate-400">Completed payments and invoices will appear here.</Card>
        ) : (
          <div className="mt-7 grid gap-3">
            {payments.map((payment) => (
              <Card key={payment._id} className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                <div><p className="font-medium">{payment.booking?.service?.title || "Home service"}</p><p className="mt-1 text-xs text-slate-500">{new Date(payment.createdAt).toLocaleString()} · Invoice {payment.invoiceNo || "pending"}</p><p className={`mt-2 text-xs font-semibold ${payment.status === "paid" ? "text-emerald-300" : payment.status === "refunded" ? "text-amber-200" : "text-rose-200"}`}>{payment.status.toUpperCase()}</p></div>
                <div className="flex items-center justify-between gap-4 sm:justify-end"><strong>₹{Number(payment.amount).toLocaleString("en-IN")}</strong>{payment.status === "paid" && <Link to={`/payments/${payment._id}/invoice`}><Button variant="secondary"><ArrowUpRight size={15} /> Invoice</Button></Link>}</div>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
