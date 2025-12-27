import axios from 'axios';
import { EmergencyContact, NutritionState } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface User {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  age?: number;
  contacts?: EmergencyContact[];
  nutrition?: NutritionState;
  token?: string; 
}

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

export const authService = {

  /**
   * Login: 
   * 1. Posts credentials to /login
   * 2. Saves ONLY Token to LocalStorage
   * 3. Fetches & Returns User Profile (Memory Only)
   */
  login: async (email: string, password: string): Promise<User> => {
    try {
      // 1. Get Token
      const loginResp = await axios.post(`${API_URL}/login`, { email, password });
      const token = loginResp.data.access_token;

      if (!token) throw new Error("No access token received");

      // 2. Save Token Only
      localStorage.setItem('token', token);

      // 3. Fetch User Details
      const userResp = await axios.get(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const backendUser = userResp.data;

      // 4. Return Object (Do NOT save 'user' to localStorage)
      return {
        id: backendUser.id,
        full_name: backendUser.full_name,
        email: backendUser.email,
        phone_number: backendUser.phone_number,
        age: backendUser.age,
        contacts: backendUser.contacts || [],
        nutrition: backendUser.nutrition || DEFAULT_NUTRITION,
        token: token
      };

    } catch (error: any) {
      console.error("Login Error:", error.response?.data || error.message);
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  },

  /**
   * Register: Creates account and auto-logs in
   */
  signup: async (userData: any): Promise<User> => {
    try {
      await axios.post(`${API_URL}/signup`, userData);
      return await authService.login(userData.email, userData.password);
    } catch (error: any) {
      console.error("Signup Error:", error.response?.data || error.message);
      throw new Error(error.response?.data?.detail || 'Registration failed');
    }
  },

  /**
   * Get Raw Token from Storage
   */
  getToken: (): string | null => {
    return localStorage.getItem('token') || localStorage.getItem('smartsos_token');
  },

  /**
   * Update User Profile (PUT /users/me)
   */
  updateUser: async (updates: Partial<User>) => {
    const token = authService.getToken();
    if (!token) throw new Error("No auth token found");

    try {
      const response = await axios.put(`${API_URL}/users/me`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error: any) {
      console.error("Update Error:", error);
      throw error;
    }
  },

  /**
   * Logout: Clears token
   */
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('smartsos_token');
    localStorage.removeItem('user'); // Cleanup legacy data if any
  }
};