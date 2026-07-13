import { type PointerEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FixtureLobby } from "./components/fixture-lobby";
import { TradingTerminal } from "./components/trading-terminal";
import { HomeHero } from "./components/home-hero";
import { usePhantomWallet } from "./lib/use-phantom-wallet";
import { useTerminalStore } from "./lib/store";
import { api } from "./lib/api";
import { Button } from "./components/ui/button";
import { Menu, RotateCcw } from "lucide-react";

export function App() {
  const shellRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"home" | "fixtures" | "terminal">("home");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const wallet = usePhantomWallet();
  const matches = useTerminalStore((s) => s.matches);
  const setMatches = useTerminalStore((s) => s.setMatches);
  const walletBalance = useTerminalStore((s) => s.walletBalance);
  const setWalletBalance = useTerminalStore((s) => s.setWalletBalance);

  useEffect(() => {
    api.getFixtures().then(setMatches).catch(console.error);
  }, [setMatches]);

  useEffect(() => {
    if (wallet.address) {
      api.getWallet(wallet.address).then((w) => setWalletBalance(w.balance)).catch(console.error);
    }
  }, [wallet.address, setWalletBalance]);

  useEffect(() => {
    let frame = 0;
    let targetY = window.scrollY;
    let smoothY = window.scrollY;
    let previousY = window.scrollY;
    let idleTimer: any;

    const setSettled = () => {
      shellRef.current?.setAttribute("data-scroll-state", "settled");
      shellRef.current?.style.setProperty("--scroll-velocity", "0");
    };

    const syncTarget = () => {
      const nextY = window.scrollY;
      const direction = nextY > previousY ? "down" : nextY < previousY ? "up" : "settled";

      if (direction !== "settled") {
        shellRef.current?.setAttribute("data-scroll-state", direction);
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(setSettled, 180);
      }

      previousY = nextY;
      targetY = nextY;
    };

    const animateScrollState = () => {
      smoothY += (targetY - smoothY) * 0.22;
      if (Math.abs(targetY - smoothY) < 0.08) {
        smoothY = targetY;
      }

      const scrollableHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const progress = Math.min(Math.max(smoothY / scrollableHeight, 0), 1);
      const velocity = Math.min(Math.abs(targetY - smoothY) / 90, 1);

      shellRef.current?.style.setProperty("--scroll-y", `${smoothY.toFixed(2)}px`);
      shellRef.current?.style.setProperty("--scroll-progress", progress.toFixed(4));
      shellRef.current?.style.setProperty("--scroll-velocity", velocity.toFixed(4));

      frame = requestAnimationFrame(animateScrollState);
    };

    syncTarget();
    animateScrollState();
    window.addEventListener("scroll", syncTarget, { passive: true });
    window.addEventListener("resize", syncTarget);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(idleTimer);
      window.removeEventListener("scroll", syncTarget);
      window.removeEventListener("resize", syncTarget);
    };
  }, []);

  const openTerminal = (matchId: string) => {
    setSelectedMatchId(matchId);
    setView("terminal");
  };

  const backToLobby = () => {
    setSelectedMatchId(null);
    setView("fixtures");
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

    shellRef.current?.style.setProperty("--cursor-x", x.toFixed(3));
    shellRef.current?.style.setProperty("--cursor-y", y.toFixed(3));
  };

  return (
    <div 
      ref={shellRef} 
      className="app-shell" 
      data-scroll-state="settled" 
      onPointerMove={handlePointerMove}
      style={view !== "home" ? { backgroundColor: "#000000", backgroundImage: "none" } : undefined}
    >
      {view === "home" && (
        <>
          <AmbientVideoBackground />
          <div className="grid-bg" aria-hidden="true" />
          <div className="scanline-overlay" aria-hidden="true" />
        </>
      )}

      {/* Global Navigation Header (only on non-terminal views) */}
      {view !== "terminal" && (
        <header className="homepage-nav fixed left-0 right-0 top-0 z-50">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
            <div className="flex items-center gap-4">
              <motion.div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setView("home")}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 120, damping: 14 }}
              >
                <div className="brand-mark">
                  <span>TX</span>
                </div>
                <div>
                  <h1 className="text-lg font-black tracking-tight text-white">TxHedge</h1>
                  <p className="-mt-0.5 text-[10px] uppercase tracking-[0.28em] text-white/45">Verifiable Odds</p>
                </div>
              </motion.div>

              <motion.nav
                className="hidden items-center gap-7 pl-8 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/48 md:flex"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <button 
                  className={`hover:text-white transition-colors ${view === "fixtures" ? "text-white" : ""}`}
                  onClick={() => setView("fixtures")}
                >
                  Fixtures
                </button>
                <span>Protocol</span>
                <span>Proofs</span>
              </motion.nav>
            </div>

            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (confirm("Are you sure you want to reset all mock simulation database data, USDC wallet balance, and active strategies?")) {
                    try {
                      await fetch("/api/reset", { method: "POST" });
                      window.location.reload();
                    } catch (e) {
                      alert("Reset failed");
                    }
                  }
                }}
                className="text-[10px] uppercase font-bold tracking-wider text-slate-400 hover:text-white hover:bg-slate-800/80 border-slate-800 gap-1.5 h-9"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Data
              </Button>
              <WalletButton wallet={wallet} balance={walletBalance} />
              <Button variant="outline" size="icon-sm" className="menu-button md:hidden" aria-label="Open menu">
                <Menu className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </header>
      )}

      {/* Pages Container with Page transitions */}
      <div className={`relative z-10 min-h-screen ${view !== "terminal" ? "pt-20" : ""}`}>
        <AnimatePresence mode="wait">
          {view === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
            >
              <HomeHero 
                onStartHedging={() => setView("fixtures")} 
                wallet={wallet} 
                matchesCount={matches.length} 
              />
            </motion.div>
          )}

          {view === "fixtures" && (
            <motion.div
              key="fixtures"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
            >
              <FixtureLobby onOpenMatch={openTerminal} />
            </motion.div>
          )}

          {view === "terminal" && selectedMatchId && (
            <motion.div
              key="terminal"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <TradingTerminal matchId={selectedMatchId} onBack={backToLobby} wallet={wallet} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function WalletButton({ wallet, balance }: { wallet: ReturnType<typeof usePhantomWallet>; balance: number }) {
  if (!wallet.connected) {
    return (
      <Button onClick={wallet.connect} disabled={wallet.connecting} variant="default" size="sm" className="h-9 px-4 text-xs font-semibold">
        {wallet.connecting ? "Connecting..." : "Connect Phantom"}
      </Button>
    );
  }
  const addr = wallet.address || "";
  return (
    <div className="flex items-center gap-3 bg-white/3 border border-white/5 px-3 py-1 rounded-xl">
      <div className="text-right">
        <p className="text-[9px] text-white/45 uppercase tracking-wider">Credits</p>
        <p className="font-mono-num font-semibold text-xs text-emerald-400">{balance.toLocaleString()} USDC</p>
      </div>
      <Button onClick={wallet.disconnect} variant="outline" size="sm" className="font-mono-num h-7 text-[10px] border-white/10 hover:bg-white/5">
        {addr.slice(0, 4)}...{addr.slice(-4)}
      </Button>
    </div>
  );
}

function AmbientVideoBackground() {
  const [cachedBitmaps, setCachedBitmaps] = useState<ImageBitmap[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);

  const isMobile = typeof window !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // 1. Offscreen Frame Extraction on Mount
  useEffect(() => {
    if (isMobile) return;
    let isMounted = true;
    const video = document.createElement("video");
    video.src = "/football.mp4";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const frameCount = 40; // Number of frames to extract
    const bitmaps: ImageBitmap[] = [];

    video.onloadedmetadata = async () => {
      if (!isMounted) return;

      // Scale resolution down to 960px width for memory & performance efficiency
      const scale = Math.min(1, 960 / video.videoWidth);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;

      const duration = video.duration || 3;
      const step = duration / frameCount;

      for (let i = 0; i < frameCount; i++) {
        if (!isMounted) break;
        video.currentTime = i * step;

        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            resolve();
          };
          video.addEventListener("seeked", onSeeked);
        });

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            const bitmap = await createImageBitmap(canvas);
            bitmaps.push(bitmap);
          } catch (e) {
            console.error("Frame extraction error at index", i, e);
          }
        }
      }

      if (isMounted && bitmaps.length > 10) {
        setCachedBitmaps(bitmaps);
      }
    };

    return () => {
      isMounted = false;
      bitmaps.forEach((b) => b.close());
    };
  }, []);

  // 2. Interpolated Scroll Seek Loop
  useEffect(() => {
    let frame = 0;
    let currentProgress = 0;
    let targetProgress = 0;
    let lastDrawnFrameIndex = -1;

    const lerp = (start: number, end: number, amt: number) => {
      return (1 - amt) * start + amt * end;
    };

    const updateLoop = () => {
      currentProgress = lerp(currentProgress, targetProgress, 0.22);
      if (Math.abs(currentProgress - targetProgress) < 0.0005) {
        currentProgress = targetProgress;
      }

      if (cachedBitmaps.length > 0 && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const frameIndex = Math.min(
            Math.max(Math.floor(currentProgress * cachedBitmaps.length), 0),
            cachedBitmaps.length - 1
          );
          
          if (frameIndex !== lastDrawnFrameIndex) {
            const bitmap = cachedBitmaps[frameIndex];
            if (bitmap) {
              if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
              }
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(bitmap, 0, 0);
              lastDrawnFrameIndex = frameIndex;
            }
          }
        }
      } else {
        // Fallback: stay static or auto-play softly before cache completes
      }

      frame = requestAnimationFrame(updateLoop);
    };

    const handleScroll = () => {
      const scrollableHeight = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        1
      );
      targetProgress = Math.min(Math.max(window.scrollY / scrollableHeight, 0), 1);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    frame = requestAnimationFrame(updateLoop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [cachedBitmaps]);

  return (
    <div className="motion-backdrop" aria-hidden="true">
      {/* Background Layer (Canvas or video fallback) */}
      <div className="motion-backdrop__stage motion-backdrop__stage--bg">
        {cachedBitmaps.length > 0 ? (
          <canvas
            ref={canvasRef}
            className="motion-backdrop__video"
          />
        ) : (
          <video
            ref={backgroundVideoRef}
            className="motion-backdrop__video"
            src="/football.mp4"
            muted
            playsInline
            autoPlay
            loop
            preload="auto"
          />
        )}
      </div>

      {/* Foreground Layer */}
      <div className="motion-backdrop__stage motion-backdrop__stage--fg">
        <img
          className="motion-backdrop__video motion-backdrop__video--fg"
          src="/ak.jpeg"
          alt=""
        />
      </div>

      <div className="motion-backdrop__mesh" />
      <div className="motion-backdrop__scroll-trace" />
      <div className="motion-backdrop__vignette" />
    </div>
  );
}

export default App;
