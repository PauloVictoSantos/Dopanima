import express  from "express";
import postRoutes from "./routes/PostRoutes";

const app = express()
app.use(express.json())
app.use(postRoutes);


const PORT = 3333;
const HOST = "http://localhost";

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em: ${HOST}:${PORT}`);
});

export default app;

