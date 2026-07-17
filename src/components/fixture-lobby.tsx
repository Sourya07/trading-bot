import { useEffect } from "react";
import { motion } from "framer-motion";
import { useTerminalStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { MatchData } from "@/lib/types";
import { GlowCard } from "./glow-card";
import { AnimatedNumber } from "./animated-number";
import { Activity, Zap, Shield, Users, Flame, LineChart, Trophy } from "lucide-react";
import { getFlag } from "@/lib/flags";
import { FeaturedMarket } from "./featured-market";
import { Button } from "./ui/button";

type Props = {
  onOpenMatch: (matchId: string) => void;
};

export function FixtureLobby({ onOpenMatch }: Props) {
  const matches = useTerminalStore((s) => s.matches);

  useEffect(() => {
    const interval = setInterval(() => {
      api.getFixtures().then(useTerminalStore.getState().setMatches).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      {/* Title block */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="h-5 w-5 text-primary animate-pulse" />
          <h2 className="text-3xl font-black tracking-tight text-white uppercase">World Cup Fixtures</h2>
        </div>
        <p className="text-muted-foreground text-sm max-w-lg leading-relaxed">
          Select a live or scheduled match below to open the verifiable hedging terminal. Monitor real-time odds fluctuations and cryptographic proof states.
        </p>
      </div>
      
      <FeaturedMarket />

      {/* Stats row */}
      <motion.div
        className="grid grid-cols-3 gap-4 mb-10"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {[
          { label: "Live Matches", value: matches.filter((m) => m.status === "live").length, icon: Zap, color: "text-profit" },
          { label: "Total Fixtures", value: matches.length, icon: Activity, color: "text-txline" },
          { label: "Data Source", value: "TxLINE", icon: Shield, color: "text-agent", isText: true },
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass-panel rounded-xl p-4 flex items-center gap-3 border-shimmer"
          >
            <div className={`h-9 w-9 rounded-lg bg-current/10 flex items-center justify-center ${stat.color}`} style={{ backgroundColor: 'currentColor', opacity: 0.1, position: 'relative' }}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} style={{ position: 'absolute' }} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              {stat.isText ? (
                <p className={`font-semibold text-sm ${stat.color}`}>{stat.value}</p>
              ) : (
                <p className={`font-semibold text-lg font-mono-num ${stat.color}`}>{stat.value}</p>
              )}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Fixture Grid */}
      {matches.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <div className="h-10 w-10 mx-auto mb-4 rounded-full border border-border flex items-center justify-center">
            <Activity className="h-5 w-5 animate-pulse" />
          </div>
          <p>Loading fixtures from TxLINE...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((match, i) => (
            <motion.div
              key={match.match_id}
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 90,
                damping: 14,
                delay: i * 0.08 + 0.1
              }}
            >
              <FixtureCard match={match} onOpen={() => onOpenMatch(match.match_id)} />
            </motion.div>
          ))}
        </div>
      )}
    </main>
  );
}

function FixtureCard({ match, onOpen }: { match: MatchData; onOpen: () => void }) {
  const kickoff = match.kickoff_time
    ? new Date(match.kickoff_time).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "TBD";

  // Simulate viewer count based on match ID to match the image's "27,884" / "10,022" style
  const viewers = (
    12400 +
    ((match.match_id.charCodeAt(0) * 8741) % 18500)
  ).toLocaleString();

  // Generate bet percentage dynamically based on odds for a realistic "Popularity" flame badge
  const oddsHomeNum = Number(match.odds_home) || 2.0;
  const impliedHomeProb = Math.min(94, Math.max(28, Math.round(100 / oddsHomeNum) + (match.match_id.charCodeAt(0) % 10)));
  
  return (
    <GlowCard
      className="rounded-xl overflow-hidden"
      glowColor={match.status === "live" ? "oklch(0.72 0.2 148 / 15%)" : "oklch(0.72 0.19 195 / 10%)"}
      borderGlow={match.status === "live"}
    >
      <div 
        onClick={onOpen}
        className="p-5 cursor-pointer bg-[#0e212b] border border-[#1b3440] hover:border-[#274b5b] transition-all duration-300 rounded-xl group relative overflow-hidden flex flex-col justify-between min-h-[260px] select-none"
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mb-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-semibold">{kickoff}</span>
            <LineChart className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[8px] font-bold text-white bg-slate-800 border border-slate-700/80 px-1 py-0.2 rounded-sm tracking-wide">SGM</span>
            {match.status === "live" && (
              <span className="flex h-2 w-2 relative ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-profit opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-profit"></span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1 text-slate-400">
              <Users className="h-3.5 w-3.5" />
              <span className="font-mono-num font-semibold">{viewers}</span>
            </div>
            <Trophy className={`h-3.5 w-3.5 text-amber-500/80 ${match.status === "live" ? "animate-spin" : ""}`} style={{ animationDuration: '6s' }} />
          </div>
        </div>

        {/* Middle Competitors Section */}
        <div className="flex items-center justify-between py-2 mb-4">
          {/* Home Flag */}
          <div className="flex-shrink-0 text-4xl bg-slate-900/40 p-2 rounded-xl border border-slate-800/40 w-16 h-16 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
            {getFlag(match.home_team)}
          </div>

          {/* Centered Competitor Names */}
          <div className="flex-1 text-center px-4 space-y-1">
            <div className="text-[15px] font-bold text-white tracking-wide truncate max-w-[150px] mx-auto group-hover:text-primary transition-colors">
              {match.home_team}
            </div>
            
            {/* Score or VS badge */}
            <div className="flex items-center justify-center gap-2 py-0.5">
              {match.status === "live" || match.status === "final" ? (
                <div className="font-mono-num text-base font-extrabold text-emerald-400 bg-emerald-950/40 px-2.5 py-0.5 rounded border border-emerald-900/40 shadow-sm flex items-center gap-1.5">
                  <AnimatedNumber value={match.score_home} decimals={0} />
                  <span className="text-emerald-500/50 text-xs">-</span>
                  <AnimatedNumber value={match.score_away} decimals={0} />
                </div>
              ) : (
                <div className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800/40">
                  VS
                </div>
              )}
            </div>

            <div className="text-[15px] font-bold text-white tracking-wide truncate max-w-[150px] mx-auto group-hover:text-primary transition-colors">
              {match.away_team}
            </div>
          </div>

          {/* Away Flag */}
          <div className="flex-shrink-0 text-4xl bg-slate-900/40 p-2 rounded-xl border border-slate-800/40 w-16 h-16 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
            {getFlag(match.away_team)}
          </div>
        </div>

        {/* Popularity Badge Row */}
        <div className="flex items-center gap-1.5 text-xs text-amber-500/90 font-medium mb-4 bg-amber-950/15 border border-amber-900/20 py-1.5 px-3 rounded-lg w-full">
          <Flame className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
          <span className="truncate">{impliedHomeProb}% of 1x2 bets on {match.home_team}</span>
        </div>

        {/* Bottom Odds Row */}
        <div className="grid grid-cols-3 gap-2">
          {/* Home Odds */}
          <div className="flex flex-col items-center justify-center bg-[#07131b] hover:bg-[#0c222e] border border-[#132a35] hover:border-[#1d4051] transition-all rounded-lg py-1.5 px-2 text-center">
            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider truncate max-w-full">
              {match.home_team.split(" ")[0]}
            </span>
            <span className="text-xs font-mono-num font-bold text-[#38bdf8] mt-0.5">
              <AnimatedNumber value={Number(match.odds_home)} decimals={2} />
            </span>
          </div>

          {/* Draw Odds */}
          <div className="flex flex-col items-center justify-center bg-[#07131b] hover:bg-[#0c222e] border border-[#132a35] hover:border-[#1d4051] transition-all rounded-lg py-1.5 px-2 text-center">
            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Draw</span>
            <span className="text-xs font-mono-num font-bold text-[#38bdf8] mt-0.5">
              <AnimatedNumber value={Number(match.odds_draw)} decimals={2} />
            </span>
          </div>

          {/* Away Odds */}
          <div className="flex flex-col items-center justify-center bg-[#07131b] hover:bg-[#0c222e] border border-[#132a35] hover:border-[#1d4051] transition-all rounded-lg py-1.5 px-2 text-center">
            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider truncate max-w-full">
              {match.away_team.split(" ")[0]}
            </span>
            <span className="text-xs font-mono-num font-bold text-[#38bdf8] mt-0.5">
              <AnimatedNumber value={Number(match.odds_away)} decimals={2} />
            </span>
          </div>
        </div>

        {/* Auto-Hedge Button */}
        <div className="mt-3 overflow-hidden rounded-lg">
          <Button 
            className="w-full h-8 text-[10px] font-bold tracking-wider uppercase bg-emerald-950/30 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-900/50 hover:border-emerald-500/50 transition-all flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <Shield className="h-3 w-3 mr-1.5" />
            Auto-Hedge
          </Button>
        </div>
      </div>
    </GlowCard>
  );
}
