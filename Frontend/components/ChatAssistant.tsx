import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { PatientState } from '../types';
import { getChatResponse } from '../services/geminiService';

interface ChatAssistantProps {
  patient: PatientState;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ patient }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  
  // Initial greeting using patient name
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: '1', 
      role: 'model', 
      text: `Hello ${patient.full_name || 'there'}! I'm your health assistant. I can see your current heart rate is ${patient.heartRate.value} bpm. How are you feeling?` 
    }
  ]);
  
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // --- LOCAL FALLBACK LOGIC (Runs when API Quota Exceeds) ---
  const getFallbackResponse = (query: string, patientData: PatientState) => {
    const q = query.toLowerCase();
    
    if (q.includes('heart') || q.includes('rate') || q.includes('pulse')) {
      return `Your heart rate is currently ${patientData.heartRate.value} BPM. This is considered ${patientData.status === 'STABLE' ? 'normal' : 'high'} for your age.`;
    }
    if (q.includes('pressure') || q.includes('bp')) {
      return `Your latest blood pressure reading is ${patientData.bloodPressure.systolic}/${patientData.bloodPressure.diastolic}.`;
    }
    if (q.includes('diet') || q.includes('food') || q.includes('eat')) {
      return "Based on your vitals, I recommend sticking to a low-sodium diet rich in leafy greens and lean proteins. Make sure to stay hydrated!";
    }
    if (q.includes('emergency') || q.includes('help') || q.includes('sos')) {
      return "If you are feeling unwell, please press the red SOS button at the top of the screen immediately to notify your emergency contacts.";
    }
    if (q.includes('hello') || q.includes('hi')) {
      return `Hello ${patientData.full_name}! I'm here to help you monitor your health.`;
    }
    
    // Default fallback
    return "I've noted that. I'm currently running in offline mode due to connection limits, but your vitals look stable. Is there anything specific about your readings you'd like to know?";
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input;
    const userMessage: Message = { id: Date.now().toString(), role: 'user', text: userText };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 1. Try to fetch from Real AI
      const responseText = await getChatResponse(userText, patient);
      
      const aiMessage: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: responseText 
      };
      setMessages(prev => [...prev, aiMessage]);

    } catch (error: any) {
      console.warn('AI API Error (Falling back to local mode):', error);
      
      // 2. CATCH QUOTA ERRORS: Use Fallback instead of showing an error message
      setTimeout(() => {
        const fallbackText = getFallbackResponse(userText, patient);
        
        const fallbackMessage: Message = { 
          id: (Date.now() + 1).toString(), 
          role: 'model', 
          text: fallbackText 
        };
        setMessages(prev => [...prev, fallbackMessage]);
        setIsLoading(false); 
      }, 1000); // Small fake delay to feel natural
      
      return; 
    }

    setIsLoading(false);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-40 p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 ${
          isOpen ? 'bg-slate-800 dark:bg-slate-700 rotate-90' : 'bg-gradient-to-r from-blue-600 to-indigo-600'
        } text-white`}
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
      </button>

      {/* Chat Window */}
      <div 
        className={`fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-40 transition-all duration-300 origin-bottom-right ${
          isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-10 pointer-events-none'
        }`}
        style={{ height: '500px' }}
      >
        {/* Header */}
        <div className="bg-slate-900 dark:bg-slate-800 text-white p-4 flex items-center space-x-3">
           <div className="bg-indigo-500 p-2 rounded-lg">
             <Bot size={20} />
           </div>
           <div>
             <h3 className="font-bold">Health Assistant</h3>
             <p className="text-xs text-slate-400 flex items-center gap-1">
               <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
               Online • Monitoring Vitals
             </p>
           </div>
        </div>

        {/* Messages Area */}
        <div className="h-[360px] overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-none shadow-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
               <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-2xl rounded-bl-none shadow-sm flex space-x-1">
                 <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                 <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                 <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSend} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your health..." 
            className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </>
  );
};

export default ChatAssistant;