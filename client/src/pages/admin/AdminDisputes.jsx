import { useEffect, useState } from "react";
import { Gavel } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState(null);
  const [action, setAction] = useState("refund");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadQueue() {
    try {
      const { data } = await api.get("/admin/dashboard");
      setDisputes(data.openDisputes || []);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Dispute queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadQueue(); }, []);

  function openResolution(dispute) {
    setActive(dispute);
    setAction("refund");
    setAmount("");
    setNote("");
  }

  async function resolve(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.put(`/admin/disputes/${active._id}/resolve`, {
        action,
        ...(action === "partial_refund" ? { amount: Number(amount) } : {}),
        note
      });
      toast.success(action === "dismiss" ? "Dispute dismissed and hold released." : "Dispute resolved and refund submitted.");
      setActive(null);
      await loadQueue();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Dispute could not be resolved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div><p className="text-xs font-bold tracking-[0.24em] text-accent">ADMIN CONSOLE</p><h1 className="mt-2 text-3xl font-semibold">Dispute queue</h1><p className="mt-2 text-sm text-slate-400">Review the conversation and evidence before releasing held funds or issuing a refund.</p>
      {error ? <p role="alert" className="mt-6 rounded-xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p> : loading ? <div className="grid min-h-64 place-items-center"><Spinner label="Loading dispute queue" /></div> : disputes.length ? <div className="mt-6 grid gap-4">{disputes.map((dispute) => <Card key={dispute._id} className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{dispute.booking?.service?.title || "Home service"}</h2><span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-100">{dispute.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-xs capitalize text-slate-500">{dispute.reason.replaceAll("_", " ")} · {new Date(dispute.createdAt).toLocaleString()}</p></div><Button onClick={() => openResolution(dispute)}><Gavel size={15} /> Resolve</Button></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-300">{dispute.description}</p><p className="mt-3 text-xs text-slate-500">Raised by {dispute.raisedBy?.name} · Against {dispute.against?.name} · {dispute.responses?.length || 0} responses</p><div className="mt-3 flex flex-wrap gap-2">{(dispute.evidence || []).map((url, index) => <a key={url} target="_blank" rel="noreferrer" href={url} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-accent">Evidence {index + 1}</a>)}{(dispute.responses || []).flatMap((response) => response.evidence || []).map((url, index) => <a key={url} target="_blank" rel="noreferrer" href={url} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-accent">Response evidence {index + 1}</a>)}</div><div className="mt-4 grid gap-2">{(dispute.responses || []).map((response) => <p key={response._id} className="rounded-lg bg-white/[0.03] p-3 text-xs text-slate-300"><span className="text-slate-500">{response.by?.name || "Participant"}:</span> {response.text}</p>)}</div></Card>)}</div> : <Card className="mt-6 grid justify-items-center gap-3 p-10 text-center"><Gavel className="text-accent" /><h2 className="font-semibold">No open disputes</h2><p className="text-sm text-slate-400">New disputes will appear in this queue.</p></Card>}
      <Modal open={Boolean(active)} onClose={() => setActive(null)} title="Resolve dispute">
        <form onSubmit={resolve} className="grid gap-4">
          <p className="text-sm text-slate-400">{active?.booking?.service?.title || "Home service"} · {active?.reason?.replaceAll("_", " ")}</p>
          <label className="grid gap-2 text-sm text-slate-300">Resolution<select value={action} onChange={(event) => setAction(event.target.value)} className="rounded-xl border border-white/10 bg-midnight px-4 py-3 text-white"><option value="refund">Full refund</option><option value="partial_refund">Partial refund</option><option value="dismiss">Dismiss dispute</option></select></label>
          {action === "partial_refund" && <Input label="Refund amount (₹)" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />}
          <label className="grid gap-2 text-sm font-medium text-slate-200">Resolution note<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} className="rounded-xl border border-white/10 bg-midnight/70 px-4 py-3 text-sm text-white outline-none focus:border-accent/60" placeholder="Explain the resolution to both parties." /></label>
          <p className="text-xs text-amber-100">The decision is final. Refund actions call the configured payment gateway and reconcile the provider wallet.</p>
          <Button type="submit" disabled={saving || (action === "partial_refund" && !Number(amount))}>{saving ? "Resolving…" : "Confirm resolution"}</Button>
        </form>
      </Modal>
    </div>
  );
}
