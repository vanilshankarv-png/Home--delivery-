import { ArrowUpRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import Card from "../ui/Card.jsx";
import CategoryIcon from "./CategoryIcon.jsx";

const gradients = [
  "from-indigo-500/20 via-primary/10 to-transparent",
  "from-cyan-400/20 via-blue-500/10 to-transparent",
  "from-violet-400/20 via-fuchsia-500/10 to-transparent",
  "from-emerald-400/20 via-teal-500/10 to-transparent"
];

export default function ServiceCard({ service, index = 0 }) {
  const categorySlug = service.category?.slug || "";
  const image = service.images?.[0];

  return (
    <Link to={`/services/${service._id}`} className="group block h-full">
      <Card className="h-full overflow-hidden transition duration-300 group-hover:-translate-y-1 group-hover:border-accent/30">
        <div className={`relative grid h-40 place-items-center overflow-hidden bg-gradient-to-br ${gradients[index % gradients.length]}`}>
          {image ? (
            <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-500 group-hover:scale-105" />
          ) : (
            <>
              <div className="absolute h-28 w-28 rounded-full bg-primary/20 blur-2xl" />
              <CategoryIcon slug={categorySlug} size={40} className="relative text-accent/85" />
            </>
          )}
          <span className="absolute right-3 top-3 rounded-full border border-white/10 bg-midnight/70 px-2.5 py-1 text-xs text-slate-200 backdrop-blur">
            {service.category?.name || "Home service"}
          </span>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold leading-6 text-white group-hover:text-accent">{service.title}</h3>
            <ArrowUpRight size={17} className="mt-1 shrink-0 text-slate-500 transition group-hover:text-accent" />
          </div>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-400">{service.description}</p>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
            <span className="font-semibold text-white">₹{Number(service.basePrice).toLocaleString("en-IN")} <span className="text-xs font-normal text-slate-500">/ {service.unit}</span></span>
            <span className="inline-flex items-center gap-1 text-sm text-slate-300"><Star size={14} className="fill-amber-300 text-amber-300" /> {Number(service.rating || 0).toFixed(1)}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
