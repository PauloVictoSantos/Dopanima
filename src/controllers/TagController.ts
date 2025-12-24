import { Request, Response } from "express";
import { TagRepository } from "../repositories/TagRepository";

const repository = new TagRepository();

export class TagController {
  async create(req: Request, res: Response) {
    const { name, slug } = req.body;

    const tagExists = await repository.findBySlug(slug) 
    if (tagExists) {
      return res.status(400).json({
        message: "Slug já está em uso"
      })
    }

    await repository.create({name, slug,});
    return res.status(201).json({ message: "Tag criada com sucesso" });
  }

  async index(req: Request, res: Response) {
    const Tag = await repository.findAll();
    return res.json(Tag);
  }

  async show(req: Request, res: Response) {
    const id = Number(req.params.id);
    const tag = await repository.findById(id);

    if ((tag as any[]).length === 0) {
      return res.status(404).json({ message: "Tag não encontrado" });
    }

    return res.json(tag);
  }

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    await repository.update(id, req.body);
    return res.json({ message: "Tag atualizado com sucesso" });
  }

  async delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    await repository.delete(id);
    return res.status(204).send();
  }
}
 