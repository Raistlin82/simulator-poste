import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';

export default function LoginButton({ className = '' }) {
    const { login, isLoading } = useAuth();

    return (
        <button
            onClick={login}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
            <LogIn className="w-4 h-4" />
            {isLoading ? 'Loading...' : 'Sign In'}
        </button>
    );
}
