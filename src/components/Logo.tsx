export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="cd-logo-g" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#8a6bff" />
          <stop offset="1" stopColor="#38e8c6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#cd-logo-g)" opacity="0.16" />
      {/* cloak / hood silhouette */}
      <path
        d="M16 5c-4.4 0-8 3.7-8 8.3V24a1 1 0 0 0 1.4.9l2-1a1 1 0 0 1 .9 0l2.3 1.1a1 1 0 0 0 .8 0l2.3-1.1a1 1 0 0 1 .9 0l2 1A1 1 0 0 0 24 24V13.3C24 8.7 20.4 5 16 5Z"
        stroke="url(#cd-logo-g)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="14" r="2.4" fill="url(#cd-logo-g)" />
    </svg>
  );
}
