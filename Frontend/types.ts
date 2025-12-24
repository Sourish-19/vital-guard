export type PageView = 'dashboard' | 'trends' | 'medications' | 'logs' | 'settings' | 'health-tips' | 'nutrition' | 'steps' | 'sleep';

export enum AlertLevel {
  STABLE = 'STABLE',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export interface VitalSign {
  value: number;
  unit: string;
  label: string;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
  history: { time: string; value: number }[];
}

export interface BloodPressure {
  systolic: number;
  diastolic: number;
  history: { time: string; systolic: number; diastolic: number }[];
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  time: string;
  taken: boolean;
  reminderSent?: boolean; 
  type: 'pill' | 'liquid' | 'injection';
}

export interface EmergencyLog {
  id: string;
  timestamp: string;
  type: string;
  resolved: boolean;
  notes: string;
}

// ✅ Synced with Backend EmergencyContact model
export interface EmergencyContact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  isPrimary: boolean;
}

// Nutrition & Diet Types
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface NutritionState {
  isConfigured: boolean;
  weight: number; // kg
  height: number; // cm
  goal: 'lose' | 'maintain' | 'gain';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active';
  dailyCalorieTarget: number;
  caloriesConsumed: number;
  macros: {
    protein: number; // grams
    carbs: number;
    fats: number;
  };
  meals: {
    breakfast: FoodItem[];
    lunch: FoodItem[];
    dinner: FoodItem[];
    snack: FoodItem[];
  };
  waterIntake: number; // glasses
}

export interface StepRecord {
  date: string; // YYYY-MM-DD or Day Name
  count: number;
  target: number;
  met: boolean;
}

// Sleep Types
export interface SleepState {
  score: number; // 0-100
  duration: string; // e.g., "7h 12m"
  bedTime: string;
  wakeTime: string;
  stages: {
    deep: number; // percentage
    light: number;
    rem: number;
    awake: number;
  };
  history: { day: string; hours: number; score: number }[]; // Last 7 days
}

export interface PatientState {
  id: string;
  
  // --- USER PROFILE (Synced with DB) ---
  full_name: string;    
  phone_number: string; // Used for WhatsApp Alerts
  age: number;
  // Removed Telegram fields (botToken/chatId) as we now use Twilio/WhatsApp

  // --- VITALS SENSORS ---
  heartRate: VitalSign;
  bloodPressure: BloodPressure;
  oxygenLevel: VitalSign;
  temperature: VitalSign; 
  
  // --- ACTIVITY & SLEEP ---
  steps: VitalSign; 
  dailyStepGoal: number; 
  stepPoints: number; 
  stepHistory: StepRecord[]; 
  sleep: SleepState; 
  nutrition: NutritionState; 

  // --- SYSTEM STATE ---
  status: AlertLevel;
  medications: Medication[];
  logs: EmergencyLog[];
  contacts: EmergencyContact[]; // Loaded from DB
  location: { lat: number; lng: number; address: string };
}

export interface AIInsight {
  content: string;
  timestamp: string;
  type: 'info' | 'warning' | 'positive';
}