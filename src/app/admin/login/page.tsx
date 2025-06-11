
import { LoginForm } from "@/components/auth/login-form";
import { UnauthenticatedHeader } from "@/components/layout/unauthenticated-header";

export default function AdminLoginPage() {
  return (
    <div className="flex flex-col min-h-svh">
      <UnauthenticatedHeader />
      <main className="flex flex-1 items-center justify-center p-4"> {/* Changed div to main, use flex-1 */}
        <LoginForm 
          userType="Admin" 
          redirectPath="/admin/dashboard" 
        />
      </main>
    </div>
  );
}
