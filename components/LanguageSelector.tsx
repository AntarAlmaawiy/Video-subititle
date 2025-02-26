'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Common languages to show at the top
const TOP_LANGUAGES = [
    { code: 'auto', name: 'Auto-detect' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'ru', name: 'Russian' },
];

// More languages in alphabetical order
const ALL_LANGUAGES = [
    { code: 'af', name: 'Afrikaans' },
    { code: 'sq', name: 'Albanian' },
    { code: 'am', name: 'Amharic' },
    // ... add more languages as needed
    { code: 'zu', name: 'Zulu' },
];

interface LanguageSelectorProps {
    sourceLanguage: string;
    targetLanguage: string;
    onSourceLanguageChange: (language: string) => void;
    onTargetLanguageChange: (language: string) => void;
    disabled?: boolean;
}

const LanguageSelector = ({
                              sourceLanguage,
                              targetLanguage,
                              onSourceLanguageChange,
                              onTargetLanguageChange,
                              disabled = false,
                          }: LanguageSelectorProps) => {
    const [showAllSource, setShowAllSource] = useState(false);
    const [showAllTarget, setShowAllTarget] = useState(false);

    // Helper function to get language name by code
    const getLanguageName = (code: string) => {
        const language = [...TOP_LANGUAGES, ...ALL_LANGUAGES].find((lang) => lang.code === code);
        return language ? language.name : code;
    };

    return (
        <div className="max-w-2xl mx-auto py-6 space-y-8">
            <div>
                <label htmlFor="source-language" className="block text-sm font-medium text-gray-700 mb-2">
                    Source Language
                </label>
                <div className="relative">
                    <select
                        id="source-language"
                        value={sourceLanguage}
                        onChange={(e) => onSourceLanguageChange(e.target.value)}
                        className="block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-base focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                        disabled={disabled}
                    >
                        <optgroup label="Common Languages">
                            {TOP_LANGUAGES.map((language) => (
                                <option key={language.code} value={language.code}>
                                    {language.name}
                                </option>
                            ))}
                        </optgroup>
                        {showAllSource && (
                            <optgroup label="All Languages">
                                {ALL_LANGUAGES.map((language) => (
                                    <option key={language.code} value={language.code}>
                                        {language.name}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                        <ChevronDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                </div>
                {!showAllSource && (
                    <button
                        type="button"
                        onClick={() => setShowAllSource(true)}
                        className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
                        disabled={disabled}
                    >
                        Show all languages
                    </button>
                )}
            </div>

            <div>
                <label htmlFor="target-language" className="block text-sm font-medium text-gray-700 mb-2">
                    Target Language
                </label>
                <div className="relative">
                    <select
                        id="target-language"
                        value={targetLanguage}
                        onChange={(e) => onTargetLanguageChange(e.target.value)}
                        className="block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-base focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                        disabled={disabled}
                    >
                        <optgroup label="Common Languages">
                            {TOP_LANGUAGES.filter(l => l.code !== 'auto').map((language) => (
                                <option key={language.code} value={language.code}>
                                    {language.name}
                                </option>
                            ))}
                        </optgroup>
                        {showAllTarget && (
                            <optgroup label="All Languages">
                                {ALL_LANGUAGES.map((language) => (
                                    <option key={language.code} value={language.code}>
                                        {language.name}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                        <ChevronDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                </div>
                {!showAllTarget && (
                    <button
                        type="button"
                        onClick={() => setShowAllTarget(true)}
                        className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
                        disabled={disabled}
                    >
                        Show all languages
                    </button>
                )}
            </div>
        </div>
    );
};

export default LanguageSelector;