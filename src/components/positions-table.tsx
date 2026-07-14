import { Buffer } from "buffer";
import { useTerminalStore } from "@/lib/store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "./animated-number";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { useState } from "react";
import { type usePhantomWallet } from "@/lib/use-phantom-wallet";
import { settlePositionOnChain } from "@/lib/solanaClient";
import { api } from "@/lib/api";

const rowVariants = {
  hidden: { opacity: 0, x: 30 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    x: 0,
    transition: { type: "spring" as const, stiffness: 120, damping: 16, delay: i * 0.06 },
  }),
};

type Props = {
  wallet: ReturnType<typeof usePhantomWallet>;
};

export function PositionsTable({ wallet }: Props) {
  const positions = useTerminalStore((s) => s.positions);
  const currentMatch = useTerminalStore((s) => s.currentMatch);
  const settlements = useTerminalStore((s) => s.settlements);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const handleSettleOnChain = async (pos: any) => {
    if (!wallet.address || !wallet.publicKey) {
      alert("Please connect your Phantom Wallet first.");
      return;
    }

    const strategy = useTerminalStore.getState().strategy;
    if (!strategy) {
      alert("No active strategy loaded.");
      return;
    }

    let strategyPdaStr = "";
    try {
      const config = typeof strategy.rule_config === "string" ? JSON.parse(strategy.rule_config) : strategy.rule_config;
      strategyPdaStr = config?.strategy_pda || "";
    } catch {}

    if (!strategyPdaStr) {
      alert("No on-chain strategy account found for this position.");
      return;
    }

    setSettlingId(pos.id);
    try {
      const finalOutcome = currentMatch?.score_home! > currentMatch?.score_away! 
        ? "home" 
        : currentMatch?.score_away! > currentMatch?.score_home! 
          ? "away" 
          : "draw";

      const { PublicKey } = await import("@solana/web3.js");
      const userPubkey = wallet.publicKey;
      const strategyPda = new PublicKey(strategyPdaStr);
      
      const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), userPubkey.toBuffer(), strategyPda.toBuffer()],
        new PublicKey("BZ6W4B9Te3nnZWXd19QSaTXDxTF1rtC1je8roTDrorrk")
      );

      console.log("[On-Chain] Settling position on Solana devnet...");
      const result = await settlePositionOnChain(
        wallet,
        positionPda.toBase58(),
        finalOutcome,
        currentMatch?.score_home!,
        currentMatch?.score_away!,
        currentMatch?.txline_result_hash || "mock-result-hash"
      );

      console.log(`[On-Chain] Settlement tx signature: ${result.tx}`);

      // Record signature to database
      await api.recordSettlementSignature(pos.id, result.tx);

      // Reload settlements list
      const updatedSettlements = await api.getSettlements(currentMatch?.match_id!);
      useTerminalStore.getState().setSettlements(updatedSettlements);

      alert(`Successfully settled position on-chain!\nSignature: ${result.tx.substring(0, 24)}...`);
    } catch (err: any) {
      console.error("[On-Chain] Settlement failed:", err);
      alert(`On-chain settlement failed: ${err.message || err}`);
    } finally {
      setSettlingId(null);
    }
  };

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
              const currentProb = pos.side === "home" ? currentMatch?.implied_prob_home : pos.side === "away" ? currentMatch?.implied_prob_away : currentMatch?.implied_prob_draw;
              const unrealized = pos.status === "open" && currentProb !== undefined && currentProb !== null
                ? (pos.stake_credits * Number(pos.entry_odds) * (Number(currentProb) / 100)) - pos.stake_credits
                : 0;
              const showUnrealized = pos.status === "open" && unrealized !== 0;
              
              const settlement = settlements.find((s) => s.position_id === pos.id);
              const anchorSettleSig = settlement?.anchor_settle_signature;

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
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={pos.status === "open" ? "default" : "outline"}
                        className={`text-xs ${pos.status === "open" ? "bg-primary/15 text-primary border-primary/20" : "border-border/30"}`}
                      >
                        {pos.status}
                      </Badge>
                      {pos.status === "settled" && !anchorSettleSig && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-md font-medium"
                          onClick={() => handleSettleOnChain(pos)}
                          disabled={settlingId === pos.id}
                        >
                          {settlingId === pos.id ? "Settling..." : "Claim Payout"}
                        </Button>
                      )}
                      {pos.status === "settled" && anchorSettleSig && (
                        <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30 bg-green-500/5">
                          On-Chain
                        </Badge>
                      )}
                    </div>
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
