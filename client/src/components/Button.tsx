import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={twMerge(
          clsx(
            "relative inline-flex items-center justify-center rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none overflow-hidden group",
            {
              // Variant styles
              "bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0":
                variant === "primary",
              "border border-input bg-transparent hover:bg-secondary text-foreground hover:text-white hover:border-primary/50 focus:ring-ring":
                variant === "outline",
              "hover:bg-accent/10 hover:text-accent": variant === "ghost",

              // Size styles
              "h-9 px-4 text-sm": size === "sm",
              "h-11 px-8 text-base": size === "md",
              "h-14 px-10 text-lg": size === "lg",
            },
            className
          )
        )}
        {...props}
      >
        {/* Shimmer effect for primary buttons */}
        {variant === 'primary' && (
          <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-10" />
        )}
        <span className="relative z-20 flex items-center gap-2">{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';
