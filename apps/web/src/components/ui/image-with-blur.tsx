"use client";

import { useState } from "react";
import Image, { ImageProps } from "next/image";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

interface ImageWithBlurProps extends Omit<ImageProps, "onLoad"> {
  containerClassName?: string;
  fallbackSrc?: string;
}

export function ImageWithBlur({
  src,
  alt,
  className,
  containerClassName,
  fallbackSrc = "/images/placeholder.webp",
  ...props
}: ImageWithBlurProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden w-full h-full",
        containerClassName,
      )}
    >
      {isLoading && (
        <Skeleton className="absolute inset-0 z-0 w-full h-full bg-gray-100" />
      )}

      <Image
        src={error ? fallbackSrc : src || fallbackSrc}
        alt={alt}
        quality={70}
        className={cn(
          "transition-all duration-700 ease-in-out",
          isLoading
            ? "scale-110 blur-xl grayscale"
            : "scale-100 blur-0 grayscale-0",
          className,
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setError(true);
          setIsLoading(false);
        }}
        {...props}
      />
    </div>
  );
}
