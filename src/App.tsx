import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, deleteDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import ClerkView from './components/ClerkView';
import ManagerView from './components/ManagerView';
import { Coins, ShieldCheck, Sparkles, Coffee, Clock, Calendar } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'clerk' | 'manager'>('clerk');
  const [jerkyRate, setJerkyRate] = useState<number>(24000); // Default exchange rate
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [systemTime, setSystemTime] = useState(new Date());

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = systemTime.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long'
  }) + ' ' + systemTime.toLocaleTimeString('zh-TW', { hour12: false });

  // Auto-seed requested clerks and auto-deduplicate any duplicates in real-time
  useEffect(() => {
    const seedAndDeduplicateClerks = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'clerks'));
        
        // Group clerk documents by their name
        const clerkGroups: { [name: string]: { id: string; data: any }[] } = {};
        
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.name) {
            const normalizedName = data.name.trim();
            if (!clerkGroups[normalizedName]) {
              clerkGroups[normalizedName] = [];
            }
            clerkGroups[normalizedName].push({
              id: docSnap.id,
              data: data
            });
          }
        });

        // 1. DEDUPLICATE: If any name has multiple documents, keep only one best record and delete the rest!
        for (const [name, docs] of Object.entries(clerkGroups)) {
          if (docs.length > 1) {
            console.log(`Found duplicate clerks for "${name}":`, docs.map(d => d.id));
            // Find the best document to keep: prefer the one with a password, or the oldest one
            const sortedDocs = [...docs].sort((a, b) => {
              // Primary sort: Has password first
              const aHasPassword = a.data.password ? 1 : 0;
              const bHasPassword = b.data.password ? 1 : 0;
              if (aHasPassword !== bHasPassword) {
                return bHasPassword - aHasPassword; // Descending (has password first)
              }
              // Secondary sort: Oldest createdAt
              const aTime = a.data.createdAt?.seconds || Infinity;
              const bTime = b.data.createdAt?.seconds || Infinity;
              return aTime - bTime;
            });

            const keepDoc = sortedDocs[0];
            const deleteDocsList = sortedDocs.slice(1);

            for (const dDoc of deleteDocsList) {
              await deleteDoc(doc(db, 'clerks', dDoc.id));
              console.log(`Deleted duplicate clerk doc ${dDoc.id} for name "${name}"`);
            }

            // Update clerkGroups collection reference so seeding knows it exists
            clerkGroups[name] = [keepDoc];
          }
        }

        // 2. SEED: Only seed core default clerks if the database is COMPLETELY empty.
        // This ensures if administrators delete anyone from the roster, they stay successfully deleted.
        if (querySnapshot.empty) {
          const targetClerks = ["曜恆", "托托", "尤里", "凱文", "墨雲", "龍炎", "法珀爾", "閻羅"];
          for (const name of targetClerks) {
            const cleanNameForId = name.replace(/\s+/g, '_');
            const clerkId = `clerk_seed_${cleanNameForId}`;
            
            await setDoc(doc(db, 'clerks', clerkId), {
              id: clerkId,
              name: name,
              createdAt: serverTimestamp()
            });
            console.log(`Auto-seeded missing clerk deterministically: "${name}" as ID "${clerkId}"`);
          }
        }
      } catch (err) {
        console.warn("Seeding or deduplicating clerks was skipped or failed.", err);
      }
    };
    seedAndDeduplicateClerks();
  }, []);

  // Synchronize global Meat Jerky exchange rate config in real-time
  useEffect(() => {
    const docRef = doc(db, 'settings', 'config');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && typeof data.jerkyRate === 'number') {
          setJerkyRate(data.jerkyRate);
        }
      } else {
        // Safe initialize if document does not exist yet (first-run setup)
        setDoc(docRef, { jerkyRate: 24000 }).catch(err => {
          console.warn("Initializing settings config failed. This is expected if secure write rules block it.", err);
        });
      }
      setLoadingConfig(false);
    }, (error) => {
      // Log connection warnings but continue with local standard constant (24,000)
      console.warn("Settings fetch failed or was blocked by standard rule permission checks.", error);
      setLoadingConfig(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-[#08120e] text-gray-100 flex flex-col font-sans" id="app_root">
      
      {/* Immersive Top Brand Banner */}
      <header className="min-h-[5rem] py-4 border-b border-emerald-950/40 flex items-center justify-between px-6 sm:px-10 bg-[#10241b] sticky top-0 z-40" id="app_header">
        <div className="max-w-7xl w-full mx-auto flex flex-col md:flex-row items-center justify-between gap-4" id="app_header_container">
          
          <div className="flex items-center gap-3" id="app_logo_title">
            <div className="w-10 h-10 rounded-full bg-lime-500/10 border border-lime-500/30 flex items-center justify-center text-lime-400 font-bold" id="logo_box">
              <Coffee className="w-5 h-5 text-lime-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-lime-400 font-sans">
                  龍舌蘭咖啡廳 <span className="text-white font-light text-sm sm:text-base">發薪系統 🍹</span>
                </h1>
                <span className="text-[10px] font-bold bg-lime-500/20 text-lime-300 border border-lime-500/40 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-lime-400" />
                  Tequila v2.7
                </span>
              </div>
              <p className="text-[10px] text-emerald-500 uppercase tracking-widest mt-0.5">
                Official Maguey Cafe Portal
              </p>
            </div>
          </div>

          {/* Real-time System clock */}
          <div className="flex flex-col items-center md:items-end font-mono text-xs text-center md:text-right" id="header_clock">
            <div className="text-lime-400 font-bold tracking-wider flex items-center gap-1.5 bg-[#08120e] border border-emerald-950/65 px-3 py-1.5 rounded-lg shadow-md shadow-emerald-950/30">
              <Clock className="w-3.5 h-3.5 text-lime-400 animate-spin" style={{ animationDuration: '10s' }} />
              <span>{formattedTime}</span>
            </div>
            <span className="text-[9px] text-[#2c5b44] mt-1 uppercase tracking-widest font-black">Tequila Real-Time Portal · 暖心微醺</span>
          </div>

          {/* Navigation Toggle Option Bar */}
          <div className="flex bg-[#08120e] p-1.5 rounded-xl border border-emerald-950/50 shadow-inner" id="nav_tabs_holder">
            <button
              onClick={() => setActiveTab('clerk')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === 'clerk'
                  ? 'bg-[#142d20] text-lime-400 border border-emerald-800/25 shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              id="tab_btn_clerk"
            >
              <Coffee className="w-3.5 h-3.5" />
              店員薪水申報
            </button>
            <button
              onClick={() => setActiveTab('manager')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === 'manager'
                  ? 'bg-[#142d20] text-lime-400 border border-emerald-800/25 shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              id="tab_btn_manager"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              管理組後台
            </button>
          </div>

        </div>
      </header>

      {/* Main Responsive Canvas Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8" id="app_main">
        {loadingConfig ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4" id="global_loader">
            <div className="w-10 h-10 border-4 border-lime-500/20 border-t-lime-400 rounded-full animate-spin"></div>
            <p className="text-xs text-emerald-400 font-mono tracking-widest uppercase">連線至 龍舌蘭咖啡廳 薪資資料庫...</p>
          </div>
        ) : (
          <div className="transition-all duration-300" id="active_workspace">
            {activeTab === 'clerk' ? (
              <ClerkView jerkyRate={jerkyRate} />
            ) : (
              <ManagerView jerkyRate={jerkyRate} setJerkyRate={setJerkyRate} />
            )}
          </div>
        )}
      </main>

      {/* Humble & Elegant Footer */}
      <footer className="py-6 px-6 border-t border-emerald-950/40 bg-[#08120e] text-center text-[10px] text-emerald-600 uppercase tracking-widest font-mono" id="app_footer">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4" id="app_footer_container">
          <span>System Node: 0x4829A-TEQUILA</span>
          <span>&copy; 2026 Tequila Cafe Co. 🍹 All Rights Reserved</span>
          <span className="font-mono">
            1 肉乾 ＝ <span className="text-lime-400 font-bold">${jerkyRate.toLocaleString()}</span> 元 | Stable Connection
          </span>
        </div>
      </footer>

    </div>
  );
}
