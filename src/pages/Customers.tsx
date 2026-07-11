import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  getBusiness, getCustomers, createCustomer, getPrograms, getServices, getVisits, recordVisit,
  Program, Customer,
} from "../services/db";
import Layout from "../components/Layout";
import { Plus, Search, X, Users as UsersIcon, Award, CheckCircle, Star, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";

const fmt = (n: number) => (n ?? 0).toLocaleString("fr-FR");
const pointsFor = (priceCents: number) => Math.round(priceCents / 100000); // 1 pt / 1000 FCFA

export default function Customers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", programId: "" });

  // Detail / validation state
  const [selected, setSelected] = useState<Customer | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [chosenService, setChosenService] = useState("");
  const [validating, setValidating] = useState(false);
  const [validateMsg, setValidateMsg] = useState("");
  const [detailError, setDetailError] = useState("");

  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    try {
      const rest = await getBusiness(user!.id);
      if (rest) {
        setBusinessId(rest.id);
        const [custData, progData, svcData] = await Promise.all([
          getCustomers(rest.id), getPrograms(rest.id), getServices(rest.id),
        ]);
        setCustomers(custData);
        setPrograms(progData);
        setServices(svcData);
        if (progData.length > 0) setNewCustomer(prev => ({ ...prev, programId: progData[0].id.toString() }));
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    try {
      if (!businessId) return;
      await createCustomer(businessId, {
        name: newCustomer.name, phone: newCustomer.phone, programId: parseInt(newCustomer.programId),
      });
      setShowModal(false);
      setNewCustomer({ name: "", phone: "", programId: programs[0]?.id.toString() || "" });
      fetchData();
    } catch (error) {
      setFormError((error as Error).message || "Échec de la création du client.");
    }
  };

  const openDetail = async (c: Customer) => {
    setSelected(c);
    setChosenService("");
    setValidateMsg("");
    setDetailError("");
    setHistory([]);
    try {
      const v = await getVisits(c.id);
      v.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setHistory(v);
    } catch (e) { console.error(e); }
  };

  const handleValidate = async () => {
    if (!selected || !chosenService) { setDetailError("Choisissez une prestation."); return; }
    setValidating(true);
    setDetailError("");
    setValidateMsg("");
    try {
      const res = await recordVisit(selected.id, { serviceId: parseInt(chosenService) });
      setValidateMsg(`Visite validée ! +${res.earnedPoints} points (${res.serviceName || "prestation"}). Total : ${res.newPoints} pts, ${res.newVisits} visites.`);
      // Refresh customer row + history
      const updated = { ...selected, points: res.newPoints, visits: res.newVisits, rewardStatus: res.newRewardStatus };
      setSelected(updated);
      setCustomers(prev => prev.map(c => c.id === selected.id ? updated : c));
      const v = await getVisits(selected.id);
      v.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setHistory(v);
      setChosenService("");
    } catch (err) {
      setDetailError((err as Error).message || "Échec de la validation.");
    } finally { setValidating(false); }
  };

  const q = searchTerm.trim().toLowerCase();
  const filteredCustomers = customers.filter(c =>
    !q || c.name.toLowerCase().includes(q) || (c.phone || "").includes(searchTerm) ||
    (c.cardNumber || "").toLowerCase().includes(q)
  );

  const selectedService = services.find(s => s.id === parseInt(chosenService));

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">Recherchez un client, validez une visite, consultez l'historique</p>
        </div>
        <button onClick={() => { setFormError(""); setShowModal(true); }}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors w-full sm:w-auto justify-center shadow-sm">
          <Plus className="h-5 w-5 mr-2" /> Ajouter un client
        </button>
      </div>

      <div className="mb-6 relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm shadow-sm"
          placeholder="Rechercher par nom, téléphone ou ID (ex: D445)..." />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
      ) : (
        <div className="bg-white shadow-sm overflow-hidden rounded-xl border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-6 py-3">Client</th>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3 text-center">Points</th>
                  <th className="px-6 py-3 text-center">Visites</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(customer)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-3">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{customer.name}</p>
                          <p className="text-xs text-gray-500">{customer.phone}</p>
                        </div>
                        {customer.rewardStatus === "available" && (
                          <span className="ml-3 px-2 py-0.5 text-[11px] font-medium rounded-full bg-green-100 text-green-800 flex items-center">
                            <Award className="h-3 w-3 mr-1" /> Récompense
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className="font-mono text-sm font-semibold text-gray-700">{customer.cardNumber || "—"}</span></td>
                    <td className="px-6 py-4 text-center"><span className="inline-flex items-center text-sm font-bold text-indigo-600"><Star className="h-3.5 w-3.5 mr-1 text-amber-400" />{fmt(customer.points)}</span></td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-gray-700">{customer.visits}</td>
                    <td className="px-6 py-4 text-right"><span className="text-indigo-600 text-sm font-medium">Ouvrir →</span></td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    <UsersIcon className="h-12 w-12 text-gray-300 mb-3 mx-auto" /> Aucun client trouvé.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Client detail + validation */}
      {selected && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 sticky top-0">
              <h3 className="text-lg font-bold text-gray-900">{selected.name}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-400">Téléphone</p><p className="font-medium text-gray-900">{selected.phone}</p></div>
                <div><p className="text-gray-400">Carte fidélité</p><p className="font-mono font-semibold text-gray-900 flex items-center"><CreditCard className="h-4 w-4 mr-1 text-indigo-500" />{selected.cardNumber || "—"}</p></div>
                <div><p className="text-gray-400">Points</p><p className="font-bold text-indigo-600 flex items-center"><Star className="h-4 w-4 mr-1 text-amber-400" />{fmt(selected.points)}</p></div>
                <div><p className="text-gray-400">Visites</p><p className="font-bold text-gray-900">{selected.visits}</p></div>
              </div>

              {/* Validation */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">Valider une visite</p>
                {services.length === 0 ? (
                  <p className="text-sm text-amber-600">Ajoutez d'abord des prestations pour valider une visite.</p>
                ) : (
                  <>
                    <select value={chosenService} onChange={e => setChosenService(e.target.value)}
                      className="w-full border-gray-300 rounded-lg shadow-sm text-sm mb-2">
                      <option value="">Choisir la prestation réalisée...</option>
                      {services.map(s => <option key={s.id} value={s.id}>{s.name} — {fmt(s.price / 100)} FCFA</option>)}
                    </select>
                    {selectedService && (
                      <p className="text-xs text-gray-600 mb-2">
                        Prix : <strong>{fmt(selectedService.price / 100)} FCFA</strong> · Points gagnés : <strong className="text-indigo-600">+{pointsFor(selectedService.price)}</strong>
                      </p>
                    )}
                    {detailError && <p className="text-sm text-red-600 mb-2">{detailError}</p>}
                    {validateMsg && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2 mb-2 flex items-start"><CheckCircle className="h-4 w-4 mr-1.5 mt-0.5 flex-shrink-0" />{validateMsg}</p>}
                    <button onClick={handleValidate} disabled={validating || !chosenService}
                      className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">
                      {validating ? "Validation..." : "Valider la visite"}
                    </button>
                  </>
                )}
              </div>

              {/* History */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-900">Historique</p>
                  <Link to={`/card/${selected.id}`} className="text-xs text-indigo-600 hover:underline">Voir la carte du client</Link>
                </div>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-400">Aucune visite enregistrée.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {history.map(v => (
                      <div key={v.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="font-medium text-gray-900">{v.serviceName || "Visite"}</p>
                          <p className="text-xs text-gray-400">{new Date(v.date).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        <div className="text-right">
                          {v.amount ? <p className="text-sm font-medium text-gray-700">{fmt(v.amount)} FCFA</p> : null}
                          {v.points ? <p className="text-xs text-indigo-600 font-semibold">+{v.points} pts</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create customer modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 relative shadow-xl">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full p-1"><X className="h-5 w-5" /></button>
            <h2 className="text-xl font-bold mb-6 text-gray-900">Nouveau client</h2>
            {programs.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-red-500 mb-4">Vous devez d'abord créer un programme de fidélité.</p>
                <Link to="/programs" className="text-indigo-600 hover:underline">Aller aux programmes</Link>
              </div>
            ) : (
              <form onSubmit={handleCreateCustomer} className="space-y-5">
                {formError && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded text-sm">{formError}</div>}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nom complet</label>
                  <input type="text" required value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm p-3 border bg-gray-50 focus:bg-white" placeholder="Jean Dupont" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Numéro de téléphone</label>
                  <input type="tel" required value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm p-3 border bg-gray-50 focus:bg-white" placeholder="06 12 34 56 78" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Associer au programme</label>
                  <select required value={newCustomer.programId} onChange={e => setNewCustomer({ ...newCustomer, programId: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm p-3 border bg-gray-50 focus:bg-white">
                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="flex justify-end space-x-3 mt-8 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                  <button type="submit" className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">Créer la carte</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
