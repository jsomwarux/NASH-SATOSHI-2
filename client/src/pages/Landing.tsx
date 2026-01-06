import { motion } from "framer-motion";
import { NetworkBackground } from "@/components/NetworkBackground";
import { Button } from "@/components/Button";
import { ArrowRight, Terminal, Shield, Cpu, Activity } from "lucide-react";

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-background/90 z-0">
        <div className="absolute inset-0 grid-pattern opacity-30" />
      </div>
      <NetworkBackground />

      {/* Navigation */}
      <nav className="relative z-50 border-b border-white/5 bg-background/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="font-mono font-bold text-white">G</span>
              </div>
              <span className="font-display font-bold text-lg tracking-tight">GameTheory<span className="text-primary">.ai</span></span>
            </div>
            <div className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Protocol</a>
              <a href="#" className="hover:text-primary transition-colors">Economics</a>
              <a href="#" className="hover:text-primary transition-colors">Governance</a>
            </div>
            <Button variant="outline" size="sm" onClick={() => console.log('Connect wallet clicked')}>
              Connect Wallet
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="pt-24 pb-32 sm:pt-32 sm:pb-40 lg:pb-48">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono mb-8">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                V1.0 BETA LIVE
              </div>
              
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/50 pb-2">
                Crypto Game <br className="hidden md:block" />
                Theory App
              </h1>
              
              <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground mb-12 leading-relaxed">
                Analyze on-chain incentives, simulate staking strategies, and master the Nash equilibrium of DeFi protocols.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button size="lg" onClick={() => console.log('Launch app')}>
                  Launch Terminal <Terminal className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="lg" onClick={() => console.log('Docs')}>
                  Read Whitepaper
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-24 bg-black/20 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: <Shield className="w-6 h-6 text-accent" />,
                  title: "Incentive Security",
                  desc: "Mathematically proven security models for your staking positions."
                },
                {
                  icon: <Cpu className="w-6 h-6 text-primary" />,
                  title: "Agent Simulation",
                  desc: "Run thousands of simulations to predict market actor behavior."
                },
                {
                  icon: <Activity className="w-6 h-6 text-pink-500" />,
                  title: "Real-time Nash",
                  desc: "Live equilibrium tracking across major liquidity pools."
                }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                  className="glass-card p-8 rounded-2xl hover:bg-card/80 transition-colors group cursor-default"
                >
                  <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Status Bar */}
        <div className="fixed bottom-0 left-0 right-0 h-8 bg-card border-t border-white/10 flex items-center px-4 text-xs font-mono text-muted-foreground z-50">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              SYSTEM ONLINE
            </span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">BLOCK: #18,245,992</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span>GAS: 12 GWEI</span>
            <span>LATENCY: 24MS</span>
          </div>
        </div>
      </main>
    </div>
  );
}
