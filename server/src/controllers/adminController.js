import Joi from "joi";
import { httpError } from "../services/paymentService.js";
import {
  getAdminDashboard,
  listAdminUsers,
  resolveAdminDispute,
  setUserStatus,
  upsertAdminCatalogItem
} from "../services/adminService.js";
import { storeUploadedFile } from "../services/fileStorageService.js";

const idSchema = Joi.string().hex().length(24);
const catalogSchema = Joi.object({
  kind: Joi.string().valid("category", "service").required(),
  id: idSchema.optional(),
  name: Joi.string().trim().min(2).max(100),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  icon: Joi.string().trim().max(80),
  title: Joi.string().trim().min(2).max(120),
  category: idSchema,
  description: Joi.string().trim().max(2000),
  basePrice: Joi.number().min(0),
  durationMins: Joi.number().integer().min(15),
  unit: Joi.string().valid("per visit", "per hour"),
  tags: Joi.array().items(Joi.string().trim().max(40)).max(30),
  isActive: Joi.boolean(),
  images: Joi.array().items(Joi.string().uri()).max(10)
}).unknown(false);
const validCatalogPayload = (body) => {
  const { error, value } = catalogSchema.validate(body, { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    const validationError = new Error(error.details.map((detail) => detail.message).join(", "));
    validationError.statusCode = 400;
    throw validationError;
  }
  if (value.kind === "category" && (!value.name || !value.slug)) {
    throw httpError("Categories require a name and slug.", 400);
  }
  if (value.kind === "service" && (!value.title || !value.category || !value.description
    || value.basePrice === undefined || value.durationMins === undefined)) {
    throw httpError("Services require title, category, description, base price, and duration.", 400);
  }
  const allowedFields = value.kind === "category"
    ? ["name", "slug", "icon", "description"]
    : ["title", "category", "description", "basePrice", "durationMins", "unit", "tags", "images", "isActive"];
  return {
    kind: value.kind,
    id: value.id,
    fields: Object.fromEntries(allowedFields.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]))
  };
};

export function createAdminController(
  models,
  storeFile = storeUploadedFile
) {
  const razorpay = models.razorpay;
  return {
    dashboard: async (req, res, next) => {
      try {
        const dashboard = await getAdminDashboard(models);
        return res.json({ success: true, ...dashboard });
      } catch (error) {
        return next(error);
      }
    },

    users: async (req, res, next) => {
      try {
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);
        const result = await listAdminUsers({
          User: models.User,
          search: req.query.search?.trim(),
          role: req.query.role || undefined,
          status: req.query.status || undefined,
          page,
          limit
        });
        return res.json({ success: true, ...result });
      } catch (error) {
        return next(error);
      }
    },

    updateUserStatus: async (req, res, next) => {
      try {
        const result = await setUserStatus({
          User: models.User,
          Booking: models.Booking,
          Provider: models.Provider,
          userId: req.params.id,
          isBlocked: req.body.isBlocked,
          io: req.app.locals.io,
          adminId: req.user.id
        });
        return res.json({ success: true, ...result });
      } catch (error) {
        return next(error);
      }
    },

    saveCatalogItem: async (req, res, next) => {
      try {
        const { kind, id, fields } = validCatalogPayload({
          ...req.body,
          ...(req.body.tags && {
            tags: Array.isArray(req.body.tags) ? req.body.tags : JSON.parse(req.body.tags)
          }),
          ...(req.body.images && {
            images: Array.isArray(req.body.images) ? req.body.images : JSON.parse(req.body.images)
          })
        });
        if ((req.files || []).some((file) => !file.mimetype.startsWith("image/"))) {
          throw httpError("Catalog uploads must be image files.", 415);
        }
        const result = await upsertAdminCatalogItem({
          Category: models.Category,
          Service: models.Service,
          kind,
          id,
          fields,
          imageFiles: req.files || [],
          storeFile
        });
        return res.status(result.updated ? 200 : 201).json({ success: true, ...result });
      } catch (error) {
        if (error instanceof SyntaxError) return next(httpError("tags and images must be valid JSON arrays.", 400));
        return next(error);
      }
    },

    resolveDispute: async (req, res, next) => {
      try {
        const result = await resolveAdminDispute({
          Dispute: models.Dispute,
          Booking: models.Booking,
          Payment: models.Payment,
          Provider: models.Provider,
          disputeId: req.params.id,
          adminId: req.user.id,
          action: req.body.action,
          amount: req.body.amount,
          note: req.body.note || "",
          io: req.app.locals.io,
          razorpay
        });
        return res.json({ success: true, ...result });
      } catch (error) {
        return next(error);
      }
    }
  };
}
