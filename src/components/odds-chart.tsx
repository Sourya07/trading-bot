import { useTerminalStore } from "@/lib/store";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";

const chartConfig = {
  probHome: { label: "Home Probability", color: "var(--chart-1)" },
  probAway: { label: "Away Probability", color: "var(--chart-2)" },
  probDraw: { label: "Draw Probability", color: "var(--chart-3)" },
};

export function OddsChart() {
  const oddsHistory = useTerminalStore((s) => s.oddsHistory);
  const currentMatch = useTerminalStore((s) => s.currentMatch);

  const data = oddsHistory.map((point, i) => ({
    index: i,
    probHome: Number(Number(point.implied_prob_home || 0).toFixed(1)),
    probAway: Number(Number(point.implied_prob_away || 0).toFixed(1)),
    probDraw: Number(Number(point.implied_prob_draw || 0).toFixed(1)),
    time: new Date(point.recorded_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  }));

  if (data.length === 0) {
    return (
      <motion.div
        className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="h-12 w-12 rounded-xl border border-border/30 flex items-center justify-center">
          <BarChart3 className="h-6 w-6 opacity-40 animate-pulse" />
        </div>
        <p>Waiting for TxLINE odds data...</p>
      </motion.div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-full min-h-[200px] w-full">
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
        <defs>
          <linearGradient id="gradHome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradAway" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradDraw" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.01} />
          </linearGradient>
          {/* Glow filter */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid strokeDasharray="3 6" stroke="oklch(1 0 0 / 5%)" vertical={false} />
        <XAxis dataKey="index" tickLine={false} axisLine={false} tick={false} />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ReferenceLine y={50} stroke="oklch(1 0 0 / 8%)" strokeDasharray="4 8" />
        <Area
          dataKey="probHome"
          stroke="var(--color-probHome)"
          strokeWidth={2.5}
          fill="url(#gradHome)"
          dot={false}
          activeDot={{ r: 5, fill: "var(--chart-1)", stroke: "var(--background)", strokeWidth: 2, filter: "url(#glow)" }}
          name={currentMatch?.home_team || "Home"}
          type="monotone"
        />
        <Area
          dataKey="probAway"
          stroke="var(--color-probAway)"
          strokeWidth={2.5}
          fill="url(#gradAway)"
          dot={false}
          activeDot={{ r: 5, fill: "var(--chart-2)", stroke: "var(--background)", strokeWidth: 2, filter: "url(#glow)" }}
          name={currentMatch?.away_team || "Away"}
          type="monotone"
        />
        <Area
          dataKey="probDraw"
          stroke="var(--color-probDraw)"
          strokeWidth={2}
          fill="url(#gradDraw)"
          dot={false}
          activeDot={{ r: 5, fill: "var(--chart-3)", stroke: "var(--background)", strokeWidth: 2, filter: "url(#glow)" }}
          name="Draw"
          type="monotone"
        />
      </AreaChart>
    </ChartContainer>
  );
}
