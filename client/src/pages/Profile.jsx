import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/axios.js";
import Navbar from "../components/ui/Navbar.jsx";
import Footer from "../components/ui/Footer.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import { updateUser } from "../store/authSlice.js";
import BadgeChip from "../components/ui/BadgeChip.jsx";

function blankAddress() {
  return { label: "", line1: "", city: "", pincode: "" };
}

export default function Profile() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [form, setForm] = useState({ name: "", phone: "", avatar: "", address: [], isAvailable: false });
  const [loading, setLoading] = useState(false);
  const [badges, setBadges] = useState([]);

  useEffect(() => {
    setForm({
      name: user?.name || "",
      phone: user?.phone || "",
      avatar: user?.avatar || "",
      address: user?.address || [],
      isAvailable: Boolean(user?.isAvailable)
    });
  }, [user]);

  useEffect(() => {
    let active = true;
    if (user?.role !== "provider" || !user?._id) {
      setBadges([]);
      return () => { active = false; };
    }

    api.get(`/providers/${user._id}/badges`)
      .then(({ data }) => { if (active) setBadges(data.provider.badges || []); })
      .catch((error) => toast.error(error.response?.data?.message || "Provider badges could not be loaded."));
    return () => { active = false; };
  }, [user?._id, user?.role]);

  function updateAddress(index, field, value) {
    setForm((current) => ({
      ...current,
      address: current.address.map((address, addressIndex) => (
        addressIndex === index ? { ...address, [field]: value } : address
      ))
    }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (user?.role !== "provider") delete payload.isAvailable;
      const { data } = await api.put("/users/profile", payload);
      dispatch(updateUser(data.user));
      toast.success("Profile saved.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save your profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-12 sm:px-8">
        <p className="text-xs font-bold tracking-[0.28em] text-accent">YOUR ACCOUNT</p>
        <h1 className="mt-3 text-3xl font-semibold">Profile & preferences</h1>
        <p className="mt-2 text-sm text-slate-400">Keep your contact details and saved home addresses up to date.</p>
        <form onSubmit={saveProfile} className="mt-8 grid gap-6">
          {user?.role === "provider" && (
            <Card className="p-6 sm:p-8">
              <h2 className="font-semibold">Your verified badges</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {badges.map((badge, index) => <BadgeChip key={`${badge.name}-${index}`} badge={badge} />)}
                {!badges.length && <p className="text-sm text-slate-500">Badges appear after your verification is approved.</p>}
              </div>
            </Card>
          )}
          <Card className="grid gap-5 p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Personal details</h2>
            <Input label="Full name" name="name" autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} />
            <Input label="Phone number" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
            <Input label="Avatar URL" name="avatar" type="url" placeholder="https://example.com/photo.jpg" value={form.avatar} onChange={(event) => setForm({ ...form, avatar: event.target.value })} />
            <div className="grid gap-1">
              <span className="text-sm font-medium text-slate-200">Email address</span>
              <span className="text-sm text-slate-400">{user?.email}</span>
            </div>
            {user?.role === "provider" && (
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-midnight/50 p-4">
                <span><span className="block text-sm font-medium">Available for new jobs</span><span className="mt-1 block text-xs text-slate-400">Let customers know when you're ready to take bookings.</span></span>
                <input type="checkbox" checked={form.isAvailable} onChange={(event) => setForm({ ...form, isAvailable: event.target.checked })} className="h-5 w-5 accent-cyan-400" />
              </label>
            )}
          </Card>
          <Card className="grid gap-5 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-semibold">Saved addresses</h2><p className="mt-1 text-sm text-slate-400">Add the places where you need service.</p></div>
              <Button type="button" variant="secondary" onClick={() => setForm({ ...form, address: [...form.address, blankAddress()] })}><Plus size={16} /> Add address</Button>
            </div>
            {form.address.map((address, index) => (
              <section key={index} className="grid gap-4 rounded-xl border border-white/10 bg-midnight/40 p-4 sm:grid-cols-2">
                <div className="flex items-center justify-between sm:col-span-2">
                  <h3 className="text-sm font-semibold text-slate-200">Address {index + 1}</h3>
                  <button type="button" aria-label={`Remove address ${index + 1}`} onClick={() => setForm({ ...form, address: form.address.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-lg p-2 text-slate-400 hover:bg-rose-400/10 hover:text-rose-300"><Trash2 size={16} /></button>
                </div>
                <Input label="Label" placeholder="Home, work…" value={address.label || ""} onChange={(event) => updateAddress(index, "label", event.target.value)} />
                <Input label="Street address" value={address.line1 || ""} onChange={(event) => updateAddress(index, "line1", event.target.value)} required />
                <Input label="City" value={address.city || ""} onChange={(event) => updateAddress(index, "city", event.target.value)} required />
                <Input label="Postal / ZIP code" value={address.pincode || ""} onChange={(event) => updateAddress(index, "pincode", event.target.value)} required />
              </section>
            ))}
            {!form.address.length && <p className="text-sm text-slate-500">No saved addresses yet.</p>}
          </Card>
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save profile"}</Button>
            <Link to="/app" className="text-sm text-slate-400 hover:text-white">Back to services</Link>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}
