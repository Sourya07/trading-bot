import { useState, useEffect } from "react";
import { useTerminalStore } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Info, Zap, CheckCircle, AlertTriangle, Bot, ChevronLeft, ChevronRight } from "lucide-react";
import { ProofModal } from "./proof-modal";


export function AgentFeed() {
  const agentLogs = useTerminalStore((s) => s.agentLogs);
  const [currentPage, setCurrentPage] = useState(0);
  const LOGS_PER_PAGE = 3;

  useEffect(() => {
    setCurrentPage(0);
  }, [agentLogs.length]);

  if (agentLogs.length === 0) {
    return (
      <motion.div
        className="flex-1 flex items-center justify-center text-muted-foreground text-sm text-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div>
          <div className="h-12 w-12 mx-auto mb-3 rounded-xl border border-border/30 flex items-center justify-center">
            <Bot className="h-6 w-6 opacity-40" />
          </div>
          <p className="text-sm">Agent reasoning will appear here once a strategy is active.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Create a strategy and start the agent to begin monitoring</p>
        </div>
      </motion.div>
    );
  }

  const totalPages = Math.ceil(agentLogs.length / LOGS_PER_PAGE);
  const paginatedLogs = agentLogs.slice(currentPage * LOGS_PER_PAGE, (currentPage + 1) * LOGS_PER_PAGE);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-2 pr-3 pb-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              {paginatedLogs.map((log, index) => {
                const globalIndex = currentPage * LOGS_PER_PAGE + index;
                const icon =
                  log.event_type === "trigger" ? (
                    <Zap className="h-3.5 w-3.5 text-agent" />
                  ) : log.event_type === "settle" ? (
                    <CheckCircle className="h-3.5 w-3.5 text-profit" />
                  ) : log.event_type === "warning" ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-loss" />
                  ) : (
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  );

                const borderClass =
                  log.event_type === "trigger"
                    ? "border-agent/25 bg-agent/5"
                    : log.event_type === "settle"
                      ? "border-profit/25 bg-profit/5"
                      : log.event_type === "warning"
                        ? "border-loss/25 bg-loss/5"
                        : "border-border/40 bg-border/3";

                const glowClass =
                  log.event_type === "trigger" ? "glow-agent" : log.event_type === "settle" ? "glow-profit" : "";

                return (
                  <div
                    key={log.id}
                    className={`rounded-lg border p-3 ${borderClass} ${globalIndex === 0 ? glowClass : ""}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed">{log.message}</p>
                        <div className="flex items-center justify-between mt-2.5">
                          <p className="text-[10px] text-muted-foreground font-mono-num">
                            {new Date(log.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </p>
                          <ProofModal log={log}>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-5 px-2 text-[9px] uppercase tracking-wider bg-agent/10 hover:bg-agent/20 text-agent border border-agent/20 rounded-sm"
                            >
                              Verify Proof
                            </Button>
                          </ProofModal>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Pagination controls */}
      {totalPages > 1 && (
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
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage === totalPages - 1}
            className="h-7 w-7 p-0 border-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
