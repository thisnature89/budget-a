import { useState, useEffect, useRef, useCallback } from "react";
import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ======================== HELPERS ========================
const EMOJI_LIST = ["🍚","🚌","🛍️","🏠","🎬","💊","☕","🏦","📦","🎮","📚","🐶","✈️","🎵","💻","🍺","👶","💇","🏋️","🚗","📱","🎁","💡","🧾","🔧","🏥"];
const COLOR_LIST = ["#FF6B35","#4ECDC4","#A855F7","#3B82F6","#F43F5E","#10B981","#D97706","#818CF8","#6B7280","#EC4899","#14B8A6","#F59E0B","#8B5CF6","#EF4444","#06B6D4"];

const DEFAULT_CATEGORIES = [
  { id: "food", name: "식비", icon: "🍚", color: "#FF6B35" },
  { id: "transport", name: "교통", icon: "🚌", color: "#4ECDC4" },
  { id: "shopping", name: "쇼핑", icon: "🛍️", color: "#A855F7" },
  { id: "housing", name: "주거", icon: "🏠", color: "#3B82F6" },
  { id: "culture", name: "문화", icon: "🎬", color: "#F43F5E" },
  { id: "health", name: "건강", icon: "💊", color: "#10B981" },
  { id: "cafe", name: "카페", icon: "☕", color: "#D97706" },
  { id: "other", name: "기타", icon: "📦", color: "#6B7280" },
];

function formatMoney(n) { return n.toLocaleString("ko-KR") + "원"; }
function formatDate(d) { return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`; }

function getCycleRange(baseDate, payDay) {
  const y = baseDate.getFullYear(), m = baseDate.getMonth(), d = baseDate.getDate();
  if (d >= payDay) {
    return { start: new Date(y, m, payDay), end: new Date(y, m+1, payDay-1, 23,59,59) };
  } else {
    return { start: new Date(y, m-1, payDay), end: new Date(y, m, payDay-1, 23,59,59) };
  }
}

function getCycleKey(baseDate, payDay) {
  const { start } = getCycleRange(baseDate, payDay);
  return `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(start.getDate()).padStart(2,"0")}`;
}

function isInCycle(dateStr, start, end) {
  const d = new Date(dateStr + "T12:00:00");
  return d >= start && d <= end;
}

function getNextPaymentDate(dayOfMonth, cycleStart, cycleEnd) {
  const today = new Date();
  // Find the next occurrence of this day within or after the cycle
  let next = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
  if (next < today) next = new Date(today.getFullYear(), today.getMonth()+1, dayOfMonth);
  return next;
}

function daysBetween(a, b) { return Math.ceil((b - a) / (1000*60*60*24)); }
function monthsBetween(a, b) { return (b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth()); }

const initialData = {
  transactions: [],
  budgets: {},
  fixedPayments: [],
  categories: DEFAULT_CATEGORIES,
  payDay: 25,
  savings: 0,
  incomeSettings: {},
};

// ======================== LOGIN ========================
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (err) { setError("이메일 또는 비밀번호가 올바르지 않아요"); }
    setLoading(false);
  }

  return (
    <div style={{minHeight:"100vh",background:"#0b0f1a",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Noto Sans KR',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;900&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing:border-box;margin:0;padding:0; } input:focus,button:focus{outline:none;}
        @keyframes fadeUp{from{transform:translateY(20px);opacity:0;}to{transform:translateY(0);opacity:1;}}`}</style>
      <div style={{width:"100%",maxWidth:380,animation:"fadeUp 0.5s ease"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <span style={{fontSize:56,display:"block",marginBottom:12}}>💰</span>
          <h1 style={{fontSize:32,fontWeight:900,margin:0,background:"linear-gradient(135deg,#FF6B35,#FFB347)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>내 가계부</h1>
          <p style={{color:"#64748b",fontSize:16,marginTop:8}}>로그인하고 시작하세요</p>
        </div>
        <div style={{background:"#111827",borderRadius:20,padding:28,border:"1px solid #1e293b"}}>
          <div style={{marginBottom:18}}>
            <label style={S.label}>이메일</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@example.com" style={{...S.input,fontSize:16}}/>
          </div>
          <div style={{marginBottom:22}}>
            <label style={S.label}>비밀번호</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"
              onKeyDown={e=>{if(e.key==="Enter")handleLogin(e);}} style={{...S.input,fontSize:16}}/>
          </div>
          {error && <div style={{background:"#F43F5E18",border:"1px solid #F43F5E40",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:14,color:"#F43F5E"}}>{error}</div>}
          <button onClick={handleLogin} disabled={loading}
            style={{width:"100%",padding:"16px 0",borderRadius:12,border:"none",background:loading?"#475569":"linear-gradient(135deg,#FF6B35,#FF8F5E)",
              color:"#fff",fontSize:17,fontWeight:700,cursor:loading?"wait":"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ======================== MAIN APP ========================
export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState(initialData);
  const [view, setView] = useState("home");
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const saveTimer = useRef(null);

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [showAddFixed, setShowAddFixed] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showPayConfirm, setShowPayConfirm] = useState(null);

  // Forms
  const [form, setForm] = useState({ amount:"", category:"food", memo:"", date:new Date().toISOString().slice(0,10), type:"expense" });
  const [fixedForm, setFixedForm] = useState({ name:"",amount:"",payDay:"",endDate:"",memo:"" });
  const [editingFixedId, setEditingFixedId] = useState(null);
  const [catForm, setCatForm] = useState({ name:"",icon:"📦",color:"#FF6B35" });
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingBudget, setEditingBudget] = useState(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [savingsInput, setSavingsInput] = useState("");
  const [showSavingsEdit, setShowSavingsEdit] = useState(false);
  const [incomeForm, setIncomeForm] = useState({ salary:"", other:"" });
  const [payDayInput, setPayDayInput] = useState("");
  const [showPayDayEdit, setShowPayDayEdit] = useState(false);
  const [cycleOffset, setCycleOffset] = useState(0);

  // Auth
  useEffect(() => { const u = onAuthStateChanged(auth, u => { setUser(u); setAuthChecked(true); }); return u; }, []);

  // Load
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) { setData(d => ({ ...initialData, ...snap.data() })); }
      } catch (e) { console.error("Load failed", e); }
      setLoaded(true);
    })();
  }, [user]);

  // Save
  const saveToFirestore = useCallback((newData) => {
    if (!user) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await setDoc(doc(db, "users", user.uid), newData); } catch (e) { console.error("Save failed", e); }
    }, 800);
  }, [user]);

  useEffect(() => { if (loaded) saveToFirestore(data); }, [data, loaded, saveToFirestore]);

  function showToastMsg(msg) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }

  if (!authChecked) return (
    <div style={{minHeight:"100vh",background:"#0b0f1a",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap');
        @keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <div style={{textAlign:"center",fontFamily:"'Noto Sans KR',sans-serif"}}>
        <div style={{width:36,height:36,border:"3px solid #1e293b",borderTop:"3px solid #FF6B35",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
        <span style={{color:"#64748b",fontSize:16}}>로딩 중...</span>
      </div>
    </div>
  );
  if (!user) return <LoginScreen />;

  // ---- Computed values ----
  const categories = data.categories || DEFAULT_CATEGORIES;
  const catObj = Object.fromEntries(categories.map(c=>[c.id, c]));
  const payDay = data.payDay || 25;
  const today = new Date();
  const cycle = getCycleRange(today, payDay);
  const ck = getCycleKey(today, payDay);

  const cycleTransactions = data.transactions.filter(t => isInCycle(t.date, cycle.start, cycle.end));
  const expenses = cycleTransactions.filter(t => t.type === "expense");
  const incomes = cycleTransactions.filter(t => t.type === "income");
  const totalExpense = expenses.reduce((s,t) => s + t.amount, 0);
  const totalIncome = incomes.reduce((s,t) => s + t.amount, 0);

  // Income from settings for this cycle
  const incomeSettings = (data.incomeSettings || {})[ck] || {};
  const salaryIncome = Number(incomeSettings.salary || 0);
  const otherIncome = Number(incomeSettings.other || 0);
  const settingsIncome = salaryIncome + otherIncome;
  // Use larger of settings income or recorded income
  const effectiveIncome = Math.max(settingsIncome, totalIncome);

  // Fixed payments - total expected per cycle
  const activeFixed = (data.fixedPayments || []).filter(fp => {
    const endD = new Date(fp.endDate);
    return endD >= cycle.start;
  });
  const fixedMonthlyTotal = activeFixed.reduce((s,fp) => s + fp.amount, 0);

  // Which fixed payments are already paid this cycle?
  const paidFixedIds = cycleTransactions.filter(t => t.fixedPaymentId).map(t => t.fixedPaymentId);

  // Upcoming (unpaid) fixed payments
  const upcomingPayments = activeFixed
    .filter(fp => !paidFixedIds.includes(fp.id))
    .map(fp => {
      const next = getNextPaymentDate(fp.payDay, cycle.start, cycle.end);
      return { ...fp, nextDate: next, daysLeft: daysBetween(today, next) };
    })
    .sort((a,b) => a.nextDate - b.nextDate);

  // Unpaid fixed total
  const unpaidFixedTotal = upcomingPayments.reduce((s,fp) => s + fp.amount, 0);

  // Available balance = income - expenses - unpaid fixed payments
  const availableBalance = effectiveIncome - totalExpense - unpaidFixedTotal;

  // Category breakdown
  const byCategory = categories.map(cat => {
    const sum = expenses.filter(t => t.category === cat.id).reduce((s,t) => s + t.amount, 0);
    const budget = (data.budgets[ck] || {})[cat.id] || 0;
    return { ...cat, spent: sum, budget };
  }).filter(c => c.spent > 0 || c.budget > 0);

  // ---- Actions ----
  function addTransaction() {
    if (!form.amount || isNaN(Number(form.amount))) { showToastMsg("금액을 입력해주세요"); return; }
    const tx = { id: Date.now().toString(), amount: Number(form.amount), category: form.category, memo: form.memo, date: form.date, type: form.type };
    setData(d => ({ ...d, transactions: [...d.transactions, tx] }));
    setForm({ amount:"", category: categories[0]?.id || "other", memo:"", date: new Date().toISOString().slice(0,10), type:"expense" });
    setShowAdd(false);
    showToastMsg(form.type === "expense" ? "지출이 기록되었어요" : "수입이 기록되었어요");
  }

  function deleteTransaction(id) {
    setData(d => ({ ...d, transactions: d.transactions.filter(t => t.id !== id) }));
    showToastMsg("삭제되었어요");
  }

  function completePayment(fp) {
    const amt = Number(payAmount) || fp.amount;
    const tx = { id: Date.now().toString(), amount: amt, category: "fixed", memo: `${fp.name} 납부`, date: new Date().toISOString().slice(0,10), type: "expense", fixedPaymentId: fp.id };
    setData(d => ({ ...d, transactions: [...d.transactions, tx] }));
    setShowPayConfirm(null); setPayAmount("");
    showToastMsg(`${fp.name} 납부 완료!`);
  }

  function saveBudget(catId) {
    const val = Number(budgetInput);
    if (isNaN(val) || val < 0) return;
    setData(d => ({ ...d, budgets: { ...d.budgets, [ck]: { ...(d.budgets[ck]||{}), [catId]: val } } }));
    setEditingBudget(null); setBudgetInput("");
    showToastMsg("예산이 설정되었어요");
  }

  function addFixedPayment() {
    const { name, amount, payDay: pd, endDate } = fixedForm;
    if (!name || !amount || !pd || !endDate) { showToastMsg("필수 항목을 입력해주세요"); return; }
    if (isNaN(Number(amount)) || isNaN(Number(pd))) { showToastMsg("숫자를 확인해주세요"); return; }
    const payD = Number(pd);
    if (payD < 1 || payD > 31) { showToastMsg("납부일은 1~31 사이로"); return; }
    const fp = { id: editingFixedId || Date.now().toString(), name, amount: Number(amount), payDay: payD, endDate, memo: fixedForm.memo };
    setData(d => {
      const list = d.fixedPayments || [];
      if (editingFixedId) return { ...d, fixedPayments: list.map(x => x.id === editingFixedId ? fp : x) };
      return { ...d, fixedPayments: [...list, fp] };
    });
    setFixedForm({ name:"",amount:"",payDay:"",endDate:"",memo:"" });
    setShowAddFixed(false); setEditingFixedId(null);
    showToastMsg(editingFixedId ? "수정되었어요" : "고정납부가 추가되었어요");
  }

  function deleteFixed(id) {
    setData(d => ({ ...d, fixedPayments: (d.fixedPayments||[]).filter(f=>f.id!==id) }));
    showToastMsg("삭제되었어요");
  }

  function editFixed(fp) {
    setFixedForm({ name:fp.name, amount:String(fp.amount), payDay:String(fp.payDay), endDate:fp.endDate, memo:fp.memo||"" });
    setEditingFixedId(fp.id); setShowAddFixed(true);
  }

  function addCategory() {
    if (!catForm.name) { showToastMsg("카테고리 이름을 입력해주세요"); return; }
    const cat = { id: editingCatId || `cat_${Date.now()}`, name: catForm.name, icon: catForm.icon, color: catForm.color };
    setData(d => {
      const list = d.categories || DEFAULT_CATEGORIES;
      if (editingCatId) return { ...d, categories: list.map(c => c.id === editingCatId ? cat : c) };
      return { ...d, categories: [...list, cat] };
    });
    setCatForm({ name:"",icon:"📦",color:"#FF6B35" }); setShowAddCategory(false); setEditingCatId(null);
    showToastMsg(editingCatId ? "수정되었어요" : "카테고리가 추가되었어요");
  }

  function deleteCategory(id) {
    setData(d => ({ ...d, categories: (d.categories||[]).filter(c=>c.id!==id) }));
    showToastMsg("삭제되었어요");
  }

  function saveIncome() {
    setData(d => ({ ...d, incomeSettings: { ...d.incomeSettings, [ck]: { salary: incomeForm.salary, other: incomeForm.other } } }));
    showToastMsg("수입이 저장되었어요");
  }

  function savePayDay() {
    const v = Number(payDayInput);
    if (isNaN(v) || v < 1 || v > 31) { showToastMsg("1~31 사이로 입력해주세요"); return; }
    setData(d => ({ ...d, payDay: v }));
    setShowPayDayEdit(false);
    showToastMsg("급여일이 변경되었어요");
  }

  function saveSavings() {
    const v = Number(savingsInput);
    if (isNaN(v)) return;
    setData(d => ({ ...d, savings: v }));
    setShowSavingsEdit(false);
    showToastMsg("저금통이 업데이트되었어요");
  }

  // Navigate cycle
  const viewDate = new Date(today.getFullYear(), today.getMonth() + cycleOffset, today.getDate());

  function prevCycle() { setCycleOffset(o => o - 1); }
  function nextCycle() { setCycleOffset(o => o + 1); }

  // Recalc for viewed cycle
  const vCycle = getCycleRange(viewDate, payDay);
  const vCk = getCycleKey(viewDate, payDay);
  const vTransactions = data.transactions.filter(t => isInCycle(t.date, vCycle.start, vCycle.end));
  const vExpenses = vTransactions.filter(t => t.type === "expense");
  const vIncomes = vTransactions.filter(t => t.type === "income");
  const vTotalExpense = vExpenses.reduce((s,t) => s + t.amount, 0);
  const vTotalIncome = vIncomes.reduce((s,t) => s + t.amount, 0);
  const vIncomeSettings = (data.incomeSettings || {})[vCk] || {};
  const vSalary = Number(vIncomeSettings.salary || 0);
  const vOther = Number(vIncomeSettings.other || 0);
  const vEffectiveIncome = Math.max(vSalary + vOther, vTotalIncome);
  const vPaidFixedIds = vTransactions.filter(t => t.fixedPaymentId).map(t => t.fixedPaymentId);
  const vActiveFixed = (data.fixedPayments || []).filter(fp => new Date(fp.endDate) >= vCycle.start);
  const vUpcoming = vActiveFixed.filter(fp => !vPaidFixedIds.includes(fp.id)).map(fp => {
    const next = getNextPaymentDate(fp.payDay, vCycle.start, vCycle.end);
    return { ...fp, nextDate: next, daysLeft: daysBetween(today, next) };
  }).sort((a,b) => a.nextDate - b.nextDate);
  const vUnpaidTotal = vUpcoming.reduce((s,fp) => s + fp.amount, 0);
  const vAvailable = vEffectiveIncome - vTotalExpense - vUnpaidTotal;
  const vByCategory = categories.map(cat => {
    const sum = vExpenses.filter(t => t.category === cat.id).reduce((s,t) => s + t.amount, 0);
    const budget = (data.budgets[vCk] || {})[cat.id] || 0;
    return { ...cat, spent: sum, budget };
  }).filter(c => c.spent > 0 || c.budget > 0);

  const cycleLabelStart = `${vCycle.start.getMonth()+1}/${vCycle.start.getDate()}`;
  const cycleLabelEnd = `${vCycle.end.getMonth()+1}/${vCycle.end.getDate()}`;

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;900&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing:border-box;margin:0;padding:0; }
        input:focus,button:focus{outline:none;}
        @keyframes slideUp{from{transform:translateY(30px);opacity:0;}to{transform:translateY(0);opacity:1;}}
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes toastIn{from{transform:translateY(20px) scale(0.95);opacity:0;}to{transform:translateY(0) scale(1);opacity:1;}}
        .slide-up{animation:slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards;}
        .fade-in{animation:fadeIn 0.3s ease forwards;}
        .bar-fill{transition:width 0.8s cubic-bezier(0.16,1,0.3,1);}
        .hover-lift{transition:transform 0.2s ease,box-shadow 0.2s ease;cursor:pointer;}
        .hover-lift:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,0,0,0.08);}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerInner}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:30}}>💰</span>
            <span style={S.logo}>내 가계부</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button onClick={prevCycle} style={S.navBtn}>←</button>
            <span style={{fontSize:14,fontWeight:600,color:"#e2e8f0",minWidth:110,textAlign:"center"}}>{cycleLabelStart} ~ {cycleLabelEnd}</span>
            <button onClick={nextCycle} style={S.navBtn}>→</button>
            <button onClick={()=>signOut(auth)} style={{...S.navBtn,fontSize:11,width:"auto",padding:"0 8px",color:"#64748b"}}>로그아웃</button>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={S.tabBar}>
        {[{id:"home",label:"홈",icon:"🏠"},{id:"summary",label:"요약",icon:"📊"},{id:"budget",label:"예산설정",icon:"⚙️"},{id:"savings",label:"저금통",icon:"🐷"}].map(tab => (
          <button key={tab.id} onClick={()=>setView(tab.id)} style={{...S.tab,...(view===tab.id?S.tabActive:{})}}>
            <span style={{fontSize:18}}>{tab.icon}</span>
            <span style={{fontSize:12,fontWeight:view===tab.id?600:400}}>{tab.label}</span>
          </button>
        ))}
      </div>

      <div style={S.content}>

        {/* ==================== HOME ==================== */}
        {view === "home" && (
          <div className="slide-up">
            {/* Available Balance */}
            <div style={{background:"linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)",borderRadius:20,padding:24,border:"1px solid #1e293b",marginBottom:16,textAlign:"center"}}>
              <div style={{fontSize:15,color:"#94a3b8",fontWeight:500,marginBottom:8}}>사용 가능한 잔액</div>
              <div style={{fontSize:34,fontWeight:900,fontFamily:"'Space Mono',monospace",letterSpacing:"-1px",
                color: vAvailable >= 0 ? "#4ECDC4" : "#F43F5E"}}>{formatMoney(vAvailable)}</div>
              <div style={{fontSize:13,color:"#64748b",marginTop:8}}>
                수입 {formatMoney(vEffectiveIncome)} - 지출 {formatMoney(vTotalExpense)} - 납부예정 {formatMoney(vUnpaidTotal)}
              </div>
            </div>

            {/* Add Transaction Button */}
            <button onClick={()=>setShowAdd(true)} style={{
              width:"100%",padding:"16px",borderRadius:14,border:"2px dashed #2a3040",background:"#111827",
              color:"#94a3b8",fontSize:16,fontWeight:600,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif",
              marginBottom:20,display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all 0.2s",
            }}>
              <span style={{fontSize:22}}>+</span> 새 거래 추가
            </button>

            {/* Upcoming Payments */}
            <div style={{fontSize:18,fontWeight:700,color:"#e2e8f0",marginBottom:12}}>납부 예정</div>
            {vUpcoming.length === 0 ? (
              <div style={{...S.empty,padding:"32px 20px"}}><span style={{fontSize:40,display:"block",marginBottom:8}}>✅</span><span style={{color:"#64748b",fontSize:15}}>이번 주기 납부 완료!</span></div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {vUpcoming.map((fp,i) => (
                  <div key={fp.id} className="slide-up hover-lift" style={{
                    ...S.card, animationDelay:`${i*0.05}s`,
                    display:"flex",alignItems:"center",justifyContent:"space-between",
                    border: fp.daysLeft <= 5 ? "1px solid #F43F5E50" : "1px solid #1e293b",
                  }}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:14,color:"#64748b",fontFamily:"'Space Mono',monospace"}}>{`${fp.nextDate.getMonth()+1}/${String(fp.nextDate.getDate()).padStart(2,"0")}`}</span>
                        <span style={{fontSize:15,fontWeight:600,color:"#e2e8f0"}}>{fp.name}</span>
                        {fp.daysLeft <= 5 && fp.daysLeft >= 0 && <span style={{fontSize:11,background:"#F43F5E20",color:"#F43F5E",padding:"2px 8px",borderRadius:6,fontWeight:600}}>D-{fp.daysLeft}</span>}
                      </div>
                      {fp.memo && <div style={{fontSize:13,color:"#64748b",marginTop:2}}>{fp.memo}</div>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:16,fontWeight:700,color:"#818CF8",fontFamily:"'Space Mono',monospace"}}>{formatMoney(fp.amount)}</span>
                      <button onClick={()=>{setShowPayConfirm(fp);setPayAmount(String(fp.amount));}}
                        style={{padding:"8px 14px",borderRadius:10,border:"none",background:"#10B98130",color:"#10B981",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>
                        납부완료
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Already paid this cycle */}
            {vPaidFixedIds.length > 0 && (
              <div style={{marginTop:16}}>
                <div style={{fontSize:14,color:"#64748b",marginBottom:8}}>납부 완료</div>
                {vTransactions.filter(t=>t.fixedPaymentId).map(t => (
                  <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"#11182780",borderRadius:10,marginBottom:6,opacity:0.6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{color:"#10B981",fontSize:16}}>✓</span>
                      <span style={{fontSize:14,color:"#94a3b8"}}>{t.memo}</span>
                    </div>
                    <span style={{fontSize:14,color:"#64748b",fontFamily:"'Space Mono',monospace"}}>{formatMoney(t.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== SUMMARY ==================== */}
        {view === "summary" && (
          <div className="slide-up">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
              <div style={{...S.summaryCard,background:"linear-gradient(135deg,#0f2027 0%,#203a43 100%)"}}>
                <span style={{fontSize:14,color:"#94a3b8",fontWeight:500}}>수입</span>
                <span style={{fontSize:24,fontWeight:900,color:"#4ECDC4",fontFamily:"'Space Mono',monospace"}}>{formatMoney(vEffectiveIncome)}</span>
              </div>
              <div style={{...S.summaryCard,background:"linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)"}}>
                <span style={{fontSize:14,color:"#94a3b8",fontWeight:500}}>지출</span>
                <span style={{fontSize:24,fontWeight:900,color:"#FF6B35",fontFamily:"'Space Mono',monospace"}}>{formatMoney(vTotalExpense)}</span>
              </div>
            </div>

            <div style={{fontSize:18,fontWeight:700,color:"#e2e8f0",marginBottom:14}}>카테고리별 지출</div>
            {vByCategory.length === 0 ? (
              <div style={S.empty}><span style={{fontSize:48,display:"block",marginBottom:12}}>🌱</span><span style={{color:"#64748b",fontSize:15}}>아직 지출 내역이 없어요</span></div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {vByCategory.sort((a,b)=>b.spent-a.spent).map((cat,i) => (
                  <div key={cat.id} className="hover-lift" style={{...S.card,display:"flex",alignItems:"center",animationDelay:`${i*0.06}s`}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,flex:1}}>
                      <div style={{width:44,height:44,borderRadius:12,background:`${cat.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{cat.icon}</div>
                      <div>
                        <div style={{fontSize:15,fontWeight:600,color:"#e2e8f0"}}>{cat.name}</div>
                        {cat.budget > 0 && <div style={{fontSize:13,color:"#64748b",marginTop:2}}>예산 {formatMoney(cat.budget)}</div>}
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:17,fontWeight:700,color:"#e2e8f0",fontFamily:"'Space Mono',monospace"}}>{formatMoney(cat.spent)}</div>
                      {cat.budget > 0 && (
                        <div style={{fontSize:12,fontWeight:600,marginTop:2,color:cat.spent/cat.budget>1?"#F43F5E":cat.spent/cat.budget>0.8?"#D97706":"#10B981"}}>
                          {Math.round(cat.spent/cat.budget*100)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Transaction list */}
            <div style={{fontSize:18,fontWeight:700,color:"#e2e8f0",marginTop:24,marginBottom:14}}>
              거래 내역 <span style={{fontSize:14,color:"#64748b",fontWeight:400}}>{vTransactions.length}건</span>
            </div>
            {vTransactions.length === 0 ? (
              <div style={S.empty}><span style={{color:"#64748b",fontSize:15}}>내역이 없어요</span></div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {[...vTransactions].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).map((tx,i) => {
                  const cat = catObj[tx.category] || {icon:"📦",color:"#6B7280",name:tx.category};
                  return (
                    <div key={tx.id} className="slide-up" style={{...S.card,display:"flex",alignItems:"center",gap:12,padding:"12px 14px",animationDelay:`${i*0.03}s`}}>
                      <div style={{width:40,height:40,borderRadius:10,background:tx.type==="income"?"#4ECDC418":`${cat.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                        {tx.type==="income"?"💵":cat.icon}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:15,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.memo||(tx.type==="income"?"수입":cat.name)}</div>
                        <div style={{fontSize:13,color:"#64748b",marginTop:2}}>{tx.date.slice(5).replace("-","/")} · {cat.name}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:16,fontWeight:700,fontFamily:"'Space Mono',monospace",color:tx.type==="income"?"#4ECDC4":"#FF6B35"}}>
                          {tx.type==="income"?"+":"-"}{formatMoney(tx.amount)}
                        </span>
                        <button onClick={()=>deleteTransaction(tx.id)} style={S.deleteBtn}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== BUDGET SETTINGS ==================== */}
        {view === "budget" && (
          <div className="slide-up">
            {/* 1. Income Management */}
            <div style={{fontSize:18,fontWeight:700,color:"#e2e8f0",marginBottom:14}}>수입 관리</div>

            {/* Pay day setting */}
            <div style={{...S.card,marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:15,fontWeight:600,color:"#e2e8f0"}}>급여일 (가계부 주기)</div>
                  <div style={{fontSize:14,color:"#64748b",marginTop:2}}>매월 {payDay}일</div>
                </div>
                {!showPayDayEdit ? (
                  <button onClick={()=>{setShowPayDayEdit(true);setPayDayInput(String(payDay));}} style={{...S.btnSmall,background:"#1e293b",color:"#94a3b8"}}>변경</button>
                ) : (
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input type="number" value={payDayInput} onChange={e=>setPayDayInput(e.target.value)} min="1" max="31"
                      style={{...S.input,width:60,padding:"8px",textAlign:"center",fontSize:16}} autoFocus onKeyDown={e=>{if(e.key==="Enter")savePayDay();}}/>
                    <span style={{fontSize:14,color:"#64748b"}}>일</span>
                    <button onClick={savePayDay} style={S.btnSmall}>저장</button>
                    <button onClick={()=>setShowPayDayEdit(false)} style={{...S.btnSmall,background:"transparent",border:"1px solid #2a3040",color:"#64748b"}}>취소</button>
                  </div>
                )}
              </div>
            </div>

            {/* Income input */}
            <div style={{...S.card,marginBottom:20}}>
              <div style={{fontSize:15,fontWeight:600,color:"#e2e8f0",marginBottom:12}}>이번 주기 수입</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div>
                  <label style={S.label}>급여</label>
                  <input type="number" placeholder="0" value={incomeForm.salary || vIncomeSettings.salary || ""}
                    onChange={e=>setIncomeForm(f=>({...f,salary:e.target.value}))} style={{...S.input,fontSize:16}}/>
                </div>
                <div>
                  <label style={S.label}>기타소득</label>
                  <input type="number" placeholder="0" value={incomeForm.other || vIncomeSettings.other || ""}
                    onChange={e=>setIncomeForm(f=>({...f,other:e.target.value}))} style={{...S.input,fontSize:16}}/>
                </div>
              </div>
              <button onClick={saveIncome} style={{...S.btnPrimary,width:"100%",padding:"14px"}}>수입 저장</button>
            </div>

            {/* 2. Expense Management */}
            <div style={{fontSize:18,fontWeight:700,color:"#e2e8f0",marginBottom:14}}>지출 관리</div>

            {/* Categories */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:16,fontWeight:600,color:"#cbd5e1"}}>카테고리</div>
              <button onClick={()=>{setShowAddCategory(true);setEditingCatId(null);setCatForm({name:"",icon:"📦",color:"#FF6B35"});}}
                style={{...S.btnSmall,background:"linear-gradient(135deg,#FF6B35,#FF8F5E)",color:"#fff"}}>+ 추가</button>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
              {categories.map(cat => (
                <div key={cat.id} onClick={()=>{setCatForm({name:cat.name,icon:cat.icon,color:cat.color});setEditingCatId(cat.id);setShowAddCategory(true);}}
                  style={{display:"flex",alignItems:"center",gap:6,background:"#111827",borderRadius:10,padding:"8px 12px",border:"1px solid #1e293b",cursor:"pointer",transition:"all 0.15s"}}>
                  <span style={{fontSize:18}}>{cat.icon}</span>
                  <span style={{fontSize:14,color:"#e2e8f0",fontWeight:500}}>{cat.name}</span>
                </div>
              ))}
            </div>

            {/* Budget per category */}
            <div style={{fontSize:16,fontWeight:600,color:"#cbd5e1",marginBottom:10}}>카테고리별 예산</div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
              {categories.map((cat,i) => {
                const budget = (data.budgets[vCk]||{})[cat.id] || 0;
                const isEd = editingBudget === cat.id;
                return (
                  <div key={cat.id} style={{...S.card,border:isEd?`1px solid ${cat.color}60`:"1px solid #1e293b"}}>
                    <div onClick={()=>{if(!isEd){setEditingBudget(cat.id);setBudgetInput(budget>0?String(budget):"");}}} style={{cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:20}}>{cat.icon}</span>
                        <span style={{fontSize:15,fontWeight:600,color:"#e2e8f0"}}>{cat.name}</span>
                      </div>
                      <span style={{fontSize:15,fontWeight:600,color:cat.color,fontFamily:"'Space Mono',monospace"}}>{budget > 0 ? formatMoney(budget) : "미설정"}</span>
                    </div>
                    {isEd && (
                      <div className="fade-in" style={{display:"flex",gap:8,marginTop:10}}>
                        <input type="number" placeholder="예산 금액 (원)" value={budgetInput} onChange={e=>setBudgetInput(e.target.value)} autoFocus
                          style={{...S.input,fontSize:16}} onKeyDown={e=>{if(e.key==="Enter")saveBudget(cat.id);}}/>
                        <button onClick={()=>saveBudget(cat.id)} style={S.btnSmall}>저장</button>
                        <button onClick={()=>{setEditingBudget(null);setBudgetInput("");}} style={{...S.btnSmall,background:"transparent",border:"1px solid #2a3040",color:"#64748b"}}>취소</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Fixed Payments */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:16,fontWeight:600,color:"#cbd5e1"}}>고정 납부</div>
              <button onClick={()=>{setShowAddFixed(true);setEditingFixedId(null);setFixedForm({name:"",amount:"",payDay:"",endDate:"",memo:""});}}
                style={{...S.btnSmall,background:"linear-gradient(135deg,#818CF8,#a78bfa)",color:"#fff"}}>+ 추가</button>
            </div>
            {(data.fixedPayments||[]).length === 0 ? (
              <div style={{...S.empty,padding:"32px"}}><span style={{fontSize:40,display:"block",marginBottom:8}}>🏦</span><span style={{color:"#64748b",fontSize:15}}>등록된 고정납부가 없어요</span></div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {(data.fixedPayments||[]).map((fp,i) => {
                  const endD = new Date(fp.endDate);
                  const isExpired = endD < today;
                  const mRemain = monthsBetween(today, endD);
                  return (
                    <div key={fp.id} className="slide-up" style={{...S.card,animationDelay:`${i*0.05}s`,opacity:isExpired?0.5:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:15,fontWeight:700,color:"#e2e8f0"}}>{fp.name}</span>
                            {isExpired && <span style={{fontSize:11,background:"#47556830",color:"#64748b",padding:"2px 8px",borderRadius:4,fontWeight:600}}>만기완료</span>}
                          </div>
                          {fp.memo && <div style={{fontSize:13,color:"#64748b",marginTop:3}}>{fp.memo}</div>}
                          <div style={{display:"flex",gap:12,marginTop:6,fontSize:13,color:"#94a3b8"}}>
                            <span>매월 {fp.payDay}일</span>
                            <span>만기 {fp.endDate.slice(0,7).replace("-",".")}</span>
                            {!isExpired && <span style={{color:"#818CF8"}}>잔여 {mRemain}개월</span>}
                          </div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:16,fontWeight:700,color:"#818CF8",fontFamily:"'Space Mono',monospace"}}>{formatMoney(fp.amount)}</span>
                          <button onClick={()=>editFixed(fp)} style={{...S.deleteBtn,color:"#818CF8",fontSize:14}}>✎</button>
                          <button onClick={()=>deleteFixed(fp.id)} style={{...S.deleteBtn,color:"#F43F5E"}}>✕</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== SAVINGS ==================== */}
        {view === "savings" && (
          <div className="slide-up">
            <div style={{textAlign:"center",marginBottom:24}}>
              <span style={{fontSize:64,display:"block",marginBottom:12}}>🐷</span>
              <div style={{fontSize:16,color:"#94a3b8",fontWeight:500,marginBottom:8}}>묶여있는 돈 (예금/적금 등)</div>
              <div style={{fontSize:36,fontWeight:900,fontFamily:"'Space Mono',monospace",color:"#F59E0B"}}>{formatMoney(data.savings || 0)}</div>
            </div>

            {!showSavingsEdit ? (
              <button onClick={()=>{setShowSavingsEdit(true);setSavingsInput(String(data.savings||0));}}
                style={{...S.btnPrimary,width:"100%",padding:"16px",fontSize:16,background:"linear-gradient(135deg,#F59E0B,#FBBF24)"}}>
                금액 수정
              </button>
            ) : (
              <div className="fade-in">
                <label style={S.label}>총 금액</label>
                <input type="number" value={savingsInput} onChange={e=>setSavingsInput(e.target.value)} autoFocus
                  style={{...S.input,fontSize:22,fontWeight:700,fontFamily:"'Space Mono',monospace",textAlign:"center",marginBottom:12}}/>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>setShowSavingsEdit(false)} style={{...S.btnGhost,flex:1,padding:"14px"}}>취소</button>
                  <button onClick={saveSavings} style={{...S.btnPrimary,flex:2,padding:"14px",background:"linear-gradient(135deg,#F59E0B,#FBBF24)"}}>저장</button>
                </div>
              </div>
            )}

            <div style={{marginTop:32,padding:"16px",background:"#111827",borderRadius:14,border:"1px solid #1e293b"}}>
              <div style={{fontSize:15,fontWeight:600,color:"#e2e8f0",marginBottom:8}}>총 자산 현황</div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:14,color:"#94a3b8",marginBottom:6}}>
                <span>사용 가능한 잔액</span><span style={{color:"#4ECDC4",fontFamily:"'Space Mono',monospace"}}>{formatMoney(vAvailable)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:14,color:"#94a3b8",marginBottom:8}}>
                <span>묶여있는 돈</span><span style={{color:"#F59E0B",fontFamily:"'Space Mono',monospace"}}>{formatMoney(data.savings||0)}</span>
              </div>
              <div style={{borderTop:"1px solid #1e293b",paddingTop:8,display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:700}}>
                <span style={{color:"#e2e8f0"}}>합계</span>
                <span style={{color:"#e2e8f0",fontFamily:"'Space Mono',monospace"}}>{formatMoney(vAvailable + (data.savings||0))}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== MODALS ==================== */}

      {/* Add Transaction */}
      {showAdd && (
        <div className="fade-in" style={S.overlay} onClick={()=>setShowAdd(false)}>
          <div className="slide-up" style={S.modal} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:20,fontWeight:700,color:"#e2e8f0",marginBottom:20}}>새 거래 추가</div>
            <div style={{display:"flex",gap:4,marginBottom:16,background:"#0f172a",borderRadius:12,padding:4}}>
              {[{v:"expense",l:"지출"},{v:"income",l:"수입"}].map(t => (
                <button key={t.v} onClick={()=>setForm(f=>({...f,type:t.v}))}
                  style={{flex:1,padding:"12px 0",borderRadius:10,border:"none",fontSize:16,fontWeight:600,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif",
                    background:form.type===t.v?(t.v==="expense"?"#FF6B35":"#4ECDC4"):"transparent",color:form.type===t.v?"#fff":"#64748b"}}>{t.l}</button>
              ))}
            </div>
            <div style={{marginBottom:16}}>
              <label style={S.label}>금액</label>
              <input type="number" placeholder="0" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} autoFocus
                style={{...S.input,fontSize:26,fontWeight:700,fontFamily:"'Space Mono',monospace",textAlign:"center"}}/>
            </div>
            {form.type === "expense" && (
              <div style={{marginBottom:16}}>
                <label style={S.label}>카테고리</label>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  {categories.map(cat => (
                    <button key={cat.id} onClick={()=>setForm(f=>({...f,category:cat.id}))}
                      style={{padding:"12px 4px",borderRadius:12,border:form.category===cat.id?`2px solid ${cat.color}`:"2px solid transparent",
                        cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif",background:form.category===cat.id?`${cat.color}25`:"#0f172a"}}>
                      <div style={{fontSize:22}}>{cat.icon}</div>
                      <div style={{fontSize:12,color:form.category===cat.id?cat.color:"#64748b",fontWeight:500,marginTop:3}}>{cat.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{marginBottom:16}}>
              <label style={S.label}>메모</label>
              <input type="text" placeholder="간단한 메모 (선택)" value={form.memo} onChange={e=>setForm(f=>({...f,memo:e.target.value}))} style={{...S.input,fontSize:16}}/>
            </div>
            <div style={{marginBottom:22}}>
              <label style={S.label}>날짜</label>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{...S.input,fontSize:16,colorScheme:"dark"}}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowAdd(false)} style={{...S.btnGhost,flex:1,padding:"14px",fontSize:16}}>취소</button>
              <button onClick={addTransaction} style={{...S.btnPrimary,flex:2,padding:"14px",fontSize:16}}>추가하기</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Fixed Payment */}
      {showAddFixed && (
        <div className="fade-in" style={S.overlay} onClick={()=>{setShowAddFixed(false);setEditingFixedId(null);}}>
          <div className="slide-up" style={S.modal} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:20,fontWeight:700,color:"#e2e8f0",marginBottom:20}}>{editingFixedId?"고정납부 수정":"고정납부 추가"}</div>
            <div style={{marginBottom:16}}>
              <label style={S.label}>납부명 *</label>
              <input type="text" placeholder="예: OO은행 대출" value={fixedForm.name} onChange={e=>setFixedForm(f=>({...f,name:e.target.value}))} autoFocus style={{...S.input,fontSize:16}}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={S.label}>월 납부 예상 금액 *</label>
              <input type="number" placeholder="원금+이자 합산 금액" value={fixedForm.amount} onChange={e=>setFixedForm(f=>({...f,amount:e.target.value}))} style={{...S.input,fontSize:16}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <div>
                <label style={S.label}>납부일 (매월) *</label>
                <input type="number" placeholder="25" min="1" max="31" value={fixedForm.payDay} onChange={e=>setFixedForm(f=>({...f,payDay:e.target.value}))} style={{...S.input,fontSize:16}}/>
              </div>
              <div>
                <label style={S.label}>만기일 *</label>
                <input type="date" value={fixedForm.endDate} onChange={e=>setFixedForm(f=>({...f,endDate:e.target.value}))} style={{...S.input,fontSize:16,colorScheme:"dark"}}/>
              </div>
            </div>
            <div style={{marginBottom:22}}>
              <label style={S.label}>메모</label>
              <input type="text" placeholder="은행명, 금리 등 (선택)" value={fixedForm.memo} onChange={e=>setFixedForm(f=>({...f,memo:e.target.value}))} style={{...S.input,fontSize:16}}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setShowAddFixed(false);setEditingFixedId(null);}} style={{...S.btnGhost,flex:1,padding:"14px",fontSize:16}}>취소</button>
              <button onClick={addFixedPayment} style={{...S.btnPrimary,flex:2,padding:"14px",fontSize:16}}>{editingFixedId?"수정하기":"추가하기"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Category */}
      {showAddCategory && (
        <div className="fade-in" style={S.overlay} onClick={()=>{setShowAddCategory(false);setEditingCatId(null);}}>
          <div className="slide-up" style={S.modal} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:20,fontWeight:700,color:"#e2e8f0",marginBottom:20}}>{editingCatId?"카테고리 수정":"카테고리 추가"}</div>
            <div style={{marginBottom:16}}>
              <label style={S.label}>이름</label>
              <input type="text" placeholder="카테고리 이름" value={catForm.name} onChange={e=>setCatForm(f=>({...f,name:e.target.value}))} autoFocus style={{...S.input,fontSize:16}}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={S.label}>아이콘</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {EMOJI_LIST.map(em => (
                  <button key={em} onClick={()=>setCatForm(f=>({...f,icon:em}))}
                    style={{width:44,height:44,borderRadius:10,border:catForm.icon===em?"2px solid #FF6B35":"2px solid transparent",
                      background:catForm.icon===em?"#FF6B3520":"#0f172a",cursor:"pointer",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center"}}>{em}</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:22}}>
              <label style={S.label}>색상</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {COLOR_LIST.map(col => (
                  <button key={col} onClick={()=>setCatForm(f=>({...f,color:col}))}
                    style={{width:36,height:36,borderRadius:10,border:catForm.color===col?"3px solid #fff":"3px solid transparent",
                      background:col,cursor:"pointer"}}/>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              {editingCatId && <button onClick={()=>{deleteCategory(editingCatId);setShowAddCategory(false);setEditingCatId(null);}}
                style={{...S.btnGhost,padding:"14px",color:"#F43F5E",borderColor:"#F43F5E40",fontSize:16}}>삭제</button>}
              <button onClick={()=>{setShowAddCategory(false);setEditingCatId(null);}} style={{...S.btnGhost,flex:1,padding:"14px",fontSize:16}}>취소</button>
              <button onClick={addCategory} style={{...S.btnPrimary,flex:2,padding:"14px",fontSize:16}}>{editingCatId?"수정":"추가"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirm Modal */}
      {showPayConfirm && (
        <div className="fade-in" style={S.overlay} onClick={()=>setShowPayConfirm(null)}>
          <div className="slide-up" style={{...S.modal,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:20,fontWeight:700,color:"#e2e8f0",marginBottom:6}}>{showPayConfirm.name}</div>
            <div style={{fontSize:14,color:"#64748b",marginBottom:20}}>실제 납부 금액을 확인해주세요</div>
            <input type="number" value={payAmount} onChange={e=>setPayAmount(e.target.value)}
              style={{...S.input,fontSize:26,fontWeight:700,fontFamily:"'Space Mono',monospace",textAlign:"center",marginBottom:20}}/>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowPayConfirm(null)} style={{...S.btnGhost,flex:1,padding:"14px",fontSize:16}}>취소</button>
              <button onClick={()=>completePayment(showPayConfirm)}
                style={{...S.btnPrimary,flex:2,padding:"14px",fontSize:16,background:"linear-gradient(135deg,#10B981,#34D399)"}}>납부 완료</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}

// ======================== STYLES ========================
const S = {
  root: { fontFamily:"'Noto Sans KR',sans-serif", background:"#0b0f1a", minHeight:"100vh", color:"#e2e8f0", position:"relative", maxWidth:500, margin:"0 auto", paddingBottom:40 },
  header: { background:"linear-gradient(180deg,#0f1729 0%,#0b0f1a 100%)", padding:"16px 20px 12px", position:"sticky", top:0, zIndex:50, backdropFilter:"blur(12px)" },
  headerInner: { display:"flex", justifyContent:"space-between", alignItems:"center" },
  logo: { fontSize:22, fontWeight:900, background:"linear-gradient(135deg,#FF6B35,#FFB347)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" },
  navBtn: { width:34, height:34, borderRadius:8, border:"1px solid #1e293b", background:"#111827", color:"#94a3b8", fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Noto Sans KR',sans-serif" },
  tabBar: { display:"flex", gap:2, padding:"0 16px 12px", background:"#0b0f1a", position:"sticky", top:56, zIndex:40 },
  tab: { flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"10px 0", borderRadius:12, border:"none", background:"transparent", color:"#64748b", cursor:"pointer", transition:"all 0.2s", fontFamily:"'Noto Sans KR',sans-serif" },
  tabActive: { background:"#1e293b", color:"#FF6B35" },
  content: { padding:"0 20px 20px" },
  card: { background:"#111827", borderRadius:14, padding:"14px 16px", border:"1px solid #1e293b" },
  summaryCard: { borderRadius:16, padding:18, display:"flex", flexDirection:"column", gap:6, border:"1px solid #1e293b" },
  empty: { textAlign:"center", padding:"48px 20px", color:"#475569", fontSize:15 },
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100, padding:16 },
  modal: { background:"#1a1f2e", borderRadius:24, padding:28, width:"100%", maxWidth:460, maxHeight:"85vh", overflow:"auto", border:"1px solid #2a3040" },
  label: { display:"block", fontSize:13, fontWeight:600, color:"#94a3b8", marginBottom:6, letterSpacing:0.5 },
  input: { width:"100%", padding:"14px 16px", borderRadius:12, border:"1px solid #2a3040", background:"#0f172a", color:"#e2e8f0", fontSize:15, fontFamily:"'Noto Sans KR',sans-serif" },
  btnPrimary: { borderRadius:12, border:"none", background:"linear-gradient(135deg,#FF6B35,#FF8F5E)", color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer", fontFamily:"'Noto Sans KR',sans-serif" },
  btnGhost: { borderRadius:12, border:"1px solid #2a3040", background:"transparent", color:"#94a3b8", fontSize:16, fontWeight:500, cursor:"pointer", fontFamily:"'Noto Sans KR',sans-serif" },
  btnSmall: { padding:"8px 14px", borderRadius:8, border:"none", background:"linear-gradient(135deg,#FF6B35,#FF8F5E)", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Noto Sans KR',sans-serif" },
  deleteBtn: { width:28, height:28, borderRadius:6, border:"none", background:"transparent", color:"#475569", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Noto Sans KR',sans-serif" },
  toast: { position:"fixed", bottom:30, left:"50%", transform:"translateX(-50%)", background:"#1e293b", color:"#e2e8f0", padding:"12px 24px", borderRadius:12, fontSize:15, fontWeight:500, boxShadow:"0 8px 30px rgba(0,0,0,0.3)", zIndex:200, animation:"toastIn 0.3s ease", border:"1px solid #2a3040" },
};
