import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app.js";

process.env.JWT_SECRET = "test-only-home-delivery-secret";
process.env.JWT_EXPIRES_IN = "1h";

class Query {
  constructor(value) {
    this.value = value;
  }

  select() {
    return this;
  }

  then(resolve, reject) {
    return Promise.resolve(this.value).then(resolve, reject);
  }
}

function makeUserModel() {
  const records = new Map();

  class TestUser {
    static records = records;

    constructor(fields) {
      Object.assign(this, fields);
      this._id = `user-${this.email}`;
      this.address = this.address || [];
      this.isAvailable = this.isAvailable || false;
      this.isBlocked = this.isBlocked || false;
    }

    async save() {
      records.set(this.email, this);
      return this;
    }

    toObject() {
      return { ...this };
    }

    static findOne({ email }) {
      return new Query(records.get(email) || null);
    }

    static findById(id) {
      return new Query([...records.values()].find((user) => user._id === id) || null);
    }

    static async findByIdAndUpdate(id, update) {
      const user = [...records.values()].find((record) => record._id === id);
      if (!user) return null;
      Object.assign(user, update.$set);
      return user;
    }
  }

  return { TestUser, records };
}

describe("authentication and profile APIs", () => {
  let app;
  let User;

  beforeEach(() => {
    const model = makeUserModel();
    User = model.TestUser;
    app = createApp({ UserModel: User });
  });

  it("registers a customer and returns a token without password fields", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Taylor Home",
      email: "TAYLOR@example.com",
      phone: "+1 555 010 2020",
      password: "A-secure-pass-1",
      role: "customer"
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe("taylor@example.com");
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.token).toEqual(expect.any(String));
    expect(jwt.verify(response.body.token, process.env.JWT_SECRET).role).toBe("customer");
  });

  it("rejects attempts to register an admin or duplicate email", async () => {
    const payload = {
      name: "Taylor Home",
      email: "taylor@example.com",
      phone: "+1 555 010 2020",
      password: "A-secure-pass-1",
      role: "customer"
    };
    const first = await request(app).post("/api/auth/register").send(payload);
    const admin = await request(app).post("/api/auth/register").send({ ...payload, email: "admin@example.com", role: "admin" });
    const duplicate = await request(app).post("/api/auth/register").send(payload);

    expect(first.status).toBe(201);
    expect(admin.status).toBe(400);
    expect(duplicate.status).toBe(409);
  });

  it("logs in with valid credentials and rejects invalid credentials", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Provider One",
      email: "provider@example.com",
      phone: "+1 555 010 2020",
      password: "A-secure-pass-1",
      role: "provider"
    });

    const valid = await request(app).post("/api/auth/login").send({
      email: "provider@example.com",
      password: "A-secure-pass-1"
    });
    const invalid = await request(app).post("/api/auth/login").send({
      email: "provider@example.com",
      password: "incorrect-password"
    });

    expect(valid.status).toBe(200);
    expect(valid.body.user.role).toBe("provider");
    expect(valid.body.user.passwordHash).toBeUndefined();
    expect(invalid.status).toBe(401);
  });

  it("returns current user and updates profile only for an authenticated user", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      name: "Customer One",
      email: "customer@example.com",
      phone: "+1 555 010 2020",
      password: "A-secure-pass-1"
    });
    const registeredToken = registration.body.token;

    const current = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${registeredToken}`);
    const updated = await request(app).put("/api/users/profile")
      .set("Authorization", `Bearer ${registeredToken}`)
      .send({
        name: "Customer Updated",
        address: [{
          label: "Home",
          line1: "10 Main Street",
          city: "Seattle",
          pincode: "98101",
          location: { type: "Point", coordinates: [-122.3321, 47.6062] }
        }]
      });
    const customerAvailability = await request(app).put("/api/users/profile")
      .set("Authorization", `Bearer ${registeredToken}`)
      .send({ isAvailable: true });
    const unauthorized = await request(app).get("/api/auth/me");

    expect(current.status).toBe(200);
    expect(current.body.user.name).toBe("Customer One");
    expect(updated.status).toBe(200);
    expect(updated.body.user.name).toBe("Customer Updated");
    expect(updated.body.user.address[0].location.coordinates).toEqual([-122.3321, 47.6062]);
    expect(customerAvailability.status).toBe(403);
    expect(unauthorized.status).toBe(401);
  });

  it("changes password only after verifying the current password", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      name: "Password Test",
      email: "password@example.com",
      phone: "+1 555 010 2020",
      password: "A-secure-pass-1"
    });
    const token = registration.body.token;
    const wrongCurrent = await request(app).put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "wrong-password", newPassword: "Another-secure-2" });
    const changed = await request(app).put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "A-secure-pass-1", newPassword: "Another-secure-2" });
    const user = User.records?.get("password@example.com");

    expect(wrongCurrent.status).toBe(400);
    expect(changed.status).toBe(200);
    expect(await bcrypt.compare("Another-secure-2", user?.passwordHash)).toBe(true);
  });
});
