export async function recalculateRatings({ Review, Provider, Service, providerId, serviceId }) {
  const [providerStats, serviceStats] = await Promise.all([
    Review.aggregate([
      { $match: { provider: providerId } },
      { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } }
    ]),
    Review.aggregate([
      { $match: { service: serviceId } },
      { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } }
    ])
  ]);
  const provider = await Provider.findOne({ user: providerId });
  if (!provider) throw new Error("Provider profile was not found while recalculating ratings.");
  provider.ratingAvg = Number((providerStats[0]?.average || 0).toFixed(2));
  provider.ratingCount = providerStats[0]?.count || 0;
  await provider.save();

  const serviceRating = Number((serviceStats[0]?.average || 0).toFixed(2));
  const serviceRatingCount = serviceStats[0]?.count || 0;
  const serviceUpdate = await Service.updateOne(
    { _id: serviceId },
    { $set: { rating: serviceRating, ratingCount: serviceRatingCount } }
  );
  if (serviceUpdate.matchedCount !== 1) throw new Error("Service was not found while recalculating ratings.");

  return {
    provider: { ratingAvg: provider.ratingAvg, ratingCount: provider.ratingCount },
    service: { rating: serviceRating, ratingCount: serviceRatingCount }
  };
}
