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
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2.8 14.2 9.8 21.2 12l-7 2.2-2.2 7-2.2-7-7-2.2 7-2.2L12 2.8Z"
            fill="currentColor"
          />
        </svg>
      </span>
      Crestview
    </Link>
  );
}
