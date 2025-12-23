import React, { useState } from "react";
import { getPrediction, VitalData, PredictionResult } from "../services/api";

const VitalForm: React.FC = () => {
  const [formData, setFormData] = useState<VitalData>({
    heart_rate: 0,
    spo2: 0,
    bp_sys: 0,
    bp_dia: 0,
    temperature: 0,
  });

  const [result, setResult] = useState<PredictionResult | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: Number(e.target.value),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const prediction = await getPrediction(formData);
      setResult(prediction);
    } catch (error) {
      console.error("Error fetching prediction:", error);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input type="number" name="heart_rate" value={formData.heart_rate} onChange={handleChange} placeholder="Heart Rate" />
        <input type="number" name="spo2" value={formData.spo2} onChange={handleChange} placeholder="SpO2" />
        <input type="number" name="bp_sys" value={formData.bp_sys} onChange={handleChange} placeholder="BP Sys" />
        <input type="number" name="bp_dia" value={formData.bp_dia} onChange={handleChange} placeholder="BP Dia" />
        <input type="number" name="temperature" value={formData.temperature} onChange={handleChange} placeholder="Temperature" />
        <button type="submit">Predict</button>
      </form>

      {result && (
        <div>
          <h3>Prediction: {result.prediction}</h3>
          <p>Risk Score: {result.risk_score}%</p>
          <p>Probabilities: {result.probabilities.join(", ")}</p>
        </div>
      )}
    </div>
  );
};

export default VitalForm;
