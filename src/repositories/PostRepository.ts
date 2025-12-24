import { db } from "../db/connection.ts";
import { Post } from "../models/Post";

export class PostRepository {
  async create(post: Post) {
    const { title, slug, content, user_id } = post;
    const [result] = await db.execute(
      "INSERT INTO posts (title, slug, content, user_id) VALUES (?, ?, ?, ?)",
      [title, slug, content, user_id]
    );
    return result;
  }

  async findAll() {
    const [rows] = await db.execute(`
  SELECT p.*, u.id as userId, u.email, u.name
  FROM posts p
  JOIN users u ON u.id = p.user_id
  ORDER BY p.created_at DESC
`);
    return rows;
  }

  async findById(id: number) {
    const [rows] = await db.execute(
      `
SELECT p.*, u.id as userId, u.email, u.name
FROM posts p
JOIN users u ON u.id = p.user_id
WHERE p.id = ?
`,
      [id]
    );
    return rows;
  }

  async update(id: number, post: Partial<Post>) {
    const { title, content, user_id, published} = post;
    await db.execute(
      "UPDATE posts SET title = ?, content = ?, user_id = ?, published = ? WHERE id = ?",
      [title, content, user_id, published, id]
    );
  }

  async delete(id: number) {
    await db.execute("DELETE FROM posts WHERE id = ?", [id]);
  }
}
