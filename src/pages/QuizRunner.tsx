import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CheckCircle2, XCircle, RefreshCcw, Loader2, Sparkles, Download, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { withRetry } from '../utils/retryGemini';
import { preprocessLaTeX } from '../utils/latex';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY || 'missing_key' 
});

const generateQuizTool: FunctionDeclaration = {
  name: 'generateQuiz',
  description: 'Generates a multiple-choice quiz.',
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

export const QuizRunner = () => {
  const { quizId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [isGeneratingNew, setIsGeneratingNew] = useState(false);
  const [resultSaved, setResultSaved] = useState(false);

  useEffect(() => {
    if (!user || !quizId) return;

    const fetchQuiz = async () => {
      try {
        const docRef = doc(db, 'quizzes', quizId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().userId === user.uid) {
          setQuiz({ id: docSnap.id, ...docSnap.data() });
        } else {
          navigate('/quizzes');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `quizzes/${quizId}`);
      }
    };

    fetchQuiz();
  }, [user, quizId, navigate]);

  // Reset state when quiz changes (e.g. from new generation)
  useEffect(() => {
    setCurrentQuestion(0);
    setUserAnswers({});
    setIsFinished(false);
    setResultSaved(false);
  }, [quiz?.id]);

  if (!quiz) {
    return <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const handleAnswer = (option: string) => {
    if (userAnswers[currentQuestion]) return;
    setUserAnswers(prev => ({ ...prev, [currentQuestion]: option }));
  };

  const nextQuestion = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(c => c + 1);
    } else {
      finishQuiz();
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(c => c - 1);
    }
  };

  const finishQuiz = async () => {
    setIsFinished(true);
    if (!resultSaved && user && quiz) {
      let score = 0;
      quiz.questions.forEach((q: any, i: number) => {
        const userAns = userAnswers[i];
        if (userAns && String(userAns).trim() === String(q.answer).trim()) {
          score++;
        }
      });
      try {
        await addDoc(collection(db, 'quizResults'), {
          userId: user.uid,
          quizId: quiz.id,
          title: quiz.title,
          score,
          total: quiz.questions.length,
          timestamp: serverTimestamp()
        });
        setResultSaved(true);
      } catch (error) {
        console.error("Failed to save quiz result", error);
      }
    }
  };

  const restart = () => {
    setCurrentQuestion(0);
    setUserAnswers({});
    setIsFinished(false);
    setResultSaved(false);
  };

  const generateNewQuiz = async () => {
    if (!user || !quiz) return;
    setIsGeneratingNew(true);
    try {
      const existingQs = quiz.questions.map((q: any) => q.question).join('\n- ');
      const prompt = `Create a new multiple-choice quiz with ${quiz.questions.length} questions on the same general topic as this quiz: "${quiz.title}". 
Do NOT repeat the following questions:
- ${existingQs}`;

      const response = await withRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: `You are an expert educational AI. Your single task is to generate a relevant, highly-accurate multiple-choice quiz with exactly ${quiz.questions.length} questions. YOU MUST output the quiz using the generateQuiz tool. If you do not use the tool, the request will fail. Important: When generating math or science questions, ALWAYS format mathematical equations, variables, and expressions using standard LaTeX syntax. Use \`$...\$\` for inline math and \`$$...$$\` for block equations.`,
          tools: [{ functionDeclarations: [generateQuizTool] }]
        }
      }));

      if (response.functionCalls && response.functionCalls.length > 0) {
        const call = response.functionCalls.find(c => c.name === 'generateQuiz');
        if (call) {
          const args = call.args as any;
          const quizDocRef = await addDoc(collection(db, 'quizzes'), {
            userId: user.uid,
            sessionId: quiz.sessionId || "direct_upload",
            title: args.title,
            questions: args.questions,
            createdAt: new Date().toISOString()
          });
          navigate(`/quizzes/${quizDocRef.id}`);
        }
      }
    } catch (error: any) {
      console.error("Failed to generate new quiz:", error);
      let errorMessage = error.message || "Unknown error";
      if (errorMessage.includes("503") || errorMessage.includes("high demand") || errorMessage.includes("UNAVAILABLE")) {
        errorMessage = "The AI is currently experiencing high demand. Please try again in a few moments.";
      } else if (errorMessage.includes("{")) {
        try {
            const jsonPart = errorMessage.substring(errorMessage.indexOf("{"));
            const parsed = JSON.parse(jsonPart);
            if (parsed.error && parsed.error.message) {
                errorMessage = parsed.error.message;
                if (errorMessage.includes("high demand")) {
                    errorMessage = "The AI is currently experiencing high demand. Please try again in a few moments.";
                }
            }
        } catch (e) {
            // ignore
        }
      }
      alert(errorMessage);
    } finally {
      setIsGeneratingNew(false);
    }
  };

  const hasAnsweredCurrent = !!userAnswers[currentQuestion];
  const selectedAnswer = userAnswers[currentQuestion];
  const question = quiz.questions[currentQuestion];
  
  let score = 0;
  quiz.questions.forEach((q: any, i: number) => {
    const userAns = userAnswers[i];
    if (userAns && String(userAns).trim() === String(q.answer).trim()) {
      score++;
    }
  });

  if (isFinished) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 md:p-6 transition-colors print:bg-white print:p-0">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm text-center border border-slate-200 dark:border-slate-700 transition-colors print:shadow-none print:border-none print:p-0">
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6 print:hidden">
              <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 print:text-black">{quiz.title} - Complete!</h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg mb-8 print:text-black print:mb-4">Score: {score} / {quiz.questions.length}</p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 print:hidden">
              <button 
                onClick={restart} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-6 py-3 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                disabled={isGeneratingNew}
              >
                <RefreshCcw className="w-5 h-5" />
                Retry Quiz
              </button>
              <button 
                onClick={generateNewQuiz} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-70"
                disabled={isGeneratingNew}
              >
                {isGeneratingNew ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                New Questions
              </button>
              <button 
                onClick={() => navigate('/quizzes')} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-6 py-3 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                disabled={isGeneratingNew}
              >
                <ArrowLeft className="w-5 h-5" />
                Quizzes
              </button>
            </div>
          </div>

          <div className="space-y-4 print:space-y-6">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white ml-2 print:text-black">Review</h3>
            {quiz.questions.map((q: any, i: number) => {
              const uAns = userAnswers[i];
              const isCorrect = uAns && String(uAns).trim() === String(q.answer).trim();
              const isUnanswered = !uAns;
              return (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border-l-4 shadow-sm print:break-inside-avoid print:shadow-none print:border print:border-slate-200" style={{ borderLeftColor: isCorrect ? '#10b981' : isUnanswered ? '#94a3b8' : '#ef4444' }}>
                  <div className="font-semibold text-lg text-slate-900 dark:text-white mb-4 prose prose-sm max-w-none dark:prose-invert print:text-black">
                    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(`${i + 1}. ${q.question}`)}</ReactMarkdown>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                       {/* Only show "Your Answer" area in print if it's not a generic printout. Actually showing both is good. */}
                      <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Your Answer</span>
                      <div className="mt-1 font-medium flex items-center gap-2 prose prose-sm max-w-none dark:prose-invert print:text-black [&>p]:m-0 min-w-0 flex-wrap">
                        {isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : isUnanswered ? null : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        <div className={isCorrect ? 'text-emerald-600 print:text-black' : isUnanswered ? 'text-slate-400 print:text-black' : 'text-red-600 print:text-black'}>
                          {uAns ? <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(uAns as string)}</ReactMarkdown> : <span className="italic">Not answered</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Correct Answer</span>
                      <div className="mt-1 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2 prose prose-sm max-w-none dark:prose-invert print:text-black [&>p]:m-0 min-w-0 flex-wrap">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(q.answer)}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 bg-slate-50 dark:bg-slate-900/50 print:bg-transparent p-4 rounded-xl text-slate-700 dark:text-slate-300 print:text-black">
                    <span className="font-medium text-sm text-slate-500 uppercase tracking-wider block mb-1">Explanation</span>
                    <div className="prose prose-sm max-w-none dark:prose-invert print:text-black">
                      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(q.explanation)}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 md:p-8 transition-colors flex flex-col pt-safe pb-safe"
    >
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate('/quizzes')} className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          
          <button onClick={finishQuiz} className="text-slate-500 font-medium hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors">
            End
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{quiz.title}</h1>
          <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 px-4 py-1.5 rounded-full font-medium text-sm self-start md:self-auto whitespace-nowrap">
            Question {currentQuestion + 1} of {quiz.questions.length}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full mb-8 overflow-hidden shrink-0">
          <div 
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
          />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200 dark:border-slate-700 mb-6 transition-colors">
          <div className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white mb-8 leading-relaxed prose prose-lg max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(question.question)}</ReactMarkdown>
          </div>

          <div className="space-y-3">
            {question.options.map((option: string, idx: number) => {
              const isSelected = selectedAnswer && String(selectedAnswer).trim() === String(option).trim();
              const isCorrect = option && String(option).trim() === String(question.answer).trim();
              
              let buttonClass = "w-full text-left p-4 rounded-2xl border-2 transition-all ";
              
              if (!hasAnsweredCurrent) {
                buttonClass += "border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-700 dark:text-slate-300";
              } else {
                if (isCorrect) {
                  buttonClass += "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-400";
                } else if (isSelected) {
                  buttonClass += "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-400";
                } else {
                  buttonClass += "border-slate-200 dark:border-slate-700 opacity-50 text-slate-500 dark:text-slate-400";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(option)}
                  disabled={hasAnsweredCurrent}
                  className={buttonClass}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-medium text-lg prose prose-sm max-w-none dark:prose-invert [&>p]:m-0 flex-1 text-left min-w-0 flex-wrap">
                      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(option)}</ReactMarkdown>
                    </div>
                    {hasAnsweredCurrent && isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />}
                    {hasAnsweredCurrent && isSelected && !isCorrect && <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {hasAnsweredCurrent && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl p-6 mb-6 animate-in fade-in slide-in-from-bottom-4 transition-colors">
            <h3 className="font-bold text-indigo-900 dark:text-indigo-400 mb-2">Explanation</h3>
            <div className="text-indigo-800 dark:text-indigo-300 leading-relaxed prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(question.explanation)}</ReactMarkdown>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mt-auto pb-4 pt-4">
          <button
            onClick={prevQuestion}
            disabled={currentQuestion === 0}
            className="text-slate-600 dark:text-slate-300 px-6 py-3 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-30"
          >
            Previous
          </button>

          {(hasAnsweredCurrent || currentQuestion < quiz.questions.length - 1) && (
            <button
              onClick={nextQuestion}
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-xl font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-md ml-auto"
            >
              {currentQuestion < quiz.questions.length - 1 ? 'Next' : 'Finish'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};


