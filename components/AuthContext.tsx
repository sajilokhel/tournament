"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type UserRole = "user" | "manager" | "admin";

// Create a custom user interface that includes Firestore data
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  emailVerified: boolean;
  // Add any other Firebase User properties you need
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
          const firestoreData = userDocSnap.data();

          // Create a new user object with Firestore data taking precedence
          const finalUser: AuthUser = {
            ...firebaseUser,
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            emailVerified: firebaseUser.emailVerified,
            // Use Firestore displayName if available, otherwise fall back to Firebase Auth
            displayName:
              firestoreData.displayName || firebaseUser.displayName || null,
            // Use Firestore photoURL if available, otherwise fall back to Firebase Auth
            photoURL: firestoreData.photoURL || firebaseUser.photoURL || null,
            // Get role from Firestore, default to 'user'
            role: firestoreData.role || "user",
          };

          setUser(finalUser);
          setRole(finalUser.role);
        } else {
          // No Firestore document found, use Firebase Auth data
          const fallbackUser: AuthUser = {
            ...firebaseUser,
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            emailVerified: firebaseUser.emailVerified,
            displayName: firebaseUser.displayName || null,
            photoURL: firebaseUser.photoURL || null,
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
