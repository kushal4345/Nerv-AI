<div align="center">

<img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=0A0A0A" alt="React" />
<img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite" />
<img src="https://img.shields.io/badge/TailwindCSS-3-38BDF8?logo=tailwindcss&logoColor=white" alt="TailwindCSS" />
<img src="https://img.shields.io/badge/Azure%20OpenAI-GPT--4.x-0078D4?logo=microsoftazure&logoColor=white" alt="Azure OpenAI" />
<img src="https://img.shields.io/badge/Firebase-Auth%20%7C%20Storage-FFCA28?logo=firebase&logoColor=0A0A0A" alt="Firebase" />

<h1>NERV – AI Interview Simulator</h1>
<p>An immersive, multi-round AI interview experience with real‑time emotion analysis, speech interaction, and personalized feedback.</p>

<p>
  <a href="#quick-start"><strong>Quick Start</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#configuration"><strong>Configuration</strong></a> ·
  <a href="#scripts"><strong>Scripts</strong></a> ·
  <a href="#architecture"><strong>Architecture</strong></a>
</p>
</div>

---

### Demo

<p align="center">
  <img src="src/utils/Screenshot%20(851).png" alt="NERV Interview Performance Dashboard" />
</p>

<p align="center">
  <img src="src/utils/Screenshot%20(852).png" alt="NERV Comprehensive Interview Analysis Report" />
</p>

<p align="center">
  <img src="src/utils/Screenshot%20(853).png" alt="NERV Suggested Resources and Skill Gaps" />
</p>

<p align="center"><em>The system highlights your weaker topics and suggests concise, high‑quality resources to close the gap quickly.</em></p>

---

### Features

- **Multi‑Round Interviews**: Technical (DSA), Core (DBMS/OOPS/OS/Design), HR.
- **Adaptive Questions**: Context- and emotion-aware prompts via Azure OpenAI.
- **Voice In/Out**: Whisper transcription + Azure TTS responses.
- **Emotion Analytics**: Hume AI face signals visualized per question.
- **Resume‑Aware**: Fetches skills/projects to tailor questions.
- **Clean UI**: Responsive, modern interface built with Tailwind.

### Retrieval-Augmented Generation (RAG)

All three rounds use RAG tailored to each round’s objective to select or craft the next best question:

- Technical Round: retrieves DSA problem contexts (arrays, strings, trees, graphs, DP) and varies difficulty based on recent answers and detected confidence.
- Project/Core Round: retrieves topics from resume-aligned domains (DBMS/OOPS/OS/System Design) and from project descriptions to ask specific, non-repetitive questions.
- HR Round: retrieves behavioral scenarios (leadership, teamwork, conflict resolution, growth) and adapts question themes to the candidate’s emotional signals.

Each round blends recent conversation history, emotion cues, and relevant retrieved snippets to avoid repetition and keep the interview progressive and contextual.

### Tech Stack

- Frontend: React + TypeScript + Vite + TailwindCSS
- AI: Azure OpenAI (chat, whisper), Azure Speech, Hume AI
- Auth/Storage: Firebase
- Server: Express (TypeScript) for question routing

---

### Quick Start

1) Install dependencies
```bash
npm install
```

2) Create `.env` in `NERV/`
```bash
# Azure OpenAI (client)
VITE_APP_AZURE_OPENAI_API_KEY=
VITE_APP_AZURE_OPENAI_ENDPOINT=
VITE_APP_AZURE_OPENAI_DEPLOYMENT=
VITE_APP_AZURE_OPENAI_API_VERSION=2025-01-01-preview

# Azure Speech (TTS)
VITE_APP_AZURE_TTS_API_KEY=
VITE_APP_AZURE_TTS_REGION=eastus
VITE_APP_AZURE_TTS_ENDPOINT=https://eastus.api.cognitive.microsoft.com

# Azure Whisper (STT)
VITE_APP_AZURE_WHISPER_API_KEY=
VITE_APP_AZURE_WHISPER_ENDPOINT=
VITE_APP_AZURE_WHISPER_API_VERSION=2024-06-01

# Hume AI
VITE_HUME_API_KEY=

# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=

# (Server) Azure OpenAI
AZURE_OPENAI_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_DEPLOYMENT=
AZURE_OPENAI_API_VERSION=2025-01-01-preview
```

3) Run the app (client + server)
```bash
# client (from NERV/)
npm run dev

# server (from NERV/server/)
npm install
npm run dev
```

---

### Scripts

```bash
# Client (NERV/)
npm run dev           # start Vite dev server
npm run build         # build for production
npm run preview       # preview production build

# Server (NERV/server/)
npm run dev           # start Express (ts-node)
npm run build         # compile TypeScript
npm start             # run compiled server
```

---

### Configuration

- Environment variables are required. See the `.env` example above.
- `.env` is already git‑ignored. Do not commit keys.
- Server reads `AZURE_OPENAI_*`; client uses `VITE_*`.

---

### Architecture

```text
Client (React/Vite)
  ├─ pages/: Technical/Core/HR rounds
  ├─ services/: openAI, whisper, TTS, Hume, Firebase
  └─ lib/: firebase app init

Server (Express/TypeScript)
  ├─ routes/technicalRound.ts
  ├─ routes/projectRound.ts
  └─ routes/hrRound.ts

Providers
  ├─ Azure OpenAI: question generation + whisper
  ├─ Azure Speech: text-to-speech
  └─ Hume AI: emotion analysis
```

---

### Project Structure

```text
NERV/
├─ public/
├─ src/
│  ├─ components/
│  ├─ contexts/
│  ├─ lib/
│  ├─ pages/
│  ├─ services/
│  └─ main.tsx
├─ server/
│  ├─ routes/
│  └─ index.ts
├─ package.json
└─ vercel.json
```

---

### Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/awesome`
3. Commit: `git commit -m "feat: add awesome thing"`
4. Push: `git push origin feat/awesome`
5. Open a Pull Request

---

### License

MIT License. See `LICENSE` for details.

---

### Acknowledgements

- Microsoft Azure OpenAI & Speech
- Firebase
- Hume AI