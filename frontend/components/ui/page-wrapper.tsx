import * as React from "react";
import { cn } from "./utils";

interface PageWrapperProps extends React.ComponentProps<"div"> {
  variant?: "default" | "auth" | "centered" | "dashboard";
}

/**
 * PageWrapper - Global page container component
 * Provides consistent layout patterns across all pages
 */
function PageWrapper({
  className,
  variant = "default",
  children,
  ...props
}: PageWrapperProps) {
  const variants = {
    default: "min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30",
    auth: "min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-gray-50/30 p-4",
    centered: "min-h-screen flex items-center justify-center p-4 bg-background",
    dashboard: "min-h-screen w-full bg-gradient-to-br from-gray-50 via-white to-gray-100/50",
  };

  return (
    <div
      data-slot="page-wrapper"
      className={cn(variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { PageWrapper };
