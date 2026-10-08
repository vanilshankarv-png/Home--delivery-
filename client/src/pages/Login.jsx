import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import AuthShell from "../components/auth/AuthShell.jsx";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import { login } from "../store/authSlice.js";
import api from "../api/axios.js";
import { roleHome } from "../components/auth/RoleRoute.jsx";

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrors((current) => ({ ...current, [event.target.name]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Enter a valid email address.";
    if (!form.password) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", form);
      dispatch(login({ user: data.user, token: data.token }));
      toast.success("Welcome back.");
      navigate(location.state?.from?.pathname || roleHome(data.user.role), { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="WELCOME BACK" title="Good to have you home." description="Sign in to book trusted help or manage your home-service work.">
      <form onSubmit={submit} noValidate className="grid gap-5">
        <Input label="Email address" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={updateField} error={errors.email} />
        <Input label="Password" name="password" type="password" autoComplete="current-password" placeholder="Your password" value={form.password} onChange={updateField} error={errors.password} />
        <Button type="submit" disabled={loading} className="mt-1 w-full">{loading ? "Signing in…" : "Sign in"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">
        New to Home Delivery? <Link to="/register" className="font-semibold text-accent hover:text-white">Create an account</Link>
      </p>
    </AuthShell>
  );
}
