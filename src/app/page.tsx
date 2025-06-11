
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
      <main className="flex flex-1 flex-col items-center justify-center bg-background p-4"> {/* Changed div to main, use flex-1 */}
        <header className="mb-12 text-center pt-8"> {/* pt-8 might still be useful for spacing from top of this main area */}
          {/* AppLogo is in UnauthenticatedHeader, can be removed here if redundant */}
          {/* <AppLogo /> */}
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Welcome to FE Timesheets
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
              <Link href="/login" legacyBehavior>
                <Button className="w-full" size="lg">
                  Technician Login
                </Button>
              </Link>
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
              <Link href="/admin/login" legacyBehavior>
                <Button className="w-full" variant="outline" size="lg">
                  Admin Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        
        <div className="mt-16 w-full max-w-4xl">
          <Image 
            src="https://storage.googleapis.com/fe-timesheets-29db8.firebasestorage.app/public_assets/hero_image.png" 
            alt="Hero image illustrating field service operations or time management" 
            width={1200} 
            height={400} 
            className="rounded-lg shadow-md object-cover"
            data-ai-hint="field service"
            priority 
          />
        </div>

        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} FE Timesheets. All rights reserved.</p>
          <p>Streamlining field service management.</p>
        </footer>
      </main>
    </div>
  );
}
