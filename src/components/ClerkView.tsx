import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  setDoc,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { PayrollEntry, Clerk } from '../types';
import { 
  Coins, 
  User, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Sparkles, 
  Search,
  CheckSquare,
  Coffee,
  Lock,
  Unlock,
  Key,
  Heart,
  Smile,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from './Toast';

interface ClerkViewProps {
  jerkyRate: number;
}

export default function ClerkView({ jerkyRate }: ClerkViewProps) {
  const { addToast } = useToast();
  const [selectedClerk, setSelectedClerk] = useState<string>('');
  const [newClerkName, setNewClerkName] = useState<string>('');
  const [clerks, setClerks] = useState<Clerk[]>([]);
  const [meatJerkyCount, setMeatJerkyCount] = useState<number | ''>('');
  const [clerkEntries, setClerkEntries] = useState<PayrollEntry[]>([]);
  const [loadingClerks, setLoadingClerks] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [authenticatedClerkName, setAuthenticatedClerkName] = useState<string>('');
  const [clerkPassword, setClerkPassword] = useState<string>('');
  const [clerkPasswordConfig, setClerkPasswordConfig] = useState<string>('');
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(false);

  const currentSelectedClerkObj = clerks.find(c => c.name === selectedClerk);

  const handleSelectClerk = (clerkName: string) => {
    setSelectedClerk(clerkName);
    setAuthenticatedClerkName('');
    setClerkPassword('');
    setClerkPasswordConfig('');
  };

  const handleSignOutClerk = () => {
    setSelectedClerk('');
    setAuthenticatedClerkName('');
    setClerkPassword('');
    setClerkPasswordConfig('');
  };

  const handleClerkLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSelectedClerkObj) return;

    if (currentSelectedClerkObj.password === clerkPassword) {
      setAuthenticatedClerkName(selectedClerk);
      setNotification({ type: 'success', text: `密碼驗證成功！歡迎上工，${selectedClerk} 🍹` });
      addToast('success', `解鎖成功！歡迎店員「${selectedClerk}」登入 Tequila 薪資系統 🍹`, '🔑 安全解鎖成功');
      setClerkPassword('');
      setShowWelcomeModal(true);
    } else {
      setNotification({ type: 'error', text: '密碼錯誤，請重新輸入！若為首次登入請確認流程。' });
      addToast('error', '輸入的解鎖密碼有些不對喔，請再次確認！', '❌ 密碼驗證失敗');
    }
  };

  const handleClerkRegisterPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSelectedClerkObj) return;

    const pw = clerkPassword.trim();
    const confirmPw = clerkPasswordConfig.trim();

    if (!pw) {
      setNotification({ type: 'error', text: '請輸入有效的密碼！' });
      addToast('warning', '請輸入您所想要設定的個人密碼喔！');
      return;
    }

    if (pw !== confirmPw) {
      setNotification({ type: 'error', text: '兩次輸入的密碼不一致，請重新檢查！' });
      addToast('warning', '兩次輸入的密碼欄位不吻合，請重新確認。', '⚠️ 密碼不一致');
      return;
    }

    try {
      await setDoc(doc(db, 'clerks', currentSelectedClerkObj.id), {
        ...currentSelectedClerkObj,
        password: pw
      }, { merge: true });

      setAuthenticatedClerkName(selectedClerk);
      setClerkPassword('');
      setClerkPasswordConfig('');
      setNotification({ type: 'success', text: `密碼設定成功！已成功登入店員【${selectedClerk}】系統。` });
      addToast('coffee', `🎉 安全密碼設定成功！已為店員【${selectedClerk}】配置專屬鑰匙，數據存儲已進行私密防護。`, '🛡️ 隱私防禦啟用');
      setShowWelcomeModal(true);
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', text: '設定密碼失敗，請稍後再試！' });
      addToast('error', '設定密碼發生資料庫拒絕，請稍後再試！');
    }
  };

  // 1. Listen to Clerks Roster in real-time
  useEffect(() => {
    const clerksRef = collection(db, 'clerks');
    const q = query(clerksRef, orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Clerk[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          name: data.name,
          password: data.password || '',
          createdAt: data.createdAt,
        });
      });
      setClerks(items);
      setLoadingClerks(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clerks');
    });

    return () => unsubscribe();
  }, []);

  // 2. Listen to active clerk's past entries in real-time
  useEffect(() => {
    if (!selectedClerk) {
      setClerkEntries([]);
      return;
    }
    setLoadingEntries(true);
    const entriesRef = collection(db, 'payrollEntries');
    const q = query(
      entriesRef, 
      where('clerkName', '==', selectedClerk)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
      // Sort client-side additionally if serverTimestamp has not propagated to server yet (can be null locally)
      items.sort((a, b) => {
        const dateA = a.createdAt?.seconds || Date.now() / 1000;
        const dateB = b.createdAt?.seconds || Date.now() / 1000;
        return dateB - dateA;
      });
      setClerkEntries(items);
      setLoadingEntries(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'payrollEntries');
    });

    return () => unsubscribe();
  }, [selectedClerk]);

  // Handle adding new clerk to roster
  const handleAddClerk = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newClerkName.trim();
    if (!cleanName) return;

    if (clerks.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
      setNotification({ type: 'error', text: `店員「${cleanName}」已經存在了！` });
      addToast('error', `店員「${cleanName}」已經存在於名冊中，無法重複加入喔！`, '❌ 註冊重疊');
      return;
    }

    try {
      const clerkId = `clerk_${Date.now()}`;
      await setDoc(doc(db, 'clerks', clerkId), {
        id: clerkId,
        name: cleanName,
        createdAt: serverTimestamp()
      });
      setSelectedClerk(cleanName);
      setAuthenticatedClerkName('');
      setClerkPassword('');
      setClerkPasswordConfig('');
      setNewClerkName('');
      setNotification({ type: 'success', text: `成功註冊店員「${cleanName}」，請在右側設定您的專屬密碼！` });
      addToast('success', `成功註冊店員「${cleanName}」！已切換至該店員，請設定個人專屬密碼解鎖後台 ☕️`, '✨ 註冊店員成功');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `clerks`);
    }
  };

  // Handle submitting Meat Jerky calculations
  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClerk) {
      setNotification({ type: 'error', text: '請先選擇你的店員名字！' });
      addToast('warning', '請在申報前先選擇您的店員角色！', '⚠️ 尚未選取店員');
      return;
    }

    const count = Number(meatJerkyCount);
    if (isNaN(count) || count <= 0) {
      setNotification({ type: 'error', text: '請輸入正確的大於 0 的小零食數量！' });
      addToast('warning', '請輸入高於 0 的正確小零食收成數量喔！', '⚠️ 數量格式錯誤');
      return;
    }

    const totalSalary = count * jerkyRate;

    try {
      const entryId = `entry_${Date.now()}`;
      await setDoc(doc(db, 'payrollEntries', entryId), {
        clerkName: selectedClerk,
        meatJerkyCount: count,
        salaryRate: jerkyRate,
        totalSalary: totalSalary,
        isVerified: false,
        isPaid: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setMeatJerkyCount('');
      setNotification({ type: 'success', text: `薪資計算申報成功！總薪資：$${totalSalary.toLocaleString()} 元。` });
      addToast('success', `🎉 薪資申報成功！今日收成 ${count} 個小零食，結算金額 $${totalSalary.toLocaleString()} 元。記得點交零食喔！☕️`, '✨ 申報完畢, 待主管盤點');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `payrollEntries/${selectedClerk}`);
      addToast('error', '申報上傳遭拒，請確認連線或洽詢主管。', '❌ 提交失敗');
    }
  };

  // Quick auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const filteredClerks = clerks.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="clerk_view_root">
      
      {/* Sidebar: Clerk Identity Login */}
      <div className="lg:col-span-4 space-y-6" id="clerk_sidebar">
        <div className="bg-[#11241a] p-6 rounded-2xl border border-emerald-900/30 shadow-2xl relative overflow-hidden animate-fade-in" id="card_clerk_identity">
          <div className="absolute top-0 right-0 w-32 h-32 bg-lime-500/5 rounded-full blur-3xl"></div>
          
          <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2 mb-6">
            <span className="w-2.5 h-2.5 bg-lime-400 rounded-full animate-bounce"></span> 
            店員報帳入口 ☕️
          </h2>

          {/* Quick Stats banner if logged in */}
          {selectedClerk && (
            <div className="mb-5 p-4 bg-lime-500/10 border border-lime-500/20 rounded-xl flex items-center justify-between" id="clerk_logged_banner">
              <div>
                <p className="text-xs text-lime-400 font-bold uppercase">目前當班店員</p>
                <p className="text-base font-bold text-gray-100 mt-1">🍹 {selectedClerk}</p>
                <p className="text-[10px] uppercase font-bold mt-0.5 animate-pulse" id="clerk_privacy_status">
                  {authenticatedClerkName === selectedClerk ? (
                    <span className="text-lime-400">● 隱私安全解鎖 ✔</span>
                  ) : (
                    <span className="text-amber-400">● 清算歷史鎖定中 🔐</span>
                  )}
                </p>
              </div>
              <button 
                onClick={handleSignOutClerk}
                className="text-xs text-lime-300 hover:text-white cursor-pointer underline transition-colors font-bold"
                id="btn_logout_clerk"
              >
                切換店員
              </button>
            </div>
          )}

          {!selectedClerk ? (
            <div className="space-y-5" id="clerk_login_section">
              {/* Search clerk roster */}
              <div className="space-y-2">
                <label className="text-xs text-emerald-400 uppercase tracking-wider block font-semibold">搜尋或選擇姓名</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-emerald-500" />
                  <input
                    type="text"
                    placeholder="輸入店員名字搜尋..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0a1410] border border-emerald-900/35 rounded-lg p-3 pl-10 text-sm text-gray-100 placeholder-emerald-800 focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/20"
                    id="input_search_clerk"
                  />
                </div>
              </div>

              {/* Roster list */}
              <div className="max-h-52 overflow-y-auto border border-emerald-900/30 rounded-lg bg-[#0a1410] p-2 space-y-1 custom-scrollbar" id="clerk_roster_container">
                {loadingClerks ? (
                  <div className="text-center py-4 text-xs text-emerald-600" id="loading_clerks_lbl">載入店員名冊中...</div>
                ) : filteredClerks.length === 0 ? (
                  <div className="text-center py-4 text-xs text-emerald-600" id="no_clerks_found_lbl">查無成員，請在下方登記註冊 🍹</div>
                ) : (
                  filteredClerks.map((clerk) => (
                    <button
                      key={clerk.id}
                      onClick={() => handleSelectClerk(clerk.name)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between cursor-pointer ${
                        selectedClerk === clerk.name 
                          ? 'bg-lime-500/15 text-lime-400 border border-lime-500/25' 
                          : 'text-gray-300 hover:bg-emerald-950/40 border border-transparent'
                      }`}
                      id={`btn_clerk_${clerk.id}`}
                    >
                      <span className="font-semibold">{clerk.name}</span>
                      <span className="text-[10px] text-lime-500 uppercase font-mono tracking-wider font-bold">點擊上工</span>
                    </button>
                  ))
                )}
              </div>

              {/* Add New Clerk Form */}
              <div className="pt-4 border-t border-emerald-950" id="add_new_clerk_section">
                <form onSubmit={handleAddClerk} className="space-y-2">
                  <label className="text-xs text-emerald-500 font-bold uppercase tracking-wider block">新人登記上工</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="輸入新店員名字..."
                      value={newClerkName}
                      onChange={(e) => setNewClerkName(e.target.value)}
                      className="flex-1 bg-[#0a1410] border border-emerald-900/40 rounded-lg p-3 text-sm text-gray-100 placeholder-emerald-900 focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/20"
                      id="input_new_clerk_name"
                    />
                    <button
                      type="submit"
                      disabled={!newClerkName.trim()}
                      className="bg-lime-500/20 hover:bg-lime-500/35 disabled:bg-[#0a1410] disabled:text-emerald-950 text-lime-400 border border-lime-400/30 px-3 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
                      id="btn_submit_new_clerk"
                      title="註冊新店員"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="text-gray-300 text-sm space-y-2" id="clerk_is_active_box">
              <div className="p-4 bg-[#0a1410] rounded-xl border border-emerald-950" id="clerk_rule_box">
                <span className="text-xs font-bold text-lime-400 block mb-1">🍋 龍舌蘭發薪守則 🍹</span>
                <p className="text-xs text-emerald-450 leading-relaxed">
                  請在此結算並填報今天獲得的「小零食」清算總數。我們今天的特調匯率為一個小零食兌換 <b className="text-lime-400 font-mono">${jerkyRate.toLocaleString()}</b> 元。填報完成後，請將小零食送往倉庫核銷以供主管撥款。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Elegant guidance container matches the green thematic callout block */}
        <div className="bg-lime-950/20 border border-lime-500/15 p-6 rounded-2xl flex flex-col justify-center items-center text-center animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-lime-500/10 flex items-center justify-center mb-3">
            <Coffee className="w-6 h-6 text-lime-400" />
          </div>
          <p className="text-sm text-emerald-200/90 italic leading-relaxed">
            "本週零食：烤牛肉塔可餅 🍹<br />
            請務必連同實體繳交至發薪櫃檯！"
          </p>
        </div>
      </div>

      {/* Main Content: Payroll Input & History List */}
      <div className="lg:col-span-8 space-y-6" id="clerk_main_panel">
        
        {/* Toast Notification */}
        {notification && (
          <div className={`p-4 rounded-xl text-sm border flex items-center justify-between shadow-lg transition-all animate-fade-in ${
            notification.type === 'success' 
              ? 'bg-emerald-950/90 border-emerald-500/50 text-lime-300' 
              : 'bg-red-950/90 border-red-500/50 text-red-300'
          }`} id="notification_banner">
            <span>{notification.text}</span>
            <button onClick={() => setNotification(null)} className="text-xs underline hover:text-white cursor-pointer ml-4">關閉</button>
          </div>
        )}

        {/* Input Form Section */}
        <div className="bg-[#11241a] p-6 rounded-2xl border border-emerald-900/30 shadow-2xl relative overflow-hidden animate-fade-in" id="card_clerk_payout_calculator">
          <div className="absolute top-0 right-0 w-32 h-32 bg-lime-500/5 rounded-full blur-3xl"></div>
          
          <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2 mb-6">
            <span className="w-2.5 h-2.5 bg-lime-400 rounded-full animate-pulse"></span> 
            今日所得清算與申報
          </h2>

          {!selectedClerk ? (
            <div className="text-center py-16 text-emerald-600 space-y-3 border border-dashed border-emerald-950/50 rounded-xl bg-[#0a1410]/50" id="clerk_input_lockout">
              <Coffee className="w-12 h-12 text-emerald-800 mx-auto opacity-40 animate-pulse" />
              <p className="text-sm">請先在左側點擊店員姓名「登入上工」，即可申報您今天的薪資</p>
            </div>
          ) : authenticatedClerkName !== selectedClerk ? (
            /* PASSCODE Verification or Setup */
            currentSelectedClerkObj?.password ? (
              <div className="space-y-6 py-6 max-w-md mx-auto text-center" id="clerk_password_verify_gate">
                <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-2">
                  <Lock className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-100">【{selectedClerk}】隱私防護鎖 🔐</h3>
                  <p className="text-xs text-emerald-500 mt-2 leading-relaxed">
                    此帳號已啟用個人專屬密碼。請輸入您的登入密碼解鎖，以填報今日小零食數量並檢視您的所得歷史：
                  </p>
                </div>

                <form onSubmit={handleClerkLoginSubmit} className="space-y-4">
                  <input
                    type="password"
                    placeholder="請輸入店員密碼..."
                    value={clerkPassword}
                    onChange={(e) => setClerkPassword(e.target.value)}
                    className="w-full bg-[#0a1410] border border-emerald-900/40 text-center text-sm font-bold p-3.5 text-lime-400 placeholder-emerald-900 rounded-xl focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/20 animate-none"
                    id="input_clerk_verify_password"
                    required
                  />
                  
                  <button
                    type="submit"
                    disabled={!clerkPassword}
                    className="w-full bg-lime-400 hover:bg-lime-500 disabled:bg-[#0a1410] disabled:text-emerald-950 disabled:border-transparent font-bold text-[#08120e] py-3.5 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm"
                    id="btn_submit_clerk_login"
                  >
                    <Unlock className="w-4 h-4 text-[#08120e]" />
                    驗證金鑰，解除鎖定
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-6 py-4 max-w-md mx-auto text-center" id="clerk_password_setup_gate">
                <div className="w-14 h-14 rounded-full bg-lime-500/10 border border-lime-500/20 flex items-center justify-center mx-auto mb-2">
                  <Key className="w-6 h-6 text-lime-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-100">【{selectedClerk}】首次登入設定密碼 🛡️</h3>
                  <p className="text-xs text-emerald-500 mt-2 leading-relaxed">
                    為保障您的小零食收成、薪資隱私與報帳安全，請在首次使用時為此角色設定一組專屬員工密碼。此後，所有所得清算、撥款紀錄及試算僅在此密碼解鎖後顯示，防止其他店員探看您的隱私。
                  </p>
                </div>

                <form onSubmit={handleClerkRegisterPassword} className="space-y-4">
                  <div className="space-y-3">
                    <input
                      type="password"
                      placeholder="請輸入您想設定的新密碼..."
                      value={clerkPassword}
                      onChange={(e) => setClerkPassword(e.target.value)}
                      className="w-full bg-[#0a1410] border border-emerald-900/40 text-center text-sm font-bold p-3.5 text-lime-400 placeholder-emerald-900 rounded-xl focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/20"
                      id="input_clerk_new_password"
                      required
                    />
                    <input
                      type="password"
                      placeholder="請再次輸入密碼以確認..."
                      value={clerkPasswordConfig}
                      onChange={(e) => setClerkPasswordConfig(e.target.value)}
                      className="w-full bg-[#0a1410] border border-emerald-900/40 text-center text-sm font-bold p-3.5 text-lime-400 placeholder-emerald-900 rounded-xl focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/20"
                      id="input_clerk_new_password_confirm"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!clerkPassword || !clerkPasswordConfig}
                    className="w-full bg-lime-400 hover:bg-lime-500 disabled:bg-[#0a1410] disabled:text-emerald-950 disabled:border-transparent font-bold text-[#08120e] py-3.5 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm"
                    id="btn_submit_clerk_register"
                  >
                    <Unlock className="w-4 h-4 text-[#08120e]" />
                    建立並儲存隱私密碼
                  </button>
                </form>
              </div>
            )
          ) : (
            <form onSubmit={handleSubmitEntry} className="space-y-6" id="clerk_payroll_form">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="form_grid">
                
                {/* Meat Jerky input field */}
                <div id="field_jerky_count" className="space-y-2">
                  <label className="text-xs text-emerald-400 uppercase tracking-wider block font-bold">今日收成小零食總數</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      placeholder="輸入小零食數量..."
                      value={meatJerkyCount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMeatJerkyCount(val === '' ? '' : Math.floor(Math.abs(Number(val))));
                      }}
                      className="w-full bg-[#0a1410] border border-emerald-900/35 rounded-lg p-3 text-sm text-gray-100 placeholder-emerald-900 focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/20"
                      required
                      id="input_meat_jerky_count"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-lime-400 font-bold uppercase bg-[#10241b] px-2 py-1.5 rounded border border-emerald-950/40">PCS</span>
                  </div>
                </div>

                {/* Calculation Board */}
                <div className="bg-lime-500/10 border border-lime-500/20 rounded-xl p-5 text-center flex flex-col justify-center" id="field_salary_result_board">
                  <p className="text-xs text-lime-400 font-bold uppercase mb-1">即時試算薪資 🍹</p>
                  <p className="text-3xl font-mono font-bold text-lime-300" id="calculated_salary_text">
                    ${meatJerkyCount ? (Number(meatJerkyCount) * jerkyRate).toLocaleString() : '0'}
                  </p>
                  <p className="text-[10px] text-emerald-500 mt-1 uppercase">Today's Rate: ${jerkyRate.toLocaleString()} / PCS</p>
                </div>

              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={!meatJerkyCount}
                className="w-full bg-lime-400 hover:bg-lime-500 disabled:bg-emerald-950/40 disabled:text-emerald-800 disabled:border-transparent font-black text-[#08120e] py-4 rounded-xl transition-all shadow-lg shadow-lime-500/20 flex items-center justify-center gap-2 cursor-pointer text-base"
                id="btn_submit_payroll"
              >
                <Sparkles className="w-5 h-5 text-[#08120e]" />
                送出清算，結算今日發薪！
              </button>
            </form>
          )}
        </div>

        {/* History Ledger List */}
        {selectedClerk && authenticatedClerkName === selectedClerk && (
          <div className="bg-[#11241a] p-6 rounded-2xl border border-emerald-900/30 shadow-2xl animate-fade-in" id="card_clerk_history_ledger">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-lime-400" />
                我的清算歷史紀錄 ({selectedClerk})
              </h2>
              <span className="text-xs text-lime-500 uppercase tracking-widest font-mono font-bold font-semibold bg-lime-500/10 px-2 py-1 rounded">Live Syncing</span>
            </div>

            {loadingEntries ? (
              <div className="text-center py-12 text-emerald-600 text-sm animate-pulse" id="loading_entries_lbl">最新申報讀取中...</div>
            ) : clerkEntries.length === 0 ? (
              <div className="text-center py-10 text-emerald-700 text-sm border border-dashed border-emerald-950/50 rounded-xl" id="empty_entries_lbl">
                尚無任何清算申請歷史。快喝杯咖啡，填報您的第一筆資料吧！🍹
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-emerald-950/40 bg-[#0a1410]" id="table_clerk_history">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#10241b] border-b border-emerald-950 text-emerald-400 text-[11px] uppercase font-bold tracking-wider">
                      <th className="p-4 pl-6">申報日期 & 時間</th>
                      <th className="p-4 text-right">小零食清算數</th>
                      <th className="p-4 text-right">今日薪資額</th>
                      <th className="p-4 text-center">實體點交狀態</th>
                      <th className="p-4 text-center">發放進度</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-950 text-gray-300">
                    {clerkEntries.map((entry) => {
                      const entryDate = entry.createdAt?.seconds 
                        ? new Date(entry.createdAt.seconds * 1000).toLocaleString('zh-TW', { hour12: false })
                        : '同步中...';
                      return (
                        <tr key={entry.id} className="hover:bg-lime-500/5 transition-colors">
                          <td className="p-4 pl-6 font-mono text-xs text-emerald-450">{entryDate}</td>
                          <td className="p-4 text-right font-mono font-bold text-lime-300">{entry.meatJerkyCount.toLocaleString()}</td>
                          <td className="p-4 text-right font-mono font-black text-amber-400">${entry.totalSalary.toLocaleString()}</td>
                          
                          {/* Checked/Recycled Status */}
                          <td className="p-4 text-center">
                            <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                              entry.isVerified 
                                ? 'text-emerald-400' 
                                : 'text-lime-400'
                            }`} id={`status_verified_${entry.id}`}>
                              {entry.isVerified ? (
                                <>
                                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                                  已回收進倉
                                </>
                              ) : (
                                <>
                                  <div className="w-4 h-4 border-2 border-lime-400 rounded flex items-center justify-center scale-90"><div className="w-1.5 h-1.5 bg-lime-400 rounded-full animate-ping"></div></div>
                                  待核銷 (等候中)
                                </>
                              )}
                            </span>
                          </td>

                          {/* Payout Status */}
                          <td className="p-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                              entry.isPaid 
                                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                                : 'bg-lime-950/30 border border-lime-500/20 text-lime-400/80 animate-pulse'
                            }`} id={`status_paid_${entry.id}`}>
                              {entry.isPaid ? '撥款完成 ✔' : '等候撥付 🍹'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

      {/* Onboarding Dialog: Manager's Gratitude & Instructions Multi-step Panel */}
      <AnimatePresence>
        {showWelcomeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" id="welcome_modal_overlay">
            {/* Backdrop overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#040907]/90 backdrop-blur-sm cursor-default"
              onClick={() => setShowWelcomeModal(false)}
              id="welcome_modal_backdrop"
            />

            {/* Modal Content */}
            <motion.div 
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.5, bounce: 0.15 }}
              className="bg-[#11241a] border border-lime-500/30 rounded-2xl max-w-2xl w-full p-6 sm:p-8 relative shadow-2xl shadow-lime-950/40 z-10 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar"
              id="welcome_modal_panel"
            >
              {/* Subtle top decoration */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-lime-400 to-emerald-500"></div>

              {/* Close button top right */}
              <button 
                onClick={() => setShowWelcomeModal(false)}
                className="absolute top-4 right-4 text-emerald-500 hover:text-white p-2 rounded-lg hover:bg-[#0a1410] transition-colors cursor-pointer flex items-center justify-center"
                id="welcome_modal_close_btn"
                title="關閉"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Content Container */}
              <div className="space-y-6" id="welcome_modal_body">
                
                {/* Header: Manager Gratitude */}
                <div className="flex flex-col items-center text-center space-y-3" id="welcome_header">
                  <div className="w-16 h-16 rounded-full bg-lime-500/10 border border-lime-500/30 flex items-center justify-center shadow-lg shadow-lime-500/5 animate-pulse" id="welcome_avatar">
                    <Smile className="w-8 h-8 text-lime-400" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-extrabold text-lime-300 tracking-wide text-center" id="welcome_title">
                      店長的暖心致謝與上工教學 💖
                    </h3>
                    <p className="text-xs text-emerald-500 font-mono tracking-widest font-black uppercase">
                      ✨ Welcome to Maguey Cafe Team ✨
                    </p>
                  </div>
                </div>

                {/* Manager Letter */}
                <div className="bg-[#0a1410] border border-emerald-950/60 p-5 rounded-xl space-y-3 relative" id="manager_letter">
                  <div className="absolute top-3 right-3 text-[10px] text-lime-500/50 uppercase font-mono font-bold tracking-widest bg-lime-500/10 border border-lime-500/20 px-2 py-0.5 rounded">
                    Manager's Message
                  </div>
                  <p className="text-sm font-semibold text-lime-400 flex items-center gap-1.5" id="letter_greeting">
                    <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                    親愛的 {selectedClerk}：
                  </p>
                  <p className="text-xs text-emerald-300 leading-relaxed">
                    辛苦了！由衷感謝你加入 <b>Maguey Cafe (龍舌蘭咖啡廳)</b> 這個溫馨優雅的大家庭。不論是香濃咖啡的沖煮，還是親手包裝的小零食收成，因為有你的用心付出，每位來到店裡的客人都感受到了溫暖與微醺的幸福感。☕️
                  </p>
                  <p className="text-xs text-emerald-300 leading-relaxed">
                    我們在咖啡廳提供全自動化、且具有隱私密碼保護的薪資結算系統。以下是專門為你整理的 <b>「系統申報與發薪 4 步指南」</b>，助你一分鐘上手。祝你今天在 Maguey Cafe 也有段美好充實的工作時光！🍹
                  </p>
                </div>

                {/* Quick Tutorial / System Steps */}
                <div className="space-y-3.5" id="welcome_tutorial_steps">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-lime-400" />
                    系統對帳流程四步說明
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="tutorial_grid">
                    
                    {/* Step 1 */}
                    <div className="bg-[#0a1410] p-4 rounded-xl border border-emerald-950 flex gap-3 hover:border-lime-500/25 transition-all group" id="step_1">
                      <div className="w-8 h-8 rounded-lg bg-lime-500/10 text-lime-400 flex items-center justify-center font-bold font-mono text-sm border border-lime-500/20 shrink-0 group-hover:bg-lime-400 group-hover:text-[#08120e] transition-colors">
                        1
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-200">填報今日小零食</p>
                        <p className="text-[11px] text-emerald-500 leading-relaxed">
                          於本頁輸入今日賺取並收集到的小零食數量，系統會依今日匯率 (<b>${jerkyRate}</b>/片) 即時換算所得。
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-[#0a1410] p-4 rounded-xl border border-emerald-950 flex gap-3 hover:border-lime-500/25 transition-all group" id="step_2">
                      <div className="w-8 h-8 rounded-lg bg-lime-500/10 text-lime-400 flex items-center justify-center font-bold font-mono text-sm border border-lime-500/20 shrink-0 group-hover:bg-lime-400 group-hover:text-[#08120e] transition-colors">
                        2
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-200">送出雲端申報</p>
                        <p className="text-[11px] text-emerald-500 leading-relaxed">
                          填寫完畢後，點擊「送出清算，結算今日發薪！」，申報帳目與當前時間將立刻安全儲存並同步至主管後台。
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="bg-[#0a1410] p-4 rounded-xl border border-emerald-950 flex gap-3 hover:border-lime-500/25 transition-all group" id="step_3">
                      <div className="w-8 h-8 rounded-lg bg-lime-500/10 text-lime-400 flex items-center justify-center font-bold font-mono text-sm border border-lime-500/20 shrink-0 group-hover:bg-lime-400 group-hover:text-[#08120e] transition-colors">
                        3
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-200">實體點收交割</p>
                        <p className="text-[11px] text-emerald-500 leading-relaxed">
                          隨後請將您收集的實體小零食帶到出納櫃檯點交給店長或出納人員，主管會在後台進行快速盤點核對。
                        </p>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="bg-[#0a1410] p-4 rounded-xl border border-emerald-950 flex gap-3 hover:border-lime-500/25 transition-all group" id="step_4">
                      <div className="w-8 h-8 rounded-lg bg-lime-500/10 text-lime-400 flex items-center justify-center font-bold font-mono text-sm border border-lime-500/20 shrink-0 group-hover:bg-lime-400 group-hover:text-[#08120e] transition-colors">
                        4
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-200">撥款並追蹤進度</p>
                        <p className="text-[11px] text-emerald-500 leading-relaxed">
                          店長核對無誤後在系統上點選「已收進倉」與「核銷發薪」，你可在下方即時追蹤進度與查看歷史帳單！
                        </p>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Footer action */}
                <div className="pt-4 border-t border-emerald-950/50 flex flex-col sm:flex-row items-center justify-between gap-4" id="welcome_footer">
                  <span className="text-[10px] text-emerald-700 font-mono tracking-wider">
                    Maguey Cafe 發薪系統 · 誠信與溫度
                  </span>
                  <button
                    onClick={() => setShowWelcomeModal(false)}
                    className="w-full sm:w-auto bg-gradient-to-r from-lime-400 to-emerald-500 hover:from-lime-500 hover:to-emerald-600 text-[#08120e] text-xs font-black px-6 py-3.5 rounded-xl shadow-lg shadow-lime-500/10 cursor-pointer flex items-center justify-center gap-2 transform active:scale-95 transition-all duration-150"
                    id="welcome_start_btn"
                  >
                    <span>不客氣，我知道了，立即上工！🚀</span>
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
