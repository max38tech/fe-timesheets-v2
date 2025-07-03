"use client";

import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole: 'admin' | 'technician';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { userRole, loading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // This effect will run whenever the loading or userRole state changes.
    
    // If the initial auth check is finished...
    if (!loading) {
      // ...and the user has the correct role...
      if (userRole === requiredRole) {
        // ...then they are authorized.
        setIsAuthorized(true);
      } else {
        // ...otherwise, if they don't have the right role, redirect them home.
        // This will also catch users who are not logged in (userRole will be null).
        router.push('/');
      }
    }
  }, [userRole, loading, requiredRole, router]);

  // While the initial check is running, OR if the user is not yet authorized,
  // show the loading spinner. This prevents the page from flashing before the redirect.
  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If the effect has confirmed the user is authorized, show the page content.
  return <>{children}</>;
}