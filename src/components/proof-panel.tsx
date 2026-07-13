import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTerminalStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ExternalLink, Copy, CheckCircle, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatedNumber } from "./animated-number";
import type { DevnetProgramStatus } from "@/lib/types";

export function ProofPanel({ matchId, wallet }: { matchId: string; wallet: any }) {
  const settlements = useTerminalStore((s) => s.settlements);
  const setSettlements = useTerminalStore((s) => s.setSettlements);
  const currentMatch = useTerminalStore((s) => s.currentMatch);
  const [copied, setCopied] = useState<string | null>(null);
  const [devnetStatus, setDevnetStatus] = useState<DevnetProgramStatus | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    setCurrentPage(0);
  }, [matchId, settlements.length]);

  useEffect(() => {
    api.getSettlements(matchId, wallet.address || "").then(setSettlements).catch(() => {});
  }, [matchId, wallet.address, setSettlements]);

  useEffect(() => {
    api.getDevnetStatus().then(setDevnetStatus).catch(() => {});
  }, []);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (settlements.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className={`h-8 w-8 rounded-lg border flex items-center justify-center ${
            devnetStatus?.deployed ? "border-profit/25 bg-profit/10" : "border-border/30"
          }`}>
            {devnetStatus?.deployed ? (
              <ShieldCheck className="h-4 w-4 text-profit" />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground opacity-50" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm">Settlement Proof</h3>
            <p className="text-[10px] text-muted-foreground">
              {devnetStatus?.cluster ? `Solana ${devnetStatus.cluster}` : "On-chain verification"}
            </p>
          </div>
          {devnetStatus?.deployed && (
            <Badge variant="outline" className="ml-auto text-xs text-profit border-profit/25 bg-profit/8">
              Program live
            </Badge>
          )}
        </div>
        {devnetStatus ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              TxHedge is connected to the deployed devnet program. Settlement receipts will appear here once this match is finalized.
            </p>
            <div className="rounded-lg border border-border/30 bg-border/5 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Program ID</span>
                <Button variant="ghost" size="sm" className="h-5 px-1.5" onClick={() => copyText(devnetStatus.programId, "program")}>
                  {copied === "program" ? <CheckCircle className="h-3 w-3 text-profit" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <p className="break-all font-mono-num text-[10px] text-foreground/80">{devnetStatus.programId}</p>
              {devnetStatus.error && (
                <p className="text-[10px] text-loss leading-relaxed">{devnetStatus.error}</p>
              )}
              <a href={devnetStatus.explorerUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="mt-1 w-full text-xs gap-1.5 border-primary/20 hover:bg-primary/5">
                  <ExternalLink className="h-3 w-3" />
                  View program on Solscan
                </Button>
              </a>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Checking Solana devnet program status...
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <motion.div
          className="h-8 w-8 rounded-lg bg-profit/10 border border-profit/20 flex items-center justify-center"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <ShieldCheck className="h-4 w-4 text-profit" />
        </motion.div>
        <div>
          <h3 className="font-semibold text-sm">Settlement Proof</h3>
          <p className="text-[10px] text-muted-foreground">Cryptographic verification</p>
        </div>
        <Badge variant="outline" className="text-xs text-profit border-profit/25 bg-profit/8 ml-auto glow-profit gap-1">
          <CheckCircle className="h-3 w-3" />
          Verified
        </Badge>
      </div>
      <div className="space-y-3">
        <AnimatePresence mode="wait">
          {(() => {
            const s = settlements[currentPage];
            if (!s) return null;

            const match = currentMatch;
            const outcomeLabel = s.final_outcome === "home" ? match?.home_team : s.final_outcome === "away" ? match?.away_team : "Draw";
            const pnl = Number(s.pnl_credits);
            const explorerUrl = s.anchor_settle_signature
              ? `https://solscan.io/tx/${s.anchor_settle_signature}?cluster=devnet`
              : null;

            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: "spring", stiffness: 120, damping: 15 }}
                className={`rounded-lg border p-3 space-y-2.5 ${pnl >= 0 ? "border-profit/20 bg-profit/5" : "border-loss/20 bg-loss/5"}`}
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-profit" />
                  <p className="text-xs font-semibold text-profit">Settled</p>
                </div>
                <p className="text-xs leading-relaxed">
                  Final score{" "}
                  <span className="font-mono-num font-bold text-foreground">{s.final_score_home}–{s.final_score_away}</span>
                  {" — winner: "}
                  <span className="font-semibold text-foreground">{outcomeLabel}</span>
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">P&L</span>
                  <span className={`font-mono-num font-semibold ${pnl > 0 ? "text-profit text-glow-profit" : pnl < 0 ? "text-loss text-glow-loss" : "text-muted-foreground"}`}>
                    <AnimatedNumber value={pnl} decimals={1} prefix={pnl > 0 ? "+" : ""} suffix=" credits" />
                  </span>
                </div>
                {s.txline_result_hash && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">TxLINE Hash</span>
                      <Button variant="ghost" size="sm" className="h-5 px-1.5" onClick={() => copyText(s.txline_result_hash!, "txline-" + s.id)}>
                        {copied === "txline-" + s.id ? <CheckCircle className="h-3 w-3 text-profit" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    <p className="text-[10px] font-mono-num shimmer-hash break-all leading-relaxed">{s.txline_result_hash}</p>
                  </div>
                )}
                {explorerUrl && (
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 border-profit/20 hover:bg-profit/5 hover:text-profit hover:border-profit/30">
                        <ExternalLink className="h-3 w-3" />
                        View on Solscan
                      </Button>
                    </motion.div>
                  </a>
                )}
                {!s.anchor_settle_signature && (
                  <div className="text-[10px] text-amber-400/80 italic flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    On-chain payout pending claim — click "Claim Payout" in the positions table to settle.
                  </div>
                )}
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Pagination controls */}
        {settlements.length > 1 && (
          <div className="flex items-center justify-between border-t border-slate-900 pt-2.5 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="h-7 w-7 p-0 border-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[10px] text-slate-500 font-mono font-semibold">
              Proof {currentPage + 1} of {settlements.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(settlements.length - 1, prev + 1))}
              disabled={currentPage === settlements.length - 1}
              className="h-7 w-7 p-0 border-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
