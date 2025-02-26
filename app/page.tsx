// app/page.tsx
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import Footer from '@/components/Footer';
import VideoDropzone from "@/components/VideoDropzone";

export default function Home() {
    return (


        <main>
            <Navbar />
            <div className="pt-16"> {/* Add padding for fixed navbar */}
                <Hero />
                <Features />
                {/* Add more landing page sections here */}
                <Footer />
            </div>
        </main>
    );


}