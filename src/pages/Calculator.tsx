import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, CalendarIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

const Calculator = () => {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [blockchain, setBlockchain] = useState<'ethereum' | 'polygon'>('ethereum');
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setToDate] = useState<Date>();
  const [calculatedTax, setCalculatedTax] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [txCount, setTxCount] = useState(0);
  const [walletAddress, setWalletAddress] = useState<string>('');

  useEffect(() => {
    if (isConnected && address) {
      setWalletAddress(address);
    }
  }, [isConnected, address]);

  const generatePDFInBrowser = (taxAmount: number, transactions: number, effectiveAddress?: string) => {
    const addr = effectiveAddress || walletAddress || address || 'N/A';
    console.log('generatePDFInBrowser called with:', { taxAmount, transactions, addr, blockchain, fromDate, toDate });
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('KryptoGain Tax Report', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Wallet: ${addr}`, 20, 35);
    doc.text(`Blockchain: ${blockchain.charAt(0).toUpperCase() + blockchain.slice(1)}`, 20, 45);
    doc.text(`Period: ${format(fromDate!, 'PPP')} - ${format(toDate!, 'PPP')}`, 20, 55);
    
    // Summary
    doc.setFontSize(16);
    doc.text('Tax Summary', 20, 75);
    doc.setFontSize(12);
    doc.text(`Total Transactions: ${transactions}`, 20, 85);
    doc.text(`Estimated Tax (30%): $${taxAmount.toFixed(2)}`, 20, 95);
    
    // Transaction details
    doc.setFontSize(14);
    doc.text('Transaction Details', 20, 115);
    doc.setFontSize(10);
    doc.text('Full transaction history available on-chain', 20, 125);
    
    // Download
    doc.save(`kryptogain-tax-report-${addr.slice(0, 8)}.pdf`);
    
    toast({
      title: "PDF Generated!",
      description: "Your tax report has been downloaded.",
    });
  };


  // Helper function to fetch all transactions with pagination
  const fetchAllTransactions = async (
    apiUrl: string,
    addr: string,
    apiKey: string
  ): Promise<any[]> => {
    let allTransactions: any[] = [];
    let page = 1;
    const offset = 10000;
    
    while (true) {
      const url = `${apiUrl}&module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&page=${page}&offset=${offset}&sort=asc&apikey=${apiKey}`;
      console.log(`Fetching page ${page}...`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status !== '1' || !data.result || !Array.isArray(data.result)) {
        break;
      }
      
      allTransactions = allTransactions.concat(data.result);
      
      // If we got fewer than offset results, we've reached the end
      if (data.result.length < offset) {
        break;
      }
      
      page++;
    }
    
    return allTransactions;
  };

  // Helper function to convert Wei to ETH using BigInt for precision
  const weiToEth = (wei: string): number => {
    try {
      const weiBigInt = BigInt(wei);
      const ethBigInt = weiBigInt / BigInt(1e18);
      const remainderBigInt = weiBigInt % BigInt(1e18);
      return Number(ethBigInt) + Number(remainderBigInt) / 1e18;
    } catch {
      return 0;
    }
  };

  const calculateTax = async () => {
    const effectiveAddress = (walletAddress || address || '').toString();
    if (!effectiveAddress || !fromDate || !toDate) {
      toast({
        title: "Missing Information",
        description: "Please enter a wallet address and select dates",
        variant: "destructive",
      });
      return;
    }

    const now = new Date();
    if (fromDate > now || toDate > now) {
      toast({
        title: "Invalid Date Range",
        description: "Please select dates from the past, not the future",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // TODO: Payment verification would go here (IPN key validation)
      // const paymentVerified = await verifyPaymentWithIPN(hardcodedIPNKey);
      // if (!paymentVerified) { toast error and return }
      
      const apiKey = blockchain === 'ethereum' 
        ? import.meta.env.VITE_ETHERSCAN_API_KEY || 'YourEtherscanAPIKey'
        : import.meta.env.VITE_POLYGONSCAN_API_KEY || 'YourPolygonscanAPIKey';
      
      const apiUrl = blockchain === 'ethereum'
        ? `https://api.etherscan.io/v2/api?chainid=1`
        : `https://api.polygonscan.com/api`;

      const fromTimestamp = Math.floor(new Date(fromDate.setUTCHours(0, 0, 0, 0)).getTime() / 1000);
      const toTimestamp = Math.floor(new Date(toDate.setUTCHours(23, 59, 59, 999)).getTime() / 1000);

      const allTransactions = await fetchAllTransactions(apiUrl, effectiveAddress, apiKey);
      
      if (allTransactions.length === 0) {
        setTxCount(0);
        setCalculatedTax(0);
        generatePDFInBrowser(0, 0, effectiveAddress);
        toast({
          title: "No Transactions",
          description: "No transactions found for this wallet",
        });
        return;
      }

      const filteredTxs = allTransactions.filter((tx: any) => {
        const txTimestamp = parseInt(tx.timeStamp);
        return txTimestamp >= fromTimestamp && txTimestamp <= toTimestamp;
      });

      setTxCount(filteredTxs.length);
      
      if (filteredTxs.length === 0) {
        setCalculatedTax(0);
        generatePDFInBrowser(0, 0, effectiveAddress);
        toast({
          title: "No Transactions",
          description: "No transactions found in this date range",
        });
        return;
      }

      let totalSentWei = BigInt(0);
      let totalReceivedWei = BigInt(0);
      let gasFeesWei = BigInt(0);
      
      const addressLower = effectiveAddress.toLowerCase();
      
      filteredTxs.forEach((tx: any) => {
        const valueWei = BigInt(tx.value || '0');
        const fromAddress = tx.from?.toLowerCase() || '';
        const toAddress = tx.to?.toLowerCase() || '';
        
        if (fromAddress === addressLower) {
          totalSentWei += valueWei;
          const gasUsed = BigInt(tx.gasUsed || '0');
          const gasPrice = BigInt(tx.gasPrice || '0');
          gasFeesWei += gasUsed * gasPrice;
        }
        
        if (toAddress === addressLower) {
          totalReceivedWei += valueWei;
        }
      });
      
      const totalSent = weiToEth(totalSentWei.toString());
      const totalReceived = weiToEth(totalReceivedWei.toString());
      const gasFeesSpent = weiToEth(gasFeesWei.toString());
      const netGain = totalReceived - totalSent - gasFeesSpent;
      const estimatedTax = netGain > 0 ? netGain * 0.30 : 0;
      
      setCalculatedTax(estimatedTax);
      generatePDFInBrowser(estimatedTax, filteredTxs.length, effectiveAddress);
      
      toast({
        title: "Report Generated!",
        description: `Analyzed ${filteredTxs.length} transactions`,
      });
      
    } catch (error) {
      console.error('Tax calculation error:', error);
      toast({
        title: "Error",
        description: "Failed to generate report. Please check your inputs.",
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

          <div className="mt-4 w-full">
            <label className="text-sm font-medium">Wallet address (optional)</label>
            <Input
              placeholder="0x..."
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value.trim())}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Paste any address to generate without connecting.
            </p>
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


            {/* Results */}
            {calculatedTax !== null && !loading && (
              <>
                <Separator />
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Transactions Found: {txCount}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Estimated Tax Liability (30%)
                  </p>
                  <p className="font-serif text-fluid-3xl font-bold text-green-600">
                    ${calculatedTax.toFixed(2)}
                  </p>
                </div>
              </>
            )}

            {/* Loading */}
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

            {/* Generate Report Button */}
            {calculatedTax === null && !loading && (
              <>
                <Separator />
                <Button
                  size="lg"
                  className="w-full bg-foreground text-background hover:bg-foreground/90"
                  disabled={!((address || walletAddress) && fromDate && toDate)}
                  onClick={calculateTax}
                >
                  Generate Tax Report
                </Button>
              </>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
};

export default Calculator;
