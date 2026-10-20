import { authApi } from "./api";

/** One shared request/error across streamed header and account consumers.
 * Retrying on every observer mount can replace a 503 with a second verdict.
 * Drop the cache when leaving commerce (e.g. for login), so a newly created
 * session is always read on returning without changing Login/Register.
 */
export const sessionQueryOptions = {
  queryKey: ["auth", "me"] as const,
  queryFn: authApi.me,
  retry: false,
  retryOnMount: false,
  staleTime: 30_000,
  gcTime: 0,
};
