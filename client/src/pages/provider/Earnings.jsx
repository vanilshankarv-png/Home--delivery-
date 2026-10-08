import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Banknote, Clock3, IndianRupee, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

const formatMoney = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function Earnings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("upi");
  const [details, setDetails] = useState({ upiId: "", accountHolder: "", accountNumber: "", ifsc: "" });

  const loadEarnings = useCallback(async () => {
    try {
      const response = await api.get("/payouts");
      setData(response.data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Earnings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadEarnings(); }, [loadEarnings]);

  async function submitPayout(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/payouts/request", {
        amount: Number(amount),
        method,
        details: method === "upi"
          ? { upiId: details.upiId }
          : { accountHolder: details.accountHolder, accountNumber: details.accountNumber, ifsc: details.ifsc }
      });
      toast.success("Payout requested.");
      setOpen(false);
      setAmount("");
      await loadEarnings();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Payout could not be requested.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <Link to="/provider/jobs" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-accent"><ArrowLeft size={16} /> Provider jobs</Link>
        <div className="mt-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.24em] text-accent">PROVIDER WALLET</p><h1 className="mt-2 text-3xl font-semibold">Earnings & payouts</h1><p className="mt-2 text-sm text-slate-400">Your payout requests reserve funds immediately.</p></div><Button onClick={() => setOpen(true)} disabled={!data || data.walletBalance < 500}><Banknote size={17} /> Request payout</Button></div>
        {loading ? <div className="grid min-h-64 place-items-center"><Spinner label="Loading earnings" /></div> : error ? <p role="alert" className="mt-7 rounded-xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p> : data && (
          <>
            <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Available balance", value: data.walletBalance, icon: Wallet },
                { label: "Lifetime earnings", value: data.earnings, icon: IndianRupee },
                { label: "Paid out", value: data.paidOut, icon: Banknote },
                { label: "Pending payouts", value: data.pendingPayouts, icon: Clock3 },
                ...(data.heldBalance > 0 ? [{ label: "Held for disputes", value: data.heldBalance, icon: Clock3 }] : [])
              ].map(({ label, value, icon: Icon }) => <Card key={label} className="p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent"><Icon size={19} /></span><p className="mt-5 text-sm text-slate-400">{label}</p><p className="mt-1 text-2xl font-semibold">{formatMoney(value)}</p></Card>)}
            </section>
            <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="p-5 sm:p-6"><h2 className="font-semibold">Earnings by month</h2>{data.chart.length ? <div className="mt-5 h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.chart}><defs><linearGradient id="earningsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#35d9f2" stopOpacity={0.3} /><stop offset="100%" stopColor="#35d9f2" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} /><XAxis dataKey="month" stroke="#94a3b8" tickLine={false} axisLine={false} /><YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} /><Tooltip formatter={(value) => formatMoney(value)} contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12 }} /><Area type="monotone" dataKey="amount" stroke="#35d9f2" strokeWidth={2} fill="url(#earningsFill)" /></AreaChart></ResponsiveContainer></div> : <p className="grid h-72 place-items-center text-sm text-slate-500">Completed paid jobs will appear here.</p>}</Card>
              <Card className="p-5 sm:p-6"><h2 className="font-semibold">Payout history</h2><div className="mt-4 max-h-80 space-y-3 overflow-y-auto">{data.payouts.length ? data.payouts.map((payout) => <div key={payout._id} className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-0"><div><p className="text-sm font-medium">{formatMoney(payout.amount)} · {payout.method.toUpperCase()}</p><p className="mt-1 text-xs text-slate-500">{new Date(payout.requestedAt).toLocaleDateString()}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${payout.status === "paid" ? "bg-emerald-400/10 text-emerald-200" : payout.status === "rejected" ? "bg-rose-400/10 text-rose-200" : "bg-amber-300/10 text-amber-100"}`}>{payout.status}</span></div>) : <p className="py-12 text-center text-sm text-slate-500">No payout requests yet.</p>}</div></Card>
            </div>
          </>
        )}
      </main>
      <Footer />
      <Modal open={open} onClose={() => setOpen(false)} title="Request a payout">
        <form onSubmit={submitPayout} className="grid gap-4">
          <p className="text-sm text-slate-400">Available: {formatMoney(data?.walletBalance)} · Minimum request: ₹500</p>
          <Input label="Amount (₹)" type="number" min="500" max={data?.walletBalance} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          <label className="grid gap-2 text-sm text-slate-300">Payout method<select value={method} onChange={(event) => setMethod(event.target.value)} className="rounded-xl border border-white/10 bg-midnight px-4 py-3 text-white"><option value="upi">UPI</option><option value="bank">Bank transfer</option></select></label>
          {method === "upi" ? <Input label="UPI ID" placeholder="name@bank" value={details.upiId} onChange={(event) => setDetails({ ...details, upiId: event.target.value })} required /> : <><Input label="Account holder" value={details.accountHolder} onChange={(event) => setDetails({ ...details, accountHolder: event.target.value })} required /><Input label="Account number" value={details.accountNumber} onChange={(event) => setDetails({ ...details, accountNumber: event.target.value })} required /><Input label="IFSC" value={details.ifsc} onChange={(event) => setDetails({ ...details, ifsc: event.target.value.toUpperCase() })} required /></>}
          <p className="text-xs text-slate-500">Payout details are only used to process your request.</p>
          <Button type="submit" disabled={saving || Number(amount) > Number(data?.walletBalance || 0)}>{saving ? "Submitting…" : "Confirm payout request"}</Button>
        </form>
      </Modal>
    </div>
  );
}
