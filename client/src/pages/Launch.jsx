import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import Button from "../components/ui/Button.jsx";
import Spinner from "../components/ui/Spinner.jsx";

const LaunchScene = lazy(() => import("../three/LaunchScene.jsx"));

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (
      canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    ));
  } catch (error) {
    return false;
  }
}

export default function Launch() {
  const navigate = useNavigate();
  const [webGLAvailable, setWebGLAvailable] = useState(null);
  const [launching, setLaunching] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setWebGLAvailable(supportsWebGL());
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      document.body.style.cursor = "auto";
    };
  }, []);

  function launchApp() {
    if (launching) return;
    setLaunching(true);
    document.body.style.cursor = "auto";
    timerRef.current = window.setTimeout(() => navigate("/app"), 1800);
  }

  return (
    <main className="relative isolate flex min-h-[100svh] overflow-hidden bg-midnight text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(80,70,229,0.16),transparent_38%),radial-gradient(ellipse_at_50%_100%,rgba(0,174,202,0.1),transparent_45%)]" />
      {webGLAvailable === null ? (
        <div className="absolute inset-0 grid place-items-center"><Spinner label="Preparing your experience" /></div>
      ) : webGLAvailable ? (
        <Suspense fallback={<div className="absolute inset-0 grid place-items-center"><Spinner label="Loading the 3D experience" /></div>}>
          <LaunchScene launching={launching} onLaunch={launchApp} />
        </Suspense>
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <button
            type="button"
            onClick={launchApp}
            disabled={launching}
            className="launch-fallback-button grid h-48 w-48 place-items-center rounded-full border border-accent/60 bg-gradient-to-br from-primary via-primary-dark to-accent-dark text-lg font-bold tracking-[0.25em] text-white shadow-[0_0_70px_rgba(113,103,255,0.65)] transition hover:scale-110 disabled:cursor-wait"
          >
            LAUNCH
          </button>
        </div>
      )}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto flex max-w-7xl flex-col items-center px-6 pt-[clamp(3.5rem,12vh,8rem)] text-center">
        <motion.p
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-4 text-[0.68rem] font-semibold uppercase tracking-[0.46em] text-accent sm:text-xs"
        >
          Trusted help for every home
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-3xl font-semibold tracking-[0.19em] text-white sm:text-5xl sm:tracking-[0.24em]"
        >
          HOME <span className="text-primary-light">DELIVERY</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-4 text-sm text-slate-300 sm:text-base"
        >
          Trusted pros. Fair prices. Live tracking.
        </motion.p>
      </header>
      <div className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2 text-center">
        {webGLAvailable === false && (
          <Button onClick={launchApp} disabled={launching} className="mb-5 md:hidden">
            Get started <ArrowRight size={17} />
          </Button>
        )}
        <p className="flex items-center justify-center gap-2 text-[0.65rem] font-medium uppercase tracking-[0.3em] text-slate-500">
          <ArrowDown size={13} className="text-accent" /> Begin your home service journey
        </p>
      </div>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 bg-white"
        initial={false}
        animate={launching ? { opacity: [0, 0.95, 0] } : { opacity: 0 }}
        transition={{ duration: 1.4, times: [0, 0.35, 1], ease: "easeInOut" }}
      />
    </main>
  );
}
