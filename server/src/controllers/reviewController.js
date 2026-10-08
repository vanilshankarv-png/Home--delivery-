import { httpError } from "../services/paymentService.js";
import { recalculateRatings } from "../services/reviewService.js";

function idOf(value) {
  return String(value?._id || value);
}

export function createReviewController({ Booking, Review, Provider, Service }) {
  return {
    create: async (req, res, next) => {
      try {
        if (req.user.role !== "customer") throw httpError("Only customers can submit reviews.", 403);
        const booking = await Booking.findById(req.body.bookingId).lean();
        if (!booking) throw httpError("Booking not found.", 404);
        if (idOf(booking.customer) !== req.user.id) {
          throw httpError("Only the booking customer can leave a review.", 403);
        }
        if (!["PAID", "COMPLETED"].includes(booking.status)) {
          throw httpError("Reviews are available after a booking is completed.", 409);
        }
        if (!booking.provider) throw httpError("This booking has no assigned provider.", 409);

        let review;
        try {
          review = await Review.create({
            booking: booking._id,
            customer: booking.customer,
            provider: booking.provider,
            service: booking.service,
            rating: req.body.rating,
            comment: req.body.comment || "",
            tags: req.body.tags || []
          });
        } catch (error) {
          if (error.code === 11000) throw httpError("A review has already been submitted for this booking.", 409);
          throw error;
        }

        let ratings;
        try {
          ratings = await recalculateRatings({
            Review,
            Provider,
            Service,
            providerId: booking.provider,
            serviceId: booking.service
          });
        } catch (error) {
          await Review.deleteOne({ _id: review._id });
          try {
            await recalculateRatings({
              Review,
              Provider,
              Service,
              providerId: booking.provider,
              serviceId: booking.service
            });
          } catch (rollbackError) {
            console.error("Rating rollback failed after review persistence error.", {
              reviewId: String(review._id),
              error: rollbackError
            });
          }
          throw error;
        }
        return res.status(201).json({ success: true, review, ratings });
      } catch (error) {
        return next(error);
      }
    },

    providerReviews: async (req, res, next) => {
      try {
        const provider = await Provider.findById(req.params.id)
          || await Provider.findOne({ user: req.params.id });
        if (!provider) throw httpError("Provider not found.", 404);
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 10);
        const filter = { provider: provider.user };
        const [reviews, total, distribution] = await Promise.all([
          Review.find(filter)
            .populate("customer", "name avatar")
            .populate("service", "title")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
          Review.countDocuments(filter),
          Review.aggregate([
            { $match: filter },
            { $group: { _id: "$rating", count: { $sum: 1 } } }
          ])
        ]);
        const ratingDistribution = Object.fromEntries([1, 2, 3, 4, 5].map((rating) => [
          rating,
          distribution.find((item) => item._id === rating)?.count || 0
        ]));
        return res.json({
          success: true,
          provider: {
            id: idOf(provider.user),
            ratingAvg: provider.ratingAvg,
            ratingCount: provider.ratingCount
          },
          reviews,
          ratingDistribution,
          pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
      } catch (error) {
        return next(error);
      }
    }
  };
}
