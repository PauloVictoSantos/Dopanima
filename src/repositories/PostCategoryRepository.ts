import { db } from "../db/connection.ts";
import { PostCategory } from "../models/PostCategory";

export class PostCategoryRepository {
  async create(postCategory: PostCategory) {
    const { post_id, category_id } = postCategory;
    const [result] = await db.execute(
      "INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)",
      [post_id, category_id]
    );
    return result;
  }

  async findAll() {
    const [rows] = await db.execute(`
    SELECT post_id, category_id
    FROM post_categories
`);
    return rows;
  }

  async findCategoriesByPost(postId: number) {
    const [rows] = await db.execute(
      `
    SELECT c.id, c.name, c.slug
    FROM categories c
    JOIN post_categories pc ON pc.category_id = c.id
    WHERE pc.post_id = ?
      `,
      [postId]
    );
    return rows;
  }

  async delete(postId: number, categoryId: number) {
    await db.execute(
      "DELETE FROM post_categories WHERE post_id = ? AND category_id = ?",
      [postId, categoryId]
    );
  }
}
