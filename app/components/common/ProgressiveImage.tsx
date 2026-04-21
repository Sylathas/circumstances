"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type ProgressiveImageProps = Omit<ImageProps, "quality"> & {
  lowQuality?: number;
  highQuality?: number;
};

export default function ProgressiveImage({
  lowQuality = 22,
  highQuality = 82,
  className,
  onLoad,
  ...props
}: ProgressiveImageProps) {
  const [highLoaded, setHighLoaded] = useState(false);

  return (
    <>
      <Image
        {...props}
        className={`transition-opacity duration-300 blur-[10px] scale-[1.02] ${highLoaded ? "opacity-0" : "opacity-100"} ${className ?? ""}`}
        quality={lowQuality}
        aria-hidden
      />
      <Image
        {...props}
        className={`transition-opacity duration-300 ${highLoaded ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
        quality={highQuality}
        onLoad={(ev) => {
          setHighLoaded(true);
          onLoad?.(ev);
        }}
      />
    </>
  );
}
