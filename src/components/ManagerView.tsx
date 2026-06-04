import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { PayrollEntry, Clerk } from '../types';
import { 
  ShieldCheck, 
  TrendingUp, 
  DollarSign, 
  CheckSquare, 
  Square, 
  Trash2, 
  Sparkles, 
  LogIn, 
  LogOut, 
  AlertCircle, 
  RefreshCw, 
  Sliders, 
  UserPlus, 
  Activity,
  Award,
  CircleAlert
} from 'lucide-react';

interface ManagerViewProps {
  jerkyRate: number;
  setJerkyRate: (rate: number) => void;
}

export default function ManagerView({ jerkyRate, setJerkyRate }: ManagerViewProps) {
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    return sessionStorage.getItem('tequila_admin_authed') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [clerks, setClerks] = useState<Clerk[]>([]);
  const [newClerkName, setNewClerkName] = useState('');
  const [newRateInput, setNewRateInput] = useState<string>(String(jerkyRate));
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Default supervisor password: "1234"
  const ADMIN_PASSWORD = "1234";

  // 2. Synchronize all database records once admin mode is activated
  useEffect(() => {
    if (!isAdminMode) {
      setEntries([]);
      setClerks([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    // Listens to payrollEntries
    const entriesRef = collection(db, 'payrollEntries');
    const qEntries = query(entriesRef, orderBy('createdAt', 'desc'));
    const unsubscribeEntries = onSnapshot(qEntries, (snapshot) => {
      const items: PayrollEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          clerkName: data.clerkName,
          meatJerkyCount: data.meatJerkyCount,
          salaryRate: data.salaryRate,
          totalSalary: data.totalSalary,
          isVerified: data.isVerified,
          isPaid: data.isPaid,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });
      // Additional client safety fallback sort for local updates before server timestamp propagates
      items.sort((a, b) => {
        const dateA = a.createdAt?.seconds || Date.now() / 1000;
        const dateB = b.createdAt?.seconds || Date.now() / 1000;
        return dateB - dateA;
      });
      setEntries(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'payrollEntries');
    });

    // Listens to clerks
    const clerksRef = collection(db, 'clerks');
    const qClerks = query(clerksRef, orderBy('name', 'asc'));
    const unsubscribeClerks = onSnapshot(qClerks, (snapshot) => {
      const items: Clerk[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          name: data.name,
          createdAt: data.createdAt,
        });
      });
      setClerks(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clerks');
    });

    return () => {
      unsubscribeEntries();
      unsubscribeClerks();
    };
  }, [isAdminMode]);

  // Sync jerkyRate config when it changes in parent configuration
  useEffect(() => {
    setNewRateInput(String(jerkyRate));
  }, [jerkyRate]);

  // Handlers for Password Login
  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === ADMIN_PASSWORD) {
      sessionStorage.setItem('tequila_admin_authed', 'true');
      setIsAdminMode(true);
      setNotification({ type: 'success', text: '主管登入成功！已成功進入管理與出納後台控制端。' });
    } else {
      setNotification({ type: 'error', text: '主管金鑰密碼錯誤，請輸入正確密碼重試！' });
    }
    setPinInput('');
  };

  const handleLogOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
    sessionStorage.removeItem('tequila_admin_authed');
    setIsAdminMode(false);
    setNotification({ type: 'success', text: '主管已成功登出系統後台。' });
  };

  // 1. 核對回收肉乾 (Toggle isVerified)
  const handleToggleVerify = async (entry: PayrollEntry) => {
    const nextVerified = !entry.isVerified;
    
    // Safety check: Cannot un-verify if already paid out
    if (!nextVerified && entry.isPaid) {
      setNotification({ type: 'error', text: '該筆交易已完成發薪，不得撤回肉乾核對！' });
      return;
    }

    try {
      const docRef = doc(db, 'payrollEntries', entry.id);
      await updateDoc(docRef, {
        isVerified: nextVerified,
        updatedAt: serverTimestamp()
      });
      setNotification({ 
        type: 'success', 
        text: nextVerified ? `已成功回收「${entry.clerkName}」的 ${entry.meatJerkyCount} 個肉乾，準備進行撥款！` : `已取消「${entry.clerkName}」的核對。`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payrollEntries/${entry.id}`);
    }
  };

  // 2. 交易發薪水 (Toggle isPaid)
  const handleTogglePaid = async (entry: PayrollEntry) => {
    // Business rule: MUST recycle/verify first
    if (!entry.isVerified) {
      setNotification({ type: 'error', text: '請先勾選核對並回收肉乾，才能進行發薪交易！' });
      return;
    }

    const nextPaid = !entry.isPaid;

    try {
      const docRef = doc(db, 'payrollEntries', entry.id);
      await updateDoc(docRef, {
        isPaid: nextPaid,
        updatedAt: serverTimestamp()
      });
      setNotification({ 
        type: 'success', 
        text: nextPaid ? `已成功發薪 $${entry.totalSalary.toLocaleString()} 元給店員「${entry.clerkName}」！` : `已重設「${entry.clerkName}」的發薪交易。`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payrollEntries/${entry.id}`);
    }
  };

  // Delete log entry
  const handleDeleteEntry = async (id: string, clerkName: string) => {
    if (!window.confirm(`確定要刪除店員「${clerkName}」的這筆薪水申請紀錄嗎？`)) {
      return;
    }
    try {
      const docRef = doc(db, 'payrollEntries', id);
      await deleteDoc(docRef);
      setNotification({ type: 'success', text: `已成功刪除該筆薪酬紀錄。` });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `payrollEntries/${id}`);
    }
  };

  // Change salary interchange jerkyRate config in settings/config
  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = Number(newRateInput);
    if (isNaN(rateNum) || rateNum <= 0) {
      setNotification({ type: 'error', text: '請輸入有效的正整數！' });
      return;
    }
    try {
      await setDoc(doc(db, 'settings', 'config'), {
        jerkyRate: rateNum
      });
      setJerkyRate(rateNum);
      setNotification({ type: 'success', text: `成功將 1 肉乾換算匯率調改為 $${rateNum.toLocaleString()} 元。` });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/config');
    }
  };

  // Add Clerk from backend
  const handleAddClerk = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newClerkName.trim();
    if (!cleanName) return;

    if (clerks.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
      setNotification({ type: 'error', text: `店員「${cleanName}」已在花名冊內！` });
      return;
    }
    try {
      const clerkId = `clerk_${Date.now()}`;
      await setDoc(doc(db, 'clerks', clerkId), {
        id: clerkId,
        name: cleanName,
        createdAt: serverTimestamp()
      });
      setNewClerkName('');
      setNotification({ type: 'success', text: `已將「${cleanName}」新增至店員花名冊。` });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'clerks');
    }
  };

  // Delete clerk from roster
  const handleDeleteClerk = async (id: string, name: string) => {
    if (!window.confirm(`確定要將「${name}」從店員名單中移除嗎？`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'clerks', id));
      setNotification({ type: 'success', text: `店員「${name}」已除名。` });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `clerks/${id}`);
    }
  };

  // Calculate statistics across active entries
  const totalJerky = entries.reduce((acc, curr) => acc + curr.meatJerkyCount, 0);
  const verifiedCount = entries.filter(e => e.isVerified).reduce((acc, curr) => acc + curr.meatJerkyCount, 0);
  const pendingVerifyCount = entries.filter(e => !e.isVerified).reduce((acc, curr) => acc + curr.meatJerkyCount, 0);
  
  const totalPaidMoney = entries.filter(e => e.isPaid).reduce((acc, curr) => acc + curr.totalSalary, 0);
  const pendingPaidMoney = entries.filter(e => !e.isPaid).reduce((acc, curr) => acc + curr.totalSalary, 0);

  // Auto-hide alerts
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className="space-y-6" id="manager_view_root">
      
      {/* Toast Banner */}
      {notification && (
        <div className={`p-4 rounded-xl text-sm border flex items-center justify-between shadow-lg transition-all animate-fade-in ${
          notification.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/50 text-lime-300' 
            : 'bg-red-950/90 border-red-500/50 text-red-300'
        }`} id="manager_toast">
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} className="text-xs underline hover:text-white cursor-pointer ml-4">關閉</button>
        </div>
      )}

      {/* Auth Panel Gate */}
      {!isAdminMode ? (
        <div className="max-w-xl mx-auto bg-[#11241a] border border-emerald-900/30 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden animate-fade-in" id="admin_auth_card">
          <div className="absolute top-0 right-0 w-36 h-36 bg-lime-500/5 rounded-full blur-3xl"></div>
          
          <div className="w-16 h-16 rounded-full bg-lime-500/10 flex items-center justify-center mx-auto mb-4 border border-lime-500/25">
            <ShieldCheck className="w-8 h-8 text-lime-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-extrabold text-gray-100 tracking-tight">龍舌蘭管理組金鑰驗證 🔐</h2>
          <p className="text-emerald-500/80 text-sm mt-2 mb-8 leading-relaxed max-w-sm mx-auto">
            未授權人員禁止進入。請輸入主管管理密碼，始可進行每日清算、回收肉乾與發薪核銷。
          </p>

          <div className="space-y-6" id="auth_methods">
            {/* Unified PIN Password verification */}
            <form onSubmit={handlePasswordLogin} className="space-y-4" id="pin_form">
              <div>
                <label className="block text-xs font-bold text-emerald-400 mb-2 uppercase tracking-wide">主管密碼核對</label>
                <div className="flex gap-2 max-w-xs mx-auto">
                  <input
                    type="password"
                    placeholder="請輸入主管密碼..."
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="flex-1 bg-[#0a1410] border border-emerald-900/40 text-center text-sm font-bold p-3 text-lime-400 placeholder-[#11221b] rounded-lg focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/20"
                    id="input_pin_password"
                  />
                  <button
                    type="submit"
                    disabled={!pinInput}
                    className="bg-lime-400 hover:bg-lime-500 disabled:bg-[#0a1410] disabled:text-emerald-900 text-[#08120e] px-6 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                    id="btn_submit_pin"
                  >
                    驗證登入
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* Authenticated Admin Mode View */
        <div className="space-y-8" id="admin_control_deck">
          
          {/* Dashboard Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#11241a] border border-emerald-900/30 p-6 rounded-2xl shadow-xl" id="manager_toolbox_bar">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-lime-400" />
                <h2 className="text-base font-bold text-gray-100">龍舌蘭咖啡廳 · 薪資主管後台 ☕️</h2>
              </div>
              <p className="text-xs text-emerald-550 mt-1">
                主管權限等級: <span className="font-semibold text-lime-400">總部出納帳 / 密碼驗證登入</span>
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setLoading(true);
                  setTimeout(() => setLoading(false), 500);
                }}
                className="bg-[#0a1410] hover:bg-emerald-950/40 text-gray-300 p-2.5 rounded-xl border border-emerald-900/40 transition-all cursor-pointer"
                title="重新整理數據"
                id="btn_refresh_panel"
              >
                <RefreshCw className="w-4 h-4 text-lime-400" />
              </button>
              <button
                onClick={handleLogOut}
                className="bg-red-950/45 hover:bg-red-900/60 text-red-300 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                id="btn_admin_logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                登出後台
              </button>
            </div>
          </div>

          {/* Aggregated Performance Statistics Bento Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4" id="stats_bento_grid">
            
            <div className="bg-[#11241a] border border-emerald-900/30 p-6 rounded-2xl shadow-xl overflow-hidden relative animate-fade-in" id="stat_total_jerky">
              <div className="absolute top-0 right-0 w-16 h-16 bg-lime-500/5 rounded-full blur-2xl"></div>
              <span className="text-xs text-emerald-400 uppercase tracking-wider block font-semibold mb-1">申報肉乾總計</span>
              <span className="text-xl sm:text-2xl font-black text-white font-mono">{totalJerky.toLocaleString()} <span className="text-xs text-emerald-600 font-normal">PCS</span></span>
              <div className="mt-2 text-[10px] text-emerald-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-lime-400 rounded-full animate-pulse"></span>
                全店店員今日收成
              </div>
            </div>

            <div className="bg-[#11241a] border border-emerald-900/30 p-6 rounded-2xl shadow-xl overflow-hidden relative animate-fade-in" id="stat_recycled">
              <div className="absolute top-0 right-0 w-16 h-16 bg-lime-500/5 rounded-full blur-2xl"></div>
              <span className="text-xs text-emerald-400 uppercase tracking-wider block font-semibold mb-1">已點收回收</span>
              <span className="text-xl sm:text-2xl font-black text-lime-400 font-mono">{verifiedCount.toLocaleString()} <span className="text-xs text-emerald-600 font-normal">PCS</span></span>
              <div className="mt-2 text-[10px] text-lime-400 flex items-center gap-1">
                <CheckSquare className="w-3 h-3 text-lime-500" />
                倉庫端已確實點收
              </div>
            </div>

            <div className="bg-[#11241a] border border-emerald-900/30 p-6 rounded-2xl shadow-xl overflow-hidden relative animate-fade-in" id="stat_pending_recycled">
              <span className="text-xs text-emerald-400 uppercase tracking-wider block font-semibold mb-1">待核對認領</span>
              <span className={`text-xl sm:text-2xl font-black font-mono ${pendingVerifyCount > 0 ? 'text-amber-400 animate-pulse' : 'text-emerald-600'}`}>
                {pendingVerifyCount.toLocaleString()} <span className="text-xs text-emerald-600 font-normal">PCS</span>
              </span>
              <div className="mt-2 text-[10px] text-emerald-500 flex items-center gap-1">
                <CircleAlert className="w-3 h-3 text-emerald-500" />
                待回收店員申報
              </div>
            </div>

            <div className="bg-[#11241a] border border-emerald-900/30 p-6 rounded-2xl shadow-xl overflow-hidden relative animate-fade-in" id="stat_distributed">
              <div className="absolute top-0 right-0 w-16 h-16 bg-lime-400/5 rounded-full blur-2xl"></div>
              <span className="text-xs text-emerald-400 uppercase tracking-wider block font-semibold mb-1">已發放薪資總計</span>
              <span className="text-xl sm:text-2xl font-black text-white font-mono">${totalPaidMoney.toLocaleString()}</span>
              <div className="mt-2 text-[10px] text-lime-400 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-lime-500" />
                出納組手動核銷發放
              </div>
            </div>

            <div className="bg-[#11241a] border border-emerald-900/30 p-6 rounded-2xl shadow-xl col-span-2 md:col-span-1 overflow-hidden relative animate-fade-in" id="stat_pending_money">
              <span className="text-xs text-emerald-400 uppercase tracking-wider block font-semibold mb-1">待撥付薪資總額</span>
              <span className={`text-xl sm:text-2xl font-black font-mono ${pendingPaidMoney > 0 ? 'text-lime-400' : 'text-emerald-700'}`}>
                ${pendingPaidMoney.toLocaleString()}
              </span>
              <div className="mt-2 text-[10px] text-emerald-500 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-500" />
                待回收確認之款項
              </div>
            </div>

          </div>

          {/* Central Workspace: Entries Ledger (Left) vs Settings/Roster (Right) */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" id="manager_workspace_grid">
            
            {/* Left Box: Payroll Record verification center (Span 2) */}
            <div className="xl:col-span-2 space-y-4" id="ledger_verification_center">
              <div className="bg-[#11241a] rounded-2xl border border-emerald-900/30 shadow-2xl overflow-hidden" id="ledger_card_inner">
                <div className="p-6 border-b border-emerald-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                    <span className="w-2 h-2 bg-lime-400 rounded-full animate-ping"></span> 
                    龍舌蘭出納核銷中心 ({entries.length} 筆清算)
                  </h3>
                  <div className="text-xs text-teal-200 bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5" id="notice_rules">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-lime-400" />
                    請主管務必清點肉乾回收進箱後再核銷撥款
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-16 text-emerald-600 text-sm animate-pulse" id="inner_loading_label">載入帳本紀錄中...</div>
                ) : entries.length === 0 ? (
                  <div className="text-center py-16 text-emerald-700 border border-dashed border-emerald-950/40 rounded-xl m-6 bg-[#0a1410]/40" id="inner_empty_label">
                    目前沒有任何店員提交發薪結算！🍹
                  </div>
                ) : (
                  <div className="overflow-x-auto" id="table_manager_ledger_container">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-[#11241a] text-[11px] text-emerald-400 uppercase border-b border-emerald-950/55 h-12">
                          <th className="px-6 font-bold">店員名字 / 時間</th>
                          <th className="px-6 text-right font-bold">申報收成 (肉乾)</th>
                          <th className="px-6 text-right font-bold">換算所得</th>
                          <th className="px-6 text-center font-bold">1. 實體對帳進倉</th>
                          <th className="px-6 text-center font-bold">2. 核對手動發薪</th>
                          <th className="px-6 text-right font-bold">動作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-950/50">
                        {entries.map((entry) => {
                          const submitDate = entry.createdAt?.seconds 
                            ? new Date(entry.createdAt.seconds * 1000).toLocaleString('zh-TW', { hour12: false })
                            : '同步中...';
                          return (
                            <tr key={entry.id} className={`h-16 transition-colors ${
                              entry.isPaid ? 'opacity-40 bg-emerald-950/20' : entry.isVerified ? 'bg-lime-500/5' : 'hover:bg-lime-500/5'
                            }`}>
                              {/* Clerk Name and Submit Hour */}
                              <td className="px-6">
                                <div className="font-bold text-gray-100">☕️ {entry.clerkName}</div>
                                <div className="text-[10px] text-emerald-600 font-mono mt-0.5">{submitDate}</div>
                              </td>

                              {/* Meat Jerky count */}
                              <td className="px-6 text-right font-mono font-bold text-gray-100">
                                {entry.meatJerkyCount.toLocaleString()} <span className="text-xs font-normal text-emerald-600">PCS</span>
                              </td>

                              {/* Payout salary */}
                              <td className="px-6 text-right font-mono font-black text-lime-400">
                                ${entry.totalSalary.toLocaleString()}
                              </td>

                              {/* Step 1: Collect/Verify checkbox */}
                              <td className="px-6 text-center">
                                <button
                                  onClick={() => handleToggleVerify(entry)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    entry.isVerified 
                                      ? 'bg-lime-500/15 border-lime-500/30 text-lime-400' 
                                      : 'bg-[#0a1410] border-emerald-900/40 text-emerald-500 hover:bg-emerald-950/60'
                                  }`}
                                  id={`btn_verify_${entry.id}`}
                                >
                                  {entry.isVerified ? (
                                    <>
                                      <CheckSquare className="w-4 h-4 text-lime-400 animate-pulse" />
                                      已收進倉
                                    </>
                                  ) : (
                                    <>
                                      <Square className="w-4 h-4 text-emerald-700" />
                                      確認回收
                                    </>
                                  )}
                                </button>
                              </td>

                              {/* Step 2: Pay Money button */}
                              <td className="px-6 text-center">
                                {entry.isPaid ? (
                                  <div className="flex justify-center">
                                    <span className="text-xs text-emerald-600 italic font-semibold">已經發放 🍹</span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleTogglePaid(entry)}
                                    disabled={!entry.isVerified}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                      entry.isVerified
                                        ? 'bg-lime-400 hover:bg-lime-500 text-[#08120e] border-transparent shadow-lg shadow-lime-500/10'
                                        : 'bg-[#0a1410] border-emerald-950/40 text-emerald-850 cursor-not-allowed'
                                    }`}
                                    id={`btn_paid_${entry.id}`}
                                  >
                                    核銷發薪
                                  </button>
                                )}
                              </td>

                              {/* Manage log (Delete) */}
                              <td className="px-6 text-right">
                                <button
                                  onClick={() => handleDeleteEntry(entry.id, entry.clerkName)}
                                  className="text-emerald-700 hover:text-red-400 p-2 rounded-lg hover:bg-[#0a1410] transition-colors cursor-pointer"
                                  title="刪除申請"
                                  id={`btn_delete_${entry.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Exchange Rate Rate Settings & Roster Administration */}
            <div className="space-y-6" id="settings_and_roster_column">
              
              {/* Configuration settings form */}
              <div className="bg-[#11241a] border border-emerald-900/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-fade-in" id="card_rate_config">
                <div className="absolute top-0 right-0 w-24 h-24 bg-lime-500/5 rounded-full blur-2xl"></div>
                
                <h3 className="text-base font-bold text-gray-100 flex items-center gap-2 mb-4">
                  <Sliders className="w-4 h-4 text-lime-400" />
                  今日發薪匯率設定 🍹
                </h3>

                <form onSubmit={handleSaveRate} className="space-y-4" id="form_jerky_rate_adjustment">
                  <div>
                    <label className="block text-xs uppercase text-emerald-400 font-bold mb-1.5">當前單支肉乾價格 (幣額：${jerkyRate.toLocaleString()}元)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="調整新匯率..."
                        value={newRateInput}
                        onChange={(e) => setNewRateInput(e.target.value)}
                        className="flex-1 bg-[#0a1410] border border-emerald-900/40 rounded-lg p-3 text-sm text-lime-400 font-bold focus:outline-none focus:border-lime-500"
                        id="input_rate_adjustment"
                      />
                      <button
                        type="submit"
                        disabled={Number(newRateInput) === jerkyRate}
                        className="bg-lime-400 hover:bg-lime-500 disabled:bg-[#0a1410] disabled:text-emerald-850 text-[#08120e] px-4 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                        id="btn_update_rate"
                      >
                        變更
                      </button>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-500/80 leading-relaxed block bg-[#0a1410]/80 p-3 rounded-lg border border-emerald-950/40">
                    💡 價格更動後，<b>店員的即時試算面板</b> 將立刻同步調整，舊有的清算單則仍將保持其提交時之匯率紀錄不變。
                  </span>
                </form>
              </div>

              {/* Backend Roster registration Control */}
              <div className="bg-[#11241a] border border-emerald-900/30 rounded-2xl p-6 shadow-2xl animate-fade-in" id="card_manager_roster">
                <h3 className="text-base font-bold text-gray-100 flex items-center gap-2 mb-4">
                  <UserPlus className="w-4 h-4 text-lime-400" />
                  員工名錄登記簿 📖
                </h3>

                <form onSubmit={handleAddClerk} className="flex gap-2 mb-4" id="form_add_clerk_backend">
                  <input
                    type="text"
                    placeholder="輸入新員工名字..."
                    value={newClerkName}
                    onChange={(e) => setNewClerkName(e.target.value)}
                    className="flex-1 bg-[#0a1410] border border-emerald-900/40 rounded-lg p-3 text-sm text-gray-100 focus:outline-none focus:border-lime-500"
                    id="input_add_clerk_backend"
                  />
                  <button
                    type="submit"
                    disabled={!newClerkName.trim()}
                    className="bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 border border-lime-500/30 px-4 rounded-lg text-xs font-bold cursor-pointer disabled:bg-[#0a1410] disabled:text-emerald-800"
                    id="btn_add_clerk_backend_submit"
                  >
                    點名註冊
                  </button>
                </form>

                {/* List representing the roster */}
                <div className="max-h-60 overflow-y-auto space-y-1 bg-[#0a1410] p-2 rounded-lg border border-emerald-900/30 custom-scrollbar" id="manager_roster_scroller">
                  {clerks.length === 0 ? (
                    <div className="text-center py-8 text-xs text-emerald-700" id="roster_empty_lbl">名冊目前無任何登錄店員</div>
                  ) : (
                    clerks.map((clerk) => (
                      <div 
                        key={clerk.id} 
                        className="flex items-center justify-between p-2.5 hover:bg-lime-500/5 rounded-lg text-gray-300 text-sm transition-all"
                        id={`roster_row_${clerk.id}`}
                      >
                        <span className="font-semibold text-emerald-100">☕️ {clerk.name}</span>
                        <button
                          onClick={() => handleDeleteClerk(clerk.id, clerk.name)}
                          className="text-emerald-750 hover:text-red-400 p-1.5 rounded hover:bg-[#11241a] cursor-pointer transition-colors"
                          title="移出名冊"
                          id={`btn_delete_clerk_${clerk.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
