import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getCustomer, getPrograms, getVisits, Customer, Program, Visit } from "../services/db";
import QRCodeDisplay from "../components/QRCodeDisplay";
import { CreditCard, CheckCircle, Gift, Calendar } from "lucide-react";

export default function CustomerView() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id) {
      fetchData(id);
    }
  }, [id]);

  const fetchData = async (customerId: string) => {
    try {
      const cust = await getCustomer(customerId);
      if (cust) {
        setCustomer(cust);
        const programs = await getPrograms(cust.businessId);
        const prog = programs.find((p: Program) => p.id === cust.programId);
        setProgram(prog || null);
        
        const visitsData = await getVisits(customerId);
        visitsData.sort((a: Visit, b: Visit) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setVisits(visitsData);
      } else {
        setError("Carte introuvable.");
      }
    } catch (err) {
      setError("Échec du chargement de la carte.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  if (error || !customer) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-600 font-medium">{error || "Carte introuvable"}</div>;

  const progress = Math.min((customer.visits / (program?.visitsRequired || 1)) * 100, 100);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-indigo-600 p-8 text-center relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-indigo-500 rounded-full opacity-50"></div>
          <div className="absolute -left-10 -bottom-10 w-24 h-24 bg-indigo-500 rounded-full opacity-50"></div>
          
          <CreditCard className="h-14 w-14 text-white mx-auto mb-3 relative z-10" />
          <h1 className="text-2xl font-bold text-white relative z-10">Carte FIDELY</h1>
          <p className="text-indigo-100 mt-1 font-medium relative z-10 text-lg">{customer.name}</p>
        </div>

        <div className="p-8 flex flex-col items-center">
          <QRCodeDisplay value={customer.id} size={220} />
          <p className="mt-4 text-xs text-gray-400 font-mono tracking-wider">{customer.id}</p>

          <div className="w-full mt-6 flex justify-center space-x-3">
            <button 
              onClick={() => window.print()}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors shadow-sm"
            >
              Télécharger PDF
            </button>
            <button 
              onClick={() => {
                const url = window.location.href;
                window.open(`https://wa.me/?text=${encodeURIComponent('Voici votre carte de fidélité: ' + url)}`, '_blank');
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors shadow-sm flex items-center"
            >
              WhatsApp
            </button>
          </div>

          <div className="w-full mt-8">
            <div className="flex justify-between items-end mb-3">
              <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Progression</span>
              <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                {customer.visits} / {program?.visitsRequired || "?"} visites
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden shadow-inner">
              <div 
                className="bg-indigo-600 h-4 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {customer.rewardStatus === "available" && (
            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center w-full shadow-sm animate-pulse">
              <Gift className="h-8 w-8 text-green-600 mr-4" />
              <div>
                <h3 className="text-lg font-bold text-green-800">Récompense débloquée !</h3>
                <p className="text-sm text-green-700 font-medium">{program?.rewardDescription}</p>
              </div>
            </div>
          )}

          {program && (
            <div className="mt-8 p-4 bg-gray-50 rounded-xl w-full border border-gray-100">
              <p className="text-sm font-semibold text-gray-800 mb-1">Programme : {program.name}</p>
              <p className="text-sm text-gray-600">
                Collectez <span className="font-bold text-indigo-600">{program.visitsRequired}</span> visites pour obtenir : <br/>
                <span className="font-medium text-gray-800">{program.rewardDescription}</span>
              </p>
            </div>
          )}
        </div>

        {/* Recent Visits */}
        <div className="bg-gray-50 p-6 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center uppercase tracking-wide">
            <Calendar className="h-4 w-4 mr-2 text-indigo-500" />
            Dernières visites
          </h3>
          <div className="space-y-3">
            {visits.length === 0 ? (
              <p className="text-sm text-gray-500 italic text-center py-2">Aucune visite pour le moment.</p>
            ) : (
              visits.slice(0, 5).map((visit) => (
                <div key={visit.id} className="flex justify-between items-center text-sm p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                  <span className="text-gray-700 font-medium">
                    {new Date(visit.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  <span className="text-green-600 font-medium flex items-center text-xs bg-green-50 px-2 py-1 rounded">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Vérifié
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <p className="mt-8 text-gray-400 text-sm font-medium">Propulsé par FIDELY</p>
    </div>
  );
}
