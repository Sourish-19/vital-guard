import axios from "axios";

const API_URL = "http://127.0.0.1:8000"; // ✅ FastAPI backend

// =======================
// Types (MUST match Pydantic model exactly)
// =======================
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
  prediction: string;
  risk_score: number;
  probabilities: number[];
}

// =======================
// Prediction API
// =======================
export const getPrediction = async (
  vitalData: VitalData
): Promise<PredictionResult> => {
  const response = await axios.post(
    `${API_URL}/predict`,
    vitalData,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
};

// =======================
// Reverse Geocoding (PUBLIC API – no backend needed)
// =======================
export const getReverseGeocode = async (lat: number, lon: number) => {
  const response = await axios.get(
    "https://nominatim.openstreetmap.org/reverse",
    {
      params: {
        format: "json",
        lat,
        lon,
      },
    }
  );

  return response.data;
};
