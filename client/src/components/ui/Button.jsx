import { motion } from "framer-motion";

const variants = {
  primary: "bg-primary text-white shadow-glow hover:bg-primary-dark",
  secondary: "border border-white/15 bg-white/5 text-white hover:bg-white/10",
  ghost: "text-slate-300 hover:bg-white/5 hover:text-white"
};

export default function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  disabled = false,
  ...props
}) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
