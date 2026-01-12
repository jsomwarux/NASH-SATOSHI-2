import { useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, Loader2, AlertCircle, CheckCircle, Terminal, LogIn, Zap, ArrowRight, Sparkles, Trophy, Vote, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'signin' | 'signup';
  promptMessage?: string; // Custom message to show at the top (e.g., "Sign up to analyze tokens")
  tokenName?: string; // Name of the token being analyzed (for display)
}

export function AuthModal({ isOpen, onClose, defaultMode = 'signin', promptMessage, tokenName }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error, session } = await signUp(email, password);
        if (error) {
          setError(error.message);
        } else if (session) {
          // User was auto-confirmed (email confirmation disabled)
          onClose();
        } else {
          // Email confirmation required
          setSuccess('Account created! Please check your email to confirm your account.');
          setEmail('');
          setPassword('');
          setConfirmPassword('');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
        } else {
          onClose();
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null);
    setSuccess(null);
  };

  if (!isOpen) return null;

  // Show enhanced signup flow when there's a pending token analysis
  const showEnhancedSignup = mode === 'signup' && (promptMessage || tokenName);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className={`cyber-card w-full rounded-lg border border-primary/30 overflow-hidden ${showEnhancedSignup ? 'max-w-lg' : 'max-w-md'}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm text-primary tracking-wider">
                {mode === 'signin' ? 'SIGN_IN' : 'CREATE_ACCOUNT'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Enhanced Signup Content - Shows trial/pricing info */}
          {showEnhancedSignup && (
            <div className="px-6 pt-5 pb-2 border-b border-primary/10">
              {/* Token Analysis Prompt */}
              {tokenName && (
                <div className="flex items-center gap-3 p-3 rounded border border-accent/30 bg-accent/5 mb-4">
                  <Sparkles className="w-5 h-5 text-accent flex-shrink-0" />
                  <div>
                    <p className="text-white font-mono text-sm">
                      Analyze <span className="text-accent font-bold">{tokenName}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Create an account to start your analysis
                    </p>
                  </div>
                </div>
              )}

              {/* Free Account Benefits */}
              <div className="p-4 rounded border border-primary/30 bg-primary/5 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5 text-primary" />
                  <span className="font-mono text-primary font-bold text-sm">FREE ACCOUNT INCLUDES</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-primary" />
                    <span className="text-muted-foreground">Access to <span className="text-white">top 10 ranked tokens</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span className="text-muted-foreground">Full 4-LLM consensus scorecards</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Vote className="w-3.5 h-3.5 text-primary" />
                    <span className="text-muted-foreground">1 vote per day for new tokens</span>
                  </div>
                </div>
              </div>

              {/* Upgrade CTA */}
              <div className="flex items-center justify-between p-3 rounded border border-white/10 bg-white/5 text-xs">
                <span className="text-muted-foreground">Want the full leaderboard?</span>
                <Link href="/pricing" onClick={onClose} className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
                  View plans <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Simple Prompt Message (for signin or when not showing enhanced) */}
            {promptMessage && !showEnhancedSignup && (
              <div className="flex items-start gap-3 p-4 rounded border border-primary/30 bg-primary/5 text-sm">
                <Terminal className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-mono mb-1">{promptMessage}</p>
                  <p className="text-muted-foreground text-xs">
                    Sign in to continue to your analysis.
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-mono"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Success Message */}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded border border-green-500/30 bg-green-500/10 text-green-400 text-sm font-mono"
              >
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{success}</span>
              </motion.div>
            )}

            {/* Email Field */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">
                EMAIL
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10 font-mono bg-background/50 border-primary/20 focus:border-primary"
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">
                PASSWORD
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 font-mono bg-background/50 border-primary/20 focus:border-primary"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Confirm Password (signup only) */}
            {mode === 'signup' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">
                  CONFIRM_PASSWORD
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 font-mono bg-background/50 border-primary/20 focus:border-primary"
                    disabled={loading}
                  />
                </div>
              </motion.div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full neon-button font-mono tracking-wider"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'signin' ? (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  SIGN_IN
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  CREATE_ACCOUNT
                </>
              )}
            </Button>

            {/* Switch Mode */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={switchMode}
                className="text-sm font-mono text-muted-foreground hover:text-primary transition-colors"
              >
                {mode === 'signin' ? (
                  <>Don't have an account? <span className="text-primary">Sign up</span></>
                ) : (
                  <>Already have an account? <span className="text-primary">Sign in</span></>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
