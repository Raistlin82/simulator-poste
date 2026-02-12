import { useState, useRef } from 'react';
import { Plus, Trash2, ChevronDown, Download, Upload, Loader2, X, FileDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API_URL } from '../../../utils/api';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * LotSelector - Dropdown lot selector with add/delete/import/export actions
 *
 * @param {Object} props
 * @param {Object} props.config - Config object with lot keys
 * @param {string} props.selectedLot - Currently selected lot key
 * @param {Function} props.onSelectLot - Callback when lot is selected
 * @param {Function} props.onAddLot - Callback to add new lot
 * @param {Function} props.onDeleteLot - Callback to delete selected lot
 * @param {Function} props.onImportSuccess - Callback after successful import
 */
export default function LotSelector({ config, selectedLot, onSelectLot, onAddLot, onDeleteLot, onImportSuccess }) {
  const { t } = useTranslation();
  const { getAccessToken } = useAuth();
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [importTarget, setImportTarget] = useState('__new__');

  const handleAddLot = () => {
    const name = prompt(t('config.prompt_new_lot'));
    if (name) onAddLot(name);
  };

  const handleExportLot = async () => {
    if (!selectedLot) return;
    
    try {
      const token = getAccessToken();
      const response = await axios.get(`${API_URL}/lots/${encodeURIComponent(selectedLot)}/export`, {
        responseType: 'blob',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `export_${selectedLot}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export lot error:', err);
      alert(t('config.export_error', 'Errore durante l\'export del lotto'));
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = getAccessToken();
      const response = await axios.get(`${API_URL}/config/template`, {
        responseType: 'blob',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'template_configurazione_lotto.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download template error:', err);
      alert(t('config.template_download_error', 'Errore nel download del template'));
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset input
    e.target.value = '';
    
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      alert(t('config.invalid_file_type', 'Il file deve essere in formato Excel (.xlsx)'));
      return;
    }
    
    // Show modal to select target lot
    setPendingFile(file);
    setImportTarget('__new__');
    setShowImportModal(true);
  };

  const handleImportConfirm = async () => {
    if (!pendingFile) return;
    
    setShowImportModal(false);
    setImporting(true);
    setImportResult(null);
    
    try {
      const token = getAccessToken();
      const formData = new FormData();
      formData.append('file', pendingFile);
      
      // Add target_lot parameter if overriding existing
      const params = new URLSearchParams();
      if (importTarget !== '__new__') {
        params.append('target_lot', importTarget);
      }
      
      const url = params.toString() 
        ? `${API_URL}/config/import?${params}` 
        : `${API_URL}/config/import`;
      
      const response = await axios.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      
      const result = response.data;
      setImportResult({
        success: true,
        message: `Lotto "${result.lot_key}" ${result.action}. Importati: ${result.imported.cert_aziendali} cert. aziendali, ${result.imported.requisiti} requisiti.`,
        warnings: result.warnings || []
      });
      
      // Notify parent to refresh config
      if (onImportSuccess) {
        onImportSuccess(result.lot_key);
      }
    } catch (err) {
      console.error('Import error:', err);
      setImportResult({
        success: false,
        message: err.response?.data?.detail || t('config.import_error', 'Errore durante l\'importazione'),
        warnings: []
      });
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  const handleImportCancel = () => {
    setShowImportModal(false);
    setPendingFile(null);
  };

  const lotKeys = Object.keys(config);

  return (
    <div className="mb-6 pb-6 border-b border-slate-100">
      <div className="flex items-center gap-3">
        {/* Dropdown Selector */}
        <div className="flex-1 relative">
          <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
            Seleziona Gara/Lotto
          </label>
          <div className="relative">
            <select
              value={selectedLot}
              onChange={(e) => onSelectLot(e.target.value)}
              className="w-full appearance-none px-4 py-3 pr-10 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-900 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
            >
              {lotKeys.map(lotKey => (
                <option key={lotKey} value={lotKey}>
                  {lotKey}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown className="w-5 h-5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-6">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-3 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors font-medium text-sm"
            title={t('config.download_template', 'Scarica Template')}
          >
            <Download className="w-4 h-4" />
            <span className="hidden lg:inline">Template</span>
          </button>
          <button
            onClick={handleUploadClick}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-colors font-medium text-sm disabled:opacity-50"
            title={t('config.import_excel', 'Importa Excel')}
          >
            {importing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span className="hidden lg:inline">Importa</span>
          </button>
          <button
            onClick={handleExportLot}
            className="flex items-center gap-2 px-4 py-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-colors font-medium text-sm"
            title={t('config.export_lot', 'Esporta Lotto')}
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden lg:inline">Esporta</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={handleAddLot}
            className="flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-colors font-medium text-sm"
            title={t('common.add', 'AGGIUNGI')}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Aggiungi</span>
          </button>
          <button
            onClick={() => onDeleteLot(selectedLot)}
            className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl transition-colors font-medium text-sm"
            title={t('common.delete', 'ELIMINA')}
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Elimina</span>
          </button>
        </div>
      </div>
      
      {/* Import Result Feedback */}
      {importResult && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${
          importResult.success 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="font-medium">{importResult.message}</div>
          {importResult.warnings && importResult.warnings.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-yellow-700 hover:text-yellow-800">
                {importResult.warnings.length} warning(s)
              </summary>
              <ul className="mt-1 pl-4 text-xs text-yellow-700 list-disc">
                {importResult.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
          <button 
            onClick={() => setImportResult(null)}
            className="mt-2 text-xs underline hover:no-underline"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Import Target Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {t('config.import_target_title', 'Importa Configurazione')}
              </h3>
              <button
                onClick={handleImportCancel}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-slate-600 mb-4">
              {t('config.import_target_desc', 'Seleziona dove importare la configurazione dal file Excel:')}
            </p>
            
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                {t('config.import_target_label', 'Destinazione')}
              </label>
              <select
                value={importTarget}
                onChange={(e) => setImportTarget(e.target.value)}
                className="w-full appearance-none px-4 py-3 pr-10 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-900 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
              >
                <option value="__new__">✨ Nuovo Lotto (dal nome nel file)</option>
                {lotKeys.map(lotKey => (
                  <option key={lotKey} value={lotKey}>
                    🔄 Sovrascrivi: {lotKey}
                  </option>
                ))}
              </select>
            </div>
            
            {importTarget !== '__new__' && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <strong>Attenzione:</strong> La configurazione esistente di "{importTarget}" verrà completamente sostituita.
              </div>
            )}
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleImportCancel}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                {t('common.cancel', 'Annulla')}
              </button>
              <button
                onClick={handleImportConfirm}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                {t('config.import_confirm', 'Importa')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
