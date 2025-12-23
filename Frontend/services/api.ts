import axios from "axios";

// const API_URL = "https://vitalgaurd-1.onrender.com";
const API_URL ="http://localhost8000";

/* =========================
   TYPES
========================= */

export interface VitalData {
  heart_rate: number;
  spo2: number;
  bp_sys: number;
  bp_dia: number;
  temperature_c: number;
  resp_rate: number;
  blood_sugar_mg_dl: number;
  age: number;
}

export interface PredictionResult {
  prediction: number;
  risk_score: number;
  probabilities: number[];
}

export interface SOSPayload {
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  location: string;
  vitals: VitalData;
}

/* =========================
   API FUNCTIONS
========================= */

export async function getPrediction(
  vitalData: VitalData
): Promise<PredictionResult> {
  const response = await axios.post(`${API_URL}/predict`, vitalData, {
    headers: { "Content-Type": "application/json" },
  });
  return response.data;
}

export async function sendSOS(payload: SOSPayload) {
  const response = await axios.post(`${API_URL}/sos`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  return response.data;
}

export async function getReverseGeocode(lat: number, lon: number) {
  const response = await axios.get(
    "https://nominatim.openstreetmap.org/reverse",
    {
      params: { format: "json", lat, lon },
    }
  );
  return response.data;
}
