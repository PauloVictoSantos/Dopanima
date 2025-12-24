import { Request, Response } from "express";
import { PostRepository } from "../repositories/PostRepository";

const repository = new PostRepository();

export class PostController {
  async create(req: Request, res: Response) {
    const { title, slug, content, user_id } = req.body;

    await repository.create({title, slug, content, user_id,});
    return res.status(201).json({ message: "Post criado" });
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
