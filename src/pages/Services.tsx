import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { Plus, Search, Tag, Clock, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getBusiness, getServices, createService } from "../services/db";

export default function Services() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState("");
  const [servicesList, setServicesList] = useState<any[]>([]);
  const [businessId, setBusinessId] = useState<number | null>(null);
  const categories = Array.from(new Set(servicesList.map((s: any) => s.category).filter(Boolean)));

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    duration: ''
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
        setBusinessId(rest.id);
        const svcs = await getServices(rest.id);
        setServicesList(svcs);
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setFormError("");
    try {
      const newSvc = await createService(businessId, {
        name: formData.name,
        category: formData.category,
        price: parseInt(formData.price) * 100, // store in cents
        duration: parseInt(formData.duration)
      });
      setServicesList([...servicesList, newSvc]);
      setShowModal(false);
      setFormData({ name: '', category: '', price: '', duration: '' });
    } catch (error) {
      console.error("Error creating service:", error);
      setFormError((error as Error).message || "Échec de la création de la prestation.");
    }
  };

  return (
    <Layout>
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Prestations</h1>
          <p className="text-sm text-gray-500 mt-1">Catalogue de vos services et tarifs</p>
        </div>
        <button
          onClick={() => { setFormError(""); setShowModal(true); }}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
        >
          <Plus className="h-4 w-4 mr-2" /> Nouvelle Prestation
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Categories */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 px-2">Catégories</h2>
            <nav className="space-y-1">
              <a href="#" className="block px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
                Toutes les prestations
              </a>
              {categories.map((cat, i) => (
                <a key={i} href="#" className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors">
                  {cat}
                </a>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="mb-6 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm transition-shadow"
              placeholder="Rechercher une prestation..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {servicesList.length === 0 ? (
              <div className="col-span-full bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                <p className="text-gray-500">Aucune prestation n'a été ajoutée.</p>
              </div>
            ) : (
              servicesList.map((service, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer group">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{service.name}</h3>
                    <span className="text-lg font-bold text-gray-900 bg-gray-50 px-2 py-1 rounded-md">{service.price / 100} FCFA</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-500 space-x-4 mt-3">
                    <div className="flex items-center">
                      <Tag className="h-4 w-4 mr-1 text-gray-400" />
                      {service.category}
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1 text-gray-400" />
                      {service.duration} min
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Nouvelle Prestation</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateService} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded text-sm" role="alert">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-gray-300 rounded-lg shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                <input
                  type="text"
                  required
                  list="service-categories"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full border-gray-300 rounded-lg shadow-sm"
                  placeholder="Ex: Coiffure, Réparation, Consultation..."
                />
                <datalist id="service-categories">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix (FCFA)</label>
                  <input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full border-gray-300 rounded-lg shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durée (min)</label>
                  <input type="number" required value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className="w-full border-gray-300 rounded-lg shadow-sm" />
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
