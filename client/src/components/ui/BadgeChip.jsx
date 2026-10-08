import Badge from "./Badge.jsx";

export default function BadgeChip({ badge, className = "" }) {
  if (!badge) return null;

  const level = (badge.level || "verified").toLowerCase();
  const label = badge.name === "Skill Verified"
    ? `${badge.name} · ${badge.level}`
    : badge.name;

  return (
    <span title={`${badge.name}${badge.level ? ` — ${badge.level}` : ""}`} className="inline-flex">
      <Badge level={level} className={className}>{label}</Badge>
    </span>
  );
}
