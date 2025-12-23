import React, { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import type { EmergencyLog as EmergencyLogEntry } from "../types";
import { getReverseGeocode, sendSOS } from "../services/api";

interface EmergencyLogProps {
  logs?: EmergencyLogEntry[];
}

// ✅ Promise wrapper for geolocation
const getCurrentLocation = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
    } else {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    }
  });

const EmergencyLog: React.FC<EmergencyLogProps> = ({ logs = [] }) => {
  const [sending, setSending] = useState(false);
  const [location, setLocation] = useState<string | null>(null);

  // Handle SOS sending
  const handleSOS = async () => {
    if (sending) return;

    setSending(true);

    try {
      const vitals = {
        heart_rate: 120,
        spo2: 88,
        bp_sys: 150,
        bp_dia: 95,
        blood_sugar_mg_dl: 180,
        temperature_c: 39.2,
        resp_rate: 28,
        age: 25,
      };

      // Get the current location
      const position = await getCurrentLocation();
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      // Reverse geocode the coordinates
      const geo = await getReverseGeocode(lat, lon);
      const address = geo.display_name || "Unknown location";
      setLocation(address);

      // Send the SOS with the gathered data
      await sendSOS({
        risk_level: "HIGH",
        location: address,
        vitals,
      });

      alert(`🚨 SOS SENT SUCCESSFULLY\n📍 ${address}`);
    } catch (err: any) {
      console.error("❌ SOS failed:", err.message || err);
      alert("❌ Failed to send SOS");
    } finally {
      setSending(false);
    }
  };

  // Optionally log the logs to the console or fetch logs
  useEffect(() => {
    console.log("EmergencyLog rendered", logs);
  }, [logs]);

  return (
    <div className="space-y-6 p-4">
      {/* SOS Button */}
      <button
        onClick={handleSOS}
        disabled={sending}
        className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60"
      >
        <AlertTriangle />
        {sending ? "Sending SOS..." : "SOS Emergency"}
      </button>

      {/* Display last known location */}
      {location && (
        <p className="text-sm text-slate-500">
          📍 Last SOS Location: {location}
        </p>
      )}

      {/* Emergency Log Table */}
      <table className="w-full mt-6 border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-2 py-1">Event</th>
            <th className="px-2 py-1">Time</th>
            <th className="px-2 py-1">Status</th>
            <th className="px-2 py-1">Notes</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-2 py-3 text-center text-sm text-slate-500">
                No logs available.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} className="text-sm border-t">
                <td className="px-2 py-1">{log.type}</td>
                <td className="px-2 py-1">{log.timestamp}</td>
                <td className="px-2 py-1">
                  {log.resolved ? "Resolved" : "Active"}
                </td>
                <td className="px-2 py-1">{log.notes}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default EmergencyLog;
