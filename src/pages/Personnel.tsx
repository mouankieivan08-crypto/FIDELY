import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../contexts/AuthContext";
import { getBusiness, getMembers, createMember, updateMemberRole, deleteMember, Member } from "../services/db";
import { Plus, X, Trash2, Shield, User, Lock, Mail } from "lucide-react";

export default function Personnel() {
  const { user } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ email: "", name: "", role: "staff" as "admin" | "staff" });

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    try {
      const rest = await getBusiness(user!.id);
      setBusiness(rest);
      if (rest && rest.role === "admin") {
        setMembers(await getMembers(rest.id));
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    try {
      await createMember(business.id, { email: form.email, name: form.name, role: form.role });
      setShowModal(false);
      setForm({ email: "", name: "", role: "staff" });
      setMembers(await getMembers(business.id));
    } catch (err) {
      setFormError((err as Error).message || "Échec de l'ajout.");
    }
  };

  const handleRole = async (id: number, role: "admin" | "staff") => {
    try { await updateMemberRole(id, role); setMembers(await getMembers(business.id)); } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number) => {
    try { await deleteMember(id); setMembers(await getMembers(business.id)); } catch (e) { console.error(e); }
  };

  if (loading) return <Layout><div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div></Layout>;

  if (business && business.role !== "admin") {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
          <Lock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900">Accès réservé</h2>
          <p className="text-gray-500 mt-1">La gestion du personnel est réservée aux administrateurs.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Personnel & Accès</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez qui peut se connecter et avec quels droits</p>
        </div>
        <button onClick={() => { setFormError(""); setShowModal(true); }}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium">
          <Plus className="h-4 w-4 mr-2" /> Inviter un membre
        </button>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 text-sm text-indigo-800">
        <strong>Comment ça marche :</strong> invitez une personne par e-mail et choisissez son rôle.
        Elle se connecte ensuite sur Fidely avec ce même e-mail (Google ou mot de passe) et accède automatiquement à votre établissement.
        Les <strong>administrateurs</strong> ont accès à tout ; le <strong>staff</strong> n'a pas accès à la comptabilité ni à la gestion du personnel.
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center">
          <Shield className="h-4 w-4 text-indigo-500 mr-2" />
          <span className="text-sm font-medium text-gray-900">Propriétaire (administrateur)</span>
          <span className="ml-auto text-sm text-gray-500">{user?.email}</span>
        </div>
        {members.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun membre invité pour le moment.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-6 py-3">Membre</th>
                  <th className="px-6 py-3">Rôle</th>
                  <th className="px-6 py-3">Statut</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-3">
                          {(m.name || m.email)[0].toUpperCase()}
                        </div>
                        <div>
                          {m.name && <p className="text-sm font-medium text-gray-900">{m.name}</p>}
                          <p className="text-xs text-gray-500">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select value={m.role} onChange={e => handleRole(m.id, e.target.value as any)}
                        className="text-sm border-gray-300 rounded-lg shadow-sm">
                        <option value="admin">Administrateur</option>
                        <option value="staff">Staff</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${m.uid ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {m.uid ? "Connecté" : "En attente"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(m.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
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
              <h3 className="text-lg font-bold text-gray-900">Inviter un membre</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              {formError && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded text-sm">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-gray-400" /></div>
                  <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="employe@exemple.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom (optionnel)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User className="h-5 w-5 text-gray-400" /></div>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Prénom Nom" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })} className="w-full border-gray-300 rounded-lg shadow-sm">
                  <option value="staff">Staff (accès limité)</option>
                  <option value="admin">Administrateur (accès complet)</option>
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">Envoyer l'invitation</button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
