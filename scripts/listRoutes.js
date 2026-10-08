import fs from "node:fs";
import path from "node:path";
import app from "../server/src/app.js";

const normalizeRoutePath = (routePath) => {
  if (!routePath) return "/";
  let normalized = String(routePath).replace(/\\/g, "");
  normalized = normalized.replace(/\/\?\(\?=\/\|\$\)/g, "");
  normalized = normalized.replace(/\/$/, "");
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  return normalized;
};

const deriveModule = (fullRoutePath) => {
  const trimmed = fullRoutePath.replace(/^\/api/, "").replace(/^\/+/, "");
  return trimmed.split("/")[0] || "root";
};

const buildFullPath = (prefix, routePath) => {
  const prefixValue = (prefix || "").replace(/\/+$/, "");
  const routeValue = normalizeRoutePath(routePath);
  if (!prefixValue) return routeValue;
  if (routeValue === "/") return prefixValue;
  return `${prefixValue}${routeValue.startsWith("/") ? routeValue : `/${routeValue}`}`;
};

const getRouterMountPath = (regexpSource, prefix = "") => {
  if (!regexpSource) return prefix;
  let cleaned = regexpSource.replace(/^\^/, "").replace(/\$$/, "");
  cleaned = cleaned.replace(/\\\//g, "/");
  cleaned = cleaned.replace(/\?\(\?=\/\|\$\)/g, "");
  cleaned = cleaned.replace(/\/\?$/, "");
  if (!cleaned || cleaned === "/") return prefix;
  const next = `${prefix}${cleaned.startsWith("/") ? cleaned : `/${cleaned}`}`;
  return next.replace(/\/+/g, "/");
};

const routeEntries = [];
const walkStack = (stack, prefix = "") => {
  for (const layer of stack) {
    if (layer.route) {
      const fullRoutePath = buildFullPath(prefix, layer.route.path);
      if (fullRoutePath === "/api/health") continue;

      for (const method of Object.keys(layer.route.methods)) {
        routeEntries.push({
          method: method.toUpperCase(),
          path: fullRoutePath,
          module: deriveModule(fullRoutePath)
        });
      }
    }

    if (layer.name === "router" && layer.handle?.stack) {
      const nextPrefix = getRouterMountPath(layer.regexp?.source, prefix);
      walkStack(layer.handle.stack, nextPrefix);
    }
  }
};

walkStack(app._router?.stack || []);
routeEntries.sort((left, right) => {
  const moduleCompare = left.module.localeCompare(right.module);
  if (moduleCompare !== 0) return moduleCompare;
  const pathCompare = left.path.localeCompare(right.path);
  return pathCompare !== 0 ? pathCompare : left.method.localeCompare(right.method);
});

const groupedRoutes = new Map();
for (const route of routeEntries) {
  if (!groupedRoutes.has(route.module)) groupedRoutes.set(route.module, []);
  groupedRoutes.get(route.module).push(route);
}

const moduleOrder = [...groupedRoutes.keys()].sort((left, right) => left.localeCompare(right));
const total = routeEntries.length;

console.log("Home Delivery route inventory\n");
for (const moduleName of moduleOrder) {
  const routes = groupedRoutes.get(moduleName);
  console.log(`${moduleName.toUpperCase()} (${routes.length})`);
  for (const route of routes) {
    console.log(`  ${route.method} ${route.path}`);
  }
  console.log("");
}
console.log(`TOTAL REST ROUTES: ${total}`);

if (total !== 56) {
  console.warn("\nWARNING: Expected exactly 56 REST routes.");
  process.exitCode = 1;
}

const docsDir = path.resolve(process.cwd(), "docs");
fs.mkdirSync(docsDir, { recursive: true });

const exampleBodyForRoute = (routePath, method) => {
  if (method !== "POST" && method !== "PUT" && method !== "PATCH") return null;

  if (routePath.includes("/auth/register")) {
    return { name: "Demo User", email: "demo.user@example.com", password: "Password123!", role: "customer" };
  }
  if (routePath.includes("/auth/login")) {
    return { email: "demo.user@example.com", password: "Password123!" };
  }
  if (routePath.includes("/providers/verification")) {
    return { businessName: "Home Service Co.", category: "Cleaning", phone: "+91 9876543210", experience: 3, address: "MG Road, Bengaluru" };
  }
  if (routePath.includes("/bookings")) {
    return { serviceId: "64f3d1d8c8b7a7a3d4e5f601", scheduledFor: "2026-10-20T10:00:00.000Z", notes: "Need service before 12 PM" };
  }
  if (routePath.includes("/pricing/quote")) {
    return { serviceId: "64f3d1d8c8b7a7a3d4e5f601", location: { lat: 12.9716, lng: 77.5946 }, scheduledFor: "2026-10-20T10:00:00.000Z" };
  }
  if (routePath.includes("/tracking")) {
    return { bookingId: "64f3d1d8c8b7a7a3d4e5f602", lat: 12.9716, lng: 77.5946 };
  }
  if (routePath.includes("/chats")) {
    return { message: "Hello, I am on my way." };
  }
  if (routePath.includes("/payments/create-order")) {
    return { bookingId: "64f3d1d8c8b7a7a3d4e5f602", amount: 1499, currency: "INR" };
  }
  if (routePath.includes("/payments/verify")) {
    return { razorpay_payment_id: "pay_test_123", razorpay_order_id: "order_test_123", razorpay_signature: "signature" };
  }
  if (routePath.includes("/payouts/request")) {
    return { amount: 1500, method: "bank_transfer", accountNumber: "1234567890" };
  }
  if (routePath.includes("/reviews")) {
    return { providerId: "64f3d1d8c8b7a7a3d4e5f603", serviceId: "64f3d1d8c8b7a7a3d4e5f601", rating: 5, comment: "Very professional and on time." };
  }
  if (routePath.includes("/disputes")) {
    return { bookingId: "64f3d1d8c8b7a7a3d4e5f602", reason: "Service quality issue", description: "The provider arrived late and did not finish the task." };
  }
  if (routePath.includes("/admin/services")) {
    return { name: "Premium Deep Cleaning", category: "Cleaning", description: "Complete home deep cleaning package", basePrice: 1999, isActive: true };
  }
  if (routePath.includes("/admin/users") || routePath.includes("/users/profile") || routePath.includes("/providers/skills")) {
    return { status: "active" };
  }
  return { example: true, message: "Sample payload" };
};

const collection = {
  info: {
    name: "Home Delivery API",
    description: "Collection covering all 56 REST endpoints for the Home Delivery project.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    _postman_id: "home-delivery-api-56-routes"
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:5000", type: "string" },
    { key: "token", value: "", type: "string" }
  ],
  item: []
};

for (const moduleName of moduleOrder) {
  const routes = groupedRoutes.get(moduleName);
  const folder = {
    name: moduleName.toUpperCase(),
    item: routes.map((route) => {
      const body = exampleBodyForRoute(route.path, route.method);
      const request = {
        method: route.method,
        header: [
          { key: "Content-Type", value: "application/json" },
          { key: "Authorization", value: "Bearer {{token}}" }
        ],
        url: {
          raw: `{{baseUrl}}${route.path}`,
          protocol: "http",
          host: ["{{baseUrl}}"],
          path: route.path.split("/").filter(Boolean)
        },
        description: `Example request for ${route.method} ${route.path}`
      };

      if (body) {
        request.body = {
          mode: "raw",
          raw: JSON.stringify(body, null, 2),
          options: { raw: { language: "json" } }
        };
      }

      return { name: `${route.method} ${route.path}`, request };
    })
  };

  collection.item.push(folder);
}

fs.writeFileSync(path.join(docsDir, "HomeDelivery.postman_collection.json"), `${JSON.stringify(collection, null, 2)}\n`);
console.log(`\nPostman collection written to ${path.join(docsDir, "HomeDelivery.postman_collection.json")}`);
console.log(`Current count: ${total}`);
