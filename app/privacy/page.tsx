'use client';

import Link from 'next/link';

export default function PrivacyPolicy() {
    return (
        <main className="bg-gray-50 min-h-screen">
            <div className="max-w-4xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
                <div className="bg-white shadow rounded-lg p-8">
                    <div className="text-center mb-8">
                        <Link href="/" className="inline-flex items-center justify-center">
                            <span className="text-xl font-bold">SubTranslate</span>
                        </Link>
                        <h1 className="mt-4 text-3xl font-extrabold text-gray-900">Privacy Policy</h1>
                        <p className="mt-2 text-sm text-gray-600">Last Updated: March 17, 2025</p>
                    </div>

                    <div className="prose prose-blue max-w-none">
                        <p className="text-gray-700 leading-relaxed">
                            At SubTranslate, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and
                            safeguard your information when you use our video subtitle translation service.
                        </p>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Information We Collect</h2>
                        <p className="text-gray-700 leading-relaxed">
                            We collect information that you provide directly to us when you:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                            <li>Create an account</li>
                            <li>Upload videos for processing</li>
                            <li>Make payments for subscriptions</li>
                            <li>Contact our support team</li>
                            <li>Respond to surveys or communications</li>
                        </ul>

                        <p className="text-gray-700 leading-relaxed">This information may include:</p>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                            <li>Personal identifiers (name, email address)</li>
                            <li>Payment information (processed securely through our payment processors)</li>
                            <li>Usage data and preferences</li>
                            <li>Information contained in your videos and subtitle files</li>
                            <li>Technical information about your devices and browsers</li>
                        </ul>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">How We Use Your Information</h2>
                        <p className="text-gray-700 leading-relaxed">We use the information we collect to:</p>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                            <li>Provide, maintain, and improve our services</li>
                            <li>Process your video translation requests</li>
                            <li>Process your payments and manage your account</li>
                            <li>Send you technical notices, updates, and support messages</li>
                            <li>Respond to your comments and questions</li>
                            <li>Understand how users interact with our service</li>
                            <li>Detect, investigate, and prevent fraudulent transactions and unauthorized access</li>
                            <li>Comply with legal obligations</li>
                        </ul>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Video Content and Storage</h2>
                        <p className="text-gray-700 leading-relaxed">
                            When you upload videos to SubTranslate:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                            <li>We process your content to generate subtitles and translations as requested</li>
                            <li>Your videos are stored in secure cloud storage and associated only with your account</li>
                            <li>We maintain encryption for video storage and processing</li>
                            <li>We do not view, analyze, or use your video content for purposes other than providing our service</li>
                            <li>Your content is retained according to your subscription plan limits and can be deleted at your request</li>
                        </ul>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Data Sharing and Disclosure</h2>
                        <p className="text-gray-700 leading-relaxed">We may share your information with:</p>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                            <li>Service providers who perform services on our behalf (e.g., cloud storage, payment processing)</li>
                            <li>Professional advisors, such as lawyers and accountants, where necessary</li>
                            <li>Government bodies when required by law</li>
                            <li>Potential buyers in connection with a corporate transaction (e.g., sale of business)</li>
                        </ul>

                        <p className="text-gray-700 leading-relaxed mb-6">
                            We do not sell your personal information or your content to third parties for marketing purposes.
                        </p>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Your Rights and Choices</h2>
                        <p className="text-gray-700 leading-relaxed">Depending on your location, you may have certain rights regarding your personal information:</p>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                            <li>Access, correct, or delete your personal information</li>
                            <li>Object to certain processing of your information</li>
                            <li>Request portability of your information</li>
                            <li>Opt out of certain marketing communications</li>
                        </ul>

                        <p className="text-gray-700 leading-relaxed mb-6">
                            To exercise these rights, please contact us at privacy@subtranslate.com.
                        </p>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Data Security</h2>
                        <p className="text-gray-700 leading-relaxed mb-6">
                            We implement appropriate technical and organizational measures to protect your personal information against
                            unauthorized access, accidental loss, destruction, or damage. However, no security system is impenetrable,
                            and we cannot guarantee the absolute security of our systems.
                        </p>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Children&#39;s Privacy</h2>
                        <p className="text-gray-700 leading-relaxed mb-6">
                            Our services are not directed to children under 16. We do not knowingly collect personal information from
                            children under 16. If you believe a child has provided us with personal information, please contact us.
                        </p>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">International Data Transfers</h2>
                        <p className="text-gray-700 leading-relaxed mb-6">
                            Your information may be transferred to, stored, and processed in countries other than the one in which you
                            reside. We ensure appropriate safeguards are in place to protect your information when transferred internationally.
                        </p>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Changes to This Policy</h2>
                        <p className="text-gray-700 leading-relaxed mb-6">
                            We may update this Privacy Policy from time to time. We will notify you of material changes by posting the
                            new Privacy Policy on this page and updating the &#34;Last Updated&#34; date.
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}