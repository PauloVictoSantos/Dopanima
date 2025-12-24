import { db } from "../db/connection.ts";
import { PostTag } from "../models/PostTag";

export class PostTagRepository {
  async create(data: PostTag) {
    const { post_id, tag_id } = data;

    await db.execute(
      "INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)",
      [post_id, tag_id]
    );
  }

  async findAll() {
    const [rows] = await db.execute(`
      SELECT post_id, tag_id
      FROM post_tags
    `);

    return rows;
  }

  async findTagsByPost(postId: number) {
    const [rows] = await db.execute(
      `
      SELECT t.id, t.name, t.slug
      FROM tags t
      JOIN post_tags pt ON pt.tag_id = t.id
      WHERE pt.post_id = ?
      `,
      [postId]
    );

    return rows;
  }

  async delete(postId: number, tagId: number) {
    await db.execute(
      "DELETE FROM post_tags WHERE post_id = ? AND tag_id = ?",
      [postId, tagId]
    );
  }
}
