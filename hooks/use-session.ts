'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Client-side view of the server session.
 *
 * This replaces the old Zustand auth store. Note what it does NOT do: it holds
 * no token, writes nothing to localStorage, and cannot be edited into a
 * different role. It simply asks the server "who am I" and caches the answer for
 * rendering.
 *
 * The values here decide what UI to show. They never decide what the user is
 * allowed to do — every protected page re-checks server-side, and every API
 * route enforces its own authorization.
 */

export type Role = 'farmer' | 'buyer' | 'admin';

export interface SessionResponse {
  authenticated: boolean;
  mfaRequired?: boolean;
  email?: string;
  user?: { email: string; role: Role; mfaEnabled: boolean };
  profile?: Record<string, unknown> | null;
}

async function fetchSession(): Promise<SessionResponse> {
  const res = await fetch('/api/auth/session', {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  });
  if (!res.ok) return { authenticated: false };
  return res.json();
}

export function useSession() {
  const query = useQuery({
    queryKey: ['session'],
    queryFn: fetchSession,
    staleTime: 60_000,
    retry: false,
  });

  return {
    isLoading: query.isLoading,
    isAuthenticated: query.data?.authenticated ?? false,
    mfaRequired: query.data?.mfaRequired ?? false,
    user: query.data?.user ?? null,
    profile: query.data?.profile ?? null,
    role: query.data?.user?.role ?? null,
    refetch: query.refetch,
  };
}

/** Logs out server-side, then clears cached session state. */
export function useLogout() {
  const queryClient = useQueryClient();

  return async function logout(): Promise<void> {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
    // Drop every cached query: some hold data the next user must not see.
    queryClient.clear();
  };
}
