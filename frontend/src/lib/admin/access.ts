import { ApiError, apiRequest } from "@/lib/api/client";
import { authApi } from "@/lib/auth/api";
import type { User } from "@/lib/auth/types";

export const hasKnownRole = (user: User) =>
  ["USER", "ADMIN"].includes(user.role);

/** Only the active ADMIN role may enter management. OPTIONS verifies the
 * existing IsAdminOnly boundary, not an inferred is_staff flag.
 * No JWT decoding, localStorage role or demo bypass is accepted.
 */
export async function checkStaffAccess() {
  const user = await authApi.me();
  if (!hasKnownRole(user) || user.role !== "ADMIN")
    throw new ApiError(403, {
      detail: "Управление доступно только администратору. Роль MANAGER не используется.",
    });
  await apiRequest("/catalog/stock/movements", {
    method: "OPTIONS",
    cache: "no-store",
  });
  return user;
}
