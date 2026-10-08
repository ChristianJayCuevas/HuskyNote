import React from 'react';

// Google Chrome's logo in its official colors (a third-party brand mark; pass colored={false} for a currentColor glyph)
// design-exception: third-party brand logo colors
const CHROME = { red: '#EA4335', green: '#34A853', yellow: '#FBBC05', white: '#FFFFFF', blue: '#4285F4' } as const;

interface ChromeIconProps {
  className?: string;
  colored?: boolean;
}

export const ChromeIcon: React.FC<ChromeIconProps> = ({
  className = 'size-4',
  colored = true,
}) => {
  if (!colored) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.042l-5.346 9.258c.207.005.414.01.623.01A12 12 0 0 0 24 12c0-.528-.035-1.047-.1-1.558zM12 7.636a4.364 4.364 0 1 0 0 8.728 4.364 4.364 0 0 0 0-8.728z" />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Top Red */}
      <path
        d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0z"
        fill={CHROME.red}
      />
      {/* Bottom Left Green */}
      <path
        d="M1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29z"
        fill={CHROME.green}
      />
      {/* Bottom Right Yellow */}
      <path
        d="M15.273 7.636a5.446 5.446 0 0 1 1.45 7.042l-5.346 9.258c.207.005.414.01.623.01A12 12 0 0 0 24 12c0-.528-.035-1.047-.1-1.558z"
        fill={CHROME.yellow}
      />
      {/* Center White Mask */}
      <circle cx="12" cy="12" r="5.45" fill={CHROME.white} />
      {/* Center Blue Circle */}
      <circle cx="12" cy="12" r="4.36" fill={CHROME.blue} />
    </svg>
  );
};
