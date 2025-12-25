export interface Post {
  id?: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  cover_image: string | null;
  published?: boolean;
  views?: number;
  user_id: number;
}
