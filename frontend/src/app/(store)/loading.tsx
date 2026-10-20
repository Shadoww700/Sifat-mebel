import { ProductSkeletons } from "@/components/store/primitives";
export default function Loading() {
  return (
    <div className="s-container s-page">
      <div className="s-heading">
        <div className="s-skeleton s-skeleton-line short" />
        <div className="s-skeleton s-skeleton-line" />
      </div>
      <ProductSkeletons />
    </div>
  );
}
