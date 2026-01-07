import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, Loader2, AlertCircle, CheckCircle, Terminal, UserPlus, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'signin' | 'signup';
  promptMessage?: string; // Custom message to show at the top (e.g., "Sign up to analyze tokens")
}

export function AuthModal({ isOpen, onClose, defaultMode = 'signin', promptMessage }: AuthModalProps) {
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
          className="cyber-card w-full max-w-md rounded-lg border border-primary/30 overflow-hidden"
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Prompt Message (e.g., from AUTH_REQUIRED error) */}
            {promptMessage && (
              <div className="flex items-start gap-3 p-4 rounded border border-primary/30 bg-primary/5 text-sm">
                <Terminal className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-mono mb-1">{promptMessage}</p>
                  <p className="text-muted-foreground text-xs">
                    Your 7-day free trial starts when you run your first analysis.
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
                  <UserPlus className="w-4 h-4 mr-2" />
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
