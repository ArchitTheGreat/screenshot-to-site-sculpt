import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

const TERMS_PDF_URL = "https://cdn.jsdelivr.net/gh/ArchitTheGreat/bug-free-happiness@main/ToS_Kryptogain.pdf";
const LOCALSTORAGE_KEY = "kryptogain_tos_accepted";

const TermsOfService = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    // If already accepted, go to calculator immediately
    const accepted = localStorage.getItem(LOCALSTORAGE_KEY);
    if (accepted === "true") {
      navigate('/calculator');
      return;
    }
    // open modal on mount
    setOpen(true);
  }, [navigate]);

  const handleAccept = () => {
    localStorage.setItem(LOCALSTORAGE_KEY, "true");
    setOpen(false);
    navigate('/calculator');
  };

  const handleDecline = () => {
    localStorage.removeItem(LOCALSTORAGE_KEY);
    setOpen(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16 flex items-center justify-center">
      <div className="max-w-3xl w-full">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2 hover:bg-primary/10 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div />
        </div>

        <div className="bg-card/95 backdrop-blur-sm shadow-xl border border-primary/10 rounded-lg p-6">
          <h1 className="font-serif text-2xl font-bold mb-2 text-foreground">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Please review and accept our Terms of Service to continue. You can open the full Terms PDF, then Accept or Decline below.
          </p>

          <div className="flex gap-3">
            <Button
              variant="outline"
              asChild
            >
              <a href={TERMS_PDF_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                View Terms (PDF)
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>

            <Button
              onClick={() => setOpen(true)}
              className="ml-auto"
            >
              Open Consent
            </Button>
          </div>
        </div>
      </div>

      {/* Modal / Pop-up */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Terms of Service"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => {/* click backdrop does nothing to require explicit choice */}}
          />
          <div className="relative z-10 max-w-2xl w-full mx-4 bg-background rounded-lg shadow-2xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-3">KryptoGain — Terms of Service</h2>

            <div className="prose max-w-none mb-4 text-sm text-muted-foreground">
              <p>
                By accepting, you acknowledge that you have read and agree to our Terms of Service.
                The full Terms are available via the PDF link below. This is a consent required to use certain features (e.g. PDF report generation).
              </p>
              <ul className="list-disc pl-5 mt-2">
                <li>We do not provide legal or tax advice — calculations are informational only.</li>
                <li>Payments for reports are non-refundable except where required by law.</li>
                <li>See the PDF for the full terms and details.</li>
              </ul>
            </div>

            <div className="flex items-center justify-between gap-3">
              <a
                href={TERMS_PDF_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline flex items-center gap-2"
              >
                Open full Terms (PDF)
                <ExternalLink className="h-4 w-4" />
              </a>

              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleDecline}>
                  Decline
                </Button>
                <Button onClick={handleAccept}>
                  Accept and Continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TermsOfService;