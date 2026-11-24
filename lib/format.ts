const LOCALE = "en-IN";
const TIME_ZONE = "Asia/Kolkata";
const CURRENCY = "INR";

export const formatMoney = (n: number) =>
  new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }).format(n);
// negatives must read -₹2,980

export const formatDate = (iso: string | Date) =>
  new Intl.DateTimeFormat(LOCALE, { day: "2-digit", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(new Date(iso));

export const formatTime = (iso: string | Date) =>
  new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: TIME_ZONE }).format(new Date(iso));

export const formatDateTime = (iso: string | Date) => `${formatDate(iso)}, ${formatTime(iso)}`;

// YYYY-MM-DD for date inputs and "today" filters
export const todayInIndia = () => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());

// Alias for backwards compatibility
export const formatCurrency = formatMoney;
