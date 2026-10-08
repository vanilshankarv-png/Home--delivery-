import { jest } from "@jest/globals";
import request from "supertest";
import { createApp } from "../src/app.js";

class FakeQuery {
  constructor(value) {
    this.value = value;
  }

  select() { return this; }
  populate() { return this; }
  sort() { return this; }
  skip() { return this; }
  limit() { return this; }
  lean() { return Promise.resolve(this.value); }
  then(resolve, reject) { return Promise.resolve(this.value).then(resolve, reject); }
}

describe("public catalog APIs", () => {
  let app;
  let capturedServiceFilter;
  let capturedAggregate;
  const category = { _id: "category-1", name: "Plumbing", slug: "plumbing", icon: "Wrench" };
  const service = {
    _id: "service-1",
    title: "Tap leak repair",
    category,
    basePrice: 299,
    rating: 4.7,
    bookingsCount: 120,
    isActive: true
  };

  beforeEach(() => {
    capturedServiceFilter = null;
    capturedAggregate = null;
    const Category = {
      find: jest.fn(() => new FakeQuery([category])),
      findOne: jest.fn(() => new FakeQuery(category))
    };
    const Service = {
      find: jest.fn((filter) => {
        capturedServiceFilter = filter;
        return new FakeQuery([service]);
      }),
      findOne: jest.fn(() => new FakeQuery(service)),
      exists: jest.fn(async () => ({ _id: service._id })),
      countDocuments: jest.fn(async () => 1)
    };
    const Provider = {
      aggregate: jest.fn(async (pipeline) => {
        capturedAggregate = pipeline;
        if (pipeline.some((stage) => stage.$unwind === "$skills")) {
          return [{ _id: service._id }];
        }
        return [{ _id: "provider-1", isAvailable: true, distanceKm: 2.4 }];
      })
    };
    app = createApp({ catalogModels: { Category, Service, Provider } });
  });

  it("lists categories and returns paginated filtered services", async () => {
    const categories = await request(app).get("/api/categories");
    const services = await request(app)
      .get("/api/services?category=plumbing&minPrice=200&maxPrice=500&sort=price&page=2&limit=5");

    expect(categories.status).toBe(200);
    expect(categories.body.categories).toHaveLength(1);
    expect(services.status).toBe(200);
    expect(services.body.services[0].title).toBe("Tap leak repair");
    expect(services.body.pagination).toEqual({ page: 2, limit: 5, total: 1, pages: 1 });
    expect(capturedServiceFilter).toEqual({
      isActive: true,
      category: category._id,
      basePrice: { $gte: 200, $lte: 500 }
    });
  });

  it("searches with a text index filter and validates coordinates", async () => {
    const response = await request(app).get("/api/services/search?q=tap%20leak&category=plumbing&lat=17.68&lng=83.21");
    const invalid = await request(app).get("/api/services/search?lat=100&lng=83");

    expect(response.status).toBe(200);
    expect(capturedServiceFilter.$text).toEqual({ $search: "tap leak" });
    expect(capturedServiceFilter._id.$in).toEqual([service._id]);
    expect(invalid.status).toBe(400);
  });

  it("returns popular services and service details", async () => {
    const popular = await request(app).get("/api/services/popular");
    const detail = await request(app).get("/api/services/service-1");

    expect(popular.status).toBe(200);
    expect(popular.body.services[0].bookingsCount).toBe(120);
    expect(detail.status).toBe(200);
    expect(detail.body.service.title).toBe("Tap leak repair");
  });

  it("finds verified available providers within 15 km and requires coordinates", async () => {
    const providers = await request(app).get("/api/services/service-1/providers?lat=17.6868&lng=83.2185");
    const missingLocation = await request(app).get("/api/services/service-1/providers");
    const geoNear = capturedAggregate[0].$geoNear;

    expect(providers.status).toBe(200);
    expect(providers.body.providers[0].isAvailable).toBe(true);
    expect(geoNear.maxDistance).toBe(15_000);
    expect(geoNear.query.verificationStatus).toBe("verified");
    expect(missingLocation.status).toBe(400);
  });
});
