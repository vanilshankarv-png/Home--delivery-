import { calculateProviderBadges } from "../src/services/badgeService.js";

describe("provider skill badge levels", () => {
  it("does not award verification badges before identity approval", () => {
    expect(calculateProviderBadges({
      verificationStatus: "pending",
      ratingAvg: 5,
      skills: [{ yearsExperience: 8 }]
    })).toEqual([]);
  });

  it("assigns bronze, silver, and rating-qualified gold badges after verification", () => {
    const badges = calculateProviderBadges({
      verificationStatus: "verified",
      ratingAvg: 4.5,
      jobsDone: 4,
      skills: [
        { yearsExperience: 1 },
        { yearsExperience: 3 },
        { yearsExperience: 5 }
      ]
    });

    expect(badges).toEqual([
      { name: "Verified Identity", level: "Verified" },
      { name: "Skill Verified", level: "Bronze" },
      { name: "Skill Verified", level: "Silver" },
      { name: "Skill Verified", level: "Gold" }
    ]);
  });

  it("keeps five-year skills silver until the rating reaches 4.5", () => {
    const badges = calculateProviderBadges({
      verificationStatus: "verified",
      ratingAvg: 4.49,
      skills: [{ yearsExperience: 5 }]
    });
    expect(badges[1].level).toBe("Silver");
  });
});
