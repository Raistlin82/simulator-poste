import { useState } from 'react';
import { formatCurrency } from '../../../utils/formatters';
import {
  Building2,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  Euro,
} from 'lucide-react';

/**
 * PracticeCatalogManager - Gestione Practice e Profili Lutech con tariffe
 *
 * Permette di:
 * - Creare/modificare/eliminare Practice
 * - Per ogni Practice, gestire profili con: label, seniority, daily_rate
 */
export default function PracticeCatalogManager({
  practices = [],
  onSavePractice,
  onDeletePractice,
  disabled = false,
}) {
  const [expandedPractice, setExpandedPractice] = useState(null);
  const [editingPractice, setEditingPractice] = useState(null);
  const [showAddPractice, setShowAddPractice] = useState(false);
  const [newPractice, setNewPractice] = useState({ label: '', profiles: [] });

  // Gestione nuova Practice
  const handleAddPractice = async () => {
    if (!newPractice.label.trim()) return;

    // Auto-genera ID dal label
    const generatedId = newPractice.label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Rimuovi caratteri speciali
      .replace(/\s+/g, '_') // Sostituisci spazi con underscore
      .substring(0, 50); // Limita lunghezza

    await onSavePractice?.({
      id: generatedId || `practice_${Date.now()}`, // Fallback se label è solo caratteri speciali
      label: newPractice.label,
      profiles: [],
    });

    setNewPractice({ label: '', profiles: [] });
    setShowAddPractice(false);
  };

  // Gestione modifica Practice
  const handleStartEdit = (practice) => {
    setEditingPractice({ ...practice, profiles: [...(practice.profiles || [])] });
    setExpandedPractice(practice.id);
  };

  const handleCancelEdit = () => {
    setEditingPractice(null);
  };

  const handleSaveEdit = async () => {
    if (!editingPractice) return;
    await onSavePractice?.(editingPractice);
    setEditingPractice(null);
  };

  // Genera ID alfabetico (a, b, c, ..., z, aa, ab, ...)
  const generateProfileId = (existingProfiles) => {
    if (!existingProfiles || existingProfiles.length === 0) return 'a';

    // Estrai tutte le lettere ID
    const ids = existingProfiles
      .map(p => p.id)
      .filter(id => /^[a-z]+$/.test(id))
      .sort();

    if (ids.length === 0) return 'a';

    const lastId = ids[ids.length - 1];

    // Incrementa la lettera
    const increment = (str) => {
      let chars = str.split('');
      let i = chars.length - 1;

      while (i >= 0) {
        if (chars[i] === 'z') {
          chars[i] = 'a';
          i--;
        } else {
          chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
          return chars.join('');
        }
      }

      // Tutti erano 'z', aggiungi un carattere
      return 'a' + chars.join('');
    };

    return increment(lastId);
  };

  // Gestione profili dentro una Practice
  const handleAddProfile = () => {
    if (!editingPractice) return;

    const newId = generateProfileId(editingPractice.profiles);
    setEditingPractice({
      ...editingPractice,
      profiles: [
        ...editingPractice.profiles,
        { id: newId, label: '', daily_rate: 400 }
      ]
    });
  };

  const handleUpdateProfile = (index, field, value) => {
    if (!editingPractice) return;

    const updatedProfiles = editingPractice.profiles.map((p, i) => {
      if (i !== index) return p;
      return { ...p, [field]: field === 'daily_rate' ? (parseFloat(value) || 0) : value };
    });

    setEditingPractice({ ...editingPractice, profiles: updatedProfiles });
  };

  const handleRemoveProfile = (index) => {
    if (!editingPractice) return;

    setEditingPractice({
      ...editingPractice,
      profiles: editingPractice.profiles.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="glass-card rounded-2xl">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 bg-white/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest font-display">Catalogo Profili Lutech</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest-plus mt-0.5">Definisci Practice e figure professionali con tariffe</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddPractice(true)}
            disabled={disabled || showAddPractice}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-widest
                       text-indigo-600 hover:bg-white/80 rounded-xl transition-all shadow-sm border border-indigo-100
                       disabled:opacity-50 disabled:cursor-not-allowed font-display"
          >
            <Plus className="w-4 h-4" />
            Nuova Practice
          </button>
        </div>
      </div>

      {/* Form nuova Practice */}
      {showAddPractice && (
        <div className="p-4 bg-purple-50 border-b border-purple-100">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newPractice.label}
              onChange={(e) => setNewPractice({ ...newPractice, label: e.target.value })}
              placeholder="Nome Practice (es. Data & AI)"
              className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded-lg
                         focus:border-purple-500 focus:outline-none bg-white"
              autoFocus
            />
            <button
              onClick={handleAddPractice}
              disabled={!newPractice.label.trim()}
              className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAddPractice(false)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Lista Practice */}
      <div className="flex flex-col gap-3 p-3">
        {practices.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Building2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Nessuna Practice configurata</p>
            <p className="text-sm mt-1">Crea la prima Practice per definire i profili Lutech</p>
          </div>
        ) : (
          practices.map((practice) => {
            const isExpanded = expandedPractice === practice.id;
            const isEditing = editingPractice?.id === practice.id;
            const displayPractice = isEditing ? editingPractice : practice;
            const profiles = displayPractice.profiles || [];

            return (
              <div key={practice.id}>
                {/* Riga Practice */}
                <div className={`flex items-center justify-between p-4 transition-all text-left rounded-2xl border ${isExpanded ? 'bg-white/60 shadow-lg border-indigo-200/50 scale-[1.01]' : 'bg-white/30 border-transparent hover:bg-white/50'}`}>
                  <button
                    onClick={() => setExpandedPractice(isExpanded ? null : practice.id)}
                    className="flex items-center gap-4 flex-1 text-left"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md transition-all ${isExpanded ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white scale-110 shadow-indigo-500/20' : 'bg-white text-indigo-600 border border-slate-100'}`}>
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-black text-slate-800 tracking-tight font-display text-base">{practice.label}</div>
                      <div className="text-[10px] text-slate-400 font-bold flex items-center gap-2 uppercase tracking-widest mt-0.5 font-body">
                        <span className="text-indigo-500">{profiles.length} PROFILI</span>
                        <span className="opacity-30">|</span>
                        <span className="opacity-60">ID: {practice.id}</span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <>
                        <button
                          onClick={() => handleStartEdit(practice)}
                          disabled={disabled}
                          className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors
                                     disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeletePractice?.(practice.id)}
                          disabled={disabled}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors
                                     disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleSaveEdit}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setExpandedPractice(isExpanded ? null : practice.id)}
                      className={`p-2 transition-colors rounded-full ${isExpanded ? 'bg-purple-100 text-purple-600' : 'text-slate-400'}`}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Pannello profili espanso */}
                {isExpanded && (
                  <div className="px-0 pb-4 bg-white/30 backdrop-blur-sm border-t border-purple-200/30 rounded-b-xl overflow-hidden">
                    <div className="p-4">
                      {/* Intestazione tabella */}
                      <div className="grid grid-cols-12 gap-3 mb-4 pb-2 border-b border-slate-100">
                        <div className="col-span-1 text-[9px] font-black text-slate-400 uppercase tracking-widest-plus font-display">ID</div>
                        <div className="col-span-6 text-[9px] font-black text-slate-400 uppercase tracking-widest-plus font-display">Profilo</div>
                        <div className="col-span-4 text-[9px] font-black text-slate-400 uppercase tracking-widest-plus font-display text-right pr-4">Tariffa/GG</div>
                        <div className="col-span-1"></div>
                      </div>

                      {/* Righe profili */}
                      {profiles.length === 0 ? (
                        <div className="py-6 text-center text-slate-500 text-sm">
                          <Users className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                          Nessun profilo. {isEditing ? 'Aggiungi il primo.' : 'Clicca Modifica per aggiungere.'}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {profiles.map((profile, idx) => (
                            <div key={profile.id || idx} className="grid grid-cols-12 gap-3 items-center p-2 rounded-lg hover:bg-white/40 transition-colors">
                              {/* ID */}
                              <div className="col-span-1">
                                <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100/50 px-2 py-1 rounded block text-center border border-slate-200/50">
                                  {profile.id}
                                </span>
                              </div>

                              {/* Label */}
                              <div className="col-span-6">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={profile.label}
                                    onChange={(e) => handleUpdateProfile(idx, 'label', e.target.value)}
                                    placeholder="Nome profilo..."
                                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg
                                               focus:border-purple-500 focus:outline-none bg-white/80"
                                  />
                                ) : (
                                  <span className="text-sm font-semibold text-slate-700">{profile.label}</span>
                                )}
                              </div>

                              {/* Daily Rate */}
                              <div className="col-span-4 flex justify-end pr-4">
                                {isEditing ? (
                                  <div className="flex items-center gap-1 group">
                                    <Euro className="w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                    <input
                                      type="number"
                                      value={profile.daily_rate}
                                      onChange={(e) => handleUpdateProfile(idx, 'daily_rate', e.target.value)}
                                      step="10"
                                      min="0"
                                      className="w-24 px-3 py-1.5 text-sm font-bold border border-slate-200 rounded-xl
                                                 focus:border-indigo-500 focus:outline-none bg-white transition-all shadow-sm"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-sm font-black text-indigo-700 bg-indigo-50/50 px-3 py-1.5 rounded-xl border border-indigo-100/50 font-display tabular-nums shadow-sm">
                                    {formatCurrency(profile.daily_rate || 0)}/GG
                                  </span>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="col-span-1 flex justify-end">
                                {isEditing && (
                                  <button
                                    onClick={() => handleRemoveProfile(idx)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Pulsante aggiungi profilo */}
                      {isEditing && (
                        <button
                          onClick={handleAddProfile}
                          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold
                                     text-purple-600 hover:bg-white shadow-sm hover:shadow transition-all rounded-xl border border-dashed border-purple-300"
                        >
                          <Plus className="w-4 h-4" />
                          Aggiungi Profilo
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
