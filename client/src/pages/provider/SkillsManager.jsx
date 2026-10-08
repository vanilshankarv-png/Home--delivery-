import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import BadgeChip from "../../components/ui/BadgeChip.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

export default function SkillsManager() {
  const [services, setServices] = useState([]);
  const [skills, setSkills] = useState([]);
  const [verificationStatus, setVerificationStatus] = useState("none");
  const [form, setForm] = useState({ service: "", yearsExperience: "0", certificate: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadSkills() {
    const { data } = await api.get("/providers/verification/status");
    setSkills(data.provider?.skills || []);
    setVerificationStatus(data.provider?.verificationStatus || "none");
  }

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/services?limit=50"), api.get("/providers/verification/status")])
      .then(([serviceResponse, statusResponse]) => {
        if (!active) return;
        setServices(serviceResponse.data.services);
        setSkills(statusResponse.data.provider?.skills || []);
        setVerificationStatus(statusResponse.data.provider?.verificationStatus || "none");
      })
      .catch((error) => { if (active) toast.error(error.response?.data?.message || "Skills could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function addSkill(event) {
    event.preventDefault();
    if (!form.certificate) {
      toast.error("Attach a certificate for this skill.");
      return;
    }
    const formData = new FormData();
    formData.append("service", form.service);
    formData.append("yearsExperience", form.yearsExperience);
    formData.append("certificate", form.certificate);
    setSaving(true);
    try {
      await api.post("/providers/skills", formData, { headers: { "Content-Type": "multipart/form-data" } });
      await loadSkills();
      setForm({ service: "", yearsExperience: "0", certificate: null });
      toast.success("Skill added and submitted for review.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to add this skill.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-bold tracking-[0.26em] text-accent">PROVIDER PROFILE</p>
        <h1 className="mt-3 text-3xl font-semibold">Skills & credentials</h1>
        <p className="mt-2 text-sm text-slate-400">Add a service you offer and attach proof of your experience.</p>
        {loading ? <div className="grid min-h-48 place-items-center"><Spinner label="Loading your skills" /></div> : (
          <div className="mt-8 grid gap-6">
            <Card className="p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="font-semibold">Verification status</h2><p className="mt-1 text-sm capitalize text-slate-400">{verificationStatus}</p></div>
                <BadgeChip badge={{ name: verificationStatus === "verified" ? "Verified Identity" : "Profile status", level: verificationStatus === "verified" ? "Verified" : "Bronze" }} />
              </div>
              {verificationStatus === "none" && <p className="mt-4 text-sm text-amber-200">Submit your identity and address documents before adding a skill.</p>}
            </Card>
            <Card className="p-6 sm:p-8">
              <div className="mb-5 flex items-center gap-2"><Plus size={18} className="text-accent" /><h2 className="font-semibold">Add a service skill</h2></div>
              <form onSubmit={addSkill} className="grid gap-4">
                <label className="grid gap-2 text-sm font-medium text-slate-200">Service
                  <select value={form.service} onChange={(event) => setForm({ ...form, service: event.target.value })} required className="w-full rounded-xl border border-white/10 bg-midnight px-3 py-3 text-sm text-white outline-none focus:border-accent/60">
                    <option value="">Choose a service</option>{services.map((service) => <option key={service._id} value={service._id}>{service.title}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-200">Years experience
                  <input type="number" min="0" max="60" required value={form.yearsExperience} onChange={(event) => setForm({ ...form, yearsExperience: event.target.value })} className="w-full rounded-xl border border-white/10 bg-midnight px-3 py-3 text-sm text-white outline-none focus:border-accent/60" />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-200">Certificate (image or PDF, max 5 MB)
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,.pdf" required onChange={(event) => setForm({ ...form, certificate: event.target.files?.[0] || null })} className="block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-primary/15 file:px-4 file:py-2 file:font-semibold file:text-primary-light hover:file:bg-primary/25" />
                </label>
                <Button type="submit" disabled={saving || verificationStatus === "none"} className="w-full sm:w-fit">{saving ? "Adding…" : "Add skill for review"}</Button>
              </form>
            </Card>
            <Card className="p-6 sm:p-8">
              <h2 className="font-semibold">Submitted skills</h2>
              <div className="mt-4 divide-y divide-white/[0.07]">
                {skills.map((skill, index) => (
                  <div key={`${skill.service?._id || skill.service}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div><p className="font-medium">{skill.service?.title || "Home service"}</p><p className="mt-1 text-xs text-slate-400">{skill.yearsExperience} years experience</p></div>
                    {verificationStatus === "verified"
                      ? <BadgeChip badge={{ name: "Skill Verified", level: skill.level || "Bronze" }} />
                      : <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-200">Pending verification</span>}
                  </div>
                ))}
                {!skills.length && <p className="py-4 text-sm text-slate-500">No submitted skills yet.</p>}
              </div>
            </Card>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
