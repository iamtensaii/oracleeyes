"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-background flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md text-center text-sm">
        {error.message || "An unexpected error occurred in this part of the app."}
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button type="button" variant="outline" onClick={() => (window.location.href = "/")}>
          Home
        </Button>
      </div>
    </div>
  );
}
