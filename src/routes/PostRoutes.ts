import { Router } from "express";
import { PostController } from "../controllers/PostController";


const routes = Router();
const controller = new PostController();


routes.post("/posts", controller.create);
routes.get("/posts", controller.index);
routes.get("/posts/:id", controller.show);
routes.put("/posts/:id", controller.update);
routes.delete("/posts/:id", controller.delete);


export default routes;