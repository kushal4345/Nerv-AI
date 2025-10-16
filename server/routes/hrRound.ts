import express from "express";
import axios from "axios";

// In-memory de-dupe per conversation for HR questions
const hrStore: Map<string, { asked: string[] }> = new Map();
const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const router = express.Router();

router.post("/", async (req, res) => {
  const { emotion, last_answer, achievements, experiences, round } = req.body;
  const conversationId = (req.header('x-conversation-id') || 'default').toString();
  const store = hrStore.get(conversationId) || { asked: [] };

  console.log('HR Round API called with:');
  console.log('- Emotion:', emotion);
  console.log('- Round:', round);
  console.log('- Achievements:', JSON.stringify(achievements, null, 2));
  console.log('- Experiences:', JSON.stringify(experiences, null, 2));
  console.log('- Last Answer:', last_answer);

  if (!emotion || !achievements || !experiences) {
    return res.status(400).json({ error: "emotion, achievements, and experiences required" });
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
            content: `You are an HR interviewer conducting a professional behavioral interview.

INTERVIEW RULES:
1. Ask ONE specific HR question at a time
2. If last_answer is "N/A" or empty, ask a starting HR question
3. If last_answer contains content, ask a NEW question (different behavioral topic)
4. Vary question types: leadership, teamwork, problem-solving, conflict resolution, growth
5. Reference their specific achievements and experiences

QUESTION TYPES TO ROTATE:
- Leadership: Team management, decision making, mentoring
- Teamwork: Collaboration, communication, conflict resolution
- Problem-solving: Challenges faced, creative solutions, learning
- Growth: Learning new skills, career development, feedback
- Work ethics: Pressure situations, deadlines, quality standards
- Communication: Presentations, difficult conversations, stakeholder management

DIFFICULTY BY EMOTION:
- If emotion contains "nervous": Ask basic background questions
- If emotion contains "confident": Ask complex leadership scenarios
- If emotion contains "struggling": Ask supportive growth questions

SAMPLE QUESTION VARIATIONS:
- "Tell me about a time when you had to work under pressure. How did you handle it?"
- "Describe a situation where you had to lead a team. What was the outcome?"
- "Can you share an example of a challenging project and how you overcame obstacles?"
- "Tell me about a time when you had to learn something new quickly. How did you approach it?"
- "Describe a situation where you had to work with a difficult team member. How did you handle it?"
- "What's the most significant achievement you're proud of and why?"

NEVER ask generic questions - ask specific behavioral questions with clear scenarios.`
          },
          {
            role: "user",
            content: `Emotion: ${emotion}.
            Round: ${round}.
            Achievements: ${achievements.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(" | ")}.
            Experiences: ${experiences.map(e => typeof e === 'string' ? e : JSON.stringify(e)).join(" | ")}.
            Last Answer: ${last_answer || "N/A"}.

Previously asked (avoid repeating themes):
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
    const collision = previouslyAsked.some(q => norm(q) === norm(question));
    if (!question || collision) {
      const retry = await axios.post(
        chatUrl,
        { messages: [
            { role: 'system', content: 'Ask a different HR/behavioral question on a new theme. Be specific.' },
            { role: 'user', content: `So far asked: ${previouslyAsked.join(' | ')}. Provide a new scenario-based HR question.` }
          ], max_tokens: 120, temperature: 0.9 },
        { headers: { 'Content-Type': 'application/json', 'api-key': process.env.AZURE_OPENAI_KEY as string } }
      );
      question = (retry.data.choices?.[0]?.message?.content || question || 'Tell me about a time you had to resolve a team conflict.').trim();
    }
    store.asked.push(question);
    if (store.asked.length > 50) store.asked.splice(0, store.asked.length - 50);
    hrStore.set(conversationId, store);
    res.json({ question });
  } catch (err: any) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

export default router;
