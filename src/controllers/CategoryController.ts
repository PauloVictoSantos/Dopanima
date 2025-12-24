import { Request, Response } from "express";
import { CategoryRepository } from "../repositories/CategoryRepository";

const repository = new CategoryRepository();

export class CategoryController {
  async create(req: Request, res: Response) {
    const { name, slug } = req.body;

    await repository.create({name, slug,});
    return res.status(201).json({ message: "Categoria criada  " });
  }

  async index(req: Request, res: Response) {
    const Category = await repository.findAll();
    return res.json(Category);
  }

  async show(req: Request, res: Response) {
    const id = Number(req.params.id);
    const category = await repository.findById(id);

    if ((category as any[]).length === 0) {
      return res.status(404).json({ message: "Categoria não encontrado" });
    }

    return res.json(category);
  }

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    await repository.update(id, req.body);
    return res.json({ message: "Categoria atualizado" });
  }

  async delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    await repository.delete(id);
    return res.status(204).send();
  }
}
