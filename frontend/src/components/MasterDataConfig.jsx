import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Plus, Trash2, ShieldCheck, Award, Info, Settings, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Search, Save, AlertCircle, Check, Building2, Database, Download, Upload } from 'lucide-react';
import { API_URL } from '../utils/api';
import { useConfig } from '../features/config/context/ConfigContext';
import { logger } from '../utils/logger';
import { ConfirmDialog } from './ui/confirm-dialog';

export default function MasterDataConfig() {
    const { t } = useTranslation();
    const { refetch: refetchConfig } = useConfig();
    const [data, setData] = useState({
        company_certs: [],
        prof_certs: [],
        requirement_labels: [],
        rti_partners: []
    });
    const [vendors, setVendors] = useState([]);
    const [expandedVendor, setExpandedVendor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('company_certs');
    const [vendorSearch, setVendorSearch] = useState('');
    const [toast, setToast] = useState(null); // {type: 'success'|'error', message: string}
    const [showAddVendor, setShowAddVendor] = useState(false);
    const [newVendor, setNewVendor] = useState({ key: '', name: '' });
    const fileInputRef = useRef(null);

    // Modal state for deletions
    const [deleteModalState, setDeleteModalState] = useState({
        isOpen: false,
        actionType: null, // 'item' or 'vendor'
        data: null // { section, idx, label } or { vendorKey, vendorName }
    });

    // Refs for controlled inputs (fix #11)
    const aliasInputRefs = useRef({});
    const patternInputRefs = useRef({});

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    };

    // Auto-save master data when it changes (debounced)
    const saveTimeoutRef = useRef(null);
    const saveMasterData = useCallback(async (newData) => {
        try {
            await axios.post(`${API_URL}/master-data`, newData);
            showToast('success', t('master.saved'));
            // Refresh ConfigContext so other components (TechEvaluator) get updated masterData
            if (refetchConfig) refetchConfig();
        } catch (error) {
            logger.error('Error saving master data', error);
            showToast('error', `${t('master.error_prefix')}: ${error.response?.data?.detail || error.message}`);
        }
    }, [refetchConfig]);

    useEffect(() => {
        // Skip initial load
        if (loading) return;

        // Debounce save
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
            saveMasterData(data);
        }, 500);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [data, loading, saveMasterData]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [masterRes, vendorRes] = await Promise.all([
                    axios.get(`${API_URL}/master-data`),
                    axios.get(`${API_URL}/vendor-configs`).catch(() => ({ data: [] }))
                ]);
                // De-duplicate arrays on load to clean up any existing duplicates
                const cleanedData = {
                    ...masterRes.data,
                    company_certs: masterRes.data.company_certs ? [...new Set(masterRes.data.company_certs)] : [],
                    prof_certs: masterRes.data.prof_certs ? [...new Set(masterRes.data.prof_certs)] : [],
                    requirement_labels: masterRes.data.requirement_labels ? [...new Set(masterRes.data.requirement_labels)] : [],
                    rti_partners: masterRes.data.rti_partners ? [...new Set(masterRes.data.rti_partners)] : [],
                };
                setData(cleanedData);
                setVendors(vendorRes.data || []);
            } catch (error) {
                logger.error('Error fetching master data', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const addItem = (section) => {
        const newItem = section === 'economic_formulas'
            ? { id: `formula_${Date.now()}`, label: t('master.new_formula'), desc: "P = $P_{max} \\times ..." }
            : "";
        setData(prev => ({
            ...prev,
            [section]: [...prev[section], newItem]
        }));
    };

    const updateItem = (section, idx, fieldOrVal, val) => {
        const newList = [...data[section]];
        if (section === 'economic_formulas') {
            newList[idx] = { ...newList[idx], [fieldOrVal]: val };
        } else {
            newList[idx] = fieldOrVal;
        }
        setData(prev => ({
            ...prev,
            [section]: newList
        }));
    };

    const deleteItem = (section, idx) => {
        const newList = [...data[section]];
        newList.splice(idx, 1);
        setData(prev => ({
            ...prev,
            [section]: newList
        }));
    };

    // Vendor management functions
    const toggleVendorEnabled = async (vendorKey) => {
        const vendor = vendors.find(v => v.key === vendorKey);
        if (!vendor) return;

        try {
            await axios.put(`${API_URL}/vendor-configs/${vendorKey}`, {
                enabled: !vendor.enabled
            });
            setVendors(prev => prev.map(v =>
                v.key === vendorKey ? { ...v, enabled: !v.enabled } : v
            ));
            showToast('success', `${vendor.name} ${!vendor.enabled ? 'abilitato' : 'disabilitato'}`);
        } catch (error) {
            logger.error('Error toggling vendor', error);
            showToast('error', `${t('master.error_prefix')}: ${error.response?.data?.detail || error.message}`);
        }
    };

    const updateVendorField = async (vendorKey, field, value) => {
        try {
            await axios.put(`${API_URL}/vendor-configs/${vendorKey}`, {
                [field]: value
            });
            setVendors(prev => prev.map(v =>
                v.key === vendorKey ? { ...v, [field]: value } : v
            ));
            showToast('success', t('master.saved'));
        } catch (error) {
            logger.error('Error updating vendor', error);
            showToast('error', `${t('master.error_prefix')}: ${error.response?.data?.detail || error.message}`);
        }
    };

    const addVendorAlias = (vendorKey, alias) => {
        const vendor = vendors.find(v => v.key === vendorKey);
        if (!vendor || !alias.trim()) return;
        const newAliases = [...(vendor.aliases || []), alias.trim().toLowerCase()];
        updateVendorField(vendorKey, 'aliases', newAliases);
    };

    const removeVendorAlias = (vendorKey, aliasIdx) => {
        const vendor = vendors.find(v => v.key === vendorKey);
        if (!vendor) return;
        const newAliases = vendor.aliases.filter((_, i) => i !== aliasIdx);
        updateVendorField(vendorKey, 'aliases', newAliases);
    };

    const addVendorPattern = (vendorKey, pattern) => {
        const vendor = vendors.find(v => v.key === vendorKey);
        if (!vendor || !pattern.trim()) return;

        // Validate regex pattern before adding (fix #4)
        try {
            new RegExp(pattern.trim());
        } catch (e) {
            showToast('error', `Pattern regex non valido: ${e.message}`);
            return;
        }

        const newPatterns = [...(vendor.cert_patterns || []), pattern.trim()];
        updateVendorField(vendorKey, 'cert_patterns', newPatterns);
    };

    const removeVendorPattern = (vendorKey, patternIdx) => {
        const vendor = vendors.find(v => v.key === vendorKey);
        if (!vendor) return;
        const newPatterns = vendor.cert_patterns.filter((_, i) => i !== patternIdx);
        updateVendorField(vendorKey, 'cert_patterns', newPatterns);
    };

    // Create new vendor (fix #5)
    const createVendor = async () => {
        if (!newVendor.key.trim() || !newVendor.name.trim()) {
            showToast('error', 'Inserisci chiave e nome del vendor');
            return;
        }

        // Validate key format (fix #8): only lowercase, numbers, underscores
        const normalizedKey = newVendor.key.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        if (normalizedKey.length < 2) {
            showToast('error', 'La chiave deve contenere almeno 2 caratteri alfanumerici');
            return;
        }
        if (vendors.some(v => v.key === normalizedKey)) {
            showToast('error', `Vendor con chiave "${normalizedKey}" già esistente`);
            return;
        }

        try {
            const response = await axios.post(`${API_URL}/vendor-configs`, {
                key: normalizedKey,
                name: newVendor.name,
                aliases: [normalizedKey],
                cert_patterns: [],
                enabled: true
            });
            setVendors(prev => [...prev, response.data]);
            setNewVendor({ key: '', name: '' });
            setShowAddVendor(false);
            showToast('success', `Vendor "${newVendor.name}" creato`);
        } catch (error) {
            logger.error('Error creating vendor', error);
            showToast('error', `${t('master.error_prefix')}: ${error.response?.data?.detail || error.message}`);
        }
    };

    // Delete vendor (fix #6)
    const confirmDeleteVendor = (vendorKey) => {
        const vendor = vendors.find(v => v.key === vendorKey);
        if (!vendor) return;
        setDeleteModalState({
            isOpen: true,
            actionType: 'vendor',
            data: { vendorKey, vendorName: vendor.name }
        });
    };

    const handleDeleteConfirm = () => {
        if (deleteModalState.actionType === 'vendor' && deleteModalState.data) {
            executeDeleteVendor(deleteModalState.data.vendorKey, deleteModalState.data.vendorName);
        } else if (deleteModalState.actionType === 'item' && deleteModalState.data) {
            deleteItem(deleteModalState.data.section, deleteModalState.data.idx);
        } else if (deleteModalState.actionType === 'import_db') {
            executeImportDb();
        }
        setDeleteModalState({ isOpen: false, actionType: null, data: null });
    };

    const executeDeleteVendor = async (vendorKey, vendorName) => {
        try {
            await axios.delete(`${API_URL}/vendor-configs/${vendorKey}`);
            setVendors(prev => prev.filter(v => v.key !== vendorKey));
            setExpandedVendor(null);

            // Clean up refs for deleted vendor (fix #11)
            delete aliasInputRefs.current[vendorKey];
            delete patternInputRefs.current[vendorKey];

            showToast('success', `Vendor "${vendorName}" eliminato`);
        } catch (error) {
            logger.error('Error deleting vendor', error);
            showToast('error', `${t('master.error_prefix')}: ${error.response?.data?.detail || error.message}`);
        }
    };

    const handleExportDb = async () => {
        try {
            const res = await axios.get(`${API_URL}/system/export-db`, { responseType: 'blob' });

            // Check if the response is actually JSON (i.e. an error message)
            if (res.data.type === 'application/json') {
                const text = await res.data.text();
                const errorData = JSON.parse(text);
                throw new Error(errorData.detail || 'Errore durante l\'esportazione');
            }

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;

            const disposition = res.headers['content-disposition'];
            let filename = `simulator_poste_backup_${new Date().toISOString().split('T')[0]}.db`;

            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            showToast('success', 'Backup scaricato con successo');
        } catch (error) {
            logger.error('Error exporting database', error);
            showToast('error', `Errore durante l'export: ${error.message}`);
        }
    };

    const confirmImportDb = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setDeleteModalState({
            isOpen: true,
            actionType: 'import_db',
            data: { file }
        });
        // Reset input so the same file can be selected again if cancelled
        e.target.value = '';
    };

    const executeImportDb = async () => {
        const file = deleteModalState.data?.file;
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            setLoading(true);
            await axios.post(`${API_URL}/system/import-db`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showToast('success', 'Database ripristinato con successo. La pagina verrà ricaricata a breve.');
            // Reload the page to fetch the new data from the restored DB
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            logger.error('Error importing database', error);
            showToast('error', `Errore durante il ripristino: ${error.response?.data?.detail || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Filter vendors by search (fix #18)
    const filteredVendors = vendors.filter(v =>
        !vendorSearch ||
        v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
        v.key.toLowerCase().includes(vendorSearch.toLowerCase()) ||
        v.aliases?.some(a => a.includes(vendorSearch.toLowerCase()))
    );

    if (loading) return <div className="p-10 text-center">{t('common.loading')}</div>;

    const sections = [
        { id: 'company_certs', label: t('master.company_certs'), icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { id: 'prof_certs', label: t('master.prof_certs'), icon: Award, color: 'text-blue-600', bg: 'bg-blue-50' },
        { id: 'rti_partners', label: t('master.rti_partners'), icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { id: 'economic_formulas', label: t('config.economic_formula'), icon: Info, color: 'text-orange-600', bg: 'bg-orange-50' },
        { id: 'ocr_settings', label: t('master.ocr_settings'), icon: Settings, color: 'text-purple-600', bg: 'bg-purple-50' },
        { id: 'database_tools', label: 'Database Backup', icon: Database, color: 'text-slate-600', bg: 'bg-slate-50' },
    ];

    return (
        <div className="min-h-screen p-6 overflow-auto pb-32">
            {/* Toast notification (fix #15) */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-md transition-all border border-white/40 ${toast.type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'
                    }`}>
                    {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="text-sm font-bold font-display">{toast.message}</span>
                </div>
            )}

            <div className="max-w-7xl mx-auto space-y-8">
                {/* Premium Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/60 shadow-2xl shadow-blue-500/5 transition-all duration-500 hover:shadow-blue-500/10 mb-8">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 -rotate-2 hover:rotate-0 transition-all duration-500 group">
                            <ShieldCheck className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 font-display tracking-tightest leading-tight">Poste Master Data</h1>
                            <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest-plus font-display">Configurazione Sistema</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest-plus font-display">{sections.find(s => s.id === activeSection)?.label}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Lateral Navigation (Tabs) */}
                    <div className="lg:col-span-3 space-y-4">
                        <div className="glass-card rounded-[2rem] p-5 sticky top-8 border-white/60 shadow-xl shadow-slate-200/40">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest-plus mb-6 px-3 font-display border-l-2 border-indigo-500 pl-4">Sezioni Master Data</div>
                            {sections.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setActiveSection(s.id)}
                                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 font-black text-[10px] uppercase tracking-widest-plus font-display ${activeSection === s.id
                                        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200'
                                        : 'text-slate-500 hover:bg-white/60 hover:translate-x-1'
                                        } mb-3 last:mb-0 group`}
                                >
                                    <s.icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${activeSection === s.id ? 'text-white' : s.color}`} />
                                    <span>{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="lg:col-span-9">
                        <div className="glass-card rounded-3xl p-8 shadow-xl shadow-slate-200/50">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-8 border-b border-white/60">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 bg-indigo-50/50 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-indigo-100 shadow-sm">
                                        {(() => {
                                            const SectionIcon = sections.find(s => s.id === activeSection)?.icon || Settings;
                                            return <SectionIcon className="w-6 h-6 text-indigo-600" />;
                                        })()}
                                    </div>
                                    <h2 className="text-[22px] font-black text-slate-800 font-display tracking-tightest uppercase">
                                        {sections.find(s => s.id === activeSection)?.label}
                                    </h2>
                                </div>
                                {activeSection !== 'ocr_settings' && activeSection !== 'database_tools' && (
                                    <button
                                        onClick={() => addItem(activeSection)}
                                        className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl hover:brightness-110 transition-all flex items-center gap-4 text-[10px] font-black uppercase tracking-widest-plus font-display shadow-xl shadow-indigo-200 active:scale-95 group"
                                    >
                                        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                                        <span>Aggiungi Voce</span>
                                    </button>
                                )}
                            </div>

                            {/* Main Content Area */}
                            {activeSection === 'ocr_settings' ? (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-600 mb-4 font-body">
                                        {t('master.ocr_settings_desc')}
                                    </p>

                                    {/* Search and Add buttons */}
                                    <div className="flex gap-2 mb-4">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder={t('master.search_vendor')}
                                                value={vendorSearch}
                                                onChange={(e) => setVendorSearch(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm font-body focus:ring-2 focus:ring-purple-500 outline-none"
                                            />
                                        </div>
                                        <button
                                            onClick={() => setShowAddVendor(!showAddVendor)}
                                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest font-display"
                                        >
                                            <Plus className="w-4 h-4" />
                                            {t('master.new_vendor')}
                                        </button>
                                    </div>

                                    {/* Add Vendor Form */}
                                    {showAddVendor && (
                                        <div className="p-6 bg-white/40 backdrop-blur-md border border-purple-200/50 rounded-2xl mb-8 shadow-xl shadow-purple-500/5 border-spacing-y-3">
                                            <h4 className="text-sm font-black text-purple-800 uppercase tracking-widest font-display mb-6 px-1">Nuovo Vendor</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                                <div className="bg-white/50 p-4 rounded-xl border border-white/60">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1 font-display">Chiave Unica</label>
                                                    <input
                                                        type="text"
                                                        value={newVendor.key}
                                                        onChange={(e) => setNewVendor(prev => ({ ...prev, key: e.target.value }))}
                                                        placeholder="es: uipath"
                                                        className="w-full p-2.5 bg-white/50 border border-slate-200/50 rounded-lg outline-none text-sm font-semibold font-body transition-all focus:ring-2 focus:ring-purple-500/30"
                                                    />
                                                </div>
                                                <div className="bg-white/50 p-4 rounded-xl border border-white/60">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1 font-display">Nome Visualizzato</label>
                                                    <input
                                                        type="text"
                                                        value={newVendor.name}
                                                        onChange={(e) => setNewVendor(prev => ({ ...prev, name: e.target.value }))}
                                                        placeholder="es: UiPath"
                                                        className="w-full p-2.5 bg-white/50 border border-slate-200/50 rounded-lg outline-none text-sm font-semibold font-body transition-all focus:ring-2 focus:ring-purple-500/30"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-3 px-1">
                                                <button
                                                    onClick={createVendor}
                                                    className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest font-display hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
                                                >
                                                    Crea Vendor
                                                </button>
                                                <button
                                                    onClick={() => { setShowAddVendor(false); setNewVendor({ key: '', name: '' }); }}
                                                    className="px-6 py-2.5 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest font-display hover:bg-slate-300 transition-all"
                                                >
                                                    Annulla
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Vendors List */}
                                    {filteredVendors.length > 0 ? (
                                        <div className="space-y-4">
                                            {filteredVendors.map((vendor) => (
                                                <div key={vendor.key} className="glass-card rounded-2xl border border-white/40 overflow-hidden shadow-sm hover:shadow-md transition-all">
                                                    <div
                                                        className="flex flex-col md:flex-row md:items-center justify-between p-6 cursor-pointer hover:bg-white/60 transition-all gap-5 group/item"
                                                        onClick={() => setExpandedVendor(expandedVendor === vendor.key ? null : vendor.key)}
                                                    >
                                                        <div className="flex items-center gap-5">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); toggleVendorEnabled(vendor.key); }}
                                                                className={`transition-all transform hover:scale-110 active:scale-90 ${vendor.enabled ? 'text-indigo-600' : 'text-slate-300'}`}
                                                                title={vendor.enabled ? 'Disabilita' : 'Abilita'}
                                                            >
                                                                {vendor.enabled ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
                                                            </button>
                                                            <div>
                                                                <h4 className={`text-base font-black font-display uppercase tracking-tight transition-colors ${vendor.enabled ? 'text-slate-800' : 'text-slate-400'}`}>
                                                                    {vendor.name}
                                                                </h4>
                                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest-plus font-display mt-0.5">{vendor.key}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-5">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50/50 backdrop-blur-sm border border-indigo-100/50 rounded-xl px-3 py-1.5 uppercase tracking-widest-plus font-display shadow-sm">
                                                                    {vendor.aliases?.length || 0} Alias
                                                                </span>
                                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50/50 backdrop-blur-sm border border-blue-100/50 rounded-xl px-3 py-1.5 uppercase tracking-widest-plus font-display shadow-sm">
                                                                    {vendor.cert_patterns?.length || 0} Pattern
                                                                </span>
                                                            </div>
                                                            <div className="w-10 h-10 rounded-2xl bg-slate-100/50 flex items-center justify-center border border-white group-hover/item:bg-white transition-all">
                                                                {expandedVendor === vendor.key ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {expandedVendor === vendor.key && (
                                                        <div className="border-t border-purple-200/50 p-6 bg-white/40 backdrop-blur-md space-y-6">
                                                            {/* Aliases */}
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 font-display">
                                                                    Alias (nomi alternativi per riconoscimento)
                                                                </label>
                                                                <div className="flex flex-wrap gap-2 mb-3">
                                                                    {vendor.aliases?.map((alias, idx) => (
                                                                        <span key={idx} className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100/50 text-purple-700 text-[10px] font-bold rounded-lg border border-purple-200 font-body">
                                                                            {alias}
                                                                            <button onClick={() => removeVendorAlias(vendor.key, idx)} className="hover:text-red-600 transition-colors">
                                                                                <Trash2 className="w-3 h-3" />
                                                                            </button>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        ref={el => aliasInputRefs.current[vendor.key] = el}
                                                                        type="text"
                                                                        placeholder="Nuovo alias..."
                                                                        className="flex-1 p-2.5 bg-white/50 border border-slate-200/50 rounded-lg text-sm font-body outline-none focus:ring-2 focus:ring-purple-500/30"
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' && e.target.value.trim()) {
                                                                                addVendorAlias(vendor.key, e.target.value);
                                                                                e.target.value = '';
                                                                            }
                                                                        }}
                                                                    />
                                                                    <button
                                                                        onClick={() => {
                                                                            const input = aliasInputRefs.current[vendor.key];
                                                                            if (input && input.value.trim()) {
                                                                                addVendorAlias(vendor.key, input.value);
                                                                                input.value = '';
                                                                            }
                                                                        }}
                                                                        className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-lg shadow-purple-200 transition-all font-display"
                                                                    >
                                                                        <Plus className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Cert Patterns */}
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 font-display">
                                                                    Pattern Certificazioni (regex per riconoscimento)
                                                                </label>
                                                                <div className="space-y-2 mb-3">
                                                                    {vendor.cert_patterns?.map((pattern, idx) => (
                                                                        <div key={idx} className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                                                                            <code className="flex-1 text-xs font-mono text-blue-700">{pattern}</code>
                                                                            <button onClick={() => removeVendorPattern(vendor.key, idx)} className="text-slate-400 hover:text-red-600 transition-colors">
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        ref={el => patternInputRefs.current[vendor.key] = el}
                                                                        type="text"
                                                                        placeholder="Nuovo pattern regex..."
                                                                        className="flex-1 p-2.5 bg-white/50 border border-slate-200/50 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/30"
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' && e.target.value.trim()) {
                                                                                addVendorPattern(vendor.key, e.target.value);
                                                                                e.target.value = '';
                                                                            }
                                                                        }}
                                                                    />
                                                                    <button
                                                                        onClick={() => {
                                                                            const input = patternInputRefs.current[vendor.key];
                                                                            if (input && input.value.trim()) {
                                                                                addVendorPattern(vendor.key, input.value);
                                                                                input.value = '';
                                                                            }
                                                                        }}
                                                                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all font-display"
                                                                    >
                                                                        <Plus className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="pt-4 border-t border-slate-200">
                                                                <button
                                                                    onClick={() => confirmDeleteVendor(vendor.key)}
                                                                    className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-[10px] font-black uppercase tracking-widest font-display hover:bg-red-100 transition-all flex items-center gap-2"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                    Elimina Vendor
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 border-2 border-dashed border-purple-100 rounded-3xl bg-purple-50/20">
                                            <div className="w-16 h-16 bg-white/60 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-white">
                                                <Settings className="w-8 h-8 text-purple-400" />
                                            </div>
                                            <p className="text-slate-500 font-display text-sm font-bold uppercase tracking-widest text-[10px]">
                                                {vendorSearch ? 'Nessun vendor trovato' : 'Nessun vendor configurato'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : activeSection === 'database_tools' ? (
                                <div className="space-y-8">
                                    <div className="bg-white/40 backdrop-blur-md border border-white/60 p-8 rounded-[2rem] shadow-xl shadow-slate-200/50">
                                        <div className="flex items-start gap-6">
                                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center flex-shrink-0 border border-indigo-100/50">
                                                <Download className="w-7 h-7 text-indigo-600" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-black text-slate-800 font-display mb-2 tracking-tight">Esporta Database</h3>
                                                <p className="text-sm text-slate-600 font-body mb-6 leading-relaxed">
                                                    Scarica l'intero database locale contenente tutte le configurazioni, i master data, i lotti di gara, i piani economici e i calcoli. Questo export funge da backup completo.
                                                </p>
                                                <button
                                                    onClick={handleExportDb}
                                                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest-plus font-display hover:bg-indigo-700 transition-all flex items-center gap-3 shadow-lg shadow-indigo-200 active:scale-95"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    Scarica Backup
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-red-50/50 backdrop-blur-md border border-red-100 p-8 rounded-[2rem] shadow-xl shadow-red-200/20">
                                        <div className="flex items-start gap-6">
                                            <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0 border border-red-200/50">
                                                <Upload className="w-7 h-7 text-red-600" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-black text-red-800 font-display mb-2 tracking-tight">Importa Database</h3>
                                                <p className="text-sm text-red-600/80 font-body mb-6 leading-relaxed">
                                                    Attenzione: l'importazione di un database sovrascriverà <b>completamente</b> e <b>irreversibilmente</b> i dati attuali! Assicurati di aver effettuato un export dei dati recenti prima di procedere.
                                                </p>

                                                <input
                                                    type="file"
                                                    accept=".db"
                                                    className="hidden"
                                                    ref={fileInputRef}
                                                    onChange={confirmImportDb}
                                                />
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="px-6 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest-plus font-display hover:bg-red-700 transition-all flex items-center gap-3 shadow-lg shadow-red-200 active:scale-95"
                                                >
                                                    <Upload className="w-4 h-4" />
                                                    Ripristina Backup
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Standard Data Sections */
                                <div className="space-y-4">
                                    {data[activeSection] && data[activeSection].length > 0 ? (
                                        <div className="space-y-3">
                                            {data[activeSection].map((item, idx) => (
                                                <div key={idx} className="flex gap-4 items-center group p-5 rounded-[1.5rem] bg-white/40 backdrop-blur-md border border-white/60 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:bg-white/80 transition-all duration-300">
                                                    <div className="flex-1">
                                                        {activeSection === 'economic_formulas' ? (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                <div className="bg-white/60 p-4 rounded-2xl border border-white/80 transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
                                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest-plus mb-3 ml-1 font-display">{t('master.label')}</label>
                                                                    <input
                                                                        type="text"
                                                                        value={item.label}
                                                                        onChange={(e) => updateItem(activeSection, idx, 'label', e.target.value)}
                                                                        className="w-full p-2.5 bg-transparent border-none outline-none text-sm font-black text-slate-800 font-display transition-all"
                                                                    />
                                                                </div>
                                                                <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50 transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
                                                                    <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest-plus mb-3 ml-1 font-display">{t('master.formula_description')}</label>
                                                                    <input
                                                                        type="text"
                                                                        value={item.desc}
                                                                        onChange={(e) => updateItem(activeSection, idx, 'desc', e.target.value)}
                                                                        className="w-full p-2.5 bg-transparent border-none outline-none text-sm font-mono text-indigo-700 font-bold transition-all"
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="bg-white/60 p-4 rounded-2xl border border-white/80 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 group-hover:bg-white">
                                                                <input
                                                                    type="text"
                                                                    value={item}
                                                                    onChange={(e) => updateItem(activeSection, idx, e.target.value)}
                                                                    className="w-full p-1 bg-transparent border-none outline-none text-sm font-black text-slate-800 font-display tracking-tight transition-all"
                                                                    placeholder={t('master.item_placeholder')}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const sectionDef = sections.find(s => s.id === activeSection);
                                                            const label = item.label || item;
                                                            setDeleteModalState({
                                                                isOpen: true,
                                                                actionType: 'item',
                                                                data: { section: activeSection, idx, label: typeof label === 'string' ? label : sectionDef?.label }
                                                            });
                                                        }}
                                                        className="p-4 text-slate-300 hover:text-red-500 hover:bg-red-50/50 rounded-2xl transition-all active:scale-95 translate-x-2 group-hover:translate-x-0 group-hover:opacity-100"
                                                        title={t('common.delete')}
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/20">
                                            <div className="w-16 h-16 bg-white/60 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-white">
                                                <Info className="w-8 h-8 text-slate-400" />
                                            </div>
                                            <p className="text-slate-500 font-display text-sm font-bold uppercase tracking-widest text-[10px]">{t('master.no_items')}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Deletion Confirm Dialog */}
            <ConfirmDialog
                isOpen={deleteModalState.isOpen}
                onClose={() => setDeleteModalState({ isOpen: false, actionType: null, data: null })}
                onConfirm={handleDeleteConfirm}
                title="Conferma Eliminazione"
                description={
                    deleteModalState.actionType === 'vendor'
                        ? `Sei sicuro di voler eliminare il vendor "${deleteModalState.data?.vendorName}"? Questa operazione rimuoverà anche tutte le configurazioni associate.`
                        : deleteModalState.actionType === 'import_db'
                            ? `ATTENZIONE! Stai per sovrascrivere l'intero database locale con il file "${deleteModalState.data?.file?.name}". Questo eliminerà definitivamente e irreversibilmente tutti i dati correnti. Sei assolutamente sicuro di voler procedere? Consigliamo vivamente di fare un export di sicurezza prima.`
                            : `Sei sicuro di voler eliminare l'elemento "${deleteModalState.data?.label || ''}"? Questa azione non può essere annullata.`
                }
            />
        </div>
    );
}
