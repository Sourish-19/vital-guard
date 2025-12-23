import React, { useState } from "react";
import { getPrediction, VitalData, PredictionResult } from "../services/api";
import axios from "axios";

const API_URL = "https://vitalgaurd-1.onrender.com";

const VitalForm: React.FC = () => {
  const [formData, setFormData] = useState<VitalData>({
    heart_rate: 0,
    spo2: 0,
    bp_sys: 0,
    bp_dia: 0,
    temperature_c: 0,
    resp_rate: 0,
    blood_sugar_mg_dl: 0,
    age: 0,
  });

  const [result, setResult] = useState<PredictionResult | null>(null);
  const [status, setStatus] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: Number(e.target.value),
    });
  };

  // 🔴 AUTO SOS FUNCTION
  const triggerSOS = async (riskLevel: string) => {
    try {
      const lat = 13.0787;
      const lon = 77.5857;

      // reverse geocode via backend
      const locationRes = await axios.get(
        `${API_URL}/api/reverse-geocode?lat=${lat}&lon=${lon}`
      );

      const location = locationRes.data.display_name;

      await axios.post(`${API_URL}/sos`, {
        risk_level: riskLevel,
        location,
        vitals: formData,
      });

      setStatus("🚨 SOS triggered automatically!");
    } catch (error) {
      console.error("SOS failed:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const prediction = await getPrediction(formData);
      setResult(prediction);

      // 🔥 Risk logic
      let riskLevel = "LOW";
      if (prediction.risk_score >= 70) riskLevel = "HIGH";
      else if (prediction.risk_score >= 40) riskLevel = "MEDIUM";

      setStatus(`Risk Level: ${riskLevel}`);

      // 🚨 AUTO SOS
      if (riskLevel === "HIGH") {
        await triggerSOS(riskLevel);
      }
    } catch (error) {
      console.error("Prediction failed:", error);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <input name="heart_rate" type="number" placeholder="Heart Rate" onChange={handleChange} />
        <input name="spo2" type="number" placeholder="SpO2" onChange={handleChange} />
        <input name="bp_sys" type="number" placeholder="BP Systolic" onChange={handleChange} />
        <input name="bp_dia" type="number" placeholder="BP Diastolic" onChange={handleChange} />
        <input name="temperature_c" type="number" placeholder="Temperature (°C)" onChange={handleChange} />
        <input name="resp_rate" type="number" placeholder="Respiratory Rate" onChange={handleChange} />
        <input name="blood_sugar_mg_dl" type="number" placeholder="Blood Sugar" onChange={handleChange} />
        <input name="age" type="number" placeholder="Age" onChange={handleChange} />

        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
          Predict
        </button>
      </form>

      {result && (
        <div className="p-4 border rounded">
          <h3>Prediction Class: {result.prediction}</h3>
          <p>Risk Score: {result.risk_score}%</p>
          <p>Status: {status}</p>
        </div>
      )}
    </div>
  );
};

export default VitalForm;
