import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Shield, Calculator, FileText } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center px-6 sm:px-8 md:px-12 lg:px-16">
      <div className="max-w-7xl w-full mx-auto py-12 sm:py-16 md:py-20 lg:py-24">
        <div className="flex flex-col items-center text-center space-y-8 sm:space-y-12 md:space-y-16 lg:space-y-20">
          
          {/* Logo with gradient */}
          <div className="relative animate-in fade-in slide-in-from-top-4 duration-700">
            <h1 className="font-serif text-fluid-6xl sm:text-[clamp(4rem,3rem+8vw,7rem)] font-bold tracking-tight bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
              KryptoGain
            </h1>
            <div className="absolute -bottom-2 sm:-bottom-3 left-0 right-0 h-1 sm:h-1.5 bg-gradient-to-r from-transparent via-primary to-transparent"></div>
          </div>

          {/* Tagline with stagger animation */}
          <div className="space-y-3 sm:space-y-4 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
            <h2 className="font-serif text-fluid-3xl sm:text-fluid-4xl md:text-fluid-5xl font-normal leading-tight text-foreground">
              Track. Analyze. Stay Informed.
            </h2>
            <p className="font-serif text-fluid-2xl sm:text-fluid-3xl md:text-fluid-4xl font-normal leading-tight text-muted-foreground">
              Crypto Insights Made Simple.
            </p>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl w-full mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <div className="flex flex-col items-center p-6 rounded-lg bg-card/50 border border-border/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300 hover:scale-105">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Calculator className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">FIFO-Based Analysis</h3>
              <p className="text-sm text-muted-foreground">Aproximate tax analyses using First-In-First-Out method</p>
            </div>

            <div className="flex flex-col items-center p-6 rounded-lg bg-card/50 border border-border/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300 hover:scale-105">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Flexible Region Settings</h3>
              <p className="text-sm text-muted-foreground">Generalized tax rule interpretations</p>
            </div>

            <div className="flex flex-col items-center p-6 rounded-lg bg-card/50 border border-border/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300 hover:scale-105">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">PDF Summaries</h3>
              <p className="text-sm text-muted-foreground">Auto-generated breakdowns for personal reference</p>
            </div>
          </div>

          {/* How it works - Steps */}
          <div className="w-full max-w-5xl mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
            <h3 className="font-serif text-fluid-2xl sm:text-fluid-3xl font-semibold mb-8 sm:mb-12 text-foreground">
              How It Works
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 sm:gap-8 relative">
              {/* Connecting line for desktop */}
              <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20"></div>
              
              {/* Step 1 */}
              <div className="relative flex flex-col items-center text-center group">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300 z-10 relative">
                  <span className="text-2xl sm:text-3xl font-bold text-primary-foreground">1</span>
                </div>
                <h4 className="font-semibold text-lg mb-2">Upload Transactions</h4>
                <p className="text-sm text-muted-foreground">
                  Upload your transaction CSV for processing
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative flex flex-col items-center text-center group">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300 z-10 relative">
                  <span className="text-2xl sm:text-3xl font-bold text-primary-foreground">2</span>
                </div>
                <h4 className="font-semibold text-lg mb-2">Auto-Process</h4>
                <p className="text-sm text-muted-foreground">
                  Our FIFO-based processor gives you an estimated view of gains/losses.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative flex flex-col items-center text-center group">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300 z-10 relative">
                  <span className="text-2xl sm:text-3xl font-bold text-primary-foreground">3</span>
                </div>
                <h4 className="font-semibold text-lg mb-2">Review Summary</h4>
                <p className="text-sm text-muted-foreground">
                  View an auto-generated breakdown for review.
                </p>
              </div>

              {/* Step 4 */}
              <div className="relative flex flex-col items-center text-center group">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300 z-10 relative">
                  <span className="text-2xl sm:text-3xl font-bold text-primary-foreground">4</span>
                </div>
                <h4 className="font-semibold text-lg mb-2">Download Summary</h4>
                <p className="text-sm text-muted-foreground">
                  Pay $15 to download an auto-generated PDF summary.
                </p>
              </div>
            </div>
          </div>

          {/* Key benefits */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 items-center justify-center text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-4 duration-700 delay-600 mt-8">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span>CSV Upload Support</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span>Exchange CSV Support</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span>Real-time Processing</span>
            </div>
          </div>

          {/* CTA Button with enhanced design */}
          <Button 
            size="lg"
            onClick={() => navigate('/terms')}
            className="mt-8 sm:mt-12 md:mt-16 px-8 sm:px-10 md:px-12 py-6 sm:py-7 md:py-8 text-fluid-base sm:text-fluid-lg md:text-fluid-xl font-semibold rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-800 group"
          >
            Generate Summary
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>

          {/* Pricing note */}
          <p className="text-sm text-muted-foreground animate-in fade-in duration-700 delay-1000">
            Only <span className="font-semibold text-foreground">$15</span> for an auto-generated PDF summary
          </p>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground text-center mt-8 px-4 max-w-2xl">
            All outputs are automated estimates for personal use and do not constitute tax, legal, or financial advice. Users are responsible for verifying all results.
          </p>
        </div>
      </div>
    </main>
  );
};

export default Index;
