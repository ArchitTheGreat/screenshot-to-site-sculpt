import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Wallet, CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const Calculator = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [blockchain, setBlockchain] = useState<'ethereum' | 'polygon'>('ethereum');
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setToDate] = useState<Date>();
  const [calculatedTax, setCalculatedTax] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [txCount, setTxCount] = useState(0);

  useEffect(() => {
    if (searchParams.get('paymentsuccess') === 'true' && address && fromDate && toDate) {
      toast({
        title: "Payment Successful!",
        description: "Your tax report is being generated...",
      });
      calculateTax();
    }
  }, [searchParams, address, fromDate, toDate]);

  const calculateTax = async () => {
    if (!address || !fromDate || !toDate) {
      toast({
        title: "Missing Information",
        description: "Please connect wallet and select date range",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const apiKey = blockchain === 'ethereum' 
        ? 'YourEtherscanAPIKey' 
        : 'YourPolygonscanAPIKey';
      
      const apiUrl = blockchain === 'ethereum'
        ? `https://api.etherscan.io/api`
        : `https://api.polygonscan.com/api`;

      const fromTimestamp = Math.floor(fromDate.getTime() / 1000);
      const toTimestamp = Math.floor(toDate.getTime() / 1000);

      const response = await fetch(
        `${apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${apiKey}`
      );

      const data = await response.json();
      
      if (data.status === '1' && data.result) {
        const filteredTxs = data.result.filter((tx: any) => {
          const txTimestamp = parseInt(tx.timeStamp);
          return txTimestamp >= fromTimestamp && txTimestamp <= toTimestamp;
        });

        setTxCount(filteredTxs.length);
        
        // Simplified tax calculation (25% on estimated gains)
        const totalValue = filteredTxs.reduce((acc: number, tx: any) => {
          return acc + parseFloat(tx.value) / 1e18;
        }, 0);
        
        const estimatedTax = totalValue * 0.25;
        setCalculatedTax(estimatedTax);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch transaction data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 sm:mb-12">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <h1 className="font-serif text-fluid-3xl sm:text-fluid-4xl font-bold text-center flex-1">
            KryptoGain
          </h1>

          <div className="w-[100px]"></div>
        </div>

        {/* Wallet Connection */}
        <Card className="p-6 sm:p-8 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-fluid-xl font-semibold mb-2">
                Connect Wallet
              </h2>
              <p className="text-sm text-muted-foreground">
                {isConnected
                  ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}`
                  : 'Connect your wallet to calculate taxes'}
              </p>
            </div>

            {!isConnected ? (
              <div className="flex flex-wrap gap-2">
                {connectors.map((connector) => (
                  <Button
                    key={connector.id}
                    onClick={() => connect({ connector })}
                    variant="outline"
                    className="gap-2"
                  >
                    <Wallet className="h-4 w-4" />
                    {connector.name}
                  </Button>
                ))}
              </div>
            ) : (
              <Button onClick={() => disconnect()} variant="outline">
                Disconnect
              </Button>
            )}
          </div>
        </Card>

        {/* Calculator */}
        <Card className="p-6 sm:p-8 mb-8">
          <h2 className="font-serif text-fluid-2xl font-semibold mb-6">
            Tax Calculator
          </h2>

          <div className="space-y-6">
            {/* Blockchain Toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Blockchain</label>
              <Tabs value={blockchain} onValueChange={(v) => setBlockchain(v as 'ethereum' | 'polygon')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="ethereum">Ethereum</TabsTrigger>
                  <TabsTrigger value="polygon">Polygon</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Date Range Selection */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !fromDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fromDate ? format(fromDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fromDate}
                      onSelect={setFromDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !toDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {toDate ? format(toDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={toDate}
                      onSelect={setToDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {calculatedTax === null && !loading && (
              <>
                <Separator />
                <div className="space-y-4">
                  <p className="text-center text-muted-foreground">
                    Complete payment to generate your comprehensive tax report
                  </p>
                  <a 
                    href="https://nowpayments.io/payment/?iid=4461490785&source=button" 
                    target="_blank" 
                    rel="noreferrer noopener"
                    className="block"
                  >
                    <Button
                      size="lg"
                      className="w-full bg-foreground text-background hover:bg-foreground/90 gap-2"
                      disabled={!isConnected || !fromDate || !toDate}
                    >
                      <img 
                        src="https://nowpayments.io/images/embeds/payment-button-white.svg" 
                        alt="Crypto Payment" 
                        className="h-5 w-5 invert"
                      />
                      Pay with Crypto & Generate Report
                    </Button>
                  </a>
                </div>
              </>
            )}

            {loading && (
              <>
                <Separator />
                <div className="bg-accent/10 p-6 rounded-lg text-center space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent" />
                  <p className="text-sm text-muted-foreground">
                    Generating your tax report...
                  </p>
                </div>
              </>
            )}

            {calculatedTax !== null && !loading && (
              <>
                <Separator />
                <div className="bg-accent/10 p-6 rounded-lg text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Transactions Found: {txCount}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Estimated Tax Liability
                  </p>
                  <p className="font-serif text-fluid-3xl font-bold text-accent">
                    ${calculatedTax.toFixed(2)}
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
};

export default Calculator;
