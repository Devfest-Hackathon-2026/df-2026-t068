"use client";

import {
  browserLocalPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { FirebaseError } from "firebase/app";
import {
  getFirebaseAuth,
  missingFirebaseConfiguration,
} from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  missingConfiguration: string[];
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getAuthErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    if (error.code === "auth/popup-closed-by-user") {
      return "ログイン画面が閉じられました。もう一度お試しください。";
    }

    if (error.code === "auth/popup-blocked") {
      return "ログイン画面がブロックされました。ポップアップを許可してください。";
    }

    if (error.code === "auth/unauthorized-domain") {
      return "このドメインはFirebase Authenticationで許可されていません。";
    }
  }

  return "ログイン処理に失敗しました。時間を置いてもう一度お試しください。";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const missingConfiguration = useMemo(
    () => missingFirebaseConfiguration(),
    [],
  );

  useEffect(() => {
    if (missingConfiguration.length > 0) {
      setIsLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    return onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setIsLoading(false);
      },
      () => {
        setError("ログイン状態を確認できませんでした。");
        setIsLoading(false);
      },
    );
  }, [missingConfiguration]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);

    try {
      const auth = getFirebaseAuth();
      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (signInError) {
      setError(getAuthErrorMessage(signInError));
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);

    try {
      await firebaseSignOut(getFirebaseAuth());
    } catch {
      setError("ログアウトに失敗しました。もう一度お試しください。");
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      missingConfiguration,
      error,
      signInWithGoogle,
      signOut,
    }),
    [
      user,
      isLoading,
      missingConfiguration,
      error,
      signInWithGoogle,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
