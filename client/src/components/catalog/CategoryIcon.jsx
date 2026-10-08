import { Bug, Hammer, Paintbrush, Refrigerator, Sparkles, Wind, Wrench, Zap } from "lucide-react";

const icons = {
  "ac-repair": Wind,
  "appliance-repair": Refrigerator,
  carpentry: Hammer,
  cleaning: Sparkles,
  electrical: Zap,
  "pest-control": Bug,
  painting: Paintbrush,
  plumbing: Wrench
};

export default function CategoryIcon({ slug, className = "", size = 20 }) {
  const Icon = icons[slug] || Wrench;
  return <Icon size={size} className={className} aria-hidden="true" />;
}
