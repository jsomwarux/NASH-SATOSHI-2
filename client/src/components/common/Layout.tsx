import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Home, Vote, Terminal, Cpu, Wifi, Shield, Loader2, Crown, User, LogOut, CreditCard, ChevronDown, AlertTriangle, HelpCircle, MessageCircle } from "lucide-react";
import { CyberBackground } from "../CyberBackground";
import { useAnalysisTracker } from "@/contexts/AnalysisTrackerContext";
import { useSubscriptionStatus, useCreateBillingPortal } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { useReferralTracking } from "@/hooks/useReferralTracking";
import { AuthModal } from "@/components/auth/AuthModal";
import { SupportModal } from "@/components/common/SupportModal";
import { FeedbackModal } from "@/components/common/FeedbackModal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const { trackedAnalyses } = useAnalysisTracker();
  const { data: subscriptionStatus } = useSubscriptionStatus();
  const { user, signOut, isConfigured } = useAuth();
  const createPortal = useCreateBillingPortal();

  // Track referrals from URL parameters
  useReferralTracking();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  const handleManageBilling = async () => {
    try {
      const { url } = await createPortal.mutateAsync();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Portal error:", error);
    }
  };

  // Truncate email for display
  const truncateEmail = (email: string) => {
    if (email.length <= 20) return email;
    const [local, domain] = email.split("@");
    if (local.length > 10) {
      return `${local.slice(0, 8)}...@${domain}`;
    }
    return email;
  };

  // Hide pricing nav during beta (isBeta flag comes from subscription status)
  const navLinks = useMemo(() => {
    const links = [
      { href: "/", label: "HOME", icon: Home },
      { href: "/rankings", label: "RANKINGS", icon: BarChart3 },
      { href: "/vote", label: "VOTE", icon: Vote },
    ];
    // Only show pricing when we explicitly know we're NOT in beta mode
    // This prevents the pricing link from flashing before subscription status loads
    if (subscriptionStatus && subscriptionStatus.isBeta === false) {
      links.push({ href: "/pricing", label: "PRICING", icon: Crown });
    }
    return links;
  }, [subscriptionStatus]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Animated Cyber Background */}
      <CyberBackground />

      {/* Navigation */}
      <nav className="relative z-50 border-b border-primary/20 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity group">
              <div className="relative">
                {/* Hexagonal logo with circuit pattern */}
                <div className="w-10 h-10 relative">
                  <svg viewBox="0 0 40 40" className="w-full h-full">
                    {/* Outer hexagon */}
                    <polygon
                      points="20,2 36,11 36,29 20,38 4,29 4,11"
                      fill="none"
                      stroke="url(#logoGradient)"
                      strokeWidth="1.5"
                      className="opacity-80"
                    />
                    {/* Inner hexagon */}
                    <polygon
                      points="20,8 30,14 30,26 20,32 10,26 10,14"
                      fill="url(#logoGradient)"
                      opacity="0.2"
                    />
                    {/* Center circuit node */}
                    <circle cx="20" cy="20" r="4" fill="url(#logoGradient)" />
                    {/* Circuit lines */}
                    <line x1="20" y1="16" x2="20" y2="8" stroke="url(#logoGradient)" strokeWidth="1" />
                    <line x1="23.5" y1="22" x2="30" y2="26" stroke="url(#logoGradient)" strokeWidth="1" />
                    <line x1="16.5" y1="22" x2="10" y2="26" stroke="url(#logoGradient)" strokeWidth="1" />
                    <defs>
                      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0ff" />
                        <stop offset="100%" stopColor="#f0f" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent opacity-0 group-hover:opacity-30 blur-lg transition-opacity" />
              </div>
              <div className="flex flex-col">
                <span className="font-display font-bold text-lg tracking-wider leading-none">
                  <span className="text-glow-cyan">NASH</span>
                  <span className="text-accent">SATOSHI</span>
                </span>
                <span className="text-[9px] tracking-[0.3em] text-muted-foreground font-mono">
                  GAME THEORY AI
                </span>
              </div>
            </Link>

            {/* Nav Links - Desktop */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = location === link.href;
                return (
                  <Link key={link.href} href={link.href}>
                    <motion.div
                      className={`relative px-4 py-2 text-sm font-mono tracking-wider transition-colors ${
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground hover:text-primary/80"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <link.icon className="w-4 h-4" />
                        {link.label}
                      </span>
                      {isActive && (
                        <motion.div
                          layoutId="nav-indicator"
                          className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-primary to-accent"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                    </motion.div>
                  </Link>
                );
              })}
            </div>

            {/* Right Side - Status Badges + User Menu */}
            <div className="flex items-center gap-3">
              {/* System Status */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded border border-green-500/30 bg-green-500/5 text-green-400 text-[10px] font-mono tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                ONLINE
              </div>

              {/* Beta Badge */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded border border-accent/30 bg-accent/5 text-accent text-[10px] font-mono tracking-wider">
                <Shield className="w-3 h-3" />
                BETA
              </div>

              {/* User Account Menu */}
              {isConfigured && (
                user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex items-center gap-2 px-3 py-1.5 h-auto rounded border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-[11px] font-mono tracking-wider"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline max-w-[120px] truncate">
                          {truncateEmail(user.email || "Account")}
                        </span>
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 font-mono">
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        {user.email}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <Link href="/account">
                        <DropdownMenuItem className="cursor-pointer">
                          <User className="w-4 h-4 mr-2" />
                          Account
                        </DropdownMenuItem>
                      </Link>
                      {subscriptionStatus?.isSubscribed && !subscriptionStatus?.isBeta && (
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={handleManageBilling}
                          disabled={createPortal.isPending}
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          {createPortal.isPending ? "Loading..." : "Manage Billing"}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setShowFeedbackModal(true)}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Feedback
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer text-red-400 focus:text-red-400"
                        onClick={handleSignOut}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setShowAuthModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 h-auto rounded border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-[11px] font-mono tracking-wider"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">SIGN IN</span>
                  </Button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden border-t border-primary/10">
          <div className="flex justify-around py-1">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return (
                <Link key={link.href} href={link.href}>
                  <div className={`flex flex-col items-center gap-1 px-5 py-3 min-h-[48px] ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}>
                    <link.icon className="w-5 h-5" />
                    <span className="text-[10px] font-mono tracking-wider">{link.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Side Decorations */}
      <div className="fixed left-0 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-3 p-4 z-40">
        <div className="w-1 h-20 bg-gradient-to-b from-primary/50 to-transparent rounded" />
        <div className="text-[9px] font-mono text-primary/50 writing-mode-vertical tracking-[0.2em]">
          v1.0.0
        </div>
        <div className="w-1 h-10 bg-gradient-to-b from-accent/50 to-transparent rounded" />
      </div>

      <div className="fixed right-0 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-3 p-4 z-40">
        <div className="w-1 h-10 bg-gradient-to-b from-accent/50 to-transparent rounded" />
        <div className="text-[9px] font-mono text-accent/50 writing-mode-vertical tracking-[0.2em]">
          4-LLM
        </div>
        <div className="w-1 h-20 bg-gradient-to-b from-primary/50 to-transparent rounded" />
      </div>

      {/* Main Content */}
      <main className="relative z-10 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Disclaimer Bar */}
      <div className="fixed bottom-10 left-0 right-0 bg-background/80 border-t border-amber-500/10 backdrop-blur-sm flex items-center justify-center px-4 py-1 text-[9px] font-mono z-50">
        <span className="flex items-center gap-1.5 text-amber-500/60">
          <AlertTriangle className="w-3 h-3" />
          <span className="hidden sm:inline">NOT FINANCIAL ADVICE</span>
          <span className="hidden sm:inline text-muted-foreground/50">•</span>
          <span className="text-muted-foreground/50">LLMs can make mistakes. For research purposes only. Always DYOR.</span>
        </span>
      </div>

      {/* Cyber Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-10 bg-background/95 border-t border-primary/20 backdrop-blur-sm flex items-center justify-between px-4 text-[10px] font-mono z-50">
        {/* Left Side */}
        <div className="flex items-center gap-6">
          {trackedAnalyses.length > 0 ? (
            <span className="flex items-center gap-2 text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="hidden sm:inline">
                {trackedAnalyses.length} ANALYSIS{trackedAnalyses.length > 1 ? "ES" : ""} IN PROGRESS
              </span>
              <span className="sm:hidden">{trackedAnalyses.length}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-green-400">
              <Wifi className="w-3 h-3" />
              <span className="hidden sm:inline">READY</span>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            </span>
          )}
          <span className="flex items-center gap-2 text-primary/70">
            <Terminal className="w-3 h-3" />
            <span className="hidden sm:inline">MULTI-LLM CONSENSUS ENGINE</span>
          </span>
        </div>

        {/* Center - LLM Indicators */}
        <div className="hidden md:flex items-center gap-3">
          {[
            { name: "GPT-5.5", color: "text-green-400" },
            { name: "CLAUDE 4.7", color: "text-orange-400" },
            { name: "GEMINI 3.1", color: "text-blue-400" },
            { name: "GROK 4", color: "text-purple-400" },
          ].map((llm) => (
            <span key={llm.name} className={`${llm.color} opacity-70`}>
              [{llm.name}]
            </span>
          ))}
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          {/* Help Button */}
          <button
            onClick={() => setShowSupportModal(true)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3 h-3" />
            <span className="hidden sm:inline">HELP</span>
          </button>
          {/* Usage Indicator */}
          {subscriptionStatus && (
            <Link href="/pricing">
              <span className={`flex items-center gap-2 cursor-pointer hover:opacity-100 transition-opacity ${
                subscriptionStatus.canAnalyze ? "text-primary/70" : "text-red-400"
              }`}>
                <Crown className="w-3 h-3" />
                <span className="hidden sm:inline">
                  {subscriptionStatus.tierName.toUpperCase()}
                  {subscriptionStatus.dailyRemaining !== null && (
                    <span className="ml-1">
                      [{subscriptionStatus.dailyRemaining}/{subscriptionStatus.dailyLimit}]
                    </span>
                  )}
                  {subscriptionStatus.monthlyRemaining !== null && (
                    <span className="ml-1">
                      [{subscriptionStatus.monthlyRemaining}/{subscriptionStatus.monthlyLimit}]
                    </span>
                  )}
                </span>
              </span>
            </Link>
          )}
          <span className="flex items-center gap-2 text-accent/70">
            <Cpu className="w-3 h-3" />
            <span className="hidden sm:inline">GAME THEORY v1.0</span>
          </span>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="signin"
      />

      {/* Support Modal */}
      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />
    </div>
  );
}
