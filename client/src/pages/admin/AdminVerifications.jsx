import { useEffect, useState } from "react";
import { ExternalLink, FileCheck2, FileText, Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

function DocumentLink({ label, url, onPreview }) {
  if (!url) return null;
  const isPdf = url.toLowerCase().includes(".pdf");
  const Icon = isPdf ? FileText : ImageIcon;
  return (
    <button type="button" onClick={() => onPreview({ label, url, isPdf })} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-midnight/60 px-3 py-2 text-xs text-slate-200 hover:border-accent/40 hover:text-accent">
      <Icon size={15} />{label}<ExternalLink size={12} />
    </button>
  );
}

export default function AdminVerifications() {
  const [verifications, setVerifications] = useState([]);
  const [notes, setNotes] = useState({});
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [error, setError] = useState("");

  async function loadQueue() {
    setError("");
    try {
      const { data } = await api.get("/providers/verification/status");
      setVerifications(data.verifications);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Verification queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadQueue(); }, []);

  async function review(verification, action) {
    setReviewingId(verification._id);
    try {
      await api.put(`/providers/verification/${verification._id}/review`, {
        action,
        note: notes[verification._id] || ""
      });
      setVerifications((current) => current.filter((item) => item._id !== verification._id));
      toast.success(action === "approve" ? "Provider verified." : "Verification rejected.");
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Unable to review verification.");
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-bold tracking-[0.26em] text-accent">ADMIN REVIEW</p>
        <h1 className="mt-3 text-3xl font-semibold">Provider verifications</h1>
        <p className="mt-2 text-sm text-slate-400">Review identity, address and skill documents before approving a provider.</p>
        {loading ? <div className="grid min-h-60 place-items-center"><Spinner label="Loading verification queue" /></div> : error ? (
          <div role="alert" className="mt-8 rounded-xl border border-rose-300/20 bg-rose-400/5 p-5 text-sm text-rose-200">{error}</div>
        ) : verifications.length ? (
          <div className="mt-8 grid gap-5">
            {verifications.map((verification) => (
              <Card key={verification._id} className="p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><h2 className="text-lg font-semibold">{verification.provider?.name || "Provider"}</h2><p className="mt-1 text-sm text-slate-400">{verification.provider?.email} · Submitted {new Date(verification.createdAt).toLocaleDateString()}</p></div>
                  <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200">Pending review</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <DocumentLink label="ID proof" url={verification.idProofUrl} onPreview={setPreview} />
                  <DocumentLink label="Address proof" url={verification.addressProofUrl} onPreview={setPreview} />
                  {verification.skills.map((skill, index) => <DocumentLink key={`${skill.service?._id || skill.service}-${index}`} label={`${skill.service?.title || "Skill"} certificate`} url={skill.certificateUrl} onPreview={setPreview} />)}
                </div>
                <div className="mt-5 grid gap-2">
                  {verification.skills.map((skill, index) => <p key={`${skill.service?._id || skill.service}-meta-${index}`} className="text-sm text-slate-300">{skill.service?.title || "Skill"} <span className="text-slate-500">· {skill.yearsExperience} years experience</span></p>)}
                </div>
                <div className="mt-5 grid gap-4 border-t border-white/[0.08] pt-5 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Input label="Review note (optional)" value={notes[verification._id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [verification._id]: event.target.value }))} placeholder="Add guidance for the provider" maxLength={1000} />
                  <div className="flex gap-2">
                    <Button variant="secondary" disabled={reviewingId === verification._id} onClick={() => review(verification, "reject")}>Reject</Button>
                    <Button disabled={reviewingId === verification._id} onClick={() => review(verification, "approve")}><FileCheck2 size={16} /> Approve</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <FileCheck2 size={28} className="mx-auto text-accent" /><h2 className="mt-4 font-semibold">All caught up</h2><p className="mt-2 text-sm text-slate-400">There are no pending provider verifications.</p>
          </div>
        )}
      </main>
      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.label || "Document"} className="max-w-4xl">
        {preview?.isPdf ? (
          <iframe title={preview.label} src={preview.url} className="h-[70vh] w-full rounded-lg bg-white" />
        ) : preview ? (
          <img src={preview.url} alt={preview.label} className="mx-auto max-h-[70vh] max-w-full rounded-lg object-contain" />
        ) : null}
      </Modal>
    </div>
  );
}
