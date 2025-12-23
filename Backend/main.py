import os
import requests
import joblib
import numpy as np
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import JWTError, jwt
from bson import ObjectId

# ==========================================
# 1. CONFIGURATION & SETUP
# ==========================================

# --- Security Config ---
SECRET_KEY = "supersecretkey_change_this_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# --- Database Config ---
MONGO_URL = "mongodb+srv://sourishsrivignesh_db_user:XyN33Z0orcsGitTV@smartsos.h7lzzgn.mongodb.net/?appName=SmartSOS"
DB_NAME = "vitalguard_db"
USER_COLLECTION = "users"

# --- ML Model Config ---
MODEL_PATH = "vitalguard_model.pkl"

# --- Global Objects ---
# NOTE: Using 'bcrypt' scheme. Ensure 'bcrypt==3.2.0' is installed or use 'argon2'
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# --- In-Memory Store for SOS Logs ---
SOS_LOGS = []

# ==========================================
# 2. FASTAPI APP & MIDDLEWARE
# ==========================================

app = FastAPI(title="VitalGuard: Auth & SOS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 3. DATABASE CONNECTION & LIFECYCLE
# ==========================================

class Database:
    client: AsyncIOMotorClient = None

db = Database()

async def get_database():
    return db.client[DB_NAME]

@app.on_event("startup")
async def startup_event():
    # Connect to MongoDB
    db.client = AsyncIOMotorClient(MONGO_URL)
    print("✅ Connected to MongoDB")
    
    # Load ML Model
    global model, FEATURES
    try:
        if os.path.exists(MODEL_PATH):
            bundle = joblib.load(MODEL_PATH)
            model = bundle["model"]
            FEATURES = bundle["features"]
            print("✅ ML Model loaded successfully")
        else:
            print(f"⚠️ Warning: '{MODEL_PATH}' not found. Prediction endpoint will fail.")
            model = None
            FEATURES = []
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        model = None

@app.on_event("shutdown")
async def shutdown_event():
    if db.client:
        db.client.close()
    print("💤 Disconnected from MongoDB")

# ==========================================
# 4. PYDANTIC MODELS
# ==========================================

# --- Auth Models ---
class UserSignup(BaseModel):
    full_name: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    phone_number: str = Field(..., description="Phone number for Telegram alerts")
    age: Optional[int] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# NEW: Model for Profile Updates
class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    age: Optional[int] = None
    phone_number: Optional[str] = None
    telegramBotToken: Optional[str] = None
    telegramChatId: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    phone_number: str
    age: Optional[int]

# --- SOS/ML Models ---
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

# ==========================================
# 5. UTILITY FUNCTIONS (AUTH)
# ==========================================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    database = await get_database()
    user = await database[USER_COLLECTION].find_one({"email": email})
    if user is None:
        raise credentials_exception
    
    user["id"] = str(user["_id"])
    return user

# ==========================================
# 6. AUTHENTICATION ROUTES
# ==========================================

@app.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(user: UserSignup):
    database = await get_database()
    
    existing_user = await database[USER_COLLECTION].find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    
    user_dict = {
        "full_name": user.full_name,
        "email": user.email,
        "password": hashed_password,
        "phone_number": user.phone_number,
        "age": user.age,
        "created_at": datetime.utcnow()
    }
    
    new_user = await database[USER_COLLECTION].insert_one(user_dict)
    
    return {
        "id": str(new_user.inserted_id),
        "full_name": user.full_name,
        "email": user.email,
        "phone_number": user.phone_number,
        "age": user.age
    }

@app.post("/login", response_model=Token)
async def login(user_credentials: UserLogin):
    database = await get_database()
    user = await database[USER_COLLECTION].find_one({"email": user_credentials.email})
    
    if not user or not verify_password(user_credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user["email"]}, expires_delta=access_token_expires)
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": str(current_user["_id"]), 
        "full_name": current_user["full_name"], 
        "email": current_user["email"],
        "phone_number": current_user.get("phone_number", ""),
        "age": current_user.get("age")
    }

# NEW: Update Profile Endpoint
@app.put("/users/me", response_model=UserResponse)
async def update_user_me(user_update: UserUpdate, current_user: dict = Depends(get_current_user)):
    database = await get_database()
    
    # Filter out None values to avoid overwriting with null
    update_data = {k: v for k, v in user_update.dict().items() if v is not None}
    
    if len(update_data) >= 1:
        await database[USER_COLLECTION].update_one(
            {"_id": current_user["_id"]}, 
            {"$set": update_data}
        )
    
    # Fetch updated user to return
    updated_user = await database[USER_COLLECTION].find_one({"_id": current_user["_id"]})
    
    return {
        "id": str(updated_user["_id"]),
        "full_name": updated_user["full_name"],
        "email": updated_user["email"],
        "phone_number": updated_user.get("phone_number", ""),
        "age": updated_user.get("age")
    }

# ==========================================
# 7. SMART SOS & ML ROUTES
# ==========================================

@app.get("/")
def root():
    return {"status": "VitalGuard Backend Running"}

@app.post("/predict")
def predict(data: VitalSigns):
    if model is None:
        raise HTTPException(status_code=500, detail="ML Model not loaded on server.")

    X = np.array([[getattr(data, f) for f in FEATURES]])
    
    pred = int(model.predict(X)[0])
    probs = model.predict_proba(X)[0]
    risk_score = int(probs[2] * 100) if len(probs) > 2 else int(probs[1] * 100)

    return {
        "prediction": pred,
        "risk_score": risk_score,
        "probabilities": probs.tolist()
    }

@app.get("/api/reverse-geocode")
def reverse_geocode(lat: float, lon: float):
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {"format": "json", "lat": lat, "lon": lon}
    headers = {"User-Agent": "VitalGuard/1.0"}
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=5)
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail="Geocoding service unavailable")

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
    print(f"\n🚨 SOS TRIGGERED | Risk: {data.risk_level} | Loc: {data.location}")
    
    return {
        "status": "SOS triggered successfully",
        "timestamp": timestamp,
        "risk_level": data.risk_level
    }

@app.get("/sos/logs", response_model=List[SOSLog])
def get_sos_logs():
    return SOS_LOGS

# ==========================================
# 8. MAIN EXECUTION
# ==========================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)