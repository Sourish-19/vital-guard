import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { EmergencyLog as EmergencyLogEntry } from "../types";
import { sendSOS, getReverseGeocode } from "../services/api";

interface EmergencyLogProps {
  logs?: EmergencyLogEntry[];
}

const EmergencyLog: React.FC<EmergencyLogProps> = ({ logs = [] }) => {
  const [sending, setSending] = useState(false);
  const [location, setLocation] = useState<string>("");

  const handleSOS = async () => {
    if (sending) return;
    setSending(true);

    try {
      const vitals = {
        heart_rate: 120,
        spo2: 88,
        bp_sys: 150,
        bp_dia: 95,
        temperature_c: 39.2,
        resp_rate: 28,
        blood_sugar_mg_dl: 180,
        age: 25,
      };

      // Get current position
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        }
      );

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      // Reverse geocode
      const geo = await getReverseGeocode(lat, lon);
      const address = geo.display_name || "Unknown location";
      setLocation(address);

      // Send SOS
      await sendSOS({
        risk_level: "HIGH",
        location: address,
        vitals,
      });

      alert(`🚨 SOS SENT\n📍 ${address}`);
    } catch (err) {
      console.error("SOS failed:", err);
      alert("❌ Failed to send SOS");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={handleSOS}
        disabled={sending}
        className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60"
      >
        <AlertTriangle />
        {sending ? "Sending SOS..." : "SOS Emergency"}
      </button>

      {location && (
        <p className="text-sm text-slate-600">
          📍 Last SOS Location: {location}
        </p>
      )}

      <table className="w-full border mt-6">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-3 py-2">Event</th>
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center py-4 text-sm text-gray-500">
                No emergency logs available
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} className="border-t text-sm">
                <td className="px-3 py-2">{log.type}</td>
                <td className="px-3 py-2">{log.timestamp}</td>
                <td className="px-3 py-2">
                  {log.resolved ? "Resolved" : "Active"}
                </td>
                <td className="px-3 py-2">{log.notes}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default EmergencyLog;
