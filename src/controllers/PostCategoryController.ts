import { request, Request, Response } from "express";
import { PostCategoryRepository } from "../repositories/PostCategoryRepository";

const repository = new PostCategoryRepository();

export class PostCategoryController {
  async create(req: Request, res: Response) {
    const { postId, categoryId } = req.body;

    await repository.create({
      post_id: postId,
      category_id: categoryId,
    });
    return res.status(201).json({ message: "Categoria do Post criado" });
  }

  async index(req: Request, res: Response) {
    const postCategory = await repository.findAll();
    return res.json(postCategory);
  }

  async show(req: Request, res: Response) {
    const postId = Number(req.params.postId);
    const postCategory = await repository.findCategoriesByPost(postId);

    if ((postCategory as any[]).length === 0) {
      return res.status(404).json({ message: "Categoria não encontrada" });
    }

    return res.json(postCategory);
  }

  async delete(req: Request, res: Response) {
    const postId = Number(req.params.postId);
    const categoryId = Number(req.params.categoryId);
  
    await repository.delete(postId, categoryId);
  
    return res.status(204).send();
  }  
}
