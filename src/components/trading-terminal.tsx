import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTerminalStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useTxLineSocket } from "@/lib/use-txline-socket";
import type { usePhantomWallet } from "@/lib/use-phantom-wallet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { OddsChart } from "./odds-chart";
import { AgentFeed } from "./agent-feed";
import { PositionsTable } from "./positions-table";
import { StrategyPanel } from "./strategy-panel";
import { ProofPanel } from "./proof-panel";
import { AnimatedNumber } from "./animated-number";
import { ArrowLeft, Zap, Activity, ShieldCheck, Wallet, BarChart3, Bot, Play, FastForward, Search, Calendar, Trophy, ChevronDown, Tv, Globe } from "lucide-react";

function getFlag(teamName: string): string {
  const normalized = teamName.toLowerCase().trim();
  if (normalized.includes("brazil")) return "🇧🇷";
  if (normalized.includes("germany")) return "🇩🇪";
  if (normalized.includes("argentina")) return "🇦🇷";
  if (normalized.includes("france")) return "🇫🇷";
  if (normalized.includes("spain")) return "🇪🇸";
  if (normalized.includes("england")) return "🏴󠁧󠁢󠁥󠁮󠁧󠁿";
  if (normalized.includes("portugal")) return "🇵🇹";
  if (normalized.includes("netherlands")) return "🇳🇱";
  if (normalized.includes("italy")) return "🇮🇹";
  if (normalized.includes("belgium")) return "🇧🇪";
  if (normalized.includes("mexico")) return "🇲🇽";
  if (normalized.includes("usa") || normalized.includes("united states")) return "🇺🇸";
  if (normalized.includes("switzerland")) return "🇨🇭";
  if (normalized.includes("algeria")) return "🇩🇿";
  if (normalized.includes("australia")) return "🇦🇺";
  if (normalized.includes("egypt")) return "🇪🇬";
  if (normalized.includes("cape verde")) return "🇨🇻";
  if (normalized.includes("colombia")) return "🇨🇴";
  if (normalized.includes("ghana")) return "🇬🇭";
  if (normalized.includes("canada")) return "🇨🇦";
  if (normalized.includes("morocco")) return "🇲🇦";
  if (normalized.includes("paraguay")) return "🇵🇾";
  return "🏳️";
}

type Props = {
  matchId: string;
  onBack: () => void;
  wallet: ReturnType<typeof usePhantomWallet>;
};

const panelVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 16,
      delay: i * 0.1,
    },
  }),
};

export function TradingTerminal({ matchId, onBack, wallet }: Props) {
  useTxLineSocket(wallet.address || undefined);
  const [loading, setLoading] = useState(true);

  const currentMatch = useTerminalStore((s) => s.currentMatch);
  const setCurrentMatch = useTerminalStore((s) => s.setCurrentMatch);
  const setOddsHistory = useTerminalStore((s) => s.setOddsHistory);
  const setStrategy = useTerminalStore((s) => s.setStrategy);
  const setPositions = useTerminalStore((s) => s.setPositions);
  const setAgentLogs = useTerminalStore((s) => s.setAgentLogs);
  const setSettlements = useTerminalStore((s) => s.setSettlements);
  const strategy = useTerminalStore((s) => s.strategy);
  const liveMinute = useTerminalStore((s) => s.liveMinute);
  const lastEvent = useTerminalStore((s) => s.lastEvent);

  const walletBalance = useTerminalStore((s) => s.walletBalance);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getMatch(matchId),
      api.getOddsHistory(matchId),
    ]).then(([match, history]) => {
      setCurrentMatch(match);
      setOddsHistory(history);
      setLoading(false);
    }).catch((e) => {
      console.error(e);
      setLoading(false);
    });

    if (wallet.address) {
      api.getWallet(wallet.address)
        .then((w) => useTerminalStore.getState().setWalletBalance(w.balance))
        .catch(console.error);

      api.getStrategies(wallet.address).then((strategies) => {
        const existing = strategies.find((s) => s.match_id === matchId);
        if (existing) {
          setStrategy(existing);
          api.getAgentLogs(existing.id).then(setAgentLogs).catch(() => {});
          api.getPositions(existing.id).then(setPositions).catch(() => {});
        }
      }).catch(() => {});
    }

    api.getSettlements(matchId).then(setSettlements).catch(() => {});
  }, [matchId, wallet.address, setCurrentMatch, setOddsHistory, setStrategy, setPositions, setAgentLogs, setSettlements]);

  if (loading || !currentMatch) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring" }}
        >
          <div className="h-12 w-12 mx-auto mb-4 rounded-xl border border-primary/20 flex items-center justify-center glow-primary">
            <Activity className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm">Loading match data from TxLINE...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      {/* ── Top Bar ── */}
      <header className="border-b border-border/50 glass-panel sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Lobby
            </Button>
            <div className="h-6 w-px bg-border/30" />
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-sm">{currentMatch.home_team}</span>
              <span className="text-muted-foreground text-xs">vs</span>
              <span className="font-bold text-sm">{currentMatch.away_team}</span>
            </div>
            {currentMatch.status === "live" && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-profit/10 border border-profit/20">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-profit opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-profit" />
                </span>
                <span className="text-xs font-mono-num text-profit font-semibold">{liveMinute}'</span>
              </div>
            )}
            <Badge
              variant="outline"
              className={`
                ${currentMatch.status === "live" ? "text-profit border-profit/30 bg-profit/5" : "text-muted-foreground"}
              `}
            >
              {currentMatch.status.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-txline border-txline/20 bg-txline/5 gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              TxLINE Verified
            </Badge>
            {wallet.connected && (
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-border/5 border border-border/20">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Credits</p>
                  <p className="font-mono-num font-semibold text-xs text-emerald-400">
                    <AnimatedNumber value={walletBalance} decimals={0} /> USDC
                  </p>
                </div>
              </div>
            )}
            <Button
              onClick={wallet.connect}
              disabled={wallet.connecting || wallet.connected}
              variant={wallet.connected ? "outline" : "default"}
              size="sm"
              className={wallet.connected ? "font-mono-num border-border/30 gap-1.5" : "glow-primary gap-1.5"}
            >
              {wallet.connected ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-profit" />
                  {wallet.address?.slice(0, 4)}...{wallet.address?.slice(-4)}
                </>
              ) : wallet.connecting ? "..." : (
                <>
                  <Wallet className="h-3.5 w-3.5" />
                  Connect
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main Grid ── */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[300px_1fr_320px] gap-4 p-4 min-h-0">
        
        {/* ==================== LEFT COLUMN ==================== */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Match Info & Graphics Visualizer */}
          <motion.div custom={0} variants={panelVariants} initial="hidden" animate="show">
            <Card className="p-4 bg-[#0c1a24] border-slate-800 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-white">
                  <Activity className="h-4 w-4 text-primary" />
                  Match Info
                </h3>
                <Badge variant="secondary" className="text-[10px] bg-slate-900 text-slate-400 font-mono">
                  {currentMatch.status.toUpperCase()}
                </Badge>
              </div>

              {/* Visual Soccer Pitch diagram */}
              <div className="relative w-full aspect-[16/10] bg-[#102d24] rounded-xl border border-[#1b4335] overflow-hidden flex flex-col justify-between p-3 select-none">
                {/* Field Markings */}
                <div className="absolute inset-0 bg-[linear-gradient(transparent_48%,rgba(255,255,255,0.06)_48%,rgba(255,255,255,0.06)_52%,transparent_52%)] pointer-events-none" />
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/10 -translate-x-1/2 pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 w-14 h-14 rounded-full border border-white/10 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                <div className="absolute top-1/4 bottom-1/4 left-0 w-6 border-r border-t border-b border-white/10 pointer-events-none" />
                <div className="absolute top-1/4 bottom-1/4 right-0 w-6 border-l border-t border-b border-white/10 pointer-events-none" />
                
                {/* Pitch Score HUD */}
                <div className="relative z-10 flex items-center justify-between text-white font-semibold text-[10px] bg-slate-950/70 border border-slate-800/60 rounded-md px-2 py-1">
                  <span className="flex items-center gap-1">{getFlag(currentMatch.home_team)} {currentMatch.home_team.slice(0, 3).toUpperCase()}</span>
                  <span className="font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 rounded px-1.5 font-bold">
                    {currentMatch.status === "scheduled" ? "0" : currentMatch.score_home} - {currentMatch.status === "scheduled" ? "0" : currentMatch.score_away}
                  </span>
                  <span className="flex items-center gap-1">{currentMatch.away_team.slice(0, 3).toUpperCase()} {getFlag(currentMatch.away_team)}</span>
                </div>

                {/* Animated Ball & Attack indicator */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {currentMatch.status === "live" ? (
                    <motion.div 
                      className="absolute h-3 w-3 rounded-full bg-yellow-400 border border-white shadow-lg shadow-yellow-500/50 flex items-center justify-center animate-pulse"
                      animate={{
                        x: [
                          `${Math.sin(liveMinute) * 60}px`,
                          `${Math.sin(liveMinute + 2) * -60}px`,
                          `${Math.sin(liveMinute) * 60}px`
                        ],
                        y: [
                          `${Math.cos(liveMinute) * 20}px`,
                          `${Math.cos(liveMinute + 2) * -20}px`,
                          `${Math.cos(liveMinute) * 20}px`
                        ]
                      }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <div className="h-1 w-1 bg-black rounded-full" />
                    </motion.div>
                  ) : (
                    <div className="h-3 w-3 rounded-full bg-slate-500 border border-slate-600 opacity-60" />
                  )}
                </div>

                {/* Live commentary ticker */}
                <div className="relative z-10 w-full bg-slate-950/80 border border-slate-800/60 rounded-md p-1.5 flex items-center gap-2">
                  <div className="flex h-2 w-2 relative">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${currentMatch.status === "live" ? "bg-emerald-400" : "bg-slate-400"}`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${currentMatch.status === "live" ? "bg-emerald-500" : "bg-slate-500"}`} />
                  </div>
                  <p className="text-[10px] text-slate-300 truncate flex-1 italic">
                    {currentMatch.status === "live" 
                      ? (lastEvent || "Match in progress. Action building up...") 
                      : currentMatch.status === "final"
                        ? "Match finished. Settlement proof ready."
                        : "Waiting for match kickoff..."}
                  </p>
                </div>
              </div>

              {/* Head To Head & Win Probability */}
              <div className="space-y-3.5 bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <span>Head to Head</span>
                  <span>1 / 3</span>
                </div>
                
                {/* Dynamically calculated Win Probability horizontal progress bar */}
                <div>
                  <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Win Probability</p>
                  {(() => {
                    const oddsH = Number(currentMatch.odds_home) || 2.0;
                    const oddsA = Number(currentMatch.odds_away) || 2.0;
                    const oddsD = Number(currentMatch.odds_draw) || 3.0;
                    const pH = 100 / oddsH;
                    const pA = 100 / oddsA;
                    const pD = 100 / oddsD;
                    const total = pH + pA + pD;
                    const hPct = Math.round((pH / total) * 100);
                    const aPct = Math.round((pA / total) * 100);
                    const dPct = 100 - hPct - aPct;
                    return (
                      <>
                        <div className="flex justify-between font-mono-num text-[11px] font-bold text-slate-300 mb-1">
                          <span className="text-[#38bdf8]">{hPct}% {currentMatch.home_team.slice(0, 3).toUpperCase()}</span>
                          <span className="text-slate-400">{dPct}% DRAW</span>
                          <span className="text-[#10b981]">{aPct}% {currentMatch.away_team.slice(0, 3).toUpperCase()}</span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-800 border border-slate-700/30">
                          <div className="bg-[#38bdf8]" style={{ width: `${hPct}%` }} />
                          <div className="bg-slate-500" style={{ width: `${dPct}%` }} />
                          <div className="bg-[#10b981]" style={{ width: `${aPct}%` }} />
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="h-px bg-slate-900" />

                {/* Previous meetings counters */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-xl font-bold font-mono-num text-[#38bdf8] block">2</span>
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">Wins</span>
                  </div>
                  <div>
                    <span className="text-xl font-bold font-mono-num text-slate-400 block">0</span>
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">Draws</span>
                  </div>
                  <div>
                    <span className="text-xl font-bold font-mono-num text-[#10b981] block">3</span>
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">Wins</span>
                  </div>
                </div>
              </div>

              {/* Metadata Details */}
              <div className="space-y-2 text-xs border-t border-slate-900 pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    Kickoff
                  </span>
                  <span className="font-mono-num text-slate-300">
                    {currentMatch.kickoff_time 
                      ? new Date(currentMatch.kickoff_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) 
                      : "TBD"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-slate-500" />
                    Source
                  </span>
                  <span className="text-txline font-semibold">TxLINE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-slate-500" />
                    Stage
                  </span>
                  <span className="text-slate-300">
                    {(currentMatch.txline_data as Record<string, unknown>)?.stage as string || "World Cup 2026"}
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Strategy Control */}
          <motion.div custom={1} variants={panelVariants} initial="hidden" animate="show" className="flex-1 min-h-0">
            <Card className="p-4 h-full overflow-auto bg-[#0c1a24] border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-white">
                  <Zap className="h-4 w-4 text-agent" />
                  Strategy
                </h3>
              </div>
              <StrategyPanel strategy={strategy ?? undefined} wallet={wallet} matchId={matchId} />
            </Card>
          </motion.div>
        </div>

        {/* ==================== CENTER COLUMN ==================== */}
        <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
          {/* Match visual billboard banner */}
          <motion.div custom={2} variants={panelVariants} initial="hidden" animate="show">
            <div className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 p-6 border border-emerald-900/35 flex flex-col justify-end min-h-[180px] shadow-xl">
              {/* Soccer pitch stripes backdrop overlay */}
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(ellipse_at_bottom,rgba(16,185,129,0.3)_0%,transparent_70%)]" />
              <div className="absolute inset-0 opacity-5 bg-[linear-gradient(90deg,transparent_49%,white_49%,white_51%,transparent_51%)]" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-95" />
              
              {/* Banner title / team scoreboard */}
              <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-800/50 px-2 py-0.5 rounded-full tracking-widest uppercase">
                      World Cup 2026 Group Stage
                    </span>
                    {currentMatch.status === "live" && (
                      <Badge className="bg-loss hover:bg-loss text-white border-0 font-semibold px-2 py-0.5 text-[9px] uppercase tracking-wider gap-1.5 animate-pulse glow-loss">
                        <span className="h-1 w-1 rounded-full bg-white block" />
                        LIVE {liveMinute}'
                      </Badge>
                    )}
                    {currentMatch.status === "final" && (
                      <Badge className="bg-slate-800 hover:bg-slate-800 text-slate-300 border-slate-700 font-semibold px-2 py-0.5 text-[9px] uppercase tracking-wider">
                        FINAL
                      </Badge>
                    )}
                    {currentMatch.status === "scheduled" && (
                      <Badge className="bg-emerald-950 hover:bg-emerald-950 text-emerald-400 border-emerald-800 font-semibold px-2 py-0.5 text-[9px] uppercase tracking-wider">
                        SCHEDULED
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-2xl font-black text-white tracking-tight mt-1.5">
                    <span>{getFlag(currentMatch.home_team)} {currentMatch.home_team}</span>
                    <div className="flex items-center gap-1.5 font-mono text-xl bg-slate-950/60 px-2.5 py-0.5 rounded-lg border border-slate-800">
                      <span className="text-white">{currentMatch.status === "scheduled" ? "0" : currentMatch.score_home}</span>
                      <span className="text-slate-500 font-normal">:</span>
                      <span className="text-white">{currentMatch.status === "scheduled" ? "0" : currentMatch.score_away}</span>
                    </div>
                    <span>{currentMatch.away_team} {getFlag(currentMatch.away_team)}</span>
                  </div>
                </div>

                {/* Floating glassmorphic panel */}
                <div className="bg-slate-950/70 backdrop-blur-md border border-slate-800/80 rounded-xl p-3.5 max-w-xs shadow-2xl flex flex-col gap-1.5">
                  <div className="text-[10px] text-slate-400 font-semibold tracking-wider flex items-center gap-1.5">
                    <Tv className="h-3 w-3 text-emerald-400" />
                    LIVE STATS FEED
                  </div>
                  <div className="h-px bg-slate-800" />
                  {(() => {
                    const progress = currentMatch.status === "scheduled" ? 0 : Math.min(90, liveMinute);
                    const homeScore = currentMatch.status === "scheduled" ? 0 : currentMatch.score_home;
                    const awayScore = currentMatch.status === "scheduled" ? 0 : currentMatch.score_away;
                    
                    const homeCorners = Math.floor(progress / 15) + (homeScore * 2) + 1;
                    const awayCorners = Math.floor(progress / 18) + (awayScore * 1) + 2;
                    const homeYellows = Math.floor(progress / 40) + (awayScore > homeScore ? 1 : 0);
                    const awayYellows = Math.floor(progress / 35) + (homeScore > awayScore ? 1 : 0);
                    const homeReds = homeScore > 3 ? 1 : 0;
                    const awayReds = awayScore > 3 ? 1 : 0;
                    
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-300">
                          <span className="font-semibold">Corners</span>
                          <span className="font-mono-num font-bold text-white">{homeCorners} - {awayCorners}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-300">
                          <span className="font-semibold">Yellow Cards</span>
                          <span className="font-mono-num font-bold text-white">{homeYellows} - {awayYellows}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-300">
                          <span className="font-semibold">Red Cards</span>
                          <span className="font-mono-num font-bold text-white">{homeReds} - {awayReds}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Sub-tabs & Search bar */}
          <div className="flex flex-col gap-3">
            {/* Horizontal tab lists */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide text-xs font-semibold uppercase tracking-wider text-slate-400">
              {["Main", "Same Game Multi", "Goals", "Overtime", "Asian Lines", "Half"].map((tab, idx) => (
                <button
                  key={tab}
                  className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    idx === 0 
                      ? "bg-slate-800 text-white border border-slate-700" 
                      : "hover:bg-slate-900/60 hover:text-slate-300"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Magnifying search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search markets..."
                className="w-full bg-[#0c1a24]/60 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
              />
            </div>
          </div>

          {/* Betting markets lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1x2 (90' + Stoppage Time) */}
            <Card className="p-4 bg-[#0c1a24] border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-white uppercase tracking-wider">1x2 (90' + Stoppage Time)</p>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="flex flex-col items-center justify-center bg-[#07131b] border border-[#132a35] rounded-lg py-2 px-3 text-center">
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{currentMatch.home_team.split(" ")[0]}</span>
                  <span className="text-xs font-mono-num font-extrabold text-[#38bdf8] mt-0.5">
                    <AnimatedNumber value={Number(currentMatch.odds_home)} decimals={2} />
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center bg-[#07131b] border border-[#132a35] rounded-lg py-2 px-3 text-center">
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Draw</span>
                  <span className="text-xs font-mono-num font-extrabold text-[#38bdf8] mt-0.5">
                    <AnimatedNumber value={Number(currentMatch.odds_draw)} decimals={2} />
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center bg-[#07131b] border border-[#132a35] rounded-lg py-2 px-3 text-center">
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{currentMatch.away_team.split(" ")[0]}</span>
                  <span className="text-xs font-mono-num font-extrabold text-[#38bdf8] mt-0.5">
                    <AnimatedNumber value={Number(currentMatch.odds_away)} decimals={2} />
                  </span>
                </div>
              </div>
            </Card>

            {/* To Qualify */}
            <Card className="p-4 bg-[#0c1a24] border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-white uppercase tracking-wider">To Qualify</p>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col items-center justify-center bg-[#07131b] border border-[#132a35] rounded-lg py-2 px-3 text-center">
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{currentMatch.home_team.split(" ")[0]}</span>
                  <span className="text-xs font-mono-num font-extrabold text-[#38bdf8] mt-0.5">
                    <AnimatedNumber value={Math.round((Number(currentMatch.odds_home) * 0.7) * 100) / 100} decimals={2} />
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center bg-[#07131b] border border-[#132a35] rounded-lg py-2 px-3 text-center">
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{currentMatch.away_team.split(" ")[0]}</span>
                  <span className="text-xs font-mono-num font-extrabold text-[#38bdf8] mt-0.5">
                    <AnimatedNumber value={Math.round((Number(currentMatch.odds_away) * 0.7) * 100) / 100} decimals={2} />
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Implied Probability & Odds Movement Chart */}
          <motion.div custom={3} variants={panelVariants} initial="hidden" animate="show" className="flex-1 min-h-[300px]">
            <Card className="p-4 bg-[#0c1a24] border-slate-800 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-white">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Implied Probability & Odds Movement
                </h3>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-chart-1 glow-primary" />
                    <span className="text-slate-400">{currentMatch.home_team}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-chart-2" />
                    <span className="text-slate-400">{currentMatch.away_team}</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <OddsChart />
              </div>
            </Card>
          </motion.div>

          {/* Positions Table */}
          <motion.div custom={4} variants={panelVariants} initial="hidden" animate="show">
            <Card className="p-4 bg-[#0c1a24] border-slate-800">
              <PositionsTable wallet={wallet} />
            </Card>
          </motion.div>
        </div>

        {/* ==================== RIGHT COLUMN ==================== */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Agent Reasoning Feed */}
          <motion.div custom={5} variants={panelVariants} initial="hidden" animate="show" className="flex-1 min-h-0">
            <Card className="p-4 h-full flex flex-col bg-[#0c1a24] border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-white">
                  <Bot className="h-4 w-4 text-agent" />
                  Agent Reasoning Feed
                </h3>
                {strategy?.agent_active && (
                  <Badge variant="outline" className="text-profit border-profit/30 bg-profit/8 gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-profit opacity-60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-profit" />
                    </span>
                    Active
                  </Badge>
                )}
              </div>
              <AgentFeed />
            </Card>
          </motion.div>

          {/* Cryptographic Proof verification panel */}
          <motion.div custom={6} variants={panelVariants} initial="hidden" animate="show">
            <ProofPanel matchId={matchId} />
          </motion.div>
        </div>

      </div>

      {/* ── Bottom Demo Controls ── */}
      {currentMatch.status !== "final" && (
        <motion.div
          className="border-t border-border/30 glass-panel px-4 py-2.5 flex items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <span className="text-xs text-muted-foreground mr-1 uppercase tracking-wider">Demo</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => api.startSimulation(matchId).catch(console.error)}
            disabled={currentMatch.status === "live"}
            className="gap-1.5 border-border/30 hover:border-profit/30 hover:text-profit hover:bg-profit/5"
          >
            <Play className="h-3.5 w-3.5" />
            Start Simulation
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => api.fastForward(matchId).catch(console.error)}
            disabled={currentMatch.status === "final"}
            className="gap-1.5 border-border/30 hover:border-agent/30 hover:text-agent hover:bg-agent/5"
          >
            <FastForward className="h-3.5 w-3.5" />
            Fast Forward 85'
          </Button>
        </motion.div>
      )}
    </div>
  );
}
