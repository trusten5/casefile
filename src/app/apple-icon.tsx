import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1d2220",
          fontFamily: "serif",
          fontWeight: 700,
          fontSize: 96,
          color: "#ece7d9",
        }}
      >
        C
      </div>
    ),
    size
  );
}
