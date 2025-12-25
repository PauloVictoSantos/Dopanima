import express from "express";
import cors from "cors";

import postRoutes from "./routes/PostRoutes";
import CategoryRoutes from "./routes/CategoryRoutes";
import PostCategoryRoutes from "./routes/PostCategoryRoutes";
import TagRoutes from "./routes/TagRoutes";
import PostTagRoutes from "./routes/PostTagRoutes";
import CommentRoutes from "./routes/CommentRoutes";

const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

app.use(postRoutes);
app.use(CategoryRoutes);
app.use(PostCategoryRoutes);
app.use(TagRoutes);
app.use(PostTagRoutes);
app.use(CommentRoutes);

const PORT = 3333;
const HOST = "http://localhost";

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em: ${HOST}:${PORT}`);
});

export default app;
