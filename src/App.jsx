import { useState, useEffect, useRef } from "react";

const CATEGORIES = [
  { id: "food", name: "식비", icon: "🍚", color: "#FF6B35" },
  { id: "transport", name: "교통", icon: "🚌", color: "#4ECDC4" },
  { id: "shopping", name: "쇼핑", icon: "🛍️", color: "#A855F7" },
  { id: "housing", name: "주거", icon: "🏠", color: "#3B82F6" },
  { id: "culture", name: "문화", icon: "🎬", color: "#F43F5E" },
  { id: "health", name: "건강", icon: "💊", color: "#10B981" },
  { id: "cafe", name: "카페", icon: "☕", color: "#D97706" },
  { id: "loan", name: "대출/이자", icon: "🏦", color: "#818CF8" },
  { id: "other", name: "기타", icon: "📦", color: "#6B7280" },
];

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

function formatMoney(n) {
  return n.toLocaleString("ko-KR") + "원";
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
}

function daysBetween(a, b) {
  const d1 = new Date(a); const d2 = new Date(b);
  return Math.ceil((d2 - d1) / (1000*60*60*24));
}

function monthsBetween(fromDate, toDate) {
  const d1 = new Date(fromDate); const d2 = new Date(toDate);
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

function getNextPaymentDate(dayOfMonth) {
  const now = new Date();
  let next = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (next <= now) next = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
  return next;
}

const initialData = {
  transactions: [],
  budgets: {},
  fixedPayments: [],
};

export default function App() {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState("home");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ amount: "", category: "food", memo: "", date: new Date().toISOString().slice(0,10), type: "expense" });
  const [editingBudget, setEditingBudget] = useState(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [showAddFixed, setShowAddFixed] = useState(false);
  const [fixedForm, setFixedForm] = useState({
    name: "", principal: "", interest: "", payDay: "", endDate: "", memo: "",
  });
  const [editingFixedId, setEditingFixedId] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("budget-tracker-data");
      if (saved) {
        const parsed = JSON.parse(saved);
        setData({ ...initialData, ...parsed });
      }
    } catch (e) { console.log("No saved data"); }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem("budget-tracker-data", JSON.stringify(data)); }
    catch (e) { console.error("Save failed", e); }
  }, [data, loaded]);

  function showToast(msg) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }

  const mk = getMonthKey(currentMonth);
  const monthTransactions = data.transactions.filter(t => t.date.startsWith(mk));
  const expenses = monthTransactions.filter(t => t.type === "expense");
  const incomes = monthTransactions.filter(t => t.type === "income");
  const totalExpense = expenses.reduce((s,t) => s + t.amount, 0);
  const totalIncome = incomes.reduce((s,t) => s + t.amount, 0);

  // Fixed payments monthly total
  const fixedMonthlyTotal = (data.fixedPayments || []).reduce((s, fp) => {
    const endD = new Date(fp.endDate);
    const cmStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    if (endD < cmStart) return s;
    return s + fp.principal + fp.interest;
  }, 0);

  const byCategory = CATEGORIES.map(cat => {
    const sum = expenses.filter(t => t.category === cat.id).reduce((s,t) => s + t.amount, 0);
    const budget = (data.budgets[mk] || {})[cat.id] || 0;
    let fixedSum = 0;
    if (cat.id === "loan") fixedSum = fixedMonthlyTotal;
    return { ...cat, spent: sum, budget, fixedSum };
  }).filter(c => c.spent > 0 || c.budget > 0 || c.fixedSum > 0);

  const totalBudget = Object.values(data.budgets[mk] || {}).reduce((s,v)=>s+v,0);

  function addTransaction() {
    if (!form.amount || isNaN(Number(form.amount))) { showToast("금액을 입력해주세요"); return; }
    const tx = {
      id: Date.now().toString(),
      amount: Number(form.amount),
      category: form.category,
      memo: form.memo,
      date: form.date,
      type: form.type,
    };
    setData(d => ({ ...d, transactions: [...d.transactions, tx] }));
    setForm({ amount: "", category: "food", memo: "", date: new Date().toISOString().slice(0,10), type: "expense" });
    setShowAdd(false);
    showToast(form.type === "expense" ? "지출이 기록되었어요" : "수입이 기록되었어요");
  }

  function deleteTransaction(id) {
    setData(d => ({ ...d, transactions: d.transactions.filter(t => t.id !== id) }));
    showToast("삭제되었어요");
  }

  function saveBudget(catId) {
    const val = Number(budgetInput);
    if (isNaN(val) || val < 0) return;
    setData(d => ({
      ...d,
      budgets: { ...d.budgets, [mk]: { ...(d.budgets[mk] || {}), [catId]: val } }
    }));
    setEditingBudget(null);
    setBudgetInput("");
    showToast("예산이 설정되었어요");
  }

  function prevMonth() { setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth()-1, 1)); }
  function nextMonth() { setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth()+1, 1)); }

  function addFixedPayment() {
    const { name, principal, interest, payDay, endDate } = fixedForm;
    if (!name || !principal || !payDay || !endDate) { showToast("필수 항목을 입력해주세요"); return; }
    if (isNaN(Number(principal)) || isNaN(Number(interest || 0)) || isNaN(Number(payDay))) { showToast("숫자를 확인해주세요"); return; }
    const pd = Number(payDay);
    if (pd < 1 || pd > 31) { showToast("납부일은 1~31 사이로 입력해주세요"); return; }

    const fp = {
      id: editingFixedId || Date.now().toString(),
      name,
      principal: Number(principal),
      interest: Number(interest || 0),
      payDay: pd,
      endDate,
      memo: fixedForm.memo,
    };

    setData(d => {
      const existing = (d.fixedPayments || []);
      if (editingFixedId) {
        return { ...d, fixedPayments: existing.map(x => x.id === editingFixedId ? fp : x) };
      }
      return { ...d, fixedPayments: [...existing, fp] };
    });
    setFixedForm({ name: "", principal: "", interest: "", payDay: "", endDate: "", memo: "" });
    setShowAddFixed(false);
    setEditingFixedId(null);
    showToast(editingFixedId ? "수정되었어요" : "고정납부가 추가되었어요");
  }

  function deleteFixed(id) {
    setData(d => ({ ...d, fixedPayments: (d.fixedPayments || []).filter(f => f.id !== id) }));
    showToast("삭제되었어요");
  }

  function editFixed(fp) {
    setFixedForm({
      name: fp.name,
      principal: String(fp.principal),
      interest: String(fp.interest),
      payDay: String(fp.payDay),
      endDate: fp.endDate,
      memo: fp.memo || "",
    });
    setEditingFixedId(fp.id);
    setShowAddFixed(true);
  }

  const catObj = Object.fromEntries(CATEGORIES.map(c=>[c.id, c]));
  const today = new Date();

  return (
    <div style={styles.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;900&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus, button:focus { outline: none; }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes toastIn { from { transform: translateY(20px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        .slide-up { animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards; }
        .fade-in { animation: fadeIn 0.3s ease forwards; }
        .bar-fill { transition: width 0.8s cubic-bezier(0.16,1,0.3,1); }
        .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; cursor: pointer; }
        .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.08); }
        .hover-scale:hover { transform: scale(1.05); }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:28}}>💰</span>
            <span style={styles.logo}>내 가계부</span>
          </div>
          <div style={styles.monthNav}>
            <button onClick={prevMonth} style={styles.navBtn}>←</button>
            <span style={styles.monthLabel}>
              {currentMonth.getFullYear()}년 {MONTHS[currentMonth.getMonth()]}
            </span>
            <button onClick={nextMonth} style={styles.navBtn}>→</button>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={styles.tabBar}>
        {[
          {id:"home",label:"홈",icon:"📊"},
          {id:"list",label:"내역",icon:"📋"},
          {id:"fixed",label:"고정납부",icon:"🏦"},
          {id:"budget",label:"예산",icon:"🎯"},
        ].map(tab => (
          <button key={tab.id} onClick={()=>setView(tab.id)}
            style={{...styles.tab,...(view===tab.id ? styles.tabActive : {})}}>
            <span style={{fontSize:16}}>{tab.icon}</span>
            <span style={{fontSize:11,fontWeight:view===tab.id?600:400}}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>

        {/* ===== HOME ===== */}
        {view === "home" && (
          <div className="slide-up">
            <div style={styles.summaryGrid}>
              <div style={{...styles.summaryCard, background:"linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"}}>
                <span style={{fontSize:13,color:"#94a3b8",fontWeight:500}}>이번 달 지출</span>
                <span style={{fontSize:24,fontWeight:900,color:"#FF6B35",fontFamily:"'Space Mono',monospace",letterSpacing:"-1px"}}>
                  {formatMoney(totalExpense)}
                </span>
                {totalBudget > 0 && (
                  <div style={{marginTop:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#64748b",marginBottom:4}}>
                      <span>예산 대비</span>
                      <span>{Math.round(totalExpense/totalBudget*100)}%</span>
                    </div>
                    <div style={{height:4,borderRadius:2,background:"#2a2a4a",overflow:"hidden"}}>
                      <div className="bar-fill" style={{
                        height:"100%",width:`${Math.min(100,totalExpense/totalBudget*100)}%`,borderRadius:2,
                        background: totalExpense/totalBudget > 1 ? "#F43F5E" : totalExpense/totalBudget > 0.8 ? "#D97706" : "#10B981",
                      }}/>
                    </div>
                  </div>
                )}
              </div>
              <div style={{...styles.summaryCard, background:"linear-gradient(135deg, #0f2027 0%, #203a43 100%)"}}>
                <span style={{fontSize:13,color:"#94a3b8",fontWeight:500}}>이번 달 수입</span>
                <span style={{fontSize:24,fontWeight:900,color:"#4ECDC4",fontFamily:"'Space Mono',monospace",letterSpacing:"-1px"}}>
                  {formatMoney(totalIncome)}
                </span>
                <div style={{marginTop:10,fontSize:13,color: totalIncome - totalExpense >= 0 ? "#10B981" : "#F43F5E",fontWeight:600}}>
                  잔액: {formatMoney(totalIncome - totalExpense)}
                </div>
              </div>
            </div>

            {(data.fixedPayments || []).length > 0 && (
              <div style={{marginBottom:20}}>
                <div style={{...styles.summaryCard, background:"linear-gradient(135deg, #1a1033 0%, #1e1145 100%)", border:"1px solid #312e81"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:13,color:"#a5b4fc",fontWeight:500}}>🏦 고정납부 (월)</span>
                    <span style={{fontSize:11,color:"#64748b",cursor:"pointer"}} onClick={()=>setView("fixed")}>자세히 →</span>
                  </div>
                  <span style={{fontSize:22,fontWeight:900,color:"#818CF8",fontFamily:"'Space Mono',monospace",letterSpacing:"-1px"}}>
                    {formatMoney(fixedMonthlyTotal)}
                  </span>
                  <div style={{fontSize:12,color:"#64748b",marginTop:2}}>
                    {(data.fixedPayments || []).length}건의 고정 지출
                  </div>
                </div>
              </div>
            )}

            <div style={styles.sectionTitle}>카테고리별 지출</div>
            {byCategory.length === 0 ? (
              <div style={styles.empty}>
                <span style={{fontSize:48,display:"block",marginBottom:12}}>🌱</span>
                <span style={{color:"#64748b"}}>아직 이번 달 내역이 없어요</span>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {byCategory.sort((a,b)=>(b.spent+b.fixedSum)-(a.spent+a.fixedSum)).map((cat,i) => (
                  <div key={cat.id} className="hover-lift" style={{...styles.catRow,animationDelay:`${i*0.06}s`}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                      <div style={{
                        width:40,height:40,borderRadius:12,background:`${cat.color}18`,
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,
                      }}>{cat.icon}</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:"#e2e8f0"}}>{cat.name}</div>
                        <div style={{fontSize:12,color:"#64748b",marginTop:2}}>
                          {cat.budget > 0 ? `예산 ${formatMoney(cat.budget)}` : "예산 미설정"}
                          {cat.fixedSum > 0 && cat.id === "loan" && ` · 고정 ${formatMoney(cat.fixedSum)}`}
                        </div>
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:15,fontWeight:700,color:"#e2e8f0",fontFamily:"'Space Mono',monospace"}}>
                        {formatMoney(cat.spent + cat.fixedSum)}
                      </div>
                      {cat.budget > 0 && (
                        <div style={{
                          fontSize:11,fontWeight:600,marginTop:2,
                          color: (cat.spent+cat.fixedSum)/cat.budget > 1 ? "#F43F5E" : (cat.spent+cat.fixedSum)/cat.budget > 0.8 ? "#D97706" : "#10B981",
                        }}>
                          {Math.round((cat.spent+cat.fixedSum)/cat.budget*100)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== LIST ===== */}
        {view === "list" && (
          <div className="slide-up">
            <div style={styles.sectionTitle}>
              거래 내역
              <span style={{fontSize:13,color:"#64748b",fontWeight:400,marginLeft:8}}>{monthTransactions.length}건</span>
            </div>
            {monthTransactions.length === 0 ? (
              <div style={styles.empty}>
                <span style={{fontSize:48,display:"block",marginBottom:12}}>📝</span>
                <span style={{color:"#64748b"}}>내역이 없어요. 아래 + 버튼으로 추가해보세요!</span>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {[...monthTransactions].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).map((tx,i) => {
                  const cat = catObj[tx.category] || CATEGORIES[8];
                  return (
                    <div key={tx.id} className="slide-up hover-lift" style={{...styles.txRow,animationDelay:`${i*0.04}s`}}>
                      <div style={{
                        width:38,height:38,borderRadius:10,
                        background: tx.type==="income" ? "#4ECDC418" : `${cat.color}18`,
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,
                      }}>
                        {tx.type==="income" ? "💵" : cat.icon}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {tx.memo || (tx.type==="income" ? "수입" : cat.name)}
                        </div>
                        <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{tx.date.slice(5).replace("-","/")} · {cat.name}</div>
                      </div>
                      <div style={{textAlign:"right",display:"flex",alignItems:"center",gap:8}}>
                        <span style={{
                          fontSize:14,fontWeight:700,fontFamily:"'Space Mono',monospace",
                          color: tx.type==="income" ? "#4ECDC4" : "#FF6B35",
                        }}>
                          {tx.type==="income" ? "+" : "-"}{formatMoney(tx.amount)}
                        </span>
                        <button onClick={()=>deleteTransaction(tx.id)} style={styles.deleteBtn}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== FIXED PAYMENTS ===== */}
        {view === "fixed" && (
          <div className="slide-up">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={styles.sectionTitle}>고정납부 관리</div>
              <button
                onClick={()=>{setShowAddFixed(true);setEditingFixedId(null);setFixedForm({name:"",principal:"",interest:"",payDay:"",endDate:"",memo:""});}}
                style={{...styles.btnPrimary,padding:"8px 14px",fontSize:12,borderRadius:10,display:"flex",alignItems:"center",gap:4}}
              >
                <span style={{fontSize:16}}>+</span> 추가
              </button>
            </div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:16}}>
              매월 고정으로 나가는 대출금·이자를 관리하세요
            </div>

            {(data.fixedPayments || []).length > 0 && (
              <div style={{
                background:"linear-gradient(135deg, #1a1033 0%, #1e1145 100%)",
                borderRadius:16,padding:16,marginBottom:16,border:"1px solid #312e81",
              }}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:12,color:"#a5b4fc",fontWeight:500,marginBottom:4}}>월 납부 총액</div>
                    <div style={{fontSize:24,fontWeight:900,color:"#818CF8",fontFamily:"'Space Mono',monospace"}}>
                      {formatMoney(fixedMonthlyTotal)}
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:12,color:"#a5b4fc",fontWeight:500,marginBottom:4}}>총 원금 / 이자</div>
                    <div style={{fontSize:14,fontWeight:700,color:"#c4b5fd",fontFamily:"'Space Mono',monospace"}}>
                      {formatMoney((data.fixedPayments||[]).reduce((s,f)=>s+f.principal,0))}
                    </div>
                    <div style={{fontSize:12,color:"#f0abfc",marginTop:2,fontFamily:"'Space Mono',monospace"}}>
                      + {formatMoney((data.fixedPayments||[]).reduce((s,f)=>s+f.interest,0))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(data.fixedPayments || []).length === 0 ? (
              <div style={styles.empty}>
                <span style={{fontSize:48,display:"block",marginBottom:12}}>🏦</span>
                <span style={{color:"#64748b"}}>등록된 고정납부가 없어요</span>
                <div style={{fontSize:12,color:"#475569",marginTop:8}}>위의 + 추가 버튼으로 등록해보세요</div>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {(data.fixedPayments || []).map((fp, i) => {
                  const nextPay = getNextPaymentDate(fp.payDay);
                  const daysLeft = daysBetween(today.toISOString().slice(0,10), nextPay.toISOString().slice(0,10));
                  const monthsRemain = monthsBetween(
                    `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-01`,
                    fp.endDate
                  );
                  const remainTotal = Math.max(0, monthsRemain) * (fp.principal + fp.interest);
                  const endD = new Date(fp.endDate);
                  const isExpired = endD < today;
                  const isUrgent = daysLeft <= 5 && !isExpired;

                  return (
                    <div key={fp.id} className="slide-up" style={{
                      ...styles.budgetRow,animationDelay:`${i*0.06}s`,
                      border: isUrgent ? "1px solid #F43F5E60" : isExpired ? "1px solid #47556840" : "1px solid #312e81",
                      opacity: isExpired ? 0.5 : 1,
                    }}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>{fp.name}</span>
                            {isExpired && <span style={{fontSize:10,background:"#47556830",color:"#64748b",padding:"2px 6px",borderRadius:4,fontWeight:600}}>만기완료</span>}
                            {isUrgent && <span style={{fontSize:10,background:"#F43F5E20",color:"#F43F5E",padding:"2px 6px",borderRadius:4,fontWeight:600}}>D-{daysLeft}</span>}
                          </div>
                          {fp.memo && <div style={{fontSize:11,color:"#64748b",marginTop:3}}>{fp.memo}</div>}
                        </div>
                        <div style={{display:"flex",gap:4}}>
                          <button onClick={()=>editFixed(fp)} style={{...styles.deleteBtn,fontSize:13,color:"#818CF8"}}>✎</button>
                          <button onClick={()=>deleteFixed(fp.id)} style={{...styles.deleteBtn,color:"#F43F5E"}}>✕</button>
                        </div>
                      </div>

                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                        <div style={{background:"#0f172a",borderRadius:10,padding:"10px 12px"}}>
                          <div style={{fontSize:10,color:"#64748b",fontWeight:600,marginBottom:3}}>월 원금</div>
                          <div style={{fontSize:14,fontWeight:700,color:"#c4b5fd",fontFamily:"'Space Mono',monospace"}}>
                            {formatMoney(fp.principal)}
                          </div>
                        </div>
                        <div style={{background:"#0f172a",borderRadius:10,padding:"10px 12px"}}>
                          <div style={{fontSize:10,color:"#64748b",fontWeight:600,marginBottom:3}}>월 이자</div>
                          <div style={{fontSize:14,fontWeight:700,color:"#f0abfc",fontFamily:"'Space Mono',monospace"}}>
                            {formatMoney(fp.interest)}
                          </div>
                        </div>
                      </div>

                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12}}>
                        <div style={{display:"flex",gap:12}}>
                          <span style={{color:"#94a3b8"}}>
                            📅 매월 <span style={{fontWeight:700,color:"#e2e8f0"}}>{fp.payDay}일</span>
                          </span>
                          <span style={{color:"#94a3b8"}}>
                            ⏳ 만기 <span style={{fontWeight:600,color:"#e2e8f0"}}>{fp.endDate.slice(0,7).replace("-",".")}</span>
                          </span>
                        </div>
                      </div>

                      {!isExpired && (
                        <div style={{marginTop:10,background:"#0f172a",borderRadius:10,padding:"10px 12px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div>
                              <div style={{fontSize:10,color:"#64748b",fontWeight:600,marginBottom:2}}>남은 기간</div>
                              <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>
                                {monthsRemain > 0 ? `${monthsRemain}개월` : "이번 달 만기"}
                              </div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontSize:10,color:"#64748b",fontWeight:600,marginBottom:2}}>남은 총 금액</div>
                              <div style={{fontSize:15,fontWeight:900,color:"#818CF8",fontFamily:"'Space Mono',monospace"}}>
                                {formatMoney(remainTotal)}
                              </div>
                            </div>
                          </div>
                          {(() => {
                            const totalMonths = monthsBetween("2020-01-01", fp.endDate);
                            const elapsed = totalMonths - monthsRemain;
                            const pct = totalMonths > 0 ? Math.min(100, Math.max(0, elapsed / totalMonths * 100)) : 100;
                            return (
                              <div style={{marginTop:8}}>
                                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#475569",marginBottom:3}}>
                                  <span>상환 진행률</span>
                                  <span>{Math.round(pct)}%</span>
                                </div>
                                <div style={{height:4,borderRadius:2,background:"#1e1145",overflow:"hidden"}}>
                                  <div className="bar-fill" style={{height:"100%",width:`${pct}%`,borderRadius:2,background:"linear-gradient(90deg, #818CF8, #a78bfa)"}}/>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== BUDGET ===== */}
        {view === "budget" && (
          <div className="slide-up">
            <div style={styles.sectionTitle}>카테고리별 예산</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:16}}>
              각 카테고리를 눌러 예산을 설정하세요
            </div>

            {fixedMonthlyTotal > 0 && (
              <div style={{
                background:"#1e114520",border:"1px solid #312e8140",borderRadius:12,
                padding:"10px 14px",marginBottom:14,fontSize:12,color:"#a5b4fc",
                display:"flex",alignItems:"center",gap:8,
              }}>
                <span>🏦</span>
                <span>고정납부 월 {formatMoney(fixedMonthlyTotal)}이 대출/이자 카테고리에 자동 합산됩니다</span>
              </div>
            )}

            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {CATEGORIES.map((cat,i) => {
                const budget = (data.budgets[mk] || {})[cat.id] || 0;
                const spent = expenses.filter(t=>t.category===cat.id).reduce((s,t)=>s+t.amount,0);
                const fixedAdd = cat.id === "loan" ? fixedMonthlyTotal : 0;
                const totalSpent = spent + fixedAdd;
                const pct = budget > 0 ? Math.min(100, totalSpent/budget*100) : 0;
                const isEditing = editingBudget === cat.id;
                return (
                  <div key={cat.id} className="slide-up" style={{
                    ...styles.budgetRow,animationDelay:`${i*0.05}s`,
                    border: isEditing ? `1px solid ${cat.color}60` : "1px solid #1e293b",
                  }}>
                    <div onClick={()=>{ if (!isEditing) { setEditingBudget(cat.id); setBudgetInput(budget > 0 ? String(budget) : ""); } }}
                      style={{cursor:"pointer"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                        <span style={{fontSize:22}}>{cat.icon}</span>
                        <span style={{fontSize:14,fontWeight:600,color:"#e2e8f0",flex:1}}>{cat.name}</span>
                        <div style={{textAlign:"right"}}>
                          <span style={{fontSize:13,fontWeight:700,color:cat.color,fontFamily:"'Space Mono',monospace"}}>
                            {formatMoney(totalSpent)}
                          </span>
                          {fixedAdd > 0 && (
                            <div style={{fontSize:10,color:"#818CF8",marginTop:1}}>고정 {formatMoney(fixedAdd)} 포함</div>
                          )}
                        </div>
                      </div>
                      {budget > 0 && !isEditing && (
                        <div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#64748b",marginBottom:4}}>
                            <span>예산: {formatMoney(budget)}</span>
                            <span style={{fontWeight:600,color: pct > 100 ? "#F43F5E" : pct > 80 ? "#D97706" : "#10B981"}}>{Math.round(pct)}%</span>
                          </div>
                          <div style={{height:6,borderRadius:3,background:"#1e293b",overflow:"hidden"}}>
                            <div className="bar-fill" style={{height:"100%",width:`${pct}%`,borderRadius:3,background:`linear-gradient(90deg, ${cat.color}, ${cat.color}cc)`}}/>
                          </div>
                          <div style={{fontSize:11,color:"#64748b",marginTop:4}}>남은 예산: {formatMoney(Math.max(0, budget - totalSpent))}</div>
                        </div>
                      )}
                      {budget === 0 && !isEditing && (
                        <div style={{fontSize:12,color:"#475569"}}>탭하여 예산 설정</div>
                      )}
                    </div>
                    {isEditing && (
                      <div className="fade-in" style={{display:"flex",gap:8,marginTop:8}}>
                        <input type="number" placeholder="예산 금액 (원)" value={budgetInput}
                          onChange={e=>setBudgetInput(e.target.value)} autoFocus style={styles.input}
                          onKeyDown={e=>{ if(e.key==="Enter") saveBudget(cat.id); }}
                        />
                        <button onClick={()=>saveBudget(cat.id)} style={{...styles.btnPrimary,padding:"8px 16px",fontSize:13}}>저장</button>
                        <button onClick={()=>{setEditingBudget(null);setBudgetInput("");}} style={{...styles.btnGhost,padding:"8px 12px",fontSize:13}}>취소</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={()=>setShowAdd(true)} className="hover-scale" style={styles.fab}>
        <span style={{fontSize:28,lineHeight:1}}>+</span>
      </button>

      {/* ===== ADD TRANSACTION MODAL ===== */}
      {showAdd && (
        <div className="fade-in" style={styles.overlay} onClick={()=>setShowAdd(false)}>
          <div className="slide-up" style={styles.modal} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:700,color:"#e2e8f0",marginBottom:20}}>새 거래 추가</div>
            <div style={{display:"flex",gap:4,marginBottom:16,background:"#0f172a",borderRadius:12,padding:4}}>
              {[{v:"expense",l:"지출"},{v:"income",l:"수입"}].map(t => (
                <button key={t.v} onClick={()=>setForm(f=>({...f,type:t.v}))}
                  style={{
                    flex:1,padding:"10px 0",borderRadius:10,border:"none",fontSize:14,fontWeight:600,
                    cursor:"pointer",transition:"all 0.2s",fontFamily:"'Noto Sans KR',sans-serif",
                    background: form.type===t.v ? (t.v==="expense"?"#FF6B35":"#4ECDC4") : "transparent",
                    color: form.type===t.v ? "#fff" : "#64748b",
                  }}>{t.l}</button>
              ))}
            </div>
            <div style={{marginBottom:14}}>
              <label style={styles.label}>금액</label>
              <input type="number" placeholder="0" value={form.amount}
                onChange={e=>setForm(f=>({...f,amount:e.target.value}))} autoFocus
                style={{...styles.input,fontSize:22,fontWeight:700,fontFamily:"'Space Mono',monospace",textAlign:"center",letterSpacing:1}}
              />
            </div>
            {form.type === "expense" && (
              <div style={{marginBottom:14}}>
                <label style={styles.label}>카테고리</label>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                  {CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={()=>setForm(f=>({...f,category:cat.id}))}
                      style={{
                        padding:"10px 4px",borderRadius:10,border:"none",cursor:"pointer",transition:"all 0.15s",
                        fontFamily:"'Noto Sans KR',sans-serif",
                        background: form.category===cat.id ? `${cat.color}25` : "#0f172a",
                        border: form.category===cat.id ? `2px solid ${cat.color}` : "2px solid transparent",
                      }}>
                      <div style={{fontSize:18}}>{cat.icon}</div>
                      <div style={{fontSize:10,color: form.category===cat.id ? cat.color : "#64748b",fontWeight:500,marginTop:2}}>{cat.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{marginBottom:14}}>
              <label style={styles.label}>메모</label>
              <input type="text" placeholder="간단한 메모 (선택)" value={form.memo}
                onChange={e=>setForm(f=>({...f,memo:e.target.value}))} style={styles.input}
              />
            </div>
            <div style={{marginBottom:20}}>
              <label style={styles.label}>날짜</label>
              <input type="date" value={form.date}
                onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{...styles.input,colorScheme:"dark"}}
              />
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowAdd(false)} style={{...styles.btnGhost,flex:1}}>취소</button>
              <button onClick={addTransaction} style={{...styles.btnPrimary,flex:2}}>추가하기</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ADD FIXED PAYMENT MODAL ===== */}
      {showAddFixed && (
        <div className="fade-in" style={styles.overlay} onClick={()=>{setShowAddFixed(false);setEditingFixedId(null);}}>
          <div className="slide-up" style={styles.modal} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:700,color:"#e2e8f0",marginBottom:20}}>
              {editingFixedId ? "고정납부 수정" : "고정납부 추가"}
            </div>
            <div style={{marginBottom:14}}>
              <label style={styles.label}>대출명 *</label>
              <input type="text" placeholder="예: 주택담보대출" value={fixedForm.name}
                onChange={e=>setFixedForm(f=>({...f,name:e.target.value}))} autoFocus style={styles.input}
              />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div>
                <label style={styles.label}>월 원금 *</label>
                <input type="number" placeholder="0" value={fixedForm.principal}
                  onChange={e=>setFixedForm(f=>({...f,principal:e.target.value}))} style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>월 이자</label>
                <input type="number" placeholder="0" value={fixedForm.interest}
                  onChange={e=>setFixedForm(f=>({...f,interest:e.target.value}))} style={styles.input}
                />
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div>
                <label style={styles.label}>납부일 (매월) *</label>
                <input type="number" placeholder="25" min="1" max="31" value={fixedForm.payDay}
                  onChange={e=>setFixedForm(f=>({...f,payDay:e.target.value}))} style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>만기일 *</label>
                <input type="date" value={fixedForm.endDate}
                  onChange={e=>setFixedForm(f=>({...f,endDate:e.target.value}))} style={{...styles.input,colorScheme:"dark"}}
                />
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <label style={styles.label}>메모</label>
              <input type="text" placeholder="은행명, 금리 등 (선택)" value={fixedForm.memo}
                onChange={e=>setFixedForm(f=>({...f,memo:e.target.value}))} style={styles.input}
              />
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setShowAddFixed(false);setEditingFixedId(null);}} style={{...styles.btnGhost,flex:1}}>취소</button>
              <button onClick={addFixedPayment} style={{...styles.btnPrimary,flex:2}}>
                {editingFixedId ? "수정하기" : "추가하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

const styles = {
  root: {
    fontFamily: "'Noto Sans KR', sans-serif", background: "#0b0f1a", minHeight: "100vh",
    color: "#e2e8f0", position: "relative", maxWidth: 480, margin: "0 auto", paddingBottom: 100,
  },
  header: {
    background: "linear-gradient(180deg, #0f1729 0%, #0b0f1a 100%)",
    padding: "16px 20px 12px", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(12px)",
  },
  headerInner: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  logo: {
    fontSize: 20, fontWeight: 900,
    background: "linear-gradient(135deg, #FF6B35, #FFB347)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.5px",
  },
  monthNav: { display: "flex", alignItems: "center", gap: 8 },
  navBtn: {
    width: 32, height: 32, borderRadius: 8, border: "1px solid #1e293b", background: "#111827",
    color: "#94a3b8", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", fontFamily: "'Noto Sans KR',sans-serif",
  },
  monthLabel: { fontSize: 14, fontWeight: 600, color: "#e2e8f0", minWidth: 100, textAlign: "center" },
  tabBar: {
    display: "flex", gap: 2, padding: "0 16px 12px", background: "#0b0f1a",
    position: "sticky", top: 56, zIndex: 40,
  },
  tab: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    padding: "8px 0", borderRadius: 10, border: "none", background: "transparent",
    color: "#64748b", cursor: "pointer", transition: "all 0.2s", fontFamily: "'Noto Sans KR',sans-serif",
  },
  tabActive: { background: "#1e293b", color: "#FF6B35" },
  content: { padding: "0 20px" },
  summaryGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 },
  summaryCard: {
    borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 6, border: "1px solid #1e293b",
  },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: "#e2e8f0", marginBottom: 12 },
  catRow: {
    background: "#111827", borderRadius: 14, padding: "12px 14px",
    display: "flex", alignItems: "center", border: "1px solid #1e293b",
  },
  txRow: {
    background: "#111827", borderRadius: 12, padding: "10px 12px",
    display: "flex", alignItems: "center", gap: 10, border: "1px solid #1e293b",
  },
  budgetRow: {
    background: "#111827", borderRadius: 14, padding: 14, border: "1px solid #1e293b", transition: "all 0.2s",
  },
  empty: { textAlign: "center", padding: "48px 20px", color: "#475569", fontSize: 14 },
  fab: {
    position: "fixed", bottom: 28, right: "calc(50% - 220px)",
    width: 56, height: 56, borderRadius: 16, border: "none",
    background: "linear-gradient(135deg, #FF6B35, #FF8F5E)", color: "#fff",
    fontSize: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 8px 30px rgba(255,107,53,0.35)", transition: "transform 0.2s ease", zIndex: 30,
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100, padding: 16,
  },
  modal: {
    background: "#1a1f2e", borderRadius: 24, padding: 24, width: "100%", maxWidth: 440,
    maxHeight: "85vh", overflow: "auto", border: "1px solid #2a3040",
  },
  label: {
    display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6,
    textTransform: "uppercase", letterSpacing: 1,
  },
  input: {
    width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #2a3040",
    background: "#0f172a", color: "#e2e8f0", fontSize: 14, fontFamily: "'Noto Sans KR',sans-serif",
    transition: "border-color 0.2s",
  },
  btnPrimary: {
    padding: "12px 20px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #FF6B35, #FF8F5E)", color: "#fff",
    fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'Noto Sans KR',sans-serif",
  },
  btnGhost: {
    padding: "12px 20px", borderRadius: 12, border: "1px solid #2a3040", background: "transparent",
    color: "#94a3b8", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "'Noto Sans KR',sans-serif",
  },
  deleteBtn: {
    width: 24, height: 24, borderRadius: 6, border: "none", background: "transparent",
    color: "#475569", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", transition: "all 0.15s", fontFamily: "'Noto Sans KR',sans-serif",
  },
  toast: {
    position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)",
    background: "#1e293b", color: "#e2e8f0", padding: "10px 20px", borderRadius: 12,
    fontSize: 13, fontWeight: 500, boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
    zIndex: 200, animation: "toastIn 0.3s ease", border: "1px solid #2a3040",
  },
};
