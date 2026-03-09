import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUptime(startedAt: Date | string, seconds: boolean = false): string {
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)

  if (seconds) return `${h}h ${m}m`;

  const s = diff % 60
  return `${h}h ${m}m ${s}s`  
}