import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a score with exactly 2 decimal places
 * Used for: final scores, model scores, average scores
 * Examples: 82 -> "82.00", 82.5 -> "82.50", 82.25 -> "82.25"
 */
export function formatScore(score: number | string | null | undefined): string {
  if (score === null || score === undefined) return "0.00";
  const num = typeof score === "string" ? parseFloat(score) : score;
  if (isNaN(num)) return "0.00";
  return num.toFixed(2);
}

/**
 * Format a component score with exactly 1 decimal place
 * Used for: coordination, schelling, reflexivity, virality, asymmetry, game theory scores
 * Examples: 15 -> "15.0", 15.5 -> "15.5"
 */
export function formatComponentScore(score: number | string | null | undefined): string {
  if (score === null || score === undefined) return "0.0";
  const num = typeof score === "string" ? parseFloat(score) : score;
  if (isNaN(num)) return "0.0";
  return num.toFixed(1);
}

/**
 * Format a modifier value with exactly 1 decimal place and +/- sign
 * Used for: phase modifier, narrative modifier, etc.
 * Examples: 5 -> "+5.0", -3 -> "-3.0", 0 -> "0.0"
 */
export function formatModifier(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "0.0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0.0";
  const prefix = num > 0 ? "+" : "";
  return `${prefix}${num.toFixed(1)}`;
}
