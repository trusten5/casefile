import { ImageResponse } from "next/og";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { AssetType } from "./pillars";

const SIZE = { width: 1080, height: 1350 };
const ASSETS_DIR = join(__dirname, "..", "..", "content", "assets");
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

// Brand colors from src/app/opengraph-image.tsx — kept consistent across
// the marketing site and this content.
const CREAM = "#ece7d9";
const DARK = "#1d2220";

function pickAssetDataUri(assetType: AssetType): string | null {
  const dir = join(ASSETS_DIR, assetType);
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => IMAGE_EXT.test(f));
  } catch {
    return null;
  }
  if (files.length === 0) return null;

  const file = files[Math.floor(Math.random() * files.length)];
  const ext = file.split(".").pop()!.toLowerCase();
  const bytes = readFileSync(join(dir, file));
  return `data:${MIME[ext]};base64,${bytes.toString("base64")}`;
}

const TEXT_MAX_WIDTH = SIZE.width - 72 * 2;

// Over a photo/screenshot, text sits on a bottom-anchored gradient — dark
// enough at the bottom to stay legible over busy UI screenshots, fading to
// clear at the top so the image itself still reads as the CTA's "show, don't
// pitch" proof. Over a solid color there's nothing to compete with, so the
// text is just centered with no scrim.
function textOverlay(opts: { text: string; slideIndex: number; slideCount: number; hasImage: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: opts.hasImage ? "flex-end" : "center",
        padding: 72,
        background: opts.hasImage
          ? "linear-gradient(to top, rgba(20,24,23,0.95) 0%, rgba(20,24,23,0.82) 35%, rgba(20,24,23,0) 75%)"
          : "transparent",
      }}
    >
      <div style={{ maxWidth: TEXT_MAX_WIDTH, fontSize: 26, color: CREAM, opacity: 0.7, letterSpacing: 2, marginBottom: 32 }}>
        {`${opts.slideIndex + 1}/${opts.slideCount}`}
      </div>
      <div style={{ maxWidth: TEXT_MAX_WIDTH, fontSize: 58, fontWeight: 700, color: CREAM, lineHeight: 1.25 }}>
        {opts.text}
      </div>
    </div>
  );
}

export async function renderSlide(opts: {
  text: string;
  assetType: AssetType;
  slideIndex: number;
  slideCount: number;
}): Promise<ArrayBuffer> {
  const image = pickAssetDataUri(opts.assetType);
  const overlay = textOverlay({ ...opts, hasImage: Boolean(image) });

  const content = image ? (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "serif" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt=""
        width={SIZE.width}
        height={SIZE.height}
        style={{ objectFit: "cover", position: "absolute", inset: 0 }}
      />
      {overlay}
    </div>
  ) : (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: DARK,
        fontFamily: "serif",
      }}
    >
      {overlay}
    </div>
  );

  const response = new ImageResponse(content, SIZE);
  return response.arrayBuffer();
}
