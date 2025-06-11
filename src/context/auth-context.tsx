
"use client";

import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth, db } from "@/lib/firebase"; 
import { doc, getDoc, type DocumentData } from "firebase/firestore"; 
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface AppUser extends User {
  // displayName is already part of User, but we ensure our context prioritizes Firestore's version
  role?: string | null;
  status?: 'active' | 'archived' | null; 
}

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  userRole: string | null; 
  userStatus: 'active' | 'archived' | null; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<'active' | 'archived' | null>(null); 
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as DocumentData;
            const firestoreDisplayName = userData.displayName || user.displayName; // Prioritize Firestore displayName
            const firestoreRole = userData.role || null;
            const firestoreStatus = userData.status || 'active'; 
            
            if (firestoreStatus === 'archived') {
              await firebaseSignOut(auth);
              setCurrentUser(null);
              setUserRole(null);
              setUserStatus(null);
              toast({ title: "Account Archived", description: "This account has been archived and cannot be accessed.", variant: "destructive" });
              router.push("/"); 
            } else {
              // Construct the AppUser object, prioritizing Firestore data
              const appUser: AppUser = {
                ...user, // Base Firebase Auth user object
                displayName: firestoreDisplayName, // Override with Firestore display name
                role: firestoreRole,
                status: firestoreStatus,
              };
              setCurrentUser(appUser);
              setUserRole(firestoreRole);
              setUserStatus(firestoreStatus);
            }
          } else {
            console.warn(`User document for UID ${user.uid} not found or role/status not set in Firestore.`);
            await firebaseSignOut(auth); 
            setCurrentUser(null); 
            setUserRole(null);
            setUserStatus(null);
            toast({ title: "Access Denied", description: "User profile not found or not configured correctly.", variant: "destructive" });
            router.push("/");
          }
        } catch (error) {
          console.error("Error fetching user role/status/displayName from Firestore:", error);
          // Fallback to basic user object if Firestore fetch fails, but log out as profile is incomplete
           await firebaseSignOut(auth);
           setCurrentUser(null);
           setUserRole(null);
           setUserStatus(null);
           toast({ title: "Authentication Error", description: "Could not verify user details. Please try again.", variant: "destructive" });
           router.push("/");
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setUserStatus(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setCurrentUser(null); 
      setUserRole(null);    
      setUserStatus(null); 
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push("/"); 
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ title: "Logout Error", description: "Failed to log out. Please try again.", variant: "destructive" });
    }
  };

  const value = {
    currentUser,
    loading,
    logout,
    userRole,
    userStatus, 
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
