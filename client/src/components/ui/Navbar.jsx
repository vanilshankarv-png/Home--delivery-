import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  CalendarDays,
  CreditCard,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  ShieldAlert,
  UserRound,
  Wrench,
  X
} from "lucide-react";
import Button from "./Button.jsx";
import { logout } from "../../store/authSlice.js";
import api from "../../api/axios.js";
import socket from "../../socket/socket.js";

const roleLinks = {
  customer: [
    { to: "/services", label: "Services", section: "services", icon: Wrench },
    { to: "/my-home", label: "My Home", section: "home", icon: Home },
    { to: "/my-bookings", label: "My Bookings", section: "bookings", icon: CalendarDays },
    { to: "/payments", label: "Payments", section: "payments", icon: CreditCard },
    { to: "/disputes", label: "Disputes", section: "disputes", icon: ShieldAlert },
    { to: "/inbox", label: "Inbox", section: "inbox", icon: MessageCircle },
    { to: "/profile", label: "Profile", section: "profile", icon: UserRound }
  ],
  provider: [
    { to: "/services", label: "Services", section: "services", icon: Wrench },
    { to: "/provider/jobs", label: "Jobs", section: "jobs", icon: Wrench },
    { to: "/provider/earnings", label: "Earnings", section: "earnings", icon: CreditCard },
    { to: "/disputes", label: "Disputes", section: "disputes", icon: ShieldAlert },
    { to: "/provider/verification", label: "Verification", section: "verification", icon: ShieldAlert },
    { to: "/provider/skills", label: "My skills", section: "skills", icon: Home },
    { to: "/inbox", label: "Inbox", section: "inbox", icon: MessageCircle }
  ],
  admin: [
    { to: "/services", label: "Services", section: "services", icon: Wrench },
    { to: "/admin", label: "Admin dashboard", section: "admin", icon: Home },
    { to: "/admin/users", label: "Users", section: "users", icon: UserRound }
  ]
};

function isSectionActive(section, pathname) {
  if (section === "services") {
    return pathname === "/app" || pathname === "/services" || pathname === "/search" || pathname.startsWith("/services/");
  }
  if (section === "home") return pathname === "/customer" || pathname === "/my-home";
  if (section === "bookings") return pathname === "/bookings" || pathname.startsWith("/bookings/") || pathname === "/my-bookings";
  if (section === "payments") return pathname === "/payments" || pathname.startsWith("/payments/");
  if (section === "profile") return pathname === "/profile";
  if (section === "inbox") return pathname === "/inbox" || pathname.startsWith("/inbox/");
  if (section === "disputes") return pathname === "/disputes" || pathname.startsWith("/disputes/");
  return pathname === section || pathname.startsWith(`${section}/`);
}

export default function Navbar() {
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const links = roleLinks[user?.role] || [roleLinks.customer[0]];
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!token) {
      setUnreadCount(0);
      return undefined;
    }
    let mounted = true;
    const refreshUnread = async () => {
      try {
        const { data } = await api.get("/chats");
        if (mounted) setUnreadCount(data.conversations.reduce((total, conversation) => total + conversation.unreadCount, 0));
      } catch (error) {
        if (mounted && error.response?.status !== 401) {
          console.error("Unable to load unread chat count:", error);
        }
      }
    };
    const onChatChange = () => { void refreshUnread(); };
    if (!socket.connected) socket.connect();
    socket.on("connect", onChatChange);
    socket.on("chat:notification", onChatChange);
    socket.on("chat:read", onChatChange);
    socket.on("chat:deleted", onChatChange);
    void refreshUnread();
    return () => {
      mounted = false;
      socket.off("connect", onChatChange);
      socket.off("chat:notification", onChatChange);
      socket.off("chat:read", onChatChange);
      socket.off("chat:deleted", onChatChange);
    };
  }, [token]);

  function renderLink(link, compact = false) {
    const Icon = link.icon;
    const active = isSectionActive(link.section, pathname);
    return (
      <NavLink
        key={link.to}
        to={link.to}
        data-section={link.section}
        aria-current={active ? "page" : undefined}
        className={`nav-section-link ${active ? "nav-section-link-active" : ""} ${compact ? "nav-section-link-mobile" : ""}`}
        onClick={() => setMobileOpen(false)}
      >
        <Icon size={16} aria-hidden="true" />
        <span>{link.label}</span>
        {link.section === "inbox" && unreadCount > 0 && (
          <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-midnight">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </NavLink>
    );
  }

  return (
    <header className="relative z-20 border-b border-white/[0.07] bg-midnight/80 backdrop-blur-xl">
      <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link to="/app" className="inline-flex shrink-0 items-center gap-3 font-semibold tracking-wide text-white">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-accent/20 bg-accent/10 text-accent"><Home size={19} /></span>
          <span>HOME <span className="text-accent">DELIVERY</span></span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-end gap-1 xl:flex">
          {links.map((link) => renderLink(link))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <>
              {user.role !== "customer" && (
                <NavLink
                  to="/profile"
                  aria-label="Profile"
                  data-section="profile"
                  aria-current={isSectionActive("profile", pathname) ? "page" : undefined}
                  className={`nav-account-link ${isSectionActive("profile", pathname) ? "nav-section-link-active" : ""}`}
                >
                  <UserRound size={16} /><span className="hidden xl:inline">Profile</span>
                </NavLink>
              )}
              <button
                type="button"
                onClick={() => { socket.disconnect(); dispatch(logout()); navigate("/login"); }}
                aria-label="Sign out"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <Link to="/login"><Button className="px-4 py-2 text-sm">Sign in</Button></Link>
          )}
          <button
            type="button"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-slate-200 transition hover:border-accent/30 hover:bg-white/5 xl:hidden"
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </nav>
      {mobileOpen && (
        <div id="mobile-navigation" className="border-t border-white/[0.07] bg-midnight/95 px-4 py-3 xl:hidden">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 sm:grid-cols-3">
            {links.map((link) => renderLink(link, true))}
            {user && user.role !== "customer" && renderLink({ to: "/profile", label: "Profile", section: "profile", icon: UserRound }, true)}
          </div>
        </div>
      )}
    </header>
  );
}
