import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from "recharts";
import { ArrowUpRight, ShieldCheck, Activity } from "lucide-react";
import { Button } from "./ui/button";

const mockChartData = Array.from({ length: 50 }).map((_, i) => {
  const base = 60;
  const variance = Math.sin(i / 8) * 6 + Math.random() * 3;
  return {
    time: i,
    realMadrid: base + variance + (i / 10),
    dortmund: (100 - base) - variance - (i / 10),
  };
});

export function FeaturedMarket() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-12 relative rounded-3xl overflow-hidden border border-[#1b2b22] bg-gradient-to-br from-[#0e1613] via-[#0a100d] to-[#070b09]"
    >
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-[#1a3828]/20 via-transparent to-transparent pointer-events-none" />
      
      <div className="relative z-10 p-8 lg:p-10 flex flex-col lg:flex-row gap-10">
        
        {/* Left Content */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-full px-3 py-1.5">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span className="text-xs font-mono-num font-medium text-blue-400">12h : 45m : 30s</span>
              </div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">
                Champions League · Final
              </span>
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-black tracking-tighter text-white uppercase leading-[0.9] mb-4">
              WHO LIFTS THE<br />TROPHY?
            </h1>
            
            <p className="text-slate-300 font-medium mb-8">
              The ultimate showdown — Real Madrid vs B. Dortmund — Jun 1
            </p>
            
            <div className="space-y-3 max-w-md">
              {/* Real Madrid Button */}
              <button className="w-full flex items-center justify-between bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 transition-all rounded-xl p-3 group">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-800 text-[10px] font-bold px-2 py-1 rounded text-slate-300">RMA</div>
                  <span className="font-bold text-white group-hover:text-blue-400 transition-colors">Real Madrid</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xs font-mono-num font-medium text-slate-400">
                    $100 <span className="text-slate-600 mx-1">&gt;</span> <span className="text-blue-400">$145</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-bold text-white">
                    68%
                  </div>
                </div>
              </button>
              
              {/* Dortmund Button */}
              <button className="w-full flex items-center justify-between bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 transition-all rounded-xl p-3 group">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-800 text-[10px] font-bold px-2 py-1 rounded text-slate-300">BVB</div>
                  <span className="font-bold text-white group-hover:text-yellow-400 transition-colors">B. Dortmund</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xs font-mono-num font-medium text-slate-400">
                    $100 <span className="text-slate-600 mx-1">&gt;</span> <span className="text-yellow-400">$310</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-bold text-white">
                    32%
                  </div>
                </div>
              </button>
            </div>
          </div>
          
          <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4">
            <Button className="bg-white hover:bg-slate-200 text-black font-bold rounded-xl px-6 h-12">
              View market <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                TxLINE-compatible score data
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <Activity className="h-3.5 w-3.5 text-emerald-500" />
                Resolves from score data, not majority vote
              </div>
            </div>
          </div>
        </div>

        {/* Right Content - Chart */}
        <div className="flex-1 relative flex flex-col justify-center min-h-[300px]">
          <div className="absolute top-0 right-0 flex items-center gap-4">
            <div className="flex items-center gap-1 border border-white/10 rounded-full px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
              <CheckCircle2 className="h-3 w-3 text-slate-400" /> COMBO
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Activity className="h-4 w-4 text-emerald-500" /> Whistly <span className="text-white">Markets</span>
            </div>
          </div>
          
          <div className="mt-12 flex-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">
              Illustrative — Current odds from live pool
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRma" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorBvb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#facc15" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#facc15" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80]} tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} orientation="right" />
                  <ReferenceLine y={50} stroke="#334155" strokeDasharray="3 3" />
                  <Area type="stepAfter" dataKey="realMadrid" stroke="#60a5fa" strokeWidth={2} fillOpacity={1} fill="url(#colorRma)" />
                  <Area type="stepAfter" dataKey="dortmund" stroke="#facc15" strokeWidth={2} fillOpacity={1} fill="url(#colorBvb)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-2 px-2 font-mono-num">
              <span>02:34</span>
              <span>09:34</span>
              <span>16:34</span>
              <span>Now</span>
            </div>
            <div className="absolute right-4 top-[50%] -translate-y-4 flex flex-col gap-6 items-end pointer-events-none">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                Real Madrid 68%
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-yellow-400 mt-2">
                B. Dortmund 32%
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
              </div>
            </div>
          </div>
        </div>
        
      </div>
    </motion.div>
  );
}

function CheckCircle2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
