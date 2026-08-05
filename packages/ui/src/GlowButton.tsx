import { colorHex, hexToRgba } from "./palette";

export type GlowButtonProps = {
  /** The one glow this screen is allowed to spend. Defaults to cyan. */
  colorHex?: string;
  /** 80px on the TV hero, 60px on phone footers - drives label size and glow blur. */
  height?: number;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Fills its container (phone footers) vs sizes to content (side-by-side action rows). Default true. */
  fullWidth?: boolean;
};

/** The single primary-action glow: 2px border, 12% fill, 30% blur - per screen, at most once. */
export function GlowButton({
  colorHex: hex = colorHex(1),
  height = 60,
  label,
  onClick,
  disabled,
  fullWidth = true,
}: GlowButtonProps) {
  const large = height >= 70;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: fullWidth ? "100%" : "auto",
        height,
        padding: "0 32px",
        border: `2px solid ${hex}`,
        borderRadius: "var(--radius-md)",
        background: hexToRgba(hex, 0.12),
        boxShadow: `0 0 ${large ? 32 : 24}px ${hexToRgba(hex, 0.3)}`,
        color: hex,
        font: `600 ${large ? 32 : 17}px var(--font-ui)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "opacity 150ms ease-out",
      }}
    >
      {label}
    </button>
  );
}

export type NeutralButtonProps = {
  height?: number;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
};

/** Secondary action - 1px neutral border, no glow, no fill. */
export function NeutralButton({ height = 60, label, onClick, disabled, fullWidth = true }: NeutralButtonProps) {
  const large = height >= 70;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: fullWidth ? "100%" : "auto",
        height,
        padding: "0 32px",
        border: "1px solid rgba(242,234,217,.18)",
        borderRadius: "var(--radius-md)",
        background: "transparent",
        color: "rgba(242,234,217,.75)",
        font: `600 ${large ? 32 : 17}px var(--font-ui)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "opacity 150ms ease-out",
      }}
    >
      {label}
    </button>
  );
}
