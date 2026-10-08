import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Radio, Square, TriangleAlert } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios.js";
import socket from "../../socket/socket.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";

const LOCATION_SEND_INTERVAL_MS = 4000;

export default function LiveShare({ booking, status }) {
  const [active, setActive] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const watchId = useRef(null);
  const simulationTimer = useRef(null);
  const lastSentAt = useRef(0);
  const lastPosition = useRef(null);

  const stopWatching = useCallback(() => {
    if (watchId.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (simulationTimer.current) {
      clearInterval(simulationTimer.current);
      simulationTimer.current = null;
    }
    setSimulating(false);
  }, []);

  const sendLocation = useCallback(async ({ lat, lng, heading }) => {
    const now = Date.now();
    if (now - lastSentAt.current < LOCATION_SEND_INTERVAL_MS) return;
    lastSentAt.current = now;
    const payload = { bookingId: booking._id, lat, lng, heading: heading ?? null };
    lastPosition.current = { lat, lng, heading: heading ?? null };
    try {
      if (socket.connected) {
        socket.emit("provider:location", payload, (result) => {
          if (!result?.success) setLocationError(result?.message || "Live location could not be shared.");
          else setLocationError("");
        });
      } else {
        await api.put("/tracking/location", payload);
        setLocationError("");
      }
    } catch (error) {
      setLocationError(error.response?.data?.message || "Live location could not be shared.");
    }
  }, [booking._id]);

  const startSession = useCallback(async () => {
    await api.post(`/tracking/${booking._id}/start`);
    if (!socket.connected) socket.connect();
    setActive(true);
    setLocationError("");
    return true;
  }, [booking._id]);

  const startSharing = useCallback(async () => {
    try {
      await startSession();
      if (!navigator.geolocation) {
        setLocationError("This browser does not support location sharing.");
        return;
      }
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          void sendLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            heading: position.coords.heading
          });
        },
        (error) => setLocationError(error.message || "Allow location access to share your route."),
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 15_000 }
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Live sharing could not be started.");
    }
  }, [sendLocation, startSession]);

  const stopSharing = useCallback(async ({ quiet = false } = {}) => {
    stopWatching();
    if (!active) return;
    setActive(false);
    try {
      await api.post(`/tracking/${booking._id}/stop`);
      if (!quiet) toast.success("Live location sharing stopped.");
    } catch (error) {
      if (error.response?.status !== 409 && !quiet) {
        toast.error(error.response?.data?.message || "Live sharing could not be stopped.");
      }
    }
  }, [active, booking._id, stopWatching]);

  useEffect(() => {
    if (status !== "EN_ROUTE" && active) void stopSharing({ quiet: true });
  }, [active, status, stopSharing]);

  useEffect(() => () => {
    stopWatching();
  }, [stopWatching]);

  async function toggleSimulation() {
    if (simulating) {
      if (simulationTimer.current) clearInterval(simulationTimer.current);
      simulationTimer.current = null;
      setSimulating(false);
      return;
    }
    if (!booking.address?.location?.coordinates?.length) {
      setLocationError("This booking does not have a destination pin.");
      return;
    }
    try {
      if (!active) await startSession();
      if (watchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      const [destinationLng, destinationLat] = booking.address.location.coordinates;
      let progress = 0;
      const origin = lastPosition.current || {
        lat: destinationLat + 0.02,
        lng: destinationLng - 0.02
      };
      setSimulating(true);
      const move = () => {
        progress = Math.min(1, progress + 0.1);
        void sendLocation({
          lat: origin.lat + (destinationLat - origin.lat) * progress,
          lng: origin.lng + (destinationLng - origin.lng) * progress,
          heading: 135
        });
        if (progress === 1 && simulationTimer.current) {
          clearInterval(simulationTimer.current);
          simulationTimer.current = null;
          setSimulating(false);
        }
      };
      move();
      simulationTimer.current = setInterval(move, LOCATION_SEND_INTERVAL_MS);
    } catch (error) {
      toast.error(error.response?.data?.message || "Movement simulation could not be started.");
    }
  }

  return (
    <Card className="grid gap-3 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><Radio size={18} /></span>
        <div><h3 className="font-semibold">Live location sharing</h3><p className="mt-1 text-xs text-slate-400">{active ? "Your customer can see your route." : "Share your location while you travel to the customer."}</p></div>
      </div>
      {locationError && <p role="alert" className="flex items-start gap-2 text-xs text-amber-200"><TriangleAlert size={14} className="mt-0.5 shrink-0" />{locationError}</p>}
      {status === "EN_ROUTE" && (
        <Button type="button" variant={active ? "secondary" : "primary"} onClick={() => (active ? stopSharing() : startSharing())}>
          {active ? <><Square size={14} />Stop sharing</> : <><MapPin size={14} />Start sharing</>}
        </Button>
      )}
      {import.meta.env.DEV && status === "EN_ROUTE" && (
        <Button type="button" variant="ghost" onClick={toggleSimulation}>
          {simulating ? "Stop simulation" : "Simulate movement"}
        </Button>
      )}
    </Card>
  );
}
