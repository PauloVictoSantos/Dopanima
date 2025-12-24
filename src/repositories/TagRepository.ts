import { db } from "../db/connection.ts";
import { Tag } from "../models/Tag";

export class TagRepository {
  async create(tag: Tag) {
    const { name, slug } = tag;

    const [result] = await db.execute(
      "INSERT INTO tags (name, slug) VALUES (?, ?)",
      [name, slug]
    );

    return result;
  }

  async findAll() {
    const [rows] = await db.execute(
      "SELECT id, name, slug FROM tags ORDER BY name"
    );
    return rows;
  }

  async findById(id: number) {
    const [rows] = await db.execute(
      "SELECT id, name, slug FROM tags WHERE id = ?",
      [id]
    );

    return (rows as any[])[0];
  }

  async findBySlug(slug: string) {
    const [rows] = await db.execute(
      "SELECT id, name, slug FROM tags WHERE slug = ?",
      [slug]
    );

    return (rows as any[])[0];
  }

  async update(id: number, tag: Partial<Tag>) {
    const { name, slug } = tag;

    await db.execute(
      `
      UPDATE tags
      SET name = ?, slug = ?
      WHERE id = ?
      `,
      [name, slug, id]
    );
  }

  async delete(id: number) {
    await db.execute(
      "DELETE FROM tags WHERE id = ?",
      [id]
    );
  }
}
