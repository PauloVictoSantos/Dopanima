import { db } from "../db/connection.ts";
import { Comment } from "../models/Comment";

export class CommentRepository {
  async create(comment: Comment) {
    const { content, user_id, post_id } = comment;

    const [result] = await db.execute(
      `
      INSERT INTO comments (content, user_id, post_id)
      VALUES (?, ?, ?)
      `,
      [content, user_id, post_id]
    );

    return result;
  }

  async findAll() {
    const [rows] = await db.execute(
      `
      SELECT 
        c.id,
        c.content,
        c.created_at,
        u.id AS user_id,
        u.name AS user_name,
        p.id AS post_id,
        p.title AS post_title
      FROM comments c
      JOIN users u ON u.id = c.user_id
      JOIN posts p ON p.id = c.post_id
      ORDER BY c.created_at DESC
      `
    );

    return rows;
  }

  async findByPost(postId: number) {
    const [rows] = await db.execute(
      `
      SELECT 
        c.id,
        c.content,
        c.created_at,
        u.id AS user_id,
        u.name AS user_name
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ?
      ORDER BY c.created_at DESC
      `,
      [postId]
    );

    return rows;
  }

  async findById(id: number) {
    const [rows] = await db.execute(
      `
      SELECT id, content, user_id, post_id, created_at
      FROM comments
      WHERE id = ?
      `,
      [id]
    );

    return (rows as any[])[0];
  }

  async update(id: number, content: string) {
    await db.execute(
      `
      UPDATE comments
      SET content = ?
      WHERE id = ?
      `,
      [content, id]
    );
  }

  async delete(id: number) {
    await db.execute(
      "DELETE FROM comments WHERE id = ?",
      [id]
    );
  }
}
