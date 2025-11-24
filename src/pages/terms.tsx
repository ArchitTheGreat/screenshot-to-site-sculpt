import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 sm:mb-12">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2 hover:bg-primary/10 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        <div className="bg-card/95 backdrop-blur-sm shadow-xl border border-primary/10 rounded-lg p-6 sm:p-8 md:p-12">
          <h1 className="font-serif text-fluid-3xl sm:text-fluid-4xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Terms of Service
          </h1>
          
          <p className="text-sm text-muted-foreground mb-8">
            Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using KryptoGain ("Service", "we", "us", or "our"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these Terms of Service, please do not use our Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                KryptoGain provides cryptocurrency tax calculation tools that help users calculate capital gains and losses from cryptocurrency transactions. Our Service includes:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                <li>CSV transaction upload and processing</li>
                <li>Wallet integration for automatic transaction fetching</li>
                <li>Tax calculation using FIFO (First-In-First-Out) methodology</li>
                <li>PDF tax report generation</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">3. Not Financial or Tax Advice</h2>
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-4">
                <p className="text-orange-900 dark:text-orange-200 font-semibold">⚠️ Important Disclaimer</p>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                KryptoGain is a calculation tool only and does NOT provide financial, tax, legal, or accounting advice. The information and calculations provided by our Service are for informational purposes only and should not be construed as professional advice.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-3">
                You should consult with qualified tax professionals, accountants, or financial advisors regarding your specific tax situation. We are not responsible for any decisions you make based on the calculations or information provided by our Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">4. User Responsibilities</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                By using KryptoGain, you agree to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Provide accurate and complete transaction data</li>
                <li>Verify all calculations and results independently</li>
                <li>Maintain responsibility for your own tax filings and compliance</li>
                <li>Use the Service in compliance with all applicable laws and regulations</li>
                <li>Not upload malicious files or attempt to compromise the Service</li>
                <li>Keep your account credentials secure and confidential</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Accuracy and Limitations</h2>
              <p className="text-muted-foreground leading-relaxed">
                While we strive to provide accurate calculations, KryptoGain makes no warranties or guarantees regarding the accuracy, completeness, or reliability of any calculations, data, or reports generated by the Service. Tax laws are complex and vary by jurisdiction. You are solely responsible for verifying all calculations and ensuring compliance with applicable tax laws.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-3">
                The Service uses historical price data from third-party sources which may contain errors or inaccuracies. We are not responsible for errors in source data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Payment Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                Access to certain features of the Service, including PDF report generation, requires a one-time payment of $15 USD per report. Payments are processed through our third-party payment processor. All sales are final and non-refundable unless otherwise required by law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">7. Privacy and Data</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your privacy is important to us. We process your transaction data solely for the purpose of generating tax calculations and reports. We do not sell or share your personal data with third parties except as necessary to provide the Service (e.g., payment processing) or as required by law.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-3">
                Transaction data uploaded via CSV is processed in your browser and on our servers temporarily. Wallet connection data is fetched from public blockchain APIs. We recommend reviewing our Privacy Policy for complete details.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">8. Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                All content, features, and functionality of the Service, including but not limited to text, graphics, logos, code, and software, are the exclusive property of KryptoGain and are protected by copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">9. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, KRYPTOGAIN SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                <li>Your use or inability to use the Service</li>
                <li>Any inaccuracies in calculations or reports</li>
                <li>Tax penalties, fines, or liabilities resulting from use of our Service</li>
                <li>Unauthorized access to or alteration of your data</li>
                <li>Any third-party conduct or content on the Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">10. Indemnification</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to indemnify, defend, and hold harmless KryptoGain and its officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with your use of the Service or violation of these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">11. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason, including but not limited to breach of these Terms. Upon termination, your right to use the Service will immediately cease.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">12. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify or replace these Terms at any time at our sole discretion. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-3">
                By continuing to access or use our Service after revisions become effective, you agree to be bound by the revised terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">13. Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which KryptoGain operates, without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">14. Severability</h2>
              <p className="text-muted-foreground leading-relaxed">
                If any provision of these Terms is held to be invalid or unenforceable, such provision shall be struck and the remaining provisions shall be enforced to the fullest extent under law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">15. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms of Service, please contact us through our website or support channels.
              </p>
            </section>

            <div className="border-t border-border pt-6 mt-8">
              <p className="text-sm text-muted-foreground mb-6">
                By using KryptoGain, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
              </p>
              <Button
                size="lg"
                onClick={() => navigate('/calculator')}
                className="w-full sm:w-auto px-8 py-6 text-lg font-semibold rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
              >
                I Accept - Proceed to Calculator
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;