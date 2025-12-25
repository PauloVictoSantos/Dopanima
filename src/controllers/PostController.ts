import { Request, Response } from "express";
import { PostRepository } from "../repositories/PostRepository";
import slugify from "slugify";
import { PostCategoryRepository } from "../repositories/PostCategoryRepository";

const repository = new PostRepository();
const postCategoryRepository = new PostCategoryRepository();

export class PostController {
  async create(req: Request, res: Response) {
    const { title, content, cover_image, excerpt, user_id, category_id } = req.body;
  
    if (!category_id) {
      return res.status(400).json({ message: "Categoria é obrigatória" });
    }

    const slug = slugify(title, {
      lower: true,
      strict: true,
    });
  
    const result: any = await repository.create({
      title,
      slug,
      content,
      cover_image,
      excerpt: excerpt ?? null,
      user_id,
    });
    
    const postId = result.insertId;
    
    await postCategoryRepository.create({
      post_id: postId,
      category_id,
    });
  
    return res.status(201).json({ message: "Post criado",   post_id: postId,});
  }
  

  async index(req: Request, res: Response) {
    const posts = await repository.findAll();
    return res.json(posts);
  }

  async show(req: Request, res: Response) {
    const id = Number(req.params.id);
    const post = await repository.findById(id);

    if ((post as any[]).length === 0) {
      return res.status(404).json({ message: "Post não encontrado" });
    }

    return res.json(post);
  }

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    await repository.update(id, req.body);
    return res.json({ message: "Post atualizado" });
  }

  async delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    await repository.delete(id);
    return res.status(204).send();
  }
}
