import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getRestaurant, getPrograms, createProgram, Program } from "../services/db";
import Layout from "../components/Layout";
import { Plus, Trash2 } from "lucide-react";

export default function Programs() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState("");
  const [newProgram, setNewProgram] = useState({
    name: "",
    visitsRequired: 5,
    rewardDescription: "",
  });

  useEffect(() => {
    if (user) {
      fetchPrograms();
    }
  }, [user]);

  const fetchPrograms = async () => {
    try {
      const rest = await getRestaurant(user!.uid);
      if (rest) {
        const data = await getPrograms(rest.id);
        setPrograms(data);
      }
    } catch (error) {
      console.error("Error fetching programs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    try {
      const rest = await getRestaurant(user!.uid);
      if (rest) {
        await createProgram(rest.id, newProgram);
        setShowModal(false);
        setNewProgram({ name: "", visitsRequired: 5, rewardDescription: "" });
        fetchPrograms();
      }
    } catch (error) {
      console.error("Error creating program:", error);
      setFormError((error as Error).message || "Échec de la création du programme.");
    }
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Programmes de fidélité</h1>
        <button
          onClick={() => { setFormError(""); setShowModal(true); }}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouveau programme
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <div key={program.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{program.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{program.visitsRequired} visites requises</p>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">Actif</span>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700">Récompense :</p>
                <p className="text-sm text-gray-600">{program.rewardDescription}</p>
              </div>
            </div>
          ))}
          {programs.length === 0 && (
            <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <p className="text-gray-500">Aucun programme pour le moment. Créez votre premier !</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Créer un nouveau programme</h2>
            {formError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded text-sm" role="alert">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreateProgram} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nom du programme</label>
                <input
                  type="text"
                  required
                  value={newProgram.name}
                  onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  placeholder="Ex: Menu Midi Offert"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Visites requises</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newProgram.visitsRequired}
                  onChange={(e) => setNewProgram({ ...newProgram, visitsRequired: parseInt(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description de la récompense</label>
                <input
                  type="text"
                  required
                  value={newProgram.rewardDescription}
                  onChange={(e) => setNewProgram({ ...newProgram, rewardDescription: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  placeholder="Ex: Un café gratuit"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Créer le programme
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
