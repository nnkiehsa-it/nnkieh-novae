export interface CommentResponseRecord {
  id: string;
  issueId: string;
  parentCommentId: string | null;
  content: string;
  authorUid: string;
  createdAt: string | null;
  replies?: CommentResponseRecord[];
}
