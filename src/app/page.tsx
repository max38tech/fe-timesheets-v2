import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, UserCog } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { UnauthenticatedHeader } from "@/components/layout/unauthenticated-header";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-svh">
      <UnauthenticatedHeader />
      <main className="flex flex-1 flex-col items-center justify-center bg-background p-4">
        <header className="mb-12 text-center pt-8">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Welcome to FE Timesheets vO.1
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Efficiently track time, manage tasks, and streamline your field operations.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:max-w-2xl">
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="h-6 w-6 text-primary" />
                Technician Portal
              </CardTitle>
              <CardDescription>
                Log your hours, manage tasks, and view job details on the go.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* CORRECTED PATTERN: Button wraps Link and uses asChild */}
              <Button asChild className="w-full" size="lg">
                <Link href="/login">Technician Login</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-6 w-6 text-primary" />
                Management Console
              </CardTitle>
              <CardDescription>
                Oversee operations, manage staff, and generate insightful reports.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* CORRECTED PATTERN: Button wraps Link and uses asChild */}
              <Button asChild className="w-full" variant="outline" size="lg">
                <Link href="/admin/login">Admin Login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        
        
        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} FE Timesheets. All rights reserved.</p>
          <p>Streamlining field service management.</p>
        </footer>
      </main>
    </div>
  );
}