
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Plus, Trash2, Send, Copy, RefreshCcw, FileSpreadsheet, Phone, Eye, X, Download, Share2, Percent, Link as LinkIcon, Save, History, TrendingUp, ShoppingBag, Tag, Calculator, CheckCircle2 } from 'lucide-react';
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
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [textBillCopyStatus, setTextBillCopyStatus] = useState(false);
  const [billId, setBillId] = useState(`TSL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  
  // Manual Entry Form State
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState<string>('');
  const [newItemQty, setNewItemQty] = useState<number>(1);
  const [newItemDiscount, setNewItemDiscount] = useState<number>(0);

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
          setGlobalDiscountPercent(decoded.gd || 0);
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
  const subtotalBeforeDiscounts = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [items]);

  const itemsDiscountAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity * (item.discount / 100)), 0);
  }, [items]);

  const subtotalAfterItemDiscounts = useMemo(() => {
    return subtotalBeforeDiscounts - itemsDiscountAmount;
  }, [subtotalBeforeDiscounts, itemsDiscountAmount]);

  const globalDiscountAmount = useMemo(() => {
    return (subtotalAfterItemDiscounts * globalDiscountPercent) / 100;
  }, [subtotalAfterItemDiscounts, globalDiscountPercent]);

  const finalTotal = useMemo(() => {
    return Math.max(0, subtotalAfterItemDiscounts - globalDiscountAmount);
  }, [subtotalAfterItemDiscounts, globalDiscountAmount]);

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
      quantity: newItemQty || 1,
      discount: newItemDiscount || 0
    };

    setItems(prev => [...prev, item]);
    setNewItemName('');
    setNewItemPrice('');
    setNewItemQty(1);
    setNewItemDiscount(0);
  };

  const finalizeAndSave = () => {
    if (items.length === 0) return;
    
    const entry: LogEntry = {
      id: billId,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customer: customerPhone || 'Walk-in Customer',
      items: items.map(it => `${it.name}(x${it.quantity})`).join(', '),
      subtotal: subtotalBeforeDiscounts,
      discount: itemsDiscountAmount + globalDiscountAmount,
      total: finalTotal
    };

    setDailyLedger(prev => [entry, ...prev]);
    setItems([]);
    setCustomerPhone('');
    setGlobalDiscountPercent(0);
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
      i: items.map(it => ({ name: it.name, price: it.price, quantity: it.quantity, d: it.discount })), 
      gd: globalDiscountPercent, 
      id: billId, 
      p: customerPhone 
    };
    const encoded = btoa(JSON.stringify(data));
    const baseUrl = window.location.href.split('?')[0];
    return `${baseUrl}?b=${encoded}`;
  }, [storeName, items, globalDiscountPercent, billId, customerPhone]);

  const getBillText = useCallback((isEncoded = false) => {
    const link = generateDeepLink();
    const itemsText = items.map(it => {
      const discountedPrice = it.price * (1 - it.discount / 100);
      return `• ${it.name} (x${it.quantity}) @ ₹${discountedPrice.toFixed(2)}${it.discount > 0 ? ` [${it.discount}% OFF]` : ''}`;
    }).join(isEncoded ? '%0A' : '\n');
    
    const totalDiscount = itemsDiscountAmount + globalDiscountAmount;
    const divider = isEncoded ? '--------------------' : '--------------------';
    const nl = isEncoded ? '%0A' : '\n';
    
    return `Invoice from *${storeName.toUpperCase()}*${nl}${divider}${nl}*Bill ID:* ${billId}${nl}*Date:* ${new Date().toLocaleDateString()}${nl}${nl}*Items:*${nl}${itemsText}${nl}${divider}${nl}*Gross Amount:* ₹${subtotalBeforeDiscounts.toFixed(2)}${nl}*Total Savings:* ₹${totalDiscount.toFixed(2)}${nl}*FINAL PAYABLE:* ₹${finalTotal.toFixed(2)}${nl}${divider}${nl}View Digital Receipt:${nl}${link}${nl}${nl}Thank you for shopping with us!`;
  }, [storeName, items, billId, subtotalBeforeDiscounts, itemsDiscountAmount, globalDiscountAmount, finalTotal, generateDeepLink]);

  const handleShareLink = () => {
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    const message = getBillText(true);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const handleCopyTextBill = () => {
    navigator.clipboard.writeText(getBillText(false));
    setTextBillCopyStatus(true);
    setTimeout(() => setTextBillCopyStatus(false), 2000);
  };

  const handleShareReceipt = async () => {
    if (!receiptRef.current) return;
    setIsSharing(true);
    try {
      const canvas = await html2canvas(receiptRef.current, { scale: 2 });
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
      if (blob) {
        const file = new File([blob], `Bill-${billId}.png`, { type: 'image/png' });
        if (navigator.share) {
          await navigator.share({ 
            files: [file],
            title: `Bill from ${storeName}`,
            text: `Invoice #${billId}`
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Bill-${billId}.png`;
          a.click();
        }
      }
    } catch (e) { 
      console.error(e);
      alert("Sharing failed. Please try saving manually."); 
    }
    finally { setIsSharing(false); }
  };

  if (isGuestMode) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 font-mono text-sm shadow-xl w-full max-w-md rounded-xl border border-slate-200">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">{storeName}</h1>
            <p className="text-[10px] text-slate-400 border-b border-dashed py-2 mb-3 uppercase font-bold tracking-widest">Digital Tax Invoice</p>
            <div className="flex justify-between text-[11px] font-bold">
              <span>BILL: {billId}</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
          </div>
          <div className="space-y-4 mb-8 min-h-[100px]">
            <div className="flex justify-between border-b border-slate-100 pb-1 text-[10px] font-bold uppercase text-slate-400">
              <span>Item</span>
              <span>Total</span>
            </div>
            {items.map((it, i) => {
              const discountedTotal = (it.price * it.quantity) * (1 - it.discount / 100);
              return (
                <div key={i} className="flex justify-between items-start leading-tight">
                  <div className="flex flex-col">
                    <span className="font-bold">{it.name}</span>
                    <span className="text-[10px] text-slate-500">
                      x{it.quantity} @ ₹{it.price.toFixed(2)}
                      {it.discount > 0 && <span className="text-emerald-600 ml-1">(-{it.discount}%)</span>}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">₹{discountedTotal.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t-2 border-dashed pt-4 space-y-1">
            <div className="flex justify-between text-xs text-slate-600"><span>Subtotal</span><span>₹{subtotalBeforeDiscounts.toFixed(2)}</span></div>
            {(itemsDiscountAmount + globalDiscountAmount) > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 font-bold">
                <span>Total Discount</span>
                <span>-₹{(itemsDiscountAmount + globalDiscountAmount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-black pt-2 text-slate-900">
              <span>GRAND TOTAL</span>
              <span>₹{finalTotal.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-10 uppercase tracking-widest font-black">Thank you for visiting!</p>
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
          <Button variant="secondary" size="sm" onClick={clearLedger} className="rounded-full shadow-sm">
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Price (₹)</label>
                    <input type="number" step="0.01" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium" placeholder="0.00" />
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Qty</label>
                    <input type="number" value={newItemQty} onChange={e => setNewItemQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-center" placeholder="1" />
                  </div>
                </div>
                {/* Per-Item Discount Section */}
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-2">
                   <div className="flex justify-between items-center">
                     <span className="flex items-center gap-1.5 text-blue-700 text-[10px] font-black uppercase tracking-wider">
                       <Percent className="w-3 h-3" /> Item Discount
                     </span>
                     <div className="flex items-center bg-white border border-blue-200 rounded-lg px-2 py-1 focus-within:ring-2 focus-within:ring-blue-500/20">
                        <input 
                          type="number" 
                          value={newItemDiscount || ''} 
                          onChange={e => setNewItemDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} 
                          className="w-12 text-right outline-none text-xs font-black bg-transparent" 
                          placeholder="0"
                        />
                        <span className="text-[10px] font-bold text-blue-400 ml-1">%</span>
                      </div>
                   </div>
                   <div className="flex gap-1.5">
                      {[0, 5, 10, 15, 25, 50].map(v => (
                        <button key={v} type="button" onClick={() => setNewItemDiscount(v)} className={`flex-1 py-1 text-[10px] font-black rounded-md transition-all border ${newItemDiscount === v ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-blue-100 text-blue-600 hover:border-blue-300'}`}>
                          {v}%
                        </button>
                      ))}
                   </div>
                </div>
              </div>
              <Button type="submit" className="w-full py-4 rounded-xl shadow-lg shadow-blue-100 font-black tracking-widest uppercase" disabled={!newItemName || !newItemPrice}>
                <Plus className="w-4 h-4 mr-2" /> Add to Cart
              </Button>
            </form>
          </section>

          {/* Active Bill List */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
             <div className="flex justify-between items-center">
               <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Current Bill</h2> 
               <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">ID: {billId}</span>
             </div>
             <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-hide">
                {items.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
                    <ShoppingBag className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-300 text-xs font-bold uppercase tracking-widest">Cart is empty</p>
                  </div>
                ) : items.map(it => {
                  const grossPrice = it.price * it.quantity;
                  const discount = grossPrice * (it.discount / 100);
                  const netPrice = grossPrice - discount;
                  return (
                    <div key={it.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl group transition-all hover:bg-slate-100 border border-slate-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-slate-800 text-xs truncate uppercase tracking-tight">{it.name}</p>
                          {it.discount > 0 && <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">-{it.discount}%</span>}
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">
                          {it.quantity} x ₹{it.price.toFixed(2)}
                          {it.discount > 0 && <span className="text-slate-300 line-through ml-2">₹{grossPrice.toFixed(2)}</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-900 text-sm">₹{netPrice.toFixed(2)}</p>
                      </div>
                      <button onClick={() => setItems(p => p.filter(x => x.id !== it.id))} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
             </div>
             {items.length > 0 && (
               <div className="pt-6 border-t border-slate-100 space-y-4">
                  {/* Global Discount Section */}
                  <div className="bg-slate-900 p-4 rounded-xl space-y-3 border border-slate-800 shadow-xl">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                        <Tag className="w-3 h-3" /> Extra Store Discount
                      </span>
                      <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
                        <input 
                          type="number" 
                          value={globalDiscountPercent || ''} 
                          onChange={e => setGlobalDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} 
                          className="w-12 text-right outline-none text-xs font-black bg-transparent text-white" 
                          placeholder="0"
                        />
                        <span className="text-[10px] font-bold text-slate-500 ml-1">%</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {[0, 5, 10, 15, 20].map((val) => (
                        <button
                          key={val}
                          onClick={() => setGlobalDiscountPercent(val)}
                          className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all border ${
                            globalDiscountPercent === val 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-900' 
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          {val === 0 ? 'OFF' : `${val}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 px-1">
                    <div className="flex justify-between text-[11px] text-slate-400 font-bold uppercase tracking-tight"><span>Subtotal (Gross)</span><span>₹{subtotalBeforeDiscounts.toFixed(2)}</span></div>
                    {(itemsDiscountAmount + globalDiscountAmount) > 0 && (
                      <div className="flex justify-between text-[11px] text-emerald-600 font-black uppercase tracking-tight">
                        <span>Savings Today</span>
                        <span>-₹{(itemsDiscountAmount + globalDiscountAmount).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between text-3xl font-black pt-3 border-t-2 border-slate-100 text-slate-900">
                    <span className="text-sm self-center text-slate-400 uppercase tracking-tighter mr-2">Net Payable</span>
                    <span className="text-blue-600 font-black">₹{finalTotal.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <Button variant="secondary" onClick={() => setShowPreview(true)} className="rounded-xl py-3 border border-slate-200"><Eye className="w-4 h-4 mr-2" /> Preview</Button>
                    <Button variant="success" onClick={finalizeAndSave} className="rounded-xl py-3 shadow-lg shadow-emerald-100 font-black"><Save className="w-4 h-4 mr-2" /> Complete Bill</Button>
                  </div>
               </div>
             )}
          </section>
        </div>

        {/* Right Column: Analytics & History */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-12 opacity-[0.03] -mr-10 -mt-10">
               <Calculator className="w-40 h-40 text-slate-900" />
             </div>
             <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
               <History className="w-4 h-4" /> Performance Metrics
             </h2>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Gross Sales</p>
                   <p className="text-2xl font-black text-slate-800 tracking-tight">₹{ledgerSummary.subtotal.toLocaleString('en-IN')}</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                   <p className="text-[10px] font-black text-emerald-600/60 uppercase mb-1">Net Income</p>
                   <p className="text-2xl font-black text-emerald-700 tracking-tight">₹{ledgerSummary.total.toLocaleString('en-IN')}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                   <p className="text-[10px] font-black text-blue-600/60 uppercase mb-1">Total Bills</p>
                   <p className="text-2xl font-black text-blue-700 tracking-tight">{ledgerSummary.count}</p>
                </div>
             </div>
             <div className="mt-8 flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-6 gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Digital Audit Log</span>
                </div>
                <Button variant="primary" size="sm" onClick={copyFullLedger} className="bg-slate-900 hover:bg-black text-white px-6 py-5 text-[10px] rounded-xl font-black tracking-widest uppercase">
                  {copyStatus === 'copied' ? 'SAVED TO CLIPBOARD' : 'EXPORT DATA FOR EXCEL'}
                </Button>
             </div>
          </section>

          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Transaction Registry</h2>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[9px] text-slate-400 font-black tracking-tighter uppercase">Sync Enabled</span>
                </div>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                      <tr>
                         <th className="px-8 py-5">Ref ID</th>
                         <th className="px-8 py-5">Time</th>
                         <th className="px-8 py-5">Customer</th>
                         <th className="px-8 py-5 text-right">Settled Amount</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {dailyLedger.length === 0 ? (
                        <tr><td colSpan={4} className="px-8 py-24 text-center text-slate-300 italic text-xs font-bold uppercase tracking-widest">No entries found for today</td></tr>
                      ) : dailyLedger.map(entry => (
                        <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors group">
                           <td className="px-8 py-5 font-mono text-[10px] font-black text-blue-600">#{entry.id}</td>
                           <td className="px-8 py-5 text-[11px] font-bold text-slate-500 uppercase">{entry.time}</td>
                           <td className="px-8 py-5 font-black text-slate-900 text-xs uppercase tracking-tight">{entry.customer}</td>
                           <td className="px-8 py-5 text-right font-black text-slate-900 text-sm">₹{entry.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/10">
            <div className="flex items-center justify-between p-7 border-b border-slate-100">
              <div className="flex flex-col">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] leading-tight">Digital E-Bill</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Secure Invoice Preview</span>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all group">
                <X className="w-6 h-6 text-slate-400 group-hover:text-slate-900" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 bg-slate-50 p-8 flex items-start justify-center relative">
              <div ref={receiptRef} className="bg-white p-10 font-mono text-sm shadow-xl w-full rounded-2xl border border-slate-200" style={{ maxWidth: '380px' }}>
                <div className="text-center mb-10">
                  <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-1">{storeName}</h1>
                  <p className="text-[9px] text-slate-400 font-black border-y-2 border-slate-900 py-3 my-5 uppercase tracking-[0.3em]">GST Compliant E-Receipt</p>
                  <div className="flex justify-between text-[11px] font-black px-1 text-slate-600">
                    <span>BILL: {billId}</span>
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="space-y-4 mb-10">
                  <div className="flex justify-between border-b-2 border-slate-900 pb-2 font-black text-[10px] uppercase text-slate-900">
                    <span>Particulars</span>
                    <span className="text-right">Net Amt</span>
                  </div>
                  {items.map((it, i) => {
                    const discountedNet = (it.price * it.quantity) * (1 - it.discount / 100);
                    return (
                      <div key={i} className="flex justify-between items-start leading-tight">
                        <div className="flex flex-col pr-4">
                          <span className="font-black text-slate-800 uppercase text-xs">{it.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            Qty {it.quantity} @ ₹{it.price.toFixed(2)}
                            {it.discount > 0 && <span className="text-emerald-600 ml-1">(-{it.discount}%)</span>}
                          </span>
                        </div>
                        <span className="font-black text-slate-900">₹{discountedNet.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t-4 border-double border-slate-900 pt-8 space-y-2">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase"><span>Subtotal (Gross)</span><span>₹{subtotalBeforeDiscounts.toFixed(2)}</span></div>
                  {(itemsDiscountAmount + globalDiscountAmount) > 0 && (
                    <div className="flex justify-between text-[11px] text-emerald-600 font-black uppercase">
                      <span>Total Savings</span>
                      <span>-₹{(itemsDiscountAmount + globalDiscountAmount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-2xl font-black border-t-2 border-slate-900 pt-5 text-slate-900">
                    <span className="text-sm self-center uppercase tracking-tighter">Total Due</span>
                    <span>₹{finalTotal.toFixed(2)}</span>
                  </div>
                </div>
                <div className="mt-14 text-center">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.5em]">Visit Again • E&OE</p>
                </div>
              </div>
            </div>
            <div className="p-8 bg-white border-t border-slate-100 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button variant="secondary" className="w-full py-5 rounded-2xl border-2 border-slate-100 font-black text-xs uppercase tracking-widest" onClick={handleShareReceipt} disabled={isSharing}>
                  <Share2 className="w-4 h-4 mr-2" /> Share Image
                </Button>
                <Button variant="success" className="w-full py-5 rounded-2xl shadow-xl shadow-emerald-200 font-black text-xs uppercase tracking-widest" onClick={handleShareLink}>
                  <LinkIcon className="w-4 h-4 mr-2" /> Send via WA
                </Button>
              </div>
              <button 
                onClick={handleCopyTextBill}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all"
              >
                {textBillCopyStatus ? (
                  <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Bill Copied to Clipboard</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /> Copy Bill as Text</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
