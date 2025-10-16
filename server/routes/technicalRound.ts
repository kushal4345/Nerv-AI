import express from "express";
import axios from "axios";

// In-memory conversation store to avoid repeating questions within a session
const technicalStore: Map<string, { asked: string[] }> = new Map();

const normalize = (q: string) =>
  (q || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isTooGeneric = (q: string) => /time\s+complexity|space\s+complexity|outline|approach/i.test(q || "");

const router = express.Router();

router.post("/", async (req, res) => {
  const { emotion, last_answer, round } = req.body;
  const conversationId = (req.header('x-conversation-id') || 'default').toString();
  const store = technicalStore.get(conversationId) || { asked: [] };

  // Sanitize candidate answer to avoid undefined/null leaking into prompts
  let sanitizedAnswer = (typeof last_answer === 'string') ? last_answer.trim() : '';
  if (!sanitizedAnswer || sanitizedAnswer.toLowerCase() === 'undefined' || sanitizedAnswer.toLowerCase() === 'null') {
    sanitizedAnswer = 'N/A';
  }

  // Debug logs to verify payload received
  try {
    console.log('[TechnicalRound] Incoming payload:', {
      emotion,
      round,
      rawAnswerType: typeof last_answer,
      rawAnswer: last_answer,
      sanitizedAnswer
    });
  } catch {}

  if (!emotion) {
    return res.status(400).json({ error: "emotion required" });
  }

  try {
    const previouslyAsked = store.asked.slice(-10); // last 10 for prompt brevity
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
            content: `You are a senior technical interviewer specializing in Data Structures and Algorithms (DSA).

INTERVIEW RULES:
1. Ask ONE specific DSA question at a time
2. If last_answer is "N/A" or empty, ask a starting DSA question
3. If last_answer contains content, ask a NEW DSA question (not follow-up on same problem)
4. Adapt difficulty based on emotion and previous answers
5. Vary question types: arrays, strings, trees, graphs, dynamic programming, etc.

QUESTION DIFFICULTY BY EMOTION:
- If emotion contains "nervous" or "low confidence": Ask EASY questions (arrays, basic sorting, simple string problems)
- If emotion contains "confident" or "high confidence": Ask MEDIUM/HARD questions (dynamic programming, complex data structures, optimization)
- If emotion contains "struggling": Ask EASY questions and provide hints

QUESTION VARIETY (ask different types):
- Array problems: Two Sum, Maximum Subarray, Rotate Array
- String problems: Valid Parentheses, Longest Common Subsequence, Anagram
- Tree problems: Binary Tree Traversal, Validate BST, Path Sum
- Graph problems: BFS/DFS, Shortest Path, Cycle Detection
- Dynamic Programming: Fibonacci, Climbing Stairs, House Robber
- Sorting: Merge Sort, Quick Sort, Heap Sort
- Hash Tables: Group Anagrams, First Unique Character

NEVER ask generic questions like "outline your approach", "explain your approach", or "time/space complexity" prompts – always ask a new, concrete problem statement.`
          },
          {
            role: "user",
            content: `Candidate's Last Answer: ${sanitizedAnswer}
Emotion: ${emotion}

MUST DO NOW:
- If Last Answer === N/A: ask an EASY DSA question to begin
- If Last Answer !== N/A: ask a NEW DSA question (different problem type)
- Vary question types: arrays, strings, trees, graphs, DP, etc.
- Adapt difficulty based on emotion

Difficulty progression: Easy → Medium → Hard (based on confidence)

Previously asked questions (do not repeat or paraphrase any of these):
${previouslyAsked.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
          }
        ],
        max_tokens: 200,
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

    // Basic de-dup and anti-generic guard with one retry
    const canonical = normalize(question);
    const collided = previouslyAsked.some(q => normalize(q) === canonical);
    if (!question || collided || isTooGeneric(question)) {
      const retry = await axios.post(
        chatUrl,
        {
          messages: [
            { role: 'system', content: 'Ask a different, specific DSA problem. Avoid any previous topics and avoid meta-questions (approach/complexity). Keep it concise.' },
            { role: 'user', content: `Previously asked (do not repeat): ${previouslyAsked.join(' | ')}. Provide a brand new DSA question.` }
          ],
          max_tokens: 120,
          temperature: 0.9,
        },
        { headers: { "Content-Type": "application/json", "api-key": process.env.AZURE_OPENAI_KEY as string } }
      );
      question = (retry.data.choices?.[0]?.message?.content || question || 'Give Two Sum variant with constraints.').trim();
    }

    // Persist asked question
    store.asked.push(question);
    if (store.asked.length > 50) store.asked.splice(0, store.asked.length - 50);
    technicalStore.set(conversationId, store);

    res.json({ question });
  } catch (err: any) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

export default router;
