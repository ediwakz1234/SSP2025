import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "./utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
    {
        variants: {
            variant: {
                default:
                    "bg-[#1e3a5f] text-white shadow-lg shadow-slate-900/20 hover:bg-[#2d4a6f] hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-md",
                destructive:
                    "bg-destructive text-white shadow-lg shadow-destructive/25 hover:shadow-xl hover:shadow-destructive/30 hover:-translate-y-0.5 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
                outline:
                    "border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 hover:-translate-y-0.5",
                secondary:
                    "bg-gray-100 text-gray-700 shadow-sm hover:bg-gray-200 hover:-translate-y-0.5",
                ghost:
                    "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                link: "text-[#1e3a5f] underline-offset-4 hover:underline",
                gradient:
                    "bg-[#1e3a5f] text-white shadow-lg shadow-slate-900/20 hover:bg-[#2d4a6f] hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0",
                success:
                    "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/30 hover:-translate-y-0.5",
                warning:
                    "bg-amber-500 text-white shadow-lg shadow-amber-500/25 hover:bg-amber-600 hover:shadow-xl hover:shadow-amber-500/30 hover:-translate-y-0.5",
            },
            size: {
                default: "h-10 px-5 py-2.5 has-[>svg]:px-4",
                sm: "h-8 rounded-lg gap-1.5 px-3.5 text-xs has-[>svg]:px-2.5",
                lg: "h-12 rounded-xl px-8 text-base has-[>svg]:px-6",
                xl: "h-14 rounded-2xl px-10 text-lg has-[>svg]:px-8",
                icon: "size-10 rounded-xl",
                "icon-sm": "size-8 rounded-lg",
                "icon-lg": "size-12 rounded-xl",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

interface ButtonProps
    extends React.ComponentProps<"button">,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    loading?: boolean;
}

function Button({
    className,
    variant,
    size,
    asChild = false,
    loading = false,
    children,
    disabled,
    ...props
}: ButtonProps) {
    const Comp = asChild ? Slot : "button";

    return (
        <Comp
            data-slot="button"
            className={cn(buttonVariants({ variant, size, className }))}
            disabled={disabled || loading}
            {...props}
        >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {children}
        </Comp>
    );
}

export { Button, buttonVariants };
