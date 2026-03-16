import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Plus, Trash2, ShieldCheck, Award, Info, Settings, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Search, Save, AlertCircle, CheckCircle, Building2, Database, FileDown, Upload, Bot, Users, X } from 'lucide-react';
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
        prof_certs_resources: {},
        prof_certs_vendors: {},
        requirement_labels: [],
        rti_partners: [],
        ai_enabled: false,
        ai_provider: 'gemini',
        ai_models: {
            gemini: 'gemini-3.1-flash-lite-preview',
            groq: 'llama-3.1-70b-versatile',
            claude: 'claude-sonnet-4-6',
        },
    });
    const [aiProviders, setAiProviders] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [expandedVendor, setExpandedVendor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('company_certs');
    const [vendorSearch, setVendorSearch] = useState('');
    const [toast, setToast] = useState(null); // {type: 'success'|'error', message: string}
    const [showAddVendor, setShowAddVendor] = useState(false);
    const [newVendor, setNewVendor] = useState({ key: '', name: '' });
    const fileInputRef = useRef(null);
    const certListInputRef = useRef(null);
    const resourcesInputRef = useRef(null);

    // Modal state for deletions
    const [deleteModalState, setDeleteModalState] = useState({
        isOpen: false,
        actionType: null, // 'item' or 'vendor'
        data: null // { section, idx, label } or { vendorKey, vendorName }
    });

    // Refs for controlled inputs (fix #11)
    const aliasInputRefs = useRef({});
    const patternInputRefs = useRef({});

    // Fuzzy match import modal state (type: 'resources' | 'certs')
    const [fuzzyModal, setFuzzyModal] = useState({ isOpen: false, preview: null, accepted: {}, toCreate: {}, mode: 'delta', type: 'resources' });
    const [expandedCertVendor, setExpandedCertVendor] = useState(null);
    const [certSearch, setCertSearch] = useState('');

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    };

    // Auto-save master data when it changes (debounced)
    const saveTimeoutRef = useRef(null);
    const saveMasterData = useCallback(async (newData) => {
        // Pre-save deduplication: silently remove duplicates (case-insensitive) instead of blocking
        const sectionsToCheck = ['company_certs', 'prof_certs', 'requirement_labels', 'rti_partners'];
        let dedupedData = { ...newData };
        for (const sec of sectionsToCheck) {
            const items = dedupedData[sec] || [];
            const lowerSeen = new Set();
            const deduped = items.filter(item => {
                if (typeof item !== 'string') return true;
                const lower = item.toLowerCase().trim();
                if (lower === '' || !lowerSeen.has(lower)) { lowerSeen.add(lower); return true; }
                return false;
            });
            if (deduped.length !== items.length) dedupedData = { ...dedupedData, [sec]: deduped };
        }

        try {
            await axios.post(`${API_URL}/master-data`, dedupedData);
            showToast('success', t('master.saved'));
            // Refresh ConfigContext so other components (TechEvaluator) get updated masterData
            if (refetchConfig) refetchConfig();
        } catch (error) {
            logger.error('Error saving master data', error);
            showToast('error', `${t('master.error_prefix')}: ${error.response?.data?.detail || error.message}`);
        }
    }, [refetchConfig]); // WARNING: Do not add showToast or t here. showToast causes infinite loops without its own useCallback

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
                const [masterRes, vendorRes, aiStatusRes] = await Promise.all([
                    axios.get(`${API_URL}/master-data`),
                    axios.get(`${API_URL}/vendor-configs`).catch(() => ({ data: [] })),
                    axios.get(`${API_URL}/ai-providers-status`).catch(() => ({ data: { providers: [] } })),
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
                setAiProviders(aiStatusRes.data?.providers || []);
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

    const checkDuplicates = () => {
        if (activeSection !== 'prof_certs' && activeSection !== 'company_certs') return;
        const items = data[activeSection] || [];
        const lowerSeen = new Map();
        const duplicates = [];
        
        items.forEach((item, idx) => {
            if (typeof item !== 'string') return;
            const lower = item.toLowerCase().trim();
            if (lowerSeen.has(lower)) {
                duplicates.push({ keep: lowerSeen.get(lower), remove: item, removeIdx: idx });
            } else {
                lowerSeen.set(lower, { val: item, idx });
            }
        });

        if (duplicates.length === 0) {
            showToast('success', t('master.no_duplicates'));
            return;
        }

        const newList = items.filter((_, idx) => !duplicates.some(d => d.removeIdx === idx));
        setData(prev => ({ ...prev, [activeSection]: newList }));
        showToast('success', t('master.duplicates_removed', { count: duplicates.length }));
    };

    // Prof certs helpers
    const groupedCerts = useMemo(() => {
        const groups = {};
        (data.prof_certs || []).forEach(cert => {
            const key = data.prof_certs_vendors?.[cert] || '__other__';
            if (!groups[key]) groups[key] = [];
            groups[key].push(cert);
        });
        return groups;
    }, [data.prof_certs, data.prof_certs_vendors]);

    const getVendorName = (key) => {
        if (!key || key === '__other__') return t('master.vendor_other', 'Non categorizzato');
        return vendors.find(v => v.key === key)?.name || key;
    };

    const addProfCert = (label, vendorKey = '') => {
        const trimmed = label.trim();
        if (!trimmed) return;
        setData(prev => ({
            ...prev,
            prof_certs: [...prev.prof_certs, trimmed],
            prof_certs_vendors: { ...prev.prof_certs_vendors, [trimmed]: vendorKey },
            prof_certs_resources: { ...prev.prof_certs_resources, [trimmed]: 0 },
        }));
    };

    const removeProfCert = (cert) => {
        setData(prev => {
            const vendors = { ...(prev.prof_certs_vendors || {}) };
            const resources = { ...(prev.prof_certs_resources || {}) };
            delete vendors[cert];
            delete resources[cert];
            return {
                ...prev,
                prof_certs: prev.prof_certs.filter(c => c !== cert),
                prof_certs_vendors: vendors,
                prof_certs_resources: resources,
            };
        });
    };

    const updateProfCertCount = (cert, count) => {
        setData(prev => ({
            ...prev,
            prof_certs_resources: { ...(prev.prof_certs_resources || {}), [cert]: Math.max(0, count) }
        }));
    };

    const updateProfCertVendor = (cert, vendorKey) => {
        setData(prev => ({
            ...prev,
            prof_certs_vendors: { ...(prev.prof_certs_vendors || {}), [cert]: vendorKey }
        }));
    };

    const handleImportCertList = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await axios.post(`${API_URL}/master-data/import-certs/preview`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const preview = res.data;
            const accepted = {};
            (preview.exact || []).forEach(m => { accepted[m.file_cert] = true; });
            (preview.partial || []).forEach(m => { accepted[m.file_cert] = true; });
            (preview.presumed || []).forEach(m => { accepted[m.file_cert] = false; });
            const toCreate = {};
            (preview.exact || []).forEach(m => { toCreate[m.file_cert] = false; });
            (preview.unmatched || []).forEach(m => { toCreate[m.file_cert] = true; }); // default: add all new
            setFuzzyModal({ isOpen: true, preview, accepted, toCreate, mode: 'delta', type: 'certs' });
        } catch (err) {
            showToast('error', `${t('master.error_prefix')}: ${err.response?.data?.detail || err.message}`);
        }
    };

    const handleImportResourcesPreview = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await axios.post(`${API_URL}/master-data/import-lutech-resources/preview`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const preview = res.data;
            // Pre-accept all exact matches, pre-check partial, uncheck presumed
            const accepted = {};
            (preview.exact || []).forEach(m => { accepted[m.file_cert] = true; });
            (preview.partial || []).forEach(m => { accepted[m.file_cert] = true; });
            (preview.presumed || []).forEach(m => { accepted[m.file_cert] = false; });
            const toCreate = {};
            (preview.exact || []).forEach(m => { toCreate[m.file_cert] = false; });
            (preview.unmatched || []).forEach(m => { toCreate[m.file_cert] = false; });
            setFuzzyModal({ isOpen: true, preview, accepted, toCreate, mode: 'delta', type: 'resources' });
        } catch (err) {
            showToast('error', `${t('master.error_prefix')}: ${err.response?.data?.detail || err.message}`);
        }
    };

    const confirmFuzzyImport = async () => {
        const { preview, accepted, toCreate, mode, type } = fuzzyModal;
        const allMatches = [...(preview.exact || []), ...(preview.partial || []), ...(preview.presumed || [])];
        const acceptedList = allMatches.filter(m => accepted[m.file_cert]);
        const toCreateList = [
            ...(preview.unmatched || [])
                .filter(m => toCreate[m.file_cert])
                .map(m => ({ file_cert: m.file_cert, vendor_key: m.suggested_vendor || '', count: m.count ?? 0 })),
            ...[...(preview.partial || []), ...(preview.presumed || []), ...(type === 'certs' ? (preview.exact || []) : [])]
                .filter(m => toCreate[m.file_cert])
                .map(m => ({ file_cert: m.file_cert, vendor_key: m.csv_vendor || '', count: m.count ?? 0 })),
        ];
        const closeFuzzy = () => setFuzzyModal({ isOpen: false, preview: null, accepted: {}, toCreate: {}, mode: 'delta', type: 'resources' });
        try {
            if (type === 'certs') {
                const res = await axios.post(`${API_URL}/master-data/import-certs/confirm`, {
                    accepted: acceptedList.map(m => ({ file_cert: m.file_cert, matched_cert: m.matched_cert, csv_vendor: m.csv_vendor || '' })),
                    to_create: toCreateList.map(m => ({ file_cert: m.file_cert, vendor_key: m.vendor_key || '' })),
                    mode,
                });
                const masterRes = await axios.get(`${API_URL}/master-data`);
                setData(prev => ({ ...prev, ...masterRes.data }));
                const { added = [], vendor_updated = [] } = res.data;
                showToast('success', t('master.import_certs_success', { added: added.length, skipped: acceptedList.length }));
                closeFuzzy();
            } else {
                const res = await axios.post(`${API_URL}/master-data/import-lutech-resources/confirm`, {
                    accepted: acceptedList,
                    to_create: toCreateList,
                    mode,
                });
                const masterRes = await axios.get(`${API_URL}/master-data`);
                setData(prev => ({ ...prev, ...masterRes.data }));
                const { updated = [], created = [] } = res.data;
                showToast('success', t('master.import_resources_success', { count: updated.length + created.length }));
                closeFuzzy();
            }
        } catch (err) {
            showToast('error', `${t('master.error_prefix')}: ${err.response?.data?.detail || err.message}`);
        }
    };

    // Vendor management functions
    const toggleVendorEnabled = async (vendorKey) => {
        const vendor = vendors.find(v => v.key === vendorKey);
        if (!vendor) return;

        try {
            await axios.put(`${API_URL}/vendor-configs/${encodeURIComponent(vendorKey)}`, {
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
            await axios.put(`${API_URL}/vendor-configs/${encodeURIComponent(vendorKey)}`, {
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

    const handleDeleteConfirm = async () => {
        try {
            if (deleteModalState.actionType === 'vendor' && deleteModalState.data) {
                logger.info(`Confirming deletion for vendor: ${deleteModalState.data.vendorName}`);
                await executeDeleteVendor(deleteModalState.data.vendorKey, deleteModalState.data.vendorName);
            } else if (deleteModalState.actionType === 'item' && deleteModalState.data) {
                logger.info(`Confirming deletion for item: ${deleteModalState.data.label} in ${deleteModalState.data.section}`);
                if (deleteModalState.data.isProfCert) {
                    removeProfCert(deleteModalState.data.certLabel);
                } else {
                    deleteItem(deleteModalState.data.section, deleteModalState.data.idx);
                }
            } else if (deleteModalState.actionType === 'import_db') {
                logger.info('Confirming database import');
                await executeImportDb();
            }
        } catch (error) {
            logger.error('Error in handleDeleteConfirm', error);
        } finally {
            setDeleteModalState({ isOpen: false, actionType: null, data: null });
        }
    };

    const executeDeleteVendor = async (vendorKey, vendorName) => {
        try {
            await axios.delete(`${API_URL}/vendor-configs/${encodeURIComponent(vendorKey)}`);
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
            const errorDetail = error.response?.data?.detail || error.message;
            showToast('error', `Errore durante l'export: ${errorDetail}`);
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
        { id: 'ai_config', label: t('master.ai_config'), icon: Bot, color: 'text-teal-600', bg: 'bg-teal-50' },
        { id: 'database_tools', label: t('master.database_backup'), icon: Database, color: 'text-slate-600', bg: 'bg-slate-50' },
    ];

    return (
        <div className="min-h-screen p-6 overflow-auto pb-32">
            {/* Toast notification (fix #15) */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-md transition-all border border-white/40 ${toast.type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'
                    }`}>
                    {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
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
                            <h1 className="text-2xl font-black text-slate-800 font-display tracking-tightest leading-tight">{t('master.poste_data', 'Poste Master Data')}</h1>
                            <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest-plus font-display">{t('master.system_config')}</span>
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
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest-plus mb-6 px-3 font-display border-l-2 border-indigo-500 pl-4">{t('master.master_data_sections')}</div>
                            {sections.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setActiveSection(s.id)}
                                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 font-black text-[10px] uppercase tracking-widest-plus font-display ${activeSection === s.id
                                        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200'
                                        : 'text-slate-500 hover:bg-white/60 hover:translate-x-1'
                                        } mb-3 last:mb-0 group`}
                                >
                                    <s.icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${activeSection === s.id ? 'text-white' : s.color}`} />
                                    <span className="text-left">{s.label}</span>
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
                                <div className="flex items-center gap-3 flex-wrap">
                                    {(activeSection === 'prof_certs' || activeSection === 'company_certs') && (
                                        <button
                                            onClick={checkDuplicates}
                                            className="px-6 py-4 bg-orange-100 text-orange-700 border border-orange-200 rounded-2xl hover:bg-orange-200 transition-all flex items-center gap-3 text-[10px] font-black uppercase tracking-widest-plus font-display shadow-sm active:scale-95 group"
                                        >
                                            <ShieldCheck className="w-4 h-4" />
                                            <span>{t('master.check_duplicates')}</span>
                                        </button>
                                    )}
                                    {activeSection === 'prof_certs' && (
                                        <>
                                            <input type="file" accept=".csv" ref={certListInputRef} className="hidden" onChange={handleImportCertList} />
                                            <input type="file" accept=".csv" ref={resourcesInputRef} className="hidden" onChange={handleImportResourcesPreview} />
                                            <button
                                                onClick={() => certListInputRef.current?.click()}
                                                className="px-6 py-4 bg-blue-50 text-blue-700 border border-blue-200 rounded-2xl hover:bg-blue-100 transition-all flex items-center gap-3 text-[10px] font-black uppercase tracking-widest-plus font-display shadow-sm active:scale-95"
                                            >
                                                <Upload className="w-4 h-4" />
                                                <span>{t('master.import_certs_btn', 'Import Lista Cert')}</span>
                                            </button>
                                            <button
                                                onClick={() => resourcesInputRef.current?.click()}
                                                className="px-6 py-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-2xl hover:bg-emerald-100 transition-all flex items-center gap-3 text-[10px] font-black uppercase tracking-widest-plus font-display shadow-sm active:scale-95"
                                            >
                                                <Upload className="w-4 h-4" />
                                                <span>{t('master.import_resources_btn', 'Import Risorse Lutech')}</span>
                                            </button>
                                        </>
                                    )}
                                    {activeSection !== 'ocr_settings' && activeSection !== 'database_tools' && activeSection !== 'ai_config' && activeSection !== 'prof_certs' && (
                                        <button
                                            onClick={() => addItem(activeSection)}
                                            className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl hover:brightness-110 transition-all flex items-center gap-4 text-[10px] font-black uppercase tracking-widest-plus font-display shadow-xl shadow-indigo-200 active:scale-95 group"
                                        >
                                            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                                            <span>{t('master.add_item')}</span>
                                        </button>
                                    )}
                                </div>
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
                                            <h4 className="text-sm font-black text-purple-800 uppercase tracking-widest font-display mb-6 px-1">{t('master.new_vendor')}</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                                <div className="bg-white/50 p-4 rounded-xl border border-white/60">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1 font-display">{t('master.unique_key')}</label>
                                                    <input
                                                        type="text"
                                                        value={newVendor.key}
                                                        onChange={(e) => setNewVendor(prev => ({ ...prev, key: e.target.value }))}
                                                        placeholder="es: uipath"
                                                        className="w-full p-2.5 bg-white/50 border border-slate-200/50 rounded-lg outline-none text-sm font-semibold font-body transition-all focus:ring-2 focus:ring-purple-500/30"
                                                    />
                                                </div>
                                                <div className="bg-white/50 p-4 rounded-xl border border-white/60">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1 font-display">{t('master.display_name')}</label>
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
                                                    {t('master.create_vendor')}
                                                </button>
                                                <button
                                                    onClick={() => { setShowAddVendor(false); setNewVendor({ key: '', name: '' }); }}
                                                    className="px-6 py-2.5 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest font-display hover:bg-slate-300 transition-all"
                                                >
                                                    {t('master.cancel')}
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
                                                                    {vendor.aliases?.length || 0} {t('master.aliases')}
                                                                </span>
                                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50/50 backdrop-blur-sm border border-blue-100/50 rounded-xl px-3 py-1.5 uppercase tracking-widest-plus font-display shadow-sm">
                                                                    {vendor.cert_patterns?.length || 0} {t('master.cert_patterns')}
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
                                                                    {t('master.aliases_label')}
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
                                                                        placeholder={t('master.new_alias_placeholder')}
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
                                                                    {t('master.patterns_label')}
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
                                                                        placeholder={t('master.new_pattern_placeholder')}
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
                                                                    {t('master.delete_vendor')}
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
                            ) : activeSection === 'ai_config' ? (
                                <div className="space-y-6">
                                    {/* Enable/disable toggle */}
                                    <button
                                        onClick={() => setData(prev => ({ ...prev, ai_enabled: !prev.ai_enabled }))}
                                        className={`w-full flex items-center justify-between px-6 py-5 rounded-2xl border-2 transition-all duration-300 ${data.ai_enabled
                                            ? 'border-teal-400 bg-teal-50/60'
                                            : 'border-slate-200 bg-white/40 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <Bot className={`w-5 h-5 ${data.ai_enabled ? 'text-teal-600' : 'text-slate-400'}`} />
                                            <div className="text-left">
                                                <p className={`text-sm font-black font-display uppercase tracking-widest-plus ${data.ai_enabled ? 'text-teal-800' : 'text-slate-600'}`}>
                                                    {t('master.ai_enabled_label')}
                                                </p>
                                                <p className="text-[11px] text-slate-400 font-body mt-0.5">
                                                    {t('master.ai_config_desc')}
                                                </p>
                                            </div>
                                        </div>
                                        {data.ai_enabled
                                            ? <ToggleRight className="w-9 h-9 text-teal-500 flex-shrink-0" />
                                            : <ToggleLeft className="w-9 h-9 text-slate-300 flex-shrink-0" />
                                        }
                                    </button>
                                    {/* Provider cards — only shown when enabled */}
                                    {data.ai_enabled && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {[
                                            { id: 'gemini', name: 'Google Gemini', hint: t('master.ai_gemini_hint'), color: 'teal' },
                                            { id: 'groq', name: 'Groq (Llama 3.1)', hint: t('master.ai_groq_hint'), color: 'orange' },
                                            { id: 'claude', name: 'Anthropic Claude', hint: t('master.ai_claude_hint'), color: 'indigo' },
                                        ].map(({ id, name, hint, color }) => {
                                            const providerStatus = aiProviders.find(p => p.id === id);
                                            const isReady = providerStatus?.ready ?? false;
                                            const isSelected = data.ai_provider === id;
                                            return (
                                                <button
                                                    key={id}
                                                    onClick={() => setData(prev => ({ ...prev, ai_provider: id }))}
                                                    className={`relative p-6 rounded-[1.5rem] border-2 text-left transition-all duration-300 ${isSelected
                                                        ? `border-${color}-500 bg-${color}-50/60 shadow-xl shadow-${color}-200/40`
                                                        : 'border-slate-200 bg-white/40 hover:border-slate-300 hover:bg-white/60'
                                                    }`}
                                                >
                                                    {isSelected && (
                                                        <div className={`absolute top-3 right-3 w-5 h-5 rounded-full bg-${color}-500 flex items-center justify-center`}>
                                                            <Check className="w-3 h-3 text-white" />
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <Bot className={`w-5 h-5 ${isSelected ? `text-${color}-600` : 'text-slate-400'}`} />
                                                        <span className={`text-sm font-black font-display uppercase tracking-widest-plus ${isSelected ? `text-${color}-800` : 'text-slate-700'}`}>
                                                            {name}
                                                        </span>
                                                    </div>
                                                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold font-display uppercase tracking-wider mb-3 ${isReady ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-green-500' : 'bg-amber-500'}`} />
                                                        {isReady ? t('master.ai_key_ready') : t('master.ai_key_missing')}
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 font-body leading-relaxed mb-3">{hint}</p>
                                                    {/* Per-provider model input */}
                                                    <div onClick={e => e.stopPropagation()}>
                                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 font-display">
                                                            {t('master.ai_model_label')}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={(data.ai_models || {})[id] || ''}
                                                            onChange={e => setData(prev => ({
                                                                ...prev,
                                                                ai_models: { ...(prev.ai_models || {}), [id]: e.target.value }
                                                            }))}
                                                            placeholder={t('master.ai_model_placeholder')}
                                                            className="w-full px-3 py-2 bg-white/70 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-800 focus:ring-2 focus:ring-teal-400 outline-none transition-all"
                                                        />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>}
                                </div>
                            ) : activeSection === 'database_tools' ? (
                                <div className="space-y-8">
                                    <div className="bg-white/40 backdrop-blur-md border border-white/60 p-8 rounded-[2rem] shadow-xl shadow-slate-200/50">
                                        <div className="flex items-start gap-6">
                                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center flex-shrink-0 border border-indigo-100/50">
                                                <FileDown className="w-7 h-7 text-indigo-600" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-black text-slate-800 font-display mb-2 tracking-tight">{t('master.export_db')}</h3>
                                                <p className="text-sm text-slate-600 font-body mb-6 leading-relaxed">
                                                    Scarica l'intero database locale contenente tutte le configurazioni, i master data, i lotti di gara, i piani economici e i calcoli. Questo export funge da backup completo.
                                                    <br />
                                                    <span className="inline-block mt-2 font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md text-[10px]">
                                                        {t('master.backup_note')}
                                                    </span>
                                                </p>
                                                <button
                                                    onClick={handleExportDb}
                                                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest-plus font-display hover:bg-indigo-700 transition-all flex items-center gap-3 shadow-lg shadow-indigo-200 active:scale-95"
                                                >
                                                    <FileDown className="w-4 h-4" />
                                                    {t('master.download_backup')}
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
                                                <h3 className="text-lg font-black text-red-800 font-display mb-2 tracking-tight">{t('master.import_db')}</h3>
                                                <p className="text-sm text-red-600/80 font-body mb-6 leading-relaxed">
                                                    {t('master.import_db_warning_full')}
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
                                                    {t('master.restore_backup')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : activeSection === 'prof_certs' ? (
                                /* Prof Certs — vendor-grouped accordion */
                                <div className="space-y-4">
                                    {/* Search filter */}
                                    <div className="relative mb-2">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder={t('master.cert_search_placeholder', 'Cerca per nome o vendor...')}
                                            value={certSearch}
                                            onChange={(e) => setCertSearch(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2.5 bg-white/60 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30"
                                        />
                                    </div>
                                    {/* Add cert form */}
                                    <div className="flex gap-3 mb-2">
                                        <input
                                            id="new-prof-cert-input"
                                            type="text"
                                            placeholder={t('master.item_placeholder')}
                                            className="flex-1 p-3 bg-white/60 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/30"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const vendorSel = document.getElementById('new-prof-cert-vendor');
                                                    addProfCert(e.target.value, vendorSel?.value || '');
                                                    e.target.value = '';
                                                }
                                            }}
                                        />
                                        <select
                                            id="new-prof-cert-vendor"
                                            className="p-3 bg-white/60 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30"
                                        >
                                            <option value="">{t('master.no_vendor', '-- Nessun Vendor --')}</option>
                                            {vendors.map(v => <option key={v.key} value={v.key}>{v.name}</option>)}
                                        </select>
                                        <button
                                            onClick={() => {
                                                const inp = document.getElementById('new-prof-cert-input');
                                                const sel = document.getElementById('new-prof-cert-vendor');
                                                addProfCert(inp?.value || '', sel?.value || '');
                                                if (inp) inp.value = '';
                                            }}
                                            className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest font-display shadow-lg shadow-indigo-200 active:scale-95 flex items-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {Object.keys(groupedCerts).length === 0 ? (
                                        <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/20">
                                            <div className="w-16 h-16 bg-white/60 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-white">
                                                <Info className="w-8 h-8 text-slate-400" />
                                            </div>
                                            <p className="text-slate-500 font-display text-sm font-bold uppercase tracking-widest text-[10px]">{t('master.no_items')}</p>
                                        </div>
                                    ) : (
                                        // Sort: named vendors first, __other__ last; then filter by search
                                        [...Object.entries(groupedCerts)].sort(([a], [b]) => {
                                            if (a === '__other__') return 1;
                                            if (b === '__other__') return -1;
                                            return getVendorName(a).localeCompare(getVendorName(b));
                                        }).flatMap(([vendorKey, certs]) => {
                                            if (!certSearch.trim()) return [[vendorKey, certs]];
                                            const q = certSearch.trim().toLowerCase();
                                            const vendorName = getVendorName(vendorKey).toLowerCase();
                                            const filtered = certs.filter(c => c.toLowerCase().includes(q) || vendorName.includes(q));
                                            return filtered.length ? [[vendorKey, filtered]] : [];
                                        }).map(([vendorKey, certs]) => (
                                            <div key={vendorKey} className="glass-card rounded-2xl border border-white/40 overflow-hidden shadow-sm">
                                                <button
                                                    className="w-full flex items-center justify-between p-5 hover:bg-white/60 transition-all"
                                                    onClick={() => setExpandedCertVendor(expandedCertVendor === vendorKey ? null : vendorKey)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-black uppercase tracking-widest font-display text-slate-600">
                                                            {getVendorName(vendorKey)}
                                                        </span>
                                                        <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                                            {certs.length}
                                                        </span>
                                                    </div>
                                                    {expandedCertVendor === vendorKey ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                                </button>
                                                {expandedCertVendor === vendorKey && (
                                                    <div className="border-t border-white/60 divide-y divide-slate-100/60">
                                                        {certs.map(cert => {
                                                            const count = (() => {
                                                                const v = data.prof_certs_resources?.[cert];
                                                                return Array.isArray(v) ? v.length : (typeof v === 'number' ? v : 0);
                                                            })();
                                                            return (
                                                                <div key={cert} className="flex items-center gap-3 px-5 py-3 bg-white/30 hover:bg-white/60 transition-all group">
                                                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${count > 0 ? 'bg-emerald-500' : 'bg-red-300'}`} />
                                                                    <span className="flex-1 text-sm font-semibold text-slate-800 truncate" title={cert}>{cert}</span>
                                                                    {/* Vendor selector */}
                                                                    <select
                                                                        value={data.prof_certs_vendors?.[cert] || ''}
                                                                        onChange={(e) => updateProfCertVendor(cert, e.target.value)}
                                                                        className="text-[10px] font-bold text-slate-500 bg-white/60 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
                                                                    >
                                                                        <option value="">{t('master.no_vendor', '-- Vendor --')}</option>
                                                                        {vendors.map(v => <option key={v.key} value={v.key}>{v.name}</option>)}
                                                                    </select>
                                                                    {/* Count input */}
                                                                    <div className="flex items-center gap-1">
                                                                        <Users className="w-3.5 h-3.5 text-slate-400" />
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            value={count}
                                                                            onChange={(e) => updateProfCertCount(cert, parseInt(e.target.value, 10) || 0)}
                                                                            className="w-16 text-center text-sm font-bold text-slate-700 bg-white/60 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-400"
                                                                        />
                                                                    </div>
                                                                    {/* Delete */}
                                                                    <button
                                                                        onClick={() => setDeleteModalState({
                                                                            isOpen: true,
                                                                            actionType: 'item',
                                                                            data: { section: 'prof_certs', idx: data.prof_certs.indexOf(cert), label: cert, isProfCert: true, certLabel: cert }
                                                                        })}
                                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50/50 rounded-xl transition-all active:scale-95 opacity-0 group-hover:opacity-100"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
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
                title={t('common.confirm_deletion')}
                description={
                    deleteModalState.actionType === 'vendor'
                        ? t('master.delete_vendor_confirm', { name: deleteModalState.data?.vendorName })
                        : deleteModalState.actionType === 'import_db'
                            ? t('master.import_db_warning', { fileName: deleteModalState.data?.file?.name })
                            : t('master.delete_item_confirm', { label: deleteModalState.data?.label || '' })
                }
            />

            {fuzzyModal.isOpen && fuzzyModal.preview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setFuzzyModal({ isOpen: false, preview: null, accepted: {}, toCreate: {}, mode: 'delta', type: 'resources' })}></div>
                    <div className="relative bg-white/95 backdrop-blur-md border border-white p-8 rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-start mb-4 gap-4">
                            <div>
                                <h3 className="text-[20px] font-black text-slate-800 font-display leading-tight">
                                    {fuzzyModal.type === 'certs' ? t('master.import_certs_preview_title', 'Import Lista Certificazioni') : t('master.import_review_title', 'Import Risorse Lutech Certificate')}
                                </h3>
                                <p className="text-sm text-slate-500">{t('master.import_review_subtitle', 'Verifica e conferma i match trovati')}</p>
                            </div>
                            <button onClick={() => setFuzzyModal({ isOpen: false, preview: null, accepted: {}, toCreate: {}, mode: 'delta', type: 'resources' })} className="p-2 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        {/* Delta / Overwrite toggle */}
                        <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">{t('master.import_mode', 'Modalità Import')}:</span>
                            <button
                                onClick={() => setFuzzyModal(prev => ({ ...prev, mode: 'delta' }))}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest font-display transition-all ${fuzzyModal.mode === 'delta' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
                            >
                                {t('master.import_mode_delta', 'Aggiungi (Delta)')}
                            </button>
                            <button
                                onClick={() => setFuzzyModal(prev => ({ ...prev, mode: 'overwrite' }))}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest font-display transition-all ${fuzzyModal.mode === 'overwrite' ? 'bg-red-600 text-white shadow' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
                            >
                                {t('master.import_mode_overwrite', 'Sovrascrivi')}
                            </button>
                            {fuzzyModal.mode === 'overwrite' && (
                                <span className="text-[9px] text-red-500 font-bold">⚠ {fuzzyModal.type === 'certs' ? t('master.import_certs_overwrite_warn', 'Le cert non nel file verranno rimosse') : t('master.import_overwrite_warn', 'I contatori esistenti verranno azzerati')}</span>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
                            {/* Exact matches */}
                            {(fuzzyModal.preview.exact || []).length > 0 && (
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block" />
                                        {t('master.match_exact', 'Match Esatti')} ({fuzzyModal.preview.exact.length})
                                        <div className="ml-auto flex gap-2">
                                            {fuzzyModal.type === 'certs' ? (
                                                <>
                                                    <button onClick={() => setFuzzyModal(prev => {
                                                        const accepted = { ...prev.accepted }; const toCreate = { ...prev.toCreate };
                                                        (prev.preview.exact || []).forEach(m => { accepted[m.file_cert] = true; toCreate[m.file_cert] = false; });
                                                        return { ...prev, accepted, toCreate };
                                                    })} className="text-[9px] font-bold text-emerald-600 hover:text-emerald-800 normal-case underline underline-offset-2">tutti match</button>
                                                    <span className="text-slate-300">|</span>
                                                    <button onClick={() => setFuzzyModal(prev => {
                                                        const accepted = { ...prev.accepted }; const toCreate = { ...prev.toCreate };
                                                        (prev.preview.exact || []).forEach(m => { accepted[m.file_cert] = false; toCreate[m.file_cert] = true; });
                                                        return { ...prev, accepted, toCreate };
                                                    })} className="text-[9px] font-bold text-rose-500 hover:text-rose-700 normal-case underline underline-offset-2">tutti crea</button>
                                                    <span className="text-slate-300">|</span>
                                                    <button onClick={() => setFuzzyModal(prev => {
                                                        const accepted = { ...prev.accepted }; const toCreate = { ...prev.toCreate };
                                                        (prev.preview.exact || []).forEach(m => { accepted[m.file_cert] = false; toCreate[m.file_cert] = false; });
                                                        return { ...prev, accepted, toCreate };
                                                    })} className="text-[9px] font-bold text-slate-400 hover:text-slate-600 normal-case underline underline-offset-2">nessuno</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => setFuzzyModal(prev => {
                                                        const accepted = { ...prev.accepted };
                                                        (prev.preview.exact || []).forEach(m => { accepted[m.file_cert] = true; });
                                                        return { ...prev, accepted };
                                                    })} className="text-[9px] font-bold text-emerald-600 hover:text-emerald-800 normal-case underline underline-offset-2">tutti</button>
                                                    <span className="text-slate-300">|</span>
                                                    <button onClick={() => setFuzzyModal(prev => {
                                                        const accepted = { ...prev.accepted };
                                                        (prev.preview.exact || []).forEach(m => { accepted[m.file_cert] = false; });
                                                        return { ...prev, accepted };
                                                    })} className="text-[9px] font-bold text-slate-400 hover:text-slate-600 normal-case underline underline-offset-2">nessuno</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        {fuzzyModal.preview.exact.map(m => {
                                            const isAccepted = !!fuzzyModal.accepted[m.file_cert];
                                            const isCreate = !!fuzzyModal.toCreate[m.file_cert];
                                            return (
                                                <div key={m.file_cert} className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm ${isCreate ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                                    <>
                                                        <button onClick={() => setFuzzyModal(prev => {
                                                            const next = !prev.accepted[m.file_cert];
                                                            return { ...prev, accepted: { ...prev.accepted, [m.file_cert]: next }, toCreate: { ...prev.toCreate, [m.file_cert]: next ? false : prev.toCreate[m.file_cert] } };
                                                        })} className={`text-[9px] font-black px-2 py-0.5 rounded-lg border transition-all flex-shrink-0 ${isAccepted ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-300 hover:text-emerald-500'}`}>Match</button>
                                                        <button onClick={() => setFuzzyModal(prev => {
                                                            const next = !prev.toCreate[m.file_cert];
                                                            return { ...prev, toCreate: { ...prev.toCreate, [m.file_cert]: next }, accepted: { ...prev.accepted, [m.file_cert]: next ? false : prev.accepted[m.file_cert] } };
                                                        })} className={`text-[9px] font-black px-2 py-0.5 rounded-lg border transition-all flex-shrink-0 ${isCreate ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-400 border-slate-200 hover:border-rose-300 hover:text-rose-500'}`}>+ Crea</button>
                                                    </>
                                                    <span className="font-semibold text-slate-700 truncate flex-1">{m.file_cert}</span>
                                                    {isCreate && m.csv_vendor && <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase flex-shrink-0">{m.csv_vendor}</span>}
                                                    {!isCreate && <><span className="text-slate-400 flex-shrink-0">→</span><span className="font-bold text-emerald-700 truncate flex-1">{m.matched_cert}</span></>}
                                                    {m.count !== undefined && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{m.count}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {/* Partial matches */}
                            {(fuzzyModal.preview.partial || []).length > 0 && (
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-amber-400 rounded-full inline-block" />
                                        {t('master.match_partial', 'Match Parziali')} ({fuzzyModal.preview.partial.length})
                                        <div className="ml-auto flex gap-2">
                                            <button onClick={() => setFuzzyModal(prev => {
                                                const accepted = { ...prev.accepted }; const toCreate = { ...prev.toCreate };
                                                (prev.preview.partial || []).forEach(m => { accepted[m.file_cert] = true; toCreate[m.file_cert] = false; });
                                                return { ...prev, accepted, toCreate };
                                            })} className="text-[9px] font-bold text-amber-600 hover:text-amber-800 normal-case underline underline-offset-2">tutti match</button>
                                            <span className="text-slate-300">|</span>
                                            <button onClick={() => setFuzzyModal(prev => {
                                                const accepted = { ...prev.accepted }; const toCreate = { ...prev.toCreate };
                                                (prev.preview.partial || []).forEach(m => { accepted[m.file_cert] = false; toCreate[m.file_cert] = true; });
                                                return { ...prev, accepted, toCreate };
                                            })} className="text-[9px] font-bold text-rose-500 hover:text-rose-700 normal-case underline underline-offset-2">tutti crea</button>
                                            <span className="text-slate-300">|</span>
                                            <button onClick={() => setFuzzyModal(prev => {
                                                const accepted = { ...prev.accepted }; const toCreate = { ...prev.toCreate };
                                                (prev.preview.partial || []).forEach(m => { accepted[m.file_cert] = false; toCreate[m.file_cert] = false; });
                                                return { ...prev, accepted, toCreate };
                                            })} className="text-[9px] font-bold text-slate-400 hover:text-slate-600 normal-case underline underline-offset-2">nessuno</button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        {fuzzyModal.preview.partial.map(m => {
                                            const isAccepted = !!fuzzyModal.accepted[m.file_cert];
                                            const isCreate = !!fuzzyModal.toCreate[m.file_cert];
                                            return (
                                                <div key={m.file_cert} className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-xl border border-amber-100 text-sm">
                                                    <button
                                                        onClick={() => setFuzzyModal(prev => {
                                                            const next = !prev.accepted[m.file_cert];
                                                            return { ...prev, accepted: { ...prev.accepted, [m.file_cert]: next }, toCreate: { ...prev.toCreate, [m.file_cert]: next ? false : prev.toCreate[m.file_cert] } };
                                                        })}
                                                        className={`text-[9px] font-black px-2 py-0.5 rounded-lg border transition-all flex-shrink-0 ${isAccepted ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-400 border-slate-200 hover:border-amber-300 hover:text-amber-500'}`}
                                                    >Match</button>
                                                    <button
                                                        onClick={() => setFuzzyModal(prev => {
                                                            const next = !prev.toCreate[m.file_cert];
                                                            return { ...prev, toCreate: { ...prev.toCreate, [m.file_cert]: next }, accepted: { ...prev.accepted, [m.file_cert]: next ? false : prev.accepted[m.file_cert] } };
                                                        })}
                                                        className={`text-[9px] font-black px-2 py-0.5 rounded-lg border transition-all flex-shrink-0 ${isCreate ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-400 border-slate-200 hover:border-rose-300 hover:text-rose-500'}`}
                                                    >+ Crea</button>
                                                    <span className="font-semibold text-slate-700 truncate flex-1">{m.file_cert}</span>
                                                    {isCreate && m.csv_vendor && <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase flex-shrink-0">{m.csv_vendor}</span>}
                                                    {!isCreate && <><span className="text-slate-400 flex-shrink-0">→</span><span className="font-bold text-amber-700 truncate flex-1">{m.matched_cert}</span></>}
                                                    <span className="text-[9px] text-slate-400 flex-shrink-0">{Math.round(m.similarity * 100)}%</span>
                                                    {m.count !== undefined && <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex-shrink-0">{m.count}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {/* Presumed matches */}
                            {(fuzzyModal.preview.presumed || []).length > 0 && (
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-2 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-orange-400 rounded-full inline-block" />
                                        {t('master.match_presumed', 'Match Presunti')} ({fuzzyModal.preview.presumed.length})
                                        <div className="ml-auto flex gap-2">
                                            <button onClick={() => setFuzzyModal(prev => {
                                                const accepted = { ...prev.accepted }; const toCreate = { ...prev.toCreate };
                                                (prev.preview.presumed || []).forEach(m => { accepted[m.file_cert] = true; toCreate[m.file_cert] = false; });
                                                return { ...prev, accepted, toCreate };
                                            })} className="text-[9px] font-bold text-orange-600 hover:text-orange-800 normal-case underline underline-offset-2">tutti match</button>
                                            <span className="text-slate-300">|</span>
                                            <button onClick={() => setFuzzyModal(prev => {
                                                const accepted = { ...prev.accepted }; const toCreate = { ...prev.toCreate };
                                                (prev.preview.presumed || []).forEach(m => { accepted[m.file_cert] = false; toCreate[m.file_cert] = true; });
                                                return { ...prev, accepted, toCreate };
                                            })} className="text-[9px] font-bold text-rose-500 hover:text-rose-700 normal-case underline underline-offset-2">tutti crea</button>
                                            <span className="text-slate-300">|</span>
                                            <button onClick={() => setFuzzyModal(prev => {
                                                const accepted = { ...prev.accepted }; const toCreate = { ...prev.toCreate };
                                                (prev.preview.presumed || []).forEach(m => { accepted[m.file_cert] = false; toCreate[m.file_cert] = false; });
                                                return { ...prev, accepted, toCreate };
                                            })} className="text-[9px] font-bold text-slate-400 hover:text-slate-600 normal-case underline underline-offset-2">nessuno</button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        {fuzzyModal.preview.presumed.map(m => {
                                            const isAccepted = !!fuzzyModal.accepted[m.file_cert];
                                            const isCreate = !!fuzzyModal.toCreate[m.file_cert];
                                            return (
                                                <div key={m.file_cert} className="flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-xl border border-orange-100 text-sm">
                                                    <button
                                                        onClick={() => setFuzzyModal(prev => {
                                                            const next = !prev.accepted[m.file_cert];
                                                            return { ...prev, accepted: { ...prev.accepted, [m.file_cert]: next }, toCreate: { ...prev.toCreate, [m.file_cert]: next ? false : prev.toCreate[m.file_cert] } };
                                                        })}
                                                        className={`text-[9px] font-black px-2 py-0.5 rounded-lg border transition-all flex-shrink-0 ${isAccepted ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-400 border-slate-200 hover:border-orange-300 hover:text-orange-500'}`}
                                                    >Match</button>
                                                    <button
                                                        onClick={() => setFuzzyModal(prev => {
                                                            const next = !prev.toCreate[m.file_cert];
                                                            return { ...prev, toCreate: { ...prev.toCreate, [m.file_cert]: next }, accepted: { ...prev.accepted, [m.file_cert]: next ? false : prev.accepted[m.file_cert] } };
                                                        })}
                                                        className={`text-[9px] font-black px-2 py-0.5 rounded-lg border transition-all flex-shrink-0 ${isCreate ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-400 border-slate-200 hover:border-rose-300 hover:text-rose-500'}`}
                                                    >+ Crea</button>
                                                    <span className="font-semibold text-slate-700 truncate flex-1">{m.file_cert}</span>
                                                    {isCreate && m.csv_vendor && <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase flex-shrink-0">{m.csv_vendor}</span>}
                                                    {!isCreate && <><span className="text-slate-400 flex-shrink-0">→</span><span className="font-bold text-orange-700 truncate flex-1">{m.matched_cert}</span></>}
                                                    <span className="text-[9px] text-slate-400 flex-shrink-0">{Math.round(m.similarity * 100)}%</span>
                                                    {m.count !== undefined && <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full flex-shrink-0">{m.count}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {/* Unmatched — with option to create */}
                            {(fuzzyModal.preview.unmatched || []).length > 0 && (
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-2 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-red-400 rounded-full inline-block" />
                                        {t('master.match_unmatched', 'Non Trovati')} ({fuzzyModal.preview.unmatched.length})
                                        <div className="ml-auto flex gap-2">
                                            <button onClick={() => setFuzzyModal(prev => {
                                                const toCreate = { ...prev.toCreate };
                                                (prev.preview.unmatched || []).forEach(m => { toCreate[m.file_cert] = true; });
                                                return { ...prev, toCreate };
                                            })} className="text-[9px] font-bold text-rose-500 hover:text-rose-700 normal-case underline underline-offset-2">tutti crea</button>
                                            <span className="text-slate-300">|</span>
                                            <button onClick={() => setFuzzyModal(prev => {
                                                const toCreate = { ...prev.toCreate };
                                                (prev.preview.unmatched || []).forEach(m => { toCreate[m.file_cert] = false; });
                                                return { ...prev, toCreate };
                                            })} className="text-[9px] font-bold text-slate-400 hover:text-slate-600 normal-case underline underline-offset-2">nessuno</button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        {fuzzyModal.preview.unmatched.map(m => (
                                            <label key={m.file_cert} className="flex items-center gap-3 px-4 py-2 bg-red-50 rounded-xl border border-red-100 text-sm cursor-pointer hover:bg-red-100 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={!!fuzzyModal.toCreate[m.file_cert]}
                                                    onChange={(e) => setFuzzyModal(prev => ({ ...prev, toCreate: { ...prev.toCreate, [m.file_cert]: e.target.checked } }))}
                                                    style={{ appearance: 'auto', WebkitAppearance: 'auto', width: '16px', height: '16px', flexShrink: 0, accentColor: '#ef4444', cursor: 'pointer' }}
                                                />
                                                <span className="font-semibold text-slate-700 truncate flex-1">{m.file_cert}</span>
                                                {m.suggested_vendor && (
                                                    <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">{m.suggested_vendor}</span>
                                                )}
                                                {m.count !== undefined && <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">{m.count}</span>}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="pt-5 border-t border-slate-200/60 flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => setFuzzyModal({ isOpen: false, preview: null, accepted: {}, toCreate: {}, mode: 'delta', type: 'resources' })}
                                className="px-6 py-3 text-slate-600 font-bold text-[10px] uppercase tracking-widest-plus font-display bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                            >
                                {t('common.cancel', 'Annulla')}
                            </button>
                            <button
                                onClick={confirmFuzzyImport}
                                className="px-6 py-3 text-white font-bold text-[10px] uppercase tracking-widest-plus font-display bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-200 active:scale-95"
                            >
                                <CheckCircle className="w-4 h-4" />
                                {t('master.confirm_import', 'Conferma Import')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
