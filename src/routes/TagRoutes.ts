import { Router } from "express";
import { TagController } from "../controllers/TagController";

const routes = Router();
const controller = new TagController();

routes.post("/tags", controller.create);
routes.get("/tags", controller.index);
routes.get("/tags/:id", controller.show);
routes.put("/tags/:id", controller.update);
routes.delete("/tags/:id", controller.delete);

export default routes;
