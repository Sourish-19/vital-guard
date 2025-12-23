import { GoogleGenAI } from "@google/genai";
import { PatientState, AIInsight } from "../types";

const SYSTEM_INSTRUCTION = `
You are an advanced AI medical assistant for an elderly care dashboard called SmartSOS.
Your audience is the patient (Margaret, 72) and her family caregivers.
Keep responses concise (under 40 words), empathetic, and clear.
`;

// --- SIMULATION HELPERS (Fallback logic) ---

const simulateInsight = (patient: PatientState): AIInsight => {
  const isCritical = patient.status === 'CRITICAL';
  if (isCritical) {
    return {
      content: "⚠️ CRITICAL ALERT: Heart rate spike detected. Emergency protocols recommended.",
      timestamp: new Date().toLocaleTimeString(),
      type: 'warning'
    };
  }
  return {
    content: "Health Status: Stable. Vitals are within normal ranges. Keep up the good work!",
    timestamp: new Date().toLocaleTimeString(),
    type: 'positive'
  };
};

const simulateChatResponse = (text: string, patient: PatientState): string => {
  const t = text.toLowerCase();
  if (t.includes('heart') || t.includes('rate')) return `Your heart rate is ${patient.heartRate.value} BPM.`;
  if (t.includes('blood') || t.includes('bp')) return `Your BP is ${patient.bloodPressure.systolic}/${patient.bloodPressure.diastolic}.`;
  if (t.includes('hello')) return `Hello ${patient.full_name}! I am monitoring your health.`;
  return "I am currently running in Offline Mode. Your vitals look stable.";
};

// --- API SERVICES ---

const getApiKey = () => {
  try {
    const meta: any = import.meta;
    return meta.env.VITE_GEMINI_API_KEY;
  } catch (e) {
    return null;
  }
};

export const generateHealthInsight = async (patient: PatientState): Promise<AIInsight> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return simulateInsight(patient);

    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash', 
      contents: [{ 
        role: 'user', 
        parts: [{ text: `${SYSTEM_INSTRUCTION}\n\nAnalyze these vitals: HR ${patient.heartRate.value}, BP ${patient.bloodPressure.systolic}/${patient.bloodPressure.diastolic}. Status: ${patient.status}. Provide a short 1-sentence insight.` }] 
      }],
      config: {
        temperature: 0.7,
        maxOutputTokens: 100,
      }
    });

    const text = response.text ? response.text() : "Vitals monitored.";

    return {
      content: text,
      timestamp: new Date().toLocaleTimeString(),
      type: patient.status === 'STABLE' ? 'positive' : 'warning'
    };

  } catch (error) {
    console.warn("AI API Error (Insight):", error);
    return simulateInsight(patient);
  }
};

export const getChatResponse = async (userMessage: string, patient: PatientState): Promise<string> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return simulateChatResponse(userMessage, patient);

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ 
        role: 'user', 
        parts: [{ text: `${SYSTEM_INSTRUCTION}\n\nPatient: ${patient.full_name}. Vitals: HR ${patient.heartRate.value}. Question: ${userMessage}` }] 
      }]
    });

    return response.text ? response.text() : "I didn't catch that.";
  } catch (error) {
    console.warn("AI API Error (Chat):", error);
    return simulateChatResponse(userMessage, patient);
  }
};

export const analyzeMedicationImage = async (base64Image: string): Promise<{ name: string; dosage: string; time: string; type: string } | null> => {
  const fallbackData = {
    name: "Simulated Medication",
    dosage: "50mg",
    time: "09:00",
    type: "pill"
  };

  const apiKey = getApiKey();
  if (!apiKey) return fallbackData;

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: `Analyze this image of a medication container. Return STRICT JSON ONLY: { "name": "...", "dosage": "...", "time": "08:00", "type": "pill" }.` }
          ]
        }
      ]
    });

    const text = response.text ? response.text() : "";
    const cleanText = text.replace(/```json\n?|```/g, '').trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    
    if (firstBrace === -1) throw new Error("No JSON found");
    
    return JSON.parse(cleanText.substring(firstBrace, lastBrace + 1));

  } catch (error) {
    console.warn("AI API Error (Medication Image):", error);
    return fallbackData;
  }
};

export const analyzeFoodImage = async (base64Image: string): Promise<{ name: string; calories: number; protein: number; carbs: number; fats: number } | null> => {
  const fallbackData = {
    name: "Simulated Healthy Meal",
    calories: 350,
    protein: 30,
    carbs: 15,
    fats: 18
  };

  const apiKey = getApiKey();
  if (!apiKey) return fallbackData;

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: `Analyze this food image. Return STRICT JSON ONLY: { "name": "...", "calories": 0, "protein": 0, "carbs": 0, "fats": 0 }.` }
          ]
        }
      ]
    });

    const text = response.text ? response.text() : "";
    const cleanText = text.replace(/```json\n?|```/g, '').trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    
    if (firstBrace === -1) throw new Error("No JSON found");

    return JSON.parse(cleanText.substring(firstBrace, lastBrace + 1));

  } catch (error) {
    console.warn("AI API Error (Food Image):", error);
    return fallbackData;
  }
};