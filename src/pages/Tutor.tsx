import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { Send, Image as ImageIcon, Mic, Paperclip, Loader2, Play, Square, X, BrainCircuit, FileText, Camera } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { collection, addDoc, serverTimestamp, doc, updateDoc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Modal } from '../components/Modal';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const generateQuizTool: FunctionDeclaration = {
  name: 'generateQuiz',
  description: 'Generates a multiple-choice quiz based on the current study session or provided notes.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'A short, descriptive title for the quiz.' },
      questions: {
        type: Type.ARRAY,
        description: 'A list of multiple-choice questions.',
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: 'The question text.' },
            options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Exactly 4 possible answers.' },
            answer: { type: Type.STRING, description: 'The correct answer (must exactly match one of the options).' },
            explanation: { type: Type.STRING, description: 'A brief explanation of why the answer is correct.' }
          },
          required: ['question', 'options', 'answer', 'explanation']
        }
      }
    },
    required: ['title', 'questions']
  }
};

export const Tutor = () => {
  const { user } = useAuth();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId || null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const closeModal = () => setModalState(prev => ({ ...prev, isOpen: false }));

  const startRecording = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setModalState({
        isOpen: true,
        title: 'Not Supported',
        message: 'Speech recognition is not supported in this browser.'
      });
      return;
    }

    try {
      // Explicitly request microphone permission first
      // This helps in iframe environments where SpeechRecognition might fail with not-allowed
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop the tracks since we just needed to trigger the permission prompt
      stream.getTracks().forEach(track => track.stop());
    } catch (err: any) {
      setModalState({
        isOpen: true,
        title: 'Microphone Access Required',
        message: 'Please allow microphone permissions in your browser or device settings to use voice input.'
      });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setModalState({
          isOpen: true,
          title: 'Microphone Access Required',
          message: 'Please allow microphone permissions in your browser or device settings to use voice input.'
        });
      } else {
        setModalState({
          isOpen: true,
          title: 'Speech Recognition Error',
          message: `An error occurred: ${event.error}`
        });
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    try {
      recognition.start();
    } catch (e: any) {
      setModalState({
        isOpen: true,
        title: 'Speech Recognition Failed',
        message: 'Could not start speech recognition. Please try again or check your browser compatibility.'
      });
      setIsRecording(false);
    }
  };

  // Socratic Tutor System Instruction
  const systemInstruction = `You are StudyBud, an advanced AI tutor. 
Your goal is to help the student learn effectively. You should directly answer the student's questions clearly and accurately.
After providing a clear answer, you can optionally ask a brief follow-up question to check their understanding or encourage deeper thinking.
If the user uploads an image, PDF, or text document, analyze it thoroughly and help them study the material. Explain key concepts found in the document.
If the user asks you to create a quiz or flashcards, use the generateQuiz tool to create it for them, and then tell them the quiz has been generated and they can find it in the Quizzes tab. Ensure you generate the exact number of questions the user requests. If they don't specify, default to 5 questions.`;

  useEffect(() => {
    if (!user || !currentSessionId) return;

    const sessionRef = doc(db, 'studySessions', currentSessionId);
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        setMessages(docSnap.data().messages || []);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `studySessions/${currentSessionId}`);
    });

    return () => unsubscribe();
  }, [user, currentSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        'application/pdf', 'text/plain', 'text/csv', 'text/html', 'text/xml', 'application/rtf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' // .pptx
      ];
      const isValidExtension = file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.pptx');

      if (!file.type.startsWith('image/') && !validTypes.includes(file.type) && !isValidExtension) {
        setModalState({
          isOpen: true,
          title: 'Unsupported File',
          message: 'Please upload an image, PDF, Word (.docx), PowerPoint (.pptx), or plain text file.'
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || !user) return;

    setLoading(true);
    const userMessageContent = input.trim();
    const currentTimestamp = new Date().toISOString();
    
    let newMessages = [...messages];
    
    const userMessageObj: any = {
      role: 'user',
      content: userMessageContent,
      timestamp: currentTimestamp
    };

    if (filePreview) {
      userMessageObj.imageUrl = filePreview;
    } else if (selectedFile) {
      userMessageObj.fileName = selectedFile.name;
    }

    newMessages.push(userMessageObj);
    setMessages(newMessages);
    setInput('');
    setFilePreview(null);
    
    let sid = currentSessionId;

    try {
      if (!sid) {
        const sessionData = {
          userId: user.uid,
          title: userMessageContent.substring(0, 50) || 'New Study Session',
          createdAt: currentTimestamp,
          updatedAt: currentTimestamp,
          messages: newMessages
        };
        const docRef = await addDoc(collection(db, 'studySessions'), sessionData);
        sid = docRef.id;
        setCurrentSessionId(sid);
        navigate(`/tutor/${sid}`, { replace: true });
      } else {
        await updateDoc(doc(db, 'studySessions', sid), {
          messages: newMessages,
          updatedAt: currentTimestamp
        });
      }

      const historyParts = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const currentParts: any[] = [];
      if (userMessageContent) {
        currentParts.push({ text: userMessageContent });
      }

      if (selectedFile) {
        const fileName = selectedFile.name.toLowerCase();
        
        if (fileName.endsWith('.docx')) {
          const arrayBuffer = await selectedFile.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          currentParts.push({ text: `\n\n--- Content of ${selectedFile.name} ---\n${result.value}\n--- End of file ---\n` });
        } else if (fileName.endsWith('.pptx')) {
          const zip = new JSZip();
          const loadedZip = await zip.loadAsync(selectedFile);
          let extractedText = '';
          const slideRegex = /^ppt\/slides\/slide\d+\.xml$/;
          
          for (const [filename, fileData] of Object.entries(loadedZip.files)) {
            if (slideRegex.test(filename)) {
              const xml = await fileData.async('text');
              const matches = xml.match(/<a:t>([^<]*)<\/a:t>/g);
              if (matches) {
                const slideText = matches.map(m => m.replace(/<\/?a:t>/g, '')).join(' ');
                extractedText += `Slide:\n${slideText}\n\n`;
              }
            }
          }
          currentParts.push({ text: `\n\n--- Content of ${selectedFile.name} ---\n${extractedText}\n--- End of file ---\n` });
        } else {
          const base64Data = await fileToBase64(selectedFile);
          currentParts.push({
            inlineData: {
              data: base64Data,
              mimeType: selectedFile.type || 'application/octet-stream'
            }
          });
        }
      }
      
      setSelectedFile(null);

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          ...historyParts,
          { role: 'user', parts: currentParts }
        ],
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: [generateQuizTool] }]
        }
      });

      let aiResponse = response.text || '';
      
      if (response.functionCalls && response.functionCalls.length > 0) {
        const call = response.functionCalls[0];
        if (call.name === 'generateQuiz') {
          const args = call.args as any;
          await addDoc(collection(db, 'quizzes'), {
            userId: user.uid,
            sessionId: sid,
            title: args.title,
            questions: args.questions,
            createdAt: new Date().toISOString()
          });
          aiResponse = "I've generated a quiz for you! You can find it in the Quizzes tab.";
        }
      }

      if (!aiResponse) {
        aiResponse = "I'm sorry, I couldn't process that.";
      }
      
      const aiMessageObj = {
        role: 'model',
        content: aiResponse,
        timestamp: new Date().toISOString()
      };

      const finalMessages = [...newMessages, aiMessageObj];
      setMessages(finalMessages);

      await updateDoc(doc(db, 'studySessions', sid), {
        messages: finalMessages,
        updatedAt: new Date().toISOString()
      });

    } catch (error: any) {
      console.error("Error generating response:", error);
      setModalState({
        isOpen: true,
        title: 'Error',
        message: "Error generating response: " + (error.message || "Unknown error")
      });
      
      // Remove the user message we just added if it failed
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors"
    >
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between transition-colors">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Socratic AI Tutor</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Ask questions, upload notes, or take a photo.</p>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
              <BrainCircuit className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">How can I help you study?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8">Upload a document, photo of your textbook, paste your notes, or just ask a question to start learning.</p>
            
            <div className="grid grid-cols-2 gap-4 w-full">
              <button onClick={() => setInput("Can you help me understand photosynthesis?")} className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-sm transition-all text-left">
                "Help me understand photosynthesis"
              </button>
              <button onClick={() => setInput("I have a math problem I can't solve.")} className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-sm transition-all text-left">
                "I have a math problem I can't solve"
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-sm' 
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-sm shadow-sm'
              }`}>
                {msg.imageUrl && (
                  <img src={msg.imageUrl} alt="Uploaded content" className="max-w-full h-auto rounded-lg mb-3 max-h-64 object-cover" />
                )}
                {msg.fileName && (
                  <div className="flex items-center gap-2 bg-indigo-700/50 p-3 rounded-lg mb-3">
                    <FileText className="w-5 h-5" />
                    <span className="text-sm font-medium">{msg.fileName}</span>
                  </div>
                )}
                <div className={`prose prose-sm max-w-none dark:prose-invert ${msg.role === 'user' ? 'prose-invert' : ''}`}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.role === 'model' && (
                  <button 
                    onClick={() => {
                      const utterance = new SpeechSynthesisUtterance(msg.content);
                      window.speechSynthesis.speak(utterance);
                    }}
                    className="mt-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1 text-xs font-medium"
                  >
                    <Play className="w-3 h-3" /> Listen
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm p-4 shadow-sm flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
              <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">StudyBud is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 transition-colors">
        <div className="max-w-4xl mx-auto relative">
          {(filePreview || selectedFile) && (
            <div className="mb-3 relative inline-block">
              {filePreview ? (
                <img src={filePreview} alt="Preview" className="h-20 w-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm" />
              ) : (
                <div className="h-20 px-4 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm gap-2">
                  <FileText className="w-6 h-6 text-indigo-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 max-w-[150px] truncate">{selectedFile?.name}</span>
                </div>
              )}
              <button 
                onClick={() => { setFilePreview(null); setSelectedFile(null); }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
            <input 
              type="file" 
              accept="image/*,application/pdf,text/plain,text/csv,text/html,text/xml,application/rtf,.docx,.pptx" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
            <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              className="hidden" 
              ref={cameraInputRef}
              onChange={handleFileSelect}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors"
              title="Upload Document or Image"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button 
              onClick={() => cameraInputRef.current?.click()}
              className="p-3 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors"
              title="Take a Photo"
            >
              <Camera className="w-5 h-5" />
            </button>
            
            <button 
              onClick={startRecording}
              className={`p-3 rounded-xl transition-colors ${isRecording ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}`}
              title="Voice Input"
            >
              <Mic className="w-5 h-5" />
            </button>
            
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask a question or paste notes..."
              className="flex-1 max-h-32 min-h-[44px] bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              rows={1}
            />
            
            <button 
              onClick={handleSend}
              disabled={loading || (!input.trim() && !selectedFile)}
              className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <Modal isOpen={modalState.isOpen} onClose={closeModal} title={modalState.title}>
        <p className="text-slate-600 dark:text-slate-300 mb-6">{modalState.message}</p>
        <div className="flex justify-end">
          <button
            onClick={closeModal}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            OK
          </button>
        </div>
      </Modal>
    </motion.div>
  );
};
