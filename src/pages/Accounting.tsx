import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../contexts/AuthContext";
import { getBusiness, getTransactions, createTransaction, deleteTransaction, Transaction } from "../services/db";
import { Plus, TrendingUp, TrendingDown, Wallet, X, Trash2, Lock } from "lucide-react";

const EXPENSE_CATEGORIES = ["Loyer", "Salaires", "Fournitures", "Électricité/Eau", "Marketing", "Imprévu", "Autre"];
const INCOME_CATEGORIES = ["Vente", "Prestation", "Acompte", "Autre"];

function rangeFor(period: string, ref: string): { from?: string; to?: string } {
  if (period === "Tout") return {};
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  let start = new Date(d), end = new Date(d);
  if (period === "Jour") {
    end.setHours(23, 59, 59, 999);
  } else if (period === "Semaine") {
    start.setDate(d.getDate() - d.getDay());
    end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
  } else if (period === "Mois") {
    start = new Date(d.getFullYear(), d.getMonth(), 1);
    end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  return { from: start.toISOString(), to: end.toISOString() };
}

const fmt = (n: number) => n.toLocaleString("fr-FR");

export default function Accounting() {
  const { user } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("Mois");
  const [refDate, setRefDate] = useState(new Date().toISOString().split("T")[0]);
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    type: "debit" as "credit" | "debit",
    amount: "",
    category: "Imprévu",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => { if (user) load(); }, [user]);
  useEffect(() => { if (business) loadTransactions(business.id); }, [business, period, refDate]);

  const load = async () => {
    try {
      const rest = await getBusiness(user!.id);
      setBusiness(rest);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadTransactions = async (businessId: number) => {
    try {
      const { from, to } = rangeFor(period, refDate);
      const data = await getTransactions(businessId, from, to);
      setTransactions(data);
    } catch (e) { console.error(e); }
  };

  const credits = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const debits = transactions.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const net = credits - debits;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    try {
      await createTransaction(business.id, {
        type: form.type,
        amount: parseInt(form.amount),
        category: form.category,
        description: form.description,
        date: new Date(form.date).toISOString(),
      } as any);
      setShowModal(false);
      setForm({ type: "debit", amount: "", category: "Imprévu", description: "", date: new Date().toISOString().split("T")[0] });
      loadTransactions(business.id);
    } catch (err) {
      setFormError((err as Error).message || "Échec de l'enregistrement.");
    }
  };

  const handleDelete = async (id: number) => {
    try { await deleteTransaction(id); loadTransactions(business.id); } catch (e) { console.error(e); }
  };

  if (loading) return <Layout><div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div></Layout>;

  // Accounting is admin-only on the backend; show a friendly message to staff.
  if (business && business.role && business.role !== "admin") {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
          <Lock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900">Accès réservé</h2>
          <p className="text-gray-500 mt-1">La comptabilité est réservée aux administrateurs.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Comptabilité</h1>
          <p className="text-sm text-gray-500 mt-1">Suivi des entrées, sorties et solde</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
            {["Jour", "Semaine", "Mois", "Tout"].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${period === p ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"}`}>
                {p}
              </button>
            ))}
            {period !== "Tout" && (
              <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)}
                className="ml-2 px-2 py-1 text-xs border border-gray-200 rounded text-gray-500" />
            )}
          </div>
          <button onClick={() => { setFormError(""); setShowModal(true); }}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium">
            <Plus className="h-4 w-4 mr-2" /> Ajouter une opération
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Total Crédits (entrées)</p>
            <p className="text-2xl font-bold text-green-600">{fmt(credits)} FCFA</p>
          </div>
          <div className="h-12 w-12 bg-green-50 rounded-xl flex items-center justify-center"><TrendingUp className="h-6 w-6 text-green-600" /></div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Total Débits (sorties)</p>
            <p className="text-2xl font-bold text-red-600">{fmt(debits)} FCFA</p>
          </div>
          <div className="h-12 w-12 bg-red-50 rounded-xl flex items-center justify-center"><TrendingDown className="h-6 w-6 text-red-600" /></div>
        </div>
        <div className={`rounded-2xl p-6 shadow-sm border flex items-center justify-between ${net >= 0 ? "bg-gray-950 border-gray-900 text-white" : "bg-red-600 border-red-700 text-white"}`}>
          <div>
            <p className="text-sm font-medium text-gray-300 mb-1">Solde net</p>
            <p className="text-2xl font-bold">{fmt(net)} FCFA</p>
          </div>
          <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center"><Wallet className="h-6 w-6 text-white" /></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Opérations</h2>
        </div>
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucune opération sur cette période.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Catégorie</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3 text-right">Montant</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(t.date).toLocaleDateString("fr-FR")}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">{t.category || "—"}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{t.description || "—"}</td>
                    <td className={`px-6 py-4 text-right text-sm font-bold ${t.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                      {t.type === "credit" ? "+" : "−"}{fmt(t.amount)} FCFA
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Nouvelle opération</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              {formError && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded text-sm">{formError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setForm({ ...form, type: "credit", category: INCOME_CATEGORIES[0] })}
                  className={`py-2 rounded-lg text-sm font-medium border ${form.type === "credit" ? "bg-green-50 border-green-300 text-green-700" : "border-gray-200 text-gray-500"}`}>
                  Crédit (entrée)
                </button>
                <button type="button" onClick={() => setForm({ ...form, type: "debit", category: "Imprévu" })}
                  className={`py-2 rounded-lg text-sm font-medium border ${form.type === "debit" ? "bg-red-50 border-red-300 text-red-700" : "border-gray-200 text-gray-500"}`}>
                  Débit (sortie)
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA)</label>
                <input type="number" min="0" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full border-gray-300 rounded-lg shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full border-gray-300 rounded-lg shadow-sm">
                  {(form.type === "credit" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optionnel)</label>
                <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border-gray-300 rounded-lg shadow-sm" placeholder="Ex: Facture électricité juillet" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full border-gray-300 rounded-lg shadow-sm" />
              </div>
              <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Enregistrer</button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
