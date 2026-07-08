import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { recordVisit, getCustomer, Customer } from "../services/db";
import Layout from "../components/Layout";
import QRScanner from "../components/QRScanner";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export default function Scanner() {
  const { user } = useAuth();
  const [scanResult, setScanResult] = useState<{
    status: "success" | "error" | "idle";
    message: string;
    customer?: Customer;
  }>({ status: "idle", message: "" });
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);

  const handleScan = async (decodedText: string) => {
    if (decodedText === lastScannedId) return; // Prevent rapid duplicate scans
    setLastScannedId(decodedText);

    try {
      const customer = await getCustomer(decodedText);
      if (!customer) {
        setScanResult({ status: "error", message: "Client introuvable." });
        return;
      }

      const result = await recordVisit(decodedText, customer.restaurantId, user!.uid);
      
      setScanResult({
        status: "success",
        message: `Visite enregistrée ! Total de visites : ${result.newVisits}`,
        customer: { ...customer, visits: result.newVisits, rewardStatus: result.newRewardStatus }
      });

      setTimeout(() => setLastScannedId(null), 5000);

    } catch (error: any) {
      setScanResult({ status: "error", message: error.message || "Échec du scan." });
      setTimeout(() => setLastScannedId(null), 2000);
    }
  };

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">Scanner de carte</h1>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
          <QRScanner onScan={handleScan} onError={(err) => console.log(err)} />
        </div>

        {scanResult.status !== "idle" && (
          <div className={`p-5 rounded-xl border flex items-start shadow-sm animate-in fade-in slide-in-from-bottom-2 ${
            scanResult.status === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
          }`}>
            {scanResult.status === "success" ? (
              <CheckCircle className="h-6 w-6 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <h3 className={`text-lg font-bold ${
                scanResult.status === "success" ? "text-green-800" : "text-red-800"
              }`}>
                {scanResult.status === "success" ? "Succès !" : "Erreur"}
              </h3>
              <p className={`mt-1 text-sm ${
                scanResult.status === "success" ? "text-green-700" : "text-red-700"
              }`}>
                {scanResult.message}
              </p>
              {scanResult.customer && (
                <div className="mt-3 text-sm text-green-700 bg-white/50 p-3 rounded-lg">
                  <p>Client : <strong>{scanResult.customer.name}</strong></p>
                  {scanResult.customer.rewardStatus === "available" && (
                    <div className="mt-2 flex items-center p-2 bg-green-100 rounded border border-green-200 text-green-800 font-bold">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      RÉCOMPENSE DISPONIBLE !
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
