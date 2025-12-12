import * as React from "react";
import { cn } from "./utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps extends React.ComponentProps<"div"> {
  icon: LucideIcon;
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  color?: "purple" | "blue" | "green" | "orange" | "red" | "indigo" | "cyan" | "pink";
  variant?: "default" | "compact" | "minimal";
}

/**
 * StatCard - Global statistics card component
 * Provides consistent stat display across admin and user dashboards
 */
function StatCard({
  icon: Icon,
  title,
  value,
  change,
  changeLabel,
  color = "purple",
  variant = "default",
  className,
  ...props
}: StatCardProps) {
  const colorConfig = {
    purple: {
      bg: "bg-gradient-to-br from-slate-500/10 to-gray-500/10",
      text: "text-slate-600",
      glow: "shadow-slate-500/10",
    },
    blue: {
      bg: "bg-gradient-to-br from-[#1e3a5f]/10 to-slate-500/10",
      text: "text-[#1e3a5f]",
      glow: "shadow-slate-500/10",
    },
    green: {
      bg: "bg-gradient-to-br from-emerald-500/10 to-teal-500/10",
      text: "text-emerald-600",
      glow: "shadow-emerald-500/10",
    },
    orange: {
      bg: "bg-gradient-to-br from-orange-500/10 to-amber-500/10",
      text: "text-orange-600",
      glow: "shadow-orange-500/10",
    },
    red: {
      bg: "bg-gradient-to-br from-red-500/10 to-rose-500/10",
      text: "text-red-600",
      glow: "shadow-red-500/10",
    },
    indigo: {
      bg: "bg-gradient-to-br from-[#1e3a5f]/10 to-slate-500/10",
      text: "text-[#1e3a5f]",
      glow: "shadow-slate-500/10",
    },
    cyan: {
      bg: "bg-gradient-to-br from-cyan-500/10 to-sky-500/10",
      text: "text-cyan-600",
      glow: "shadow-cyan-500/10",
    },
    pink: {
      bg: "bg-gradient-to-br from-pink-500/10 to-rose-500/10",
      text: "text-pink-600",
      glow: "shadow-pink-500/10",
    },
  };

  const colors = colorConfig[color];

  const getChangeIcon = () => {
    if (change === undefined || change === 0) return <Minus className="w-3 h-3" />;
    if (change > 0) return <TrendingUp className="w-3 h-3" />;
    return <TrendingDown className="w-3 h-3" />;
  };

  const getChangeColor = () => {
    if (change === undefined || change === 0) return "text-gray-500 bg-gray-100";
    if (change > 0) return "text-emerald-600 bg-emerald-50";
    return "text-red-600 bg-red-50";
  };

  if (variant === "minimal") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100",
          className
        )}
        {...props}
      >
        <div className={cn("p-2 rounded-lg", colors.bg, colors.text)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "p-4 bg-white rounded-xl border border-gray-100 shadow-sm",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-lg", colors.bg, colors.text)}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        </div>
      </div>
    );
  }

  // Default variant - full featured
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-white p-6 shadow-lg shadow-gray-900/5 border border-gray-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5",
        className
      )}
      {...props}
    >
      {/* Background Decoration */}
      <div
        className={cn(
          "absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-50 blur-2xl group-hover:opacity-75 transition-opacity",
          colors.bg
        )}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div
            className={cn(
              "p-3.5 rounded-xl shadow-md",
              colors.bg,
              colors.text,
              colors.glow
            )}
          >
            <Icon className="w-5 h-5" />
          </div>

          {/* Content */}
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        </div>

        {/* Change Indicator */}
        {(change !== undefined || changeLabel) && (
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
              getChangeColor()
            )}
          >
            {getChangeIcon()}
            <span>
              {change !== undefined
                ? `${change > 0 ? "+" : ""}${change}%`
                : changeLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export { StatCard };
