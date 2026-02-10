import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { appleAuth } from "@invertase/react-native-apple-authentication";
import {
  signInWithApple,
  signOut,
  subscribeToAuthState,
  AuthError,
  AuthErrorCode,
} from "./authService";
import { UserProfile } from "../types/UserProfile";

type AuthContextValue = {
  user: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((profile) => {
      setUser(profile);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signIn: async () => {
        setLoading(true);
        try {
          const profile = await signInWithApple();
          setUser(profile);
        } finally {
          setLoading(false);
        }
      },
      signOut: async () => {
        setLoading(true);
        try {
          await signOut();
          setUser(null);
        } finally {
          setLoading(false);
        }
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
};

export const AuthGate: React.FC = () => {
  const { user, loading, signIn } = useAuth();
  const [error, setError] = useState<AuthError | null>(null);
  const [isAppleSupported, setIsAppleSupported] = useState<boolean | null>(
    null
  );

  useEffect(() => {
    // Keep UI logic lightweight; auth logic stays in the service layer.
    setIsAppleSupported(appleAuth.isSupported);
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <SignInScreen
        isAppleSupported={!!isAppleSupported}
        error={error}
        onSignIn={async () => {
          setError(null);
          try {
            await signIn();
          } catch (err) {
            if (err && typeof err === "object" && "code" in err) {
              setError(err as AuthError);
            } else {
              setError({
                code: AuthErrorCode.UNKNOWN,
                message: "Unknown auth error.",
              });
            }
          }
        }}
      />
    );
  }

  return <LoggedInScreen user={user} />;
};

const LoadingScreen: React.FC = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Loading...</Text>
  </View>
);

const SignInScreen: React.FC<{
  isAppleSupported: boolean;
  error: AuthError | null;
  onSignIn: () => Promise<void>;
}> = ({ isAppleSupported, error, onSignIn }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shabbat Shalom</Text>
      <Text style={styles.subtitle}>Sign in to continue.</Text>
      {!isAppleSupported && (
        <Text style={styles.errorText}>
          Apple Sign-In is not available on this device.
        </Text>
      )}
      <Button
        title="Sign in with Apple"
        onPress={onSignIn}
        disabled={!isAppleSupported}
      />
      {error && <Text style={styles.errorText}>{error.message}</Text>}
    </View>
  );
};

const LoggedInScreen: React.FC<{ user: UserProfile }> = ({ user }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>
        {user.displayName ?? "Friend"}
      </Text>
      <Text style={styles.subtitle}>
        Current Streak: {user.currentStreak}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  errorText: {
    color: "#C00",
    marginTop: 12,
    textAlign: "center",
  },
});
