import React, { useState } from 'react';
import { ImageOff, FileSpreadsheet } from 'lucide-react';

interface ImageFallbackProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackText?: string;
  aspectRatio?: string;
  onClick?: () => void;
}

export const ImageFallback: React.FC<ImageFallbackProps> = ({
  src,
  alt,
  className = '',
  fallbackText = 'ไม่สามารถโหลดรูปภาพได้ / รูปภาพชำรุด',
  aspectRatio = 'aspect-[3/4]',
  onClick,
}) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        onClick={onClick}
        className={`w-full ${aspectRatio} bg-gradient-to-b from-slate-100 to-slate-200 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-4 text-center select-none ${className} ${
          onClick ? 'cursor-pointer hover:border-slate-400 transition-colors' : ''
        }`}
      >
        <svg
          className="w-12 h-12 text-slate-400 mb-2"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="8" y="6" width="32" height="36" rx="4" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3 3" />
          <path d="M16 16H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M16 22H28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="18" cy="30" r="2.5" fill="currentColor" opacity="0.6" />
          <circle cx="26" cy="30" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="34" cy="30" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 38L36 10" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="text-xs font-medium text-slate-600 max-w-[180px] leading-tight">
          {fallbackText}
        </span>
        <span className="text-[11px] text-slate-400 mt-1">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onClick={onClick}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
};
