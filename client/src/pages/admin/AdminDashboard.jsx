import { useEffect, useState } from "react";
import { Activity, BadgeCheck, CalendarDays, CircleDollarSign, Star, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../../api/axios.js";
import Card from "../../components/ui/Card.jsx";
import Spinner from "../../components/ui/Spinner.jsx";

const COLORS = ["#35d9f2", "#67e8a5", "#a78bfa", "#fbbf24", "#fb7185", "#60a5fa", "#f97316", "#c084fc", "#94a3b8"];
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/admin/dashboard")
      .then(({ data: result }) => setData(result))
      .catch((requestError) => setError(requestError.response?.data?.message || "Dashboard data could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="grid min-h-96 place-items-center"><Spinner label="Loading admin dashboard" /></div>;
  if (error) return <p role="alert" className="rounded-xl bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>;
  if (!data) return null;

  const { kpis } = data;
  const statusData = Object.entries(data.bookingsByStatus).map(([name, value]) => ({ name: name.replaceAll("_", " "), value })).filter((item) => item.value > 0);
  const revenueData = [
    { period: "Today", revenue: kpis.revenue.today },
    { period: "This week", revenue: kpis.revenue.week },
    { period: "This month", revenue: kpis.revenue.month }
  ];
  const cards = [
    { label: "Total users", value: kpis.totalUsers, icon: Users, color: "text-cyan-200" },
    { label: "Providers", value: kpis.totalProviders, icon: BadgeCheck, color: "text-emerald-200" },
    { label: "Pending verifications", value: kpis.pendingVerifications, icon: Activity, color: "text-amber-200" },
    { label: "Average rating", value: `${Number(kpis.averageRating).toFixed(1)} / 5`, icon: Star, color: "text-violet-200" }
  ];

  return (
    <div>
      <p className="text-xs font-bold tracking-[0.24em] text-accent">OPERATIONS</p><h1 className="mt-2 text-3xl font-semibold">Admin dashboard</h1><p className="mt-2 text-sm text-slate-400">Platform performance and service activity.</p>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon, color }) => <Card key={label} className="p-5"><span className={`grid h-10 w-10 place-items-center rounded-xl bg-white/5 ${color}`}><Icon size={19} /></span><p className="mt-4 text-sm text-slate-400">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></Card>)}</section>
      <Card className="mt-5 p-5"><div className="flex items-center gap-2"><CircleDollarSign size={18} className="text-accent" /><h2 className="font-semibold">Net revenue</h2></div><div className="mt-2 grid grid-cols-3 gap-3">{revenueData.map(({ period, revenue }) => <div key={period}><p className="text-xs text-slate-500">{period}</p><p className="mt-1 text-lg font-semibold">{money(revenue)}</p></div>)}</div></Card>
      <section className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className="p-5"><div className="flex items-center gap-2"><CalendarDays size={17} className="text-accent" /><h2 className="font-semibold">Bookings · last 30 days</h2></div><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.bookingsPerDay}><CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} /><XAxis dataKey="date" tickFormatter={(date) => date.slice(5)} minTickGap={24} stroke="#94a3b8" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} stroke="#94a3b8" tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12 }} /><Line type="monotone" dataKey="bookings" stroke="#35d9f2" strokeWidth={2} dot={false} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div></Card>
        <Card className="p-5"><h2 className="font-semibold">Bookings by status</h2><div className="mt-3 h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={3}>{statusData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12 }} /></PieChart></ResponsiveContainer></div><div className="flex flex-wrap gap-x-3 gap-y-2">{statusData.map((item, index) => <span key={item.name} className="inline-flex items-center gap-1.5 text-[10px] text-slate-400"><i className="h-2 w-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />{item.name} · {item.value}</span>)}</div></Card>
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5"><h2 className="font-semibold">Revenue trend</h2><div className="mt-4 h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={revenueData}><CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} /><XAxis dataKey="period" stroke="#94a3b8" tickLine={false} axisLine={false} /><YAxis tickFormatter={(value) => `₹${value}`} stroke="#94a3b8" tickLine={false} axisLine={false} /><Tooltip formatter={(value) => money(value)} contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12 }} /><Bar dataKey="revenue" fill="#a78bfa" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card className="p-5"><h2 className="font-semibold">Top services</h2><div className="mt-4 h-60">{data.topServices.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={data.topServices}><CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} /><XAxis dataKey="title" tickFormatter={(value) => value?.length > 12 ? `${value.slice(0, 12)}…` : value} stroke="#94a3b8" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} stroke="#94a3b8" tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12 }} /><Area type="monotone" dataKey="bookings" stroke="#67e8a5" fill="#67e8a533" /></AreaChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-slate-500">No booking data yet.</div>}</div></Card>
      </section>
    </div>
  );
}
