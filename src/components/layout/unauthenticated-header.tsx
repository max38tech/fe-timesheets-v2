
"use client";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AppLogo } from "./app-logo";
import Link from "next/link"; // Added for completeness, though not directly used in AppLogo's link here

export function UnauthenticatedHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <AppLogo />
        <ThemeToggle />
      </div>
    </header>
  );
}
