import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { FaVideo } from 'react-icons/fa';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  responseTime?: number;
}


// Declare global variable for audio playing state
declare global {
  interface Window {
    audioPlaying: boolean;
  }
}

// Initialize global variable
if (typeof window !== 'undefined') {
  window.audioPlaying = false;
}

// Function to convert text to speech using Azure TTS
const speakResponse = async (text: string): Promise<void> => {
  if (window.audioPlaying) {
    console.log('Audio already playing, skipping request');
    return;
  }

  try {
    // Set global flag to prevent concurrent speech
    window.audioPlaying = true;

    // Get the Azure TTS API key from environment variables
    const ttsApiKey = import.meta.env.VITE_APP_AZURE_TTS_API_KEY as string;
    const endpoint = `${import.meta.env.VITE_APP_AZURE_TTS_ENDPOINT}/cognitiveservices/v1`;

    // Ensure we have text to convert
    if (!text || text.trim() === '') {
      window.audioPlaying = false;
      return;
    }

    // Create SSML for Azure TTS
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
      <voice name="en-US-AriaNeural">
        <prosody rate="1.0" pitch="0%">
          ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')}
        </prosody>
      </voice>
    </speak>`;

    // Make the API request
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
        'Ocp-Apim-Subscription-Key': ttsApiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'NERV-Interviewer'
      },
      body: ssml
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Azure TTS API error:", errorText);
      console.log("Falling back to browser TTS...");
      window.audioPlaying = false;
      // Fallback to browser TTS
      return fallbackSpeak(text);
    }

    // Get the audio data
    const audioBlob = await response.blob();

    // Create an audio element and play it
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    // Return a promise that resolves when the audio finishes playing
    return new Promise<void>((resolve) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        window.audioPlaying = false;
        resolve();
      };
      audio.play().catch(error => {
        console.error("Error playing audio:", error);
        window.audioPlaying = false;
        resolve();
      });
    });
  } catch (error) {
    console.error("Error in speakResponse:", error);
    console.log("Falling back to browser TTS...");
    window.audioPlaying = false;
    // Fallback to browser TTS
    return fallbackSpeak(text);
  }
};

// Fallback to browser's built-in speech synthesis
function fallbackSpeak(text: string): Promise<void> {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser');
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onend = () => {
      window.audioPlaying = false;
      resolve();
    };
    utterance.onerror = () => {
      window.audioPlaying = false;
      resolve();
    };
    
    speechSynthesis.speak(utterance);
  });
}

const Interview = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const [isInterviewComplete, setIsInterviewComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [isThinking, setIsThinking] = useState(false);
  const [questionExpressions] = useState<Map<string, any>>(new Map());
  const [resumeData, setResumeData] = useState<any>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string }>>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Timer effects
  useEffect(() => {
    if (!isInterviewStarted || isInterviewComplete) return;
    
    const timer = setInterval(() => {
      // Add any timer logic here if needed
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isInterviewStarted, isInterviewComplete]);

  // Load resume data
  useEffect(() => {
    const loadResumeData = async () => {
      if (!currentUser) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.resumeData) {
            setResumeData(userData.resumeData);
          }
        }
      } catch (error) {
        console.error('Error loading resume data:', error);
      }
    };

    loadResumeData();
  }, [currentUser]);

  // Initialize interview
  const startInterview = async () => {
    setIsLoading(true);
    
    try {
      // Start with introduction
      const introduction = "Hello! Welcome to your technical interview. I'll be asking you a series of questions to assess your technical skills and problem-solving abilities. Let's begin with a brief introduction about yourself and your background.";
      
      const introMessage: Message = {
              id: Date.now().toString(),
        text: introduction,
                  sender: 'ai',
                  timestamp: new Date()
                };

      setMessages([introMessage]);
      setCurrentQuestion(introduction);
      setIsInterviewStarted(true);
      
      // Speak the introduction
      await speakResponse(introduction);
      
            } catch (error) {
      console.error('Error starting interview:', error);
        } finally {
      setIsLoading(false);
    }
  };

  // Process user answer
  const processUserAnswer = async (answer: string): Promise<string> => {
    try {
      // Get the Azure OpenAI API key from environment variables
      const azureOpenAIKey = import.meta.env.VITE_APP_AZURE_OPENAI_API_KEY;

      if (!azureOpenAIKey) {
        throw new Error('Azure OpenAI API key not found');
      }

      // Check if this is the first response (introduction)
      const isFirstResponse = messages.length === 1;
      
      // Create a more detailed prompt for follow-up questions
      const prompt = isFirstResponse 
        ? `The candidate has provided their introduction: "${answer}". Based on their background, ask a technical question that's appropriate for their experience level. The question should be challenging but fair, and should test their problem-solving skills. Keep the question concise and clear.`
        : `The candidate answered: "${answer}" to the question: "${currentQuestion}". 
          
          Based on their response, provide feedback and ask a follow-up question. The follow-up should be:
          - More challenging if they answered well
          - A different approach to the same problem if they struggled
          - A new technical concept if they showed good understanding
          
          Your tone should be that of a senior engineer who doesn't waste time with niceties.
          Be critical when the candidate's answer lacks technical depth.
          `;

      // Create messages array that includes recent conversation history for context
      const recentMessages = conversationHistory.slice(-4); // Last 4 messages for context

      const messagesForAPI = [
        {
          role: "system",
          content: `You are a technical interviewer with high standards and a direct personality. You never use phrases like 'thank you', 'that's great', or similar polite but empty phrases. You can respond to the candidate's emotional state based on the data provided.`
        },
        ...recentMessages,
        { role: "user", content: prompt }
      ];

      const response = await fetch(`${import.meta.env.VITE_APP_AZURE_OPENAI_ENDPOINT}/openai/deployments/gpt-4/chat/completions?api-version=2024-02-15-preview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          'api-key': azureOpenAIKey
          },
          body: JSON.stringify({
            messages: messagesForAPI,
          max_tokens: 500,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      // Update conversation history
      setConversationHistory(prev => [
        ...prev,
        { role: "user", content: answer },
        { role: "assistant", content: aiResponse }
      ]);

      return aiResponse;
    } catch (error) {
      console.error('Error processing answer:', error);
      throw error;
    }
  };

  // Handle sending message
  const handleSendMessage = async () => {
    if (!userInput.trim() || isThinking) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: userInput,
      sender: 'user',
      timestamp: new Date()
    };

      setMessages(prev => [...prev, userMessage]);
      setUserInput('');
      setIsThinking(true);

      try {
        const response = await processUserAnswer(userInput);
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: response,
          sender: 'ai',
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);
        setCurrentQuestion(response);
        
        // Speak the response
        await speakResponse(response);
      
    } catch (error) {
      console.error('Error processing answer:', error);
    } finally {
      setIsThinking(false);
    }
  };

  // Generate interview results
  const generateInterviewResults = () => {
    const totalQuestions = messages.filter(m => m.sender === 'ai').length;
    const avgResponseTime = messages
      .filter(m => m.sender === 'user' && m.responseTime)
      .reduce((sum, m) => sum + (m.responseTime || 0), 0) / Math.max(1, messages.filter(m => m.sender === 'user').length);

    return {
      summary: `Interview completed with ${totalQuestions} questions. Average response time: ${avgResponseTime.toFixed(1)}s.`,
      totalQuestions,
      avgResponseTime,
      messages
    };
  };

  // Complete interview
  const completeInterview = () => {
    setIsInterviewComplete(true);
    const results = generateInterviewResults();
    
    // Navigate to results page with interview data
    navigate('/nerv-summary');
  };

  // Determine if send button should be disabled
  const isSendDisabled = !userInput.trim() || isThinking;

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Loading screen */}
      {isLoading && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
            <h2 className="text-xl font-semibold text-white mt-4">Preparing Your Interview</h2>
            <p className="text-gray-300 mt-2">Analyzing your resume and generating personalized questions...</p>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-black flex flex-col h-screen overflow-hidden">
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .pulse-animation {
            animation: pulse 2s infinite;
          }
        `}</style>

        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back to Dashboard</span>
                </button>
              <div className="h-6 w-px bg-gray-600" />
              <h1 className="text-xl font-semibold text-white">Technical Interview</h1>
                </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-gray-300 text-sm">Recording</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Video Area */}
          <div className="relative bg-gray-800 flex-1 flex items-center justify-center">
            {isCameraOn ? (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas
                  ref={canvasRef}
                  className="hidden"
                />
                <div className="absolute top-4 right-4 bg-black bg-opacity-50 rounded-lg p-3">
                  <div className="flex items-center space-x-2 text-white">
                    <div className="w-3 h-3 bg-red-500 rounded-full pulse-animation"></div>
                    <span className="text-sm">Live</span>
                </div>
                  </div>
                        </div>
            ) : (
              <div className="text-center">
                <FaVideo className="h-24 w-24 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Camera is off</p>
                    <button
                  onClick={() => setIsCameraOn(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Turn On Camera
                    </button>
                  </div>
            )}
            </div>

          {/* Chat Area */}
          <div className="bg-gray-900 border-t border-gray-700 p-6">
            <div className="max-w-4xl mx-auto">
              {/* Messages */}
              <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                {messages.map((message) => (
                        <div
                          key={message.id}
                    className={`flex ${message.sender === 'ai' ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.sender === 'ai'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-white'
                      }`}
                    >
                      <div className="prose prose-invert max-w-none">
                        <ReactMarkdown>{message.text}</ReactMarkdown>
                                  </div>
                      <div className="text-xs opacity-70 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString()}
                                  </div>
                          </div>
                        </div>
                      ))}
                      {isThinking && (
                        <div className="flex justify-start">
                    <div className="bg-blue-600 text-white px-4 py-2 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Thinking...</span>
                              </div>
                          </div>
                        </div>
                      )}
                              </div>

              {/* Input Area */}
              <div className="flex space-x-4">
                <div className="flex-1">
                        <input
                          type="text"
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type your answer here..."
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                    disabled={isThinking}
                  />
                </div>
                        <button
                  onClick={handleSendMessage}
                          disabled={isSendDisabled}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                  Send
                        </button>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center space-x-4 mt-6">
                {!isInterviewStarted ? (
                      <button
                    onClick={startInterview}
                    className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                      >
                    Start Interview
                      </button>
                ) : (
                          <button
                    onClick={completeInterview}
                    className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Complete Interview
                          </button>
                      )}
                        </div>
                                  </div>
                                </div>
                        </div>

        {/* Interview Complete Modal */}
        {isInterviewComplete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-2xl mx-4">
              <h2 className="text-2xl font-bold mb-4">Interview Complete!</h2>
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown>{generateInterviewResults().summary}</ReactMarkdown>
                        </div>
              <div className="mt-6 flex space-x-4">
                <button
                  onClick={() => navigate('/nerv-summary')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  View Detailed Results
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  Back to Dashboard
                </button>
                    </div>
                      </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Interview;