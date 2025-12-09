import type { ReactNode } from "react";

type AspectRatioProps = {
  ratio?: number; // width / height, default 16/9
  children: ReactNode;
};

export function AspectRatio({ ratio = 16 / 9, children }: AspectRatioProps) {
  const paddingTop = `${100 / ratio}%`;

  return (
    <div className="w-full relative">
      <div style={{ paddingTop }} />
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
