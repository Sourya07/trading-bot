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
import { ArrowLeft, Zap, Activity, ShieldCheck, Wallet, BarChart3, Bot, Play, FastForward } from "lucide-react";

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
  useTxLineSocket();
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
                  <p className="font-mono-num font-semibold text-xs">1,000</p>
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
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-3 p-3 min-h-0">
        {/* Left Panel — Match Info + Strategy */}
        <div className="flex flex-col gap-3 min-h-0">
          <motion.div custom={0} variants={panelVariants} initial="hidden" animate="show">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Match Info
                </h3>
              </div>
              {/* Teams & Score */}
              <div className="flex items-center justify-between mb-5">
                <div className="text-center flex-1">
                  <div className="h-12 w-12 mx-auto rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15 flex items-center justify-center mb-2 animate-float">
                    <span className="text-primary font-bold text-lg">{currentMatch.home_team[0]}</span>
                  </div>
                  <p className="font-semibold text-sm">{currentMatch.home_team}</p>
                </div>
                <div className="px-3">
                  {currentMatch.status === "live" || currentMatch.status === "final" ? (
                    <div className="text-center">
                      <div className="font-mono-num text-3xl font-bold flex items-center gap-2 score-3d">
                        <AnimatedNumber value={currentMatch.score_home} decimals={0} className="text-glow-primary" />
                        <span className="text-muted-foreground text-xl">:</span>
                        <AnimatedNumber value={currentMatch.score_away} decimals={0} className="text-glow-primary" />
                      </div>
                      {currentMatch.status === "live" && (
                        <div className="mt-1.5 flex items-center justify-center gap-1">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-profit opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-profit" />
                          </span>
                          <p className="text-xs text-profit font-mono-num">{liveMinute}'</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm font-mono-num px-3 py-1 rounded-lg bg-border/5 border border-border/30">VS</p>
                  )}
                </div>
                <div className="text-center flex-1">
                  <div className="h-12 w-12 mx-auto rounded-xl bg-gradient-to-br from-chart-2/20 to-chart-2/5 border border-chart-2/15 flex items-center justify-center mb-2 animate-float" style={{ animationDelay: '0.5s' }}>
                    <span className="text-chart-2 font-bold text-lg">{currentMatch.away_team[0]}</span>
                  </div>
                  <p className="font-semibold text-sm">{currentMatch.away_team}</p>
                </div>
              </div>
              {/* Last event */}
              {lastEvent && currentMatch.status === "live" && (
                <motion.div
                  className="bg-agent/8 border border-agent/15 rounded-lg p-2.5 mb-3"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={lastEvent}
                >
                  <p className="text-xs text-agent">{lastEvent}</p>
                </motion.div>
              )}
              {/* Match details */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kickoff</span>
                  <span className="font-mono-num">{currentMatch.kickoff_time ? new Date(currentMatch.kickoff_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "TBD"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <span className="text-txline font-semibold">TxLINE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stage</span>
                  <span>{(currentMatch.txline_data as Record<string, unknown>)?.stage as string || "World Cup 2026"}</span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Strategy Control */}
          <motion.div custom={1} variants={panelVariants} initial="hidden" animate="show" className="flex-1 min-h-0">
            <Card className="p-4 h-full overflow-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-agent" />
                  Strategy
                </h3>
              </div>
              <StrategyPanel strategy={strategy ?? undefined} wallet={wallet} matchId={matchId} />
            </Card>
          </motion.div>
        </div>

        {/* Center Panel — Odds Chart + Positions */}
        <div className="flex flex-col gap-3 min-h-0">
          <motion.div custom={2} variants={panelVariants} initial="hidden" animate="show" className="flex-1 min-h-0">
            <Card className="p-4 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Implied Probability & Odds Movement
                </h3>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-chart-1 glow-primary" />
                    <span className="text-muted-foreground">{currentMatch.home_team}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-chart-2" />
                    <span className="text-muted-foreground">{currentMatch.away_team}</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <OddsChart />
              </div>
            </Card>
          </motion.div>

          <motion.div custom={3} variants={panelVariants} initial="hidden" animate="show">
            <Card className="p-4">
              <PositionsTable />
            </Card>
          </motion.div>
        </div>

        {/* Right Panel — Agent Feed + Proof */}
        <div className="flex flex-col gap-3 min-h-0">
          <motion.div custom={4} variants={panelVariants} initial="hidden" animate="show" className="flex-1 min-h-0">
            <Card className="p-4 h-full flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
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

          <motion.div custom={5} variants={panelVariants} initial="hidden" animate="show">
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
