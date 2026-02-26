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
