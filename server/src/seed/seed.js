import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Category from "../models/Category.js";
import PricingRule from "../models/PricingRule.js";
import Provider from "../models/Provider.js";
import Service from "../models/Service.js";
import User from "../models/User.js";

const categories = [
  { name: "Plumbing", slug: "plumbing", icon: "Wrench", description: "Leaks, fittings, drains, and water systems." },
  { name: "Electrical", slug: "electrical", icon: "Zap", description: "Safe electrical repairs and installations." },
  { name: "Cleaning", slug: "cleaning", icon: "Sparkles", description: "A fresh, cared-for home from top to bottom." },
  { name: "AC Repair", slug: "ac-repair", icon: "Wind", description: "Air conditioner servicing and repairs." },
  { name: "Carpentry", slug: "carpentry", icon: "Hammer", description: "Furniture, fittings, doors, and woodwork." },
  { name: "Painting", slug: "painting", icon: "Paintbrush", description: "Interior and exterior painting services." },
  { name: "Pest Control", slug: "pest-control", icon: "Bug", description: "Responsible pest inspection and treatment." },
  { name: "Appliance Repair", slug: "appliance-repair", icon: "Refrigerator", description: "Repairs for the appliances your home relies on." }
];

const serviceData = [
  ["plumbing", "Tap leak repair", 299, 60, "Repair leaking taps, replace washers, and check water pressure.", ["tap", "leak", "faucet"]],
  ["plumbing", "Drain unclogging", 449, 75, "Clear common kitchen and bathroom drain blockages.", ["drain", "clog", "blocked"]],
  ["plumbing", "Toilet repair", 499, 90, "Diagnose and repair flush, cistern, and toilet leaks.", ["toilet", "flush", "bathroom"]],
  ["plumbing", "Bathroom fitting installation", 799, 120, "Install or replace standard bathroom fittings.", ["bathroom", "fitting", "installation"]],
  ["electrical", "Fan installation", 399, 60, "Install a ceiling fan and check the existing electrical point.", ["fan", "ceiling", "installation"]],
  ["electrical", "Switchboard repair", 349, 60, "Inspect and repair common switch and socket issues.", ["switch", "socket", "electrical"]],
  ["electrical", "Light fixture installation", 349, 60, "Install a standard indoor light fixture safely.", ["light", "fixture", "installation"]],
  ["electrical", "Inverter inspection", 599, 90, "Inspect inverter connections, battery condition, and backup.", ["inverter", "battery", "power"]],
  ["cleaning", "Full home deep cleaning", 2499, 240, "Detailed cleaning for floors, kitchens, bathrooms, and living areas.", ["deep clean", "home", "housekeeping"]],
  ["cleaning", "Bathroom deep cleaning", 599, 90, "Scrub and sanitize tiles, fixtures, and bathroom surfaces.", ["bathroom", "sanitization", "deep clean"]],
  ["cleaning", "Kitchen cleaning", 899, 120, "Degrease counters, backsplash, sink, and exterior cabinet surfaces.", ["kitchen", "grease", "deep clean"]],
  ["cleaning", "Sofa cleaning", 999, 120, "Vacuum and refresh a standard three-seat fabric sofa.", ["sofa", "upholstery", "fabric"]],
  ["ac-repair", "AC service (split)", 599, 90, "Clean filters and indoor unit, then check cooling performance.", ["air conditioning", "split ac", "cooling"]],
  ["ac-repair", "AC service (window)", 499, 75, "Clean a window AC unit and check its operation.", ["window ac", "cooling", "filter"]],
  ["ac-repair", "AC not cooling inspection", 299, 60, "Diagnose airflow and cooling problems before repair.", ["air conditioning", "cooling", "inspection"]],
  ["ac-repair", "AC installation", 1499, 180, "Install a split AC using existing standard fittings.", ["air conditioning", "installation", "split ac"]],
  ["carpentry", "Door lock repair", 349, 60, "Adjust or repair a standard interior door lock.", ["door", "lock", "repair"]],
  ["carpentry", "Furniture assembly", 599, 120, "Assemble flat-pack furniture with standard fittings.", ["furniture", "assembly", "table"]],
  ["carpentry", "Shelf installation", 499, 90, "Install a wall shelf on a suitable existing wall.", ["shelf", "wall", "installation"]],
  ["carpentry", "Door alignment repair", 399, 75, "Adjust hinges and alignment for a sticking interior door.", ["door", "hinge", "woodwork"]],
  ["painting", "Single room painting", 3499, 480, "Refresh one standard room with interior emulsion paint.", ["interior", "room", "walls"]],
  ["painting", "Wall touch-up", 699, 120, "Touch up small scuffs and marks on interior walls.", ["wall", "touch up", "interior"]],
  ["painting", "Exterior wall painting", 2999, 360, "Repaint a small exterior wall section with weather-resistant finish; paint extra.", ["exterior", "wall", "weatherproof"]],
  ["painting", "Waterproofing inspection", 499, 60, "Inspect visible damp patches and recommend next steps.", ["waterproofing", "damp", "inspection"]],
  ["pest-control", "General pest treatment", 899, 90, "Target common crawling insects in a standard apartment.", ["pest", "insects", "treatment"]],
  ["pest-control", "Cockroach control", 799, 75, "Targeted cockroach treatment for kitchens and bathrooms.", ["cockroach", "kitchen", "pest"]],
  ["pest-control", "Termite inspection", 599, 60, "Inspect accessible areas for signs of termite activity.", ["termite", "inspection", "wood"]],
  ["pest-control", "Mosquito control", 699, 60, "Treat common indoor mosquito resting areas.", ["mosquito", "insects", "treatment"]],
  ["appliance-repair", "Washing machine inspection", 399, 60, "Diagnose common washing machine drainage and spin issues.", ["washing machine", "washer", "appliance"]],
  ["appliance-repair", "Refrigerator inspection", 399, 60, "Check cooling, door seals, and basic refrigerator operation.", ["refrigerator", "fridge", "appliance"]],
  ["appliance-repair", "Microwave repair inspection", 349, 60, "Diagnose common microwave power and heating problems.", ["microwave", "appliance", "kitchen"]],
  ["appliance-repair", "Water purifier service", 499, 75, "Inspect filters and flow for common domestic water purifiers.", ["water purifier", "filter", "appliance"]]
];

const demoAccounts = [
  { name: "Home Delivery Admin", email: "admin@homedelivery.com", phone: "+91 9000000001", password: "Admin@123", role: "admin" },
  { name: "Demo Customer", email: "customer@homedelivery.com", phone: "+91 9000000002", password: "Customer@123", role: "customer" },
  { name: "Demo Provider", email: "provider@homedelivery.com", phone: "+91 9000000003", password: "Provider@123", role: "provider" },
  ...Array.from({ length: 9 }, (_, index) => ({
    name: `Visakhapatnam Pro ${String(index + 2).padStart(2, "0")}`,
    email: `provider${index + 2}@homedelivery.com`,
    phone: `+91 90000000${String(index + 4).padStart(2, "0")}`,
    password: "Provider@123",
    role: "provider"
  }))
];

function levelForExperience(years) {
  if (years >= 5) return "Gold";
  if (years >= 2) return "Silver";
  return "Bronze";
}

async function seed() {
  await connectDB();

  const categoryDocuments = await Promise.all(categories.map((category) => (
    Category.findOneAndUpdate(
      { slug: category.slug },
      { $set: category },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
  )));
  const categoryBySlug = new Map(categoryDocuments.map((category) => [category.slug, category]));

  const categoryIds = categoryDocuments.map((category) => category._id);
  await Service.deleteMany({ category: { $in: categoryIds } });
  const services = await Service.insertMany(serviceData.map(([slug, title, basePrice, durationMins, description, tags, unit = "per visit"]) => ({
    title,
    category: categoryBySlug.get(slug)._id,
    description,
    basePrice,
    unit,
    durationMins,
    tags,
    rating: Number((4.1 + Math.random() * 0.9).toFixed(1)),
    bookingsCount: Math.floor(10 + Math.random() * 450),
    images: []
  })));

  const accountDocuments = new Map();
  for (const account of demoAccounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    const user = await User.findOneAndUpdate(
      { email: account.email },
      {
        $set: {
          name: account.name,
          phone: account.phone,
          passwordHash,
          role: account.role,
          isAvailable: account.role === "provider",
          isBlocked: false
        }
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    accountDocuments.set(account.email, user);
  }

  const allServices = services;
  for (let index = 0; index < 10; index += 1) {
    const account = demoAccounts[index + 2];
    const user = accountDocuments.get(account.email);
    const selected = allServices.filter((_, serviceIndex) => serviceIndex % 10 === index % 10
      || serviceIndex % 10 === (index + 4) % 10
      || serviceIndex % 10 === (index + 7) % 10);
    const skills = selected.slice(0, 8).map((service, skillIndex) => {
      const yearsExperience = 1 + ((index + skillIndex * 2) % 8);
      return { service: service._id, yearsExperience, level: levelForExperience(yearsExperience) };
    });

    await Provider.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          skills,
          badges: [
            { name: "Verified Identity", level: "Verified" },
            ...skills.slice(0, 3).map((skill) => ({ name: "Skill Verified", level: skill.level }))
          ],
          verificationStatus: "verified",
          ratingAvg: Number((4.2 + Math.random() * 0.8).toFixed(2)),
          ratingCount: Math.floor(8 + Math.random() * 120),
          jobsDone: Math.floor(15 + Math.random() * 200),
          currentLocation: {
            type: "Point",
            coordinates: [83.2185 + (Math.random() - 0.5) * 0.18, 17.6868 + (Math.random() - 0.5) * 0.14]
          },
          serviceRadiusKm: 15,
          walletBalance: Number((500 + Math.random() * 20_000).toFixed(2))
        }
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }

  const pricingRules = [
    {
      name: "Area demand",
      type: "demand",
      config: {
        baseMultiplier: 1,
        referenceRatio: 1,
        sensitivity: 0.15,
        neutralMultiplier: 1,
        minimumMultiplier: 1,
        maximumMultiplier: 2.5,
        radiusKm: 10,
        lookbackMinutes: 30,
        areaGridDegrees: 0.1
      }
    },
    {
      name: "Provider distance",
      type: "distance",
      config: { baseFactor: 1, neutralFactor: 1, includedKm: 3, perKm: 0.05, minimumExcessKm: 0 }
    },
    {
      name: "Time of day",
      type: "time",
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
      name: "Platform fee",
      type: "fee",
      config: { percent: 10, neutralPercent: 0 }
    }
  ];
  for (const rule of pricingRules) {
    await PricingRule.findOneAndUpdate(
      { name: rule.name },
      { $set: { ...rule, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.info(`Seeded ${categoryDocuments.length} categories, ${services.length} services, and 10 verified providers near Visakhapatnam.`);
}

try {
  await seed();
} catch (error) {
  console.error("Seed failed:", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
