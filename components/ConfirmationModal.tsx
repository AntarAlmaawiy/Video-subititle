// components/ConfirmationModal.tsx
import React from 'react';
import { XCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel: () => void;
    type?: 'danger' | 'warning' | 'info' | 'success';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
                                                                 isOpen,
                                                                 title,
                                                                 message,
                                                                 confirmText,
                                                                 cancelText,
                                                                 onConfirm,
                                                                 onCancel,
                                                                 type = 'danger'
                                                             }) => {
    if (!isOpen) return null;

    const getTypeStyles = () => {
        switch (type) {
            case 'danger':
                return {
                    button: 'bg-red-500 hover:bg-red-600',
                    icon: <XCircle className="h-6 w-6 text-red-500" />,
                    bg: 'bg-red-50'
                };
            case 'warning':
                return {
                    button: 'bg-yellow-500 hover:bg-yellow-600',
                    icon: <AlertTriangle className="h-6 w-6 text-yellow-500" />,
                    bg: 'bg-yellow-50'
                };
            case 'success':
                return {
                    button: 'bg-green-500 hover:bg-green-600',
                    icon: <CheckCircle className="h-6 w-6 text-green-500" />,
                    bg: 'bg-green-50'
                };
            case 'info':
            default:
                return {
                    button: 'bg-blue-500 hover:bg-blue-600',
                    icon: <Info className="h-6 w-6 text-blue-500" />,
                    bg: 'bg-blue-50'
                };
        }
    };

    const typeStyles = getTypeStyles();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="relative w-full max-w-md px-6 py-4 mx-auto bg-white rounded-lg shadow-lg">
                <div className="flex items-center mb-4">
                    <div className={`p-2 rounded-full ${typeStyles.bg} mr-3`}>
                        {typeStyles.icon}
                    </div>
                    <h3 className="text-xl font-semibold">{title}</h3>
                </div>

                <p className="mb-6 text-gray-600">{message}</p>

                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-white rounded-md focus:outline-none focus:ring-2 ${typeStyles.button}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;