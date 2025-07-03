// src/app/technician/layout.tsx

import { AppShell } from "@/components/layout/app-shell";
import { technicianNavItems } from "@/components/layout/sidebar-nav-items";
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function TechnicianLayout({ children }: { children: React.ReactNode; }) {
  return (
    <ProtectedRoute requiredRole="technician">
      <AppShell navItems={technicianNavItems} userRole="technician">
        {children}
      </AppShell>
    </ProtectedRoute>
  );
}