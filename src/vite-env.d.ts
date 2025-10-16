/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY: string;
  readonly VITE_YOUTUBE_API_KEY?: string;
  readonly VITE_APP_AZURE_OPENAI_API_KEY: string;
  readonly VITE_APP_AZURE_OPENAI_ENDPOINT: string;
  readonly VITE_APP_AZURE_OPENAI_DEPLOYMENT: string;
  readonly VITE_APP_AZURE_OPENAI_API_VERSION: string;
  readonly VITE_APP_AZURE_TTS_API_KEY: string;
  readonly VITE_APP_AZURE_TTS_REGION?: string;
  readonly VITE_APP_AZURE_TTS_ENDPOINT: string;
  readonly VITE_APP_AZURE_WHISPER_API_KEY: string;
  readonly VITE_APP_AZURE_WHISPER_ENDPOINT: string;
  readonly VITE_APP_AZURE_WHISPER_API_VERSION: string;
  readonly VITE_HUME_API_KEY?: string;
  readonly VITE_HUME_SECRET_KEY?: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
