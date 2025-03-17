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

// Complete list of languages in alphabetical order
const ALL_LANGUAGES = [
    { code: 'af', name: 'Afrikaans' },
    { code: 'sq', name: 'Albanian' },
    { code: 'am', name: 'Amharic' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hy', name: 'Armenian' },
    { code: 'az', name: 'Azerbaijani' },
    { code: 'eu', name: 'Basque' },
    { code: 'be', name: 'Belarusian' },
    { code: 'bn', name: 'Bengali' },
    { code: 'bs', name: 'Bosnian' },
    { code: 'bg', name: 'Bulgarian' },
    { code: 'ca', name: 'Catalan' },
    { code: 'ceb', name: 'Cebuano' },
    { code: 'zh', name: 'Chinese (Simplified)' },
    { code: 'zh-TW', name: 'Chinese (Traditional)' },
    { code: 'co', name: 'Corsican' },
    { code: 'hr', name: 'Croatian' },
    { code: 'cs', name: 'Czech' },
    { code: 'da', name: 'Danish' },
    { code: 'nl', name: 'Dutch' },
    { code: 'en', name: 'English' },
    { code: 'eo', name: 'Esperanto' },
    { code: 'et', name: 'Estonian' },
    { code: 'fi', name: 'Finnish' },
    { code: 'fr', name: 'French' },
    { code: 'fy', name: 'Frisian' },
    { code: 'gl', name: 'Galician' },
    { code: 'ka', name: 'Georgian' },
    { code: 'de', name: 'German' },
    { code: 'el', name: 'Greek' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'ht', name: 'Haitian Creole' },
    { code: 'ha', name: 'Hausa' },
    { code: 'haw', name: 'Hawaiian' },
    { code: 'he', name: 'Hebrew' },
    { code: 'hi', name: 'Hindi' },
    { code: 'hmn', name: 'Hmong' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'is', name: 'Icelandic' },
    { code: 'ig', name: 'Igbo' },
    { code: 'id', name: 'Indonesian' },
    { code: 'ga', name: 'Irish' },
    { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'jv', name: 'Javanese' },
    { code: 'kn', name: 'Kannada' },
    { code: 'kk', name: 'Kazakh' },
    { code: 'km', name: 'Khmer' },
    { code: 'rw', name: 'Kinyarwanda' },
    { code: 'ko', name: 'Korean' },
    { code: 'ku', name: 'Kurdish' },
    { code: 'ky', name: 'Kyrgyz' },
    { code: 'lo', name: 'Lao' },
    { code: 'la', name: 'Latin' },
    { code: 'lv', name: 'Latvian' },
    { code: 'lt', name: 'Lithuanian' },
    { code: 'lb', name: 'Luxembourgish' },
    { code: 'mk', name: 'Macedonian' },
    { code: 'mg', name: 'Malagasy' },
    { code: 'ms', name: 'Malay' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'mt', name: 'Maltese' },
    { code: 'mi', name: 'Maori' },
    { code: 'mr', name: 'Marathi' },
    { code: 'mn', name: 'Mongolian' },
    { code: 'my', name: 'Myanmar (Burmese)' },
    { code: 'ne', name: 'Nepali' },
    { code: 'no', name: 'Norwegian' },
    { code: 'ny', name: 'Nyanja (Chichewa)' },
    { code: 'or', name: 'Odia (Oriya)' },
    { code: 'ps', name: 'Pashto' },
    { code: 'fa', name: 'Persian' },
    { code: 'pl', name: 'Polish' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'ro', name: 'Romanian' },
    { code: 'ru', name: 'Russian' },
    { code: 'sm', name: 'Samoan' },
    { code: 'gd', name: 'Scots Gaelic' },
    { code: 'sr', name: 'Serbian' },
    { code: 'st', name: 'Sesotho' },
    { code: 'sn', name: 'Shona' },
    { code: 'sd', name: 'Sindhi' },
    { code: 'si', name: 'Sinhala (Sinhalese)' },
    { code: 'sk', name: 'Slovak' },
    { code: 'sl', name: 'Slovenian' },
    { code: 'so', name: 'Somali' },
    { code: 'es', name: 'Spanish' },
    { code: 'su', name: 'Sundanese' },
    { code: 'sw', name: 'Swahili' },
    { code: 'sv', name: 'Swedish' },
    { code: 'tl', name: 'Tagalog (Filipino)' },
    { code: 'tg', name: 'Tajik' },
    { code: 'ta', name: 'Tamil' },
    { code: 'tt', name: 'Tatar' },
    { code: 'te', name: 'Telugu' },
    { code: 'th', name: 'Thai' },
    { code: 'tr', name: 'Turkish' },
    { code: 'tk', name: 'Turkmen' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'ur', name: 'Urdu' },
    { code: 'ug', name: 'Uyghur' },
    { code: 'uz', name: 'Uzbek' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'cy', name: 'Welsh' },
    { code: 'xh', name: 'Xhosa' },
    { code: 'yi', name: 'Yiddish' },
    { code: 'yo', name: 'Yoruba' },
    { code: 'zu', name: 'Zulu' }
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
                                {ALL_LANGUAGES.filter(lang =>
                                    // Filter out languages already in TOP_LANGUAGES
                                    !TOP_LANGUAGES.some(topLang => topLang.code === lang.code)
                                ).map((language) => (
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
                                {ALL_LANGUAGES.filter(lang =>
                                    // Filter out languages already in TOP_LANGUAGES and "auto"
                                    !TOP_LANGUAGES.some(topLang => topLang.code === lang.code) && lang.code !== 'auto'
                                ).map((language) => (
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