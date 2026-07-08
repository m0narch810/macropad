const ICONS: Record<string, React.ReactNode> = {
  board: (
    <>
      <rect x="3" y="3" width="6" height="6" />
      <rect x="11" y="3" width="6" height="6" />
      <rect x="3" y="11" width="6" height="6" />
      <path d="M11 14H17" />
      <path d="M14 11V17" />
    </>
  ),
  news: (
    <>
      <rect x="3" y="4" width="14" height="12" />
      <path d="M6 8H14" />
      <path d="M6 11H14" />
      <path d="M6 13.5H10.5" />
    </>
  ),
  "us-macro": (
    <>
      <path d="M3 17V9" />
      <path d="M7.5 17V5" />
      <path d="M12 17V11" />
      <path d="M16.5 17V7" />
    </>
  ),
  "yield-rates": (
    <>
      <path d="M3 14L7.5 9L11 12L17 5" />
      <path d="M12.5 5H17V9.5" />
    </>
  ),
  "cot-positioning": (
    <>
      <path d="M10 3V17" />
      <path d="M3 6H17" />
      <path d="M3 6L1.5 10.5H6.5L5 6" />
      <path d="M15 6L13.5 10.5H18.5L17 6" />
    </>
  ),
  transmission: (
    <>
      <circle cx="6" cy="10" r="3.2" />
      <circle cx="14" cy="10" r="3.2" />
      <path d="M9.2 10H10.8" />
    </>
  ),
  geopolitics: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M3 10H17" />
      <path d="M10 3C12.5 5.5 12.5 14.5 10 17C7.5 14.5 7.5 5.5 10 3Z" />
    </>
  ),
  "custom-dashboard": (
    <>
      <rect x="3" y="3" width="6.2" height="6.2" />
      <rect x="10.8" y="3" width="6.2" height="6.2" />
      <rect x="3" y="10.8" width="6.2" height="6.2" />
      <rect x="10.8" y="10.8" width="6.2" height="6.2" />
    </>
  ),
  "custom-bias": (
    <>
      <path d="M3 15A7 7 0 0 1 17 15" />
      <path d="M10 15L13.5 9" />
      <circle cx="10" cy="15" r="1.3" />
    </>
  ),
};

export default function PanelIcon({
  id,
  className,
  style,
}: {
  id: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const icon = ICONS[id];
  if (!icon) return null;
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      style={style}
    >
      {icon}
    </svg>
  );
}
