import os
import requests
import joblib
import numpy as np
import certifi
import google.generativeai as genai
from twilio.rest import Client
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pathlib import Path

from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import JWTError, jwt
from dotenv import load_dotenv

# ==========================================
# 0. LOAD ENVIRONMENT VARIABLES
# ==========================================
env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)

SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey_change_this_in_production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "vitalguard_db"
USER_COLLECTION = "users"
MODEL_PATH = "vitalguard_model.pkl"

# Twilio Config
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_TOKEN")
TWILIO_FROM_NUMBER = "whatsapp:+14155238886"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

SOS_LOGS = []

# ==========================================
# 1. FASTAPI APP & CORS
# ==========================================
app = FastAPI(title="VitalGuard API")

origins = ["http://localhost:5173", "http://localhost:3000", "https://vitalgaurd-mmeu.vercel.app"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 2. DATABASE CONNECTION
# ==========================================
class Database:
    client: AsyncIOMotorClient = None

db = Database()

async def get_database():
    return db.client[DB_NAME]

@app.on_event("startup")
async def startup_event():
    print(f"🔄 Connecting to MongoDB...") 
    secure_url = MONGO_URL
    if "?" not in MONGO_URL: secure_url = f"{MONGO_URL}?tlsAllowInvalidCertificates=true"
    elif "tlsAllowInvalidCertificates" not in MONGO_URL: secure_url = f"{MONGO_URL}&tlsAllowInvalidCertificates=true"

    try:
        db.client = AsyncIOMotorClient(secure_url, tls=True, tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=5000)
        await db.client.admin.command('ping')
        print("✅ Connected to MongoDB successfully!")
    except Exception as e:
        print(f"❌ Database Error: {e}")

    global model, FEATURES
    try:
        if os.path.exists(MODEL_PATH):
            bundle = joblib.load(MODEL_PATH)
            model = bundle["model"]
            FEATURES = bundle["features"]
            print("✅ ML Model loaded successfully")
        else:
            print("⚠️ ML Model not found.")
            model = None
            FEATURES = []
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        model = None

@app.on_event("shutdown")
async def shutdown_event():
    if db.client: db.client.close()

# ==========================================
# 3. PYDANTIC MODELS
# ==========================================

# ✅ CONTACT MODEL (Must be defined before UserUpdate)
class EmergencyContact(BaseModel):
    id: str
    name: str
    relation: str
    phone: str
    isPrimary: bool = False

class UserSignup(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone_number: str
    age: Optional[int] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# ✅ USER UPDATE (Now includes contacts list)
class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    age: Optional[int] = None
    phone_number: Optional[str] = None
    contacts: Optional[List[EmergencyContact]] = None 
    nutrition: Optional[Dict[str, Any]] = None

# ✅ USER RESPONSE (Returns contacts to frontend)
class UserResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    phone_number: str
    age: Optional[int]
    contacts: List[EmergencyContact] = []
    nutrition: Optional[Dict[str, Any]] = None

class Token(BaseModel):
    access_token: str
    token_type: str

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

class ChatRequest(BaseModel):
    message: str
    patient_context: dict

class AlertRequest(BaseModel):
    phone_number: str
    message: str

# ==========================================
# 4. AUTH & HELPERS
# ==========================================
def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)
def get_password_hash(password): return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None: raise HTTPException(status_code=401)
    except JWTError:
        raise HTTPException(status_code=401)
    
    database = await get_database()
    user = await database[USER_COLLECTION].find_one({"email": email})
    if user is None: raise HTTPException(status_code=401)
    
    user["id"] = str(user["_id"])
    return user

# ==========================================
# 5. ROUTES
# ==========================================

@app.get("/")
def health_check():
    return {"status": "VitalGuard Backend is Running", "timestamp": datetime.utcnow()}

@app.post("/signup", response_model=UserResponse)
async def signup(user: UserSignup):
    database = await get_database()
    if await database[USER_COLLECTION].find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user.dict()
    user_dict["password"] = get_password_hash(user.password)
    user_dict["created_at"] = datetime.utcnow()
    user_dict["contacts"] = []  # ✅ Initialize empty contacts list
    
    new_user = await database[USER_COLLECTION].insert_one(user_dict)
    return {**user_dict, "id": str(new_user.inserted_id)}

@app.post("/login", response_model=Token)
async def login(creds: UserLogin):
    database = await get_database()
    user = await database[USER_COLLECTION].find_one({"email": creds.email})
    if not user or not verify_password(creds.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect credentials")
    
    token = create_access_token(data={"sub": user["email"]})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ✅ UPDATE ENDPOINT: Handles saving contacts
@app.put("/users/me", response_model=UserResponse)
async def update_user_me(update: UserUpdate, current_user: dict = Depends(get_current_user)):
    database = await get_database()
    # exclude_unset=True allows us to update only specific fields (like contacts)
    update_data = update.dict(exclude_unset=True)
    
    if update_data:
        await database[USER_COLLECTION].update_one({"_id": current_user["_id"]}, {"$set": update_data})
    
    updated_user = await database[USER_COLLECTION].find_one({"_id": current_user["_id"]})
    updated_user["id"] = str(updated_user["_id"])
    return updated_user

@app.post("/predict")
def predict(data: VitalSigns):
    if model is None: raise HTTPException(status_code=500, detail="Model not loaded")
    X = np.array([[getattr(data, f) for f in FEATURES]])
    pred = int(model.predict(X)[0])
    probs = model.predict_proba(X)[0]
    return {"prediction": pred, "risk_score": int(probs[1]*100) if len(probs)>1 else 0}

@app.post("/sos")
def trigger_sos(data: SOSRequest):
    timestamp = data.timestamp or datetime.utcnow().isoformat()
    SOS_LOGS.append({"timestamp": timestamp, **data.dict()})
    print(f"\n🚨 SOS TRIGGERED | Risk: {data.risk_level}")
    return {"status": "SOS triggered", "timestamp": timestamp}

# ✅ SELF-HEALING AI CHAT
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            print("❌ Error: API Key is missing.")
            raise Exception("API Key missing")

        # -------------------------------------------------------
        # STEP 1: DYNAMICALLY FIND A WORKING MODEL
        # -------------------------------------------------------
        # We ask Google: "What models does this key have access to?"
        list_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        list_response = requests.get(list_url, timeout=5)
        
        target_model = "gemini-1.5-flash" # Default preference
        
        if list_response.status_code == 200:
            models_data = list_response.json()
            available_models = [m['name'].replace('models/', '') for m in models_data.get('models', [])]
            
            # Smart Selection Logic:
            # 1. Try to find the user's preferred flash model
            if "gemini-1.5-flash" in available_models:
                target_model = "gemini-1.5-flash"
            # 2. Fallback to gemini-pro if flash is missing
            elif "gemini-pro" in available_models:
                target_model = "gemini-pro"
            # 3. Last resort: Pick the first model that supports generation
            elif available_models:
                 # Find first model that starts with 'gemini'
                target_model = next((m for m in available_models if 'gemini' in m), available_models[0])
                
            print(f"✅ Auto-Selected Model: {target_model}")
        else:
            print(f"⚠️ Could not list models (Status {list_response.status_code}). Using default: {target_model}")

        # -------------------------------------------------------
        # STEP 2: SEND CHAT REQUEST
        # -------------------------------------------------------
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={api_key}"
        
        headers = {"Content-Type": "application/json"}
        
        # Context Builder
        context = request.patient_context
        system_text = f"""
        You are a helpful medical assistant for {context.get('full_name', 'User')}.
        Vitals: HR {context.get('heart_rate')} bpm, BP {context.get('bp_sys')}/{context.get('bp_dia')}.
        Keep answers under 50 words.
        """
        
        payload = {
            "contents": [{
                "parts": [{
                    "text": f"{system_text}\n\nUser Question: {request.message}"
                }]
            }]
        }

        # Send Request
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ API Error: {response.text}")
            raise Exception(f"Google API Error: {response.status_code}")

        data = response.json()
        reply = data.get("candidates", [])[0].get("content", {}).get("parts", [])[0].get("text", "")
        
        return {"reply": reply}

    except Exception as e:
        print(f"❌ AI Chat Failed: {e}")
        # Return 503 so frontend uses simulation fallback
        raise HTTPException(status_code=503, detail="AI Service Unavailable")

# ✅ TWILIO ALERT
@app.post("/api/send-alert")
def send_whatsapp_alert(alert: AlertRequest):
    try:
        if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
            return {"status": "simulated", "detail": "Twilio keys missing"}

        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        
        # 1. CLEAN THE PHONE NUMBER
        # Remove spaces, dashes, and parentheses
        clean_number = alert.phone_number.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        
        # 2. Add 'whatsapp:' prefix if missing
        if not clean_number.startswith("whatsapp:"):
            to_number = f"whatsapp:{clean_number}"
        else:
            to_number = clean_number

        # 3. Send Message
        message = client.messages.create(
            from_=TWILIO_FROM_NUMBER,
            body=f"🚨 *VITALGUARD ALERT* 🚨\n\n{alert.message}",
            to=to_number
        )
        return {"status": "success", "sid": message.sid}
    except Exception as e:
        print(f"Twilio Error: {e}")
        # Return 500 so frontend knows it failed
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)