import { useState, useEffect, useRef } from "react";
import { Search, Loader2, TrendingUp, Flame, Crown, Star, ArrowRight, Terminal, Scan } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTokenSearch } from "@/hooks/useAnalysis";
import type { TokenSearchResult } from "@shared/schema";

interface TokenSearchProps {
  onSelect: (token: TokenSearchResult) => void;
  isLoading?: boolean;
}

// Get rank badge style
function getRankBadgeStyle(rank: number | null | undefined): { bg: string; text: string; icon: React.ReactNode } | null {
  if (!rank) return null;
  if (rank <= 10) {
    return {
      bg: "bg-amber-500/20 border-amber-500/30",
      text: "text-amber-400",
      icon: <Crown className="w-3 h-3" />
    };
  }
  if (rank <= 50) {
    return {
      bg: "bg-green-500/20 border-green-500/30",
      text: "text-green-400",
      icon: <Star className="w-3 h-3" />
    };
  }
  if (rank <= 100) {
    return {
      bg: "bg-blue-500/20 border-blue-500/30",
      text: "text-blue-400",
      icon: <TrendingUp className="w-3 h-3" />
    };
  }
  return {
    bg: "bg-white/5 border-white/10",
    text: "text-muted-foreground",
    icon: null
  };
}

// Determine if token is trending based on name patterns
function isTrendingToken(name: string, symbol: string): boolean {
  const trendingKeywords = ['ai', 'gpt', 'meme', 'pepe', 'doge', 'shib', 'inu', 'elon'];
  const nameLower = name.toLowerCase();
  const symbolLower = symbol.toLowerCase();
  return trendingKeywords.some(kw => nameLower.includes(kw) || symbolLower.includes(kw));
}

export function TokenSearch({ onSelect, isLoading }: TokenSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: tokens, isLoading: isSearching } = useTokenSearch(query);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset selected index when tokens change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [tokens]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!tokens || tokens.length === 0) return;

    const maxIndex = Math.min(tokens.length - 1, 9);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev < maxIndex ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : maxIndex));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(tokens[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  const handleSelect = (token: TokenSearchResult) => {
    setQuery("");
    setIsOpen(false);
    setSelectedIndex(-1);
    onSelect(token);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Terminal-style input container */}
      <div className="relative cyber-card rounded-lg border border-primary/30 bg-background/80 overflow-hidden">
        {/* Terminal header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-primary/20 bg-primary/5">
          <Terminal className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-mono text-primary tracking-wider">SEARCH_TOKEN</span>
          <div className="flex-1" />
          {(isSearching || isLoading) && (
            <span className="text-[10px] font-mono text-accent animate-pulse">SCANNING...</span>
          )}
        </div>

        {/* Input area */}
        <div className="relative flex items-center">
          <span className="pl-4 text-primary font-mono">&gt;</span>
          <Input
            ref={inputRef}
            type="text"
            placeholder="Enter token name or symbol..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="pl-2 pr-12 py-5 text-base font-mono bg-transparent border-0 focus:ring-0 focus-visible:ring-0 placeholder:text-muted-foreground/40"
          />
          {(isSearching || isLoading) ? (
            <Loader2 className="absolute right-4 w-5 h-5 text-primary animate-spin" />
          ) : (
            <Search className="absolute right-4 w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Dropdown Results - fixed positioning to avoid cutoff */}
      {isOpen && query.length >= 2 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 cyber-card border border-primary/20 rounded-lg shadow-2xl shadow-primary/10 z-[100]"
          style={{ maxHeight: 'calc(100vh - 300px)' }}
        >
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-primary/10 flex items-center justify-between bg-primary/5">
            <span className="text-[10px] font-mono text-primary tracking-wider flex items-center gap-2">
              <Scan className="w-3 h-3" />
              SEARCH_RESULTS
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {tokens ? `${Math.min(tokens.length, 10)} FOUND` : "..."}
            </span>
          </div>

          {isSearching ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
              <div className="text-muted-foreground font-mono text-sm">Scanning blockchain data...</div>
            </div>
          ) : tokens && tokens.length > 0 ? (
            <ul className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 400px)', minHeight: '200px' }}>
              {tokens.slice(0, 10).map((token, index) => {
                const rankStyle = getRankBadgeStyle(token.market_cap_rank);
                const isHot = isTrendingToken(token.name, token.symbol);
                const isSelected = index === selectedIndex;

                return (
                  <li key={token.id}>
                    <button
                      onClick={() => handleSelect(token)}
                      disabled={isLoading}
                      className={`w-full flex items-center gap-4 p-4 transition-all text-left disabled:opacity-50 group ${
                        isSelected
                          ? 'bg-primary/10 border-l-2 border-l-primary'
                          : 'hover:bg-primary/5 border-l-2 border-l-transparent'
                      }`}
                    >
                      {/* Index number */}
                      <span className="font-mono text-xs text-muted-foreground w-4">
                        {String(index).padStart(2, '0')}
                      </span>

                      {/* Token Image */}
                      <div className="relative">
                        {token.thumb ? (
                          <img
                            src={token.thumb}
                            alt={token.name}
                            className="w-10 h-10 rounded bg-secondary ring-2 ring-primary/10"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center ring-2 ring-primary/10">
                            <span className="font-bold text-sm font-mono">
                              {token.symbol.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        {isHot && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded flex items-center justify-center">
                            <Flame className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Token Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold truncate">{token.name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span className="uppercase font-mono font-medium text-primary/70">${token.symbol}</span>
                        </div>
                      </div>

                      {/* Rank Badge - always show if available */}
                      {token.market_cap_rank && (
                        <div className={`flex flex-col items-center px-3 py-1 rounded ${rankStyle?.bg || 'bg-white/5'}`}>
                          <span className={`text-[10px] font-mono ${rankStyle?.text || 'text-muted-foreground'}`}>RANK</span>
                          <span className={`text-lg font-bold font-mono ${rankStyle?.text || 'text-muted-foreground'}`}>
                            #{token.market_cap_rank}
                          </span>
                        </div>
                      )}

                      {/* Action indicator */}
                      <div className={`flex items-center gap-1.5 text-xs font-mono transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <span className="text-primary">ANALYZE</span>
                        <ArrowRight className="w-3 h-3 text-primary" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6 text-primary/50" />
              </div>
              <div className="text-muted-foreground font-mono text-sm mb-1">NO_RESULTS_FOUND</div>
              <div className="text-xs text-muted-foreground/60 font-mono">
                Try "Bitcoin", "Ethereum", or any token name
              </div>
            </div>
          )}

          {/* Footer hint */}
          {tokens && tokens.length > 0 && (
            <div className="px-4 py-2.5 border-t border-primary/10 flex items-center justify-center gap-4 text-[10px] font-mono text-muted-foreground/60 bg-primary/5">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">↑↓</kbd>
                NAV
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">↵</kbd>
                SELECT
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">ESC</kbd>
                CLOSE
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
