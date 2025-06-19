"use client";

import type { NavItem } from "@/components/layout/sidebar-nav-items";
import { AppLogo } from "@/components/layout/app-logo";
import { UserNav } from "@/components/layout/user-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayoutDashboard, Users, Briefcase, Clock, BarChart3, CheckCircle, User, type LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";

interface AppShellProps {
  navItems: NavItem[];
  children: React.ReactNode;
  userRole: "admin" | "technician";
}

const iconComponents: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Briefcase,
  Clock,
  BarChart3,
  CheckCircle,
  User,
};

export function AppShell({ navItems, children, userRole }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full">
       <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center justify-between">
            <AppLogo />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <ScrollArea className="h-[calc(100vh-8rem)]"> {/* Adjust height as needed */}
            <SidebarMenu>
              {navItems.map((item) => {
                const IconComponent = iconComponents[item.iconName];
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                        asChild
                        isActive={pathname.startsWith(item.href)}
                        tooltip={item.tooltip}
                      >
                        <Link href={item.href}>
                          {IconComponent && <IconComponent />}
                          <span>{item.label}</span>
                        </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </ScrollArea>
        </SidebarContent>
        {/* SidebarFooter can be added here if needed */}
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserNav />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:px-6 sm:py-0 md:gap-8">
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}
