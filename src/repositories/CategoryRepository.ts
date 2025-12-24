import { db } from "../db/connection.ts";
import type { Category } from "../models/Category.js";

export class CategoryRepository {
  async create(category: Category) {
    const { name, slug } = category;
    const [result] = await db.execute(
      "INSERT INTO categories (name, slug) VALUES (?, ?)",
      [name, slug]
    );
    return result;
  }

  async findAll() {
    const [rows] = await db.execute(`
  SELECT *
  FROM categories
  ORDER BY name ASC
`);
    return rows;
  }

  async findById(id: number) {
    const [rows] = await db.execute(
      `
  SELECT *
  FROM categories
  WHERE id = ?
  ORDER BY name ASC
`,
      [id]
    );
    return rows;
  }

  async update(id: number, category: Partial<Category>) {
    const { name, slug } = category;
    await db.execute(
      "UPDATE categories SET name = ?, slug = ? WHERE id = ?",
      [name, slug, id]
    );
  }

  async delete(id: number) {
    await db.execute("DELETE FROM categories WHERE id = ?", [id]);
  }
}
