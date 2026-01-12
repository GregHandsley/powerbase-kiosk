import type { ReactNode } from 'react';

type AspectRatioProps = {
  ratio?: number; // width / height, default 16/9
  children: ReactNode;
};

export function AspectRatio({ ratio = 16 / 9, children }: AspectRatioProps) {
  return (
    <div className="w-full h-full min-h-0 min-w-0 flex items-center justify-center">
      <div
        className="relative h-full max-h-full max-w-full"
        style={{ aspectRatio: `${ratio}` }}
      >
        <div className="absolute inset-0">{children}</div>
      </div>
    </div>
  );
}
