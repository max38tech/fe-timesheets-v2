"use client";

import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth, db } from "@/lib/firebase"; 
import { doc, getDoc, type DocumentData } from "firebase/firestore"; 
import { useRouter } from "next/navigation";

// No 'useToast' import here anymore

interface AppUser extends User {
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
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as DocumentData;
            const firestoreRole = userData.role || null;
            const firestoreStatus = userData.status || 'active'; 
            
            if (firestoreStatus === 'archived') {
              await firebaseSignOut(auth);
            } else {
              const appUser: AppUser = {
                ...user,
                displayName: userData.displayName || user.displayName,
                role: firestoreRole,
                status: firestoreStatus,
              };
              setCurrentUser(appUser);
              setUserRole(firestoreRole);
              setUserStatus(firestoreStatus);
            }
          } else {
            console.warn(`User document for UID ${user.uid} not found.`);
            await firebaseSignOut(auth);
          }
        } catch (error) {
          console.error("Error fetching user data from Firestore:", error);
           await firebaseSignOut(auth);
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setUserStatus(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []); // This is the single, correct closing for the useEffect hook.

  const logout = async () => {
    // The logout function now ONLY handles signing out
    await firebaseSignOut(auth);
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