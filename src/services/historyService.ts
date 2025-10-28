import { 
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  orderBy,
  query,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface EmotionItem {
  name: string;
  score: number;
}

export interface InterviewEmotionEntry {
  question: string;
  answer: string;
  emotions: EmotionItem[];
  timestamp: string;
  responseTime?: number;
  isFollowUp?: boolean;
}

export interface InterviewResultDoc {
  id?: string;
  summary?: string;
  emotionsData: InterviewEmotionEntry[];
  transcriptions: string[];
  timestamp: string; // ISO string
}

const collectionPath = (userId: string) => collection(db, 'users', userId, 'interviews');

export async function saveInterviewResult(
  userId: string,
  result: Omit<InterviewResultDoc, 'id'>
): Promise<string> {
  const col = collectionPath(userId);
  const payload = {
    ...result,
    createdAt: Timestamp.now()
  };
  const ref = await addDoc(col, payload);
  return ref.id;
}

export async function getInterviewHistory(userId: string): Promise<InterviewResultDoc[]> {
  const q = query(collectionPath(userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

export async function getInterviewById(userId: string, interviewId: string): Promise<InterviewResultDoc | null> {
  const ref = doc(db, 'users', userId, 'interviews', interviewId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) };
}

export async function deleteInterviewById(userId: string, interviewId: string): Promise<void> {
  const ref = doc(db, 'users', userId, 'interviews', interviewId);
  await deleteDoc(ref);
}


