import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import translationIT from './locales/it.json';

const resources = {
    it: {
        translation: translationIT
    }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'it',
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
