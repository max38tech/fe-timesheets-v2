// src/app/admin/layout.tsx

import { AppShell } from "@/components/layout/app-shell";
import { adminNavItems } from "@/components/layout/sidebar-nav-items";
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole="admin">
      <AppShell navItems={adminNavItems} userRole="admin">
        {children}
      </AppShell>
    </ProtectedRoute>
  );
}