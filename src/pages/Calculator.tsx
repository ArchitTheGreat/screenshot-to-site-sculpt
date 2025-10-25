import { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet } from 'lucide-react';

const Calculator = () => {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [transactions, setTransactions] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [calculatedTax, setCalculatedTax] = useState<number | null>(null);

  const calculateTax = () => {
    const purchase = parseFloat(purchasePrice);
    const sale = parseFloat(salePrice);
    const txCount = parseInt(transactions);

    if (!isNaN(purchase) && !isNaN(sale) && !isNaN(txCount)) {
      const gain = (sale - purchase) * txCount;
      const tax = gain * 0.25; // 25% tax rate (simplified)
      setCalculatedTax(tax);
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
            <div className="space-y-2">
              <Label htmlFor="transactions">Number of Transactions</Label>
              <Input
                id="transactions"
                type="number"
                placeholder="Enter number of transactions"
                value={transactions}
                onChange={(e) => setTransactions(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase">Average Purchase Price (USD)</Label>
              <Input
                id="purchase"
                type="number"
                placeholder="Enter average purchase price"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sale">Average Sale Price (USD)</Label>
              <Input
                id="sale"
                type="number"
                placeholder="Enter average sale price"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>

            <Button
              onClick={calculateTax}
              className="w-full"
              size="lg"
              disabled={!transactions || !purchasePrice || !salePrice}
            >
              Calculate Tax
            </Button>

            {calculatedTax !== null && (
              <>
                <Separator />
                <div className="bg-accent/10 p-6 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-2">
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

        {/* Payment Section */}
        {calculatedTax !== null && (
          <Card className="p-6 sm:p-8">
            <h2 className="font-serif text-fluid-2xl font-semibold mb-4">
              Generate Tax Report
            </h2>
            <p className="text-muted-foreground mb-6">
              Get a comprehensive tax report with all your transactions and calculations
            </p>
            <Button
              size="lg"
              className="w-full bg-foreground text-background hover:bg-foreground/90"
            >
              Pay & Download Report - $49.99
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Calculator;
