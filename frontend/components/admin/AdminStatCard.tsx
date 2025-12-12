/**
 * @deprecated Use StatCard from '@/components/ui/stat-card' instead
 * This component is kept for backwards compatibility
 */
import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface AdminStatCardProps {
  icon: ReactNode;
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  color?: "purple" | "blue" | "green" | "orange" | "red";
}

/**
 * @deprecated Use StatCard from '@/components/ui/stat-card' instead
 */
export default function AdminStatCard({
  icon,
  title,
  value,
  change,
  changeLabel,
  color = "purple",
}: AdminStatCardProps) {
  // Since we need to extract the icon type, we wrap the legacy usage
  // For new code, use StatCard directly with LucideIcon prop
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-lg shadow-gray-900/5 border border-gray-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5">
      {/* Background Decoration */}
      <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-br ${
        color === "purple" ? "from-slate-500/10 to-gray-500/10" :
        color === "blue" ? "from-[#1e3a5f]/10 to-slate-500/10" :
        color === "green" ? "from-emerald-500/10 to-teal-500/10" :
        color === "orange" ? "from-orange-500/10 to-amber-500/10" :
        "from-red-500/10 to-rose-500/10"
      } opacity-50 blur-2xl group-hover:opacity-75 transition-opacity`} />
      
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className={`p-3.5 rounded-xl shadow-md ${
            color === "purple" ? "bg-gradient-to-br from-slate-500/10 to-gray-500/10 text-slate-600 shadow-slate-500/10" :
            color === "blue" ? "bg-gradient-to-br from-[#1e3a5f]/10 to-slate-500/10 text-[#1e3a5f] shadow-slate-500/10" :
            color === "green" ? "bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-600 shadow-emerald-500/10" :
            color === "orange" ? "bg-gradient-to-br from-orange-500/10 to-amber-500/10 text-orange-600 shadow-orange-500/10" :
            "bg-gradient-to-br from-red-500/10 to-rose-500/10 text-red-600 shadow-red-500/10"
          }`}>
            {icon}
          </div>

          {/* Content */}
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        </div>

        {/* Change Indicator */}
        {(change !== undefined || changeLabel) && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            !change ? "text-gray-500 bg-gray-100" :
            change > 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"
          }`}>
            {!change ? <Minus className="w-3 h-3" /> :
             change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>
              {change !== undefined ? `${change > 0 ? '+' : ''}${change}%` : changeLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
