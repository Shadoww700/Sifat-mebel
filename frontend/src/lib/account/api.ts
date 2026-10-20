import { apiRequest } from "@/lib/api/client";

/** Fields and methods verified against accounts serializers and views. */
export type Profile = {
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  avatar: string | null;
  birth_date: string | null;
  created_at: string;
  updated_at: string;
};
export type ProfileUpdate = Pick<
  Profile,
  "first_name" | "last_name" | "phone_number" | "birth_date"
>;
export type AddressPayload = {
  title: string;
  recipient_name: string;
  phone_number: string;
  country: string;
  region: string;
  city: string;
  district: string;
  street: string;
  house: string;
  apartment: string;
  landmark: string;
  postal_code: string;
  is_default: boolean;
};
export type Address = AddressPayload & {
  id: number;
  latitude: string | null;
  longitude: string | null;
  created_at: string;
  updated_at: string;
};

export const accountApi = {
  profile: () => apiRequest<Profile>("/profile", { cache: "no-store" }),
  updateProfile: (payload: ProfileUpdate) =>
    apiRequest<Profile>("/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  addresses: async () => {
    // Current settings have no pagination. Also handles a DRF paginated response.
    const items: Address[] = [];
    let path: string | null = "/profile/addresses";
    const visited = new Set<string>();
    while (path) {
      if (visited.has(path)) throw new Error("Повторяющаяся страница адресов");
      visited.add(path);
      const data: unknown = await apiRequest(path, { cache: "no-store" });
      const page = data as { results?: unknown; next?: unknown } | null;
      const batch = Array.isArray(data) ? data : page?.results;
      if (!Array.isArray(batch)) throw new Error("Некорректный список адресов");
      items.push(...batch);
      if (Array.isArray(data) || !page?.next) break;
      if (typeof page.next !== "string")
        throw new Error("Некорректная пагинация адресов");
      const next: URL = new URL(
        page.next,
        "http://pagination.local/api/v1/profile/addresses/",
      );
      if (next.pathname.replace(/\/$/, "") !== "/api/v1/profile/addresses")
        throw new Error("Некорректная пагинация адресов");
      path = `/profile/addresses${next.search}`;
    }
    return items;
  },
  createAddress: (payload: AddressPayload) =>
    apiRequest<Address>("/profile/addresses", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAddress: ({ id, payload }: { id: number; payload: AddressPayload }) =>
    apiRequest<Address>(`/profile/addresses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteAddress: (id: number) =>
    apiRequest<void>(`/profile/addresses/${id}`, { method: "DELETE" }),
};
