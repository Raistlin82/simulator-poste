import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function LoginButton({ className = '' }) {
    const { login, isLoading } = useAuth();
    const { t } = useTranslation();

    return (
        <button
            onClick={login}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
            <LogIn className="w-4 h-4" />
            {isLoading ? t('auth.loading') : t('auth.sign_in')}
        </button>
    );
}
