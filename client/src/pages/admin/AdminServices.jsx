import { useEffect, useState } from "react";
import { Layers3, Plus, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

const initialForm = { kind: "service", id: "", title: "", name: "", slug: "", icon: "Wrench", category: "", description: "", basePrice: "", durationMins: "60", unit: "per visit", tags: "", isActive: true };

export default function AdminServices() {
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);

  async function loadCatalog() {
    try {
      const [categoryResponse, serviceResponse] = await Promise.all([
        api.get("/categories"),
        api.get("/services", { params: { limit: 100 } })
      ]);
      setCategories(categoryResponse.data.categories);
      setServices(serviceResponse.data.services);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Catalog could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadCatalog(); }, []);

  function edit(item, kind) {
    if (kind === "category") {
      setForm({ ...initialForm, kind, id: item._id, name: item.name, slug: item.slug, icon: item.icon, description: item.description || "" });
    } else {
      setForm({ ...initialForm, kind, id: item._id, title: item.title, category: item.category?._id || item.category, description: item.description, basePrice: String(item.basePrice), durationMins: String(item.durationMins), unit: item.unit, tags: (item.tags || []).join(", "), isActive: item.isActive });
    }
    setImages([]);
    setOpen(true);
  }

  function create(kind) {
    setForm({ ...initialForm, kind });
    setImages([]);
    setOpen(true);
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    const formData = new FormData();
    formData.append("kind", form.kind);
    if (form.id) formData.append("id", form.id);
    if (form.kind === "category") {
      ["name", "slug", "icon", "description"].forEach((field) => formData.append(field, form[field]));
    } else {
      ["title", "category", "description", "basePrice", "durationMins", "unit"].forEach((field) => formData.append(field, form[field]));
      formData.append("tags", JSON.stringify(form.tags.split(",").map((tag) => tag.trim()).filter(Boolean)));
      formData.append("isActive", String(form.isActive));
      images.forEach((image) => formData.append("images", image));
    }
    try {
      await api.post("/admin/services", formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${form.kind === "category" ? "Category" : "Service"} saved.`);
      setOpen(false);
      await loadCatalog();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Catalog item could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div><p className="text-xs font-bold tracking-[0.24em] text-accent">ADMIN CONSOLE</p><h1 className="mt-2 text-3xl font-semibold">Services & categories</h1><p className="mt-2 text-sm text-slate-400">Create or edit catalog entries and service images.</p>
      <div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => create("service")}><Plus size={15} /> New service</Button><Button variant="secondary" onClick={() => create("category")}><Plus size={15} /> New category</Button></div>
      {error ? <p role="alert" className="mt-5 rounded-xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p> : loading ? <div className="grid min-h-64 place-items-center"><Spinner label="Loading catalog" /></div> : <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section><h2 className="mb-3 inline-flex items-center gap-2 font-semibold"><Layers3 size={17} className="text-accent" /> Categories</h2><div className="grid gap-3">{categories.map((category) => <Card key={category._id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-medium">{category.name}</p><p className="mt-1 text-xs text-slate-500">{category.slug} · {category.icon}</p></div><Button variant="secondary" onClick={() => edit(category, "category")} className="px-3 py-2 text-xs">Edit</Button></Card>)}</div></section>
        <section><h2 className="mb-3 inline-flex items-center gap-2 font-semibold"><Wrench size={17} className="text-accent" /> Services</h2><div className="grid gap-3">{services.map((service) => <Card key={service._id} className="flex items-center justify-between gap-3 p-4"><div className="flex min-w-0 items-center gap-3">{service.images?.[0] && <img src={service.images[0]} alt="" className="h-12 w-12 rounded-lg object-cover" />}<div className="min-w-0"><p className="truncate font-medium">{service.title}</p><p className="mt-1 truncate text-xs text-slate-500">{service.category?.name || "Category"} · ₹{service.basePrice} · {service.isActive ? "Active" : "Inactive"}</p></div></div><Button variant="secondary" onClick={() => edit(service, "service")} className="px-3 py-2 text-xs">Edit</Button></Card>)}</div></section>
      </div>}
      <Modal open={open} onClose={() => setOpen(false)} title={`${form.id ? "Edit" : "Create"} ${form.kind}`}>
        <form onSubmit={save} className="grid max-h-[75vh] gap-4 overflow-y-auto pr-1">
          <label className="grid gap-2 text-sm text-slate-300">Entry type<select value={form.kind} onChange={(event) => setForm({ ...initialForm, kind: event.target.value })} className="rounded-xl border border-white/10 bg-midnight px-4 py-3 text-white"><option value="service">Service</option><option value="category">Category</option></select></label>
          {form.kind === "category" ? <><Input label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /><Input label="Slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase().replace(/\s+/g, "-") })} required /><Input label="Icon name" value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })} /><Input label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /> </> : <>
            <Input label="Service title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            <label className="grid gap-2 text-sm text-slate-300">Category<select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="rounded-xl border border-white/10 bg-midnight px-4 py-3 text-white"><option value="">Select category</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-medium text-slate-200">Description<textarea required maxLength={2000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="rounded-xl border border-white/10 bg-midnight/70 px-4 py-3 text-sm text-white outline-none focus:border-accent/60" /></label>
            <div className="grid gap-3 sm:grid-cols-2"><Input label="Base price (₹)" type="number" min="0" step="0.01" value={form.basePrice} onChange={(event) => setForm({ ...form, basePrice: event.target.value })} required /><Input label="Duration (minutes)" type="number" min="15" value={form.durationMins} onChange={(event) => setForm({ ...form, durationMins: event.target.value })} required /></div>
            <label className="grid gap-2 text-sm text-slate-300">Unit<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} className="rounded-xl border border-white/10 bg-midnight px-4 py-3 text-white"><option>per visit</option><option>per hour</option></select></label>
            <Input label="Tags (comma separated)" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
            <label className="grid gap-2 text-sm text-slate-300">Images (up to 5)<input type="file" accept="image/*" multiple onChange={(event) => setImages(Array.from(event.target.files || []).slice(0, 5))} className="text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:text-white" />{images.length > 0 && <span className="text-xs text-slate-500">{images.map((image) => image.name).join(", ")}</span>}</label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="accent-accent" />Service is active</label>
          </>}
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </form>
      </Modal>
    </div>
  );
}
