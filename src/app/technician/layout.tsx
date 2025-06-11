import { AppShell } from "@/components/layout/app-shell";
import { technicianNavItems } from "@/components/layout/sidebar-nav-items";

export default function TechnicianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell navItems={technicianNavItems} userRole="technician">
      {children}
    </AppShell>
  );
}
