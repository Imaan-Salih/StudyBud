import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { BrainCircuit, Play, FileText, Plus, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { Modal } from '../components/Modal';
import { withRetry } from '../utils/retryGemini';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const generateQuizTool: FunctionDeclaration = {
  name: 'generateQuiz',
  description: 'Generates a multiple-choice quiz based on the provided document.',
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

export const Quizzes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [showConfigModal, setShowConfigModal] = useState(false);
  
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

  useEffect(() => {
    if (!user) return;

    const quizzesQuery = query(
      collection(db, 'quizzes'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(quizzesQuery, (snapshot) => {
      const quizzesList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }));
      quizzesList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setQuizzes(quizzesList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quizzes');
    });

    return () => unsubscribe();
  }, [user]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

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

    setPendingFile(file);
    setShowConfigModal(true);
    if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input so same file can be selected again
  };

  const generateQuiz = async () => {
    if (!pendingFile || !user) return;
    
    const file = pendingFile;
    setShowConfigModal(false);
    setIsGenerating(true);
    setPendingFile(null);

    try {
      const currentParts: any[] = [];
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        currentParts.push({ text: `\n\n--- Content of ${file.name} ---\n${result.value}\n--- End of file ---\n` });
      } else if (fileName.endsWith('.pptx')) {
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(file);
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
        currentParts.push({ text: `\n\n--- Content of ${file.name} ---\n${extractedText}\n--- End of file ---\n` });
      } else {
        const base64Data = await fileToBase64(file);
        currentParts.push({
          inlineData: {
            data: base64Data,
            mimeType: file.type || 'application/octet-stream'
          }
        });
      }

      currentParts.push({ text: `Please thoroughly analyze the content of this document and generate a structured multiple-choice quiz with EXACTLY ${questionCount} questions based on the key learning concepts within it.` });

      const response = await withRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: currentParts }
        ],
        config: {
          systemInstruction: `You are an expert educational AI. Your single task is to generate a relevant, highly-accurate multiple-choice quiz with exactly ${questionCount} questions based on the document provided. YOU MUST output the quiz using the generateQuiz tool. If you do not use the tool, the request will fail. Important: When generating math or science questions, ALWAYS format mathematical equations, variables, and expressions using standard LaTeX syntax. Use \`$...\$\` for inline math and \`$$...$$\` for block equations.`,
          tools: [{ functionDeclarations: [generateQuizTool] }]
        }
      }));
      
      let quizGenerated = false;

      if (response.functionCalls && response.functionCalls.length > 0) {
        const call = response.functionCalls.find(c => c.name === 'generateQuiz');
        if (call) {
          const args = call.args as any;
          const quizDocRef = await addDoc(collection(db, 'quizzes'), {
            userId: user.uid,
            sessionId: "direct_upload",
            title: args.title,
            questions: args.questions,
            createdAt: new Date().toISOString()
          });
          quizGenerated = true;
          navigate(`/quizzes/${quizDocRef.id}`);
        }
      }

      if (!quizGenerated) {
        setModalState({
          isOpen: true,
          title: 'Quiz Generation Failed',
          message: 'The AI could not generate a quiz from this document. It might not contain enough text or relevant concepts.'
        });
      }

    } catch (error: any) {
      console.error("Error generating quiz directly:", error);

      let errorMessage = error.message || "Unknown error";
      if (errorMessage.includes("503") || errorMessage.includes("high demand") || errorMessage.includes("UNAVAILABLE")) {
        errorMessage = "The AI model is currently experiencing high demand. Please try again in a few moments.";
      } else if (errorMessage.includes("{")) {
        try {
            const jsonPart = errorMessage.substring(errorMessage.indexOf("{"));
            const parsed = JSON.parse(jsonPart);
            if (parsed.error && parsed.error.message) {
                errorMessage = parsed.error.message;
                if (errorMessage.includes("high demand")) {
                    errorMessage = "The AI model is currently experiencing high demand. Please try again in a few moments.";
                }
            }
        } catch (e) {
            // ignore
        }
      }

      setModalState({
        isOpen: true,
        title: errorMessage.includes("high demand") ? 'High Demand' : 'Error',
        message: errorMessage
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 md:p-8 transition-colors"
    >
      <div className="max-w-5xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <BrainCircuit className="w-8 h-8 text-emerald-500" />
              Your Quizzes
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Review and test your knowledge.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
               <input 
                type="file" 
                accept="image/*,application/pdf,text/plain,text/csv,text/html,text/xml,application/rtf,.docx,.pptx" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileSelect}
                disabled={isGenerating}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating}
                className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-70 w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Generate from Document
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        {quizzes.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center max-w-lg mx-auto shadow-sm transition-colors">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No quizzes yet</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8">Generate quizzes from your study sessions in the AI Tutor or upload a document directly to test yourself.</p>
            <div className="flex flex-col gap-3 justify-center items-center">
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-70"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating Quiz...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    Upload Document
                  </>
                )}
              </button>
              <span className="text-slate-400 dark:text-slate-500 text-sm">or</span>
              <Link to="/tutor" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 px-6 py-3 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shadow-sm">
                Go to AI Tutor
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map(quiz => (
              <div key={quiz.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-xl">
                    <BrainCircuit className="w-6 h-6 text-emerald-600" />
                  </div>
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">
                    {quiz.questions?.length || 0} Qs
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">{quiz.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-1 flex-1">
                  Created {new Date(quiz.createdAt).toLocaleDateString()}
                </p>
                <Link to={`/quizzes/${quiz.id}`} className="mt-auto flex items-center justify-center gap-2 w-full bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl font-medium group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/50 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 group-hover:border-emerald-200 dark:group-hover:border-emerald-800 transition-colors">
                  <Play className="w-4 h-4" />
                  Start Quiz
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showConfigModal} onClose={() => { setShowConfigModal(false); setPendingFile(null); }} title="Quiz Configuration">
        <div className="space-y-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Number of Questions
            </label>
            <div className="flex items-center gap-4">
              <input 
                type="range" 
                min="1" 
                max="20" 
                value={questionCount} 
                onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                className="flex-1 accent-emerald-600"
              />
              <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400 w-8 text-center">{questionCount}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              File selected: {pendingFile?.name}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => { setShowConfigModal(false); setPendingFile(null); }}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={generateQuiz}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
          >
            Generate Quiz
          </button>
        </div>
      </Modal>

      <Modal isOpen={modalState.isOpen} onClose={closeModal} title={modalState.title}>
        <p className="text-slate-600 dark:text-slate-300 mb-6">{modalState.message}</p>
        <div className="flex justify-end">
          <button
            onClick={closeModal}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
          >
            OK
          </button>
        </div>
      </Modal>
    </motion.div>
  );
};
