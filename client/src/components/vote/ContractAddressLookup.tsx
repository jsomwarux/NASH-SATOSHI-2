import { useState } from "react";
import {
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Vote,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  lookupDexscreenerToken,
  lookupCoinGeckoByContract,
} from "@/lib/api";

interface TokenLookupResult {
  source: "coingecko" | "dexscreener";
  tokenId: string;
  symbol: string;
  name: string;
  image: string | null;
  chain: string;
  contractAddress: string;
  marketCap?: number | null;
  fdv?: number | null;
  priceUsd?: string | null;
}

interface ContractAddressLookupProps {
  onSelect: (token: TokenLookupResult) => void;
  isLoading?: boolean;
}

// Chains to try for Dexscreener (in order of popularity)
const DEXSCREENER_CHAINS_TO_TRY = [
  "solana",
  "ethereum",
  "base",
  "bsc",
  "arbitrum",
  "polygon",
  "avalanche",
  "optimism",
  "sui",
  "ton",
];

export function ContractAddressLookup({ onSelect, isLoading }: ContractAddressLookupProps) {
  const [contractAddress, setContractAddress] = useState("");
  const [isLooking, setIsLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [tokenResult, setTokenResult] = useState<TokenLookupResult | null>(null);

  // Detect address type
  const isEvmAddress = /^0x[a-fA-F0-9]{40}$/i.test(contractAddress);
  const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(contractAddress) && !contractAddress.startsWith("0x");
  const isValidAddress = isEvmAddress || isSolanaAddress;

  const handleLookup = async () => {
    if (!isValidAddress) {
      setLookupError("Please enter a valid contract address");
      return;
    }

    setIsLooking(true);
    setLookupError(null);
    setTokenResult(null);

    try {
      // Step 1: Try CoinGecko first (it auto-searches multiple chains)
      const cgResult = await lookupCoinGeckoByContract(contractAddress);

      if (cgResult) {
        setTokenResult({
          source: "coingecko",
          tokenId: cgResult.id,
          symbol: cgResult.symbol,
          name: cgResult.name,
          image: cgResult.large || cgResult.thumb,
          chain: cgResult.platform || (isSolanaAddress ? "solana" : "ethereum"),
          contractAddress: contractAddress,
        });
        setIsLooking(false);
        return;
      }

      // Step 2: Not on CoinGecko, try Dexscreener
      // Determine which chains to try based on address type
      const chainsToTry = isSolanaAddress
        ? ["solana"]
        : DEXSCREENER_CHAINS_TO_TRY.filter(c => c !== "solana");

      for (const chain of chainsToTry) {
        try {
          const dexResult = await lookupDexscreenerToken(contractAddress, chain);

          if (dexResult) {
            setTokenResult({
              source: "dexscreener",
              tokenId: `dex_${chain}_${contractAddress}`,
              symbol: dexResult.symbol,
              name: dexResult.name,
              image: dexResult.imageUrl,
              chain: dexResult.chain,
              contractAddress: dexResult.contractAddress,
              marketCap: dexResult.marketCap,
              fdv: dexResult.fdv,
              priceUsd: dexResult.priceUsd,
            });
            setIsLooking(false);
            return;
          }
        } catch {
          // Continue to next chain
        }
      }

      // Not found anywhere
      setLookupError(
        "Token not found. Please verify the contract address is correct and the token has trading activity."
      );
    } catch (err) {
      console.error("Lookup error:", err);
      setLookupError("Failed to lookup token. Please try again.");
    } finally {
      setIsLooking(false);
    }
  };

  const handleVote = () => {
    if (tokenResult) {
      onSelect(tokenResult);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValidAddress && !isLooking) {
      handleLookup();
    }
  };

  const formatNumber = (num: number | null | undefined): string => {
    if (!num) return "N/A";
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      {/* Contract Address Input */}
      <div>
        <label className="text-xs font-mono text-muted-foreground mb-1 block">
          TOKEN CONTRACT ADDRESS
        </label>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Paste contract address (0x... or Solana)"
            value={contractAddress}
            onChange={(e) => {
              setContractAddress(e.target.value.trim());
              setTokenResult(null);
              setLookupError(null);
            }}
            onKeyDown={handleKeyDown}
            className="font-mono text-sm"
            disabled={isLoading}
          />
          <Button
            onClick={handleLookup}
            disabled={!isValidAddress || isLooking || isLoading}
          >
            {isLooking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>
        {contractAddress && !isValidAddress && (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Enter a valid EVM (0x...) or Solana address
          </p>
        )}
        {isLooking && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Searching CoinGecko and Dexscreener...
          </p>
        )}
      </div>

      {/* Error Display */}
      {lookupError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
          <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-400">{lookupError}</p>
        </div>
      )}

      {/* Token Result */}
      {tokenResult && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
          <div className="flex items-center gap-3">
            {tokenResult.image ? (
              <img
                src={tokenResult.image}
                alt={tokenResult.name}
                className="w-12 h-12 rounded-full"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="font-bold text-lg">
                  {tokenResult.symbol.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1">
              <div className="font-semibold text-lg">{tokenResult.name}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="font-mono">${tokenResult.symbol.toUpperCase()}</span>
                <Badge variant="outline" className="text-[10px]">
                  {tokenResult.chain}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    tokenResult.source === "dexscreener"
                      ? "border-green-500/30 text-green-400"
                      : "border-blue-500/30 text-blue-400"
                  }`}
                >
                  {tokenResult.source === "dexscreener" ? "Dexscreener" : "CoinGecko"}
                </Badge>
              </div>
            </div>
            <CheckCircle className="w-6 h-6 text-green-400" />
          </div>

          {/* Market Data */}
          {(tokenResult.fdv || tokenResult.marketCap || tokenResult.priceUsd) && (
            <div className="flex gap-4 text-sm">
              {tokenResult.priceUsd && (
                <div>
                  <span className="text-muted-foreground">Price:</span>{" "}
                  <span className="font-mono">${parseFloat(tokenResult.priceUsd).toFixed(6)}</span>
                </div>
              )}
              {tokenResult.fdv && (
                <div>
                  <span className="text-muted-foreground">FDV:</span>{" "}
                  <span className="font-mono">{formatNumber(tokenResult.fdv)}</span>
                </div>
              )}
              {tokenResult.marketCap && (
                <div>
                  <span className="text-muted-foreground">MCap:</span>{" "}
                  <span className="font-mono">{formatNumber(tokenResult.marketCap)}</span>
                </div>
              )}
            </div>
          )}

          {/* Contract Address */}
          <div className="text-xs font-mono text-muted-foreground break-all">
            {tokenResult.contractAddress}
          </div>

          {/* Vote Button */}
          <Button
            onClick={handleVote}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting Vote...
              </>
            ) : (
              <>
                <Vote className="w-4 h-4 mr-2" />
                Vote for {tokenResult.symbol.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Help Text */}
      {!tokenResult && !lookupError && (
        <p className="text-xs text-muted-foreground text-center">
          Paste the token's contract address. We'll automatically find it on CoinGecko or Dexscreener.
        </p>
      )}
    </div>
  );
}
