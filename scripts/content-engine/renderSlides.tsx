import { ImageResponse } from "next/og";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { AssetType } from "./pillars";

const SIZE = { width: 1080, height: 1350 };
const ASSETS_DIR = join(__dirname, "..", "..", "content", "assets");
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

// Every slide should carry a real photo. If the requested category is
// empty, fall back to any other populated category before ever falling
// back to a plain color — that plain-color case is just a safety net for
// an empty asset library (see the fallback branch in renderSlide below),
// not something that should show up once the library is populated.
const FALLBACK_ORDER: AssetType[] = ["photos", "screenshots", "backgrounds", "pinterest"];

function listImages(assetType: AssetType): string[] {
  const dir = join(ASSETS_DIR, assetType);
  try {
    return readdirSync(dir)
      .filter((f) => IMAGE_EXT.test(f))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

function pickAssetDataUri(assetType: AssetType): string | null {
  const order = [assetType, ...FALLBACK_ORDER.filter((t) => t !== assetType)];
  for (const type of order) {
    const files = listImages(type);
    if (files.length === 0) continue;
    const path = files[Math.floor(Math.random() * files.length)];
    const ext = path.split(".").pop()!.toLowerCase();
    const bytes = readFileSync(path);
    return `data:${MIME[ext]};base64,${bytes.toString("base64")}`;
  }
  return null;
}

const CARD_MAX_WIDTH = 900;

// A floating white card with black text sits over the full-bleed photo —
// no scrim/gradient on the photo itself. The hook slide's card is
// centered (biggest, most "pop"); every other slide's card sits at the
// bottom so the photo reads clearly up top.
function textCard(opts: { text: string; slideIndex: number; slideCount: number; position: "center" | "bottom" }) {
  const isHook = opts.slideIndex === 0;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: opts.position === "center" ? "center" : "flex-end",
        padding: 56,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxWidth: CARD_MAX_WIDTH,
          background: "#ffffff",
          borderRadius: 28,
          padding: 52,
        }}
      >
        <div style={{ maxWidth: CARD_MAX_WIDTH, fontSize: 22, color: "#00000066", letterSpacing: 2, marginBottom: 20 }}>
          {`${opts.slideIndex + 1}/${opts.slideCount}`}
        </div>
        <div
          style={{
            maxWidth: CARD_MAX_WIDTH,
            fontSize: isHook ? 64 : 48,
            fontWeight: 800,
            color: "#000000",
            lineHeight: 1.15,
          }}
        >
          {opts.text}
        </div>
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
  const position = opts.slideIndex === 0 ? "center" : "bottom";
  const card = textCard({ ...opts, position });

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
      {card}
    </div>
  ) : (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "#ece7d9",
        fontFamily: "serif",
      }}
    >
      {card}
    </div>
  );

  const response = new ImageResponse(content, SIZE);
  return response.arrayBuffer();
}
