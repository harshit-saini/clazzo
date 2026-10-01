import { Nav } from "../sections/Nav";
import { Hero } from "../sections/Hero";
import { HowItWorks } from "../sections/HowItWorks";
import { CenterFeatures } from "../sections/CenterFeatures";
import { StudentFeatures } from "../sections/StudentFeatures";
import { Pricing } from "../sections/Pricing";
import { Faq } from "../sections/Faq";
import { Footer } from "../sections/Footer";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function Home() {
  useDocumentTitle("Attendance, fees and a student portal for your institute");
  return (
    <>
      <Nav />
      <Hero />
      <HowItWorks />
      <CenterFeatures />
      <StudentFeatures />
      <Pricing />
      <Faq />
      <Footer />
    </>
  );
}
