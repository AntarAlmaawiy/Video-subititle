// components/FixOAuthDirect.tsx
'use client';

import { useState } from 'react';

export default function FixOAuthDirect() {
    const [status, setStatus] = useState('idle');
    const [result, setResult] = useState(null);

    const fixUser = async () => {
        try {
            setStatus('loading');

            const response = await fetch('/api/fix-oauth-direct', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            setResult(data);
            setStatus(data.success ? 'success' : 'error');
        } catch (err) {
            console.error('Error fixing user:', err);
            setStatus('error');
        }
    };

    return (
        <div className="p-4 bg-gray-100 rounded-lg mb-4">
            <h3 className="text-lg font-medium mb-2">Fix OAuth Account</h3>
            <p className="text-sm text-gray-600 mb-4">
                Click the button below to set up your OAuth account (Google/GitHub login).
            </p>

            <button
                onClick={fixUser}
                disabled={status === 'loading'}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
                {status === 'loading' ? 'Setting up...' : 'Setup My Account'}
            </button>

            {status === 'success' && (
                <p className="mt-2 text-green-600">✅ Account setup complete!</p>
            )}

            {status === 'error' && (
                <p className="mt-2 text-red-600">❌ There was a problem setting up your account. Please try again.</p>
            )}

            {result && (
                <details className="mt-4">
                    <summary className="cursor-pointer text-blue-500">Show technical details</summary>
                    <pre className="mt-2 p-2 bg-gray-800 text-white text-xs rounded overflow-auto max-h-60">
            {JSON.stringify(result, null, 2)}
          </pre>
                </details>
            )}
        </div>
    );
}