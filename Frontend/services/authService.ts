import { NutritionState } from '../types';

// ==========================================
// 1. Interfaces & Configuration
// ==========================================

export interface User {
  id: string;
  email: string;
  full_name: string;    // Matches Backend Pydantic
  phone_number: string; // Matches Backend Pydantic
  age?: number;
  telegramBotToken?: string;
  telegramChatId?: string;
  contacts?: EmergencyContact[]
  nutrition?: NutritionState;
}

// Change this if your backend is running on a different port/URL
const API_URL = import.meta.env.VITE_API_URL; 

const TOKEN_KEY = 'smartsos_token';
const USER_KEY = 'smartsos_user';

const DEFAULT_NUTRITION: NutritionState = {
  isConfigured: false,
  weight: 0,
  height: 0,
  goal: 'maintain',
  activityLevel: 'light',
  dailyCalorieTarget: 2000,
  caloriesConsumed: 0,
  macros: { protein: 0, carbs: 0, fats: 0 },
  meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
  waterIntake: 0
};

// ==========================================
// 2. Auth Service
// ==========================================

export const authService = {

  /**
   * Initialize: Check if a token exists and validate it against the backend.
   */
  async init() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        await this.fetchCurrentUser(token);
      } catch (e) {
        console.warn("Auto-login failed:", e);
        this.logout();
      }
    }
  },

  /**
   * Login: Hits POST /login
   */
  async login(email: string, password: string): Promise<User> {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Login failed');
    }

    const data = await response.json();
    const token = data.access_token;

    // Save token and fetch full user details
    localStorage.setItem(TOKEN_KEY, token);
    return await this.fetchCurrentUser(token);
  },

  /**
   * Register: Hits POST /signup
   */
  async register(email: string, password: string, full_name: string, age: number, phone_number: string): Promise<User> {
    const response = await fetch(`${API_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        full_name,
        age,
        phone_number
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Registration failed');
    }

    // Auto-login after successful registration
    return await this.login(email, password);
  },

  /**
   * Logout: Clears local storage
   */
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/'; 
  },

  /**
   * Fetch User: Hits GET /users/me using the JWT token
   */
  async fetchCurrentUser(token: string): Promise<User> {
    const response = await fetch(`${API_URL}/users/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user details');
    }

    const userData = await response.json();

    // Map backend response to frontend User object
    const user: User = {
      id: userData.id,
      email: userData.email,
      full_name: userData.full_name,
      phone_number: userData.phone_number,
      age: userData.age,
      nutrition: DEFAULT_NUTRITION // Default value since backend doesn't persist this yet
    };

    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  },

  /**
   * Helper: Get currently stored user (Synchronous)
   */
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  },

  /**
   * Helper: Get raw JWT token
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Update User: Hits PUT /users/me to persist changes to MongoDB
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const token = this.getToken();
    if (!token) throw new Error("No token found");

    // 1. Call the Backend to update database
    const response = await fetch(`${API_URL}/users/me`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update profile');
    }

    // 2. Get the updated user data returned from the backend
    const updatedBackendData = await response.json();

    // 3. Merge with local state 
    // (We merge to preserve fields like 'nutrition' which might not be in the backend response yet)
    const currentUser = this.getCurrentUser();
    const mergedUser: User = { 
        ...currentUser!, // Assert existing user is not null
        ...updatedBackendData, 
        nutrition: currentUser?.nutrition || DEFAULT_NUTRITION
    };
    
    // 4. Update Local Storage so the UI reflects changes immediately
    localStorage.setItem(USER_KEY, JSON.stringify(mergedUser));
    
    return mergedUser;
  }
};