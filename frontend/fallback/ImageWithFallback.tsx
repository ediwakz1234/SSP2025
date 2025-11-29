import { useState } from "react";

const FALLBACK_IMG =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjY2NjIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsPSJub25lIiBzdHJva2Utd2lkdGg9IjMuOCI+PHJlY3QgeD0iMTYiIHk9IjE2IiB3aWR0aD0iNTYiIGhlaWdodD0iNTYiIHJ4PSI2Ii8+PGNpcmNsZSBjeD0iNDQiIGN5PSIzOCIgcj0iNyIvPjxwYXRoIGQ9Ik0xNiA1OGwyMC0yMCAyNiAyNiIvPjwvc3ZnPg==";

export function ImageWithFallback({
  src,
  alt = "Image",
  className,
  style,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);

  return (
    <>
      {!failed ? (
        <img
          src={src}
          alt={alt}
          className={className}
          style={style}
          onError={() => setFailed(true)}
          {...rest}
        />
      ) : (
        <div
          className={`flex items-center justify-center bg-gray-100 ${className}`}
          style={style}
        >
          <img
            src={FALLBACK_IMG}
            alt="Image failed to load"
            className="opacity-60"
          />
        </div>
      )}
    </>
  );
}
