import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-4xl mx-auto">
        {/* Logo */}
        <h1 className="font-serif font-bold text-fluid-6xl md:text-fluid-7xl mb-4 tracking-tight">
          KryptoGain
        </h1>
        
        {/* Decorative accent line */}
        <div className="w-32 h-1 bg-accent mx-auto mb-8"></div>
        
        {/* Tagline */}
        <p className="text-fluid-xl md:text-fluid-2xl text-muted-foreground mb-12 font-light">
          Track. Calculate. Comply. Crypto Taxes Made Easy.
        </p>
        
        {/* CTA Button */}
        <Button
          size="lg"
          onClick={() => navigate('/simple-calculator')}
          className="text-fluid-base md:text-fluid-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <span className="mr-2">◉</span>
          Generate my Tax Report!
        </Button>
      </div>
    </div>
  );
};

export default Index;