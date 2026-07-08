import React, { useState, useRef, useCallback, useEffect } from "react";
import Layout from "../components/Layout";
import Webcam from "react-webcam";
import { Camera, CheckCircle, Clock, Briefcase, Plus, User, Tag, Key, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getRestaurant, getEmployees, createEmployee, Employee } from "../services/db";

export default function Employees() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'list' | 'pointage'>('list');
  const [pointageStatus, setPointageStatus] = useState<'idle' | 'capturing' | 'verifying' | 'success'>('idle');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    phone: '',
    avatarUrl: ''
  });
  const [isCapturingAvatar, setIsCapturingAvatar] = useState(false);
  const avatarWebcamRef = useRef<any>(null);
  
  const webcamRef = useRef<any>(null);

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        try {
          const rest = await getRestaurant(user.uid);
          if (rest) {
            setRestaurantId(rest.id);
            const emps = await getEmployees(rest.id);
            setEmployees(emps);
          }
        } catch (error) {
          console.error("Error loading employees", error);
        } finally {
          setLoading(false);
        }
      }
    };
    loadData();
  }, [user]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    try {
      const newEmp = await createEmployee(restaurantId, formData);
      setEmployees([...employees, newEmp]);
      setShowAddModal(false);
      setFormData({ name: '', role: '', phone: '', avatarUrl: '' });
    } catch (error) {
      console.error("Error creating employee", error);
    }
  };

  const capture = useCallback(() => {
    setPointageStatus('verifying');
    const imageSrc = webcamRef.current?.getScreenshot();
    
    // Simulate liveness detection & GPS & API call
    setTimeout(() => {
      setPointageStatus('success');
      setTimeout(() => setPointageStatus('idle'), 3000);
    }, 2000);
  }, [webcamRef]);

  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Employés</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez votre équipe et les pointages</p>
        </div>
        <div className="flex bg-gray-200 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('pointage')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'pointage' ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Pointage
          </button>
          <button 
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'list' ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Liste
          </button>
        </div>
      </div>

      {activeTab === 'pointage' && (
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 text-center border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Terminal de Pointage</h2>
              <p className="text-sm text-gray-500 mt-1">Vérification de présence par reconnaissance faciale</p>
            </div>
            
            <div className="p-6 bg-gray-50 flex flex-col items-center">
              {pointageStatus === 'idle' || pointageStatus === 'capturing' || pointageStatus === 'verifying' ? (
                <div className="relative rounded-xl overflow-hidden shadow-inner border-2 border-indigo-100 w-full max-w-[300px] aspect-[3/4] bg-black">
                  {/* @ts-ignore */}
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover"
                    videoConstraints={{ facingMode: "user" }}
                  />
                  
                  {/* Overlay scanning effect */}
                  {pointageStatus === 'verifying' && (
                    <div className="absolute inset-0 bg-indigo-500/80 z-10 flex items-center justify-center backdrop-blur-sm">
                      <div className="text-white font-bold flex flex-col items-center p-4 text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-4"></div>
                        <p className="text-sm">Analyse biométrique...</p>
                        <p className="text-xs font-normal opacity-80 mt-1">Vérification de présence et détection de mouvement (anti-fraude)</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full max-w-[300px] aspect-[3/4] bg-green-50 rounded-xl border-2 border-green-200 flex flex-col items-center justify-center">
                  <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                  <h3 className="text-lg font-bold text-green-700">Pointage réussi !</h3>
                  <p className="text-green-600 text-sm mt-1">{new Date().toLocaleTimeString()}</p>
                </div>
              )}

              <div className="mt-8 w-full space-y-3">
                <button
                  onClick={capture}
                  disabled={pointageStatus !== 'idle'}
                  className="w-full flex items-center justify-center px-4 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  <Clock className="w-5 h-5 mr-2" />
                  Pointer mon arrivée
                </button>
                <button
                  onClick={capture}
                  disabled={pointageStatus !== 'idle'}
                  className="w-full flex items-center justify-center px-4 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <Clock className="w-5 h-5 mr-2" />
                  Pointer mon départ
                </button>
              </div>
            </div>
            
            <div className="p-4 bg-white text-xs text-center text-gray-500 border-t border-gray-100">
              Assurez-vous d'être dans le salon. La position GPS sera enregistrée.
            </div>
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <>
          <div className="flex justify-end mb-4">
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un employé
            </button>
          </div>
          
          {loading ? (
            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
          ) : employees.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Aucun employé</h3>
              <p className="text-gray-500 mt-1">Ajoutez votre premier collaborateur pour commencer.</p>
              <button 
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Ajouter un employé
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom complet</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rôle</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Téléphone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 flex items-center">
                          {emp.avatarUrl ? (
                            <img src={emp.avatarUrl} alt={emp.name} className="h-8 w-8 rounded-full object-cover mr-3 border border-gray-200" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-3">
                              {emp.name ? emp.name.charAt(0).toUpperCase() : '?'}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                            {emp.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {emp.phone || 'Non renseigné'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Nouvel Employé</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddEmployee} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="Prénom et Nom"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Tag className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="Ex: Coiffeur(se)"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Photo de profil</label>
                  {formData.avatarUrl ? (
                    <div className="flex flex-col items-center">
                      <img src={formData.avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover mb-2 border-2 border-indigo-100" />
                      <button type="button" onClick={() => setFormData({...formData, avatarUrl: ''})} className="text-xs text-red-500 hover:underline">Reprendre</button>
                    </div>
                  ) : isCapturingAvatar ? (
                    <div className="flex flex-col items-center">
                      <div className="w-full max-w-[200px] rounded-lg overflow-hidden mb-2">
                        {/* @ts-ignore */}
                        <Webcam
                          audio={false}
                          ref={avatarWebcamRef}
                          screenshotFormat="image/jpeg"
                          className="w-full h-auto"
                          videoConstraints={{ facingMode: "user" }}
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button type="button" onClick={() => {
                          const src = avatarWebcamRef.current?.getScreenshot();
                          if (src) setFormData({...formData, avatarUrl: src});
                          setIsCapturingAvatar(false);
                        }} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">Capturer</button>
                        <button type="button" onClick={() => setIsCapturingAvatar(false)} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm">Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setIsCapturingAvatar(true)} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors flex flex-col items-center justify-center">
                      <Camera className="h-6 w-6 mb-1 text-gray-400" />
                      <span className="text-sm font-medium">Prendre une photo</span>
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="06 12 34 56 78"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Numéro pour le contacter en cas de besoin.</p>
                </div>
              </div>
              
              <div className="mt-6">
                <button
                  type="submit"
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Créer l'employé
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
