import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function LogoutButton({ className = '' }) {
    const { logout, isLoading, user, isDevMode } = useAuth();
    const { t } = useTranslation();

    if (!user || isDevMode) return null;

    return (
        <button
            onClick={logout}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
            <LogOut className="w-4 h-4" />
            {isLoading ? t('common.loading') : t('auth.sign_out', 'Esci')}
        </button>
    );
}
