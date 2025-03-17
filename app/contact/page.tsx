'use client';

import { useState, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function ContactPage() {
    const formRef = useRef<HTMLFormElement>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus('idle');
        setErrorMessage('');

        emailjs
            .send(
                process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
                process.env.NEXT_PUBLIC_EMAILJS_CONTACT_TEMPLATE_ID || process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
                {
                    from_name: form.name,
                    to_name: 'Antar',
                    from_email: form.email,
                    to_email: process.env.NEXT_PUBLIC_EMAILJS_RECEIVER_EMAIL,
                    subject: form.subject,
                    message: form.message,
                },
                process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
            )
            .then(
                () => {
                    setIsSubmitting(false);
                    setSubmitStatus('success');
                    setForm({ name: '', email: '', subject: '', message: '' });
                },
                (error) => {
                    console.error('Contact form error:', error);
                    setIsSubmitting(false);
                    setSubmitStatus('error');
                    setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
                }
            );
    };

    return (
        <main className="bg-gray-50 min-h-screen">
            <div className="max-w-4xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="px-4 py-5 sm:p-6">
                        <div className="text-center mb-8">
                            <Link href="/" className="inline-flex items-center justify-center">
                                <span className="text-xl font-bold">SubTranslate</span>
                            </Link>
                            <h1 className="mt-4 text-3xl font-extrabold text-gray-900">Contact Us</h1>
                            <p className="mt-2 text-lg text-gray-600 max-w-2xl mx-auto">
                                Have questions or feedback? We'd love to hear from you. Fill out the form below,
                                and our team will get back to you as soon as possible.
                            </p>
                        </div>

                        {submitStatus === 'success' ? (
                            <div className="max-w-md mx-auto bg-green-50 p-6 rounded-lg text-center">
                                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-green-800 mb-2">Message Sent!</h3>
                                <p className="text-green-700">
                                    Thank you for reaching out. We'll get back to you as soon as possible.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setSubmitStatus('idle')}
                                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                                >
                                    Send Another Message
                                </button>
                            </div>
                        ) : (
                            <form ref={formRef} onSubmit={handleSubmit} className="max-w-md mx-auto space-y-6">
                                {submitStatus === 'error' && (
                                    <div className="bg-red-50 p-4 rounded-md">
                                        <div className="flex">
                                            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                                            <p className="text-sm text-red-700">{errorMessage || 'There was an error sending your message. Please try again.'}</p>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                        Name
                                    </label>
                                    <input
                                        id="name"
                                        name="name"
                                        type="text"
                                        value={form.name}
                                        onChange={handleChange}
                                        required
                                        className="block w-full px-4 py-3 rounded-md border-2 border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        placeholder="Your name"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                        Email
                                    </label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        required
                                        className="block w-full px-4 py-3 rounded-md border-2 border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        placeholder="your.email@example.com"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                                        Subject
                                    </label>
                                    <input
                                        id="subject"
                                        name="subject"
                                        type="text"
                                        value={form.subject}
                                        onChange={handleChange}
                                        required
                                        className="block w-full px-4 py-3 rounded-md border-2 border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        placeholder="What this is about"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                                        Message
                                    </label>
                                    <textarea
                                        id="message"
                                        name="message"
                                        rows={5}
                                        value={form.message}
                                        onChange={handleChange}
                                        required
                                        className="block w-full px-4 py-3 rounded-md border-2 border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        placeholder="Your message here..."
                                    />
                                </div>

                                <div>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full inline-flex justify-center items-center py-3 px-6 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                                                Sending...
                                            </>
                                        ) : (
                                            'Send Message'
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

                <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2">
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6 text-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-blue-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Email Us</h3>
                            <p className="text-sm text-gray-500">
                                For general inquiries:<br />
                                <a href="mailto:support@subtranslate.com" className="text-blue-600 hover:text-blue-800">
                                    support@subtranslate.com
                                </a>
                            </p>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6 text-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-blue-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Support Hours</h3>
                            <p className="text-sm text-gray-500">
                                Monday – Friday<br />
                                9:00 AM – 6:00 PM EST
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}