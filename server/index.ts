import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import technicalRound from "./routes/technicalRound";
import projectRound from "./routes/projectRound";
import hrRound from "./routes/hrRound";

dotenv.config();

// Ensure Azure OpenAI key is provided via environment variables
if (!process.env.AZURE_OPENAI_KEY) {
  console.warn('AZURE_OPENAI_KEY is not set. Set it in the environment before starting the server.');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/technical", technicalRound);
app.use("/api/project", projectRound);
app.use("/api/hr", hrRound);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Interview API Server is running" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
});
