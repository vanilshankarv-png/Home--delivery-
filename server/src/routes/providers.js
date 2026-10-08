import { Router } from "express";
import Verification from "../models/Verification.js";
import User from "../models/User.js";
import Provider from "../models/Provider.js";
import Service from "../models/Service.js";
import { createProviderController } from "../controllers/providerController.js";
import { authenticate } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/role.js";
import { upload } from "../middleware/upload.js";
import { storeUploadedFile } from "../services/fileStorageService.js";

export function createProviderRoutes(
  models = { User, Provider, Verification, Service },
  storeFile = storeUploadedFile
) {
  const router = Router();
  const controller = createProviderController(models, storeFile);

  router.post(
    "/verification",
    authenticate,
    authorizeRoles("provider"),
    upload.fields([
      { name: "idProof", maxCount: 1 },
      { name: "addressProof", maxCount: 1 },
      { name: "certificates", maxCount: 10 }
    ]),
    controller.submitVerification
  );
  router.get("/verification/status", authenticate, authorizeRoles("provider", "admin"), controller.verificationStatus);
  router.post(
    "/skills",
    authenticate,
    authorizeRoles("provider"),
    upload.single("certificate"),
    controller.addSkill
  );
  router.get("/:id/badges", controller.publicBadges);
  router.put(
    "/verification/:id/review",
    authenticate,
    authorizeRoles("admin"),
    controller.reviewVerification
  );

  return router;
}

export default createProviderRoutes();
