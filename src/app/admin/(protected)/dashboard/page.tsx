
import { DashboardMetrics } from "@/components/admin/dashboard-metrics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Users, Briefcase, Clock, BarChart3, CheckCircle, ArrowRight, PieChart, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { ClientHoursChart } from "@/components/admin/charts/client-hours-chart";
import { RecentSubmissionsPreview } from "@/components/admin/recent-submissions-preview";
import { SubmissionStatusPieChart } from "@/components/admin/charts/submission-status-pie-chart";

// Define the icon map for this component
const iconMap: Record<string, LucideIcon | undefined> = { // Allow undefined for safety
  Users,
  Briefcase,
  Clock,
  BarChart3,
  CheckCircle,
  ArrowRight,
  PieChart,
};

export default function AdminDashboardPage() {
  const quickLinks = [
    { href: "/admin/employees", label: "Manage Employees", iconName: "Users" },
    { href: "/admin/clients", label: "Manage Clients & Locations", iconName: "Briefcase" },
    { href: "/admin/time-entries", label: "View Time Entries", iconName: "Clock" },
    { href: "/admin/reports", label: "Generate Reports", iconName: "BarChart3" },
    { href: "/admin/approvals", label: "Process Approvals", iconName: "CheckCircle" },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-foreground">Admin Dashboard</h1>
      
      <DashboardMetrics />

      <Separator className="my-8" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <ClientHoursChart />
        </div>
        <div className="lg:col-span-1">
          <SubmissionStatusPieChart />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-3">
            <RecentSubmissionsPreview />
        </div>
      </div>
      
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Quick Actions & Management</CardTitle>
          <CardDescription>Access key management areas of the FieldFlow system.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map(link => {
            const IconComponent = iconMap[link.iconName];
            const ArrowIcon = iconMap["ArrowRight"];
            return (
              <Link 
                href={link.href} 
                key={link.href} 
                className="block group transition-all duration-300 ease-in-out hover:scale-[1.02]"
              >
                <Card className="h-full shadow-md hover:shadow-lg border border-transparent hover:border-primary/50">
                  <CardContent className="p-6 flex flex-col items-start justify-between h-full">
                    <div className="mb-auto">
                      {IconComponent && <IconComponent className="h-8 w-8 text-primary mb-3" />}
                      <h3 className="text-lg font-semibold text-foreground mb-1">{link.label}</h3>
                    </div>
                    <Button variant="link" className="p-0 h-auto mt-3 text-sm text-primary group-hover:underline self-start">
                      Go to {link.label.split(" ")[1]} {ArrowIcon && <ArrowIcon className="ml-1 h-4 w-4" />}
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
