// Stat-tile values use auto-compact figures per the dataviz skill's Figures
// spec: 1,284 / 12.9K / $4.2M — never raw long numbers on a hero/stat value.
export function formatCompactNumber(value: number): string {
  if (value < 1000) return value.toLocaleString("en-US");
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatCompactCurrency(value: number): string {
  if (value < 1000) return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
