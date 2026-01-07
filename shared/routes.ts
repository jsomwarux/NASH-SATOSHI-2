import { z } from 'zod';
import {
  tokenSearchResultSchema,
  tokenDetailsSchema,
  analyzeTokenRequestSchema,
  selectTokenAnalysisSchema,
  analysisStatusSchema,
} from './schema';

export const errorSchemas = {
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
  badRequest: z.object({ message: z.string() }),
};

export const api = {
  status: {
    method: 'GET' as const,
    path: '/api/status',
    responses: {
      200: z.object({ status: z.string() }),
    },
  },

  // Token Search (CoinGecko)
  tokenSearch: {
    method: 'GET' as const,
    path: '/api/token/search',
    query: z.object({ q: z.string().min(1) }),
    responses: {
      200: z.object({ coins: z.array(tokenSearchResultSchema) }),
    },
  },

  // Token Details (CoinGecko)
  tokenDetails: {
    method: 'GET' as const,
    path: '/api/token/:id',
    params: z.object({ id: z.string() }),
    responses: {
      200: tokenDetailsSchema,
      404: errorSchemas.notFound,
    },
  },

  // Start Token Analysis
  analyzeToken: {
    method: 'POST' as const,
    path: '/api/analyze',
    body: analyzeTokenRequestSchema,
    responses: {
      200: z.object({
        analysisId: z.number(),
        status: z.enum(['pending', 'processing', 'completed', 'failed']),
      }),
      400: errorSchemas.badRequest,
    },
  },

  // Get Analysis Status (for polling)
  analysisStatus: {
    method: 'GET' as const,
    path: '/api/analyze/:id/status',
    params: z.object({ id: z.string() }),
    responses: {
      200: analysisStatusSchema,
      404: errorSchemas.notFound,
    },
  },

  // Get Analysis by ID
  getAnalysis: {
    method: 'GET' as const,
    path: '/api/analyze/:id',
    params: z.object({ id: z.string() }),
    responses: {
      200: selectTokenAnalysisSchema,
      404: errorSchemas.notFound,
    },
  },

  // Get Analysis by Token ID
  getAnalysisByToken: {
    method: 'GET' as const,
    path: '/api/analyze/token/:tokenId',
    params: z.object({ tokenId: z.string() }),
    responses: {
      200: selectTokenAnalysisSchema,
      404: errorSchemas.notFound,
    },
  },

  // Leaderboard
  leaderboard: {
    method: 'GET' as const,
    path: '/api/leaderboard',
    query: z.object({
      limit: z.string().optional().default('50'),
      offset: z.string().optional().default('0'),
      sortBy: z.enum(['finalScore', 'createdAt']).optional().default('finalScore'),
      order: z.enum(['asc', 'desc']).optional().default('desc'),
      tier: z.string().optional(),
      narrative: z.string().optional(),
      chain: z.string().optional(),
      search: z.string().optional(),
    }).optional(),
    responses: {
      200: z.object({
        items: z.array(selectTokenAnalysisSchema),
        total: z.number(),
      }),
    },
  },

  // Get filter options
  filters: {
    method: 'GET' as const,
    path: '/api/filters',
    responses: {
      200: z.object({
        tiers: z.array(z.string()),
        narratives: z.array(z.string()),
        chains: z.array(z.string()),
      }),
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
