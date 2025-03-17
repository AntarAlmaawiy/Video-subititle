'use client';

import { useRef, useState } from 'react';
import emailjs from '@emailjs/browser';
import { MessagesSquare, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ErrorReportToggle() {
    const formRef = useRef<HTMLFormElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState<{ show: boolean; text: string; type: 'success' | 'error' }>({
        show: false,
        text: '',
        type: 'success',
    });
    const [form, setForm] = useState({ name: '', email: '', message: '' });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
    };

    const showAlert = (alert: { show: boolean; text: string; type: 'success' | 'error' }) => {
        setAlert(alert);
    };

    const hideAlert = () => {
        setAlert({ show: false, text: '', type: 'success' });
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        emailjs
            .send(
                process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
                process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
                {
                    from_name: form.name,
                    to_name: 'Antar',
                    from_email: form.email,
                    to_email: process.env.NEXT_PUBLIC_EMAILJS_RECEIVER_EMAIL,
                    message: form.message,
                },
                process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
            )
            .then(
                () => {
                    setLoading(false);
                    showAlert({
                        show: true,
                        text: 'Thank you for your message 😃',
                        type: 'success',
                    });

                    setTimeout(() => {
                        hideAlert();
                        setForm({
                            name: '',
                            email: '',
                            message: '',
                        });
                        setIsOpen(false); // Close the form after successful submission
                    }, 3000);
                },
                (error) => {
                    setLoading(false);
                    console.error(error);

                    showAlert({
                        show: true,
                        text: "We couldn't send your message 😢",
                        type: 'error',
                    });
                }
            );
    };

    return (
        <div className="fixed bottom-8 right-8 z-50">
            {/* Toggle Button */}
            <Button
                onClick={() => setIsOpen(!isOpen)}
                className={`h-12 w-12 rounded-full p-0 shadow-lg ${
                    isOpen ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                } text-white`}
                aria-label={isOpen ? "Close contact form" : "Open contact form"}
            >
                {isOpen ? <X className="h-5 w-5" /> : <MessagesSquare className="h-5 w-5" />}
            </Button>


            {/* Popup Form */}
            {isOpen && (
                <Card className="absolute bottom-16 right-0 w-80 md:w-96 shadow-lg">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-md">Report an Issue</CardTitle>
                    </CardHeader>

                    {alert.show && (
                        <Alert variant={alert.type === 'success' ? "default" : "destructive"} className="mx-4 mb-2">
                            <AlertDescription>{alert.text}</AlertDescription>
                        </Alert>
                    )}

                    <form ref={formRef} onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    required
                                    placeholder="Your name"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    required
                                    placeholder="your.email@example.com"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message">Describe the issue</Label>
                                <Textarea
                                    id="message"
                                    name="message"
                                    value={form.message}
                                    onChange={handleChange}
                                    required
                                    placeholder="Please describe the issue you're experiencing..."
                                    rows={4}
                                />
                            </div>
                        </CardContent>

                        <CardFooter>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" />
                                        Send Report
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            )}
        </div>
    );
}