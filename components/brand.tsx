import Link from "next/link";

export function Brand({
  locale,
  inverse = false,
}: {
  locale: string;
  inverse?: boolean;
}) {
  return (
    <Link
      className="brand"
      href={`/${locale}`}
      style={inverse ? { color: "white" } : undefined}
      aria-label="Crestview home"
    >
      <span className="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 96 96" fill="none">
          <path d="M68.5 22.5A34 34 0 1 0 69 73" stroke="currentColor" strokeWidth="15" strokeLinecap="square" />
          <path d="M24 66.5C36 66.5 43.5 58.5 50.5 48.5C46 57.5 42 67.5 31.5 75.5Z" fill="currentColor" />
          <path d="M34 74C48.5 73 57.5 64 64 52.5C60 65 54.5 75 43 81Z" fill="currentColor" />
          <path className="brand__horizon" d="M50.5 47.5H74V33C63 35.5 55 40 50.5 47.5Z" />
          <path d="M49.5 51H74" stroke="currentColor" strokeWidth="3" />
        </svg>
      </span>
      <span className="brand__wordmark">Crestview</span>
    </Link>
  );
}
