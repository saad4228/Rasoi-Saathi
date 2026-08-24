import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Flow from "@/components/Flow";
import Features from "@/components/Features";
import AICopilot from "@/components/AICopilot";
import Testimonials from "@/components/Testimonials";
import Pricing from "@/components/Pricing";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Flow />
      <Features />
      <AICopilot />
      <Testimonials />
      <Pricing />
      <CTA />
      <Footer />
    </main>
  );
}