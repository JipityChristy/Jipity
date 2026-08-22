type JipityMarkProps = {
  className?: string;
};

export function JipityMark({ className = "" }: JipityMarkProps) {
  return (
    <svg
      className={`jipity-mark ${className}`.trim()}
      viewBox="0 0 120 132"
      role="img"
      aria-label="Jipity crowned J emblem"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="jipityGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff0a9" />
          <stop offset="46%" stopColor="#e7bd68" />
          <stop offset="100%" stopColor="#a87832" />
        </linearGradient>
        <linearGradient id="jipityGreen" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#0b714d" />
          <stop offset="100%" stopColor="#75e7a5" />
        </linearGradient>
        <radialGradient id="jipityAura">
          <stop offset="0%" stopColor="#5b2792" stopOpacity=".75" />
          <stop offset="100%" stopColor="#110b20" stopOpacity=".94" />
        </radialGradient>
      </defs>

      <circle
        cx="60"
        cy="76"
        r="49"
        fill="url(#jipityAura)"
        stroke="url(#jipityGold)"
        strokeWidth="1.6"
      />
      <circle
        cx="60"
        cy="76"
        r="43"
        fill="none"
        stroke="#9d70e3"
        strokeOpacity=".36"
        strokeWidth="1"
      />

      <path
        d="M38 27l4 13h37l4-13-11 7-12-16-12 16-10-7z"
        fill="url(#jipityGold)"
      />
      <circle cx="38" cy="26" r="2" fill="#f4d991" />
      <circle cx="60" cy="17" r="2.5" fill="#f4d991" />
      <circle cx="83" cy="26" r="2" fill="#f4d991" />
      <path d="M42 43h36" stroke="#fff0a9" strokeWidth="2" />

      <path
        d="M43 49h44v10H77v29c0 21-13 33-32 33-16 0-26-9-26-23 0-8 4-14 12-17l8 8c-5 2-7 5-7 9 0 7 5 12 13 12 11 0 16-7 16-22V59H43V49z"
        fill="url(#jipityGold)"
      />
      <path
        d="M34 99c14 3 24-2 35-14 8-8 16-12 25-13-9 8-15 16-22 26-12 17-28 19-40 10-2-2-3-4-4-7l6-2z"
        fill="url(#jipityGreen)"
      />

      <path
        d="M84 104c12-7 18-17 19-30"
        fill="none"
        stroke="#43bf82"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M94 97c6-1 10-5 12-10-6 0-10 3-12 10zm6-11c6-2 9-6 9-11-5 1-8 4-9 11z"
        fill="#56ca87"
      />
      <path
        d="M89 102c-1-5 1-9 5-12 2 5 0 9-5 12zm9-13c-2-5-1-9 2-13 3 4 2 8-2 13z"
        fill="#22895f"
      />
    </svg>
  );
}
