import { Router } from "express";
import { PostCategoryController } from "../controllers/PostCategoryController";

const routes = Router();
const controller = new PostCategoryController();

routes.post("/post-category", controller.create);
routes.get("/post-category", controller.index);
routes.get("/posts/:postId/categories", controller.show);
routes.delete("/posts/:postId/categories/:categoryId", controller.delete);

export default routes;