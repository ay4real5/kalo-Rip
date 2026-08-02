import Link from "next/link";
import { cn } from "@/app/lib/cn";

interface ButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  type?: "button" | "submit";
  icon?: React.ReactNode;
  disabled?: boolean;
}

const variants = {
  primary:
    "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 hover:shadow-emerald-600/30",
  secondary:
    "bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800",
  outline:
    "border-2 border-slate-200 bg-white text-slate-700 hover:border-emerald-600 hover:text-emerald-600",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-red-600 text-white hover:bg-red-500",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-5 py-2.5 text-sm gap-2",
  lg: "px-8 py-3.5 text-base gap-2.5",
};

export function Button({
  children,
  href,
  onClick,
  variant = "primary",
  size = "md",
  className,
  type = "button",
  icon,
  disabled,
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes} disabled={disabled}>
      {icon}
      {children}
    </button>
  );
}
