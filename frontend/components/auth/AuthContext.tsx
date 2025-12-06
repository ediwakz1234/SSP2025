import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { logActivity } from "../../utils/activity";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean; // TRUE until Supabase finishes restoring the session
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🔥 First, restore any existing session from storage
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    });

    // 🔥 Then listen for login/logout changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);

        // ⭐ Record login activity
        if (event === "SIGNED_IN" && newSession?.user) {
          logActivity("user_login", {
            user_id: newSession.user.id,
            email: newSession.user.email,
          });
        }

        // Optional: log logout
        if (event === "SIGNED_OUT") {
          logActivity("user_logout");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
