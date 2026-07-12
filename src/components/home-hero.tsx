import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, ArrowDown, Activity, Shield, Cpu, ArrowRight } from "lucide-react";
import type { usePhantomWallet } from "@/lib/use-phantom-wallet";

type Props = {
  onStartHedging: () => void;
  wallet: ReturnType<typeof usePhantomWallet>;
  matchesCount: number;
};

export function HomeHero({ onStartHedging, wallet, matchesCount }: Props) {
  const scrollToFeatures = () => {
    document.getElementById("features-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-transparent">
      {/* ── Section 1: Main Hero ── */}
      <section className="hero-3d relative mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl flex-col justify-between overflow-hidden px-5 pb-8 pt-10 lg:px-8">
        <div className="hero-depth-grid" aria-hidden="true" />
        <div className="hero-topline">
          <span>Inspire</span>
          <span>Innovate</span>
          <span>Impact</span>
        </div>

        <motion.div 
          className="hero-copy"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 18 }}
        >
          <Badge variant="outline" className="hero-kicker">
            Solana x TxLINE demo terminal
          </Badge>
          <h2>
            Designed to
            <span> move markets.</span>
          </h2>
          <p>
            A cinematic hedging terminal for live fixtures, automated momentum strategies, and cryptographic settlement proofs on Solana devnet.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button 
              size="lg" 
              className="hero-primary-button"
              onClick={onStartHedging}
            >
              <TrendingUp className="h-4 w-4" />
              Start hedging
            </Button>
            {!wallet.connected && (
              <Button size="lg" variant="outline" onClick={wallet.connect} className="hero-secondary-button">
                Connect Wallet
              </Button>
            )}
          </div>
        </motion.div>

        <div className="hero-footer">
          <div>
            <span>Est. 2026</span>
            <strong>{matchesCount || "12"} fixtures shaping digital odds.</strong>
          </div>
          <button onClick={scrollToFeatures} className="animate-bounce">
            <ArrowDown className="h-4 w-4" />
            Explore features
          </button>
          <div>
            <span>Powered by</span>
            <strong>Solana devnet + TxLINE proofs.</strong>
          </div>
        </div>
      </section>

      {/* ── Section 2: Features Showcase (Below the Fold) ── */}
      <section id="features-section" className="max-w-7xl mx-auto px-6 py-32 border-t border-white/5 scroll-mt-20">
        <motion.div 
          className="text-center max-w-2xl mx-auto mb-16 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 uppercase tracking-widest px-3 py-1 text-[10px]">
            Execution Architecture
          </Badge>
          <h3 className="text-3xl lg:text-5xl font-black text-white tracking-tight uppercase leading-[1.1]">
            Real-Time autonomous risk hedging.
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            TxHedge integrates Solana devnet speeds with verified data feeds from TxLINE node operators to secure your capital.
          </p>
        </motion.div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: "Verified Feed Ingestion",
              desc: "Ingest cryptographically signed real-time odds and score updates directly from node feeds. No centralized middleware.",
              icon: Activity,
              color: "text-primary",
              delay: 0.1
            },
            {
              title: "100ms Agent Execution",
              desc: "Automated trading agents evaluate position deltas and execute hedge positions within 100ms of score detection.",
              icon: Cpu,
              color: "text-chart-2",
              delay: 0.2
            },
            {
              title: "Settlement Proofs",
              desc: "Generate and write execution proofs to Solana devnet blocks. Fully verifiable odds settlement logs.",
              icon: Shield,
              color: "text-emerald-400",
              delay: 0.3
            }
          ].map((feat) => (
            <motion.div
              key={feat.title}
              className="glass-panel border-shimmer rounded-2xl p-6 space-y-4 text-left"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ type: "spring", stiffness: 100, damping: 15, delay: feat.delay }}
            >
              <div className={`h-11 w-11 rounded-xl bg-white/3 flex items-center justify-center border border-white/5 ${feat.color}`}>
                <feat.icon className="h-5 w-5" />
              </div>
              <h4 className="text-lg font-bold text-white uppercase">{feat.title}</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Section 3: Large Call to Action Block ── */}
      <section className="max-w-7xl mx-auto px-6 pb-32">
        <motion.div 
          className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-primary/10 via-transparent to-chart-2/5 p-8 lg:p-16 text-center space-y-6 overflow-hidden backdrop-blur-md shadow-[0_50px_100px_rgba(0,0,0,0.5)] border-shimmer"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {/* Decorative mesh background inside CTA card */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.72_0.19_195/4%),transparent_50%)]" />

          <Badge variant="outline" className="text-emerald-400 border-emerald-400/20 bg-emerald-400/5 uppercase tracking-widest px-3 py-1 text-[10px]">
            Terminal Access
          </Badge>
          <h3 className="text-3xl lg:text-6xl font-black text-white tracking-tight uppercase leading-[1.08] max-w-2xl mx-auto">
            Ready to secure your positions?
          </h3>
          <p className="text-muted-foreground text-sm lg:text-base max-w-lg mx-auto leading-relaxed">
            Monitor probabilities live on the ledger, trigger hedging offsets, and audit cryptographic settlement logs.
          </p>
          <div className="pt-4">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 glow-primary gap-2 text-sm font-semibold h-12 px-6"
              onClick={onStartHedging}
            >
              Enter Trading Board
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
