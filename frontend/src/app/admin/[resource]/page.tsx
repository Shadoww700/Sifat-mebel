import { notFound } from "next/navigation";
import { isResourceKey } from "@/lib/admin/resources";
import { ResourceManager } from "@/components/admin/resource-manager";
export default async function ResourcePage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  if (!isResourceKey(resource)) notFound();
  return <ResourceManager key={resource} resource={resource} />;
}
