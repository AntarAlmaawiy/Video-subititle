// components/TestModeToggle.tsx
import React, { useEffect } from 'react';

interface TestModeToggleProps {
    isTestMode: boolean;
    setIsTestMode: React.Dispatch<React.SetStateAction<boolean>>;
}

const TestModeToggle: React.FC<TestModeToggleProps> = ({ isTestMode, setIsTestMode }) => {
    useEffect(() => {
        // Load test mode state from localStorage on component mount
        const savedTestMode = localStorage.getItem('stripeModeTest') === 'true';
        if (savedTestMode !== isTestMode) {
            setIsTestMode(savedTestMode);
        }
    }, []);

    const handleTestModeToggle = () => {
        const newMode = !isTestMode;
        setIsTestMode(newMode);
        localStorage.setItem('stripeModeTest', newMode ? 'true' : 'false');
        console.log(`Test mode ${newMode ? 'enabled' : 'disabled'}`);
    };

    return (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <div className="relative inline-block w-10 mr-2 align-middle select-none">
                        <input
                            type="checkbox"
                            name="testMode"
                            id="testMode"
                            checked={isTestMode}
                            onChange={handleTestModeToggle}
                            className="absolute block w-6 h-6 bg-white border-4 rounded-full appearance-none cursor-pointer checked:right-0 checked:border-green-500 focus:outline-none duration-200"
                        />
                        <label
                            htmlFor="testMode"
                            className={`block h-6 overflow-hidden rounded-full cursor-pointer ${
                                isTestMode ? 'bg-green-400' : 'bg-gray-300'
                            }`}
                        ></label>
                    </div>
                    <span className="font-medium text-gray-700">
                        {isTestMode ? 'Test Mode ON' : 'Test Mode OFF'}
                    </span>
                </div>
                <div className="text-xs text-gray-500">
                    {isTestMode
                        ? 'Using Stripe test environment - no real charges will be made'
                        : 'Using production environment - real charges will be made'}
                </div>
            </div>

            {isTestMode && (
                <div className="mt-2 text-sm">
                    <p className="font-medium">Test card: 4242 4242 4242 4242</p>
                    <p>Any future date, any 3 digits for CVC, any postal code</p>
                </div>
            )}
        </div>
    );
};

export default TestModeToggle;