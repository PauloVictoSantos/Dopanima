import { Router } from "express";
import { CategoryController } from "../controllers/CategoryController";


const routes = Router();
const controller = new CategoryController();


routes.post("/category", controller.create);
routes.get("/category", controller.index);
routes.get("/category/:id", controller.show);
routes.put("/category/:id", controller.update);
routes.delete("/category/:id", controller.delete);


export default routes;