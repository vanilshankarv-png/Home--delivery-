import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app.js";

process.env.JWT_SECRET = "test-only-provider-verification-secret";

class FakeQuery {
  constructor(value) {
    this.value = value;
  }

  populate() { return this; }
  select() { return this; }
  sort() { return this; }
  lean() { return Promise.resolve(this.value); }
  then(resolve, reject) { return Promise.resolve(this.value).then(resolve, reject); }
}

describe("provider verification APIs", () => {
  let app;
  let provider;
  let verification;
  let adminToken;
  let providerToken;

  beforeEach(() => {
    const providerUser = { _id: "provider-user", role: "provider", isBlocked: false };
    const adminUser = { _id: "admin-user", role: "admin", isBlocked: false };
    providerToken = jwt.sign({ sub: providerUser._id, role: providerUser.role }, process.env.JWT_SECRET);
    adminToken = jwt.sign({ sub: adminUser._id, role: adminUser.role }, process.env.JWT_SECRET);
    provider = {
      _id: "provider-profile",
      user: providerUser._id,
      skills: [],
      badges: [],
      verificationStatus: "none",
      ratingAvg: 4.6,
      save: async function save() { return this; }
    };
    verification = null;

    const User = {
      findById: jest.fn((id) => new FakeQuery(id === adminUser._id ? adminUser : providerUser))
    };
    const Service = {
      find: jest.fn(() => new FakeQuery([{ _id: "service-one" }])),
      findOne: jest.fn(() => new FakeQuery({ _id: "service-one" }))
    };
    const Provider = {
      findOneAndUpdate: jest.fn(async (filter, update) => {
        Object.assign(provider, update.$set || {});
        if (update.$set?.verificationStatus === "verified") {
          provider.badges = [
            { name: "Verified Identity", level: "Verified" },
            ...provider.skills.map((skill) => ({
              name: "Skill Verified",
              level: skill.yearsExperience >= 5 && provider.ratingAvg >= 4.5 ? "Gold" : skill.yearsExperience >= 2 ? "Silver" : "Bronze"
            }))
          ];
        }
        return provider;
      }),
      findOne: jest.fn(() => new FakeQuery(provider)),
      findById: jest.fn(() => new FakeQuery(provider))
    };
    const Verification = {
      findOneAndUpdate: jest.fn((filter, update) => {
        verification = {
          _id: "verification-one",
          provider: filter.provider,
          status: "pending",
          skills: [],
          ...update.$set,
          save: async function save() { return this; }
        };
        return new FakeQuery(verification);
      }),
      findOne: jest.fn(() => new FakeQuery(verification)),
      find: jest.fn(() => new FakeQuery(verification ? [verification] : [])),
      findById: jest.fn(() => verification)
    };

    app = createApp({
      providerModels: { User, Provider, Verification, Service },
      catalogModels: {
        Category: { find: () => new FakeQuery([]), findOne: () => new FakeQuery(null) },
        Service,
        Provider
      }
    });
    app.locals.testProvider = provider;
    app.locals.testUser = providerUser;
    app.locals.testVerification = () => verification;
  });

  it("requires provider auth and accepts identity documents", async () => {
    const unauthenticated = await request(app).post("/api/providers/verification");
    expect(unauthenticated.status).toBe(401);

    const submitted = await request(app)
      .post("/api/providers/verification")
      .set("Authorization", `Bearer ${providerToken}`)
      .attach("idProof", Buffer.from("id-proof"), { filename: "id.pdf", contentType: "application/pdf" })
      .attach("addressProof", Buffer.from("address-proof"), { filename: "address.pdf", contentType: "application/pdf" })
      .field("skills", "[]");

    expect(submitted.status).toBe(201);
    expect(submitted.body.verification.status).toBe("pending");
    expect(provider.verificationStatus).toBe("pending");

    const invalidFile = await request(app)
      .post("/api/providers/verification")
      .set("Authorization", `Bearer ${providerToken}`)
      .attach("idProof", Buffer.from("not-an-image"), { filename: "proof.txt", contentType: "text/plain" });
    expect(invalidFile.status).toBe(415);
  });

  it("returns current status and adds a certificate-backed skill for review", async () => {
    verification = {
      _id: "verification-one",
      provider: "provider-user",
      status: "pending",
      skills: [],
      save: async function save() { return this; }
    };
    provider.verificationStatus = "pending";

    const status = await request(app)
      .get("/api/providers/verification/status")
      .set("Authorization", `Bearer ${providerToken}`);
    const added = await request(app)
      .post("/api/providers/skills")
      .set("Authorization", `Bearer ${providerToken}`)
      .field("service", "0123456789abcdef01234567")
      .field("yearsExperience", "6")
      .attach("certificate", Buffer.from("certificate"), { filename: "skill.pdf", contentType: "application/pdf" });

    expect(status.status).toBe(200);
    expect(added.status).toBe(201);
    expect(provider.skills).toHaveLength(1);
    expect(provider.verificationStatus).toBe("pending");
  });

  it("returns public badges and allows only admins to approve verification", async () => {
    provider.verificationStatus = "pending";
    provider.skills = [{ service: "service-one", yearsExperience: 6 }];
    verification = {
      _id: "verification-one",
      provider: "provider-user",
      status: "pending",
      skills: [],
      save: async function save() { return this; }
    };

    const badges = await request(app).get("/api/providers/provider-profile/badges");
    const forbidden = await request(app)
      .put("/api/providers/verification/verification-one/review")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ action: "approve" });
    const approved = await request(app)
      .put("/api/providers/verification/verification-one/review")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "approve", note: "Documents checked." });

    expect(badges.status).toBe(200);
    expect(forbidden.status).toBe(403);
    expect(approved.status).toBe(200);
    expect(approved.body.badges).toEqual([
      { name: "Verified Identity", level: "Verified" },
      { name: "Skill Verified", level: "Gold" }
    ]);
  });

  it("returns the pending queue to admins only", async () => {
    verification = {
      _id: "verification-one",
      provider: "provider-user",
      status: "pending",
      skills: []
    };
    const response = await request(app)
      .get("/api/providers/verification/status")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.verifications).toHaveLength(1);
  });
});
