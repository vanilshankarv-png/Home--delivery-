export function calculateProviderBadges(provider) {
  if (provider.verificationStatus !== "verified") return [];

  const badges = [{ name: "Verified Identity", level: "Verified" }];
  for (const skill of provider.skills || []) {
    let level = "Bronze";
    if (skill.yearsExperience >= 5 && provider.ratingAvg >= 4.5) {
      level = "Gold";
    } else if (skill.yearsExperience >= 2) {
      level = "Silver";
    }
    badges.push({ name: "Skill Verified", level });
  }
  return badges;
}

export async function reEvaluateProviderBadges(provider) {
  provider.badges = calculateProviderBadges(provider);
  await provider.save();
  return provider.badges;
}
