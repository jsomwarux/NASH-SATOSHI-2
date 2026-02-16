/**
 * Shared market data fetching with CoinGecko-first strategy.
 *
 * Tier 1: CoinGecko (preferred — has 7d change)
 * Tier 2: DexScreener API (fallback — has 24h change but not 7d)
 * Tier 3: Parsed Gumloop output fields (handled by caller as last resort)
 */

import { getTokenByContract as getDexscreenerToken } from "./dexscreener";

export interface MarketDataResult {
  source: "coingecko" | "dexscreener";
  currentPrice?: string;
  marketCap?: string;
  fdv?: string;
  volume24h?: string;
  priceChange24h?: string;
  priceChange7d?: string;
  categories?: string[];
  // Token metadata (extracted from the same API response to avoid double calls)
  tokenSymbol?: string;
  tokenName?: string;
  tokenImage?: string;
}

// CoinGecko platform ID mapping
const COINGECKO_PLATFORM_MAP: Record<string, string> = {
  ethereum: "ethereum",
  polygon: "polygon-pos",
  arbitrum: "arbitrum-one",
  optimism: "optimistic-ethereum",
  base: "base",
  avalanche: "avalanche",
  bsc: "binance-smart-chain",
  fantom: "fantom",
  solana: "solana",
  sui: "sui",
};

// Reverse mapping: CoinGecko platform name → our chain name
const PLATFORM_TO_CHAIN_MAP: Record<string, string> = {
  ethereum: "ethereum",
  "polygon-pos": "polygon",
  "arbitrum-one": "arbitrum",
  base: "base",
  "optimistic-ethereum": "optimism",
  avalanche: "avalanche",
  "binance-smart-chain": "bsc",
  solana: "solana",
  fantom: "fantom",
};

// Chain priority for CoinGecko platforms fallback
const CHAIN_PRIORITY = [
  "ethereum",
  "base",
  "arbitrum-one",
  "optimistic-ethereum",
  "polygon-pos",
  "solana",
  "binance-smart-chain",
  "avalanche",
];

function getCoinGeckoConfig() {
  const cgApiKey = process.env.COINGECKO_API_KEY;
  const cgApiType = process.env.COINGECKO_API_TYPE || "demo";
  const cgBaseUrl =
    cgApiType === "pro"
      ? "https://pro-api.coingecko.com/api/v3"
      : "https://api.coingecko.com/api/v3";

  const headers: Record<string, string> = { Accept: "application/json" };
  if (cgApiKey) {
    headers[cgApiType === "pro" ? "x-cg-pro-api-key" : "x-cg-demo-api-key"] = cgApiKey;
  }

  return { cgBaseUrl, headers };
}

function parseCoinGeckoResponse(data: any): MarketDataResult {
  return {
    source: "coingecko",
    currentPrice: data.market_data?.current_price?.usd?.toString(),
    marketCap: data.market_data?.market_cap?.usd?.toString(),
    fdv: data.market_data?.fully_diluted_valuation?.usd?.toString(),
    volume24h: data.market_data?.total_volume?.usd?.toString(),
    priceChange24h: data.market_data?.price_change_percentage_24h?.toString(),
    priceChange7d: data.market_data?.price_change_percentage_7d?.toString(),
    categories: data.categories || [],
    tokenSymbol: data.symbol?.toUpperCase(),
    tokenName: data.name,
    tokenImage: data.image?.large || data.image?.small,
  };
}

/**
 * Fetches market data for a token using the CoinGecko-first strategy.
 *
 * @param tokenId - The token identifier (e.g., "bitcoin", "dex_solana_0x...", "cg_ethereum_0x...")
 * @param contractAddress - Optional contract address for contract-based lookups
 * @param chain - Optional blockchain network name
 * @returns MarketDataResult with pricing info, or null if all sources fail
 */
export async function fetchMarketData(
  tokenId: string,
  contractAddress?: string | null,
  chain?: string | null
): Promise<{ data: MarketDataResult | null; cgPlatforms: Record<string, string> | null }> {
  const { cgBaseUrl, headers } = getCoinGeckoConfig();
  let cgPlatforms: Record<string, string> | null = null;

  // ========== TIER 1: CoinGecko ==========

  // 1a. Try CoinGecko by tokenId directly
  // For dex_ or cg_ prefixed IDs, strip the prefix to get a potential CoinGecko ID
  // But usually these won't match, so the contract fallback (1b) handles them
  const cleanTokenId = tokenId.startsWith("dex_") || tokenId.startsWith("cg_")
    ? null // Don't try direct lookup for prefixed IDs
    : tokenId;

  if (cleanTokenId) {
    try {
      let cgResponse = await fetch(
        `${cgBaseUrl}/coins/${cleanTokenId}?localization=false&tickers=false&community_data=false&developer_data=false`,
        { headers }
      );

      // Retry once on rate limit (429) with a delay
      if (cgResponse.status === 429) {
        console.warn(`[MarketData] CoinGecko rate limited for ${tokenId}, retrying after 3s...`);
        await new Promise(r => setTimeout(r, 3000));
        cgResponse = await fetch(
          `${cgBaseUrl}/coins/${cleanTokenId}?localization=false&tickers=false&community_data=false&developer_data=false`,
          { headers }
        );
      }

      if (cgResponse.ok) {
        const data = await cgResponse.json();
        if (data.platforms && typeof data.platforms === "object") {
          cgPlatforms = data.platforms;
        }
        console.log(`[MarketData] CoinGecko direct lookup succeeded for ${tokenId}`);
        return { data: parseCoinGeckoResponse(data), cgPlatforms };
      } else {
        console.warn(`[MarketData] CoinGecko direct lookup returned ${cgResponse.status} for ${tokenId}`);
      }
    } catch (err) {
      console.warn(`[MarketData] CoinGecko direct lookup failed for ${tokenId}:`, err);
    }
  }

  // 1b. Try CoinGecko by contract address
  if (contractAddress && chain) {
    const platformId = COINGECKO_PLATFORM_MAP[chain.toLowerCase()];
    if (platformId) {
      try {
        let cgResponse = await fetch(
          `${cgBaseUrl}/coins/${platformId}/contract/${contractAddress}`,
          { headers }
        );

        // Retry once on rate limit (429) with a delay
        if (cgResponse.status === 429) {
          console.warn(`[MarketData] CoinGecko rate limited for contract lookup ${tokenId}, retrying after 3s...`);
          await new Promise(r => setTimeout(r, 3000));
          cgResponse = await fetch(
            `${cgBaseUrl}/coins/${platformId}/contract/${contractAddress}`,
            { headers }
          );
        }

        if (cgResponse.ok) {
          const data = await cgResponse.json();
          if (data.platforms && typeof data.platforms === "object") {
            cgPlatforms = data.platforms;
          }
          console.log(`[MarketData] CoinGecko contract lookup succeeded for ${tokenId} (${chain}/${contractAddress.slice(0, 10)}...)`);
          return { data: parseCoinGeckoResponse(data), cgPlatforms };
        } else {
          console.warn(`[MarketData] CoinGecko contract lookup returned ${cgResponse.status} for ${tokenId} (${chain}/${contractAddress?.slice(0, 10)}...)`);
        }
      } catch (err) {
        console.warn(`[MarketData] CoinGecko contract lookup failed for ${tokenId}:`, err);
      }
    }
  }

  // ========== TIER 2: DexScreener ==========
  if (contractAddress && chain) {
    try {
      const dexData = await getDexscreenerToken(contractAddress, chain);
      if (dexData) {
        console.log(`[MarketData] DexScreener lookup succeeded for ${tokenId} - FDV: $${dexData.fdv}`);
        return {
          data: {
            source: "dexscreener",
            currentPrice: dexData.priceUsd?.toString(),
            marketCap: dexData.marketCap?.toString(),
            fdv: dexData.fdv?.toString(),
            volume24h: dexData.volume24h?.toString(),
            priceChange24h: dexData.priceChange24h?.toString(),
            // DexScreener does not provide 7d change
            priceChange7d: undefined,
            tokenSymbol: dexData.symbol,
            tokenName: dexData.name,
            tokenImage: dexData.imageUrl || undefined,
          },
          cgPlatforms: null,
        };
      }
    } catch (err) {
      console.warn(`[MarketData] DexScreener lookup failed for ${tokenId}:`, err);
    }
  }

  // ========== All sources failed ==========
  console.warn(`[MarketData] All sources failed for ${tokenId} (contract: ${contractAddress}, chain: ${chain})`);
  return { data: null, cgPlatforms };
}

/**
 * Extracts contract address and chain from a tokenId with dex_ or cg_ prefix.
 */
export function extractTokenIdParts(tokenId: string): { chain: string; contractAddress: string } | null {
  if (tokenId.startsWith("dex_") || tokenId.startsWith("cg_")) {
    const parts = tokenId.split("_");
    if (parts.length >= 3) {
      return {
        chain: parts[1],
        contractAddress: parts.slice(2).join("_"),
      };
    }
  }
  return null;
}

/**
 * Resolves contract address and chain from CoinGecko platforms data.
 * Used when a token has a CoinGecko ID but no stored contract address.
 */
export function resolveContractFromPlatforms(
  cgPlatforms: Record<string, string>
): { chain: string; contractAddress: string } | null {
  // Try chains in priority order
  for (const platformKey of CHAIN_PRIORITY) {
    const addr = cgPlatforms[platformKey];
    if (addr && addr.length > 0) {
      const chain = PLATFORM_TO_CHAIN_MAP[platformKey] || platformKey;
      return { chain, contractAddress: addr };
    }
  }

  // Try any available platform
  for (const [platformKey, addr] of Object.entries(cgPlatforms)) {
    if (addr && addr.length > 0 && platformKey !== "") {
      const chain = PLATFORM_TO_CHAIN_MAP[platformKey] || platformKey;
      return { chain, contractAddress: addr };
    }
  }

  return null;
}
