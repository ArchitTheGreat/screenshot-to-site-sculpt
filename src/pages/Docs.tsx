import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const Docs = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 sm:mb-12">
          <Button
            variant="ghost"
            onClick={() => navigate('/calculator')}
            className="gap-2 hover:bg-primary/10 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Calculator
          </Button>
          
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-center flex-1 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            CSV Format Documentation
          </h1>

          <div className="w-[100px]"></div>
        </div>

        <Card className="p-6 sm:p-8 backdrop-blur-sm bg-card/95 shadow-xl border-primary/10">
          <h2 className="font-serif text-2xl font-semibold mb-8 text-foreground">
            Supported Exchange CSV Formats
          </h2>
          <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
            Upload your transaction history CSV export from these exchanges. Our parser automatically detects the format and extracts buy/sell transactions.
          </p>

          <Tabs defaultValue="coinbase" className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
              <TabsTrigger value="coinbase">Coinbase</TabsTrigger>
              <TabsTrigger value="binance">Binance</TabsTrigger>
              <TabsTrigger value="kraken">Kraken</TabsTrigger>
              <TabsTrigger value="cryptocom">Crypto.com</TabsTrigger>
              <TabsTrigger value="gemini">Gemini</TabsTrigger>
              <TabsTrigger value="generic">Generic</TabsTrigger>
            </TabsList>

            <TabsContent value="coinbase" className="mt-6">
              <Card className="p-6 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3 mb-6">
                  <Badge variant="secondary" className="bg-green-500">Fully Supported</Badge>
                  <h3 className="text-xl font-semibold">Coinbase</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-4 text-lg">Required Columns</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Column</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow><TableCell>Timestamp</TableCell><TableCell>Date/time of transaction</TableCell></TableRow>
                        <TableRow><TableCell>Transaction Type</TableCell><TableCell>"Buy" or "Sell"</TableCell></TableRow>
                        <TableRow><TableCell>Asset</TableCell><TableCell>Crypto symbol (BTC, ETH, etc.)</TableCell></TableRow>
                        <TableRow><TableCell>Quantity Transacted</TableCell><TableCell>Amount of crypto</TableCell></TableRow>
                        <TableRow><TableCell>Total (inclusive of fees)</TableCell><TableCell>USD total including fees</TableCell></TableRow>
                        <TableRow><TableCell>Fees (optional)</TableCell><TableCell>Transaction fees</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-4 text-lg">Sample CSV Rows</h4>
                    <pre className="bg-muted/50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
{`Timestamp,Transaction Type,Asset,Quantity Transacted,Total (inclusive of fees),Fees
2023-01-01 12:00:00,Buy,BTC,0.1,2000.00,5.00
2023-02-01 14:30:00,Sell,BTC,0.05,2500.00,2.50`}
                    </pre>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="binance" className="mt-6">
              <Card className="p-6 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3 mb-6">
                  <Badge variant="secondary" className="bg-green-500">Fully Supported</Badge>
                  <h3 className="text-xl font-semibold">Binance</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-4 text-lg">Required Columns</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Column</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                    <TableBody>
                      <TableRow><TableCell>UTC_Time</TableCell><TableCell>Transaction date/time</TableCell></TableRow>
                      <TableRow><TableCell>Operation</TableCell><TableCell>"Buy", "Sell", "Deposit", "Withdraw"</TableCell></TableRow>
                      <TableRow><TableCell>Coin</TableCell><TableCell>Crypto symbol</TableCell></TableRow>
                      <TableRow><TableCell>Change</TableCell><TableCell>Amount (negative for sells)</TableCell></TableRow>
                      <TableRow><TableCell>Remark (optional)</TableCell><TableCell>Contains USD value or price info</TableCell></TableRow>
                    </TableBody>
                  </Table>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-4 text-lg">Sample CSV Rows</h4>
                    <pre className="bg-muted/50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
{`UTC_Time,Account,Operation,Coin,Change,Remark
2023-01-01 12:00:00,Spot,Buy,BTC,0.1,"BTC@20000 USD"
2023-02-01 14:30:00,Spot,Sell,BTC,-0.05,"BTC@25000 USD"`}
                    </pre>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="kraken" className="mt-6">
              <Card className="p-6 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3 mb-6">
                  <Badge variant="secondary" className="bg-yellow-500">Partial Support</Badge>
                  <h3 className="text-xl font-semibold">Kraken</h3>
                </div>
                <p className="mb-6 text-muted-foreground">Limited trade parsing. Full support coming soon.</p>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-4 text-lg">Key Columns</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Column</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow><TableCell>time</TableCell><TableCell>Unix timestamp</TableCell></TableRow>
                        <TableRow><TableCell>type</TableCell><TableCell>"trade"</TableCell></TableRow>
                        <TableRow><TableCell>asset</TableCell><TableCell>Asset code (XETH, ZUSD)</TableCell></TableRow>
                        <TableRow><TableCell>amount</TableCell><TableCell>Amount (negative for sells)</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="cryptocom" className="mt-6">
              <Card className="p-6 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3 mb-6">
                  <Badge variant="secondary" className="bg-green-500">Fully Supported</Badge>
                  <h3 className="text-xl font-semibold">Crypto.com</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-4 text-lg">Required Columns</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Column</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow><TableCell>Timestamp (UTC)</TableCell><TableCell>Date/time</TableCell></TableRow>
                        <TableRow><TableCell>Transaction Kind</TableCell><TableCell>"crypto_purchase", "crypto_sale"</TableCell></TableRow>
                        <TableRow><TableCell>Currency</TableCell><TableCell>Crypto symbol</TableCell></TableRow>
                        <TableRow><TableCell>Amount</TableCell><TableCell>Amount (negative for sells)</TableCell></TableRow>
                        <TableRow><TableCell>Native Amount (in USD)</TableCell><TableCell>USD value</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-4 text-lg">Sample CSV Rows</h4>
                    <pre className="bg-muted/50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
{`Timestamp (UTC),Transaction Kind,Currency,Amount,Native Amount (in USD)
2023-01-01 12:00:00,crypto_purchase,BTC,0.1,2000.00
2023-02-01 14:30:00,crypto_sale,BTC,-0.05,2500.00`}
                    </pre>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="gemini" className="mt-6">
              <Card className="p-6 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3 mb-6">
                  <Badge variant="secondary" className="bg-green-500">Fully Supported</Badge>
                  <h3 className="text-xl font-semibold">Gemini</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-4 text-lg">Required Columns</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Column</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow><TableCell>Date + Time (UTC)</TableCell><TableCell>Combined date/time</TableCell></TableRow>
                        <TableRow><TableCell>Type</TableCell><TableCell>"Buy" or "Sell"</TableCell></TableRow>
                        <TableRow><TableCell>{`BTC Amount (BTC)`}</TableCell><TableCell>BTC amount</TableCell></TableRow>
                        <TableRow><TableCell>{`USD Amount (USD)`}</TableCell><TableCell>USD value</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-4 text-lg">Sample CSV Rows</h4>
                    <pre className="bg-muted/50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
{`Date,Time (UTC),Type,BTC Amount (BTC),USD Amount (USD)
2023-01-01,12:00:00,Buy,0.1,2000.00
2023-02-01,14:30:00,Sell,0.05,2500.00`}
                    </pre>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="generic" className="mt-6">
              <Card className="p-6 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3 mb-6">
                  <Badge variant="secondary" className="bg-blue-500">Flexible</Badge>
                  <h3 className="text-xl font-semibold">Generic / Custom</h3>
                </div>
                <p className="mb-6 text-muted-foreground">
                  Falls back to keyword matching if no exchange format matches. Looks for common column names like Date, Type, Amount, Value, Symbol.
                </p>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Keywords for Buy:</h4>
                    <p className="text-sm text-muted-foreground">buy, bought, deposit, receive, swap in, transfer in</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Keywords for Sell:</h4>
                    <p className="text-sm text-muted-foreground">sell, sold, withdraw, send, swap out, transfer out</p>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default Docs;
