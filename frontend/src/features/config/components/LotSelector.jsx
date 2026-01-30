import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * LotSelector - Dropdown lot selector with add/delete actions
 *
 * @param {Object} props
 * @param {Object} props.config - Config object with lot keys
 * @param {string} props.selectedLot - Currently selected lot key
 * @param {Function} props.onSelectLot - Callback when lot is selected
 * @param {Function} props.onAddLot - Callback to add new lot
 * @param {Function} props.onDeleteLot - Callback to delete selected lot
 */
export default function LotSelector({ config, selectedLot, onSelectLot, onAddLot, onDeleteLot }) {
  const { t } = useTranslation();

  const handleAddLot = () => {
    const name = prompt(t('config.prompt_new_lot'));
    if (name) onAddLot(name);
  };

  const lotKeys = Object.keys(config);

  return (
    <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
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
  );
}
