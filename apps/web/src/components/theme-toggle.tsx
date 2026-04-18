"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Cycles appearance: light → dark → system (follows OS).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const Icon =
    !mounted || theme === "system"
      ? Monitor
      : resolvedTheme === "dark" || theme === "dark"
        ? Moon
        : Sun;

  const label =
    !mounted ? "Theme" : theme === "system" ? "System theme" : theme === "dark" ? "Dark" : "Light";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("text-muted-foreground hover:text-foreground size-9 shrink-0", className)}
      title={`${label} — click to cycle (light / dark / system)`}
      aria-label={`${label}, cycle appearance`}
      onClick={cycle}
      disabled={!mounted}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );
}
