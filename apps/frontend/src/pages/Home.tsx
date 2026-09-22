import { Nav } from "../sections/Nav";
import { Hero } from "../sections/Hero";
import { HowItWorks } from "../sections/HowItWorks";
import { CenterFeatures } from "../sections/CenterFeatures";
import { StudentFeatures } from "../sections/StudentFeatures";
import { Testimonials } from "../sections/Testimonials";
import { Categories } from "../sections/Categories";
import { Pricing } from "../sections/Pricing";
import { Faq } from "../sections/Faq";
import { Newsletter } from "../sections/Newsletter";
import { Footer } from "../sections/Footer";

export function Home() {
  return (
    <>
      <Nav />
      <Hero />
      <HowItWorks />
      {/* "Features" nav anchor — kept as an empty landing point to match the source design */}
      <section id="features" />
      <CenterFeatures />
      <StudentFeatures />
      <Testimonials />
      <Categories />
      <Pricing />
      <Faq />
      <Newsletter />
      <Footer />
    </>
  );
}
