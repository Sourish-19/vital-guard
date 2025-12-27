import React, { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import axios from "axios"; 
import {
  Menu,
  Mic,
  AlertTriangle,
  Bell,
  Trash2,
  Loader2
} from "lucide-react";

import { generateHealthInsight } from "./services/geminiService";
import { authService, User } from "./services/authService";
import { sendWhatsAppAlert } from "./services/whatsappService"; 

import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import VitalsTrends from "./components/VitalsTrends";
import Medications from "./components/Medications";
import EmergencyLog from "./components/EmergencyLog";
import Settings, { SettingsProfile, SettingsContacts, SettingsDevice } from "./components/Settings";
import HealthTips from "./components/HealthTips";
import NutritionTracker from "./components/NutritionTracker";
import StepsTracker from "./components/StepsTracker";
import SleepTracker from "./components/SleepTracker";
import Auth from "./components/Auth";
import LandingPage from "./components/LandingPage";
import ChatAssistant from "./components/ChatAssistant";
import NotificationSystem, {
  Notification,
  NotificationType,
} from "./components/NotificationSystem";

import {
  PatientState,
  AlertLevel,
  AIInsight,
  Medication,
  EmergencyLog as EmergencyLogType,
  EmergencyContact,
  NutritionState,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const generateStepHistory = () => {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days.map((day) => ({
    date: day,
    count: Math.floor(Math.random() * 8000) + 2000,
    target: 6000,
    met: Math.random() > 0.4,
  }));
};

const INITIAL_PATIENT: PatientState = {
  id: "GUEST",
  full_name: "Guest User",
  age: 0,
  phone_number: "",
  status: AlertLevel.STABLE,
  location: { lat: 34.0522, lng: -118.2437, address: "Loading Location..." },
  heartRate: { value: 72, unit: "BPM", label: "Heart Rate", trend: "stable", lastUpdated: "Now", history: [] },
  bloodPressure: { systolic: 120, diastolic: 80, history: [] },
  oxygenLevel: { value: 98, unit: "%", label: "SpO2", trend: "stable", lastUpdated: "Now", history: [] },
  temperature: { value: 98.6, unit: "°F", label: "Temperature", trend: "stable", lastUpdated: "Now", history: [] },
  // ✅ ADDED: Initial Blood Sugar State
  bloodSugar: { value: 95, unit: "mg/dL", label: "Blood Sugar", trend: "stable", lastUpdated: "Now", history: [] },
  steps: { value: 0, unit: "steps", label: "Steps", trend: "up", lastUpdated: "Now", history: [] },
  dailyStepGoal: 6000,
  stepPoints: 0,
  stepHistory: generateStepHistory(),
  sleep: { score: 85, duration: "7h", bedTime: "10pm", wakeTime: "6am", stages: {deep:0, light:0, rem:0, awake:0}, history: [] },
  nutrition: { isConfigured: false, weight: 0, height: 0, goal: "maintain", activityLevel: "light", dailyCalorieTarget: 2000, caloriesConsumed: 0, macros: {protein:0, carbs:0, fats:0}, meals: {breakfast:[], lunch:[], dinner:[], snack:[]}, waterIntake: 0 },
  medications: [],
  logs: [],
  contacts: [],
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // --- States ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true); // Controls initial loader
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [patient, setPatient] = useState<PatientState>(INITIAL_PATIENT);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('smartsos_theme') === 'dark');
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(5);
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);

  const patientRef = useRef<PatientState>(patient);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => { patientRef.current = patient; }, [patient]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem('smartsos_theme', 'dark');
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem('smartsos_theme', 'light');
    }
  }, [isDarkMode]);

  // =========================================================
  // ✅ AUTH INITIALIZATION: FETCH USER ON LOAD
  // =========================================================
  useEffect(() => {
    const initAuth = async () => {
      // 1. Check for token
      const token = authService.getToken();

      // 2. If NO token, stop loading, show Landing/Login
      if (!token) {
        setIsAuthChecking(false);
        return; 
      }

      // 3. If Token exists, FETCH user data
      try {
        console.log("🔄 Fetching fresh profile...");
        const response = await axios.get(`${API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const userData = response.data;

        // 4. Update State with fresh data
        setPatient((prev) => ({
            ...prev,
            id: userData.id,
            full_name: userData.full_name,
            age: userData.age,
            phone_number: userData.phone_number,
            contacts: userData.contacts || [],
            nutrition: userData.nutrition || prev.nutrition,
        }));

        setIsAuthenticated(true);
        
        if (location.pathname === '/' || location.pathname === '/login') {
            navigate('/dashboard');
        }

      } catch (error) {
        console.error("❌ Session expired:", error);
        authService.logout();
        setIsAuthenticated(false);
      } finally {
        setIsAuthChecking(false); // Stop loading
      }
    };

    initAuth();
  }, []);

  const handleLoginSuccess = (user: User) => {
    // Auth.tsx calls this with the user object returned by authService.login()
    setPatient((prev) => ({
      ...prev,
      id: user.id || prev.id,
      full_name: user.full_name,
      age: user.age || prev.age,
      phone_number: user.phone_number,
      contacts: user.contacts || [],
      nutrition: user.nutrition || prev.nutrition,
    }));
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setPatient(INITIAL_PATIENT);
    navigate('/');
  };

  // --- Helpers ---
  const addNotification = (type: NotificationType, title: string, message: string) => {
    const newNotif: Notification = { id: Date.now().toString() + Math.random(), type, title, message, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const playBeep = (frequency = 800, duration = 0.1) => {
    if (typeof window === "undefined") return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    if (!audioContextRef.current) audioContextRef.current = new AC();
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  const notifyCaregiver = async (message: string) => {
    const currentPatient = patientRef.current;
    const contacts = currentPatient.contacts;

    if (!contacts || contacts.length === 0) {
        addNotification("system", "No Contacts", "Please add emergency contacts in Settings.");
        return;
    }

    addNotification("whatsapp", "Sending Alerts", `Notifying ${contacts.length} contact(s)...`);

    const results = await Promise.all(
        contacts.map(async (contact) => {
            if (!contact.phone) return { name: contact.name, status: "skipped" };
            try {
                const success = await sendWhatsAppAlert(contact.phone, message);
                return { name: contact.name, status: success ? "sent" : "failed" };
            } catch (error) {
                console.error(`Failed to alert ${contact.name}:`, error);
                return { name: contact.name, status: "error" };
            }
        })
    );

    const sentCount = results.filter(r => r.status === "sent").length;
    if (sentCount > 0) {
        addNotification("whatsapp", "Alerts Sent", `Successfully alerted ${sentCount} contact(s).`);
        speak(`Emergency contacts have been notified.`);
    } else {
        addNotification("system", "Delivery Failed", "Could not reach contacts. Did they join the Sandbox?");
    }
  };

  const getAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      const label = data?.display_name?.split(",")[0] || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
      const city = data?.address?.city || data?.address?.town || "";
      return city ? `${label}, ${city}` : label;
    } catch (e) { console.error("Geocode error", e); return "Location Updated"; }
  };

  // --- Effects ---
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    const watcher = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const address = await getAddressFromCoords(latitude, longitude);
        setPatient((prev) => ({ ...prev, location: { lat: latitude, lng: longitude, address } }));
      },
      (error) => console.log("Geo Error", error), { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, [isAuthenticated]);

  const fetchInsight = useCallback(async (currentData: PatientState) => {
    try {
      setLoadingAi(true);
      const insight = await generateHealthInsight(currentData);
      setAiInsight(insight);
    } catch (e) { console.error("AI insight error", e); } finally { setLoadingAi(false); }
  }, []);

  useEffect(() => { if (isAuthenticated) fetchInsight(patient); }, [isAuthenticated]);

  // Medication Loop
  useEffect(() => {
    if (!isAuthenticated) return;
    const complianceInterval = setInterval(async () => {
      const currentPatient = patientRef.current;
      const now = new Date();
      const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
      const primaryContact = currentPatient.contacts.find((c) => c.isPrimary) || currentPatient.contacts[0];
      const contactInfo = primaryContact ? `${primaryContact.name} (${primaryContact.phone})` : "Emergency Services";
      const getMinutesFromMidnight = (timeStr: string) => { const [h, m] = timeStr.split(":").map(Number); return h * 60 + m; };

      let updatesNeeded = false;
      const newLogs: EmergencyLogType[] = [];
      const medsToNotify: Medication[] = [];

      const updatedMeds = currentPatient.medications.map((med) => {
        if (med.taken || med.reminderSent) return med;
        if (currentTotalMinutes > getMinutesFromMidnight(med.time)) {
          updatesNeeded = true;
          medsToNotify.push(med);
          newLogs.push({ id: Date.now().toString() + Math.random(), timestamp: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), type: "Medication Alert", resolved: false, notes: `Missed Dose: ${med.name}. Alert sent to ${contactInfo}.` });
          return { ...med, reminderSent: true };
        }
        return med;
      });

      if (updatesNeeded) {
        medsToNotify.forEach((med) => {
          const msg = `⚠️ *Medication Reminder*\n\nPatient ${currentPatient.full_name} missed their dose of *${med.name}* at ${med.time}.`;
          notifyCaregiver(msg);
          speak(`Attention. You missed your ${med.name}. I have notified your caregiver.`);
          addNotification("whatsapp", "Medication Missed", `Alert sent to ${contactInfo}. Please take ${med.name}.`);
        });
        setPatient((prev) => ({ ...prev, medications: updatedMeds, logs: [...newLogs, ...prev.logs] }));
      }
    }, 10000);
    return () => clearInterval(complianceInterval);
  }, [isAuthenticated]);

  // Vitals Simulation Loop
  useEffect(() => {
    if (!isAuthenticated) return;
    if (location.pathname === '/settings') return; 

    const interval = setInterval(() => {
      setPatient((prev) => {
        const isCritical = prev.status === AlertLevel.CRITICAL;
        
        // Random Value Generation
        const newHr = isCritical ? 130 + Math.random() * 40 : 72 + (Math.random() * 4 - 2);
        const newSys = isCritical ? 160 + Math.random() * 20 : 118 + (Math.random() * 6 - 3);
        const newTemp = 98.6 + (Math.random() * 0.8 - 0.4);
        
        // ✅ ADDED: Blood Sugar Simulation
        const newSugar = isCritical ? 180 + Math.random() * 60 : 95 + (Math.random() * 10 - 5);
        
        const stepInc = Math.random() > 0.6 ? Math.floor(Math.random() * 8) + 2 : 0;
        
        let newPoints = prev.stepPoints;
        if (prev.steps.value + stepInc >= prev.dailyStepGoal && prev.steps.value < prev.dailyStepGoal) {
          newPoints += 50;
          addNotification("system", "Daily Goal Reached!", `You've hit ${prev.dailyStepGoal} steps. +50 pts!`);
        }

        const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

        return {
          ...prev,
          heartRate: { 
            ...prev.heartRate, 
            value: Math.floor(newHr), 
            history: [...prev.heartRate.history, { time: timestamp, value: newHr }].slice(-20) 
          },
          bloodPressure: { 
            ...prev.bloodPressure, 
            systolic: Math.floor(newSys), 
            history: [...prev.bloodPressure.history, { time: timestamp, systolic: newSys, diastolic: prev.bloodPressure.diastolic }].slice(-20) 
          },
          temperature: { 
            ...prev.temperature, 
            value: newTemp, 
            history: [...prev.temperature.history, { time: timestamp, value: newTemp }].slice(-20) 
          },
          // ✅ ADDED: Blood Sugar Logic
          bloodSugar: {
            ...prev.bloodSugar,
            value: newSugar,
            history: [...(prev.bloodSugar?.history || []), { time: timestamp, value: newSugar }].slice(-20)
          },
          steps: { ...prev.steps, value: prev.steps.value + stepInc },
          stepPoints: newPoints,
        };
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isAuthenticated, location.pathname]);

  // --- Handlers ---
  const handleUpdateStepGoal = (newGoal: number) => { setPatient((prev) => ({ ...prev, dailyStepGoal: newGoal })); addNotification("system", "Goal Updated", `Daily step target set to ${newGoal.toLocaleString()}`); };
  
  const handleManualSOS = (type: "cardiac" | "fall" = "cardiac") => {
    setIsTestMode(false);
    const newLog: EmergencyLogType = { id: Date.now().toString(), timestamp: new Date().toLocaleTimeString(), type: type === "fall" ? "Fall Detection" : "Critical Vitals Spike", resolved: false, notes: type === "fall" ? "Sudden impact detected." : "Heart rate spike > 140 BPM." };
    setPatient((prev) => ({ ...prev, status: AlertLevel.CRITICAL, logs: [newLog, ...prev.logs] }));
    setShowSOSModal(true);
    setSosCountdown(10);
    speak(type === "fall" ? "Fall detected. Calling emergency contacts." : "Warning. Heart rate anomaly detected.");
    notifyCaregiver(`🚨 *SOS EMERGENCY ALERT* 🚨\n\nPatient: ${patientRef.current.full_name}\nStatus: CRITICAL\nLocation: ${patientRef.current.location.address}`);
    setTimeout(() => fetchInsight({ ...patientRef.current, status: AlertLevel.CRITICAL }), 1000);
  };
  
  const triggerChaos = () => handleManualSOS("cardiac");
  const triggerFall = () => handleManualSOS("fall");
  
  const handleSystemTest = () => {
    setIsTestMode(true);
    setPatient((prev) => ({ ...prev, logs: [{ id: Date.now().toString(), timestamp: new Date().toLocaleTimeString(), type: "System Test", resolved: true, notes: "User initiated diagnostic." }, ...prev.logs] }));
    setShowSOSModal(true);
    setSosCountdown(5);
    speak("System test initiated.");
  };

  const handleNotificationTest = async () => {
    if (!patient.phone_number) {
        addNotification("system", "Missing Phone Number", "Please set a phone number in settings first.");
        return;
    }
    addNotification("whatsapp", "WhatsApp Alert", "Sending test message via Twilio...");
    const success = await sendWhatsAppAlert(
        patient.phone_number, 
        "🏥 *SmartSOS Test Message*\n\nYour notification system is working correctly."
    );
    if (success) { 
        speak("Test message sent."); 
        addNotification("whatsapp", "WhatsApp Alert", "Success! Check your WhatsApp."); 
    } else { 
        speak("Could not send message."); 
        addNotification("system", "Connection Failed", "Check server logs or Twilio keys."); 
    }
  };

  const resolveEmergency = () => {
    setPatient((prev) => ({ ...prev, status: AlertLevel.STABLE, logs: prev.logs.map((log) => !log.resolved ? { ...log, resolved: true, notes: `${log.notes} [User Acknowledged]` } : log) }));
    setShowSOSModal(false);
    speak("Alarm cancelled.");
    if (!isTestMode) { notifyCaregiver(`✅ *Alert Resolved*\n\nPatient ${patientRef.current.full_name} has marked themselves as safe.`); fetchInsight({ ...patientRef.current, status: AlertLevel.STABLE }); }
    setIsTestMode(false);
  };
  
  const handleToggleMedication = (id: string) => { setPatient((prev) => ({ ...prev, medications: prev.medications.map((med) => med.id === id ? { ...med, taken: !med.taken } : med) })); };
  const handleAddMedication = (newMed: Omit<Medication, "id" | "taken">) => { setPatient((prev) => ({ ...prev, medications: [...prev.medications, { ...newMed, id: Date.now().toString(), taken: false, reminderSent: false }] })); };
  
  const handleUpdateProfile = async (updates: Partial<PatientState>) => {
    setPatient((prev) => ({ ...prev, ...updates }));
    const token = authService.getToken();
    if (token) {
        try {
            await authService.updateUser(updates);
        } catch(e) {
            console.error("Profile sync error:", e);
        }
    }
  };

  const handleAddContact = async (contact: Omit<EmergencyContact, "id">) => {
    const token = authService.getToken(); 
    if (!token) return;

    try {
      const response = await axios.post(`${API_URL}/users/me/contacts`, contact, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPatient((prev) => ({ ...prev, contacts: response.data }));
      console.log("✅ Contact added via API");
    } catch (e) {
      console.error("❌ Failed to add contact:", e);
      throw e; 
    }
  };

  const handleRemoveContact = async (id: string) => {
    const token = authService.getToken(); 
    if (!token) return;

    try {
      const response = await axios.delete(`${API_URL}/users/me/contacts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPatient((prev) => ({ ...prev, contacts: response.data }));
      console.log("✅ Contact deleted via API");
    } catch (e) {
      console.error("❌ Failed to remove contact:", e);
      throw e;
    }
  };

  const handleUpdateNutrition = async (newNutrition: NutritionState) => { 
      setPatient((prev) => ({ ...prev, nutrition: newNutrition })); 
      const token = authService.getToken();
      if (token) {
          await axios.put(`${API_URL}/users/me`, {nutrition: newNutrition}, {headers: {Authorization: `Bearer ${token}`}}); 
      }
  };

  useEffect(() => {
    if (!showSOSModal) return;
    if (sosCountdown <= 0) return;
    const pitch = 800 + (10 - sosCountdown) * 100;
    playBeep(pitch, 0.15);
    const timer = setTimeout(() => setSosCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [showSOSModal, sosCountdown]);

  const isPublicPage = location.pathname === '/' || location.pathname === '/login';

  // ✅ LOADING STATE (Shows while checking token validity)
  if (isAuthChecking) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // --- Main Render ---
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-200">
      
      {/* Global Components */}
      <NotificationSystem notifications={notifications} onClose={removeNotification} />
      
      {showSOSModal && (
        <div className="fixed inset-0 bg-red-600 bg-opacity-90 z-50 flex items-center justify-center animate-in fade-in zoom-in duration-300 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 max-w-lg w-full mx-4 text-center shadow-2xl border-4 border-red-500">
            <div className="flex justify-center mb-6">
              <div className="bg-red-100 dark:bg-red-900/50 p-6 rounded-full animate-ping">
                <AlertTriangle size={64} className="text-red-600 dark:text-red-500" />
              </div>
            </div>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-2">EMERGENCY ALERT</h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 font-medium mb-8">{isTestMode ? "System Test Initiated" : "Calling Emergency Contacts in..."}</p>
            <div className="text-8xl font-black text-red-600 dark:text-red-500 mb-8 font-mono tracking-tighter">00:0{sosCountdown}</div>
            <div className="space-y-4">
              <button onClick={resolveEmergency} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-xl font-bold text-xl hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-lg">{isTestMode ? "End System Test" : "I AM SAFE - CANCEL ALARM"}</button>
              {!isTestMode && <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Do not close this window. GPS location is being broadcast.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar & Header (Only for authenticated pages) */}
      {!isPublicPage && isAuthenticated && (
        <>
          {isSidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
          <div className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 transition duration-200 ease-in-out z-30`}>
            <Sidebar fullName={patient.full_name} onLogout={handleLogout} isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header (Only for authenticated pages) */}
        {!isPublicPage && isAuthenticated && (
          <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-4 sm:px-6 z-10 transition-colors duration-200">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-500 dark:text-slate-400"><Menu /></button>
            <div className="flex items-center space-x-2 md:space-x-4 ml-auto">
              <div className="relative">
                <button onClick={() => setShowNotificationPanel((prev) => !prev)} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative" title="Notifications">
                  <Bell size={20} />
                  {notifications.length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />}
                </button>
                {showNotificationPanel && (
                  <div className="absolute top-12 right-0 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 origin-top-right">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">Notifications</h3>
                      {notifications.length > 0 && <button onClick={() => setNotifications([])} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"><Trash2 size={12} /> Clear All</button>}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? <div className="p-8 text-center"><p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No new notifications</p></div> : notifications.map((n) => (
                        <div key={n.id} className="p-4 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${n.type === "whatsapp" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>{n.type === "whatsapp" ? "Message" : "System Alert"}</span>
                            <span className="text-[10px] text-slate-400">{n.timestamp}</span>
                          </div>
                          <h4 className="font-bold text-sm text-slate-800 dark:text-white mt-1">{n.title}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => speak(`Hello ${patient.full_name}. Your heart rate is ${patient.heartRate.value}.`)} className="flex items-center space-x-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"><Mic size={18} /><span className="text-sm font-bold hidden sm:inline">Voice Assistant</span></button>
              <button onClick={() => handleManualSOS("cardiac")} className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 animate-pulse font-bold active:scale-95"><AlertTriangle size={18} /><span className="hidden sm:inline">SOS</span></button>
            </div>
          </header>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<LandingPage onLaunch={() => navigate('/login')} isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} />} />
              <Route path="/login" element={<Auth onLogin={(user) => { handleLoginSuccess(user); navigate('/dashboard'); }} />} />
              
              {/* Protected Routes directly rendered */}
              <Route path="/dashboard" element={isAuthenticated ? <Dashboard patient={patient} onSpeak={speak} onSimulateChaos={triggerChaos} onSimulateFall={triggerFall} aiInsight={aiInsight} loadingAi={loadingAi} onNavigate={(path: any) => navigate(`/${path}`)} /> : <Navigate to="/login" />} />
              <Route path="/trends" element={isAuthenticated ? <VitalsTrends patient={patient} isDarkMode={isDarkMode} /> : <Navigate to="/login" />} />
              <Route path="/medications" element={isAuthenticated ? <Medications medications={patient.medications} onToggleTaken={handleToggleMedication} onAddMedication={handleAddMedication} /> : <Navigate to="/login" />} />
              <Route path="/logs" element={isAuthenticated ? <EmergencyLog logs={patient.logs} /> : <Navigate to="/login" />} />
              <Route path="/health-tips" element={isAuthenticated ? <HealthTips onNotification={addNotification} /> : <Navigate to="/login" />} />
              <Route path="/nutrition" element={isAuthenticated ? <NutritionTracker patient={patient} onUpdateNutrition={handleUpdateNutrition} /> : <Navigate to="/login" />} />
              <Route path="/steps" element={isAuthenticated ? <StepsTracker patient={patient} onUpdateGoal={handleUpdateStepGoal} /> : <Navigate to="/login" />} />
              <Route path="/sleep" element={isAuthenticated ? <SleepTracker patient={patient} /> : <Navigate to="/login" />} />
              <Route path="/settings" element={
                  isAuthenticated ? 
                  <Settings patient={patient} onTestAlarm={handleSystemTest} /> 
                  : <Navigate to="/login" />
              }>
                  {/* Default redirect to profile */}
                  <Route index element={<Navigate to="profile" replace />} />
                  
                  <Route path="profile" element={
                      <SettingsProfile patient={patient} onUpdateProfile={handleUpdateProfile} />
                  } />
                  
                  <Route path="contacts" element={
                      <SettingsContacts 
                          patient={patient} 
                          onAddContact={handleAddContact} 
                          onRemoveContact={handleRemoveContact} 
                      />
                  } />
                  
                  <Route path="device" element={
                      <SettingsDevice 
                          patient={patient} 
                          onTestWhatsApp={handleNotificationTest} 
                      />
                  } />
              </Route>
              
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>

        {/* Chat Assistant (Persistent & Auth only) */}
        {!isPublicPage && isAuthenticated && location.pathname !== '/settings' && <ChatAssistant patient={patient} />}
      </div>
    </div>
  );
}

export default App;