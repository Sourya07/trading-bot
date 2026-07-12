import { useTerminalStore } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { Info, Zap, CheckCircle, AlertTriangle, Bot } from "lucide-react";

const logVariants = {
  hidden: { opacity: 0, x: 30, scale: 0.95 },
  show: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 120, damping: 16 },
  },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

export function AgentFeed() {
  const agentLogs = useTerminalStore((s) => s.agentLogs);

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

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="space-y-2 pr-3">
        <AnimatePresence initial={false}>
          {agentLogs.map((log, i) => {
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
              <motion.div
                key={log.id}
                variants={logVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                layout
                className={`rounded-lg border p-3 ${borderClass} ${i === 0 ? glowClass : ""}`}
              >
                <div className="flex items-start gap-2.5">
                  <motion.div
                    className="mt-0.5 shrink-0"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                  >
                    {icon}
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed">{log.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1.5 font-mono-num">
                      {new Date(log.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}
