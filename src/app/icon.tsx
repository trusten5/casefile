import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#101820",
          borderRadius: 6,
          fontFamily: "serif",
          fontWeight: 700,
          fontSize: 22,
          color: "#e9edf0",
        }}
      >
        C
      </div>
    ),
    size
  );
}
