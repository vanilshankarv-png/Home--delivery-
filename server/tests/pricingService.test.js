import { calculatePricing, distanceBetweenKm } from "../src/services/pricingService.js";

const rules = [
  {
    type: "demand",
    isActive: true,
    config: {
      baseMultiplier: 1,
      referenceRatio: 1,
      sensitivity: 0.15,
      minimumMultiplier: 1,
      maximumMultiplier: 2.5,
      neutralMultiplier: 1
    }
  },
  {
    type: "distance",
    isActive: true,
    config: { baseFactor: 1, neutralFactor: 1, includedKm: 3, perKm: 0.05, minimumExcessKm: 0 }
  },
  {
    type: "time",
    isActive: true,
    config: {
      normalMultiplier: 1,
      neutralMultiplier: 1,
      nightStartHour: 22,
      nightEndHour: 6,
      nightMultiplier: 1.2,
      eveningStartHour: 18,
      eveningEndHour: 21,
      eveningMultiplier: 1.1,
      timeZone: "Asia/Kolkata"
    }
  },
  {
    type: "fee",
    isActive: true,
    config: { percent: 10, neutralPercent: 0 }
  }
];

describe("dynamic pricing service", () => {
  it("calculates the demand, distance, time, fee, subtotal, and total breakdown", () => {
    const breakdown = calculatePricing({
      basePrice: 100,
      scheduledAt: new Date("2025-01-01T23:00:00Z"),
      distanceKm: 5,
      openRequests: 3,
      availableProviders: 2,
      rules
    });

    expect(breakdown).toEqual({
      base: 100,
      demandMultiplier: 1.075,
      distanceFactor: 1.1,
      distanceKm: 5,
      timeFactor: 1.2,
      platformFee: 14.19,
      subtotal: 141.9,
      total: 156.09
    });
  });

  it("clamps demand between the configured minimum and maximum", () => {
    const lowDemand = calculatePricing({
      basePrice: 100,
      scheduledAt: new Date("2025-01-01T12:00:00Z"),
      distanceKm: null,
      openRequests: 0,
      availableProviders: 5,
      rules
    });
    const highDemand = calculatePricing({
      basePrice: 100,
      scheduledAt: new Date("2025-01-01T12:00:00Z"),
      distanceKm: null,
      openRequests: 100,
      availableProviders: 1,
      rules
    });

    expect(lowDemand.demandMultiplier).toBe(1);
    expect(highDemand.demandMultiplier).toBe(2.5);
  });

  it("applies the configured local-time multipliers at their boundaries", () => {
    const quoteAt = (date) => calculatePricing({
      basePrice: 100,
      scheduledAt: new Date(date),
      distanceKm: null,
      openRequests: 0,
      availableProviders: 1,
      rules
    }).timeFactor;

    expect(quoteAt("2025-01-01T00:29:00Z")).toBe(1.2);
    expect(quoteAt("2025-01-01T00:30:00Z")).toBe(1);
    expect(quoteAt("2025-01-01T12:30:00Z")).toBe(1.1);
    expect(quoteAt("2025-01-01T15:30:00Z")).toBe(1.1);
    expect(quoteAt("2025-01-01T15:31:00Z")).toBe(1);
    expect(quoteAt("2025-01-01T16:30:00Z")).toBe(1.2);
  });

  it("uses configured neutral values when a pricing rule is inactive", () => {
    const inactiveRules = rules.map((rule) => ({ ...rule, isActive: false }));
    const breakdown = calculatePricing({
      basePrice: 100,
      scheduledAt: new Date("2025-01-01T23:00:00Z"),
      distanceKm: 15,
      openRequests: 100,
      availableProviders: 1,
      rules: inactiveRules
    });

    expect(breakdown.demandMultiplier).toBe(1);
    expect(breakdown.distanceFactor).toBe(1);
    expect(breakdown.timeFactor).toBe(1);
    expect(breakdown.platformFee).toBe(0);
    expect(breakdown.total).toBe(100);
  });

  it("calculates geographic distance in kilometers", () => {
    expect(distanceBetweenKm([0, 0], [0, 1])).toBeCloseTo(111.195, 2);
  });
});
