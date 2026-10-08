import { useEffect, useState } from "react";
import { Search, Shield, ShieldOff } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      api.get("/admin/users", { params: { search: query, role, status, page, limit: 20 } })
        .then(({ data }) => {
          if (!active) return;
          setUsers(data.users);
          setPages(data.pagination.pages);
          setError("");
        })
        .catch((requestError) => { if (active) setError(requestError.response?.data?.message || "Users could not be loaded."); })
        .finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, role, status, page]);

  async function toggleBlock(user) {
    setBusy(user._id);
    try {
      const { data } = await api.put(`/admin/users/${user._id}/status`, { isBlocked: !user.isBlocked });
      setUsers((current) => current.map((item) => item._id === user._id ? { ...item, isBlocked: data.user.isBlocked } : item));
      toast.success(data.user.isBlocked ? `${user.name} blocked; ${data.cancelledBookings} booking(s) cancelled.` : `${user.name} unblocked.`);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "User status could not be updated.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div><p className="text-xs font-bold tracking-[0.24em] text-accent">ADMIN CONSOLE</p><h1 className="mt-2 text-3xl font-semibold">Users</h1><p className="mt-2 text-sm text-slate-400">Search accounts, inspect roles and manage account access.</p>
      <Card className="mt-6 flex flex-col gap-3 p-4 sm:flex-row"><label className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 px-3"><Search size={16} className="text-slate-500" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, email, or phone" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-500" /></label><select aria-label="Filter by role" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} className="rounded-xl border border-white/10 bg-midnight px-3 py-3 text-sm"><option value="">All roles</option><option value="customer">Customer</option><option value="provider">Provider</option><option value="admin">Admin</option></select><select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-xl border border-white/10 bg-midnight px-3 py-3 text-sm"><option value="">All statuses</option><option value="active">Active</option><option value="blocked">Blocked</option></select></Card>
      {error ? <p role="alert" className="mt-5 rounded-xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p> : loading ? <div className="grid min-h-64 place-items-center"><Spinner label="Loading users" /></div> : <Card className="mt-5 overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">User</th><th className="px-5 py-4">Role</th><th className="px-5 py-4">Joined</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{users.map((user) => <tr key={user._id}><td className="px-5 py-4"><p className="font-medium">{user.name}</p><p className="mt-1 text-xs text-slate-500">{user.email} · {user.phone}</p></td><td className="px-5 py-4 capitalize text-slate-300">{user.role}</td><td className="px-5 py-4 text-slate-400">{new Date(user.createdAt).toLocaleDateString()}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${user.isBlocked ? "bg-rose-400/10 text-rose-200" : "bg-emerald-400/10 text-emerald-200"}`}>{user.isBlocked ? "Blocked" : "Active"}</span></td><td className="px-5 py-4 text-right"><Button variant="secondary" disabled={busy === user._id || user.role === "admin"} onClick={() => toggleBlock(user)} className="px-3 py-2 text-xs">{user.isBlocked ? <Shield size={14} /> : <ShieldOff size={14} />}{user.isBlocked ? "Unblock" : "Block"}</Button></td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-xs text-slate-500"><span>Page {page} of {Math.max(1, pages)}</span><div className="flex gap-2"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-2 text-xs">Previous</Button><Button variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-3 py-2 text-xs">Next</Button></div></div></Card>}
    </div>
  );
}
