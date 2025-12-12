import * as React from "react";
import { cn } from "./utils";

interface PageHeaderProps extends React.ComponentProps<"div"> {
  title: string;
  description?: string;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}

/**
 * PageHeader - Global page header component
 * Provides consistent page titles across the application
 */
function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  icon,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      {breadcrumb && <div className="text-sm">{breadcrumb}</div>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {icon && (
            <div className="w-12 h-12 rounded-xl bg-[#1e3a5f] shadow-lg shadow-slate-500/25 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight truncate">
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export { PageHeader };
