import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Users, Briefcase, Clock, BarChart3, CheckCircle, User } from "lucide-react";

export type NavItem = {
  href: string;
  iconName: keyof typeof iconComponentsMap; // Changed from icon: React.ElementType
  label: string;
  tooltip?: string;
  subItems?: NavItem[];
};

// This map is not directly used here but defines the available icon names for type safety.
// The actual components will be used in AppShell.
export const iconComponentsMap = {
  LayoutDashboard,
  Users,
  Briefcase,
  Clock,
  BarChart3,
  CheckCircle,
  User,
};

export const technicianNavItems: NavItem[] = [
  {
    href: "/technician/dashboard",
    iconName: "LayoutDashboard",
    label: "Dashboard",
    tooltip: "Dashboard",
  },
  {
    href: "/technician/profile",
    iconName: "User",
    label: "My Profile",
    tooltip: "Edit Profile & Avatar",
  },
];

export const adminNavItems: NavItem[] = [
  {
    href: "/admin/dashboard",
    iconName: "LayoutDashboard",
    label: "Dashboard",
    tooltip: "Dashboard",
  },
  {
    href: "/admin/employees",
    iconName: "Users",
    label: "Employees",
    tooltip: "Manage Employees",
  },
  {
    href: "/admin/clients",
    iconName: "Briefcase",
    label: "Clients & Locations",
    tooltip: "Manage Clients",
  },
  {
    href: "/admin/time-entries",
    iconName: "Clock",
    label: "Time Entries",
    tooltip: "Manage Time Entries",
  },
  {
    href: "/admin/reports",
    iconName: "BarChart3",
    label: "Reports",
    tooltip: "View Reports",
  },
  {
    href: "/admin/approvals",
    iconName: "CheckCircle",
    label: "Approvals",
    tooltip: "Manage Approvals",
  },
  {
    href: "/admin/profile",
    iconName: "User",
    label: "My Profile",
    tooltip: "Edit Profile & Avatar",
  },
];
