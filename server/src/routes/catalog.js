import { Router } from "express";
import Category from "../models/Category.js";
import Provider from "../models/Provider.js";
import Service from "../models/Service.js";
import { createCatalogController } from "../controllers/catalogController.js";

export function createCatalogRoutes(models = { Category, Service, Provider }) {
  const router = Router();
  const controller = createCatalogController(models);

  router.get("/categories", controller.categories);
  router.get("/services/search", controller.searchServices);
  router.get("/services/popular", controller.popularServices);
  router.get("/services", controller.listServices);
  router.get("/services/:id/providers", controller.nearbyProviders);
  router.get("/services/:id", controller.serviceDetail);

  return router;
}

export default createCatalogRoutes();
