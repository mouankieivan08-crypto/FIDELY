import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getBusiness, getCustomers, createCustomer, getPrograms, Program, Customer } from "../services/db";
import Layout from "../components/Layout";
import { Plus, Search, X, Users as UsersIcon } from "lucide-react";
import { Link } from "react-router-dom";

export default function Customers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    programId: "",
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const rest = await getBusiness(user!.uid);
      if (rest) {
        const [custData, progData] = await Promise.all([
          getCustomers(rest.id),
          getPrograms(rest.id)
        ]);
        setCustomers(custData);
        setPrograms(progData);
        if (progData.length > 0) {
          setNewCustomer(prev => ({ ...prev, programId: progData[0].id.toString() }));
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    try {
      const rest = await getBusiness(user!.uid);
      if (rest) {
        await createCustomer(rest.id, {
          name: newCustomer.name,
          phone: newCustomer.phone,
          programId: parseInt(newCustomer.programId)
        });
        setShowModal(false);
        setNewCustomer({ name: "", phone: "", programId: programs[0]?.id.toString() || "" });
        fetchData();
      }
    } catch (error) {
      console.error("Error creating customer:", error);
      setFormError((error as Error).message || "Échec de la création du client.");
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
        <button
          onClick={() => { setFormError(""); setShowModal(true); }}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors w-full sm:w-auto justify-center shadow-sm"
        >
          <Plus className="h-5 w-5 mr-2" />
          Ajouter un client
        </button>
      </div>

      <div className="mb-6 relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm transition-shadow"
          placeholder="Rechercher par nom ou téléphone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
      ) : (
        <div className="bg-white shadow-sm overflow-hidden rounded-xl border border-gray-200">
          <ul className="divide-y divide-gray-100">
            {filteredCustomers.map((customer) => (
              <li key={customer.id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                <Link to={`/card/${customer.id}`} className="block">
                  <div className="px-4 py-4 sm:px-6 flex items-center">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-4 flex-shrink-0">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900 truncate">{customer.name}</p>
                        <div className="ml-2 flex-shrink-0 flex">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            customer.rewardStatus === 'available' ? 'bg-green-100 text-green-800' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {customer.rewardStatus === 'available' ? 'Récompense dispo' : `${customer.visits} visites`}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 flex justify-between items-center">
                        <p className="flex items-center text-sm text-gray-500">
                          {customer.phone}
                        </p>
                        <div className="flex items-center">
                          <p className="text-sm text-gray-400 font-mono text-xs mr-4 hidden sm:block">
                            {customer.id}
                          </p>
                          <span className="text-indigo-600 text-sm font-medium flex items-center">
                            Voir la carte
                            <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            {filteredCustomers.length === 0 && (
              <li className="px-4 py-12 text-center text-gray-500 flex flex-col items-center">
                <UsersIcon className="h-12 w-12 text-gray-300 mb-3" />
                <p>Aucun client trouvé.</p>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 relative shadow-xl">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 hover:bg-gray-100 rounded-full p-1"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold mb-6 text-gray-900">Nouveau client</h2>
            
            {programs.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-red-500 mb-4">Vous devez d'abord créer un programme de fidélité.</p>
                <Link to="/programs" className="text-indigo-600 hover:underline">Aller aux programmes</Link>
              </div>
            ) : (
              <form onSubmit={handleCreateCustomer} className="space-y-5">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded text-sm" role="alert">
                    {formError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nom complet</label>
                  <input
                    type="text"
                    required
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border bg-gray-50 focus:bg-white transition-colors"
                    placeholder="Jean Dupont"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Numéro de téléphone</label>
                  <input
                    type="tel"
                    required
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border bg-gray-50 focus:bg-white transition-colors"
                    placeholder="06 12 34 56 78"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Associer au programme</label>
                  <select
                    required
                    value={newCustomer.programId}
                    onChange={(e) => setNewCustomer({ ...newCustomer, programId: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border bg-gray-50 focus:bg-white transition-colors"
                  >
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end space-x-3 mt-8 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    Créer la carte
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
