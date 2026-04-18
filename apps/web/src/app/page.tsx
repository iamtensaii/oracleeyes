"use client";

import { Suspense } from "react";
import { TradingDashboard } from "@/components/dashboard/trading-dashboard";

function DashboardShell() {
  return <TradingDashboard initialWorkspaceTab="predict" />;
}

export default function Home() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
            Loading dashboard…
          </div>
        }
      >
        <DashboardShell />
      </Suspense>
    </div>
  );
}
