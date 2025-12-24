import express  from "express";
import postRoutes from "./routes/PostRoutes";
import CategoryRoutes from "./routes/CategoryRoutes";
import PostCategoryRoutes from "./routes/PostCategoryRoutes";
import TagRoutes from "./routes/TagRoutes";
import PostTagRoutes from "./routes/PostTagRoutes";
import CommentRoutes from "./routes/CommentRoutes";

const app = express()
app.use(express.json())
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