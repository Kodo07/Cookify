"use client";

interface BrandLogoProps {
  variant: "full" | "icon";
  className?: string;
}

export function BrandLogo({ variant, className }: BrandLogoProps) {
  const src = variant === "full" ? "/brand/logo.svg" : "/brand/logo-icon.svg";
  const defaultSize = variant === "full" ? "h-9 w-auto sm:h-10" : "h-9 w-9";

  return (
    <img
      src={src}
      alt={variant === "full" ? "cookify" : "cookify icon"}
      className={`${defaultSize} ${className ?? ""}`}
    />
  );
}
