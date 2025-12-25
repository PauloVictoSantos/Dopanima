import { db } from "../db/connection.ts";
import { Post } from "../models/Post";

export class PostRepository {
  async create(post: Post) {
    const { title, slug, content, cover_image, excerpt, user_id } = post;
    const [result] = await db.execute(
      "INSERT INTO posts (title, slug, content, cover_image, excerpt, user_id) VALUES (?, ?, ?, ?, ?, ?)",
      [title, slug, content, cover_image, excerpt, user_id]
    );
    return result;
  }

  async findAll() {
    const [rows] = await db.execute(`
 SELECT 
      p.id,
      p.title,
      p.cover_image,
      p.excerpt,
      p.content,
      p.created_at,

      c.id AS category_id,
      c.name AS category_name,
      c.slug AS category_slug,

      u.id AS userId,
      u.name AS userName

    FROM posts p
    JOIN users u ON u.id = p.user_id
    JOIN post_categories pc ON pc.post_id = p.id
    JOIN categories c ON c.id = pc.category_id

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
    const { title, content, user_id, published } = post;
    await db.execute(
      "UPDATE posts SET title = ?, content = ?, user_id = ?, published = ? WHERE id = ?",
      [title, content, user_id, published, id]
    );
  }

  async delete(id: number) {
    await db.execute("DELETE FROM posts WHERE id = ?", [id]);
  }
}
