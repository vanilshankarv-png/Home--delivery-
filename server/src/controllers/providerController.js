import Joi from "joi";

const skillInputSchema = Joi.array().items(Joi.object({
  service: Joi.string().hex().length(24).required(),
  yearsExperience: Joi.number().min(0).max(60).required()
})).max(10);

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseSkillsInput(value = "[]") {
  let parsed;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    throw httpError("skills must be a valid JSON array.", 400);
  }
  const { error, value: skills } = skillInputSchema.validate(parsed, { abortEarly: false, convert: true });
  if (error) {
    throw httpError(error.details.map((detail) => detail.message).join(", "), 400);
  }
  return skills;
}

function requireFile(file, label) {
  if (!file) throw httpError(`${label} file is required.`, 400);
  return file;
}

async function assertProviderUser(User, userId) {
  const user = await User.findById(userId);
  if (!user || user.role !== "provider" || user.isBlocked) {
    throw httpError("An active provider account is required.", 403);
  }
  return user;
}

export function createProviderController({ User, Provider, Verification, Service }, storeFile) {
  return {
    submitVerification: async (req, res, next) => {
      try {
        const user = await assertProviderUser(User, req.user.id);
        const skills = parseSkillsInput(req.body.skills);
        const certificates = req.files?.certificates || [];
        if (skills.length !== certificates.length) {
          throw httpError("Upload one certificate for each submitted skill.", 400);
        }
        if (skills.length) {
          const serviceIds = [...new Set(skills.map((skill) => skill.service))];
          const services = await Service.find({ _id: { $in: serviceIds }, isActive: true }).select("_id").lean();
          if (services.length !== serviceIds.length) {
            throw httpError("One or more selected services are unavailable.", 400);
          }
        }

        const idProofUrl = await storeFile(requireFile(req.files?.idProof?.[0], "ID proof"));
        const addressProofUrl = await storeFile(requireFile(req.files?.addressProof?.[0], "Address proof"));
        const savedSkills = await Promise.all(skills.map(async (skill, index) => ({
          service: skill.service,
          yearsExperience: skill.yearsExperience,
          certificateUrl: await storeFile(certificates[index])
        })));

        const verification = await Verification.findOneAndUpdate(
          { provider: user._id },
          {
            $set: {
              idProofUrl,
              addressProofUrl,
              skills: savedSkills,
              status: "pending",
              adminNote: "",
              reviewedBy: null,
              reviewedAt: null
            }
          },
          { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        ).populate("skills.service", "title");

        await Provider.findOneAndUpdate(
          { user: user._id },
          {
            $set: {
              verificationStatus: "pending",
              skills: savedSkills.map(({ service, yearsExperience }) => ({
                service,
                yearsExperience,
                level: yearsExperience >= 2 ? "Silver" : "Bronze"
              }))
            },
            $setOnInsert: { user: user._id }
          },
          { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );

        return res.status(201).json({ success: true, verification });
      } catch (error) {
        return next(error);
      }
    },

    verificationStatus: async (req, res, next) => {
      try {
        if (req.user.role === "admin") {
          const verifications = await Verification.find({ status: "pending" })
            .populate("provider", "name email phone avatar")
            .populate("skills.service", "title category")
            .sort({ createdAt: 1 })
            .lean();
          return res.json({ success: true, verifications });
        }

        await assertProviderUser(User, req.user.id);
        const [verification, provider] = await Promise.all([
          Verification.findOne({ provider: req.user.id })
            .populate("skills.service", "title category")
            .lean(),
          Provider.findOne({ user: req.user.id }).populate("skills.service", "title category").lean()
        ]);
        return res.json({
          success: true,
          verification,
          provider: provider ? {
            verificationStatus: provider.verificationStatus,
            skills: provider.skills,
            badges: provider.badges
          } : null
        });
      } catch (error) {
        return next(error);
      }
    },

    addSkill: async (req, res, next) => {
      try {
        const user = await assertProviderUser(User, req.user.id);
        const { error, value } = Joi.object({
          service: Joi.string().hex().length(24).required(),
          yearsExperience: Joi.number().min(0).max(60).required()
        }).validate(req.body, { abortEarly: false, convert: true });
        if (error) throw httpError(error.details.map((detail) => detail.message).join(", "), 400);

        const [service, verification, provider] = await Promise.all([
          Service.findOne({ _id: value.service, isActive: true }).select("_id"),
          Verification.findOne({ provider: user._id }),
          Provider.findOne({ user: user._id })
        ]);
        if (!service) throw httpError("Service not found.", 404);
        if (!verification || !provider) {
          throw httpError("Submit your identity and address verification before adding a skill.", 409);
        }

        const certificateUrl = await storeFile(requireFile(req.file, "Skill certificate"));
        verification.skills.push({ service: service._id, certificateUrl, yearsExperience: value.yearsExperience });
        verification.status = "pending";
        verification.adminNote = "";
        verification.reviewedBy = undefined;
        verification.reviewedAt = undefined;
        await verification.save();

        provider.skills.push({
          service: service._id,
          yearsExperience: value.yearsExperience,
          level: value.yearsExperience >= 2 ? "Silver" : "Bronze"
        });
        provider.verificationStatus = "pending";
        await provider.save();

        return res.status(201).json({ success: true, verification });
      } catch (error) {
        return next(error);
      }
    },

    publicBadges: async (req, res, next) => {
      try {
        let provider = await Provider.findById(req.params.id)
          .populate("user", "name avatar")
          .populate("skills.service", "title");
        if (!provider) {
          provider = await Provider.findOne({ user: req.params.id })
            .populate("user", "name avatar")
            .populate("skills.service", "title");
        }
        if (!provider) return res.status(404).json({ success: false, message: "Provider not found." });
        return res.json({
          success: true,
          provider: {
            _id: provider._id,
            user: provider.user,
            verificationStatus: provider.verificationStatus,
            ratingAvg: provider.ratingAvg,
            ratingCount: provider.ratingCount,
            jobsDone: provider.jobsDone,
            badges: provider.badges,
            skills: provider.skills
          }
        });
      } catch (error) {
        return next(error);
      }
    },

    reviewVerification: async (req, res, next) => {
      try {
        const { error, value } = Joi.object({
          action: Joi.string().valid("approve", "reject").required(),
          note: Joi.string().trim().max(1000).allow("").default("")
        }).validate(req.body, { abortEarly: false, convert: true });
        if (error) throw httpError(error.details.map((detail) => detail.message).join(", "), 400);

        const existingVerification = await Verification.findById(req.params.id);
        if (!existingVerification) return res.status(404).json({ success: false, message: "Verification request not found." });
        if (existingVerification.status !== "pending") {
          return res.status(409).json({ success: false, message: "This verification request has already been reviewed." });
        }

        const provider = await Provider.findOne({ user: existingVerification.provider });
        if (!provider) throw httpError("Provider profile not found for this verification request.", 404);

        const verification = await Verification.findOneAndUpdate(
          { _id: req.params.id, status: "pending" },
          {
            $set: {
              status: value.action === "approve" ? "approved" : "rejected",
              adminNote: value.note,
              reviewedBy: req.user.id,
              reviewedAt: new Date()
            }
          },
          { new: true, runValidators: true }
        );
        if (!verification) {
          return res.status(409).json({ success: false, message: "This verification request has already been reviewed." });
        }

        const updatedProvider = await Provider.findOneAndUpdate(
          { user: verification.provider },
          { $set: { verificationStatus: value.action === "approve" ? "verified" : "rejected" } },
          { new: true, runValidators: true }
        );
        if (!updatedProvider) throw httpError("Provider profile not found for this verification request.", 404);

        return res.json({ success: true, verification, badges: updatedProvider.badges });
      } catch (error) {
        return next(error);
      }
    }
  };
}
