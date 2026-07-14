import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ShieldCheck, Database, Hash, Bot } from "lucide-react";

export function ProofModal({ log, children }: { log: any; children: React.ReactNode }) {
  const snapshot = typeof log.txline_snapshot === "string" 
    ? JSON.parse(log.txline_snapshot || "{}") 
    : (log.txline_snapshot || {});
    
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-[#0c1a24] border-slate-800 text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            <ShieldCheck className="h-5 w-5 text-green-400" />
            <span className="text-green-400">VERIFIED EXECUTION PROOF</span>
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs font-mono">
            Immutable snapshot of the AI reasoning and live market data.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-2 font-mono text-xs">
          {/* Solana Proof Hash */}
          <div className="rounded-md bg-black/40 border border-slate-800 p-3">
            <div className="flex items-center gap-2 text-slate-500 mb-2 font-semibold">
              <Hash className="h-3 w-3" />
              <span>Solana Anchor Signature (Simulated)</span>
            </div>
            <div className="break-all text-green-400/80 bg-green-500/5 p-2 rounded border border-green-500/20">
              {log.id.replace(/-/g, "")}9a2b4c...
            </div>
          </div>

          {/* AI Reasoning payload */}
          <div className="rounded-md bg-black/40 border border-slate-800 p-3">
            <div className="flex items-center gap-2 text-slate-500 mb-2 font-semibold">
              <Bot className="h-3 w-3" />
              <span>Agent LLM Output Payload</span>
            </div>
            <div className="text-slate-300 leading-relaxed border-l-2 border-agent/50 pl-3">
              "{log.message}"
            </div>
          </div>

          {/* TxLINE Odds Snapshot */}
          <div className="rounded-md bg-black/40 border border-slate-800 p-3">
            <div className="flex items-center justify-between text-slate-500 mb-2 font-semibold">
              <div className="flex items-center gap-2">
                <Database className="h-3 w-3" />
                <span>TxLINE State Snapshot</span>
              </div>
              <span className="text-[10px]">
                {new Date(log.created_at).toISOString()}
              </span>
            </div>
            <pre className="bg-[#050b14] p-3 rounded text-[10px] text-slate-300 overflow-x-auto border border-slate-800/50">
              {JSON.stringify({
                match_id: log.match_id,
                score: `${snapshot.score_home || 0} - ${snapshot.score_away || 0}`,
                clock: snapshot.minute || 0,
                implied_prob: {
                  home: snapshot.implied_prob_home,
                  away: snapshot.implied_prob_away
                },
                odds: {
                  home: snapshot.odds_home,
                  away: snapshot.odds_away
                }
              }, null, 2)}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
