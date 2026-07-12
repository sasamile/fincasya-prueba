"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  description: string;
  icon: LucideIcon;
  gradientFrom: string; // e.g., 'from-indigo-500/10'
  iconBg: string; // e.g., 'bg-indigo-500'
  iconShadow: string; // e.g., 'shadow-indigo-500/20'
  textColor: string; // e.g., 'text-indigo-500'
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  hoverShadow?: string; // e.g., 'hover:shadow-indigo-500/5'
  customHeaderActions?: React.ReactNode;
}

export function FormSection({
  title,
  description,
  icon: Icon,
  gradientFrom,
  iconBg,
  iconShadow,
  textColor,
  children,
  defaultOpen = false,
  className,
  hoverShadow = "hover:shadow-primary/5",
  customHeaderActions,
}: FormSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section
      className={cn(
        "rounded-3xl md:rounded-[40px] bg-background border border-border shadow-sm overflow-hidden transition-all duration-500",
        isOpen ? "shadow-xl" : "hover:shadow-md",
        !isOpen && hoverShadow,
        className
      )}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex flex-wrap items-center justify-between p-4 sm:px-6 md:px-8 py-4 md:py-7 border-b border-border/50 bg-linear-to-br transition-all duration-500 text-left cursor-pointer select-none gap-y-1 sm:gap-y-0",
          gradientFrom,
          !isOpen && "border-b-transparent"
        )}
      >
        <div className="flex items-center gap-3 md:gap-4 min-w-0 pr-2 flex-1 order-1">
          <div
            className={cn(
              "w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl text-white flex items-center justify-center shadow-lg shrink-0 transition-all duration-500",
              iconBg,
              iconShadow,
              isOpen ? "scale-110 rotate-3" : "scale-100 rotate-0"
            )}
          >
            <Icon className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold tracking-tight text-zinc-900 md:text-xl dark:text-zinc-50">
              {title}
            </h2>
            <p
              className={cn(
                "mt-0.5 line-clamp-2 break-words text-[9px] font-semibold uppercase leading-snug tracking-widest transition-colors duration-500 sm:text-[10px] sm:line-clamp-3",
                textColor
              )}
            >
              {description}
            </p>
          </div>
        </div>
        <div
          className={cn(
            "order-2 rounded-full p-2 transition-all duration-500 hover:bg-zinc-900/10 dark:hover:bg-zinc-100/10 sm:order-3",
            isOpen ? "rotate-180" : "rotate-0"
          )}
        >
          <ChevronDown className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
        </div>

        {customHeaderActions && (
          <div 
            className="w-full sm:w-auto order-3 sm:order-2 mt-3 sm:mt-0"
            onClick={(e) => e.stopPropagation()}
          >
            {customHeaderActions}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden p-4 sm:p-6 md:space-y-8 md:p-8">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
