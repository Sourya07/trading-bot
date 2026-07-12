import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTerminalStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { MatchData } from "@/lib/types";
import { GlowCard } from "./glow-card";
import { AnimatedNumber } from "./animated-number";
import { Activity, Zap, Shield, TrendingUp } from "lucide-react";

type Props = {
  onOpenMatch: (matchId: string) => void;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "live") {
    return (
      <Badge variant="default" className="bg-profit/15 text-profit border border-profit/30 glow-profit">
        <span className="relative mr-1.5 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-profit opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-profit" />
        </span>
        LIVE
      </Badge>
    );
  }
  if (status === "final") {
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        FINAL
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground border-border/50">
      SCHEDULED
    </Badge>
  );
}

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
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "TBD";

  return (
    <GlowCard
      className="rounded-xl"
      glowColor={match.status === "live" ? "oklch(0.72 0.2 148 / 15%)" : "oklch(0.72 0.19 195 / 12%)"}
      borderGlow={match.status === "live"}
    >
      <Card className="p-5 cursor-pointer group" onClick={onOpen}>
        {/* Status & time */}
        <div className="flex items-center justify-between mb-5">
          <StatusBadge status={match.status} />
          <span className="text-[11px] text-muted-foreground font-mono-num">{kickoff}</span>
        </div>

        {/* Teams & Score */}
        <div className="flex items-center justify-between mb-5">
          {/* Home */}
          <div className="flex-1 text-center">
            <div className="relative h-14 w-14 mx-auto mb-2">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15 flex items-center justify-center animate-float" style={{ animationDelay: '0s' }}>
                <span className="text-primary font-bold text-xl">{match.home_team[0]}</span>
              </div>
            </div>
            <p className="font-semibold text-sm">{match.home_team}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Home</p>
          </div>

          {/* Score */}
          <div className="px-3">
            {match.status === "live" || match.status === "final" ? (
              <div className="text-center">
                <div className="font-mono-num text-2xl font-bold flex items-center gap-2.5 score-3d">
                  <AnimatedNumber value={match.score_home} decimals={0} className={match.status === "live" ? "text-glow-primary" : ""} />
                  <span className="text-muted-foreground text-lg">:</span>
                  <AnimatedNumber value={match.score_away} decimals={0} className={match.status === "live" ? "text-glow-primary" : ""} />
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm font-mono-num px-3 py-1 rounded-lg bg-border/5 border border-border/30">
                VS
              </div>
            )}
          </div>

          {/* Away */}
          <div className="flex-1 text-center">
            <div className="relative h-14 w-14 mx-auto mb-2">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-chart-2/20 to-chart-2/5 border border-chart-2/15 flex items-center justify-center animate-float" style={{ animationDelay: '0.5s' }}>
                <span className="text-chart-2 font-bold text-xl">{match.away_team[0]}</span>
              </div>
            </div>
            <p className="font-semibold text-sm">{match.away_team}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Away</p>
          </div>
        </div>

        {/* Odds */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-5 px-2 py-2.5 rounded-lg bg-border/5 border border-border/20">
          <div className="text-center flex-1">
            <p className="text-[10px] uppercase tracking-wider mb-0.5">Home</p>
            <AnimatedNumber value={Number(match.odds_home)} decimals={2} className="text-foreground font-semibold text-sm" />
          </div>
          <div className="h-6 w-px bg-border/30" />
          <div className="text-center flex-1">
            <p className="text-[10px] uppercase tracking-wider mb-0.5">Draw</p>
            <AnimatedNumber value={Number(match.odds_draw)} decimals={2} className="text-foreground font-semibold text-sm" />
          </div>
          <div className="h-6 w-px bg-border/30" />
          <div className="text-center flex-1">
            <p className="text-[10px] uppercase tracking-wider mb-0.5">Away</p>
            <AnimatedNumber value={Number(match.odds_away)} decimals={2} className="text-foreground font-semibold text-sm" />
          </div>
        </div>

        {/* CTA */}
        <Button
          variant="outline"
          className="w-full group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/30 transition-all duration-300 gap-2"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Open Terminal
        </Button>
      </Card>
    </GlowCard>
  );
}
