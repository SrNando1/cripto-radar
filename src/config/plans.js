// Limites por plano — fonte única de verdade para a lógica freemium.
export const PLAN_LIMITS = {
  free:   { watchlistMax: 5,        chartMaxDays: 7,   portfolioMax: 3,        refreshMs: 60000, coinsMax: 20 },
  pro:    { watchlistMax: Infinity, chartMaxDays: 365, portfolioMax: Infinity, refreshMs: 10000, coinsMax: 250 },
  trader: { watchlistMax: Infinity, chartMaxDays: 365, portfolioMax: Infinity, refreshMs: 10000, coinsMax: 250 },
}

export function getLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free
}
