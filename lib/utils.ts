import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatMoney } from "./format"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export { formatMoney }
export const formatCurrency = (amount: number | string | null | undefined): string => {
  const num = typeof amount === "string" ? parseFloat(amount) : Number(amount || 0);
  return formatMoney(isNaN(num) ? 0 : num);
};
