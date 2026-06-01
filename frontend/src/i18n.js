import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import translationIT from './locales/it.json';
import translationEN from './locales/en.json';

const resources = {
    it: {
        translation: translationIT
    },
    en: {
        translation: translationEN
    }
};

const storedLanguage = typeof window !== 'undefined'
    ? window.localStorage.getItem('i18nextLng')
    : null;

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        lng: storedLanguage || 'it',
        fallbackLng: 'it',
        detection: {
            order: ['localStorage'],
            caches: ['localStorage']
        },
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
