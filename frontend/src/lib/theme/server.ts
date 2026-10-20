import { cookies } from "next/headers";
export async function readTheme(): Promise<"day" | "evening"> {
  return (await cookies()).get("sifat-theme")?.value === "evening"
    ? "evening"
    : "day";
}
