import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import AuthShell from "../components/auth/AuthShell.jsx";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import { login } from "../store/authSlice.js";
import api from "../api/axios.js";
import { roleHome } from "../components/auth/RoleRoute.jsx";

const initialForm = { name: "", email: "", phone: "", password: "", role: "customer" };

export default function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrors((current) => ({ ...current, [event.target.name]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (form.name.trim().length < 2) nextErrors.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Enter a valid email address.";
    if (!/^[+]?[\d\s().-]{7,24}$/.test(form.phone)) nextErrors.phone = "Enter a valid phone number.";
    if (form.password.length < 8) nextErrors.password = "Use at least 8 characters.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", form);
      dispatch(login({ user: data.user, token: data.token }));
      toast.success("Your account is ready.");
      navigate(roleHome(data.user.role), { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="MAKE YOURSELF AT HOME" title="Let's get you started." description="Join as a customer or offer your skills as a home-service professional.">
      <form onSubmit={submit} noValidate className="grid gap-4">
        <Input label="Full name" name="name" autoComplete="name" placeholder="Your name" value={form.name} onChange={updateField} error={errors.name} />
        <Input label="Email address" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={updateField} error={errors.email} />
        <Input label="Phone number" name="phone" type="tel" autoComplete="tel" placeholder="+1 555 012 3456" value={form.phone} onChange={updateField} error={errors.phone} />
        <Input label="Password" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={updateField} error={errors.password} />
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium text-slate-200">I want to join as a</legend>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "customer", label: "Customer", detail: "Book home services" },
              { value: "provider", label: "Service provider", detail: "Offer your skills" }
            ].map((option) => (
              <label key={option.value} className={`cursor-pointer rounded-xl border p-3 transition ${form.role === option.value ? "border-accent/50 bg-accent/[0.08]" : "border-white/10 bg-midnight/50 hover:border-white/20"}`}>
                <input className="sr-only" type="radio" name="role" value={option.value} checked={form.role === option.value} onChange={updateField} />
                <span className="block text-sm font-semibold text-white">{option.label}</span>
                <span className="mt-1 block text-xs text-slate-400">{option.detail}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" disabled={loading} className="mt-1 w-full">{loading ? "Creating account…" : "Create account"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">
        Already have an account? <Link to="/login" className="font-semibold text-accent hover:text-white">Sign in</Link>
      </p>
    </AuthShell>
  );
}
