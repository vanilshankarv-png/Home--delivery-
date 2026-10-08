import { useEffect, useState } from "react";
import { Check, FileCheck2, FileImage, UploadCloud } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

function FileDrop({ title, file, onFile, accept = "image/jpeg,image/png,image/webp,image/gif,image/avif,.pdf" }) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!file?.type.startsWith("image/")) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <label
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const nextFile = event.dataTransfer.files?.[0];
        if (nextFile) onFile(nextFile);
      }}
      className="group grid min-h-36 cursor-pointer place-items-center rounded-xl border border-dashed border-white/20 bg-midnight/50 p-5 text-center transition hover:border-accent/60 hover:bg-accent/[0.04]"
    >
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => onFile(event.target.files?.[0] || null)}
      />
      {file ? (
        <span className="grid justify-items-center gap-2">
          {file.type.startsWith("image/") ? (
            <img src={previewUrl} alt="" className="h-14 w-20 rounded-lg object-cover" />
          ) : <FileCheck2 size={25} className="text-accent" />}
          <span className="max-w-48 truncate text-xs font-medium text-slate-200">{file.name}</span>
          <span className="text-[11px] text-slate-500">Choose a different file</span>
        </span>
      ) : (
        <span className="grid justify-items-center gap-2">
          <UploadCloud size={25} className="text-accent transition group-hover:-translate-y-0.5" />
          <span className="text-sm font-medium text-slate-200">{title}</span>
          <span className="text-xs text-slate-500">Drop a file here or browse · image/PDF, up to 5 MB</span>
        </span>
      )}
    </label>
  );
}

function StatusTimeline({ status }) {
  const steps = [
    { key: "submitted", label: "Documents submitted" },
    { key: "pending", label: "Admin review" },
    { key: "approved", label: "Verified" }
  ];
  const activeIndex = status === "approved" ? 2 : status === "pending" ? 1 : 0;

  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li key={step.key} className={`flex items-center gap-2 text-xs ${index <= activeIndex ? "text-accent" : "text-slate-500"}`}>
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${index <= activeIndex ? "border-accent/40 bg-accent/10" : "border-white/10"}`}>
            {index < activeIndex ? <Check size={13} /> : index + 1}
          </span>
          {step.label}
        </li>
      ))}
    </ol>
  );
}

export default function Verification() {
  const [services, setServices] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [idProof, setIdProof] = useState(null);
  const [addressProof, setAddressProof] = useState(null);
  const [skills, setSkills] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get("/services?limit=50"),
      api.get("/providers/verification/status")
    ]).then(([serviceResponse, statusResponse]) => {
      if (!active) return;
      setServices(serviceResponse.data.services);
      setStatus(statusResponse.data.verification);
      setSkills((statusResponse.data.verification?.skills || []).map((skill) => ({
        service: skill.service?._id || skill.service,
        yearsExperience: skill.yearsExperience
      })));
    }).catch((error) => {
      if (active) toast.error(error.response?.data?.message || "Verification information could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function updateSkill(index, field, value) {
    setSkills((current) => current.map((skill, skillIndex) => (
      skillIndex === index ? { ...skill, [field]: value } : skill
    )));
  }

  function chooseCertificate(index, file) {
    setSkills((current) => current.map((skill, skillIndex) => (
      skillIndex === index ? { ...skill, certificate: file } : skill
    )));
  }

  function addSkill() {
    setSkills((current) => [...current, { service: "", yearsExperience: 0, certificate: null }]);
  }

  async function submit(event) {
    event.preventDefault();
    if (!idProof || !addressProof) {
      toast.error("Upload both your ID proof and address proof.");
      return;
    }
    if (skills.some((skill) => !skill.service || !skill.certificate)) {
      toast.error("Select a service and upload a certificate for every skill.");
      return;
    }

    const formData = new FormData();
    formData.append("idProof", idProof);
    formData.append("addressProof", addressProof);
    formData.append("skills", JSON.stringify(skills.map(({ service, yearsExperience }) => ({
      service,
      yearsExperience: Number(yearsExperience)
    }))));
    skills.forEach((skill) => formData.append("certificates", skill.certificate));

    setSaving(true);
    try {
      const { data } = await api.post("/providers/verification", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setStatus(data.verification);
      toast.success("Verification submitted for review.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to submit your verification.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-bold tracking-[0.26em] text-accent">PROVIDER ONBOARDING</p>
        <h1 className="mt-3 text-3xl font-semibold">Get verified</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Share your identity and skill documents. Our team will review them before verified badges appear on your profile.</p>
        {loading ? <div className="grid min-h-60 place-items-center"><Spinner label="Loading verification details" /></div> : (
          <div className="mt-8 grid gap-6">
            <Card className="grid gap-5 p-6 sm:p-8">
              <div className="flex items-center gap-3"><FileCheck2 size={20} className="text-accent" /><h2 className="text-lg font-semibold">Verification status</h2></div>
              <StatusTimeline status={status?.status || "none"} />
              {status?.status === "rejected" && (
                <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-400/5 p-4 text-sm text-rose-200">
                  Your documents need an update. {status.adminNote}
                </p>
              )}
              {status?.status === "pending" && <p className="text-sm text-amber-200">Your documents are in the review queue.</p>}
              {status?.status === "approved" && <p className="text-sm text-emerald-200">Your identity has been verified. Thanks for helping customers book with confidence.</p>}
            </Card>
            <form onSubmit={submit} className="grid gap-6">
              <Card className="grid gap-5 p-6 sm:p-8">
                <div><h2 className="text-lg font-semibold">Identity & address</h2><p className="mt-1 text-sm text-slate-400">Documents are only used for verification.</p></div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FileDrop title="Government ID proof" file={idProof} onFile={setIdProof} />
                  <FileDrop title="Address proof" file={addressProof} onFile={setAddressProof} />
                </div>
              </Card>
              <Card className="grid gap-5 p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="text-lg font-semibold">Your skills</h2><p className="mt-1 text-sm text-slate-400">Attach one certificate file for each selected service.</p></div>
                  <Button type="button" variant="secondary" onClick={addSkill}>Add a skill</Button>
                </div>
                {skills.map((skill, index) => (
                  <section key={index} className="grid gap-4 rounded-xl border border-white/10 bg-midnight/40 p-4">
                    <div className="grid gap-4 sm:grid-cols-[1fr_170px_auto] sm:items-end">
                      <label className="grid gap-2 text-sm font-medium text-slate-200">
                        Service
                        <select value={skill.service} onChange={(event) => updateSkill(index, "service", event.target.value)} required className="w-full rounded-xl border border-white/10 bg-midnight px-3 py-3 text-sm text-white outline-none focus:border-accent/60">
                          <option value="">Choose a service</option>
                          {services.map((service) => <option key={service._id} value={service._id}>{service.title}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-200">Years experience
                        <input type="number" min="0" max="60" value={skill.yearsExperience} onChange={(event) => updateSkill(index, "yearsExperience", event.target.value)} required className="w-full rounded-xl border border-white/10 bg-midnight px-3 py-3 text-sm text-white outline-none focus:border-accent/60" />
                      </label>
                      <Button type="button" variant="ghost" onClick={() => setSkills((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
                    </div>
                    <FileDrop title="Skill certificate" file={skill.certificate} onFile={(file) => chooseCertificate(index, file)} />
                  </section>
                ))}
                {!skills.length && <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-midnight/40 p-4 text-sm text-slate-400"><FileImage size={18} className="text-accent" /> You can submit your identity documents now and add skills later.</div>}
                <Button type="submit" disabled={saving} className="w-full sm:w-fit">{saving ? "Submitting…" : status?.status === "rejected" ? "Resubmit for review" : "Submit for verification"}</Button>
              </Card>
            </form>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
