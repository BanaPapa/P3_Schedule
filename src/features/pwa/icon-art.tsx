/** 앱 아이콘 그림 (집 + 달력 점). ImageResponse 로 PNG 를 만든다. */
export function IconArt({ size }: { size: number }) {
  const stroke = Math.round(size * 0.07);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#2563eb",
      }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <path
          d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"
          stroke="#ffffff"
          strokeWidth={(stroke / size) * 24 * 1.4}
          strokeLinejoin="round"
        />
        <circle cx="8.5" cy="15" r="1.4" fill="#ffffff" />
        <circle cx="12" cy="15" r="1.4" fill="#ffffff" />
        <circle cx="15.5" cy="15" r="1.4" fill="#ffffff" />
      </svg>
    </div>
  );
}
