import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { recordVisit, getCustomer, getBusiness, getServices, Customer } from "../services/db";
import Layout from "../components/Layout";
import QRScanner from "../components/QRScanner";
import { CheckCircle, XCircle, AlertTriangle, Star, X } from "lucide-react";

const fmt = (n: number) => (n ?? 0).toLocaleString("fr-FR");
const pointsFor = (priceCents: number) => Math.round(priceCents / 100000);

export default function Scanner() {
  const { user } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [scanned, setScanned] = useState<Customer | null>(null);
  const [chosenService, setChosenService] = useState("");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ name: string; msg: string; reward: boolean } | null>(null);
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      getBusiness(user.id).then(rest => { if (rest) getServices(rest.id).then(setServices); });
    }
  }, [user]);

  const handleScan = async (decodedText: string) => {
    if (decodedText === lastScannedId || scanned) return;
    setLastScannedId(decodedText);
    setError("");
    setSuccess(null);
    try {
      const customer = await getCustomer(decodedText);
      if (!customer) { setError("Client introuvable."); setTimeout(() => setLastScannedId(null), 2000); return; }
      setScanned(customer);
      setChosenService("");
    } catch (err: any) {
      setError(err.message || "Échec du scan.");
      setTimeout(() => setLastScannedId(null), 2000);
    }
  };

  const reset = () => {
    setScanned(null);
    setChosenService("");
    setError("");
    setLastScannedId(null);
  };

  const handleValidate = async () => {
    if (!scanned || !chosenService) { setError("Choisissez une prestation."); return; }
    setValidating(true);
    setError("");
    try {
      const res = await recordVisit(scanned.id, [{ serviceId: parseInt(chosenService) }]);
      setSuccess({
        name: scanned.name,
        msg: `+${res.earnedPoints} points (${res.serviceName || "prestation"}) · Total : ${res.newPoints} pts, ${res.newVisits} visites`,
        reward: res.newRewardStatus === "available",
      });
      setScanned(null);
      setChosenService("");
      setTimeout(() => setLastScannedId(null), 3000);
    } catch (err: any) {
      setError(err.message || "Échec de la validation.");
    } finally { setValidating(false); }
  };

  const selectedService = services.find(s => s.id === parseInt(chosenService));

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Valider une visite</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Scannez la carte du client, choisissez la prestation, validez.</p>

        {!scanned && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
            <QRScanner onScan={handleScan} onError={(err) => console.log(err)} />
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl border bg-red-50 border-red-200 flex items-start mb-4">
            <XCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-5 rounded-xl border bg-green-50 border-green-200 mb-4">
            <div className="flex items-start">
              <CheckCircle className="h-6 w-6 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-bold text-green-800">Visite validée !</h3>
                <p className="text-sm text-green-700 mt-1">Client : <strong>{success.name}</strong></p>
                <p className="text-sm text-green-700">{success.msg}</p>
                {success.reward && (
                  <div className="mt-2 flex items-center p-2 bg-green-100 rounded border border-green-200 text-green-800 font-bold text-sm">
                    <AlertTriangle className="h-4 w-4 mr-2" /> RÉCOMPENSE DISPONIBLE !
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => setSuccess(null)} className="mt-3 text-sm text-green-700 font-medium hover:underline">Scanner un autre client</button>
          </div>
        )}

        {scanned && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-900">{scanned.name}</h3>
                <p className="text-xs text-gray-500 font-mono">{scanned.cardNumber || scanned.id}</p>
              </div>
              <button onClick={reset} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-4 text-sm">
                <div className="flex items-center text-indigo-600 font-bold"><Star className="h-4 w-4 mr-1 text-amber-400" />{fmt(scanned.points)} pts</div>
                <div className="text-gray-600">{scanned.visits} visites</div>
              </div>
              {services.length === 0 ? (
                <p className="text-sm text-amber-600">Ajoutez d'abord des prestations pour valider une visite.</p>
              ) : (
                <>
                  <select value={chosenService} onChange={e => setChosenService(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm text-sm">
                    <option value="">Choisir la prestation réalisée...</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} — {fmt(s.price / 100)} FCFA</option>)}
                  </select>
                  {selectedService && (
                    <p className="text-xs text-gray-600">Points gagnés : <strong className="text-indigo-600">+{pointsFor(selectedService.price)}</strong></p>
                  )}
                  <button onClick={handleValidate} disabled={validating || !chosenService}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50">
                    {validating ? "Validation..." : "Valider la visite"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
