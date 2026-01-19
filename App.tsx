
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Plus, Trash2, Send, Copy, Sparkles, RefreshCcw, FileSpreadsheet, Phone, Eye, Printer, X, Download, Share2, Percent, Link as LinkIcon, ExternalLink, Save, History, TrendingUp } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Item, Invoice } from './types';
import { Button } from './components/Button';
import { extractItemsFromText } from './services/geminiService';

interface LogEntry {
  id: string;
  time: string;
  customer: string;
  items: string;
  subtotal: number;
  discount: number;
  total: number;
}

const App: React.FC = () => {
  // Persistence / Deep Linking Logic
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [storeName, setStoreName] = useState('the silver lining');
  const [customerPhone, setCustomerPhone] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [smartInput, setSmartInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [showPreview, setShowPreview] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [billId, setBillId] = useState(`TSL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  
  // Daily Ledger State
  const [dailyLedger, setDailyLedger] = useState<LogEntry[]>([]);
  
  const receiptRef = useRef<HTMLDivElement>(null);

  // Check for deep link on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const data = params.get('b');
    if (data) {
      try {
        const decoded = JSON.parse(atob(data));
        setStoreName(decoded.s || '');
        setItems(decoded.i || []);
        setDiscountPercent(decoded.d || 0);
        setBillId(decoded.id || '');
        setCustomerPhone(decoded.p || '');
        setIsGuestMode(true);
        setShowPreview(true);
      } catch (e) {
        console.error("Failed to decode bill data", e);
      }
    }
  }, []);

  // Totals calculation
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    return (subtotal * discountPercent) / 100;
  }, [subtotal, discountPercent]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  // Ledger Totals
  const ledgerSummary = useMemo(() => {
    return dailyLedger.reduce((acc, entry) => ({
      subtotal: acc.subtotal + entry.subtotal,
      discount: acc.discount + entry.discount,
      total: acc.total + entry.total,
      count: acc.count + 1
    }), { subtotal: 0, discount: 0, total: 0, count: 0 });
  }, [dailyLedger]);

  const handleSmartExtraction = async () => {
    if (!smartInput.trim()) return;
    setIsProcessing(true);
    try {
      const result = await extractItemsFromText(smartInput);
      const newItems: Item[] = result.items.map(i => ({
        ...i,
        id: Math.random().toString(36).substr(2, 9)
      }));
      setItems(prev => [...prev, ...newItems]);
      setSmartInput('');
    } catch (error) {
      alert("Failed to extract items.");
    } finally {
      setIsProcessing(false);
    }
  };

  const updateItem = (id: string, field: keyof Item, value: string | number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const finalizeAndSave = () => {
    if (items.length === 0) return;
    
    const entry: LogEntry = {
      id: billId,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customer: customerPhone || 'Guest',
      items: items.map(it => `${it.name}(x${it.quantity})`).join(', '),
      subtotal,
      discount: discountAmount,
      total
    };

    setDailyLedger(prev => [entry, ...prev]);
    
    // Reset for next customer
    setItems([]);
    setCustomerPhone('');
    setDiscountPercent(0);
    setBillId(`TSL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const copyFullLedger = () => {
    const header = "Bill ID\tTime\tCustomer\tItems\tSubtotal\tDiscount\tTotal\n";
    const rows = dailyLedger.map(e => 
      `${e.id}\t${e.time}\t${e.customer}\t"${e.items}"\t${e.subtotal.toFixed(2)}\t${e.discount.toFixed(2)}\t${e.total.toFixed(2)}`
    ).join('\n');
    
    const summary = `\nTOTALS\t\t\t\t${ledgerSummary.subtotal.toFixed(2)}\t${ledgerSummary.discount.toFixed(2)}\t${ledgerSummary.total.toFixed(2)}`;
    
    navigator.clipboard.writeText(header + rows + summary);
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const generateDeepLink = useCallback(() => {
    const data = { s: storeName, i: items, d: discountPercent, id: billId, p: customerPhone };
    return `${window.location.origin}${window.location.pathname}?b=${btoa(JSON.stringify(data))}`;
  }, [storeName, items, discountPercent, billId, customerPhone]);

  const handleShareLink = () => {
    const link = generateDeepLink();
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    const message = `Digital Invoice from *${storeName.toUpperCase()}*.%0A%0AView: ${link}`;
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const handleShareReceipt = async () => {
    if (!receiptRef.current) return;
    setIsSharing(true);
    try {
      const canvas = await html2canvas(receiptRef.current, { scale: 2 });
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
      if (blob) {
        const file = new File([blob], `Bill-${billId}.png`, { type: 'image/png' });
        if (navigator.share) await navigator.share({ files: [file] });
      }
    } catch (e) { alert("Sharing failed."); }
    finally { setIsSharing(false); }
  };

  if (isGuestMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 font-mono text-sm shadow-2xl w-full max-w-md rounded-lg">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold uppercase">{storeName}</h1>
            <p className="text-xs text-slate-500 border-b border-dashed pb-2 mb-2">Digital Receipt</p>
            <p className="font-bold">ID: {billId}</p>
          </div>
          <div className="space-y-2 mb-6">
            {items.map((it, i) => (
              <div key={i} className="flex justify-between">
                <span>{it.name} x{it.quantity}</span>
                <span>₹{(it.price * it.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed pt-2 font-bold text-lg flex justify-between">
            <span>TOTAL</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
          <Button variant="secondary" className="w-full mt-8" onClick={() => window.location.href = window.location.origin + window.location.pathname}>New Bill</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="text-blue-600 w-6 h-6" />
          <h1 className="text-lg font-bold">Smart Bill Ledger</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setDailyLedger([])}><RefreshCcw className="w-4 h-4 mr-1" /> Reset Day</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Billing Column */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Phone className="w-3 h-3" /> Customer</h2>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} className="col-span-2 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Store Name" />
              <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="col-span-2 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Customer Phone" />
            </div>
          </section>

          <section className="bg-blue-50 p-6 rounded-xl border border-blue-100 space-y-3">
            <h2 className="text-xs font-bold text-blue-700 uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Bill Entry</h2>
            <div className="flex gap-2">
              <input type="text" value={smartInput} onChange={e => setSmartInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSmartExtraction()} className="flex-1 px-4 py-2 border border-blue-200 rounded-lg outline-none" placeholder="2 burger 90, 1 coke 45..." />
              <Button onClick={handleSmartExtraction} disabled={isProcessing}>{isProcessing ? '...' : 'Add'}</Button>
            </div>
          </section>

          <section className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
             <div className="flex justify-between items-center"><h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Bill</h2> <span className="text-[10px] bg-slate-100 px-2 py-1 rounded">#{billId}</span></div>
             <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {items.length === 0 ? <p className="text-center py-4 text-slate-400 text-sm">Cart is empty</p> : items.map(it => (
                  <div key={it.id} className="flex gap-2">
                    <input type="text" value={it.name} onChange={e => updateItem(it.id, 'name', e.target.value)} className="flex-1 text-xs border-b outline-none" />
                    <input type="number" value={it.quantity} onChange={e => updateItem(it.id, 'quantity', parseInt(e.target.value) || 0)} className="w-10 text-xs border-b outline-none text-center" />
                    <input type="number" value={it.price} onChange={e => updateItem(it.id, 'price', parseFloat(e.target.value) || 0)} className="w-16 text-xs border-b outline-none text-right" />
                    <button onClick={() => setItems(p => p.filter(x => x.id !== it.id))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
             </div>
             <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-1 text-slate-500"><Percent className="w-3 h-3" /> Discount</span>
                  <input type="number" value={discountPercent} onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)} className="w-16 text-right border-b outline-none" />
                </div>
                <div className="flex justify-between text-xl font-bold pt-2 border-t"><span>Total</span><span className="text-blue-600">₹{total.toFixed(2)}</span></div>
             </div>
             <div className="grid grid-cols-2 gap-3 pt-4">
                <Button variant="secondary" onClick={() => setShowPreview(true)} disabled={items.length === 0}><Eye className="w-4 h-4 mr-2" /> Receipt</Button>
                <Button variant="success" onClick={finalizeAndSave} disabled={items.length === 0}><Save className="w-4 h-4 mr-2" /> Save & Log</Button>
             </div>
          </section>
        </div>

        {/* Ledger Column */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl overflow-hidden relative">
             <div className="absolute top-0 right-0 p-8 opacity-10"><TrendingUp className="w-32 h-32" /></div>
             <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><History className="w-4 h-4" /> Daily Session Summary</h2>
             <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                   <p className="text-xs text-slate-400">Total Sales</p>
                   <p className="text-xl font-bold">₹{ledgerSummary.subtotal.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                   <p className="text-xs text-slate-400">Discounts</p>
                   <p className="text-xl font-bold text-red-400">-₹{ledgerSummary.discount.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                   <p className="text-xs text-slate-400">Net Revenue</p>
                   <p className="text-xl font-bold text-emerald-400">₹{ledgerSummary.total.toFixed(2)}</p>
                </div>
             </div>
             <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
                <p className="text-sm font-medium">{ledgerSummary.count} Transactions Logged</p>
                <Button variant="primary" size="sm" onClick={copyFullLedger} className="bg-blue-500 hover:bg-blue-400">
                  {copyStatus === 'copied' ? 'Copied Ledger!' : 'Copy for Spreadsheet'}
                </Button>
             </div>
          </section>

          <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
             <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                <h2 className="text-xs font-bold text-slate-500 uppercase">Systematic Transaction Log</h2>
                <span className="text-[10px] text-slate-400 font-mono">TSV FORMAT READY</span>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                   <thead className="bg-slate-50 text-slate-400 uppercase font-bold border-b">
                      <tr>
                         <th className="px-4 py-3">ID</th>
                         <th className="px-4 py-3">Time</th>
                         <th className="px-4 py-3">Customer</th>
                         <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y">
                      {dailyLedger.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-400 italic">No transactions in this session yet.</td></tr>
                      ) : dailyLedger.map(entry => (
                        <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                           <td className="px-4 py-3 font-mono text-blue-600">{entry.id}</td>
                           <td className="px-4 py-3 text-slate-500">{entry.time}</td>
                           <td className="px-4 py-3 font-medium">{entry.customer}</td>
                           <td className="px-4 py-3 text-right font-bold text-slate-700">₹{entry.total.toFixed(2)}</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </section>
        </div>
      </main>

      {/* Modal remains for sharing single e-bill */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold">Digital Receipt</h3>
              <button onClick={() => setShowPreview(false)}><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="overflow-y-auto flex-1 bg-slate-100 p-4">
              <div ref={receiptRef} className="bg-white p-8 font-mono text-sm shadow-sm mx-auto" style={{ maxWidth: '380px' }}>
                <div className="text-center mb-6">
                  <h1 className="text-xl font-bold uppercase">{storeName}</h1>
                  <p className="text-xs text-slate-500 border-y border-dashed py-2 my-2 italic">Official Electronic Invoice</p>
                  <p className="font-bold">Bill No: {billId}</p>
                </div>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between border-b pb-1 font-bold text-[10px] uppercase"><span>Item</span><span>Qty</span><span>Price</span></div>
                  {items.map((it, i) => (
                    <div key={i} className="flex justify-between text-xs"><span>{it.name}</span><span>x{it.quantity}</span><span>₹{(it.price * it.quantity).toFixed(2)}</span></div>
                  ))}
                </div>
                <div className="border-t border-dashed pt-4 space-y-1">
                  <div className="flex justify-between text-xs"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                  {discountPercent > 0 && <div className="flex justify-between text-xs text-emerald-600"><span>Discount({discountPercent}%)</span><span>-₹{discountAmount.toFixed(2)}</span></div>}
                  <div className="flex justify-between text-lg font-bold border-t pt-2"><span>TOTAL</span><span>₹{total.toFixed(2)}</span></div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={handleShareReceipt}><Share2 className="w-4 h-4 mr-2" /> Share Image</Button>
              <Button variant="success" className="flex-1" onClick={handleShareLink}><LinkIcon className="w-4 h-4 mr-2" /> WA Link</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
