import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Paperclip } from "lucide-react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

const statusStyle = {
  open: "bg-amber-300/10 text-amber-100",
  under_review: "bg-sky-300/10 text-sky-100",
  resolved: "bg-emerald-300/10 text-emerald-100",
  dismissed: "bg-slate-300/10 text-slate-300"
};

export default function DisputeThread() {
  const { id } = useParams();
  const user = useSelector((state) => state.auth.user);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);

  async function loadDisputes() {
    try {
      const { data } = await api.get("/disputes/mine");
      setDisputes(data.disputes || []);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Disputes could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadDisputes(); }, []);

  async function respond(event) {
    event.preventDefault();
    setSending(true);
    const formData = new FormData();
    formData.append("text", text);
    files.forEach((file) => formData.append("evidence", file));
    try {
      await api.put(`/disputes/${active._id}/respond`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      setText("");
      setFiles([]);
      await loadDisputes();
      toast.success("Your response was added.");
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Your response could not be added.");
    } finally {
      setSending(false);
    }
  }

  const active = disputes.find((dispute) => String(dispute._id) === id);
  const currentId = String(user?._id || user?.id || "");
  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <Link to="/disputes" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-accent"><ArrowLeft size={16} /> All disputes</Link>
        <div className="mt-7"><p className="text-xs font-bold tracking-[0.24em] text-accent">CUSTOMER SUPPORT</p><h1 className="mt-2 text-3xl font-semibold">{id ? "Dispute thread" : "Your disputes"}</h1></div>
        {loading ? <div className="grid min-h-60 place-items-center"><Spinner label="Loading disputes" /></div> : error ? <p role="alert" className="mt-6 rounded-xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p> : !id ? (
          disputes.length ? <div className="mt-6 grid gap-3">{disputes.map((dispute) => <Link key={dispute._id} to={`/disputes/${dispute._id}`}><Card className="flex flex-wrap items-center justify-between gap-3 p-5 transition hover:border-accent/30"><div><p className="font-medium">{dispute.booking?.service?.title || "Home service"} · {dispute.reason.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-500">Opened {new Date(dispute.createdAt).toLocaleDateString()}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[dispute.status]}`}>{dispute.status.replaceAll("_", " ")}</span></Card></Link>)}</div> : <Card className="mt-6 p-8 text-center text-sm text-slate-400">No disputes yet.</Card>
        ) : !active ? <Card className="mt-6 p-7 text-sm text-slate-400">Dispute not found in your conversations.</Card> : (
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1fr_320px]">
            <Card className="p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-slate-500">BOOKING {active.booking?._id}</p><h2 className="mt-1 text-xl font-semibold">{active.booking?.service?.title || "Home service"}</h2><p className="mt-1 text-sm capitalize text-slate-400">{active.reason.replaceAll("_", " ")}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[active.status]}`}>{active.status.replaceAll("_", " ")}</span></div>
              <div className="mt-6 space-y-4">
                <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-slate-500">{active.raisedBy?.name || "Customer"} · {new Date(active.createdAt).toLocaleString()}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{active.description}</p>{active.evidence?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{active.evidence.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-accent"><Paperclip size={13} />Evidence {index + 1}</a>)}</div>}</article>
                {(active.responses || []).map((response) => <article key={response._id} className={`rounded-xl border p-4 ${String(response.by?._id || response.by) === currentId ? "border-accent/20 bg-accent/[0.04]" : "border-white/10 bg-white/[0.03]"}`}><p className="text-xs text-slate-500">{response.by?.name || "Participant"} · {new Date(response.at).toLocaleString()}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{response.text}</p>{response.evidence?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{response.evidence.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-accent"><Paperclip size={13} />Evidence {index + 1}</a>)}</div>}</article>)}
              </div>
              {String(active.against?._id || active.against) === currentId && ["open", "under_review"].includes(active.status) && <form onSubmit={respond} className="mt-6 grid gap-3 border-t border-white/10 pt-5"><label className="grid gap-2 text-sm font-medium text-slate-200">Your response<textarea required minLength={1} maxLength={2000} rows={4} value={text} onChange={(event) => setText(event.target.value)} className="resize-y rounded-xl border border-white/10 bg-midnight/70 px-4 py-3 text-sm text-white outline-none focus:border-accent/60" placeholder="Add a response for the other participant." /></label><div className="flex flex-wrap items-center justify-between gap-3"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300"><Paperclip size={14} /> Attach evidence<input type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))} /></label><Button type="submit" disabled={sending}>{sending ? "Sending…" : "Send response"}</Button></div>{files.length > 0 && <p className="text-xs text-slate-500">{files.map((file) => file.name).join(", ")}</p>}</form>}
            </Card>
            <Card className="grid gap-3 p-5"><h2 className="font-semibold">Dispute details</h2><p className="text-sm text-slate-400">Raised by <span className="text-slate-200">{active.raisedBy?.name || "Participant"}</span></p><p className="text-sm text-slate-400">Response from <span className="text-slate-200">{active.against?.name || "Participant"}</span></p><p className="text-sm text-slate-400">Opened <span className="text-slate-200">{new Date(active.createdAt).toLocaleString()}</span></p>{active.resolution && <div className="mt-2 border-t border-white/10 pt-4"><p className="text-xs font-bold uppercase tracking-wider text-emerald-200">Resolution · {active.resolution.action.replaceAll("_", " ")}</p><p className="mt-2 text-sm text-slate-300">{active.resolution.note}</p></div>}</Card>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
