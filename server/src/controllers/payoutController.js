import { getProviderEarnings, requestPayout } from "../services/payoutService.js";

export function createPayoutController({ Provider, Payment, Payout }) {
  return {
    list: async (req, res, next) => {
      try {
        const earnings = await getProviderEarnings({
          Provider,
          Payment,
          Payout,
          providerId: req.user.id
        });
        return res.json({ success: true, ...earnings });
      } catch (error) {
        return next(error);
      }
    },
    request: async (req, res, next) => {
      try {
        const result = await requestPayout({
          Provider,
          Payout,
          providerId: req.user.id,
          amount: req.body.amount,
          method: req.body.method,
          details: req.body.details
        });
        return res.status(201).json({ success: true, ...result });
      } catch (error) {
        return next(error);
      }
    }
  };
}
