import express from "express";
import axios from "axios";

// Simple in-memory store to reduce repeats per conversation
const projectStore: Map<string, { asked: string[] }> = new Map();
const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const router = express.Router();

router.post("/", async (req, res) => {
  const { emotion, last_answer, skills, projects, round } = req.body;
  const conversationId = (req.header('x-conversation-id') || 'default').toString();
  const store = projectStore.get(conversationId) || { asked: [] };

  console.log('Project Round API called with:');
  console.log('- Emotion:', emotion);
  console.log('- Round:', round);
  console.log('- Skills:', skills);
  console.log('- Projects:', JSON.stringify(projects, null, 2));
  console.log('- Last Answer:', last_answer);

  if (!emotion || !skills || !projects) {
    return res.status(400).json({ error: "emotion, skills, and projects required" });
  }

  try {
    const previouslyAsked = store.asked.slice(-10);
    const endpointBase = process.env.AZURE_OPENAI_ENDPOINT || process.env.VITE_APP_AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || process.env.VITE_APP_AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || process.env.VITE_APP_AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
    const chatUrl = `${endpointBase}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const response = await axios.post(
      chatUrl,
      {
        messages: [
          {
            role: "system",
            content: `You are a senior engineer conducting a project-based technical interview. 

INTERVIEW RULES:
1. Ask ONE specific question at a time
2. If last_answer is "N/A" or empty, ask a starting project question
3. If last_answer contains content, ask a NEW question (different topic)
4. Vary question types: DBMS, OOPS, OS, System Design, Project Architecture
5. Reference their actual projects and ask about implementation details

QUESTION TYPES TO ROTATE:
- DBMS: Database design, normalization, indexing, transactions
- OOPS: Inheritance, polymorphism, design patterns, SOLID principles
- OS: Memory management, process scheduling, file systems
- System Design: Scalability, load balancing, microservices, caching
- Project Architecture: Technology choices, deployment, monitoring

DIFFICULTY BY EMOTION:
- If emotion contains "nervous": Ask basic project questions
- If emotion contains "confident": Ask advanced architecture questions
- If emotion contains "struggling": Ask simple implementation questions

NEVER ask generic questions like "explain your approach" - ask specific technical questions.`
          },
          {
            role: "user",
            content: `Emotion: ${emotion}.
            Round: ${round}.
            Skills: ${skills.join(", ")}.
            Projects: ${projects.map((p: any) => typeof p === 'string' ? p : JSON.stringify(p)).join(" | ")}.
            Last Answer: ${last_answer || "N/A"}.

Previously asked (do not repeat topics):
${previouslyAsked.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
          }
        ],
        max_tokens: 250,
        temperature: 0.7,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.AZURE_OPENAI_KEY,
        },
      }
    );

    let question: string = (response.data.choices?.[0]?.message?.content || '').trim();
    const collision = previouslyAsked.some(q => norm(q) === norm(question));
    if (!question || collision) {
      const retry = await axios.post(
        chatUrl,
        { messages: [
            { role: 'system', content: 'Ask a different core/CS/project question, new topic.' },
            { role: 'user', content: `Previously asked: ${previouslyAsked.join(' | ')}. Provide a new question.` }
          ], max_tokens: 120, temperature: 0.9 },
        { headers: { 'Content-Type': 'application/json', 'api-key': process.env.AZURE_OPENAI_KEY as string } }
      );
      question = (retry.data.choices?.[0]?.message?.content || question || 'Explain normalization vs denormalization with an example schema.').trim();
    }
    store.asked.push(question);
    if (store.asked.length > 50) store.asked.splice(0, store.asked.length - 50);
    projectStore.set(conversationId, store);
    res.json({ question });
  } catch (err: any) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

export default router;
