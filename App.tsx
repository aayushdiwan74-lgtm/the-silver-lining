
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Plus, Trash2, Send, Copy, RefreshCcw, FileSpreadsheet, Phone, Eye, X, Download, Share2, Percent, Link as LinkIcon, Save, History, TrendingUp, ShoppingBag, Tag } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Item } from './types';
import { Button } from './components/Button';

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
  // Core States with LocalStorage Persistence
  const [isGuestMode, setIsGuestMode] = useState(false);
  
  const [storeName, setStoreName] = useState(() => {
    return localStorage.getItem('billing_store_name') || 'THE SILVER LINING';
  });
  
  const [customerPhone, setCustomerPhone] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [billId, setBillId] = useState(`TSL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  
  // Manual Entry Form State
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState<string>('');
  const [newItemQty, setNewItemQty] = useState<number>(1);

  // Daily Ledger State with LocalStorage Persistence
  const [dailyLedger, setDailyLedger] = useState<LogEntry[]>(() => {
    const saved = localStorage.getItem('billing_daily_ledger');
    return saved ? JSON.parse(saved) : [];
  });
  
  const receiptRef = useRef<HTMLDivElement>(null);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('billing_daily_ledger', JSON.stringify(dailyLedger));
  }, [dailyLedger]);

  useEffect(() => {
    localStorage.setItem('billing_store_name', storeName);
  }, [storeName]);

  // Deep Link Support
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const data = params.get('b');
      if (data) {
        const decoded = JSON.parse(atob(data));
        if (decoded && typeof decoded === 'object') {
          setStoreName(decoded.s || 'THE SILVER LINING');
          setItems(decoded.i || []);
          setDiscountPercent(decoded.d || 0);
          setBillId(decoded.id || `BILL-${Date.now()}`);
          setCustomerPhone(decoded.p || '');
          setIsGuestMode(true);
          setShowPreview(true);
        }
      }
    } catch (e) {
      console.error("Link parsing failed", e);
      window.history.replaceState({}, '', window.location.href.split('?')[0]);
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

  const ledgerSummary = useMemo(() => {
    return dailyLedger.reduce((acc, entry) => ({
      subtotal: acc.subtotal + entry.subtotal,
      discount: acc.discount + entry.discount,
      total: acc.total + entry.total,
      count: acc.count + 1
    }), { subtotal: 0, discount: 0, total: 0, count: 0 });
  }, [dailyLedger]);

  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newItemName || !newItemPrice) return;
    
    const item: Item = {
      id: Math.random().toString(36).substr(2, 9),
      name: newItemName,
      price: parseFloat(newItemPrice) || 0,
      quantity: newItemQty || 1
    };

    setItems(prev => [...prev, item]);
    setNewItemName('');
    setNewItemPrice('');
    setNewItemQty(1);
  };

  const finalizeAndSave = () => {
    if (items.length === 0) return;
    
    const entry: LogEntry = {
      id: billId,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customer: customerPhone || 'Walk-in Customer',
      items: items.map(it => `${it.name}(x${it.quantity})`).join(', '),
      subtotal,
      discount: discountAmount,
      total
    };

    setDailyLedger(prev => [entry, ...prev]);
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

  const clearLedger = () => {
    if (confirm("Are you sure you want to clear the daily ledger? This will permanently delete today's saved records.")) {
      setDailyLedger([]);
    }
  };

  const generateDeepLink = useCallback(() => {
    const data = { 
      s: storeName, 
      i: items.map(it => ({ name: it.name, price: it.price, quantity: it.quantity })), 
      d: discountPercent, 
      id: billId, 
      p: customerPhone 
    };
    const encoded = btoa(JSON.stringify(data));
    const baseUrl = window.location.href.split('?')[0];
    return `${baseUrl}?b=${encoded}`;
  }, [storeName, items, discountPercent, billId, customerPhone]);

  const handleShareLink = () => {
    const link = generateDeepLink();
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    const message = `Digital Invoice from *${storeName.toUpperCase()}*.%0A%0AView Bill: ${link}`;
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 font-mono text-sm shadow-xl w-full max-w-md rounded-xl border border-slate-200">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">{storeName}</h1>
            <p className="text-[10px] text-slate-400 border-b border-dashed py-2 mb-3">DIGITAL TAX INVOICE</p>
            <div className="flex justify-between text-[11px] font-bold">
              <span>BILL: {billId}</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
          </div>
          <div className="space-y-3 mb-8 min-h-[100px]">
            <div className="flex justify-between border-b border-slate-100 pb-1 text-[10px] font-bold uppercase text-slate-400">
              <span>Item</span>
              <span>Total</span>
            </div>
            {items.map((it, i) => (
              <div key={i} className="flex justify-between items-start leading-tight">
                <div className="flex flex-col">
                  <span className="font-bold">{it.name}</span>
                  <span className="text-[10px] text-slate-500">x{it.quantity} @ ₹{it.price.toFixed(2)}</span>
                </div>
                <span className="font-bold">₹{(it.price * it.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t-2 border-dashed pt-4 space-y-1">
            <div className="flex justify-between text-xs text-slate-600"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
            {discountPercent > 0 && <div className="flex justify-between text-xs text-emerald-600 font-bold"><span>Discount ({discountPercent}%)</span><span>-₹{discountAmount.toFixed(2)}</span></div>}
            <div className="flex justify-between text-xl font-black pt-2 text-slate-900">
              <span>GRAND TOTAL</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-10 uppercase tracking-widest">Thank you for visiting!</p>
          <Button variant="secondary" className="w-full mt-6" onClick={() => window.location.href = window.location.href.split('?')[0]}>Create New Invoice</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12 bg-[#f9fafb]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm px-4 md:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
            <FileSpreadsheet className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight hidden sm:block">BILLING STATION</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={clearLedger} className="rounded-full">
            <RefreshCcw className="w-4 h-4 mr-2" /> Reset Session
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input & Active Cart */}
        <div className="lg:col-span-5 space-y-6">
          {/* Customer Info */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Phone className="w-3 h-3" /> Billing Details
            </h2>
            <div className="space-y-3">
              <div className="group">
                <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Store Display Name</label>
                <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium" />
              </div>
              <div className="group">
                <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Customer Phone (WhatsApp)</label>
                <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium" placeholder="91XXXXXXXXXX" />
              </div>
            </div>
          </section>

          {/* Manual Item Entry */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <ShoppingBag className="w-3 h-3" /> Add Products
            </h2>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div className="space-y-3">
                <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium" placeholder="Product Name" />
                <div className="flex gap-3">
                  <div className="flex-1">
                    <input type="number" step="0.01" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium" placeholder="Price (₹)" />
                  </div>
                  <div className="w-24">
                    <input type="number" value={newItemQty} onChange={e => setNewItemQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-center" placeholder="Qty" />
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full py-4 rounded-xl shadow-md" disabled={!newItemName || !newItemPrice}>
                <Plus className="w-4 h-4 mr-2" /> Add to Cart
              </Button>
            </form>
          </section>

          {/* Active Bill List */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
             <div className="flex justify-between items-center">
               <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Bill</h2> 
               <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">#{billId}</span>
             </div>
             <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide">
                {items.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-2xl">
                    <p className="text-slate-300 text-sm font-medium italic">No items added yet</p>
                  </div>
                ) : items.map(it => (
                  <div key={it.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl group transition-all hover:bg-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate uppercase">{it.name}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{it.quantity} x ₹{it.price.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 text-sm">₹{(it.price * it.quantity).toFixed(2)}</p>
                    </div>
                    <button onClick={() => setItems(p => p.filter(x => x.id !== it.id))} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
             </div>
             {items.length > 0 && (
               <div className="pt-6 border-t border-slate-100 space-y-4">
                  {/* Discount Section */}
                  <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                        <Tag className="w-3 h-3" /> Apply Discount
                      </span>
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1 focus-within:ring-2 focus-within:ring-blue-500/20">
                        <input 
                          type="number" 
                          value={discountPercent || ''} 
                          onChange={e => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} 
                          className="w-12 text-right outline-none text-xs font-black bg-transparent" 
                          placeholder="0"
                        />
                        <span className="text-[10px] font-bold text-slate-400 ml-1">%</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {[0, 5, 10, 15, 20].map((val) => (
                        <button
                          key={val}
                          onClick={() => setDiscountPercent(val)}
                          className={`flex-1 py-1.5 text-[11px] font-black rounded-lg transition-all border ${
                            discountPercent === val 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                          }`}
                        >
                          {val === 0 ? 'NONE' : `${val}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 px-1">
                    <div className="flex justify-between text-xs text-slate-500 font-medium"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                    {discountPercent > 0 && <div className="flex justify-between text-xs text-emerald-600 font-bold"><span>Total Discount</span><span>-₹{discountAmount.toFixed(2)}</span></div>}
                  </div>

                  <div className="flex justify-between text-2xl font-black pt-3 border-t-2 border-slate-100 text-slate-900">
                    <span>TOTAL</span>
                    <span className="text-blue-600">₹{total.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <Button variant="secondary" onClick={() => setShowPreview(true)} className="rounded-xl"><Eye className="w-4 h-4 mr-2" /> Preview</Button>
                    <Button variant="success" onClick={finalizeAndSave} className="rounded-xl"><Save className="w-4 h-4 mr-2" /> Save & Log</Button>
                  </div>
               </div>
             )}
          </section>
        </div>

        {/* Right Column: Analytics & History */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl overflow-hidden relative border border-white/5">
             <div className="absolute -top-10 -right-10 p-12 opacity-5 rotate-12 bg-white rounded-full">
               <TrendingUp className="w-48 h-48" />
             </div>
             <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
               <History className="w-4 h-4" /> Daily Ledger Analytics
             </h2>
             <div className="grid grid-cols-3 gap-8">
                <div className="space-y-1">
                   <p className="text-[10px] font-bold text-slate-500 uppercase">Gross Sales</p>
                   <p className="text-2xl font-black tracking-tight">₹{ledgerSummary.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-bold text-slate-500 uppercase">Discounting</p>
                   <p className="text-2xl font-black tracking-tight text-red-400">-₹{ledgerSummary.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-bold text-slate-500 uppercase">Net Income</p>
                   <p className="text-2xl font-black tracking-tight text-emerald-400">₹{ledgerSummary.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
             </div>
             <div className="mt-10 flex flex-col sm:flex-row items-center justify-between border-t border-white/10 pt-6 gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 px-4 py-2 rounded-full border border-white/5">
                    <p className="text-xs font-bold text-slate-300">{ledgerSummary.count} Transactions Completed</p>
                  </div>
                </div>
                <Button variant="primary" size="sm" onClick={copyFullLedger} className="bg-blue-500 hover:bg-blue-400 px-6 py-5 text-xs rounded-xl shadow-xl shadow-blue-500/20 font-black">
                  {copyStatus === 'copied' ? 'COPIED TO CLIPBOARD' : 'EXPORT DAILY LOG (TSV)'}
                </Button>
             </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Master Transaction Journal</h2>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[9px] text-slate-400 font-black tracking-tighter">LIVE SESSION</span>
                </div>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                      <tr>
                         <th className="px-6 py-4">Ref. ID</th>
                         <th className="px-6 py-4">Time</th>
                         <th className="px-6 py-4">Customer</th>
                         <th className="px-6 py-4 text-right">Settled Amt</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {dailyLedger.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-20 text-center text-slate-300 italic text-sm font-medium">Session is currently empty</td></tr>
                      ) : dailyLedger.map(entry => (
                        <tr key={entry.id} className="hover:bg-slate-50 transition-colors group">
                           <td className="px-6 py-4 font-mono text-[11px] font-bold text-blue-600">#{entry.id}</td>
                           <td className="px-6 py-4 text-[11px] font-bold text-slate-500">{entry.time}</td>
                           <td className="px-6 py-4 font-bold text-slate-800 text-xs uppercase">{entry.customer}</td>
                           <td className="px-6 py-4 text-right font-black text-slate-900 text-xs">₹{entry.total.toFixed(2)}</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </section>
        </div>
      </main>

      {/* Sharing Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md transition-all duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Invoice Preview</h3>
              <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 bg-slate-100/50 p-6 flex items-start justify-center">
              <div ref={receiptRef} className="bg-white p-10 font-mono text-sm shadow-xl w-full rounded-2xl border border-slate-200" style={{ maxWidth: '380px' }}>
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-1">{storeName}</h1>
                  <p className="text-[10px] text-slate-400 font-bold border-y border-dashed py-2 my-4 italic tracking-[0.2em]">OFFICIAL ELECTRONIC RECEIPT</p>
                  <div className="flex justify-between text-[11px] font-bold px-1">
                    <span>BILL NO: {billId}</span>
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between border-b-2 border-slate-100 pb-2 font-black text-[10px] uppercase text-slate-400">
                    <span>Particulars</span>
                    <span className="text-right">Settled</span>
                  </div>
                  {items.map((it, i) => (
                    <div key={i} className="flex justify-between items-start leading-tight">
                      <div className="flex flex-col pr-4">
                        <span className="font-black text-slate-800 uppercase">{it.name}</span>
                        <span className="text-[10px] text-slate-400 font-bold">Qty: {it.quantity} @ ₹{it.price.toFixed(2)}</span>
                      </div>
                      <span className="font-black text-slate-900">₹{(it.price * it.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t-4 border-double border-slate-200 pt-6 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500"><span>SUBTOTAL</span><span>₹{subtotal.toFixed(2)}</span></div>
                  {discountPercent > 0 && <div className="flex justify-between text-xs text-emerald-600 font-black"><span>DISCOUNT ({discountPercent}%)</span><span>-₹{discountAmount.toFixed(2)}</span></div>}
                  <div className="flex justify-between text-2xl font-black border-t-2 border-slate-900 pt-4 text-slate-900">
                    <span>TOTAL</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                </div>
                <div className="mt-12 text-center">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">E&OE • THANK YOU</p>
                </div>
              </div>
            </div>
            <div className="p-6 bg-white border-t border-slate-100 grid grid-cols-2 gap-4">
              <Button variant="secondary" className="w-full py-4 rounded-2xl" onClick={handleShareReceipt} disabled={isSharing}>
                <Share2 className="w-4 h-4 mr-2" /> Save Image
              </Button>
              <Button variant="success" className="w-full py-4 rounded-2xl shadow-lg shadow-emerald-200" onClick={handleShareLink}>
                <LinkIcon className="w-4 h-4 mr-2" /> Send via WA
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
