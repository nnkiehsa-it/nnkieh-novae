export interface CommentResponseRecord {
  id: string;
  issue_id: string;
  content: string;
  author_uid: string;
  author_name: string;
  author_photo_url: string | null;
  is_admin_comment: boolean;
  created_at_ms: number | null;
  updated_at_ms: number | null;
}
