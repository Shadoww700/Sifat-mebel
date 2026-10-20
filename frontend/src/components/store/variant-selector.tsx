"use client";
import type { Variant } from "@/lib/commerce/models";
import {
  attributeLabel,
  attributeToken,
} from "@/lib/commerce/catalog-attributes";
import {
  chooseOption,
  matchingVariants,
  variantAxes,
  type VariantSelection,
} from "@/lib/commerce/variants";

export function VariantSelector({
  variants,
  selection,
  onChange,
}: {
  variants: Variant[];
  selection: VariantSelection;
  onChange: (selection: VariantSelection) => void;
}) {
  const axes = variantAxes(variants);
  return (
    <div className="s-variant-selector">
      {axes.map((axis, index) => {
        const prefix = Object.fromEntries(
          axes
            .slice(0, index)
            .filter((a) => selection[a.id])
            .map((a) => [a.id, selection[a.id]]),
        );
        return (
          <fieldset key={axis.id}>
            <legend>{axis.name}</legend>
            <div className="s-variant-options">
              {axis.options.map((option) => {
                const token = attributeToken(option.value);
                const candidates = matchingVariants(variants, {
                  ...prefix,
                  [axis.id]: token,
                });
                const impossible = candidates.length === 0;
                const soldOut =
                  !impossible && candidates.every((v) => v.stock === 0);
                return (
                  <button
                    key={token}
                    type="button"
                    aria-pressed={selection[axis.id] === token}
                    disabled={impossible}
                    onClick={() =>
                      onChange(
                        chooseOption(variants, selection, axis.id, token),
                      )
                    }
                  >
                    <span>{attributeLabel(option)}</span>
                    {(impossible || soldOut) && (
                      <small>
                        {impossible ? "Нет сочетания" : "Нет в наличии"}
                      </small>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
