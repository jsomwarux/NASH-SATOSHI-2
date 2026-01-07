import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

// Initialize Supabase client for token verification
// Use the same env vars as the frontend for consistency
const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Try service role key first, fall back to anon key (both can verify tokens)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Create Supabase client if URL and key are available
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Log configuration status on startup
if (supabase) {
  console.log("Supabase auth configured successfully");
} else {
  console.warn("Supabase auth not configured - VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required");
}

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Middleware that requires authentication
 * Returns 401 if no valid token is provided
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (!supabase) {
    // If Supabase is not configured, allow requests through for development
    // In production, you would want to reject these
    console.warn("Supabase not configured, allowing request through (dev mode)");
    req.userId = "dev-user";
    req.userEmail = "dev@example.com";
    next();
    return;
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ message: "Invalid or expired token" });
      return;
    }

    req.userId = user.id;
    req.userEmail = user.email;
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ message: "Authentication failed" });
  }
}

/**
 * Middleware that optionally authenticates
 * Proceeds regardless of auth status, but sets userId if valid token provided
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req.headers.authorization);

  if (!token) {
    next();
    return;
  }

  if (!supabase) {
    console.warn("Supabase not configured");
    next();
    return;
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      req.userId = user.id;
      req.userEmail = user.email;
    }
  } catch (error) {
    console.error("Optional auth error:", error);
  }

  next();
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!supabase;
}
