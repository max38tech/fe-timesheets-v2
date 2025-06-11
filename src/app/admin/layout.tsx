import { AppShell } from "@/components/layout/app-shell";
import { adminNavItems } from "@/components/layout/sidebar-nav-items";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell navItems={adminNavItems} userRole="admin">
      {children}
    </AppShell>
  );
}
