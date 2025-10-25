import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 sm:px-8 md:px-12 lg:px-16">
      <div className="max-w-7xl w-full mx-auto py-12 sm:py-16 md:py-20 lg:py-24">
        <div className="flex flex-col items-center text-center space-y-8 sm:space-y-12 md:space-y-16 lg:space-y-20">
          {/* Logo */}
          <div className="relative">
            <h1 className="font-serif text-fluid-6xl sm:text-[clamp(4rem,3rem+8vw,7rem)] font-bold tracking-tight text-foreground">
              KryptoGain
            </h1>
            <div className="absolute -bottom-2 sm:-bottom-3 left-0 right-0 h-1 sm:h-1.5 bg-accent"></div>
          </div>

          {/* Tagline */}
          <div className="space-y-2 sm:space-y-3 max-w-5xl">
            <h2 className="font-serif text-fluid-3xl sm:text-fluid-4xl md:text-fluid-5xl font-normal leading-tight text-foreground">
              Track. Calculate. Comply.
            </h2>
            <p className="font-serif text-fluid-3xl sm:text-fluid-4xl md:text-fluid-5xl font-normal leading-tight text-foreground">
              Crypto Taxes Made Easy.
            </p>
          </div>

          {/* CTA Button */}
          <Button 
            size="lg"
            onClick={() => navigate('/calculator')}
            className="mt-8 sm:mt-12 md:mt-16 px-8 sm:px-10 md:px-12 py-6 sm:py-7 md:py-8 text-fluid-base sm:text-fluid-lg md:text-fluid-xl font-medium rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            <span className="mr-2">◉</span>
            Generate my Tax Report!
          </Button>
        </div>
      </div>
    </main>
  );
};

export default Index;
