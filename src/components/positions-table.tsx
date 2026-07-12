import { useTerminalStore } from "@/lib/store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "./animated-number";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";

const rowVariants = {
  hidden: { opacity: 0, x: 30 },
  show: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 120, damping: 16, delay: i * 0.06 },
  }),
};

export function PositionsTable() {
  const positions = useTerminalStore((s) => s.positions);
  const currentMatch = useTerminalStore((s) => s.currentMatch);

  if (positions.length === 0) {
    return (
      <motion.div
        className="text-center py-8 text-muted-foreground text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="h-10 w-10 mx-auto mb-3 rounded-xl border border-border/30 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 opacity-40" />
        </div>
        <p>No positions yet.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Create a strategy and start the agent to open positions.</p>
      </motion.div>
    );
  }

  return (
    <div>
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        Positions & P&L
      </h3>
      <Table>
        <TableHeader>
          <TableRow className="border-border/30">
            <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Type</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Side</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Entry</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Stake</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground text-right">P&L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <AnimatePresence initial={false}>
            {positions.map((pos, i) => {
              const sideLabel = pos.side === "home" ? currentMatch?.home_team || "Home" : pos.side === "away" ? currentMatch?.away_team || "Away" : "Draw";
              const pnl = pos.status === "settled" ? Number(pos.pnl_credits) : 0;
              const currentProb = pos.side === "home" ? currentMatch?.implied_prob_home : pos.side === "away" ? currentMatch?.implied_prob_away : 0;
              const unrealized = pos.status === "open" && currentProb
                ? pos.stake_credits * (Number(pos.entry_odds) - 1) * (Number(currentProb) / Number(pos.entry_odds) / 100) - pos.stake_credits
                : 0;
              const showUnrealized = pos.status === "open" && unrealized !== 0;

              return (
                <motion.tr
                  key={pos.id}
                  custom={i}
                  variants={rowVariants}
                  initial="hidden"
                  animate="show"
                  className="border-border/20 hover:bg-border/5 transition-colors"
                >
                  <TableCell>
                    <Badge
                      variant={pos.position_type === "hedge" ? "secondary" : "outline"}
                      className={`text-xs ${pos.position_type === "hedge" ? "bg-agent/10 text-agent border-agent/20" : "border-border/30"}`}
                    >
                      {pos.position_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-medium">{sideLabel}</TableCell>
                  <TableCell className="text-xs">
                    <AnimatedNumber value={Number(pos.entry_odds)} decimals={2} />
                  </TableCell>
                  <TableCell className="text-xs font-mono-num">{pos.stake_credits}</TableCell>
                  <TableCell>
                    <Badge
                      variant={pos.status === "open" ? "default" : "outline"}
                      className={`text-xs ${pos.status === "open" ? "bg-primary/15 text-primary border-primary/20" : "border-border/30"}`}
                    >
                      {pos.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-right">
                    {pos.status === "settled" ? (
                      <span className={`font-mono-num font-semibold flex items-center justify-end gap-1 ${pnl > 0 ? "text-profit text-glow-profit" : pnl < 0 ? "text-loss text-glow-loss" : "text-muted-foreground"}`}>
                        {pnl > 0 ? <TrendingUp className="h-3 w-3" /> : pnl < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        <AnimatedNumber value={pnl} decimals={1} prefix={pnl > 0 ? "+" : ""} />
                      </span>
                    ) : showUnrealized ? (
                      <span className={`font-mono-num flex items-center justify-end gap-1 ${unrealized > 0 ? "text-profit" : "text-loss"}`}>
                        {unrealized > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <AnimatedNumber value={unrealized} decimals={1} prefix={unrealized > 0 ? "+" : ""} />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </TableBody>
      </Table>
    </div>
  );
}
