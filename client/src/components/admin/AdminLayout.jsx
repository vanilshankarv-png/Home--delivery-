import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, BriefcaseBusiness, FileCheck2, FolderCog, Gavel, Users } from "lucide-react";
import Navbar from "../ui/Navbar.jsx";

const links = [
  { to: "/admin", label: "Overview", icon: BarChart3, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/verifications", label: "Verifications", icon: FileCheck2 },
  { to: "/admin/disputes", label: "Disputes", icon: Gavel },
  { to: "/admin/services", label: "Services & categories", icon: BriefcaseBusiness },
  { to: "/admin/pricing", label: "Pricing rules", icon: FolderCog }
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-midnight text-white">
      <Navbar />
      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-2xl border border-white/[0.08] bg-panel/60 p-3 lg:sticky lg:top-5">
          <p className="px-3 pb-3 pt-2 text-[10px] font-bold tracking-[0.24em] text-accent">ADMIN CONSOLE</p>
          <nav aria-label="Admin navigation" className="flex gap-1 overflow-x-auto lg:grid">
            {links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `inline-flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isActive ? "bg-accent/10 text-accent" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon size={16} />{label}</NavLink>)}
          </nav>
        </aside>
        <div className="min-w-0"><Outlet /></div>
      </div>
    </div>
  );
}
