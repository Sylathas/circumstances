export type Song = {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  /** Optional small image used on the timeline thumb. */
  thumbUrl?: string;
  /** Sort key (optional). */
  order?: number;
};

