import { Request, Response } from "express";
import { PostTagRepository } from "../repositories/PostTagRepository";

const repository = new PostTagRepository();

export class PostTagController {
  async create(req: Request, res: Response) {
    const { postId, tagId } = req.body;

    if (!postId || !tagId) {
      return res.status(400).json({
        message: "postId e tagId são obrigatórios"
      });
    }

    await repository.create({
      post_id: postId,
      tag_id: tagId
    });

    return res.status(201).json({
      message: "Tag associada ao post com sucesso"
    });
  }

  async index(req: Request, res: Response) {
    const relations = await repository.findAll();
    return res.json(relations);
  }

  async show(req: Request, res: Response) {
    const postId = Number(req.params.postId);

    const tags = await repository.findTagsByPost(postId);

    if ((tags as any[]).length === 0) {
      return res.status(404).json({
        message: "Nenhuma tag encontrada para este post"
      });
    }

    return res.json(tags);
  }

  async delete(req: Request, res: Response) {
    const postId = Number(req.params.postId);
    const tagId = Number(req.params.tagId);

    await repository.delete(postId, tagId);

    return res.status(204).send();
  }
}
