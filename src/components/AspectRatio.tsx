import React from "react";

type Props = {
  ratio?: number; // width / height
  children: React.ReactNode;
};

export function AspectRatio({ ratio = 16 / 9, children }: Props) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "100vw",
        margin: "0 auto",
        paddingTop: `${100 / ratio}%`,
        background: "#000", // just to see the frame
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
