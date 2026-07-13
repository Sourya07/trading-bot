import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useTerminalStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { StrategyData } from "@/lib/types";
import type { usePhantomWallet } from "@/lib/use-phantom-wallet";
import { Play, Square, Zap, Shield, Wallet } from "lucide-react";
import { createStrategyOnChain, createPositionOnChain } from "@/lib/solanaClient";

type Props = {
  strategy?: StrategyData;
  wallet: ReturnType<typeof usePhantomWallet>;
  matchId: string;
  onCreated?: () => void;
};

const TEMPLATES = [
  { value: "goal_shift_hedge", label: "Goal-Shift Hedge", description: "Hedge when opponent scores" },
  { value: "momentum", label: "Momentum", description: "Buy rising probability" },
  { value: "mean_reversion", label: "Mean Reversion", description: "Enter on odds spike" },
];

const fieldVariants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 120, damping: 14, delay: i * 0.06 },
  }),
};

export function StrategyPanel({ strategy, wallet, matchId, onCreated }: Props) {
  const [template, setTemplate] = useState("goal_shift_hedge");
  const [primarySide, setPrimarySide] = useState("home");
  const [primaryStake, setPrimaryStake] = useState(100);
  const [hedgeStake, setHedgeStake] = useState(50);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState(false);

  const setStrategy = useTerminalStore((s) => s.setStrategy);
  const addAgentLog = useTerminalStore((s) => s.addAgentLog);
  const addPosition = useTerminalStore((s) => s.addPosition);
  const currentMatch = useTerminalStore((s) => s.currentMatch);

  const handleCreate = async () => {
    if (!wallet.address) return;
    setCreating(true);
    try {
      console.log("[On-Chain] Preparing strategy parameters...");
      // Append a timestamp to matchId to ensure the PDA seed is unique on recreate
      const uniqueMatchId = `${matchId}-${Date.now()}`;
      
      const configStr = JSON.stringify({ primarySide, primaryStake, hedgeStake });
      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(configStr));
      const ruleConfigHash = Array.from(new Uint8Array(hashBuffer));
      
      console.log("[On-Chain] Creating strategy account on Solana...");
      const stratResult = await createStrategyOnChain(wallet, uniqueMatchId, "winner", ruleConfigHash);
      console.log(`[On-Chain] Strategy created. Signature: ${stratResult.tx}`);

      const newStrategy = await api.createStrategy(
        wallet.address,
        matchId,
        template,
        {
          primary_side: primarySide,
          primary_stake: primaryStake,
          hedge_stake: hedgeStake,
          strategy_pda: stratResult.strategyPda,
        },
        stratResult.tx
      );
      setStrategy(newStrategy);

      const match = useTerminalStore.getState().currentMatch;
      const entryOdds = primarySide === "home" ? Number(match?.odds_home) : Number(match?.odds_away);
      
      console.log("[On-Chain] Creating position account on Solana...");
      const posResult = await createPositionOnChain(
        wallet,
        stratResult.strategyPda,
        primarySide as "home" | "away" | "draw",
        entryOdds,
        primaryStake
      );
      console.log(`[On-Chain] Position created. Signature: ${posResult.tx}`);

      const sideLabel = primarySide === "home" ? match?.home_team : match?.away_team;
      await api.createPosition({
        strategy_id: newStrategy.id,
        match_id: matchId,
        wallet: wallet.address,
        side: primarySide,
        entry_odds: entryOdds,
        stake_credits: primaryStake,
        position_type: "primary",
        trigger_reason: `Initial primary position on ${sideLabel} at ${entryOdds.toFixed(2)} odds`,
        anchor_position_signature: posResult.tx,
      }).then((pos) => {
        if (pos) addPosition(pos);
      });

      addAgentLog({
        id: crypto.randomUUID(),
        strategy_id: newStrategy.id,
        match_id: matchId,
        event_type: "info",
        message: `Strategy created on-chain: ${template.replace(/_/g, " ")}. Primary position of ${primaryStake} credits placed on ${sideLabel}. Signature: ${stratResult.tx.substring(0, 12)}...`,
        txline_snapshot: {},
        created_at: new Date().toISOString(),
      });

      // Refresh wallet balance from API
      await api.getWallet(wallet.address).then((w) => {
        useTerminalStore.getState().setWalletBalance(w.balance);
      }).catch(console.error);

      onCreated?.();
    } catch (e: any) {
      console.error("[On-Chain] Error creating strategy/position:", e);
      const logs = e.logs || e.transactionLogs || [];
      if (logs.length > 0) {
        console.log("[On-Chain] Transaction Logs:", logs);
      }
      alert(`On-chain transaction failed: ${e.message || e}${logs.length > 0 ? `\n\nLogs:\n${logs.slice(0, 8).join("\n")}` : ""}`);
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async () => {
    if (!strategy) return;
    setToggling(true);
    try {
      const updated = await api.toggleAgent(strategy.id, !strategy.agent_active);
      setStrategy(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setToggling(false);
    }
  };

  // ── Active Strategy View ──
  if (strategy) {
    const templateInfo = TEMPLATES.find((t) => t.value === strategy.template);
    const ruleConfig = strategy.rule_config as Record<string, unknown>;

    return (
      <motion.div
        className="space-y-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 14 }}
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs border-primary/20 bg-primary/5 text-primary gap-1">
            <Zap className="h-3 w-3" />
            {templateInfo?.label || strategy.template}
          </Badge>
        </div>

        <div className="space-y-2 text-xs rounded-lg bg-border/5 border border-border/20 p-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Primary Side</span>
            <span className="font-mono-num font-medium">{(ruleConfig?.primary_side as string) || "home"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Primary Stake</span>
            <span className="font-mono-num font-medium">{(ruleConfig?.primary_stake as number) || 100} credits</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hedge Stake</span>
            <span className="font-mono-num font-medium">{(ruleConfig?.hedge_stake as number) || 50} credits</span>
          </div>
        </div>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          {currentMatch?.status === "final" ? (
            <Button
              disabled
              variant="outline"
              size="sm"
              className="w-full gap-1.5 bg-slate-900/50 text-slate-500 border-slate-800"
            >
              Match Finalized
            </Button>
          ) : (
            <Button
              onClick={handleToggle}
              disabled={toggling}
              variant={strategy.agent_active ? "default" : "outline"}
              size="sm"
              className={`w-full gap-1.5 ${
                strategy.agent_active
                  ? "bg-gradient-to-r from-loss/80 to-loss/60 hover:from-loss/70 hover:to-loss/50 text-white border-0"
                  : "bg-gradient-to-r from-profit/80 to-profit/60 hover:from-profit/70 hover:to-profit/50 text-white border-0"
              }`}
            >
              {strategy.agent_active ? (
                <><Square className="h-3.5 w-3.5" /> Stop Agent</>
              ) : (
                <><Play className="h-3.5 w-3.5" /> Start Agent</>
              )}
            </Button>
          )}
        </motion.div>
      </motion.div>
    );
  }

  // ── Create Strategy Form ──
  return (
    <div className="space-y-3">
      <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="show">
        <Label className="text-xs mb-1.5 block text-muted-foreground uppercase tracking-wider">Strategy Template</Label>
        <Select value={template} onValueChange={setTemplate}>
          <SelectTrigger className="h-9 text-xs bg-border/5 border-border/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                <div>
                  <span className="font-medium">{t.label}</span>
                  <span className="text-muted-foreground ml-1.5">— {t.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="show">
        <Label className="text-xs mb-1.5 block text-muted-foreground uppercase tracking-wider">Primary Side</Label>
        <Select value={primarySide} onValueChange={setPrimarySide}>
          <SelectTrigger className="h-9 text-xs bg-border/5 border-border/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="home" className="text-xs">Home Team</SelectItem>
            <SelectItem value="away" className="text-xs">Away Team</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="show">
        <Label className="text-xs mb-1.5 block text-muted-foreground uppercase tracking-wider">Primary Stake</Label>
        <Input type="number" value={primaryStake} onChange={(e) => setPrimaryStake(Number(e.target.value))} className="h-9 text-xs font-mono-num bg-border/5 border-border/20" />
      </motion.div>

      <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="show">
        <Label className="text-xs mb-1.5 block text-muted-foreground uppercase tracking-wider">Hedge Stake</Label>
        <Input type="number" value={hedgeStake} onChange={(e) => setHedgeStake(Number(e.target.value))} className="h-9 text-xs font-mono-num bg-border/5 border-border/20" />
      </motion.div>

      <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="show">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={handleCreate}
            disabled={creating || !wallet.connected || currentMatch?.status === "final"}
            size="sm"
            className="w-full gap-1.5 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <Shield className="h-3.5 w-3.5" />
            {creating ? "Creating..." : currentMatch?.status === "final" ? "Match Finalized" : "Create Strategy"}
          </Button>
        </motion.div>
        {!wallet.connected && (
          <p className="text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-1.5">
            <Wallet className="h-3 w-3" />
            Connect Phantom wallet to create a strategy
          </p>
        )}
      </motion.div>
    </div>
  );
}
