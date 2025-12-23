from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import joblib
import numpy as np
import requests
from datetime import datetime
from typing import List, Optional

# ==============================
# Load model bundle
# ==============================
bundle = joblib.load("vitalguard_model.pkl")
model = bundle["model"]
FEATURES = bundle["features"]

# ==============================
# FastAPI app
# ==============================
app = FastAPI(title="Smart SOS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # OK for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# In-memory SOS log store
# ==============================
SOS_LOGS = []

# ==============================
# Request schemas
# ==============================
class VitalSigns(BaseModel):
    heart_rate: float
    spo2: float
    bp_sys: float
    bp_dia: float
    blood_sugar_mg_dl: float
    temperature_c: float
    resp_rate: float
    age: float


class SOSRequest(BaseModel):
    risk_level: str
    location: str
    vitals: VitalSigns
    timestamp: Optional[str] = None


class SOSLog(BaseModel):
    id: int
    timestamp: str
    risk_level: str
    location: str
    vitals: VitalSigns
    resolved: bool = False

# ==============================
# Health check
# ==============================
@app.get("/")
def root():
    return {"status": "Smart SOS backend running"}

# ==============================
# Prediction endpoint
# ==============================
@app.post("/predict")
def predict(data: VitalSigns):
    X = np.array([[getattr(data, f) for f in FEATURES]])
    pred = int(model.predict(X)[0])
    probs = model.predict_proba(X)[0]

    risk_score = int(probs[2] * 100)

    return {
        "prediction": pred,
        "risk_score": risk_score,
        "probabilities": probs.tolist()
    }

# ==============================
# Reverse Geocoding (backend proxy)
# ==============================
@app.get("/api/reverse-geocode")
def reverse_geocode(lat: float, lon: float):
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {
        "format": "json",
        "lat": lat,
        "lon": lon
    }
    headers = {
        "User-Agent": "SmartSOS/1.0"
    }

    response = requests.get(url, params=params, headers=headers, timeout=5)
    return response.json()

# ==============================
# 🚨 SOS Emergency Endpoint
# ==============================
@app.post("/sos")
def trigger_sos(data: SOSRequest):
    timestamp = data.timestamp or datetime.utcnow().isoformat()

    log_entry = {
        "id": len(SOS_LOGS) + 1,
        "timestamp": timestamp,
        "risk_level": data.risk_level,
        "location": data.location,
        "vitals": data.vitals,
        "resolved": False
    }

    SOS_LOGS.append(log_entry)

    # 🔴 Real integrations would go here
    print("\n🚨🚨🚨 SOS TRIGGERED 🚨🚨🚨")
    print("Time:", timestamp)
    print("Risk Level:", data.risk_level)
    print("Location:", data.location)
    print("Vitals:", data.vitals.dict())
    print("Total SOS Logs:", len(SOS_LOGS))

    return {
        "status": "SOS triggered successfully",
        "timestamp": timestamp,
        "risk_level": data.risk_level,
        "location": data.location
    }

# ==============================
# 📜 Get SOS Logs (for frontend)
# ==============================
@app.get("/sos/logs", response_model=List[SOSLog])
def get_sos_logs():
    return SOS_LOGS
