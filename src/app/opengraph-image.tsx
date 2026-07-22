import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#ece7d9",
          fontFamily: "serif",
        }}
      >
        <div style={{ fontSize: 28, color: "#55584f", letterSpacing: 2 }}>
          CASEFILE
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 76,
            fontWeight: 700,
            color: "#1d2220",
            lineHeight: 1.1,
          }}
        >
          Applied. Tracked. Repeat.
        </div>
        <div style={{ marginTop: 28, fontSize: 30, color: "#55584f", maxWidth: 900 }}>
          One case file for every application, every contact, every lead.
        </div>
      </div>
    ),
    size
  );
}
