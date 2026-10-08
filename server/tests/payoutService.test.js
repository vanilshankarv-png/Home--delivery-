import { getProviderEarnings, requestPayout } from "../src/services/payoutService.js";

const providerId = "111111111111111111111111";

describe("payout service", () => {
  test("rejects payout requests below ₹500", async () => {
    await expect(requestPayout({
      Provider: {},
      Payout: {},
      providerId,
      amount: 499,
      method: "upi",
      details: { upiId: "test@bank" }
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test("reserves balance before creating a payout request", async () => {
    const provider = { walletBalance: 250 };
    const Provider = {
      findOneAndUpdate: (filter, update) => ({
        lean: async () => {
          if (provider.walletBalance < 500) return null;
          provider.walletBalance += update.$inc.walletBalance;
          return { ...provider };
        }
      }),
      findOne: () => ({
        select: () => ({ lean: async () => ({ walletBalance: provider.walletBalance }) })
      })
    };
    const Payout = {
      create: async (fields) => ({ _id: "payout-1", ...fields })
    };

    await expect(requestPayout({
      Provider,
      Payout,
      providerId,
      amount: 500,
      method: "upi",
      details: { upiId: "test@bank" }
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.walletBalance).toBe(250);
  });

  test("does not allow a payout to consume provider funds held for a dispute", async () => {
    const provider = { walletBalance: 1200, walletHeldBalance: 800 };
    const Provider = {
      findOneAndUpdate: () => ({
        lean: async () => provider.walletBalance - provider.walletHeldBalance >= 500 ? provider : null
      }),
      findOne: () => ({
        select: () => ({ lean: async () => provider })
      })
    };

    await expect(requestPayout({
      Provider,
      Payout: {},
      providerId,
      amount: 500,
      method: "upi",
      details: { upiId: "test@bank" }
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.walletBalance).toBe(1200);
  });

  test("rolls back wallet reservation when payout persistence fails", async () => {
    const provider = { walletBalance: 1000 };
    const Provider = {
      findOneAndUpdate: (_filter, update) => ({
        lean: async () => {
          provider.walletBalance += update.$inc.walletBalance;
          return { ...provider };
        }
      }),
      updateOne: async (_filter, update) => {
        provider.walletBalance += update.$inc.walletBalance;
        return { modifiedCount: 1 };
      }
    };
    const Payout = { create: async () => { throw new Error("database unavailable"); } };

    await expect(requestPayout({
      Provider,
      Payout,
      providerId,
      amount: 500,
      method: "upi",
      details: { upiId: "test@bank" }
    })).rejects.toThrow("database unavailable");
    expect(provider.walletBalance).toBe(1000);
  });

  test("reports provider net earnings after platform fee", async () => {
    const providerQuery = { select: () => ({ lean: async () => ({ walletBalance: 700 }) }) };
    const makeQuery = (value) => ({
      select() { return this; },
      sort() { return this; },
      lean: async () => value
    });
    const earnings = await getProviderEarnings({
      Provider: { findOne: () => providerQuery },
      Payment: { find: () => makeQuery([{ amount: 1100, platformFee: 100, status: "paid", createdAt: new Date("2025-01-01") }]) },
      Payout: { find: () => makeQuery([]) },
      providerId
    });

    expect(earnings.earnings).toBe(1000);
    expect(earnings.walletBalance).toBe(700);
    expect(earnings.chart).toEqual([{ month: "2025-01", amount: 1000 }]);
  });
});
