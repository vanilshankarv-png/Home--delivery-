import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { divIcon } from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { ArrowLeft, Check, MessageCircle, Phone, Radio } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import socket from "../../socket/socket.js";
import { useSelector } from "react-redux";
import Navbar from "../../components/ui/Navbar.jsx";
import Footer from "../../components/ui/Footer.jsx";
import Card from "../../components/ui/Card.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { BookingStatus } from "./MyBookings.jsx";
import ChatBox from "../../components/chat/ChatBox.jsx";
import "leaflet/dist/leaflet.css";

const providerIcon = divIcon({
  className: "",
  html: "<span class='live-map-provider'>➤</span>",
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});
const destinationIcon = divIcon({
  className: "",
  html: "<span class='live-map-destination'>⌂</span>",
  iconSize: [34, 34],
  iconAnchor: [17, 17]
});

function RecenterMap({ point }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.panTo(point, { animate: true, duration: 0.8 });
  }, [map, point]);
  return null;
}

function StatusTimeline({ booking }) {
  return (
    <ol className="mt-4 space-y-3">
      {(booking.timeline || []).map((item, index) => (
        <motion.li key={`${item.status}-${item.at}-${index}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
          <span className="grid h-6 w-6 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent"><Check size={13} /></span>
          <span className="min-w-0 flex-1 text-sm text-slate-200">{String(item.status).replaceAll("_", " ")}</span>
          <time className="text-right text-[11px] text-slate-500">{new Date(item.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
        </motion.li>
      ))}
    </ol>
  );
}

export default function TrackBooking() {
  const { id } = useParams();
  const token = useSelector((state) => state.auth.token);
  const [booking, setBooking] = useState(null);
  const [points, setPoints] = useState([]);
  const [position, setPosition] = useState(null);
  const [eta, setEta] = useState(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loadedAt, setLoadedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const animationFrame = useRef(null);
  const animationTarget = useRef(null);
  const positionRef = useRef(null);

  const loadTracking = useCallback(async () => {
    try {
      const [{ data: bookingData }, historyResponse] = await Promise.all([
        api.get(`/bookings/${id}`),
        api.get(`/tracking/${id}/history`)
      ]);
      setBooking(bookingData.booking);
      setPoints(historyResponse.data.points || []);
      setTrackingActive(Boolean(historyResponse.data.isActive));
      const latest = historyResponse.data.points?.at(-1);
      if (latest) {
        const latestPosition = [latest.lat, latest.lng];
        positionRef.current = latestPosition;
        setPosition(latestPosition);
        setLastUpdate(new Date(latest.at).getTime());
        try {
          const { data: etaData } = await api.get(`/tracking/${id}/eta`);
          setEta(etaData);
        } catch (requestError) {
          if (requestError.response?.status !== 404) throw requestError;
        }
      }
      setLoadedAt(Date.now());
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Live tracking could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadTracking(); }, [loadTracking]);

  useEffect(() => {
    if (!token) return undefined;
    if (!socket.connected) socket.connect();
    const joinRoom = () => {
      socket.emit("join:booking", id, (result) => {
        if (!result?.success) toast.error(result?.message || "Live tracking updates are unavailable.");
        else void loadTracking();
      });
    };
    const receiveLocation = (update) => {
      if (!Number.isFinite(update.lat) || !Number.isFinite(update.lng)) return;
      const nextPosition = [update.lat, update.lng];
      animationTarget.current = {
        from: positionRef.current || nextPosition,
        to: nextPosition,
        startedAt: performance.now()
      };
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
      const interpolate = (timestamp) => {
        const target = animationTarget.current;
        if (!target) return;
        const progress = Math.min(1, (timestamp - target.startedAt) / 2800);
        const currentPosition = [
          target.from[0] + (target.to[0] - target.from[0]) * progress,
          target.from[1] + (target.to[1] - target.from[1]) * progress
        ];
        positionRef.current = currentPosition;
        setPosition(currentPosition);
        if (progress < 1) animationFrame.current = requestAnimationFrame(interpolate);
        else animationFrame.current = null;
      };
      animationFrame.current = requestAnimationFrame(interpolate);
      setPoints((current) => [...current, { lat: update.lat, lng: update.lng, at: new Date().toISOString() }]);
      setEta({ etaMinutes: update.etaMinutes ?? update.eta, distanceKm: update.distanceKm });
      setTrackingActive(true);
      setLastUpdate(Date.now());
    };
    const receiveBookingStatus = (updated) => {
      if (String(updated._id) === id) setBooking(updated);
    };
    const onConnect = () => joinRoom();
    const onDisconnect = () => setTrackingActive(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("location:update", receiveLocation);
    socket.on("booking:status", receiveBookingStatus);
    if (socket.connected) joinRoom();
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      clearInterval(timer);
      socket.emit("leave:booking", id);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("location:update", receiveLocation);
      socket.off("booking:status", receiveBookingStatus);
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, [id, token, loadTracking]);

  const destination = useMemo(() => {
    const coordinates = booking?.address?.location?.coordinates;
    return coordinates?.length === 2 ? [coordinates[1], coordinates[0]] : null;
  }, [booking]);
  const offline = now - (lastUpdate || loadedAt) > 30_000;
  const path = useMemo(() => {
    const breadcrumb = points.map((point) => [point.lat, point.lng]);
    if (position && (breadcrumb.length === 0
      || breadcrumb[breadcrumb.length - 1][0] !== position[0]
      || breadcrumb[breadcrumb.length - 1][1] !== position[1])) breadcrumb.push(position);
    return breadcrumb;
  }, [points, position]);
  const mapCenter = position || destination || [17.6868, 83.2185];
  const providerPhone = booking?.provider?.phone;

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <Link to={`/bookings/${id}`} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-accent"><ArrowLeft size={16} /> Booking details</Link>
        {loading ? <div className="grid min-h-64 place-items-center"><Spinner label="Loading live tracking" /></div> : error ? (
          <div role="alert" className="mt-6 rounded-xl border border-rose-300/20 bg-rose-400/5 p-5 text-sm text-rose-200">{error}</div>
        ) : booking ? (
          <div className="mt-7 grid items-start gap-6 lg:grid-cols-[1fr_340px]">
            <Card className="overflow-hidden p-2">
              {destination ? (
                <MapContainer center={mapCenter} zoom={14} scrollWheelZoom className="h-[58vh] min-h-[360px] w-full rounded-xl">
                  <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <RecenterMap point={position} />
                  <Marker position={destination} icon={destinationIcon} />
                  {position && <Marker position={position} icon={providerIcon} />}
                  {path.length > 1 && <Polyline positions={path} pathOptions={{ color: "#35d9f2", weight: 5, opacity: 0.8 }} />}
                </MapContainer>
              ) : <div className="grid h-[58vh] min-h-[360px] place-items-center rounded-xl bg-midnight/60 p-8 text-center text-sm text-slate-400">This booking does not have a destination map pin.</div>}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-xs">
                <span className="inline-flex items-center gap-2 text-slate-300"><Radio size={14} className={trackingActive && !offline ? "text-emerald-300" : "text-slate-500"} />{offline ? "Provider offline — no location update in 30 seconds" : trackingActive ? "Provider sharing live location" : "Waiting for provider location"}</span>
                {lastUpdate && <span className="text-slate-500">Updated {new Date(lastUpdate).toLocaleTimeString()}</span>}
              </div>
            </Card>
            <div className="grid gap-5">
              <Card className="p-6">
                <p className="text-xs font-bold tracking-[0.23em] text-accent">LIVE TRACKING</p>
                <div className="mt-3 flex items-center justify-between gap-3"><h1 className="text-xl font-semibold">{booking.service?.title || "Your booking"}</h1><BookingStatus status={booking.status} /></div>
                <p className="mt-2 text-sm text-slate-400">Provider: {booking.provider?.name || "Your professional"}</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-midnight/50 p-4"><p className="text-xs text-slate-500">ETA</p><p className="mt-1 text-xl font-semibold">{eta?.etaMinutes != null ? `${eta.etaMinutes} min` : "—"}</p></div>
                  <div className="rounded-xl border border-white/10 bg-midnight/50 p-4"><p className="text-xs text-slate-500">Distance</p><p className="mt-1 text-xl font-semibold">{eta?.distanceKm != null ? `${Number(eta.distanceKm).toFixed(1)} km` : "—"}</p></div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <a href={providerPhone ? `tel:${providerPhone}` : undefined} aria-disabled={!providerPhone} className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-sm ${providerPhone ? "text-slate-200 hover:border-accent/40" : "cursor-not-allowed text-slate-500"}`}><Phone size={15} />Call</a>
                  <a href={providerPhone ? `sms:${providerPhone}` : undefined} aria-disabled={!providerPhone} className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-sm ${providerPhone ? "text-slate-200 hover:border-accent/40" : "cursor-not-allowed text-slate-500"}`}><MessageCircle size={15} />Message</a>
                </div>
                {!providerPhone && <p className="mt-2 text-xs text-slate-500">Provider contact details are not available yet.</p>}
              </Card>
              <Card className="p-6">
                <h2 className="font-semibold">Booking status</h2>
                <StatusTimeline booking={booking} />
              </Card>
            </div>
          </div>
        ) : null}
      </main>
      {booking?.provider && <ChatBox bookingId={id} booking={booking} peer={booking.provider} />}
      <Footer />
    </div>
  );
}
