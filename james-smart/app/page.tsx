import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import MarqueeBanner from "./components/MarqueeBanner";
import Collections from "./components/Collections";
import Heritage from "./components/Heritage";
import FeaturedProducts from "./components/FeaturedProducts";
import Services from "./components/Services";
import Stores from "./components/Stores";
import Newsletter from "./components/Newsletter";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <MarqueeBanner />
        <Collections />
        <FeaturedProducts />
        <Heritage />
        <Services />
        <Stores />
        <Newsletter />
      </main>
      <Footer />
    </>
  );
}
