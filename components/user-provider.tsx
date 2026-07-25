"use client";

import { createContext, useContext } from "react";

type CrestviewUser = {
  displayName: string;
  email: string;
};

const UserContext = createContext<CrestviewUser | null>(null);

export function UserProvider({ user, children }: { user: CrestviewUser; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useCrestviewUser() {
  const user = useContext(UserContext);
  if (!user) throw new Error("Crestview user context is unavailable.");
  return user;
}
