// Shape of a content-engine batch draft, mirrored into the `content_drafts`
// Supabase table by the (separately repo'd) content engine. Defined here,
// not imported from that repo, so /admin/content has no code dependency on
// it — the two projects only share this JSON shape, not any code.
export type AssetType = "pinterest" | "photos" | "backgrounds";

export interface GeneratedPost {
  hook: string;
  slides: { text: string; assetType: AssetType; photo?: string | null }[];
  caption: string;
  hashtags: string[];
}

export interface Draft {
  label: string;
  pillarTitle: string;
  post: GeneratedPost;
}
