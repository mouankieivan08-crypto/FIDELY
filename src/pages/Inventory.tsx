import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../contexts/AuthContext";
import {
  getBusiness, getProducts, createProduct, updateProduct, deleteProduct,
  getServices, getServiceProducts, linkServiceProduct, unlinkServiceProduct,
  Product, ServiceProduct,
} from "../services/db";
import { Plus, Package, X, Trash2, Pencil, AlertTriangle, Boxes, Link2, Lock } from "lucide-react";

const fmt = (n: number) => (n ?? 0).toLocaleString("fr-FR");
const unitsLeft = (p: Product) => Math.floor((p.stockUses || 0) / (p.usesPerUnit || 1));
const isLow = (p: Product) => (p.lowStockUses || 0) > 0 && (p.stockUses || 0) <= (p.lowStockUses || 0);

export default function Inventory() {
  const { user } = useAuth();
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [role, setRole] = useState("admin");
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [links, setLinks] = useState<ServiceProduct[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: "", category: "", unitLabel: "boîte", usesPerUnit: "1", stockUnits: "0", lowStockUnits: "0" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null); // produit dont on gère les liens

  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    try {
      const rest = await getBusiness(user!.id);
      if (rest) {
        setBusinessId(rest.id);
        if (rest.role) setRole(rest.role);
        if (rest.role !== "admin") { setLoading(false); return; }
        const [prods, svcs, lnks] = await Promise.all([
          getProducts(rest.id).catch(() => []), getServices(rest.id).catch(() => []), getServiceProducts(rest.id).catch(() => []),
        ]);
        setProducts(prods);
        setServices(svcs);
        setLinks(lnks);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", category: "", unitLabel: "boîte", usesPerUnit: "1", stockUnits: "0", lowStockUnits: "0" });
    setFormError("");
    setShowForm(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, category: p.category || "", unitLabel: p.unitLabel || "boîte",
      usesPerUnit: String(p.usesPerUnit || 1),
      stockUnits: String(unitsLeft(p)),
      lowStockUnits: String(Math.floor((p.lowStockUses || 0) / (p.usesPerUnit || 1))),
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!businessId || saving || !form.name.trim()) return;
    setSaving(true);
    setFormError("");
    const upu = Math.max(1, parseInt(form.usesPerUnit) || 1);
    const payload: Partial<Product> = {
      name: form.name.trim(),
      category: form.category.trim() || undefined,
      unitLabel: form.unitLabel.trim() || "unité",
      usesPerUnit: upu,
      stockUses: (parseInt(form.stockUnits) || 0) * upu,
      lowStockUses: (parseInt(form.lowStockUnits) || 0) * upu,
    };
    try {
      if (editing) {
        const updated = await updateProduct(editing.id, payload);
        setProducts(prev => prev.map(p => p.id === editing.id ? updated : p));
      } else {
        const created = await createProduct(businessId, payload);
        setProducts(prev => [...prev, created]);
      }
      setShowForm(false);
    } catch (e) {
      setFormError((e as Error).message || "Échec de l'enregistrement.");
    } finally { setSaving(false); }
  };

  const handleRestock = async (p: Product, units: number) => {
    try {
      const updated = await updateProduct(p.id, { stockUses: (p.stockUses || 0) + units * (p.usesPerUnit || 1) });
      setProducts(prev => prev.map(x => x.id === p.id ? updated : x));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Supprimer le produit "${p.name}" ? Ses liens avec les prestations seront aussi supprimés.`)) return;
    try {
      await deleteProduct(p.id);
      setProducts(prev => prev.filter(x => x.id !== p.id));
      setLinks(prev => prev.filter(l => l.productId !== p.id));
    } catch (e) { console.error(e); }
  };

  // --- Liens prestation <-> produit ---
  const [linkService, setLinkService] = useState("");
  const [linkUses, setLinkUses] = useState("1");
  const linksFor = (productId: number) => links.filter(l => l.productId === productId);
  const serviceName = (id: number) => services.find(s => s.id === id)?.name || `#${id}`;

  const handleAddLink = async (productId: number) => {
    if (!businessId || !linkService) return;
    try {
      const link = await linkServiceProduct(businessId, {
        serviceId: parseInt(linkService), productId, usesPerPrestation: Math.max(1, parseInt(linkUses) || 1),
      });
      setLinks(prev => [...prev.filter(l => !(l.serviceId === link.serviceId && l.productId === link.productId)), link]);
      setLinkService(""); setLinkUses("1");
    } catch (e) { console.error(e); }
  };
  const handleRemoveLink = async (linkId: number) => {
    try { await unlinkServiceProduct(linkId); setLinks(prev => prev.filter(l => l.id !== linkId)); }
    catch (e) { console.error(e); }
  };

  const lowCount = useMemo(() => products.filter(isLow).length, [products]);

  if (loading) return <Layout><div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div></Layout>;

  if (role !== "admin") {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
          <Lock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900">Accès réservé</h2>
          <p className="text-gray-500 mt-1">L'inventaire est réservé aux administrateurs.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-col sm:flex-row justify-between sm:items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventaire</h1>
          <p className="text-sm text-gray-500 mt-1">Stocks des produits (teintures, vernis, consommables...) — décomptés automatiquement à chaque prestation liée</p>
        </div>
        <button onClick={openCreate} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm">
          <Plus className="h-4 w-4 mr-2" />Nouveau produit
        </button>
      </div>

      {lowCount > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center">
          <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
          {lowCount} produit{lowCount > 1 ? "s" : ""} en stock bas — pensez à réapprovisionner.
        </div>
      )}

      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <Boxes className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">Aucun produit</h3>
          <p className="text-gray-500 mt-1">Ajoutez vos produits pour suivre les stocks et les lier aux prestations.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(p => {
            const low = isLow(p);
            const remainder = (p.stockUses || 0) % (p.usesPerUnit || 1);
            return (
              <div key={p.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${low ? "border-amber-300" : "border-gray-100"}`}>
                <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Package className={`h-5 w-5 ${low ? "text-amber-500" : "text-indigo-500"}`} />
                      <p className="font-semibold text-gray-900">{p.name}</p>
                      {p.category && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{p.category}</span>}
                      {low && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium flex items-center"><AlertTriangle className="h-3 w-3 mr-1" />Stock bas</span>}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Stock : <strong className={low ? "text-amber-700" : "text-gray-900"}>{unitsLeft(p)} {p.unitLabel}{unitsLeft(p) > 1 ? "s" : ""}</strong>
                      {remainder > 0 && <span className="text-gray-400"> + {remainder} util.</span>}
                      <span className="text-gray-400"> · {fmt(p.stockUses)} utilisations · 1 {p.unitLabel} = {p.usesPerUnit} util.</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleRestock(p, 1)} title={`+1 ${p.unitLabel}`} className="px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100">+1</button>
                    <button onClick={() => handleRestock(p, 5)} title={`+5 ${p.unitLabel}s`} className="px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100">+5</button>
                    <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} title="Prestations liées" className={`px-2.5 py-1.5 rounded-lg text-sm font-medium flex items-center ${expanded === p.id ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      <Link2 className="h-4 w-4 mr-1" />{linksFor(p.id).length}
                    </button>
                    <button onClick={() => openEdit(p)} title="Modifier" className="p-2 text-gray-400 hover:text-indigo-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(p)} title="Supprimer" className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                {expanded === p.id && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-800 mb-2">Prestations qui consomment ce produit</p>
                    {linksFor(p.id).length === 0 ? (
                      <p className="text-sm text-gray-400 mb-3">Aucune prestation liée. Liez une prestation ci-dessous : le stock se décomptera à chaque fois qu'elle est vendue.</p>
                    ) : (
                      <div className="space-y-1.5 mb-3">
                        {linksFor(p.id).map(l => (
                          <div key={l.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm border border-gray-100">
                            <span className="text-gray-800">{serviceName(l.serviceId)} <span className="text-gray-400">— {l.usesPerPrestation} util./prestation</span></span>
                            <button onClick={() => handleRemoveLink(l.id)} className="text-gray-300 hover:text-red-500"><X className="h-4 w-4" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select value={linkService} onChange={e => setLinkService(e.target.value)} className="flex-1 text-sm border-gray-200 rounded-lg">
                        <option value="">Choisir une prestation...</option>
                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <div className="flex items-center gap-1">
                        <input type="number" min="1" value={linkUses} onChange={e => setLinkUses(e.target.value)} title="Utilisations consommées par prestation" className="w-20 text-sm border-gray-200 rounded-lg" />
                        <span className="text-xs text-gray-500">util.</span>
                      </div>
                      <button onClick={() => handleAddLink(p.id)} disabled={!linkService} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Lier</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Formulaire produit */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">{editing ? "Modifier le produit" : "Nouveau produit"}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-3">
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du produit</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Teinture noire, Vernis rouge..." className="w-full border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                  <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Teinture, Vernis..." className="w-full border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
                  <input value={form.unitLabel} onChange={e => setForm({ ...form, unitLabel: e.target.value })} placeholder="boîte, flacon..." className="w-full border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Utilisations par {form.unitLabel || "unité"}</label>
                <input type="number" min="1" value={form.usesPerUnit} onChange={e => setForm({ ...form, usesPerUnit: e.target.value })} className="w-full border-gray-200 rounded-lg text-sm" />
                <p className="text-[11px] text-gray-400 mt-1">Ex : 1 {form.unitLabel || "unité"} de teinture = 6 utilisations. Mettez 1 si l'unité se consomme entièrement à chaque fois.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock actuel ({form.unitLabel || "unité"}s)</label>
                  <input type="number" min="0" value={form.stockUnits} onChange={e => setForm({ ...form, stockUnits: e.target.value })} className="w-full border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alerte sous ({form.unitLabel || "unité"}s)</label>
                  <input type="number" min="0" value={form.lowStockUnits} onChange={e => setForm({ ...form, lowStockUnits: e.target.value })} className="w-full border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? "Enregistrement..." : editing ? "Enregistrer" : "Créer le produit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
