// Limites por plano — fonte única de verdade para a lógica freemium.
export const PLAN_LIMITS = {
  free:   { watchlistMax: 5,        chartMaxDays: 7 },
  pro:    { watchlistMax: Infinity, chartMaxDays: 365 },
  trader: { watchlistMax: Infinity, chartMaxDays: 365 },
}

export function getLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free
}
