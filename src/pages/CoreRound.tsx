import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Mic, MicOff, Camera, CameraOff, Volume2, VolumeX, 
  Loader2, ArrowLeft, Clock, Briefcase, X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Services
import { azureTTS } from '../services/azureTTSService';
import { whisperService } from '../services/whisperService';
// import { humeAI } from '../services/humeAIService'; // Using direct API instead
import { apiService } from '../services/apiService';
import { openAI, QuestionContext } from '../services/openAIService';
import { resumeService } from '../services/resumeService';
import { getResumeData } from '../services/firebaseResumeService';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface UserExpression {
  isConfident: boolean;
  isNervous: boolean;
  isStruggling: boolean;
  dominantEmotion: string;
  confidenceScore: number;
  emotionBreakdown?: any[];
}

interface ResumeData {
  skills: string[];
  projects: (string | { name?: string; description?: string })[];
  achievements: string[];
  experience: string[];
  education: string[];
}

const CoreRound: React.FC = (): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  
  // Get data from previous round
  const roundDuration = location.state?.roundDuration || 3;
  const previousMessages = location.state?.messages || [];
  const previousExpressions = location.state?.questionExpressions || new Map();
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interview data
  const [messages, setMessages] = useState<Message[]>(previousMessages);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [currentQuestionId, setCurrentQuestionId] = useState<string>('');
  const [resumeData, setResumeData] = useState<ResumeData | null>(location.state?.resumeData || null);
  const [userExpression, setUserExpression] = useState<UserExpression | null>(null);
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [questionExpressions, setQuestionExpressions] = useState<Map<string, UserExpression>>(previousExpressions);
  const [isCapturingExpression, setIsCapturingExpression] = useState<boolean>(false);
  const [currentEmotions, setCurrentEmotions] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [humeApiKey, setHumeApiKey] = useState<string>(
    import.meta.env.VITE_HUME_API_KEY as string
  );

  // Time management
  const [timeRemaining, setTimeRemaining] = useState(roundDuration * 60);
  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const [isInterviewComplete, setIsInterviewComplete] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');

  // Generate conversation ID when component mounts
  useEffect(() => {
    const newConversationId = `core_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setConversationId(newConversationId);
    console.log('[CoreRound] Generated conversation ID:', newConversationId);
  }, []);

  // Load resume data from location state or Firebase
  useEffect(() => {
    const loadResumeData = async () => {
      if (location.state?.resumeData) {
        setResumeData(location.state.resumeData);
        console.log('Loaded resume data from location state:', location.state.resumeData);
      } else if (currentUser) {
        // Fallback to Firebase if not in location state
        try {
          const resumeData = await getResumeData(currentUser.uid);
          if (resumeData) {
            setResumeData(resumeData);
            console.log('Loaded resume data from Firebase:', resumeData);
          }
        } catch (error) {
          console.error('Error loading resume data from Firebase:', error);
        }
      }
    };
    
    loadResumeData();
  }, [location.state, currentUser]);

  // Handle interview completion
  useEffect(() => {
    if (isInterviewComplete) {
      console.log('[CoreRound] Interview completed, collecting data...');
      console.log('[CoreRound] Messages:', messages);
      console.log('[CoreRound] Question expressions:', questionExpressions);
      setShowSummary(true);
    }
  }, [isInterviewComplete, messages, questionExpressions]);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Timer effect
  useEffect(() => {
    if (!isInterviewStarted || isInterviewComplete) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setIsInterviewComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isInterviewStarted, isInterviewComplete]);

  // Start interview
  const startInterview = () => {
    setIsInterviewStarted(true);
    setTimeRemaining(roundDuration * 60);
    startCurrentRound();
  };

  // Start current round
  const startCurrentRound = async () => {
    try {
      setIsLoading(true);
      setError(null); // Clear any previous errors
      
      // Generate first question using API with fallback
      const emotionScore = userExpression ? 
        `${userExpression.dominantEmotion} (confidence: ${userExpression.confidenceScore})` : 
        'neutral (confidence: 0.5)';

      const skills = resumeData?.skills || [];
      const projects = resumeData?.projects || [];

      // Convert project objects to strings for the API
      const projectStrings = projects.map(project => {
        if (typeof project === 'string') {
          return project;
        } else if (typeof project === 'object' && project !== null) {
          return `${project.name || 'Project'}: ${project.description || 'No description'}`;
        }
        return 'Unknown project';
      });

      console.log('Generating core question with emotion:', emotionScore);
      console.log('Resume data:', resumeData);
      console.log('Skills count:', skills.length, 'Skills:', skills);
      console.log('Projects count:', projects.length);
      console.log('Project strings:', projectStrings);
      console.log('Full API request will be:', {
        emotion: emotionScore,
        last_answer: '',
        skills,
        projects: projectStrings,
        round: 'project'
      });
      
      let question: string;
      let questionGenerated = false;
      
      try {
        console.log('[CoreRound] Attempting to call backend API for core round...');
        console.log('[CoreRound] Request data:', {
          emotion: emotionScore,
          last_answer: '',
          skills,
          projects: projectStrings
        });
        const response = await apiService.getProjectQuestion({
          emotion: emotionScore,
          last_answer: '', // Start with empty string for first question
          skills,
          projects: projectStrings,
          round: 'project',
        }, conversationId);
        question = response.question;
        questionGenerated = true;
        console.log('[CoreRound] Backend API success, question:', question);
      } catch (apiError) {
        console.error('[CoreRound] Backend API failed with error:', apiError);
        console.warn('Backend API failed, using local OpenAI service:', apiError);
        try {
          // Fallback to local OpenAI service
          const questionContext: QuestionContext = {
            round: 'core',
            previousQuestions: [],
            userExpression: userExpression,
            resumeData: resumeData
          };
          console.log('Calling local OpenAI service with context:', questionContext);
          question = await openAI.generateQuestion(questionContext);
          questionGenerated = true;
          console.log('Local OpenAI success, question:', question);
        } catch (fallbackError) {
          console.error('Both API and fallback failed:', fallbackError);
          question = "What is the difference between SQL and NoSQL databases?";
          questionGenerated = true;
        }
      }
      
      if (!questionGenerated) {
        throw new Error('Failed to generate question');
      }
      
      setCurrentQuestion(question);
      
      // Generate unique question ID
      const questionId = `core_${Date.now()}`;
      setCurrentQuestionId(questionId);
      
      // Add question to messages
      const questionMessage: Message = {
        id: questionId,
        text: question,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, questionMessage]);
      setPreviousQuestions(prev => [...prev, question]);

      // Start capturing expression for this question
      setIsCapturingExpression(true);
      
      // Capture expression after a short delay to let the question sink in
      setTimeout(() => {
        captureFrame(questionId);
      }, 2000);

      // Speak the question
      try {
        await azureTTS.speak(question, 'core');
      } catch (ttsError) {
        console.warn('TTS failed, continuing without audio:', ttsError);
      }
      
    } catch (error) {
      console.error('Error starting round:', error);
      setError('Failed to start round - please try again');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle user response
  const handleUserResponse = async (transcription: string) => {
    if (!transcription.trim()) return;

    try {
      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        text: transcription,
        sender: 'user',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      // Capture emotion when user responds
      console.log('[CoreRound] User responded, capturing emotion...');
      setIsCapturingExpression(true);
      setTimeout(() => {
        console.log('[CoreRound] Triggering captureFrame for user response with questionId:', currentQuestionId);
        captureFrame(currentQuestionId); // Use stored question ID
      }, 1000);

      // Generate follow-up question using API with fallback
      const emotionScore = userExpression ? 
        `${userExpression.dominantEmotion} (confidence: ${userExpression.confidenceScore})` : 
        'neutral (confidence: 0.5)';

      const skills = resumeData?.skills || [];
      const projects = resumeData?.projects || [];

      // Convert project objects to strings for the API
      const projectStrings = projects.map(project => {
        if (typeof project === 'string') {
          return project;
        } else if (typeof project === 'object' && project !== null) {
          return `${project.name || 'Project'}: ${project.description || 'No description'}`;
        }
        return 'Unknown project';
      });

      let nextQuestion: string;
      try {
        console.log('[CoreRound] Calling backend API for project follow-up...');
        const response = await apiService.getProjectQuestion({
          emotion: emotionScore,
          last_answer: transcription,
          skills,
          projects: projectStrings,
          round: 'project',
        }, conversationId);
        nextQuestion = response.question;
        console.log('[CoreRound] Backend API success, follow-up question:', nextQuestion);
      } catch (apiError) {
        console.warn('Backend API failed for follow-up, using local OpenAI service:', apiError);
        // Fallback to local OpenAI service
        const questionContext: QuestionContext = {
          round: 'core',
          previousQuestions: previousQuestions,
          userExpression: userExpression,
          resumeData: resumeData,
          lastAnswer: transcription
        };
        nextQuestion = await openAI.generateFollowUpQuestion(questionContext, transcription);
      }
      setCurrentQuestion(nextQuestion);
      
      // Add AI response to messages
      const aiMessage: Message = {
        id: Date.now().toString(),
        text: nextQuestion,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      setPreviousQuestions(prev => [...prev, nextQuestion]);

      // Speak the response
      await azureTTS.speak(nextQuestion, 'core');

    } catch (error) {
      console.error('Error handling user response:', error);
      setError('Failed to process response');
    }
  };

  // Handle chat input submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const inputText = chatInput.trim();
    setChatInput(''); // Clear input immediately
    await handleUserResponse(inputText);
  };

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        try {
          const transcription = await whisperService.transcribeAudio(audioBlob);
          await handleUserResponse(transcription);
        } catch (error) {
          console.error('Transcription error:', error);
          setError('Failed to transcribe audio');
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Failed to start recording');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraOn(true);
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setError('Camera access denied. Please allow camera access and try again.');
        } else if (error.name === 'NotFoundError') {
          setError('No camera found. Please connect a camera and try again.');
        } else {
          setError('Failed to start camera. Please try again.');
        }
      }
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraOn(false);
      setUserExpression(null);
    }
  };

  // Capture frame for emotion analysis (only when question is asked)
  const captureFrame = async (questionIdParam?: string) => {
    const targetQuestionId = questionIdParam || currentQuestionId;
    if (!videoRef.current || !canvasRef.current || !isCameraOn || !isCapturingExpression) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    // Convert to blob like in TechnicalRound
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
    });
    
    if (!blob) return;
    console.log('[CoreRound] Image captured, size:', blob.size, "bytes", 'for questionId:', targetQuestionId || '[none]');
    
    try {
      setIsAnalyzing(true);
      console.log("Starting facial analysis...");
      
      // Create a File object from the blob
      const file = new File([blob], "frame.jpg", { type: "image/jpeg" });
      
      // Start inference job
      console.log("Starting inference job...");
      const formData = new FormData();
      formData.append('file', file);
      formData.append('json', JSON.stringify({
        models: { face: {} }
      }));
      
      console.log('Using Hume API Key:', humeApiKey ? 'Key present' : 'No key');
      
      const jobResponse = await fetch('https://api.hume.ai/v0/batch/jobs', {
        method: 'POST',
        headers: { 'X-Hume-Api-Key': humeApiKey },
        body: formData,
      });
      
      if (!jobResponse.ok) {
        const errorText = await jobResponse.text();
        console.error("Job creation error:", errorText);
        throw new Error(`API error: ${jobResponse.status}`);
      }
      
      const jobData = await jobResponse.json();
      const jobId = jobData.job_id;
      console.log("Job created with ID:", jobId);
      
      // Poll for job completion
      let jobStatus = 'RUNNING';
      let attempts = 0;
      const maxAttempts = 30;
      
      console.log("Polling for job completion...");
      while (jobStatus === 'RUNNING' && attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await fetch(`https://api.hume.ai/v0/batch/jobs/${jobId}`, {
          method: 'GET',
          headers: { 'X-Hume-Api-Key': humeApiKey },
        });
        
        if (!statusResponse.ok) {
          console.error("Status check failed:", await statusResponse.text());
          break;
        }
        
        const statusData = await statusResponse.json();
        jobStatus = statusData.state?.status || statusData.status;
        console.log(`Job status (attempt ${attempts}): ${jobStatus}`);
        
        if (jobStatus === 'COMPLETED') {
          console.log("Job completed, waiting before fetching predictions...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Try up to 3 times to get predictions
          let predictionsFound = false;
          for (let predAttempt = 1; predAttempt <= 3; predAttempt++) {
            console.log(`Fetching predictions (attempt ${predAttempt})...`);
            
            const predictionsResponse = await fetch(`https://api.hume.ai/v0/batch/jobs/${jobId}/predictions`, {
              method: 'GET',
              headers: { 
                'X-Hume-Api-Key': humeApiKey,
                'accept': 'application/json; charset=utf-8'
              },
            });
            
            if (!predictionsResponse.ok) {
              console.error(`Predictions fetch failed (attempt ${predAttempt}):`, await predictionsResponse.text());
              if (predAttempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              }
              break;
            }
            
            const predictions = await predictionsResponse.json();
            console.log(`Predictions response (attempt ${predAttempt}):`, predictions);
            
            if (predictions && Array.isArray(predictions) && predictions.length > 0) {
              console.log("Processing predictions structure...");
              
              if (predictions[0].results?.predictions && 
                  Array.isArray(predictions[0].results.predictions) && 
                  predictions[0].results.predictions.length > 0) {
                
                const filePrediction = predictions[0].results.predictions[0];
                console.log("File prediction:", filePrediction);
                
                if (filePrediction.models?.face?.grouped_predictions && 
                    filePrediction.models.face.grouped_predictions.length > 0 &&
                    filePrediction.models.face.grouped_predictions[0].predictions &&
                    filePrediction.models.face.grouped_predictions[0].predictions.length > 0) {
                  
                  const emotions = filePrediction.models.face.grouped_predictions[0].predictions[0].emotions;
                  
                  if (emotions && emotions.length > 0) {
                    console.log("Emotions found:", emotions.length, "emotions");
                    
                    const dominantEmotion = emotions.reduce((max: any, emotion: any) => 
                      emotion.score > max.score ? emotion : max
                    );
                    
                    const expression = {
                      isConfident: dominantEmotion.name === 'Confidence' || dominantEmotion.score > 0.6,
                      isNervous: dominantEmotion.name === 'Doubt' || dominantEmotion.name === 'Frustration' || dominantEmotion.score < 0.4,
                      isStruggling: dominantEmotion.name === 'Confusion' || dominantEmotion.name === 'Frustration' || dominantEmotion.score < 0.3,
                      dominantEmotion: dominantEmotion.name,
                      confidenceScore: Math.round(dominantEmotion.score * 100) / 100,
                      emotionBreakdown: emotions
                    };
                    
                    setUserExpression(expression);
                    setCurrentEmotions(emotions);
                    localStorage.setItem('currentEmotions', JSON.stringify(emotions));
                    
                    console.log('✅ Real Hume AI data received:', expression.dominantEmotion, expression.confidenceScore);
                    
                    if (targetQuestionId) {
                      console.log('[CoreRound] Setting question expression for questionId:', targetQuestionId, expression);
                      setQuestionExpressions(prev => {
                        const newMap = new Map(prev);
                        newMap.set(targetQuestionId, expression);
                        console.log('[CoreRound] Updated questionExpressions map size:', newMap.size);
                        return newMap;
                      });
                    } else {
                      console.log('[CoreRound] No questionId available, not storing expression');
                    }
                    
                    predictionsFound = true;
                  } else {
                    console.log("No emotions array in the prediction");
                  }
                  
                  break;
                } else {
                  console.log("No grouped_predictions in face model results");
                }
              }
            }
            
            if (predAttempt < 3 && !predictionsFound) {
              console.log("Waiting before retrying predictions...");
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
          
          if (!predictionsFound) {
            console.log("Failed to get valid predictions after multiple attempts");
            const fallbackExpression = {
              isConfident: false,
              isNervous: true,
              isStruggling: false,
              dominantEmotion: 'Neutral',
              confidenceScore: 0.5,
              emotionBreakdown: []
            };
            setUserExpression(fallbackExpression);
            console.log('⚠️ Using fallback emotion data (no real face detected)');
          }
          
          break;
        } else if (jobStatus === 'FAILED') {
          console.error("Job failed");
          break;
        }
      }
      
      if (attempts >= maxAttempts) {
        console.log("Max polling attempts reached");
      }
      
    } catch (error: any) {
      console.error('[CoreRound] Error analyzing emotions:', error);
      const fallbackExpression = {
        isConfident: false,
        isNervous: true,
        isStruggling: false,
        dominantEmotion: 'Neutral',
        confidenceScore: 0.5,
        emotionBreakdown: []
      };
      setUserExpression(fallbackExpression);
      console.log('⚠️ Using fallback emotion data due to error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Start/stop emotion analysis (only when capturing)
  useEffect(() => {
    if (isCameraOn && isCapturingExpression) {
      console.log('[CoreRound] Starting emotion capture...');
      const timeout = setTimeout(() => {
        console.log('[CoreRound] Capturing emotion now...');
        captureFrame();
        setIsCapturingExpression(false); // Stop capturing after one capture
        console.log('[CoreRound] Emotion capture completed, stopping...');
      }, 2000); // Wait 2 seconds for user to see/hear the question
      captureIntervalRef.current = timeout;
    } else {
      if (captureIntervalRef.current) {
        console.log('[CoreRound] Clearing emotion capture timeout...');
        clearTimeout(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
    }

    return () => {
      if (captureIntervalRef.current) {
        clearTimeout(captureIntervalRef.current);
      }
    };
  }, [isCameraOn, isCapturingExpression]);

  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isInterviewStarted) {
    return (
      <div className="min-h-screen bg-primary text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center mb-8">
            <h1 className="text-3xl font-bold">Core Round - DBMS, OOPS, OS, System Design</h1>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
            <h2 className="text-2xl font-semibold mb-6">Core Round Setup</h2>
            
            <div className="space-y-6">
              <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">Round Details</h3>
                <p className="text-gray-300">
                  This round focuses on core computer science subjects: Database Management Systems (DBMS), 
                  Object-Oriented Programming (OOP), Operating Systems (OS), and System Design. 
                  Questions will be based on your resume skills and projects.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Duration: {roundDuration} minutes
                </p>
              </div>

              {resumeData && (
                <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2">Your Resume Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {resumeData.skills.map((skill, index) => (
                      <span key={index} className="bg-blue-600 text-white px-2 py-1 rounded text-sm">
                        {typeof skill === 'string' ? skill : JSON.stringify(skill)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={startInterview}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                Start Core Round
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isInterviewComplete) {
    return (
      <div className="min-h-screen bg-primary text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Core Round Complete!</h1>
            <p className="text-xl text-gray-300 mb-8">
              Excellent work! You've completed the core subjects round.
            </p>
            
            <div className="space-y-4">
              <button
                onClick={() => navigate('/hr-round', { 
                  state: { 
                    roundDuration, 
                    resumeData, 
                    messages, 
                    questionExpressions,
                    // Pass forward data from technical round
                    technicalMessages: location.state?.technicalMessages || [],
                    technicalQuestionExpressions: location.state?.technicalQuestionExpressions || [],
                    // Store current round data
                    coreMessages: messages,
                    coreQuestionExpressions: Array.from(questionExpressions.entries())
                  } 
                })}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors mr-4"
              >
                Continue to HR Round
              </button>
              
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary text-white">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Briefcase className="h-6 w-6 text-green-400" />
              <h1 className="text-xl font-semibold">Core Round - DBMS, OOPS, OS, System Design</h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span className="font-mono text-lg">{formatTime(timeRemaining)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Feed */}
          <div className="lg:col-span-1">
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Camera className="h-5 w-5 mr-2" />
                Video Feed
              </h3>
              
              <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                <video
                  ref={videoRef}
                  className="w-full h-64 object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                <canvas
                  ref={canvasRef}
                  className="hidden"
                />
                {!isCameraOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="text-center">
                      <CameraOff className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-400">Camera Off</p>
                      <button
                        onClick={startCamera}
                        className="mt-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        Start Camera
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-2">
                {!isCameraOn ? (
                  <button
                    onClick={startCamera}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Start Camera</span>
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    <CameraOff className="h-4 w-4" />
                    <span>Stop Camera</span>
                  </button>
                )}
              </div>

              {/* Emotion Analysis */}
              <div className="mt-4 p-4 bg-white/5 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Emotion Analysis</h4>
                {isCameraOn ? (
                  userExpression ? (
                    <div className="space-y-3">
                      {/* Detailed Emotion Breakdown */}
                      {userExpression.emotionBreakdown && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-300 mb-2">Emotions:</h4>
                          {userExpression.emotionBreakdown?.slice(0, 5).map((emotion, index) => (
                            <div key={index} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-300">{emotion.name}:</span>
                                <span className="text-white font-medium">{(emotion.score * 100).toFixed(0)}%</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-1.5">
                                <div 
                                  className="bg-gradient-to-r from-green-500 to-blue-500 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${emotion.score * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Summary Status */}
                      <div className="space-y-2 text-sm border-t border-gray-600 pt-2">
                        <div className="flex justify-between">
                          <span>Confidence:</span>
                          <span className={userExpression.isConfident ? 'text-green-400' : 'text-red-400'}>
                            {userExpression.isConfident ? 'High' : 'Low'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <span className={userExpression.isStruggling ? 'text-yellow-400' : 'text-green-400'}>
                            {userExpression.isStruggling ? 'Struggling' : 'Doing Well'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Data Source:</span>
                          <span className="text-blue-400 text-xs">
                            {userExpression.emotionBreakdown && userExpression.emotionBreakdown.length && userExpression.emotionBreakdown.length > 0 ? 'Real Face Detected' : 'Fallback Data'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">
                      {isCapturingExpression ? 'Analyzing emotions...' : 'Turn on camera for emotion analysis'}
                    </p>
                  )
                ) : (
                  <p className="text-gray-400 text-sm">Turn on camera for emotion analysis</p>
                )}
              </div>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-6 h-full flex flex-col">
              <h3 className="text-lg font-semibold mb-4">Interview Chat</h3>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 min-h-0 mb-4 max-h-96">
                <AnimatePresence>
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-4 rounded-lg ${
                          message.sender === 'user'
                            ? 'bg-green-600 text-white'
                            : 'bg-white/10 text-gray-100'
                        }`}
                      >
                        <div className="prose prose-invert max-w-none">
                          <ReactMarkdown>{message.text}</ReactMarkdown>
                        </div>
                        <div className="text-xs opacity-70 mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              {/* Recording Controls - Sticky at bottom */}
              <div className="sticky bottom-0 space-y-4 bg-black/20 backdrop-blur-sm rounded-lg p-4 -mx-2 -mb-2">
                <div className="flex items-center space-x-4">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="flex items-center space-x-2 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    >
                      <Mic className="h-5 w-5" />
                      <span>Start Recording</span>
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="flex items-center space-x-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <MicOff className="h-5 w-5" />
                      <span>Stop Recording</span>
                    </button>
                  )}

                  {isLoading && (
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Generating question...</span>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <form onSubmit={handleChatSubmit} className="flex space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type your response here..."
                    className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                  />
                  <button
                    type="submit"
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interview Complete Summary */}
      {isInterviewComplete && showSummary && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Core Round Complete!</h2>
              <p className="text-gray-400">Round Duration: {roundDuration} minutes</p>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-300 mb-2">Round Statistics</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Questions Asked:</span>
                    <span className="text-white ml-2">{messages.filter(m => m.sender === 'ai').length}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Your Responses:</span>
                    <span className="text-white ml-2">{messages.filter(m => m.sender === 'user').length}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Emotion Captures:</span>
                    <span className="text-white ml-2">{questionExpressions.size}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Confident Moments:</span>
                    <span className="text-white ml-2">{Array.from(questionExpressions.values()).filter(expr => expr.isConfident).length}</span>
                  </div>
                </div>
              </div>

              {questionExpressions.size > 0 && (
                <div className="bg-green-600/20 border border-green-500/50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-300 mb-2">Emotion Analysis</h3>
                  <div className="space-y-2">
                    {Array.from(questionExpressions.entries()).map(([questionId, expression], index) => (
                      <div key={questionId} className="flex justify-between items-center text-sm">
                        <span className="text-gray-300">Question {index + 1}:</span>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            expression.isConfident ? 'bg-green-600/30 text-green-300' :
                            expression.isNervous ? 'bg-red-600/30 text-red-300' :
                            'bg-yellow-600/30 text-yellow-300'
                          }`}>
                            {expression.dominantEmotion} ({Math.round(expression.confidenceScore * 100)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => {
                  console.log('[CoreRound] Navigating to summary with data:', {
                    messagesCount: messages.length,
                    questionExpressionsSize: questionExpressions.size,
                    questionExpressionsData: Array.from(questionExpressions.entries())
                  });
                  
                  navigate('/nerv-summary', { 
                    state: { 
                      summary: 'Core Round completed successfully',
                      messages, 
                      questionExpressions: Array.from(questionExpressions.entries()), // Convert Map to Array
                      resumeData,
                      roundDuration,
                      conversationId,
                      roundType: 'project'
                    } 
                  });
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoreRound;



