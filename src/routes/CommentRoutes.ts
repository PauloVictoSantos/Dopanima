import { Router } from "express";
import { CommentController } from "../controllers/CommentController";

const routes = Router();
const controller = new CommentController();

routes.post("/comments", controller.create);
routes.get("/comments", controller.index);
routes.get("/posts/:postId/comments", controller.showByPost);
routes.put("/comments/:id", controller.update);
routes.delete("/comments/:id", controller.delete);

export default routes;
