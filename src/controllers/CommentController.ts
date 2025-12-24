import { Request, Response } from "express";
import { CommentRepository } from "../repositories/CommentRepository";

const repository = new CommentRepository();

export class CommentController {
  async create(req: Request, res: Response) {
    const { content, userId, postId } = req.body;

    if (!content || !userId || !postId) {
      return res.status(400).json({
        message: "content, userId e postId são obrigatórios"
      });
    }

    await repository.create({
      content,
      user_id: userId,
      post_id: postId
    });

    return res.status(201).json({
      message: "Comentário criado com sucesso"
    });
  }

  async index(req: Request, res: Response) {
    const comments = await repository.findAll();
    return res.json(comments);
  }

  async showByPost(req: Request, res: Response) {
    const postId = Number(req.params.postId);

    const comments = await repository.findByPost(postId);

    return res.json(comments);
  }

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        message: "Conteúdo é obrigatório"
      });
    }

    const comment = await repository.findById(id);
    if (!comment) {
      return res.status(404).json({
        message: "Comentário não encontrado"
      });
    }

    await repository.update(id, content);

    return res.json({
      message: "Comentário atualizado com sucesso"
    });
  }

  async delete(req: Request, res: Response) {
    const id = Number(req.params.id);

    const comment = await repository.findById(id);
    if (!comment) {
      return res.status(404).json({
        message: "Comentário não encontrado"
      });
    }

    await repository.delete(id);

    return res.status(204).send();
  }
}
