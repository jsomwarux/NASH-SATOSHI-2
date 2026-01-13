import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, MessageSquare, Loader2, AlertCircle, CheckCircle, Send, Flag, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Pre-fill for token-specific issue reports
  tokenSymbol?: string;
  analysisId?: number;
  type?: 'feedback' | 'issue';
}

export function FeedbackModal({
  isOpen,
  onClose,
  tokenSymbol,
  analysisId,
  type: initialType = 'feedback'
}: FeedbackModalProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [feedbackType, setFeedbackType] = useState<'feedback' | 'issue'>(initialType);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync email with user when modal opens
  useEffect(() => {
    if (isOpen && user?.email) {
      setEmail(user.email);
    }
  }, [isOpen, user?.email]);

  // Set initial type and pre-fill subject for issue reports
  useEffect(() => {
    if (isOpen) {
      setFeedbackType(initialType);
      if (initialType === 'issue' && tokenSymbol) {
        setSubject(`Issue with $${tokenSymbol} analysis`);
      }
    }
  }, [isOpen, initialType, tokenSymbol]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Please enter your email');
      return;
    }

    if (!subject) {
      setError('Please enter a subject');
      return;
    }

    if (!message) {
      setError('Please describe the issue or feedback');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          subject,
          message,
          type: feedbackType,
          tokenSymbol: tokenSymbol || undefined,
          analysisId: analysisId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit feedback');
      }

      setSuccess(true);
      // Reset form
      setSubject('');
      setMessage('');
      if (!user) {
        setEmail('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  const isIssueReport = feedbackType === 'issue';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
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
              {isIssueReport ? (
                <Flag className="w-4 h-4 text-amber-400" />
              ) : (
                <MessageCircle className="w-4 h-4 text-primary" />
              )}
              <span className="font-mono text-sm text-primary tracking-wider">
                {isIssueReport ? 'REPORT_ISSUE' : 'SEND_FEEDBACK'}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {success ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-6"
              >
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">
                  {isIssueReport ? 'Issue Reported' : 'Feedback Sent'}
                </h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Thank you for helping us improve. We'll review this shortly.
                </p>
                <Button onClick={handleClose} className="neon-button font-mono">
                  CLOSE
                </Button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type Toggle - only show if not pre-set */}
                {!tokenSymbol && (
                  <div className="flex gap-2 p-1 bg-background/50 rounded-md border border-primary/10">
                    <button
                      type="button"
                      onClick={() => setFeedbackType('feedback')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-mono transition-all ${
                        feedbackType === 'feedback'
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'text-muted-foreground hover:text-white'
                      }`}
                    >
                      <MessageCircle className="w-3 h-3" />
                      Feedback
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedbackType('issue')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-mono transition-all ${
                        feedbackType === 'issue'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'text-muted-foreground hover:text-white'
                      }`}
                    >
                      <Flag className="w-3 h-3" />
                      Report Issue
                    </button>
                  </div>
                )}

                {/* Token context banner */}
                {tokenSymbol && (
                  <div className="flex items-center gap-2 p-3 rounded border border-amber-500/20 bg-amber-500/5 text-amber-400 text-sm font-mono">
                    <Flag className="w-4 h-4 flex-shrink-0" />
                    <span>Reporting issue for <strong>${tokenSymbol}</strong></span>
                  </div>
                )}

                <p className="text-muted-foreground text-sm">
                  {isIssueReport
                    ? 'Found an inaccuracy or error? Let us know and we\'ll fix it.'
                    : 'Have suggestions or ideas? We\'d love to hear from you.'}
                </p>

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

                {/* Email Field */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">
                    YOUR EMAIL
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pl-10 font-mono bg-background/50 border-primary/20 focus:border-primary"
                      disabled={loading || !!user?.email}
                    />
                  </div>
                </div>

                {/* Subject Field */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">
                    SUBJECT
                  </label>
                  <Input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={isIssueReport ? "e.g., Incorrect backer listed" : "What's on your mind?"}
                    className="font-mono bg-background/50 border-primary/20 focus:border-primary"
                    disabled={loading}
                  />
                </div>

                {/* Message Field */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground mb-1 block tracking-wider">
                    {isIssueReport ? 'DESCRIBE THE ISSUE' : 'YOUR FEEDBACK'}
                  </label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={isIssueReport
                        ? "What's incorrect? Please include specific details..."
                        : "Share your thoughts, suggestions, or ideas..."}
                      rows={4}
                      className="w-full pl-10 pr-3 py-2 font-mono text-sm bg-background/50 border border-primary/20 rounded-md focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className={`w-full font-mono tracking-wider ${
                    isIssueReport
                      ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30'
                      : 'neon-button'
                  }`}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {isIssueReport ? 'SUBMIT REPORT' : 'SEND FEEDBACK'}
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
