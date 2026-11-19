/**
 * Straight-line NBV (Net Book Value)
 *
 * Annual depreciation = (purchaseCost - residualValue) / usefulLifeYears
 * Accumulated depreciation = annualDepreciation * yearsElapsed (capped at depreciable amount)
 * NBV = purchaseCost - accumulatedDepreciation (floored at residualValue)
 *
 * Assumptions:
 * - Full years are fractional (exact day count / 365.25)
 * - If inputs missing/invalid, returns nulls (no invented values)
 * - NBV is accounting book value — NOT Net Present Value (NPV)
 */

function yearsBetween(startDate, endDate = new Date()) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return 0;
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

function calculateStraightLineNbv({
  purchaseCost,
  residualValue = 0,
  usefulLifeYears,
  purchaseDate,
  asOf = new Date(),
}) {
  const cost = Number(purchaseCost);
  const residual = Number(residualValue ?? 0);
  const life = Number(usefulLifeYears);

  if (!Number.isFinite(cost) || cost < 0) {
    return { annualDepreciation: null, accumulatedDepreciation: null, nbv: null, yearsElapsed: null };
  }
  if (!Number.isFinite(life) || life <= 0) {
    return { annualDepreciation: null, accumulatedDepreciation: null, nbv: null, yearsElapsed: null };
  }
  if (!purchaseDate) {
    return { annualDepreciation: null, accumulatedDepreciation: null, nbv: null, yearsElapsed: null };
  }

  const yearsElapsed = yearsBetween(purchaseDate, asOf);
  if (yearsElapsed === null) {
    return { annualDepreciation: null, accumulatedDepreciation: null, nbv: null, yearsElapsed: null };
  }

  const depreciable = Math.max(cost - residual, 0);
  const annualDepreciation = depreciable / life;
  const rawAccumulated = annualDepreciation * yearsElapsed;
  const accumulatedDepreciation = Math.min(rawAccumulated, depreciable);
  const nbv = Math.max(cost - accumulatedDepreciation, residual);

  return {
    annualDepreciation: round2(annualDepreciation),
    accumulatedDepreciation: round2(accumulatedDepreciation),
    nbv: round2(nbv),
    yearsElapsed: round4(yearsElapsed),
  };
}

/** NPV of user-entered cash flows (separate from asset NBV). */
function calculateNpv(cashFlows, discountRatePercent) {
  const rate = Number(discountRatePercent) / 100;
  if (!Number.isFinite(rate)) {
    throw new Error('discountRatePercent must be a number');
  }
  if (!Array.isArray(cashFlows) || cashFlows.length === 0) {
    throw new Error('cashFlows must be a non-empty array');
  }

  let npv = 0;
  const periods = cashFlows.map((cf, t) => {
    const amount = Number(cf);
    if (!Number.isFinite(amount)) {
      throw new Error(`cashFlows[${t}] must be a number`);
    }
    const pv = amount / (1 + rate) ** t;
    npv += pv;
    return { period: t, cashFlow: amount, presentValue: round2(pv) };
  });

  return { npv: round2(npv), discountRatePercent: Number(discountRatePercent), periods };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

module.exports = { calculateStraightLineNbv, calculateNpv };
