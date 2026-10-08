import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  icon: { type: String, default: "Wrench", trim: true },
  description: { type: String, default: "", trim: true }
}, { timestamps: true });

const Category = mongoose.models.Category || mongoose.model("Category", categorySchema);

export default Category;
