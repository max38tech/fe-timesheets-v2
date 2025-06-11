
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { AppLogo } from "@/components/layout/app-logo";
import { LogIn, Loader2, KeyRound } from "lucide-react"; // Added KeyRound
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail, type AuthError } from "firebase/auth"; // Added sendPasswordResetEmail
import { doc, getDoc, type DocumentData } from "firebase/firestore";
import React from "react"; // Import React for useState

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type LoginFormProps = {
  userType: "Technician" | "Admin";
  redirectPath: string;
};

export function LoginForm({ userType, redirectPath }: LoginFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSendingReset, setIsSendingReset] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    form.clearErrors();
    form.setValue("password", ""); 
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data() as DocumentData;
        const userRole = userData.role;
        const userStatus = userData.status || 'active';

        if (userStatus === 'archived') {
          await signOut(auth);
          toast({
            title: "Account Archived",
            description: "This account has been archived and cannot be accessed.",
            variant: "destructive",
          });
          form.setError("email", { type: "manual", message: " " });
          form.setError("password", { type: "manual", message: "Account archived." });
          return;
        }

        if (userRole && userRole.toLowerCase() === userType.toLowerCase()) {
          toast({
            title: "Login Successful",
            description: `Welcome back, ${userType}!`,
          });
          router.push(redirectPath);
        } else {
          await signOut(auth); 
          let roleErrorMsg = `This account is not configured as a ${userType}.`;
          if (!userRole) {
            roleErrorMsg = `User role not found for this account. Please contact support.`;
          }
          toast({
            title: "Access Denied",
            description: roleErrorMsg,
            variant: "destructive",
          });
          form.setError("email", { type: "manual", message: " " });
          form.setError("password", { type: "manual", message: "Access denied." });
        }
      } else {
        await signOut(auth); 
        toast({
          title: "Access Denied",
          description: "User profile not found. Please contact support.",
          variant: "destructive",
        });
        form.setError("email", { type: "manual", message: " " });
        form.setError("password", { type: "manual", message: "User role configuration error." });
      }

    } catch (error) {
      const authError = error as AuthError;
      let errorMessage = "An unexpected error occurred. Please try again.";
      switch (authError.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential": 
          errorMessage = "Invalid email or password.";
          form.setError("email", { type: "manual", message: " " }); 
          form.setError("password", { type: "manual", message: "Invalid email or password." });
          break;
        case "auth/invalid-email":
          errorMessage = "Please enter a valid email address.";
          form.setError("email", { type: "manual", message: errorMessage });
          break;
        case "auth/too-many-requests":
            errorMessage = "Too many login attempts. Please try again later.";
            break;
        default:
          console.error("Login error:", authError);
      }
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  const handleForgotPassword = async () => {
    const email = form.getValues("email");
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address in the field above first.",
        variant: "destructive",
      });
      form.setFocus("email");
      return;
    }
    if (form.getFieldState("email").invalid) {
        toast({
            title: "Invalid Email",
            description: "Please enter a valid email address.",
            variant: "destructive",
        });
        form.setFocus("email");
        return;
    }

    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "Password Reset Email Sent",
        description: `If an account exists for ${email}, a password reset email has been sent. Please check your inbox (and spam folder).`,
      });
    } catch (error) {
      const authError = error as AuthError;
      let errorMessage = "Could not send password reset email. Please try again.";
      // Firebase often doesn't confirm if an email exists for security reasons during password resets.
      // So, a generic message is often better unless a specific error like 'auth/invalid-email' occurs.
      if (authError.code === 'auth/invalid-email') {
        errorMessage = "The email address format is invalid.";
      } else if (authError.code === 'auth/user-not-found') {
        // We can choose to reveal this or keep it generic. For this app, generic is fine.
         toast({
            title: "Password Reset Email Sent",
            description: `If an account exists for ${email}, a password reset email has been sent. Please check your inbox (and spam folder).`,
        });
        setIsSendingReset(false);
        return;
      }
      console.error("Password reset error:", authError);
      toast({
        title: "Password Reset Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="flex flex-col min-h-svh justify-center items-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mb-4 inline-block">
            <AppLogo />
          </div>
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <LogIn className="h-6 w-6" />
            {userType} Login
          </CardTitle>
          <CardDescription>
            Enter your credentials to access the {userType.toLowerCase()} portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-baseline">
                        <FormLabel>Password</FormLabel>
                        <Button
                            type="button"
                            variant="link"
                            className="px-0 text-xs h-auto py-0"
                            onClick={handleForgotPassword}
                            disabled={isSendingReset || form.formState.isSubmitting}
                        >
                            {isSendingReset ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <KeyRound className="mr-1 h-3 w-3" />}
                            {isSendingReset ? "Sending..." : "Forgot Password?"}
                        </Button>
                    </div>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || isSendingReset}>
                {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
                {form.formState.isSubmitting ? "Logging in..." : "Log In"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
