import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CheckCircle2, XCircle, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';

export const QuizRunner = () => {
  const { quizId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

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

  if (!quiz) {
    return <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const handleAnswer = (option: string) => {
    if (showExplanation) return;
    setSelectedAnswer(option);
    setShowExplanation(true);
    if (option === quiz.questions[currentQuestion].answer) {
      setScore(s => s + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(c => c + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setIsFinished(true);
    }
  };

  const restart = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore(0);
    setIsFinished(false);
  };

  if (isFinished) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 md:p-6 flex items-center justify-center transition-colors">
        <div className="bg-white dark:bg-slate-800 p-6 md:p-10 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-200 dark:border-slate-700 transition-colors">
          <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Quiz Complete!</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">You scored {score} out of {quiz.questions.length}</p>
          
          <div className="space-y-3">
            <button onClick={restart} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors">
              <RefreshCcw className="w-5 h-5" />
              Try Again
            </button>
            <button onClick={() => navigate('/quizzes')} className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-6 py-3 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
              Back to Quizzes
            </button>
          </div>
        </div>
      </div>
    );
  }

  const question = quiz.questions[currentQuestion];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 md:p-8 transition-colors"
    >
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate('/quizzes')} className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{quiz.title}</h1>
          <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 px-4 py-1.5 rounded-full font-medium text-sm self-start md:self-auto whitespace-nowrap">
            Question {currentQuestion + 1} of {quiz.questions.length}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200 dark:border-slate-700 mb-6 transition-colors">
          <h2 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white mb-8 leading-relaxed">
            {question.question}
          </h2>

          <div className="space-y-3">
            {question.options.map((option: string, idx: number) => {
              const isSelected = selectedAnswer === option;
              const isCorrect = option === question.answer;
              
              let buttonClass = "w-full text-left p-4 rounded-2xl border-2 transition-all ";
              
              if (!showExplanation) {
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
                  disabled={showExplanation}
                  className={buttonClass}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-lg">{option}</span>
                    {showExplanation && isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                    {showExplanation && isSelected && !isCorrect && <XCircle className="w-6 h-6 text-red-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {showExplanation && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl p-6 mb-6 animate-in fade-in slide-in-from-bottom-4 transition-colors">
            <h3 className="font-bold text-indigo-900 dark:text-indigo-400 mb-2">Explanation</h3>
            <p className="text-indigo-800 dark:text-indigo-300 leading-relaxed">{question.explanation}</p>
          </div>
        )}

        {showExplanation && (
          <div className="flex justify-end">
            <button
              onClick={nextQuestion}
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-xl font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-md"
            >
              {currentQuestion < quiz.questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
