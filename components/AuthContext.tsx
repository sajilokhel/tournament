"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type UserRole = "user" | "manager" | "admin";

// Extend the Firebase User type to include our custom fields
export interface AuthUser extends User {
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  role: UserRole | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  role: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is authenticated, now get their custom data from Firestore
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const customData = userDocSnap.data();

          // Create the final user object, ensuring Firestore data takes precedence
          const finalUser: AuthUser = {
            ...firebaseUser,
            displayName: customData.displayName || firebaseUser.displayName, // Prioritize Firestore displayName
            role: customData.role || "user", // Default to 'user' role if not set
          };

          setUser(finalUser);
          setRole(finalUser.role);
        } else {
          // Should not happen in normal flow, but handle it as a regular user.
          const fallbackUser: AuthUser = {
            ...firebaseUser,
            role: "user",
          };
          setUser(fallbackUser);
          setRole("user");
        }
      } else {
        // User is signed out
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, role }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
