import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Paperclip } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Button from "../../components/ui/Button.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

const reasons = [
  ["poor_service", "Poor service"],
  ["no_show", "Provider did not show up"],
  ["overcharge", "Overcharge"],
  ["damage", "Property damage"],
  ["other", "Other"]
];

export default function RaiseDispute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [reason, setReason] = useState("poor_service");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/bookings/${id}`)
      .then(({ data }) => setBooking(data.booking))
      .catch((requestError) => setError(requestError.response?.data?.message || "Booking could not be loaded."))
      .finally(() => setLoading(false));
  }, [id]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const formData = new FormData();
    formData.append("bookingId", id);
    formData.append("reason", reason);
    formData.append("description", description);
    files.forEach((file) => formData.append("evidence", file));
    try {
      const { data } = await api.post("/disputes", formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Dispute submitted. Provider payouts for this booking are on hold.");
      navigate(`/disputes/${data.dispute._id}`);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Dispute could not be submitted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <Link to={`/bookings/${id}`} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-accent"><ArrowLeft size={16} /> Booking details</Link>
        {loading ? <div className="grid min-h-60 place-items-center"><Spinner label="Loading booking" /></div> : error ? <p role="alert" className="mt-7 rounded-xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p> : booking && (
          <Card className="mt-7 p-6 sm:p-8">
            <p className="text-xs font-bold tracking-[0.24em] text-accent">CUSTOMER SUPPORT</p>
            <h1 className="mt-2 text-3xl font-semibold">Raise a dispute</h1>
            <p className="mt-2 text-sm text-slate-400">{booking.service?.title} · Booking {booking._id}</p>
            <p className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/5 p-4 text-sm text-amber-100">Please submit within 48 hours after completion. The provider’s payout for this booking will be held while the dispute is open.</p>
            <form onSubmit={submit} className="mt-6 grid gap-5">
              <label className="grid gap-2 text-sm font-medium text-slate-200">Reason<select value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-xl border border-white/10 bg-midnight px-4 py-3 text-white">{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="grid gap-2 text-sm font-medium text-slate-200">Describe what happened<textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={3000} required rows={5} className="resize-y rounded-xl border border-white/10 bg-midnight/70 px-4 py-3 text-sm text-white outline-none focus:border-accent/60" placeholder="Include the details that will help us understand the issue." /></label>
              <div className="grid gap-2"><span className="text-sm font-medium text-slate-200">Evidence (up to 5 files, 5 MB each)</span><label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5"><Paperclip size={16} /> Attach images or PDF<input type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))} /></label>{files.length > 0 && <ul className="text-xs text-slate-400">{files.map((file) => <li key={`${file.name}-${file.lastModified}`}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</li>)}</ul>}</div>
              <Button type="submit" disabled={saving || !["COMPLETED", "PAID"].includes(booking.status)}>{saving ? "Submitting dispute…" : "Submit dispute"}</Button>
              {!["COMPLETED", "PAID"].includes(booking.status) && <p role="alert" className="text-xs text-rose-200">Only completed bookings can be disputed.</p>}
            </form>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
}
