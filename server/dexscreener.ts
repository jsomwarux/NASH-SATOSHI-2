/**
 * Dexscreener API Integration
 *
 * Used for fetching token information for new/small cap tokens that aren't
 * available on CoinGecko yet.
 *
 * API Docs: https://docs.dexscreener.com/api/reference
 */

// Supported chains and their Dexscreener chain IDs
export const DEXSCREENER_CHAINS: Record<string, string> = {
  ethereum: 'ethereum',
  solana: 'solana',
  base: 'base',
  bsc: 'bsc',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
  avalanche: 'avalanche',
  optimism: 'optimism',
  fantom: 'fantom',
  cronos: 'cronos',
  sui: 'sui',
  aptos: 'aptos',
  ton: 'ton',
  tron: 'tron',
  near: 'near',
  mantle: 'mantle',
  blast: 'blast',
  linea: 'linea',
  scroll: 'scroll',
  zksync: 'zksync',
  manta: 'manta',
  sei: 'sei',
  injective: 'injective',
  pulsechain: 'pulsechain',
};

// Response types from Dexscreener API
export interface DexscreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    header?: string;
    openGraph?: string;
    websites?: { label: string; url: string }[];
    socials?: { type: string; url: string }[];
  };
  boosts?: {
    active: number;
  };
}

export interface DexscreenerTokenResponse {
  schemaVersion: string;
  pairs: DexscreenerPair[] | null;
}

export interface DexscreenerTokenInfo {
  // Identifiers
  contractAddress: string;
  chain: string;
  symbol: string;
  name: string;

  // Image
  imageUrl: string | null;

  // Links
  websiteUrl: string | null;
  twitterUrl: string | null;
  telegramUrl: string | null;
  discordUrl: string | null;

  // Market data
  priceUsd: string | null;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  priceChange24h: number | null;
  liquidity: number | null;

  // Trading pair info
  dexUrl: string | null;
  pairAddress: string | null;

  // Raw response for debugging
  rawPairs: DexscreenerPair[];
}

/**
 * Fetch token information from Dexscreener by contract address and chain
 */
export async function getTokenByContract(
  contractAddress: string,
  chain: string
): Promise<DexscreenerTokenInfo | null> {
  const chainId = DEXSCREENER_CHAINS[chain.toLowerCase()];

  if (!chainId) {
    console.error(`Dexscreener: Unknown chain "${chain}". Supported: ${Object.keys(DEXSCREENER_CHAINS).join(', ')}`);
    return null;
  }

  try {
    // Use the tokens endpoint to get all pairs for this token
    const url = `https://api.dexscreener.com/tokens/v1/${chainId}/${contractAddress}`;

    console.log(`Dexscreener: Fetching token info from ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NashSatoshi/1.0',
      },
    });

    if (!response.ok) {
      console.error(`Dexscreener: API error ${response.status} for ${contractAddress} on ${chain}`);
      return null;
    }

    const data: DexscreenerPair[] = await response.json();

    if (!data || data.length === 0) {
      console.log(`Dexscreener: No pairs found for ${contractAddress} on ${chain}`);
      return null;
    }

    // Sort pairs by liquidity (highest first) to get the main trading pair
    const sortedPairs = data.sort((a, b) => {
      const liqA = a.liquidity?.usd || 0;
      const liqB = b.liquidity?.usd || 0;
      return liqB - liqA;
    });

    const mainPair = sortedPairs[0];
    const baseToken = mainPair.baseToken;
    const info = mainPair.info;

    // Extract social links
    let websiteUrl: string | null = null;
    let twitterUrl: string | null = null;
    let telegramUrl: string | null = null;
    let discordUrl: string | null = null;

    if (info?.websites) {
      const website = info.websites.find(w => w.label === 'Website' || w.label === 'website');
      websiteUrl = website?.url || info.websites[0]?.url || null;
    }

    if (info?.socials) {
      for (const social of info.socials) {
        const type = social.type.toLowerCase();
        if (type === 'twitter' || type === 'x') {
          twitterUrl = social.url;
        } else if (type === 'telegram') {
          telegramUrl = social.url;
        } else if (type === 'discord') {
          discordUrl = social.url;
        }
      }
    }

    // Calculate aggregated market data from all pairs
    const totalVolume24h = sortedPairs.reduce((sum, p) => sum + (p.volume?.h24 || 0), 0);
    const totalLiquidity = sortedPairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0);

    const result: DexscreenerTokenInfo = {
      contractAddress: baseToken.address,
      chain: mainPair.chainId,
      symbol: baseToken.symbol,
      name: baseToken.name,
      imageUrl: info?.imageUrl || null,
      websiteUrl,
      twitterUrl,
      telegramUrl,
      discordUrl,
      priceUsd: mainPair.priceUsd || null,
      marketCap: mainPair.marketCap || null,
      fdv: mainPair.fdv || null,
      volume24h: totalVolume24h || null,
      priceChange24h: mainPair.priceChange?.h24 || null,
      liquidity: totalLiquidity || null,
      dexUrl: mainPair.url || null,
      pairAddress: mainPair.pairAddress || null,
      rawPairs: sortedPairs,
    };

    console.log(`Dexscreener: Found ${baseToken.symbol} (${baseToken.name}) on ${chain} - FDV: $${result.fdv}`);

    return result;
  } catch (error) {
    console.error(`Dexscreener: Error fetching ${contractAddress} on ${chain}:`, error);
    return null;
  }
}

/**
 * Search for tokens by query (name or symbol)
 * Note: This uses the search endpoint which has broader matching
 */
export async function searchTokens(query: string): Promise<DexscreenerPair[]> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NashSatoshi/1.0',
      },
    });

    if (!response.ok) {
      console.error(`Dexscreener search: API error ${response.status}`);
      return [];
    }

    const data: DexscreenerTokenResponse = await response.json();
    return data.pairs || [];
  } catch (error) {
    console.error('Dexscreener search error:', error);
    return [];
  }
}

/**
 * Get list of supported chains for UI display
 */
export function getSupportedChains(): { id: string; name: string }[] {
  return Object.entries(DEXSCREENER_CHAINS).map(([id, name]) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1), // Capitalize first letter
  }));
}
