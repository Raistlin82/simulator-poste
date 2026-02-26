/**
 * CertVerificationPage Component
 * 
 * Full-page view for extracting information from PDF certificates using OCR.
 * Parses filename to extract requirement code, cert name, and resource name.
 * Uses OCR to extract vendor, cert code, cert name, and validity dates.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API_URL } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import {
  Search,
  FileSearch,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  Filter,
  RotateCcw,
  BarChart3,
  FileText,
  Clock,
  X,
  Upload,
  FolderOpen,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown
} from 'lucide-react';

// Status badge colors
const STATUS_COLORS = {
  valid: 'bg-green-50/50 backdrop-blur-sm border border-green-200/50 text-green-700 shadow-sm',
  expired: 'bg-yellow-50/50 backdrop-blur-sm border border-yellow-200/50 text-yellow-700 shadow-sm',
  mismatch: 'bg-orange-50/50 backdrop-blur-sm border border-orange-200/50 text-orange-700 shadow-sm',
  unreadable: 'bg-gray-50/50 backdrop-blur-sm border border-gray-200/50 text-gray-600 shadow-sm',
  not_downloaded: 'bg-purple-50/50 backdrop-blur-sm border border-purple-200/50 text-purple-700 shadow-sm',
  too_large: 'bg-indigo-50/50 backdrop-blur-sm border border-indigo-200/50 text-indigo-700 shadow-sm',
  error: 'bg-red-50/50 backdrop-blur-sm border border-red-200/50 text-red-700 shadow-sm',
  unprocessed: 'bg-gray-50/50 backdrop-blur-sm border border-gray-200/50 text-gray-500 shadow-sm',
};

const STATUS_ICONS = {
  valid: <CheckCircle2 className="w-3.5 h-3.5 mr-1" />,
  expired: <Clock className="w-3.5 h-3.5 mr-1" />,
  mismatch: <AlertTriangle className="w-3.5 h-3.5 mr-1" />,
  unreadable: <FileSearch className="w-3.5 h-3.5 mr-1" />,
  not_downloaded: <Download className="w-3.5 h-3.5 mr-1" />,
  too_large: <FileText className="w-3.5 h-3.5 mr-1" />,
  error: <XCircle className="w-3.5 h-3.5 mr-1" />,
  unprocessed: <Clock className="w-3.5 h-3.5 mr-1" />
};

const STATUS_LABELS = {
  valid: 'status_valid',
  expired: 'status_expired',
  mismatch: 'status_mismatch',
  unreadable: 'status_unreadable',
  not_downloaded: 'status_not_downloaded',
  too_large: 'status_too_large',
  error: 'status_error',
  unprocessed: 'unprocessed',
};

// Labels for Excel export (keep Italian for file output)
const STATUS_LABELS_EXPORT = {
  valid: 'Estratto',
  expired: 'Scaduto',
  mismatch: 'Mismatch',
  unreadable: 'Non leggibile',
  not_downloaded: 'Non scaricato',
  too_large: 'File troppo grande',
  error: 'Errore',
  unprocessed: 'Non elaborato',
};

// Input mode options
const INPUT_MODES = {
  FOLDER: 'folder',
  UPLOAD: 'upload',
};

// Default column widths
const DEFAULT_COLUMN_WIDTHS = {
  file: 200,
  requisito: 100,
  certFile: 160,
  certAttesa: 220,
  risorsa: 140,
  risorsaOcr: 140,
  vendor: 120,
  certificazione: 250,
  validita: 110,
  stato: 110,
};

// Helper to normalize dates for display
const normalizeDate = (dateStr) => {
  if (!dateStr) return null;
  // Try to parse and format as DD/MM/YYYY
  const formats = [
    /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/,  // DD/MM/YYYY or MM/DD/YYYY
    /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/,  // YYYY/MM/DD
  ];
  for (const fmt of formats) {
    const m = dateStr.match(fmt);
    if (m) {
      // Assume European format (DD/MM/YYYY)
      if (fmt === formats[1]) {
        return `${m[3].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[1]}`;
      }
      return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
    }
  }
  return dateStr;
};

/**
 * Main CertVerificationPage component
 */
export default function CertVerificationPage() {
  const { t } = useTranslation();
  const { getAccessToken } = useAuth();
  const [inputMode, setInputMode] = useState(INPUT_MODES.UPLOAD); // Default to upload for remote compatibility
  const [folderPath, setFolderPath] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [ocrStatus, setOcrStatus] = useState(null);
  const [checkingOcr, setCheckingOcr] = useState(false);
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [lots, setLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0, filename: '' });
  const [filterStatus, setFilterStatus] = useState('');
  const [filterReq, setFilterReq] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [retryingFile, setRetryingFile] = useState(null);

  // Refs for abort and resize handling
  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);
  useEffect(() => {
    const fetchLots = async () => {
      try {
        const res = await axios.get(`${API_URL}/config`);
        const lotKeys = Object.keys(res.data || {});
        setLots(lotKeys);
        // Don't auto-select - keep it optional
      } catch (err) {
        logger.error('Failed to fetch lots', err);
      }
    };
    fetchLots();
  }, []);

  // Refs for resize handling
  const resizingRef = useRef({ column: null, startX: 0, startWidth: 0 });
  const tableRef = useRef(null);

  // Fetch available lots on mount

  // Handle column resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingRef.current.column) return;
      e.preventDefault();

      const diff = e.clientX - resizingRef.current.startX;
      const newWidth = Math.max(60, resizingRef.current.startWidth + diff);

      setColumnWidths(prev => ({
        ...prev,
        [resizingRef.current.column]: newWidth
      }));
    };

    const handleMouseUp = () => {
      if (resizingRef.current.column) {
        resizingRef.current.column = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleResizeStart = (e, columnKey) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      column: columnKey,
      startX: e.clientX,
      startWidth: columnWidths[columnKey]
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Export to Excel (CSV format)
  const exportToExcel = useCallback(() => {
    if (!results?.results?.length) return;

    const headers = [
      'File',
      'Requisito',
      'Cert (File)',
      'Cert Attesa',
      'Risorsa (File)',
      'Risorsa OCR',
      'Vendor',
      'Certificazione OCR',
      'Codice Cert',
      'Valido Da',
      'Valido A',
      'Stato'
    ];

    const rows = results.results.map(r => [
      r.filename || '',
      r.req_code || '',
      r.cert_name_from_file || '',
      (r.expected_cert_names || []).join('; '),
      r.resource_name || '',
      r.resource_name_detected || '',
      r.vendor_detected || '',
      r.cert_name_detected || '',
      r.cert_code_detected || '',
      normalizeDate(r.valid_from) || '',
      normalizeDate(r.valid_until) || '',
      STATUS_LABELS_EXPORT[r.status] || r.status || ''
    ]);

    // Create CSV content with BOM for Excel UTF-8 compatibility
    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cert_verification_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [results]);

  // Check OCR availability
  const checkOcrStatus = useCallback(async () => {
    setCheckingOcr(true);
    try {
      const res = await axios.get(`${API_URL}/verify-certs/status`);
      setOcrStatus(res.data);
    } catch (err) {
      setOcrStatus({ ocr_available: false, error: err.response?.data?.detail || err.message });
    } finally {
      setCheckingOcr(false);
    }
  }, []);

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setError(t('cert_verification.select_zip_error') || 'Seleziona un file ZIP');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  // Clear selected file
  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Check if verify button should be enabled
  const canVerify = inputMode === INPUT_MODES.FOLDER
    ? folderPath.trim() !== ''
    : selectedFile !== null;

  // Verify certificates in folder using SSE for progress
  const handleVerifyFolder = async () => {
    if (!folderPath.trim()) {
      setError(t('cert_verification.enter_path'));
      return;
    }

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setResults(null);
    setProgress({ current: 0, total: 0, filename: '' });

    try {
      // Build query params
      const params = new URLSearchParams({ folder_path: folderPath });
      if (selectedLot) {
        params.append('lot_key', selectedLot);
      }

      // Use SSE streaming endpoint
      const token = getAccessToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/verify-certs/stream?${params}`, {
        method: 'POST',
        headers,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === 'start') {
                setProgress({ current: 0, total: event.total, filename: '' });
              } else if (event.type === 'progress') {
                setProgress({ current: event.current, total: event.total, filename: event.filename });
              } else if (event.type === 'done') {
                setResults(event.results);
                setProgress({ current: 0, total: 0, filename: '' });
              } else if (event.type === 'error') {
                setError(event.message);
              }
            } catch (parseErr) {
              logger.error('Failed to parse SSE event', parseErr);
            }
          }
        }
      }
    } catch (err) {
      // Don't show error if aborted by user
      if (err.name === 'AbortError') {
        setError(null);
      } else {
        const errorMsg = err.message || 'Errore sconosciuto';
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Verify certificates from ZIP upload
  const handleVerifyUpload = async () => {
    if (!selectedFile) {
      setError(t('cert_verification.select_zip_error') || 'Seleziona un file ZIP');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setProgress({ current: 0, total: 0, filename: '' });
    setUploadProgress({ phase: 'uploading', percent: 0 });

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Build query params
      const params = new URLSearchParams();
      if (selectedLot) {
        params.append('lot_key', selectedLot);
      }

      const token = getAccessToken();
      const url = `${API_URL}/verify-certs/upload${params.toString() ? '?' + params.toString() : ''}`;

      const res = await axios.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress({ phase: 'uploading', percent: percentCompleted });
        },
      });

      setResults(res.data);
      setUploadProgress(null);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Errore sconosciuto';
      setError(errorMsg);
      setUploadProgress(null);
    } finally {
      setLoading(false);
    }
  };

  // Main verify handler - routes to appropriate method based on input mode
  const handleVerify = () => {
    if (inputMode === INPUT_MODES.FOLDER) {
      handleVerifyFolder();
    } else {
      handleVerifyUpload();
    }
  };

  // Cancel ongoing OCR process
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setProgress({ current: 0, total: 0, filename: '' });
    }
  }, []);

  // Retry a single failed file
  const handleRetry = useCallback(async (filename) => {
    if (!results?.folder) return;

    setRetryingFile(filename);

    try {
      const token = getAccessToken();
      const pdfPath = `${results.folder}/${filename}`;

      const res = await axios.post(
        `${API_URL}/verify-certs/single`,
        null,
        {
          params: { pdf_path: pdfPath },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      // Update results with the new data
      setResults(prev => {
        if (!prev?.results) return prev;
        const newResults = prev.results.map(r =>
          r.filename === filename ? { ...res.data, filename } : r
        );

        // Recalculate summary
        const summary = {
          ...prev.summary,
          valid: newResults.filter(r => r.status === 'valid').length,
          expired: newResults.filter(r => r.status === 'expired').length,
          mismatch: newResults.filter(r => r.status === 'mismatch').length,
          unreadable: newResults.filter(r => r.status === 'unreadable').length,
          error: newResults.filter(r => r.status === 'error').length,
        };

        return { ...prev, results: newResults, summary };
      });
    } catch (err) {
      logger.error('Retry failed', err);
    } finally {
      setRetryingFile(null);
    }
  }, [results, getAccessToken]);

  // Filter and sort results
  const filteredResults = useMemo(() => {
    if (!results?.results) return [];

    let data = [...results.results];

    // Apply filters
    if (filterStatus) {
      data = data.filter(r => r.status === filterStatus);
    }
    if (filterReq) {
      data = data.filter(r => r.req_code?.toLowerCase().includes(filterReq.toLowerCase()));
    }

    // Apply sorting
    if (sortField) {
      data.sort((a, b) => {
        let valA = a[sortField] || '';
        let valB = b[sortField] || '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [results, filterStatus, filterReq, sortField, sortDir]);

  // Handle column sort click
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Sort indicator
  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 w-3.5 h-3.5 text-slate-300 inline" />;
    return sortDir === 'asc'
      ? <ArrowUp className="ml-2 w-3.5 h-3.5 text-indigo-600 inline" />
      : <ArrowDown className="ml-2 w-3.5 h-3.5 text-indigo-600 inline" />;
  };

  return (
    <div className="flex-1 overflow-auto p-6 md:p-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10 animate-fade-in">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/30">
              <FileSearch className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 font-display uppercase tracking-tightest">
                {t('cert_verification.title')}
              </h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest-plus mt-1">
                {t('cert_verification.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="glass-card rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-white/60 p-6 md:p-10">
          {/* OCR Status Check */}
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={checkOcrStatus}
                disabled={checkingOcr}
                className="group flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-all text-[10px] font-black uppercase tracking-widest font-display border border-indigo-100"
              >
                <Search className={`w-3.5 h-3.5 ${checkingOcr ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`} />
                {checkingOcr ? t('cert_verification.checking') : t('cert_verification.check_ocr')}
              </button>
              {ocrStatus && (
                <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest font-display flex items-center gap-2 shadow-sm ${ocrStatus.ocr_available
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : 'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}>
                  {ocrStatus.ocr_available ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t('cert_verification.ocr_available')}
                      {ocrStatus.tesseract_version && (
                        <span className="opacity-50">(Tesseract v{ocrStatus.tesseract_version})</span>
                      )}
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      {t('cert_verification.ocr_unavailable')}: {ocrStatus.error || ocrStatus.message}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Input Mode Toggle */}
            <div className="mb-6">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest-plus mb-3 ml-1 font-display">
                {t('cert_verification.input_mode') || 'Modalità input'}
              </label>
              <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 p-6 md:p-8 mb-10 shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest-plus mb-3 ml-1 font-display">
                        {t('cert_verification.input_mode_label') || 'Modalità Input'}
                      </label>
                      <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50">
                        <button
                          onClick={() => setInputMode(INPUT_MODES.UPLOAD)}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest font-display transition-all ${inputMode === INPUT_MODES.UPLOAD
                            ? 'bg-white text-indigo-700 shadow-md shadow-indigo-500/5 border border-white'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {t('cert_verification.mode_upload') || 'Caricamento ZIP'}
                        </button>
                        <button
                          onClick={() => setInputMode(INPUT_MODES.FOLDER)}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest font-display transition-all ${inputMode === INPUT_MODES.FOLDER
                            ? 'bg-white text-indigo-700 shadow-md shadow-indigo-500/5 border border-white'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          {t('cert_verification.mode_folder') || 'Cartella Locale'}
                        </button>
                      </div>
                    </div>

                    <div className="animate-fade-in">
                      {inputMode === INPUT_MODES.FOLDER ? (
                        /* Folder Path Input */
                        <>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest-plus mb-3 ml-1 font-display">
                            {t('cert_verification.folder_label') || 'Percorso cartella certificazioni'}
                          </label>
                          <input
                            type="text"
                            value={folderPath}
                            onChange={(e) => setFolderPath(e.target.value)}
                            placeholder={t('cert_verification.folder_placeholder')}
                            className="w-full px-5 py-4 bg-white/60 border border-slate-200/50 rounded-2xl text-sm font-black text-slate-800 placeholder-slate-400 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-inner font-display"
                          />
                        </>
                      ) : (
                        /* ZIP Upload Input */
                        <>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest-plus mb-3 ml-1 font-display">
                            {t('cert_verification.zip_label') || 'File ZIP certificazioni'}
                          </label>
                          <div className="flex items-center gap-4">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".zip"
                              onChange={handleFileSelect}
                              className="hidden"
                              id="zip-upload"
                            />
                            <label
                              htmlFor="zip-upload"
                              className="flex-1 px-6 py-10 border-2 border-dashed border-indigo-200/50 rounded-[2rem] cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-center group bg-white/40 shadow-sm"
                            >
                              {selectedFile ? (
                                <div className="flex flex-col items-center justify-center gap-3">
                                  <div className="p-3 bg-emerald-100 rounded-2xl">
                                    <FileText className="w-8 h-8 text-emerald-600" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm font-black text-slate-800 font-display uppercase tracking-tight">{selectedFile.name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-slate-400">
                                  <div className="p-4 bg-slate-50 rounded-2xl w-fit mx-auto mb-4 group-hover:bg-indigo-100 transition-colors">
                                    <Upload className="w-10 h-10 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                  </div>
                                  <p className="text-[10px] font-black uppercase tracking-widest font-display">{t('cert_verification.click_to_select') || 'Clicca per selezionare un file ZIP'}</p>
                                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wider mt-1">{t('cert_verification.max_file_hint')}</p>
                                </div>
                              )}
                            </label>
                            {selectedFile && (
                              <button
                                onClick={clearFile}
                                className="p-4 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all border border-slate-100 shadow-sm"
                                title={t('cert_verification.remove_file') || 'Rimuovi file'}
                              >
                                <X className="w-6 h-6" />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                      <p className="mt-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed ml-1">
                        {t('cert_verification.folder_hint')}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest-plus mb-3 ml-1 font-display">
                        {t('cert_verification.lot_label')}
                      </label>
                      <div className="relative">
                        <select
                          value={selectedLot}
                          onChange={(e) => setSelectedLot(e.target.value)}
                          className="w-full h-[54px] px-5 bg-white/60 border border-slate-200/50 rounded-2xl text-sm font-black text-slate-800 appearance-none focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-inner font-display uppercase tracking-tight"
                        >
                          <option value="">{t('cert_verification.lot_placeholder')}</option>
                          {lots.map(lot => (
                            <option key={lot} value={lot}>{lot}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                          <ChevronDown className="w-5 h-5 text-slate-300" />
                        </div>
                      </div>
                      <p className="mt-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed ml-1">
                        {t('cert_verification.lot_hint')}
                      </p>
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={handleVerify}
                        disabled={loading || !canVerify}
                        className={`w-full py-5 rounded-[1.5rem] font-black uppercase tracking-widest-plus text-xs font-display transition-all flex items-center justify-center gap-4 ${loading || !canVerify
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1 active:translate-y-0'
                          }`}
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="w-6 h-6 animate-spin opacity-50" />
                            <span className="animate-pulse">
                              {uploadProgress?.phase === 'uploading'
                                ? `${t('cert_verification.uploading') || 'Caricamento'}... ${uploadProgress.percent || 0}%`
                                : t('cert_verification.processing')}
                            </span>
                          </>
                        ) : (
                          <>
                            <Search className="w-6 h-6 drop-shadow-sm" />
                            {t('cert_verification.verify_btn')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* Progress Bar */}
              {loading && progress.total > 0 && (
                <div className="mt-4 space-y-2 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-center text-sm text-slate-600">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {t('cert_verification.processing_label')}: {progress.current}/{progress.total}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{Math.round((progress.current / progress.total) * 100)}%</span>
                      <button
                        onClick={handleCancel}
                        className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        {t('cert_verification.cancel_btn')}
                      </button>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                  {progress.filename && (
                    <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {progress.filename}
                    </p>
                  )}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                  <XCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Results */}
              {results && (
                <div className="mt-8 space-y-6">
                  {/* Summary */}
                  <div className="bg-gradient-to-br from-slate-50 to-indigo-50 rounded-xl p-6 border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      {t('cert_verification.summary')}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center bg-white/40 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-slate-100/50">
                        <div className="text-3xl font-bold text-slate-800">{results.summary?.total || 0}</div>
                        <div className="text-sm text-slate-500 mt-1">{t('cert_verification.total')}</div>
                      </div>
                      <div className="text-center bg-white/40 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-green-100/50">
                        <div className="text-3xl font-bold text-green-600">{results.summary?.valid || 0}</div>
                        <div className="text-sm text-slate-500 mt-1">{t('cert_verification.extracted')}</div>
                      </div>
                      <div className="text-center bg-white/40 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-yellow-100/50">
                        <div className="text-3xl font-bold text-yellow-600">{results.summary?.expired || 0}</div>
                        <div className="text-sm text-slate-500 mt-1">{t('cert_verification.expired')}</div>
                      </div>
                      <div className="text-center bg-white/40 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-orange-100/50">
                        <div className="text-3xl font-bold text-orange-600">{results.summary?.mismatch || 0}</div>
                        <div className="text-sm text-slate-500 mt-1">{t('cert_verification.mismatch')}</div>
                      </div>
                      <div className="text-center bg-white/40 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-red-100/50">
                        <div className="text-3xl font-bold text-red-600">{(results.summary?.unreadable || 0) + (results.summary?.error || 0)}</div>
                        <div className="text-sm text-slate-500 mt-1">{t('cert_verification.unreadable')}</div>
                      </div>
                    </div>
                  </div>

                  {/* By Requirement */}
                  {results.summary?.by_requirement && Object.keys(results.summary.by_requirement).length > 0 && (
                    <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
                      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" />
                        {t('cert_verification.by_requirement')}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {Object.entries(results.summary.by_requirement).map(([req, data]) => (
                          <div key={req} className="bg-white/40 backdrop-blur-sm rounded-lg p-3 shadow-sm border border-indigo-100/50">
                            <div className="font-medium text-slate-800 truncate" title={req}>{req}</div>
                            <div className="text-sm text-slate-500">
                              {data.valid}/{data.total} {t('cert_verification.valid_label')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detail Table */}
                  <div className="glass-card rounded-xl border border-slate-200/50 overflow-hidden mt-6">
                    <div className="px-4 md:px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-4">
                      <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-slate-600" />
                        {t('cert_verification.file_detail')} ({filteredResults.length}/{results.results?.length || 0})
                      </h3>
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Filters */}
                        <div className="flex items-center gap-2">
                          <Filter className="w-4 h-4 text-slate-400" />
                          <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white"
                          >
                            <option value="">{t('cert_verification.all_statuses')}</option>
                            <option value="valid">{t('cert_verification.status_valid')}</option>
                            <option value="expired">{t('cert_verification.status_expired')}</option>
                            <option value="mismatch">{t('cert_verification.status_mismatch')}</option>
                            <option value="unreadable">{t('cert_verification.status_unreadable')}</option>
                            <option value="error">{t('cert_verification.status_error')}</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          placeholder={t('cert_verification.filter_req_placeholder')}
                          value={filterReq}
                          onChange={(e) => setFilterReq(e.target.value)}
                          className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 w-32"
                        />
                        {(filterStatus || filterReq) && (
                          <button
                            onClick={() => { setFilterStatus(''); setFilterReq(''); }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            {t('cert_verification.clear_filters')}
                          </button>
                        )}
                        <button
                          onClick={exportToExcel}
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          {t('cert_verification.export_excel')}
                        </button>
                        <button
                          onClick={() => setColumnWidths(DEFAULT_COLUMN_WIDTHS)}
                          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          {t('cert_verification.reset_columns')}
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto" style={{ position: 'relative' }}>
                      <table ref={tableRef} className="divide-y divide-slate-200" style={{ minWidth: '100%', tableLayout: 'fixed' }}>
                        <thead className="bg-slate-100/50 border-b border-slate-200/50">
                          <tr>
                            <th style={{ width: columnWidths.file, position: 'relative' }} className="px-5 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest-plus font-display cursor-pointer hover:bg-indigo-100/30 transition-colors" onClick={() => handleSort('filename')}>
                              {t('cert_verification.col_file')}<SortIcon field="filename" />
                              <div
                                className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-indigo-500 opacity-0 group-hover:opacity-100"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseDown={(e) => handleResizeStart(e, 'file')}
                              />
                            </th>
                            <th style={{ width: columnWidths.requisito, position: 'relative' }} className="px-5 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest-plus font-display cursor-pointer hover:bg-indigo-100/30 transition-colors" onClick={() => handleSort('req_code')}>
                              {t('cert_verification.col_requisito')}<SortIcon field="req_code" />
                              <div
                                className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-indigo-500"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseDown={(e) => handleResizeStart(e, 'requisito')}
                              />
                            </th>
                            <th style={{ width: columnWidths.certFile, position: 'relative' }} className="px-5 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest-plus font-display cursor-pointer hover:bg-indigo-100/30 transition-colors" onClick={() => handleSort('cert_name_from_file')}>
                              {t('cert_verification.col_cert_file')}<SortIcon field="cert_name_from_file" />
                              <div
                                className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-indigo-500"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseDown={(e) => handleResizeStart(e, 'certFile')}
                              />
                            </th>
                            <th style={{ width: columnWidths.certAttesa, position: 'relative' }} className="px-5 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest-plus font-display">
                              {t('cert_verification.col_cert_expected')}
                              <div
                                className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-indigo-500"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseDown={(e) => handleResizeStart(e, 'certAttesa')}
                              />
                            </th>
                            <th style={{ width: columnWidths.risorsa, position: 'relative' }} className="px-5 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest-plus font-display cursor-pointer hover:bg-indigo-100/30 transition-colors" onClick={() => handleSort('resource_name')}>
                              {t('cert_verification.col_resource')}<SortIcon field="resource_name" />
                              <div
                                className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-indigo-500"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseDown={(e) => handleResizeStart(e, 'risorsa')}
                              />
                            </th>
                            <th style={{ width: columnWidths.risorsaOcr, position: 'relative' }} className="px-5 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest-plus font-display">
                              {t('cert_verification.col_resource_ocr')}
                              <div
                                className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-indigo-500"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseDown={(e) => handleResizeStart(e, 'risorsaOcr')}
                              />
                            </th>
                            <th style={{ width: columnWidths.vendor, position: 'relative' }} className="px-5 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest-plus font-display cursor-pointer hover:bg-indigo-100/30 transition-colors" onClick={() => handleSort('vendor_detected')}>
                              {t('cert_verification.col_vendor')}<SortIcon field="vendor_detected" />
                              <div
                                className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-indigo-500"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseDown={(e) => handleResizeStart(e, 'vendor')}
                              />
                            </th>
                            <th style={{ width: columnWidths.certificazione, position: 'relative' }} className="px-5 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest-plus font-display cursor-pointer hover:bg-indigo-100/30 transition-colors" onClick={() => handleSort('cert_name_detected')}>
                              {t('cert_verification.col_cert_ocr')}<SortIcon field="cert_name_detected" />
                              <div
                                className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-indigo-500"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseDown={(e) => handleResizeStart(e, 'certificazione')}
                              />
                            </th>
                            <th style={{ width: columnWidths.validita, position: 'relative' }} className="px-5 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest-plus font-display">
                              {t('cert_verification.col_validity')}
                              <div
                                className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-indigo-500"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseDown={(e) => handleResizeStart(e, 'validita')}
                              />
                            </th>
                            <th style={{ width: columnWidths.stato }} className="px-5 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest-plus font-display cursor-pointer hover:bg-indigo-100/30 transition-colors" onClick={() => handleSort('status')}>
                              {t('cert_verification.col_status')}<SortIcon field="status" />
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {filteredResults.map((r, idx) => {
                            const displayFilename = r.filename?.split('/').pop() || r.filename;
                            return (
                              <tr key={idx} className={`group border-b border-slate-100/50 transition-colors ${idx % 2 === 0 ? 'bg-white/40' : 'bg-slate-50/40'} hover:bg-indigo-50/30`}>
                                <td style={{ width: columnWidths.file }} className="px-4 py-2 text-sm text-slate-900 overflow-hidden" title={r.filename}>
                                  <div className="truncate">{displayFilename}</div>
                                </td>
                                <td style={{ width: columnWidths.requisito }} className="px-4 py-2 text-sm text-slate-700 overflow-hidden">
                                  <div className="truncate font-medium">{r.req_code || '-'}</div>
                                </td>
                                <td style={{ width: columnWidths.certFile }} className="px-4 py-2 text-sm text-purple-600 overflow-hidden" title={r.cert_name_from_file || ''}>
                                  <div className="truncate">{r.cert_name_from_file || '-'}</div>
                                </td>
                                <td style={{ width: columnWidths.certAttesa }} className="px-4 py-2 text-sm text-indigo-600">
                                  {r.expected_cert_names && r.expected_cert_names.length > 0 ? (
                                    <div className="flex flex-wrap gap-1" title={r.expected_cert_names.join(', ')}>
                                      {r.expected_cert_names.map((cert, certIdx) => (
                                        <span
                                          key={`${r.req_code || 'req'}-${certIdx}-${cert}`}
                                          className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs break-words"
                                        >
                                          {cert}
                                        </span>
                                      ))}
                                    </div>
                                  ) : '-'}
                                </td>
                                <td style={{ width: columnWidths.risorsa }} className="px-4 py-2 text-sm text-slate-700 overflow-hidden">
                                  <div className="truncate">{r.resource_name || '-'}</div>
                                </td>
                                <td style={{ width: columnWidths.risorsaOcr }} className="px-4 py-2 text-sm text-indigo-600 overflow-hidden">
                                  <div className="truncate" title={r.resource_name_detected || ''}>{r.resource_name_detected || '-'}</div>
                                </td>
                                <td style={{ width: columnWidths.vendor }} className="px-4 py-2 text-sm text-slate-700 overflow-hidden">
                                  <div className="truncate">{r.vendor_detected || '-'}</div>
                                </td>
                                <td style={{ width: columnWidths.certificazione }} className="px-4 py-2 text-sm text-slate-700 overflow-hidden">
                                  <div className="break-words">
                                    {r.cert_name_detected && <div className="font-medium">{r.cert_name_detected}</div>}
                                    {r.cert_code_detected && <div className="text-xs text-slate-500">{r.cert_code_detected}</div>}
                                    {!r.cert_name_detected && !r.cert_code_detected && '-'}
                                  </div>
                                </td>
                                <td style={{ width: columnWidths.validita }} className="px-4 py-2 text-sm text-slate-700 overflow-hidden">
                                  {r.valid_from || r.valid_until ? (
                                    <div className="text-xs">
                                      {r.valid_from && <div className="truncate">{t('cert_verification.valid_from')}: {normalizeDate(r.valid_from)}</div>}
                                      {r.valid_until && <div className="truncate">{t('cert_verification.valid_until')}: {normalizeDate(r.valid_until)}</div>}
                                    </div>
                                  ) : '-'}
                                </td>
                                <td style={{ width: columnWidths.stato }} className="px-4 py-3">
                                  <div className="flex flex-col gap-1.5 items-start">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase shadow-sm ${STATUS_COLORS[r.status] || STATUS_COLORS.unprocessed}`}>
                                      {STATUS_ICONS[r.status] || STATUS_ICONS.unprocessed}
                                      {t(`cert_verification.${STATUS_LABELS[r.status]}`) || r.status}
                                    </span>
                                    {(r.status === 'error' || r.status === 'unreadable') && (
                                      <button
                                        onClick={() => handleRetry(r.filename)}
                                        disabled={retryingFile === r.filename}
                                        className={`text-xs px-2 py-0.5 rounded-lg transition-colors ${retryingFile === r.filename
                                          ? 'bg-slate-200 text-slate-400 cursor-wait'
                                          : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                          }`}
                                        title={t('cert_verification.retry_tooltip')}
                                      >
                                        {retryingFile === r.filename ? (
                                          <RefreshCw className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <RotateCcw className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Warning if any */}
                  {results.warning && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                      {results.warning}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
