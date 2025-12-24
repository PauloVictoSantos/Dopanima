export interface Comment {
  id?: number;
  content: string;
  user_id: number;
  post_id: number;
  created_at?: Date;
}
