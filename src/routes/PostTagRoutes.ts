import { Router } from "express";
import { PostTagController } from "../controllers/PostTagController";

const routes = Router();
const controller = new PostTagController();

routes.post("/post-tags", controller.create);
routes.get("/post-tags", controller.index);
routes.get("/posts/:postId/tags", controller.show);
routes.delete("/posts/:postId/tags/:tagId", controller.delete);

export default routes;
