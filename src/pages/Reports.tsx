import React, { useState } from "react";
import Layout from "../components/Layout";
import { Download, FileText, TrendingUp, Users, CreditCard, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { name: 'Jan', ca: 0 },
  { name: 'Fév', ca: 0 },
  { name: 'Mar', ca: 0 },
  { name: 'Avr', ca: 0 },
  { name: 'Mai', ca: 0 },
  { name: 'Juin', ca: 0 },
];

export default function Reports() {
  const [showModal, setShowModal] = useState(false);

  return (
    <Layout>
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Rapports</h1>
          <p className="text-sm text-gray-500 mt-1">Générez et exportez vos statistiques</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-sm text-sm font-medium"
        >
          <Download className="h-4 w-4 mr-2" /> Exporter (PDF)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start space-x-4">
          <div className="bg-indigo-50 p-3 rounded-xl">
            <FileText className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Bilan Mensuel</h3>
            <p className="text-xs text-gray-500 mt-1 mb-2">Résumé des activités du mois en cours.</p>
            <button onClick={() => setShowModal(true)} className="text-sm text-indigo-600 font-medium hover:underline">Générer le rapport</button>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start space-x-4">
          <div className="bg-green-50 p-3 rounded-xl">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Promotions</h3>
            <p className="text-xs text-gray-500 mt-1 mb-2">Performances des offres et remises.</p>
            <button onClick={() => setShowModal(true)} className="text-sm text-indigo-600 font-medium hover:underline">Générer le rapport</button>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start space-x-4">
          <div className="bg-amber-50 p-3 rounded-xl">
            <Users className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Fidélité & Clients</h3>
            <p className="text-xs text-gray-500 mt-1 mb-2">Acquisition, rétention et récompenses.</p>
            <button onClick={() => setShowModal(true)} className="text-sm text-indigo-600 font-medium hover:underline">Générer le rapport</button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Évolution annuelle du Chiffre d'Affaires</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#a3a3a3', fontSize: 12}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#a3a3a3', fontSize: 12}} />
              <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="ca" name="CA (€)" fill="#d4af37" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Génération de rapport</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 text-center">
              <p className="text-sm text-gray-500 mb-4">La génération de rapports PDF sera disponible prochainement.</p>
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
