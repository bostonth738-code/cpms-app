import { useState, useRef, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// PART 1: Constants, Colors & Utility Functions
// ═══════════════════════════════════════════════════════════════

const C = {
  bg:"#0d1117",panel:"#161b27",border:"#21293d",border2:"#2a3552",
  text:"#e2e8f0",muted:"#64748b",faint:"#334155",
  blue:"#3b82f6",green:"#22c55e",red:"#ef4444",orange:"#f59e0b",purple:"#a78bfa",
  blueDim:"#1e3a5f",greenDim:"#14532d",redDim:"#450a0a",orangeDim:"#431407",purpleDim:"#2e1065",
};
const ROLE_COL={owner:"#a78bfa",engineer:"#38bdf8",foreman:"#fb923c",purchasing:"#4ade80",marketing:"#f472b6"};
const ROLE_LBL={owner:"เจ้าของ",engineer:"วิศวกร",foreman:"โฟร์แมน",purchasing:"จัดซื้อ",marketing:"การตลาด"};
const ST_COL={inprogress:"#3b82f6",completed:"#22c55e",notstarted:"#64748b",delayed:"#ef4444"};
const ST_LBL={inprogress:"กำลังก่อสร้าง",completed:"เสร็จแล้ว",notstarted:"ยังไม่เริ่ม",delayed:"ล่าช้า"};

// Utility Functions
const addDays=(d,n)=>{const dt=new Date(d);dt.setDate(dt.getDate()+n);return dt.toISOString().slice(0,10);};
const fmtDate=d=>{if(!d)return"—";const dt=new Date(d);return`${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()+543}`;};
const fmtMoney=n=>(n||0).toLocaleString("th-TH");
const daysLeft=(s,t)=>Math.ceil((new Date(addDays(s,t))-new Date())/86400000);
const uid=()=>Date.now()+Math.random();

// Export functions
const exp2CSV=(headers,rows)=>{const csv=[headers.join(","),...rows.map(r=>r.map(c=>`"${c}"`).join(","))].join("\n");const blob=new Blob(["\uFEFF"+csv],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`report_${Date.now()}.csv`;a.click();};
const exp2JSON=(data,name)=>{const json=JSON.stringify(data,null,2);const blob=new Blob([json],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${name}_${Date.now()}.json`;a.click();};

// Analytics builders
const getCostBreakdown=data=>{const bd={};data.boqItems.forEach(b=>{const p=data.phases.find(ph=>ph.id===b.phaseId);if(p){if(!bd[p.name])bd[p.name]=0;bd[p.name]+=b.actualPrice>0?b.qty*b.actualPrice:b.qty*b.boqPrice;}});return Object.entries(bd).map(([k,v])=>({phase:k,cost:v}));};
const getPaymentStatus=data=>{const ps={paid:0,pending:0,late:0};data.payments.forEach(p=>{if(p.status==="paid")ps.paid++;else if(p.status==="pending"&&new Date(p.dueDate)<new Date())ps.late++;else if(p.status==="pending")ps.pending++;});return ps;};
const getTotalEarned=data=>data.payments.filter(p=>p.status==="paid").reduce((s,p)=>s+p.amount,0);
const getTotalDueAmount=data=>data.payments.filter(p=>p.status==="pending").reduce((s,p)=>s+p.amount,0);
const getProjectMetrics=data=>{const pm={};data.projects.forEach(p=>{const houses=data.houses.filter(h=>h.projectId===p.id);const comp=houses.filter(h=>h.status==="completed").length;const inprog=houses.filter(h=>h.status==="inprogress").length;pm[p.name]={total:houses.length,completed:comp,inprogress:inprog,notstarted:houses.length-comp-inprog,boq:houses.reduce((s,h)=>s+h.boq,0),actual:houses.reduce((s,h)=>s+h.actual,0)};});return pm;};

// Initial Data
const INIT={
  projects:[
    {id:1,name:"The Greenery Phase 1",address:"อ.ปากช่อง นครราชสีมา"},
    {id:2,name:"The Greenery Phase 2",address:"อ.ปากช่อง นครราชสีมา"},
  ],
  templates:[
    {id:1,name:"บ้านแบบ A — 2 ชั้น 3 ห้องนอน",boqBudget:1800000,defaultDays:180},
    {id:2,name:"บ้านแบบ B — 2 ชั้น 4 ห้องนอน",boqBudget:2400000,defaultDays:210},
  ],
  templateBOQItems:[
    {id:1,templateId:1,phaseId:1,name:"ปูนซีเมนต์ ตราช้าง 50 กก.",unit:"ถุง",qty:200,boqPrice:200},
    {id:2,templateId:1,phaseId:1,name:"หิน 3/4 นิ้ว",unit:"คิว",qty:30,boqPrice:800},
    {id:3,templateId:1,phaseId:2,name:"เหล็กเส้น DB12",unit:"เส้น",qty:500,boqPrice:180},
    {id:4,templateId:1,phaseId:3,name:"แบบหล่อคอนกรีต",unit:"ชุด",qty:5,boqPrice:15000},
    {id:5,templateId:1,phaseId:6,name:"สายไฟ VAF 2x2.5",unit:"ม้วน",qty:20,boqPrice:1200},
    {id:6,templateId:2,phaseId:1,name:"ปูนซีเมนต์ ตราช้าง 50 กก.",unit:"ถุง",qty:250,boqPrice:200},
    {id:7,templateId:2,phaseId:1,name:"หิน 3/4 นิ้ว",unit:"คิว",qty:40,boqPrice:800},
    {id:8,templateId:2,phaseId:2,name:"เหล็กเส้น DB12",unit:"เส้น",qty:700,boqPrice:180},
  ],
  houses:[
    {id:1,projectId:1,name:"A-01",customer:"นายสมชาย ใจดี",start:"2025-01-15",days:180,boq:1800000,actual:1250000,status:"inprogress",pct:65,phase:"หมวด 8 กระเบื้อง",foreman:"นายวิชัย",engineer:"วศ.ประสิทธิ์"},
    {id:2,projectId:1,name:"A-02",customer:"นางสาวมาลี รักสงบ",start:"2025-01-20",days:180,boq:1800000,actual:980000,status:"inprogress",pct:48,phase:"หมวด 6 ไฟฟ้า",foreman:"นายวิชัย",engineer:"วศ.ประสิทธิ์"},
    {id:3,projectId:1,name:"B-01",customer:"นายอนันต์ มั่งมี",start:"2024-10-01",days:210,boq:2400000,actual:2510000,status:"completed",pct:100,phase:"เสร็จแล้ว",foreman:"นายสุรชัย",engineer:"วศ.ประสิทธิ์"},
    {id:4,projectId:1,name:"A-03",customer:"",start:"2025-03-01",days:180,boq:1800000,actual:0,status:"notstarted",pct:0,phase:"ยังไม่เริ่ม",foreman:"",engineer:""},
    {id:5,projectId:2,name:"B-01",customer:"นายธนา ศรีสุข",start:"2025-07-01",days:210,boq:2400000,actual:340000,status:"inprogress",pct:12,phase:"หมวด 2 โครงสร้าง",foreman:"นายสุรชัย",engineer:"วศ.ประสิทธิ์"},
  ],
  phases:[
    {id:1,name:"เตรียมสถานที่และฐานราก",days:14,order:1},{id:2,name:"โครงสร้างชั้น 1",days:21,order:2},
    {id:3,name:"โครงสร้างชั้น 2",days:21,order:3},{id:4,name:"งานหลังคา",days:14,order:4},
    {id:5,name:"ก่ออิฐและฉาบปูน",days:30,order:5},{id:6,name:"ระบบไฟฟ้า",days:21,order:6},
    {id:7,name:"ระบบประปา",days:21,order:7},{id:8,name:"กระเบื้องพื้น-ผนัง",days:21,order:8},
    {id:9,name:"ประตูหน้าต่าง",days:14,order:9},{id:10,name:"สีภายนอก",days:21,order:10},
    {id:11,name:"สีภายใน",days:14,order:11},{id:12,name:"ฝ้าเพดาน",days:10,order:12},
    {id:13,name:"สุขภัณฑ์",days:7,order:13},{id:14,name:"ไฟฟ้าเดินสาย",days:7,order:14},
    {id:15,name:"ตกแต่งและส่งมอบ",days:20,order:15},
  ],
  boqItems:[
    {id:1,houseId:1,phaseId:1,name:"ปูนซีเมนต์ ตราช้าง 50 กก.",unit:"ถุง",qty:200,boqPrice:200,actualPrice:205,status:"completed",startDate:"2025-01-15",endDate:"2025-01-22",orderedBy:"นายวิชัย",approvedBy:"วศ.ประสิทธิ์",notes:"ตรวจสอบคุณภาพผ่านแล้ว"},
    {id:2,houseId:1,phaseId:1,name:"หิน 3/4 นิ้ว",unit:"คิว",qty:30,boqPrice:800,actualPrice:820,status:"completed",startDate:"2025-01-15",endDate:"2025-01-28",orderedBy:"นายวิชัย",approvedBy:"วศ.ประสิทธิ์",notes:""},
    {id:3,houseId:1,phaseId:2,name:"เหล็กเส้น DB12",unit:"เส้น",qty:500,boqPrice:180,actualPrice:0,status:"completed",startDate:"2025-02-05",endDate:"2025-02-15",orderedBy:"นายวิชัย",approvedBy:"วศ.ประสิทธิ์",notes:""},
    {id:4,houseId:1,phaseId:3,name:"แบบหล่อคอนกรีต",unit:"ชุด",qty:5,boqPrice:15000,actualPrice:0,status:"pending_approval",startDate:"2025-02-26",endDate:"2025-03-05",orderedBy:"นายวิชัย",approvedBy:"",notes:"รอความเห็นชอบจากวิศวกร"},
    {id:5,houseId:1,phaseId:6,name:"สายไฟ VAF 2x2.5",unit:"ม้วน",qty:20,boqPrice:1200,actualPrice:0,status:"notstarted",startDate:"2025-04-15",endDate:"2025-04-25",orderedBy:"",approvedBy:"",notes:""},
    {id:6,houseId:2,phaseId:1,name:"ปูนซีเมนต์ ตราช้าง 50 กก.",unit:"ถุง",qty:200,boqPrice:200,actualPrice:208,status:"completed",startDate:"2025-01-20",endDate:"2025-01-27",orderedBy:"นายวิชัย",approvedBy:"วศ.ประสิทธิ์",notes:""},
    {id:7,houseId:2,phaseId:5,name:"อิฐมวลเบา",unit:"ก้อน",qty:2000,boqPrice:12,actualPrice:0,status:"pending_approval",startDate:"2025-03-10",endDate:"2025-03-25",orderedBy:"นายวิชัย",approvedBy:"",notes:"ต้องการเร่งการสั่งซื้อ"},
  ],
  requests:[
    {id:1,houseId:1,itemId:3,status:"approved",date:"2025-03-10",by:"นายวิชัย",approvedBy:"วศ.ประสิทธิ์",qty:500,unit:"เส้น",note:"ต้องการด่วน"},
    {id:2,houseId:2,itemId:7,status:"pending",date:"2025-04-01",by:"นายวิชัย",approvedBy:"",qty:2000,unit:"ก้อน",note:"เร่งด่วน"},
  ],
  customers:[
    {houseId:1,name:"นายสมชาย ใจดี",phone:"089-123-4567",type:"loan",bank:"กสิกรไทย",preApproved:true,prob:100,note:"Pre-approved แล้ว"},
    {houseId:2,name:"นางสาวมาลี รักสงบ",phone:"081-234-5678",type:"loan",bank:"ออมสิน",preApproved:false,prob:75,note:"อยู่ระหว่างยื่นกู้"},
    {houseId:3,name:"นายอนันต์ มั่งมี",phone:"062-345-6789",type:"cash",bank:"",preApproved:false,prob:100,note:"ซื้อสด โอนแล้ว"},
    {houseId:5,name:"นายธนา ศรีสุข",phone:"095-456-7890",type:"loan",bank:"กรุงไทย",preApproved:false,prob:50,note:"ยังไม่ยื่นกู้"},
  ],
  messages:[
    {id:1,houseId:1,role:"foreman",sender:"นายวิชัย",text:"งานกระเบื้องห้องน้ำชั้น 1 เสร็จแล้วครับ",time:"09:15",date:"2025-04-03"},
    {id:2,houseId:1,role:"engineer",sender:"วศ.ประสิทธิ์",text:"โอเค รอตรวจครับ",time:"09:45",date:"2025-04-03"},
    {id:3,houseId:1,role:"owner",sender:"เจ้าของ",text:"ดีครับ เร่งให้ทันกำหนดด้วย",time:"10:00",date:"2025-04-03"},
  ],
  payments:[
    {id:1,houseId:1,date:"2025-02-15",dueDate:"2025-02-20",amount:500000,status:"paid",method:"transfer",paidDate:"2025-02-18",milestone:"50% งานโครงสร้างเสร็จ"},
    {id:2,houseId:1,date:"2025-03-15",dueDate:"2025-03-20",amount:500000,status:"pending",method:"",paidDate:"",milestone:"เมื่องานกำลังก่อสร้าง"},
    {id:3,houseId:2,date:"2025-02-20",dueDate:"2025-02-25",amount:600000,status:"paid",method:"transfer",paidDate:"2025-02-21",milestone:"50% งานโครงสร้างเสร็จ"},
    {id:4,houseId:2,date:"2025-03-20",dueDate:"2025-03-25",amount:600000,status:"pending",method:"",paidDate:"",milestone:"เมื่องานกำลังก่อสร้าง"},
    {id:5,houseId:3,date:"2024-11-15",dueDate:"2024-11-20",amount:1200000,status:"paid",method:"transfer",paidDate:"2024-11-16",milestone:"50% งานโครงสร้างเสร็จ"},
    {id:6,houseId:3,date:"2025-01-10",dueDate:"2025-01-15",amount:1200000,status:"paid",method:"transfer",paidDate:"2025-01-10",milestone:"Completion"},
  ],
  team:[
    {id:1,role:"owner",name:"นายณญาน์ สุวรรณ",email:"owner@cpms.com",phone:"089-001-0001",status:"active"},
    {id:2,role:"engineer",name:"วศ.ประสิทธิ์ บ้านบิน",email:"engineer@cpms.com",phone:"089-002-0002",status:"active"},
    {id:3,role:"foreman",name:"นายวิชัย ก่อสร้าง",email:"foreman1@cpms.com",phone:"089-003-0003",status:"active"},
    {id:4,role:"foreman",name:"นายสุรชัย บ้านดี",email:"foreman2@cpms.com",phone:"089-003-0004",status:"active"},
    {id:5,role:"purchasing",name:"นางสุรีย์พร จัดซื้อ",email:"purchasing@cpms.com",phone:"089-004-0004",status:"active"},
    {id:6,role:"marketing",name:"นางสิรินรา ตลาด",email:"marketing@cpms.com",phone:"089-005-0005",status:"active"},
    {id:7,role:"owner",name:"นายธีรศักดิ์ ลงทุน",email:"investor@cpms.com",phone:"089-006-0006",status:"inactive"},
  ],
  notifications:{
    emailOnPayment:true,emailOnDelay:true,emailOnCompletion:true,pushOnOrder:true,pushOnApproval:true,smsAlert:false
  },
  phaseProgress:{
    1:{1:{s:"done",dur:14,act:14},2:{s:"done",dur:21,act:21},3:{s:"done",dur:21,act:21},4:{s:"done",dur:14,act:14},5:{s:"done",dur:30,act:30},6:{s:"done",dur:21,act:21},7:{s:"done",dur:21,act:21},8:{s:"inprogress",dur:21,act:12},9:{s:"waiting",dur:14,act:0},10:{s:"waiting",dur:21,act:0},11:{s:"waiting",dur:14,act:0},12:{s:"waiting",dur:10,act:0},13:{s:"waiting",dur:7,act:0},14:{s:"waiting",dur:7,act:0},15:{s:"waiting",dur:20,act:0}},
    2:{1:{s:"done",dur:14,act:14},2:{s:"done",dur:21,act:21},3:{s:"inprogress",dur:21,act:8},4:{s:"waiting",dur:14,act:0},5:{s:"waiting",dur:30,act:0},6:{s:"waiting",dur:21,act:0},7:{s:"waiting",dur:21,act:0},8:{s:"waiting",dur:21,act:0},9:{s:"waiting",dur:14,act:0},10:{s:"waiting",dur:21,act:0},11:{s:"waiting",dur:14,act:0},12:{s:"waiting",dur:10,act:0},13:{s:"waiting",dur:7,act:0},14:{s:"waiting",dur:7,act:0},15:{s:"waiting",dur:20,act:0}},
  },
  phaseMessages:[
    {id:uid(),houseId:1,phaseId:1,role:"foreman",sender:"นายวิชัย",text:"เริ่มงานหมวด 1 แล้วครับ การเตรียมสถานที่เรียบร้อย",time:"08:30",date:"2025-04-02",file:null},
    {id:uid(),houseId:1,phaseId:1,role:"engineer",sender:"วศ.ประสิทธิ์",text:"ดีครับ ตรวจสอบพื้นหลักแล้ว พร้อมเริ่ม ฐานราก",time:"09:00",date:"2025-04-02",file:null},
    {id:uid(),houseId:1,phaseId:1,role:"foreman",sender:"นายวิชัย",text:"ยืนยันผลการตรวจสอบ ผ่านทุกด้านครับ จะเริ่มเทคอนกรีตพื้น",time:"10:15",date:"2025-04-02",file:null},
    {id:uid(),houseId:1,phaseId:2,role:"foreman",sender:"นายวิชัย",text:"โครงสร้างชั้น 1 ประมาณเสร็จ 80% แล้ว",time:"14:30",date:"2025-04-03",file:null},
    {id:uid(),houseId:1,phaseId:2,role:"engineer",sender:"วศ.ประสิทธิ์",text:"ขอดูภาพการตรวจสอบด้วยครับ",time:"15:00",date:"2025-04-03",file:null},
  ],
  notificationViewed:{},
  messageViewed:{},
};

// Global Styles
const GS=`
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%;background:#0d1117;color:#e2e8f0;font-family:'Noto Sans Thai',sans-serif}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:#0d1117}::-webkit-scrollbar-thumb{background:#21293d;border-radius:4px}
input,select,textarea,button{font-family:inherit}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}
`;

// ═══════════════════════════════════════════════════════════════
// END OF PART 1
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// PART 2: Micro UI Components
// ═══════════════════════════════════════════════════════════════

function Tag({color="blue",children,style={}}) {
  const m={blue:[C.blueDim,C.blue],green:[C.greenDim,C.green],red:[C.redDim,C.red],orange:[C.orangeDim,C.orange],purple:[C.purpleDim,C.purple],gray:[C.faint,C.muted]};
  const [bg,fg]=m[color]||m.blue;
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,background:bg,color:fg,border:`1px solid ${fg}33`,...style}}>{children}</span>;
}

function Btn({onClick,children,variant="primary",size="md",disabled=false,style={}}) {
  const v={primary:{bg:C.blue},success:{bg:"#16a34a"},danger:{bg:"#dc2626"},ghost:{bg:"transparent",border:`1px solid ${C.border2}`,color:C.muted}};
  const s=v[variant]||v.primary;
  return <button disabled={disabled} onClick={onClick} style={{display:"inline-flex",alignItems:"center",gap:6,padding:size==="sm"?"4px 10px":"7px 14px",borderRadius:8,fontSize:size==="sm"?11:13,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.5:1,border:s.border||"none",background:s.bg,color:s.color||"#fff",whiteSpace:"nowrap",...style}}>{children}</button>;
}

function FIn({value,onChange,placeholder,type="text",rows,onKeyDown,style={}}) {
  const base={width:"100%",background:"#0d1117",border:`2px solid ${C.border2}`,borderRadius:12,padding:"12px 14px",color:C.text,fontSize:13,outline:"none",transition:"all 0.2s",boxShadow:"0 2px 4px rgba(0,0,0,0.1)",...style};
  const focusStyle={onFocus:e=>{e.target.style.borderColor=C.blue;e.target.style.boxShadow="0 4px 12px rgba(59, 130, 246, 0.3)";},onBlur:e=>{e.target.style.borderColor=C.border2;e.target.style.boxShadow="0 2px 4px rgba(0,0,0,0.1)";}};
  if(rows) return <textarea value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} rows={rows} style={base} {...focusStyle}/>;
  return <input type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} style={base} {...focusStyle}/>;
}

function FSel({value,onChange,children,style={}}) {
  return <select value={value} onChange={onChange} style={{width:"100%",background:"#0d1117",border:`1px solid ${C.border2}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:13,outline:"none",...style}}>{children}</select>;
}

function FG({label,children}) {
  return <div style={{marginBottom:14}}><div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>{label}</div>{children}</div>;
}

function Card({children,style={}}) {
  return <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,...style}}>{children}</div>;
}

function PBar({pct,color=C.blue,h=6}) {
  return <div style={{height:h,background:C.faint,borderRadius:h,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:color,borderRadius:h,transition:"width .4s"}}/></div>;
}

function Alrt({type="info",children}) {
  const t={info:[C.blueDim,C.blue],warning:[C.orangeDim,C.orange],danger:[C.redDim,C.red],success:[C.greenDim,C.green]};
  const [bg,bd]=t[type]||t.info;
  return <div style={{background:bg,border:`1px solid ${bd}`,borderRadius:8,padding:"9px 13px",fontSize:12,color:C.text,marginBottom:14,lineHeight:1.5}}>{children}</div>;
}

function Mdl({title,onClose,children,footer,size="md"}) {
  const mw={sm:360,md:520,lg:700,xl:880}[size]||520;
  const handleBackdropMouseDown=(e)=>{
    if(e.target===e.currentTarget){onClose();}
  };
  return (
    <div onMouseDown={handleBackdropMouseDown} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(3px)"}}>
      <div onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,width:"100%",maxWidth:mw,maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 20px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <span style={{fontSize:15,fontWeight:700,color:C.text}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:18,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        <div style={{padding:"18px 20px",overflowY:"auto",flex:1}}>{children}</div>
        {footer&&<div style={{padding:"12px 20px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end",gap:8,flexShrink:0}}>{footer}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// END OF PART 2
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// PART 3: Role Switcher, Notifications, Sidebar
// ═══════════════════════════════════════════════════════════════

function RoleSwitcher({role,setRole}) {
  const [open,setOpen]=useState(false);
  return (
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 12px",background:C.panel,border:`1px solid ${C.border2}`,borderRadius:8,color:C.text,fontSize:12,fontWeight:600,cursor:"pointer"}}>
        <span style={{width:8,height:8,borderRadius:"50%",background:ROLE_COL[role],flexShrink:0}}/>{ROLE_LBL[role]} ▾
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:6,minWidth:160,zIndex:300}}>
          {Object.entries(ROLE_LBL).map(([r,l])=>(
            <button key={r} onClick={()=>{setRole(r);setOpen(false);}} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 10px",borderRadius:7,border:"none",background:role===r?"#1d3a6e":"transparent",color:role===r?C.blue:C.text,fontSize:13,cursor:"pointer",textAlign:"left"}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:ROLE_COL[r],flexShrink:0}}/>{l}{role===r&&<span style={{marginLeft:"auto",fontSize:11}}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Notifs({data,setData,role,onOpenHouse,setPage,onScrollToPhase}) {
  const [open,setOpen]=useState(false);
  // เช็คงานรอตรวจ
  const waitingReviewItems=data.houses.flatMap(h=>{
    const pp=data.phaseProgress[h.id]||{};
    return data.phases.filter(p=>pp[p.id]?.s==="waiting_review").map(p=>({
      id:`waiting-${h.id}-${p.id}`,
      t:"warning",
      msg:`🏠 ${h.name} — หมวด ${p.order} ${p.name} รอตรวจจากวิศวกร`,
      houseId:h.id,
      page:"boq",
      phaseId:p.id,
      show:["engineer","owner"].includes(role)
    }));
  });
  // คำสั่งซื้อรอ approve
  const orderItems=data.requests.filter(r=>r.status==="pending").flatMap(r=>{
    const h=data.houses.find(ho=>ho.id===r.houseId);
    const item=data.boqItems.find(b=>b.id===r.itemId);
    return {
      id:`order-${r.id}`,
      t:"warning",
      msg:`🛒 ${h?.name||"?"} — ${item?.name||"?"} รอ Approve`,
      houseId:r.houseId,
      page:"boq",
      show:["engineer","owner","purchasing"].includes(role)
    };
  });
  // เกินงบ
  const overBudgetItems=data.houses.filter(h=>h.status==="completed"&&h.actual>h.boq).map(h=>({
    id:`budget-${h.id}`,
    t:"danger",
    msg:`⚠️ ${h.name} — เกินงบ ฿${fmtMoney(h.actual-h.boq)}`,
    houseId:h.id,
    page:"boq",
    show:["owner","engineer"].includes(role)
  }));
  // ข้อความใหม่ในแต่ละหมวด
  const messageItems=data.phaseMessages.flatMap(msg=>{
    const h=data.houses.find(ho=>ho.id===msg.houseId);
    const p=data.phases.find(ph=>ph.id===msg.phaseId);
    const isViewed=data.messageViewed?.[msg.id];
    if(isViewed)return[];
    return {
      id:`msg-${msg.id}`,
      t:"info",
      msg:`💬 ${h?.name||"?"} - หมวด ${p?.order} ${p?.name||"?"} | ${msg.sender}: ${msg.text.substring(0,40)}${msg.text.length>40?"...":""}${msg.file?" 📎":""}`,
      houseId:msg.houseId,
      page:"boq",
      phaseId:msg.phaseId,
      messageId:msg.id,
      show:true
    };
  });
  
  const allItems=[...messageItems,...waitingReviewItems,...orderItems,...overBudgetItems].filter(n=>n.show);
  const unviewedCount=allItems.filter(n=>!data.notificationViewed?.[n.id]).length;
  
  const handleNotifClick=(n)=>{
    if(n.messageId){
      setData(d=>({...d,messageViewed:{...d.messageViewed,[n.messageId]:true}}));
    }else{
      setData(d=>({...d,notificationViewed:{...d.notificationViewed,[n.id]:true}}));
    }
    onOpenHouse(data.houses.find(h=>h.id===n.houseId));
    setOpen(false);
    if(n.phaseId&&onScrollToPhase){
      setTimeout(()=>onScrollToPhase(n.phaseId,n.messageId),300);
    }
  };
  
  return (
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{position:"relative",width:36,height:36,borderRadius:8,border:`1px solid ${C.border2}`,background:"none",color:C.muted,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>
        🔔{unviewedCount>0&&<span style={{position:"absolute",top:-4,right:-4,background:C.red,color:"#fff",fontSize:9,fontWeight:700,width:16,height:16,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",animation:"pulse 1s infinite"}}>{unviewedCount}</span>}
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:12,minWidth:330,zIndex:300,maxHeight:420,overflowY:"auto",boxShadow:"0 10px 40px rgba(0,0,0,0.3)"}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>📢 การแจ้งเตือน ({allItems.length})</div>
          {allItems.length===0?<div style={{fontSize:12,color:C.muted,textAlign:"center",padding:"20px 0"}}>✓ ไม่มีการแจ้งเตือน</div>:allItems.map((n,i)=>{
            const isViewed=n.messageId?data.messageViewed?.[n.messageId]:data.notificationViewed?.[n.id];
            return (
              <div key={i} onClick={()=>handleNotifClick(n)} style={{display:"flex",gap:8,padding:"10px",borderRadius:8,borderBottom:i<allItems.length-1?`1px solid ${C.border}`:"none",alignItems:"flex-start",cursor:"pointer",background:isViewed?C.faint+"44":C.faint,transition:"all 0.2s",opacity:isViewed?0.6:1,_hover:{background:C.faint}}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:n.t==="warning"?C.orange:n.t==="danger"?C.red:n.t==="info"?C.blue:C.green,marginTop:5,flexShrink:0}}/>
                <span style={{fontSize:12,color:C.text,lineHeight:1.4,flex:1}}>{n.msg}</span>
                <span style={{fontSize:10,color:C.muted,marginTop:2}}>→</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Sidebar({page,setPage,role,data}) {
  const pending=data.requests.filter(r=>r.status==="pending").length;
  const navByRole={
    owner:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"dash",icon:"⊞",label:"Dashboard"},{id:"finance",icon:"💹",label:"Finance"},{id:"analytics",icon:"📊",label:"Analytics"},{id:"team",icon:"👥",label:"Team"},{id:"marketing",icon:"📢",label:"การตลาด"},{id:"settings",icon:"⚙️",label:"ตั้งค่า"}],
    engineer:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"dash",icon:"⊞",label:"บ้านที่ดูแล"},{id:"analytics",icon:"📊",label:"Analytics"},{id:"settings",icon:"⚙️",label:"ตั้งค่า"}],
    foreman:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"dash",icon:"⊞",label:"บ้านที่ดูแล"}],
    purchasing:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"dash",icon:"⊞",label:"ภาพรวม"}],
    marketing:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"analytics",icon:"📊",label:"Analytics"},{id:"marketing",icon:"📢",label:"การตลาด"}],
  };
  const items=navByRole[role]||navByRole.owner;
  return (
    <div style={{width:220,background:C.panel,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,bottom:0,zIndex:100}}>
      <div style={{padding:"16px 14px 13px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:9}}>
        <div style={{width:34,height:34,background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>🏗️</div>
        <div><div style={{fontSize:14,fontWeight:700,color:C.text}}>CPMS</div><div style={{fontSize:10,color:C.muted}}>Construction Mgmt</div></div>
      </div>
      <nav style={{flex:1,padding:"10px 7px",overflowY:"auto"}}>
        <div style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,padding:"8px 9px 4px"}}>เมนูหลัก</div>
        {items.map(item=>(
          <button key={item.id} onClick={()=>setPage(item.id)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 9px",borderRadius:8,border:"none",background:page===item.id?"#1d3a6e":"transparent",color:page===item.id?C.blue:C.muted,fontSize:13,fontWeight:page===item.id?600:500,cursor:"pointer",marginBottom:2,textAlign:"left"}}>
            <span style={{fontSize:15,width:20,textAlign:"center"}}>{item.icon}</span>{item.label}
            {item.badge>0&&<span style={{marginLeft:"auto",background:C.red,color:"#fff",fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:10}}>{item.badge}</span>}
          </button>
        ))}
      </nav>
      <div style={{padding:"10px 7px",borderTop:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 9px",background:"#0d1117",borderRadius:8}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:ROLE_COL[role],flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:600,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>ผู้ใช้ Demo</div>
            <div style={{fontSize:10,color:C.muted}}>{ROLE_LBL[role]}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// END OF PART 3
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// PART 4: Dashboard Page Component
// ═══════════════════════════════════════════════════════════════

function DashPage({data,setData,role,onOpenHouse}) {
  const [expanded,setExpanded]=useState({1:true,2:true});
  const [projMdl,setProjMdl]=useState(false);
  const [houseMdl,setHouseMdl]=useState(null);
  const [editHouse,setEditHouse]=useState(null);
  const [pf,setPf]=useState({name:"",address:""});
  const [hf,setHf]=useState({name:"",customer:"",start:"",days:180,boq:1800000,templateId:1});

  const totalBOQ=data.houses.reduce((s,h)=>s+h.boq,0);
  const totalAct=data.houses.reduce((s,h)=>s+h.actual,0);
  const overC=data.houses.filter(h=>h.status==="completed"&&h.actual>h.boq).length;

  const KCard=({icon,label,val,sub,warn})=>(
    <Card style={{padding:15}}>
      <div style={{fontSize:20,marginBottom:5}}>{icon}</div>
      <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>{label}</div>
      <div style={{fontSize:20,fontWeight:800,color:warn?C.red:C.text}}>{val}</div>
      {sub&&<div style={{fontSize:11,color:C.muted,marginTop:3}}>{sub}</div>}
    </Card>
  );

  function addProj(){if(!pf.name)return;setData(d=>({...d,projects:[...d.projects,{id:uid(),...pf}]}));setProjMdl(false);setPf({name:"",address:""});}
  function addHouse(){
    if(!hf.name||!hf.start)return;
    const newHouseId=uid();
    const newBoqItems=[];
    
    // Copy BOQ items from template if templateId is provided
    if(hf.templateId){
      const templateItems=data.templateBOQItems.filter(t=>t.templateId===hf.templateId);
      templateItems.forEach(tItem=>{
        // Calculate cumulative days from phase 1 to current phase
        const phaseOrder=data.phases.find(p=>p.id===tItem.phaseId)?.order||1;
        const cumulativeDays=data.phases
          .filter(p=>p.order<phaseOrder)
          .reduce((sum,p)=>sum+p.days,0);
        
        // Calculate start and end dates
        const startDate=addDays(new Date(hf.start),cumulativeDays);
        const phaseEndDate=addDays(startDate,data.phases.find(p=>p.id===tItem.phaseId)?.days||0);
        
        newBoqItems.push({
          id:uid(),
          houseId:newHouseId,
          phaseId:tItem.phaseId,
          name:tItem.name,
          unit:tItem.unit,
          qty:tItem.qty,
          boqPrice:tItem.boqPrice,
          actualPrice:0,
          status:"notstarted",
          startDate:fmtDate(startDate),
          endDate:fmtDate(phaseEndDate),
          orderedBy:"",
          approvedBy:"",
          notes:""
        });
      });
    }
    
    setData(d=>({
      ...d,
      houses:[...d.houses,{id:newHouseId,projectId:houseMdl,...hf,boq:Number(hf.boq),days:Number(hf.days),actual:0,status:"notstarted",pct:0,phase:"ยังไม่เริ่ม",foreman:"",engineer:""}],
      boqItems:[...d.boqItems,...newBoqItems]
    }));
    setHouseMdl(null);setHf({name:"",customer:"",start:"",days:180,boq:1800000,templateId:1});
  }
  function copyHouse(h){setData(d=>({...d,houses:[...d.houses,{...h,id:uid(),name:h.name+"(2)",customer:"",actual:0,status:"notstarted",pct:0,phase:"ยังไม่เริ่ม"}]}));}
  function delHouse(id){if(!window.confirm("ลบบ้านหลังนี้?"))return;setData(d=>({...d,houses:d.houses.filter(h=>h.id!==id)}));}

  return (
    <div style={{padding:24}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
        <div><div style={{fontSize:22,fontWeight:700,color:C.text}}>Dashboard ภาพรวม</div><div style={{fontSize:13,color:C.muted,marginTop:2}}>ทุกโครงการ ทุกบ้าน Real-Time</div></div>
        {["owner","engineer"].includes(role)&&<Btn onClick={()=>setProjMdl(true)}>+ สร้างโครงการใหม่</Btn>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:24}}>
        <KCard icon="📦" label="โครงการ" val={data.projects.length} sub="Active"/>
        <KCard icon="🏠" label="บ้านทั้งหมด" val={data.houses.length} sub={`${data.houses.filter(h=>h.status==="inprogress").length} กำลังก่อสร้าง`}/>
        {["owner","engineer","purchasing"].includes(role)&&<KCard icon="💰" label="ใช้จ่ายจริงรวม" val={`฿${fmtMoney(totalAct)}`} sub="ทุกโครงการ"/>}
        {["owner","engineer","purchasing"].includes(role)&&<KCard icon="📊" label="งบ BOQ รวม" val={`฿${fmtMoney(totalBOQ)}`} sub="ทุกโครงการ"/>}
        {["owner","engineer","purchasing"].includes(role)&&<KCard icon="⚠️" label="บ้านเกินงบ" val={overC} sub="เสร็จแล้วเกิน BOQ" warn={overC>0}/>}
      </div>
      <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>โครงการและบ้าน<div style={{flex:1,height:1,background:C.border}}/></div>
      {data.projects.map(proj=>{
        const houses=data.houses.filter(h=>h.projectId===proj.id);
        const open=expanded[proj.id];
        return (
          <Card key={proj.id} style={{marginBottom:14,overflow:"hidden"}}>
            <div onClick={()=>setExpanded(e=>({...e,[proj.id]:!e[proj.id]}))} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 15px",cursor:"pointer",borderBottom:open?`1px solid ${C.border}`:"none"}}>
              <span style={{color:C.muted,fontSize:11,display:"inline-block",transform:open?"rotate(90deg)":"rotate(0)",transition:"transform .2s"}}>▶</span>
              <span style={{fontWeight:700,color:C.text,fontSize:14,flex:1}}>{proj.name}</span>
              <span style={{fontSize:11,color:C.muted}}>{proj.address}</span>
              <span style={{fontSize:11,color:C.muted,marginLeft:10}}>{houses.length} หลัง</span>
              {["owner","engineer"].includes(role)&&<Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();setHouseMdl(proj.id);}}>+ เพิ่มบ้าน</Btn>}
            </div>
            {open&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(360px,1fr))",gap:10,padding:12}}>
                {houses.length===0&&<div style={{padding:"14px",color:C.muted,fontSize:13}}>ยังไม่มีบ้านในโครงการนี้</div>}
                {houses.map(h=>{
                  const isOver=h.status==="completed"&&h.actual>h.boq;
                  const isNear=h.actual/h.boq>0.9&&h.status!=="completed";
                  const dl=daysLeft(h.start,h.days);
                  const remain=h.boq-h.actual;
                  const showFinance=["owner","engineer","purchasing"].includes(role);
                  return (
                    <div key={h.id} onClick={()=>onOpenHouse(h)} style={{background:"#0d1117",border:`1px solid ${isOver?C.red:C.border}`,borderRadius:10,padding:13,cursor:"pointer",transition:"border-color .15s"}}
                      onMouseEnter={e=>{if(!isOver)e.currentTarget.style.borderColor=C.blue;}} onMouseLeave={e=>{if(!isOver)e.currentTarget.style.borderColor=C.border;}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div>
                          <div style={{fontWeight:700,color:C.text,fontSize:13}}>บ้านเลขที่ {h.name}</div>
                          <div style={{fontSize:11,color:C.muted,marginTop:2}}>{h.customer||"— ยังไม่มีลูกค้า"}</div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <Tag color={h.status==="completed"?"green":h.status==="inprogress"?"blue":h.status==="delayed"?"red":"gray"}>{ST_LBL[h.status]}</Tag>
                          {["owner","engineer"].includes(role)&&(
                            <div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:3}}>
                              <button title="แก้ไข" onClick={()=>setEditHouse(h)} style={{width:25,height:25,borderRadius:6,border:`1px solid ${C.border2}`,background:"none",color:C.muted,cursor:"pointer",fontSize:12}}>✏️</button>
                              <button title="Copy" onClick={()=>copyHouse(h)} style={{width:25,height:25,borderRadius:6,border:`1px solid ${C.border2}`,background:"none",color:C.muted,cursor:"pointer",fontSize:12}}>⧉</button>
                              <button title="ลบ" onClick={()=>delHouse(h.id)} style={{width:25,height:25,borderRadius:6,border:`1px solid ${C.border2}`,background:"none",color:C.muted,cursor:"pointer",fontSize:12}}>🗑</button>
                            </div>
                          )}
                        </div>
                      </div>
                      {showFinance&&<div style={{display:"flex",gap:1,marginBottom:10,borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`}}>
                        {[["งบ BOQ",`฿${fmtMoney(h.boq)}`,C.text],["ใช้ไปแล้ว",(isOver?"⚠️ ":"")+`฿${fmtMoney(h.actual)}`,isOver?C.red:isNear?C.orange:C.text],["คงเหลือ",(isOver?"เกิน ":"")+`฿${fmtMoney(Math.abs(remain))}`,isOver?C.red:C.green]].map(([l,v,col],i)=>(
                          <div key={i} style={{flex:1,padding:"7px 8px",background:C.panel,textAlign:"center"}}>
                            <div style={{fontSize:9,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.3}}>{l}</div>
                            <div style={{fontSize:12,fontWeight:700,color:col,marginTop:3}}>{v}</div>
                          </div>
                        ))}
                      </div>}
                      <div style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:11,fontWeight:700,color:C.blue}}>{h.pct}%</span>
                          <span style={{fontSize:11,color:C.muted}}>{h.phase}</span>
                        </div>
                        <PBar pct={h.pct} color={h.pct>=100?C.green:C.blue}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:11,color:C.muted}}>เริ่ม {fmtDate(h.start)} → เสร็จ {fmtDate(addDays(h.start,h.days))}</span>
                        {h.status!=="completed"&&h.status!=="notstarted"&&<span style={{fontSize:11,color:dl<0?C.red:dl<30?C.orange:C.muted}}>{dl<0?`เกิน ${Math.abs(dl)} วัน`:`เหลือ ${dl} วัน`}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
      {projMdl&&<Mdl title="🏗️ สร้างโครงการใหม่" onClose={()=>setProjMdl(false)} footer={<><Btn variant="ghost" onClick={()=>setProjMdl(false)}>ยกเลิก</Btn><Btn onClick={addProj} disabled={!pf.name}>✓ สร้าง</Btn></>}><FG label="ชื่อโครงการ *"><FIn value={pf.name} onChange={e=>setPf(p=>({...p,name:e.target.value}))} placeholder="เช่น The Greenery Phase 3"/></FG><FG label="ที่อยู่"><FIn value={pf.address} onChange={e=>setPf(p=>({...p,address:e.target.value}))} placeholder="ที่อยู่โครงการ..."/></FG></Mdl>}
      {editHouse&&(
        <Mdl title={"✏️ แก้ไขบ้านหลังที่ "+editHouse.name} onClose={()=>setEditHouse(null)} footer={<><Btn variant="ghost" onClick={()=>setEditHouse(null)}>ยกเลิก</Btn><Btn onClick={()=>{setData(d=>({...d,houses:d.houses.map(h=>h.id===editHouse.id?{...h,name:editHouse.name}:h)}));setEditHouse(null);}}>✓ บันทึก</Btn></>}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="โครงการ"><span style={{fontSize:13,color:C.text,padding:"8px 0"}}>{data.projects.find(p=>p.id===editHouse.projectId)?.name}</span></FG>
            <FG label="เลขที่/ชื่อบ้าน *"><FIn value={editHouse.name} onChange={e=>setEditHouse(h=>({...h,name:e.target.value}))}/></FG>
            <div style={{gridColumn:"1/-1",fontSize:12,color:C.muted,padding:"8px 0",borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:12}}>
              <div>📍 {editHouse.customer||"ยังไม่มีลูกค้า"}</div>
              <div>📅 เริ่ม {fmtDate(editHouse.start)} · ระยะวาง {editHouse.days} วัน</div>
            </div>
          </div>
        </Mdl>
      )}
      {houseMdl&&(
        <Mdl title="🏠 เพิ่มบ้านใหม่" onClose={()=>setHouseMdl(null)} size="lg" footer={<><Btn variant="ghost" onClick={()=>setHouseMdl(null)}>ยกเลิก</Btn><Btn onClick={addHouse} disabled={!hf.name||!hf.start}>🏠 สร้างบ้าน</Btn></>}>
          <Alrt type="info">ระบบจะ Copy BOQ จาก Template ที่เลือก</Alrt>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="โครงการ"><span style={{fontSize:13,color:C.text,padding:"8px 0",fontWeight:700}}>{data.projects.find(p=>p.id===houseMdl)?.name}</span></FG>
            <FG label="เลขที่/ชื่อบ้าน *"><FIn value={hf.name} onChange={e=>setHf(h=>({...h,name:e.target.value}))} placeholder="เช่น A-07"/></FG>
            <FG label="เทมเพลท"><FSel value={hf.templateId} onChange={e=>{const t=data.templates.find(t=>t.id===+e.target.value);setHf(h=>({...h,templateId:+e.target.value,boq:t?.boqBudget||h.boq,days:t?.defaultDays||h.days}));}}>{data.templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</FSel></FG>
            <div style={{gridColumn:"1/-1"}}><FG label="ชื่อลูกค้า"><FIn value={hf.customer} onChange={e=>setHf(h=>({...h,customer:e.target.value}))} placeholder="กรอกภายหลังได้"/></FG></div>
            <FG label="วันเริ่มก่อสร้าง *"><FIn type="date" value={hf.start} onChange={e=>setHf(h=>({...h,start:e.target.value}))}/></FG>
            <FG label="จำนวนวัน"><FIn type="number" value={hf.days} onChange={e=>setHf(h=>({...h,days:e.target.value}))}/></FG>
            <div style={{gridColumn:"1/-1"}}><FG label="งบ BOQ (฿)"><FIn type="number" value={hf.boq} onChange={e=>setHf(h=>({...h,boq:e.target.value}))}/></FG></div>
          </div>
        </Mdl>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// END OF PART 4
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// PART 5: House Detail Page & Modals
// ═══════════════════════════════════════════════════════════════

function PhaseCard({phase,house,data,setData,role,pp,boqItems,canEditDur,setEditPhaseNameMdl,editPhaseNameMdl}){
  const phPP=pp[phase.id]||{s:"waiting",dur:phase.days,act:0};
  const items=boqItems.filter(b=>b.phaseId===phase.id);
  const phMsgs=data.phaseMessages.filter(m=>m.houseId===house.id&&m.phaseId===phase.id);
  const msgScrollRef=useRef(null);
  const [phaseChatTxt,setPhaseChatTxt]=useState("");
  const [phaseChatFile,setPhaseChatFile]=useState(null);
  const [editDurMdl,setEditDurMdl]=useState(null);

  function sendPhaseMsg(){
    if(!phaseChatTxt.trim()&&!phaseChatFile)return;
    const isImage=phaseChatFile?.type?.startsWith("image/");
    const reader=new FileReader();
    if(phaseChatFile){
      reader.onload=()=>{
        const msgText=phaseChatTxt.trim()||`📎 ${phaseChatFile.name}`;
        setData(d=>({...d,phaseMessages:[...d.phaseMessages,{id:uid(),houseId:house.id,phaseId:phase.id,role,sender:ROLE_LBL[role],text:msgText,file:{name:phaseChatFile.name,size:phaseChatFile.size,type:phaseChatFile.type,data:reader.result},time:new Date().toLocaleTimeString("th",{hour:"2-digit",minute:"2-digit"}),date:new Date().toISOString().slice(0,10)}]}));
        setPhaseChatTxt("");setPhaseChatFile(null);
        setTimeout(()=>msgScrollRef.current?.scrollIntoView({behavior:"smooth"}),100);
      };
      if(isImage){reader.readAsDataURL(phaseChatFile);}else{reader.readAsArrayBuffer(phaseChatFile);}
    }else{
      setData(d=>({...d,phaseMessages:[...d.phaseMessages,{id:uid(),houseId:house.id,phaseId:phase.id,role,sender:ROLE_LBL[role],text:phaseChatTxt,time:new Date().toLocaleTimeString("th",{hour:"2-digit",minute:"2-digit"}),date:new Date().toISOString().slice(0,10)}]}));
      setPhaseChatTxt("");
      setTimeout(()=>msgScrollRef.current?.scrollIntoView({behavior:"smooth"}),100);
    }
  }

  return (
    <div id={`phase-${phase.id}`} style={{marginBottom:18,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",background:C.panel}}>
      {/* Phase Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 15px",background:"#0d1117",borderBottom:`1px solid ${C.border}`}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontWeight:700,color:C.text,fontSize:14}}>✓ หมวด {phase.order} — {phase.name}</span>
            {canEditDur&&<button onClick={()=>setEditPhaseNameMdl({id:phase.id,order:phase.order,name:phase.name})} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:12,padding:"2px 6px"}}>✏️</button>}
            <span style={{fontSize:12,color:C.green,fontWeight:600}}>({phPP.dur} วัน)</span>
            {canEditDur&&<button onClick={()=>setEditDurMdl({...phPP})} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:12,padding:"2px 6px"}}>📝</button>}
          </div>
        </div>
        <Tag color={phPP.s==="done"?"green":phPP.s==="inprogress"?"blue":phPP.s==="waiting_review"?"orange":"gray"} style={{marginLeft:8}}>
          {phPP.s==="done"?"✓ เสร็จ":phPP.s==="inprogress"?"🔄 กำลังทำ":phPP.s==="waiting_review"?"⏳ รอตรวจ":(phPP.s==="paused"?"⏸️ หยุด":"⏳ รอ")}
        </Tag>
      </div>

      {/* Messages Section */}
      <div style={{padding:"12px 15px",borderBottom:`1px solid ${C.border}`,minHeight:200}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <span style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>💬 ข้อความ ({phMsgs.length})</span>
        </div>
        <div ref={msgScrollRef} style={{display:"flex",flexDirection:"column",gap:8,maxHeight:300,overflowY:"auto",paddingRight:8,marginBottom:12}}>
          {phMsgs.length===0&&<div style={{fontSize:12,color:C.muted,textAlign:"center",padding:"30px 0"}}>ยังไม่มีข้อความในหมวดนี้</div>}
          {phMsgs.map(msg=>(
            <div key={msg.id} id={`msg-${msg.id}`} style={{display:"flex",gap:8,justifyContent:msg.role===role?"flex-end":"flex-start"}}>
              {msg.role!==role&&<div style={{width:32,height:32,borderRadius:8,background:ROLE_COL[msg.role],display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0}}>{(msg.sender||"?")[0]}</div>}
              <div style={{maxWidth:"75%",display:"flex",flexDirection:"column",gap:4}}>
                {msg.role!==role&&<div style={{fontSize:10,color:C.muted}}><span style={{fontWeight:700,color:ROLE_COL[msg.role]}}>{msg.sender}</span> • {ROLE_LBL[msg.role]}</div>}
                <div style={{background:msg.role===role?C.blue:"#2a3552",borderRadius:8,padding:"8px 12px",wordWrap:"break-word",fontSize:12,color:C.text}}>
                  {msg.text}
                  {msg.file&&(
                    <div style={{marginTop:8,borderTop:`1px solid ${msg.role===role?C.blue+"44":"#3a4562"}`,paddingTop:8}}>
                      {(msg.file.type.startsWith("image/"))&&typeof msg.file.data==="string"&&(
                        <img src={msg.file.data} alt="preview" style={{maxWidth:"100%",maxHeight:200,borderRadius:6,marginTop:4}}/>
                      )}
                      {msg.file.type.includes("pdf")&&(
                        <div style={{background:"#1a1f2e",borderRadius:6,padding:4,textAlign:"center",color:C.muted,fontSize:10}}>📄 PDF Document</div>
                      )}
                      {(msg.file.name.endsWith(".skp")||msg.file.name.endsWith(".dwg")||msg.file.name.endsWith(".dxf"))&&(
                        <div style={{background:"#1a1f2e",borderRadius:6,padding:4,textAlign:"center",color:C.muted,fontSize:10}}>📐 {msg.file.name.includes(".skp")?"SketchUp Model":(msg.file.name.includes(".dwg")?"AutoCAD DWG":"AutoCAD DXF")}</div>
                      )}
                      {(msg.file.name.endsWith(".doc")||msg.file.name.endsWith(".docx"))&&(
                        <div style={{background:"#1a1f2e",borderRadius:6,padding:4,textAlign:"center",color:C.muted,fontSize:10}}>📘 Word Document</div>
                      )}
                      {(msg.file.name.endsWith(".xls")||msg.file.name.endsWith(".xlsx"))&&(
                        <div style={{background:"#1a1f2e",borderRadius:6,padding:4,textAlign:"center",color:C.muted,fontSize:10}}>📊 Excel Spreadsheet</div>
                      )}
                      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
                        <span style={{fontSize:10,color:C.muted}}>{msg.file.name} ({Math.round(msg.file.size/1024)} KB)</span>
                        <button onClick={()=>{if(msg.file.type.startsWith("image/")){const a=document.createElement("a");a.href=msg.file.data;a.download=msg.file.name;a.click();}else{const blob=new Blob([msg.file.data]);const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=msg.file.name;a.click();}}} style={{background:"none",border:"none",color:C.blue,cursor:"pointer",fontSize:11}}>⬇️</button>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{fontSize:9,color:C.muted}}>{msg.time} {msg.date}</div>
              </div>
              {msg.role===role&&<div style={{width:32,height:32,borderRadius:8,background:ROLE_COL[msg.role],display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0}}>{(msg.sender||"?")[0]}</div>}
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end",padding:"12px 0"}}>
          <div style={{flex:1,minWidth:250}}>
            <FIn value={phaseChatTxt} onChange={e=>setPhaseChatTxt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendPhaseMsg();}}} placeholder="พิมพ์ข้อความ... (Enter ส่ง)" rows={3} style={{fontSize:14,padding:"14px 16px",borderRadius:12,border:`2px solid ${C.border2}`,boxShadow:`0 4px 12px rgba(0,0,0,0.3)`,transition:"all 0.2s",fontWeight:"500"}}/>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <label htmlFor={`file-input-${phase.id}`} style={{cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:42,height:42,borderRadius:10,border:`2px solid ${C.border2}`,color:phaseChatFile?C.blue:C.muted,fontSize:16,transition:"all 0.2s",boxShadow:`0 2px 8px rgba(0,0,0,0.2)`,background:C.panel}}>
              📎
              <input id={`file-input-${phase.id}`} type="file" accept=".pdf,.jpg,.jpeg,.png,.skp,.dwg,.dxf,.doc,.docx,.xls,.xlsx" onChange={e=>{if(e.target.files?.[0])setPhaseChatFile(e.target.files[0]);}} style={{display:"none"}}/>
            </label>
            <Btn size="sm" onClick={sendPhaseMsg} style={{padding:"10px 18px",fontSize:14,borderRadius:10,boxShadow:`0 2px 8px rgba(0,0,0,0.2)`,fontWeight:"600"}}>ส่ง</Btn>
          </div>
        </div>
        {phaseChatFile&&<div style={{fontSize:10,color:C.muted,marginTop:6}}>📎 {phaseChatFile.name}</div>}
      </div>

      {/* Action Buttons */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 15px",background:"#0d1117",borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
        {["foreman","engineer"].includes(role)&&phPP.s==="waiting"&&<Btn size="sm" onClick={()=>setData(d=>({...d,phaseProgress:{...d.phaseProgress,[house.id]:{...(d.phaseProgress[house.id]||{}),[phase.id]:{...phPP,s:"inprogress"}}}}))} style={{background:"#1d6f3e",color:"#fff"}}>▶️ เริ่มงาน</Btn>}
        {["foreman","engineer"].includes(role)&&phPP.s==="inprogress"&&<Btn size="sm" onClick={()=>setData(d=>({...d,phaseProgress:{...d.phaseProgress,[house.id]:{...(d.phaseProgress[house.id]||{}),[phase.id]:{...phPP,s:"waiting_review"}}}}))} style={{background:"#16a34a",color:"#fff"}}>✓ เสร็จสิ้น</Btn>}
        {["foreman","engineer"].includes(role)&&phPP.s==="waiting_review"&&<div style={{fontSize:12,fontWeight:700,color:C.orange}}>⏳ รอตรวจจากวิศวกร</div>}
        {role==="engineer"&&phPP.s==="waiting_review"&&<div style={{display:"flex",gap:4}}><Btn size="sm" onClick={()=>setData(d=>({...d,phaseProgress:{...d.phaseProgress,[house.id]:{...(d.phaseProgress[house.id]||{}),[phase.id]:{...phPP,s:"done"}}}}))} style={{background:"#16a34a",color:"#fff"}}>✓ ตรวจแล้วเสร็จ</Btn><Btn size="sm" variant="danger" onClick={()=>setData(d=>({...d,phaseProgress:{...d.phaseProgress,[house.id]:{...(d.phaseProgress[house.id]||{}),[phase.id]:{...phPP,s:"inprogress"}}}}))} >← ส่งกลับแก้</Btn></div>}
        {["owner","engineer","foreman"].includes(role)&&<Btn size="sm" onClick={()=>document.getElementById(`file-input-${phase.id}`)?.click()} style={{color:"#fff"}}>📌 ไฟล์แนบ</Btn>}
      </div>

      {/* Duration Edit Modal */}
      {editDurMdl&&(
        <Mdl title={`📝 แก้ไขระยะเวลา — หมวด ${phase.order}`} onClose={()=>setEditDurMdl(null)} footer={<><Btn variant="ghost" onClick={()=>setEditDurMdl(null)}>ยกเลิก</Btn><Btn onClick={()=>{setData(d=>({...d,phases:d.phases.map(p=>p.id===phase.id?{...p,days:editDurMdl.dur}:p),phaseProgress:{...d.phaseProgress,[house.id]:{...(d.phaseProgress[house.id]||{}),[phase.id]:editDurMdl}}}));setEditDurMdl(null);}}>✓ บันทึก</Btn></>}>
          <Alrt type="info">การแก้ไขระยะเวลาจะอัปเดต Gantt Chart โดยอัตโนมัติ</Alrt>
          <FG label="ระยะเวลา (วัน)"><FIn type="number" value={editDurMdl.dur} onChange={e=>setEditDurMdl(ed=>({...ed,dur:+e.target.value}))}/></FG>
        </Mdl>
      )}

      {/* Phase Name Edit Modal */}
      {editPhaseNameMdl&&editPhaseNameMdl.id===phase.id&&(
        <Mdl title={`✏️ แก้ไขชื่อหมวด ${editPhaseNameMdl.order}`} onClose={()=>setEditPhaseNameMdl(null)} footer={<><Btn variant="ghost" onClick={()=>setEditPhaseNameMdl(null)}>ยกเลิก</Btn><Btn onClick={()=>{setData(d=>({...d,phases:d.phases.map(p=>p.id===editPhaseNameMdl.id?{...p,name:editPhaseNameMdl.name}:p)}));setEditPhaseNameMdl(null);}}>✓ บันทึก</Btn></>}>
          <FG label="ชื่อหมวด"><FIn value={editPhaseNameMdl.name} onChange={e=>setEditPhaseNameMdl(ep=>({...ep,name:e.target.value}))}/></FG>
        </Mdl>
      )}
    </div>
  );
}

function HousePage({houseId,data,setData,role,onBack,onScrollToPhase}) {
  // Find house first
  const house=data.houses?.find(h=>h.id===houseId);
  
  // Early return if no house
  if(!house||!data.phases||data.phases.length===0){
    return<div style={{padding:20,display:"flex",flexDirection:"column",gap:10,color:C.red,alignItems:"flex-start"}}>
      <div>❌ ไม่พบข้อมูลบ้าน</div>
      <Btn size="sm" onClick={onBack}>← กลับ</Btn>
    </div>;
  }
  
  // All hooks must come before any conditional returns
  const [tab,setTab]=useState("boq");
  const [chatTxt,setChatTxt]=useState("");
  const [chatFile,setChatFile]=useState(null);
  const [orderMdl,setOrderMdl]=useState(null);
  const [approveMdl,setApproveMdl]=useState(null);
  const [billMdl,setBillMdl]=useState(null);
  const [addBoqMdl,setAddBoqMdl]=useState(false);
  const [editBoq,setEditBoq]=useState(null);
  const [editNotesModal,setEditNotesModal]=useState(null);
  const [editPhaseNameMdl,setEditPhaseNameMdl]=useState(null);
  const [nb,setNb]=useState({phaseId:1,name:"",unit:"ถุง",qty:1,boqPrice:0,startDate:"",endDate:"",notes:""});
  const [editPh,setEditPh]=useState(null);
  const chatRef=useRef(null);
  const fileRef=useRef(null);
  
  useEffect(()=>{chatRef.current?.scrollIntoView({behavior:"smooth"});},[data.messages.length]);

  const handleScrollToPhase=onScrollToPhase||((phaseId,messageId)=>{
    const element=document.getElementById(`phase-${phaseId}`);
    if(element){
      element.scrollIntoView({behavior:"smooth",block:"start"});
    }
    if(messageId){
      setTimeout(()=>{
        const msgElement=document.getElementById(`msg-${messageId}`);
        if(msgElement){
          msgElement.scrollIntoView({behavior:"smooth",block:"nearest"});
          msgElement.style.background="#1d3a6e";
          msgElement.style.transition="background 0.3s";
          setTimeout(()=>msgElement.style.background="",500);
        }
      },600);
    }
  });

  // Safe data access
  const msgs=data.messages?.filter(m=>m.houseId===house.id)|| [];
  const boqItems= data.boqItems?.filter(b=>b.houseId===house.id)||[];
  
  // Create default phaseProgress for houses that don't have it
  const getDefaultPhaseProgress=()=>{
    const defaults={};
    (data.phases||[]).forEach(p=>{
      defaults[p.id]={s:"waiting",dur:p.days||14,act:0};
    });
    return defaults;
  };
  
  const pp=data.phaseProgress[house.id]||getDefaultPhaseProgress();
  const canPrice=["owner","engineer","purchasing"].includes(role);
  const canEdit=["owner","engineer"].includes(role);
  const isOver=house.status==="completed"&&house.actual>house.boq;
  const dl=daysLeft(house.start,house.days);
  const getReq=itemId=>data.requests.find(r=>r.itemId===itemId&&r.houseId===house.id);

  function sendChat(){
    if(!chatTxt.trim()&&!chatFile)return;
    const reader=new FileReader();
    if(chatFile){
      reader.onload=()=>{
        setData(d=>({...d,messages:[...d.messages,{id:uid(),houseId:house.id,role,sender:ROLE_LBL[role],text:chatTxt,file:{name:chatFile.name,size:chatFile.size,type:chatFile.type,data:reader.result},time:new Date().toLocaleTimeString("th",{hour:"2-digit",minute:"2-digit"}),date:new Date().toISOString().slice(0,10)}]}));
        setChatTxt("");setChatFile(null);
      };
      reader.readAsArrayBuffer(chatFile);
    }else{
      setData(d=>({...d,messages:[...d.messages,{id:uid(),houseId:house.id,role,sender:ROLE_LBL[role],text:chatTxt,time:new Date().toLocaleTimeString("th",{hour:"2-digit",minute:"2-digit"}),date:new Date().toISOString().slice(0,10)}]}));
      setChatTxt("");
    }
  }
  function doOrder(item,qty,note){setData(d=>({...d,requests:[...d.requests,{id:uid(),houseId:house.id,itemId:item.id,status:"pending",date:new Date().toISOString().slice(0,10),by:ROLE_LBL[role],approvedBy:"",qty,unit:item.unit,note}],boqItems:d.boqItems.map(b=>b.id===item.id?{...b,status:"pending",orderedBy:ROLE_LBL[role]}:b)}));setOrderMdl(null);}
  function doApprove(req,edits){setData(d=>({...d,requests:d.requests.map(r=>r.id===req.id?{...r,status:"approved",approvedBy:"วิศวกร",...edits}:r),boqItems:d.boqItems.map(b=>b.id===req.itemId?{...b,status:"approved",approvedBy:"วิศวกร"}:b)}));setApproveMdl(null);}
  function doReject(req,reason){setData(d=>({...d,requests:d.requests.map(r=>r.id===req.id?{...r,status:"rejected",note:reason}:r),boqItems:d.boqItems.map(b=>b.id===req.itemId?{...b,status:"rejected"}:b)}));setApproveMdl(null);}
  function doReceive(item,ap){
    setData(d=>{
      const ni=d.boqItems.map(b=>b.id===item.id?{...b,status:"received",actualPrice:ap}:b);
      const na=ni.filter(b=>b.houseId===house.id&&b.actualPrice>0).reduce((s,b)=>s+b.qty*b.actualPrice,0);
      return {...d,boqItems:ni,houses:d.houses.map(h=>h.id===house.id?{...h,actual:na}:h)};
    });setBillMdl(null);
  }
  function addBoq(){if(!nb.name)return;setData(d=>({...d,boqItems:[...d.boqItems,{id:uid(),houseId:house.id,...nb,qty:Number(nb.qty),boqPrice:Number(nb.boqPrice),actualPrice:0,status:"notstarted",orderedBy:"",approvedBy:"",notes:""}]}));setAddBoqMdl(false);setNb({phaseId:1,name:"",unit:"ถุง",qty:1,boqPrice:0,startDate:"",endDate:"",notes:""});}

  const TABS=[{id:"boq",l:"\uD83D\uDCCA \u0E2A\u0E16\u0E32\u0E19\u0E30\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19"},{id:"gantt",l:"\uD83D\uDCC5 Gantt"},{id:"info",l:"\uD83C\uDFE0 \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1A\u0E49\u0E32\u0E19"}];

  // Gantt helpers
  const ganttData=(()=>{
    let cumDays=0;
    return data.phases.map(phase=>{
      const phPP=pp[phase.id]||{s:"waiting",dur:phase.days,act:0};
      const dur=phPP.dur||phase.days;
      const start=cumDays;
      cumDays+=dur;
      const startDate=addDays(house.start,start);
      const endDate=addDays(house.start,start+dur);
      return {phase,dur,start,end:cumDays,startDate,endDate,s:phPP.s};
    });
  })();
  const totalDays=ganttData.length>0?ganttData[ganttData.length-1].end:1;
  // Generate month labels — 7 months starting from project start month
  const ganttMonths=(()=>{
    const months=[];
    const s=new Date(house.start);
    const timelineStart=new Date(s);
    const timelineEndDate=new Date(timelineStart.getFullYear(),timelineStart.getMonth()+7,timelineStart.getDate());
    const timelineTotal=Math.round((timelineEndDate-timelineStart)/86400000);
    const thaiMonthFull=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    for(let i=0;i<7;i++){
      const yr=timelineStart.getFullYear()+Math.floor((timelineStart.getMonth()+i)/12);
      const mo=(timelineStart.getMonth()+i)%12;
      const mStartDate=new Date(yr,mo,timelineStart.getDate());
      const mEndDate=new Date(yr,mo+1,timelineStart.getDate());
      const mStart=Math.round((mStartDate-timelineStart)/86400000);
      const mEnd=Math.round((mEndDate-timelineStart)/86400000);
      months.push({
        label:thaiMonthFull[mo],
        yearLabel:(yr+543).toString(),
        left:(mStart/timelineTotal)*100,
        width:((mEnd-mStart)/timelineTotal)*100
      });
    }
    return {months,timelineStart,timelineTotal};
  })();

  return (
    <div style={{padding:24}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <Btn variant="ghost" size="sm" onClick={onBack}>← กลับ</Btn>
        <div style={{flex:1}}><div style={{fontSize:20,fontWeight:700,color:C.text}}>บ้านเลขที่ {house.name}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{house.customer||"ยังไม่มีลูกค้า"} · {house.phase}</div></div>
        <Tag color={house.status==="completed"?"green":house.status==="inprogress"?"blue":"gray"} style={{fontSize:12,padding:"4px 12px"}}>{ST_LBL[house.status]}</Tag>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:22}}>
        {[["ความคืบหน้า",`${house.pct}%`,C.blue,true],["วันคงเหลือ",dl<0?`เกิน ${Math.abs(dl)} วัน`:`${dl} วัน`,dl<0?C.red:dl<30?C.orange:C.text,false],canPrice&&["ค่าใช้จ่ายจริง",`฿${fmtMoney(house.actual)}`,isOver?C.red:C.text,false],canPrice&&["เทียบ BOQ",(isOver?"เกิน ":"")+`฿${fmtMoney(Math.abs(house.boq-house.actual))}`,isOver?C.red:C.green,false]].filter(Boolean).map(([l,v,col,showBar],i)=>(
          <Card key={i} style={{padding:"13px 16px"}}><div style={{fontSize:20,fontWeight:800,color:col}}>{v}</div>{showBar&&<PBar pct={house.pct} color={C.blue} h={4}/>}<div style={{fontSize:11,color:C.muted,marginTop:4}}>{l}</div></Card>
        ))}
      </div>
      <div style={{display:"flex",gap:2,background:"#0d1117",borderRadius:10,padding:3,marginBottom:18,border:`1px solid ${C.border}`,width:"fit-content"}}>
        {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"5px 13px",borderRadius:8,border:"none",background:tab===t.id?C.panel:"transparent",color:tab===t.id?C.blue:C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>{t.l}</button>)}
      </div>

      {tab==="boq"&&(
        <div>
          {data.phases.map((phase)=>(
            <PhaseCard key={phase.id} phase={phase} house={house} data={data} setData={setData} role={role} pp={pp} boqItems={boqItems} canEditDur={canEdit} setEditPhaseNameMdl={setEditPhaseNameMdl} editPhaseNameMdl={editPhaseNameMdl}/>
          ))}
        </div>
      )}

      {tab==="gantt"&&(
        <Card style={{padding:16,overflowX:"auto"}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>Gantt Chart</div>
          <div style={{fontSize:11,color:C.muted,marginBottom:16}}>{fmtDate(house.start)} — {fmtDate(addDays(house.start,totalDays))} ({totalDays} วัน)</div>
          <div style={{position:"relative",paddingLeft:160,minWidth:700,minHeight:ganttData.length*36+96}}>
            {/* Month header */}
            <div style={{position:"absolute",top:0,left:160,right:0,height:36,display:"flex",borderBottom:`1px solid ${C.border}`}}>
              {ganttMonths.months.map((m,i)=>(
                <div key={i} style={{flex:`0 0 ${m.width}%`,position:"relative",borderLeft:`1px solid ${C.border}`,boxSizing:"border-box"}}>
                  <div style={{textAlign:"center",fontSize:10,color:C.text,fontWeight:600,lineHeight:"16px",paddingTop:2,whiteSpace:"nowrap"}}>{m.label}</div>
                  <div style={{textAlign:"center",fontSize:8,color:C.muted,lineHeight:"12px"}}>{m.yearLabel}</div>
                </div>
              ))}
            </div>
            {/* Bars */}
            {ganttData.map((g,i)=>{
              const barColor=g.s==="done"?C.green:g.s==="inprogress"?C.blue:g.s==="waiting_review"?C.orange:"#334155";
              const projectStartMs=ganttMonths.timelineStart.getTime();
              const barStartMs=new Date(g.startDate).getTime();
              const barEndMs=new Date(g.endDate).getTime();
              const leftPct=((barStartMs-projectStartMs)/86400000/ganttMonths.timelineTotal)*100;
              const widthPct=((barEndMs-barStartMs)/86400000/ganttMonths.timelineTotal)*100;
              // Calculate variance: act vs dur (only for done/inprogress)
              const phPP=pp[g.phase.id]||{s:"waiting",dur:g.dur,act:0};
              let varText="";
              let varColor=C.text;
              if(g.s!=="waiting"){
                const variance=phPP.act-phPP.dur;
                varText=variance===0?"0":variance<0?`+${-variance}`:`-${variance}`;
                varColor=variance===0?C.text:variance<0?"#fff":C.red;
              }
              return (
                <div key={g.phase.id} style={{position:"absolute",top:36+38+i*36,left:0,right:0,height:32,display:"flex",alignItems:"center"}}>
                  <div style={{width:156,paddingRight:8,fontSize:10,color:C.text,fontWeight:600,textAlign:"right",flexShrink:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={g.phase.name} >
                    <div>{g.phase.order}. {g.phase.name}</div>
                    <div style={{fontSize:9,color:C.muted,fontWeight:500}}>{g.dur}วัน</div>
                  </div>
                  <div style={{flex:1,position:"relative",height:22}}>
                    <div style={{position:"absolute",left:`${leftPct}%`,width:`${Math.max(widthPct,0.5)}%`,height:"100%",background:barColor,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",cursor:"default",border:g.s==="inprogress"?"2px solid #60a5fa":"none"}} title={`${g.phase.name}\n${fmtDate(g.startDate)} - ${fmtDate(g.endDate)}\n${g.dur} วัน / ใช้ ${phPP.act} วัน`}>
                      <span style={{fontSize:10,color:varColor,fontWeight:700,textShadow:"0 1px 2px rgba(0,0,0,0.5)"}}>{varText}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Today line */}
            {(()=>{
              const today=new Date();
              const daysSince=Math.round((today-ganttMonths.timelineStart)/86400000);
              if(daysSince>=0&&daysSince<=ganttMonths.timelineTotal){
                const leftPct=(daysSince/ganttMonths.timelineTotal)*100;
                return <div style={{position:"absolute",top:36,bottom:0,left:`calc(160px + ${leftPct}%)`,width:2,background:C.red,zIndex:5}}><div style={{position:"absolute",top:-16,left:-14,fontSize:8,color:C.red,fontWeight:700,whiteSpace:"nowrap"}}>วันนี้</div></div>;
              }
              return null;
            })()}
          </div>
          {/* Legend */}
          <div style={{display:"flex",gap:16,marginTop:ganttData.length*36+110,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:12,height:12,borderRadius:3,background:C.green}}/><span style={{fontSize:10,color:C.muted}}>เสร็จแล้ว</span></div>
            <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:12,height:12,borderRadius:3,background:C.blue,border:"2px solid #60a5fa"}}/><span style={{fontSize:10,color:C.muted}}>กำลังทำ</span></div>
            <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:12,height:12,borderRadius:3,background:"#334155"}}/><span style={{fontSize:10,color:C.muted}}>รอเริ่ม</span></div>
            <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:2,height:12,background:C.red}}/><span style={{fontSize:10,color:C.muted}}>วันนี้</span></div>
          </div>
        </Card>
      )}

      {tab==="info"&&(
        <Card style={{padding:16}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:16}}>ข้อมูลบ้าน</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {[
              ["บ้านเลขที่",house.name],
              ["ลูกค้า",house.customer||"—"],
              ["วันเริ่มก่อสร้าง",fmtDate(house.start)],
              ["กำหนดเสร็จ",fmtDate(addDays(house.start,house.days))],
              ["ระยะเวลาทั้งหมด",house.days+" วัน"],
              ["โฟร์แมน",house.foreman||"—"],
              ["วิศวกร",house.engineer||"—"],
              ["สถานะ",ST_LBL[house.status]||house.status],
              ["ความคืบหน้า",house.pct+"%"],
              canPrice&&["งบประมาณ BOQ","\u0E3F"+fmtMoney(house.boq)],
              canPrice&&["ค่าใช้จ่ายจริง","\u0E3F"+fmtMoney(house.actual)],
              canPrice&&["ส่วนต่าง","\u0E3F"+fmtMoney(Math.abs(house.boq-house.actual))+(house.actual>house.boq?" (เกินงบ)":" (ประหยัด)")],
            ].filter(Boolean).map(([label,value])=>(
              <div key={label} style={{padding:12,background:C.bg,borderRadius:8,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:4}}>{label}</div>
                <div style={{fontSize:13,color:C.text,fontWeight:600}}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:16,padding:12,background:C.bg,borderRadius:8,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:8}}>สรุปหมวดงาน</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,textAlign:"center"}}>
              <div><div style={{fontSize:18,fontWeight:800,color:C.green}}>{ganttData.filter(g=>g.s==="done").length}</div><div style={{fontSize:10,color:C.muted}}>เสร็จแล้ว</div></div>
              <div><div style={{fontSize:18,fontWeight:800,color:C.blue}}>{ganttData.filter(g=>g.s==="inprogress").length}</div><div style={{fontSize:10,color:C.muted}}>กำลังทำ</div></div>
              <div><div style={{fontSize:18,fontWeight:800,color:C.muted}}>{ganttData.filter(g=>g.s!=="done"&&g.s!=="inprogress").length}</div><div style={{fontSize:10,color:C.muted}}>รอเริ่ม</div></div>
            </div>
          </div>
        </Card>
      )}

      {orderMdl&&<OrderMdl item={orderMdl} onConfirm={doOrder} onClose={()=>setOrderMdl(null)}/>}
      {approveMdl&&<ApproveMdl item={approveMdl.item} req={approveMdl.req} onApprove={doApprove} onReject={doReject} onClose={()=>setApproveMdl(null)}/>}
      {billMdl&&<BillMdl item={billMdl.item} onSave={doReceive} onClose={()=>setBillMdl(null)}/>}
      {editNotesModal&&<EditNotesMdl item={editNotesModal} phases={data.phases} onSave={(item,newNotes,newStartDate,newEndDate)=>{setData(d=>({...d,boqItems:d.boqItems.map(b=>b.id===item.id?{...b,notes:newNotes,startDate:newStartDate,endDate:newEndDate}:b)}));setEditNotesModal(null);}} onClose={()=>setEditNotesModal(null)}/>}
      {editBoq&&(
        <Mdl title="✏️ แก้ไขรายการ" onClose={()=>setEditBoq(null)} footer={<><Btn variant="ghost" onClick={()=>setEditBoq(null)}>ยกเลิก</Btn><Btn onClick={()=>{setData(d=>({...d,boqItems:d.boqItems.map(b=>b.id===editBoq[0].id?editBoq[0]:b)}));setEditBoq(null);}}>💾 บันทึก</Btn></>}>
          <div style={{gridColumn:"1/-1"}}><FG label="ชื่อรายการ"><FIn value={editBoq[0].name} onChange={e=>setEditBoq([{...editBoq[0],name:e.target.value}])}/></FG></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="หมวดงาน"><FSel value={editBoq[0].phaseId} onChange={e=>setEditBoq([{...editBoq[0],phaseId:+e.target.value}])}>{data.phases.map(p=><option key={p.id} value={p.id}>หมวด {p.order} — {p.name}</option>)}</FSel></FG>
            <FG label="หน่วย"><FSel value={editBoq[0].unit} onChange={e=>setEditBoq([{...editBoq[0],unit:e.target.value}])}>{["ถุง","เมตร","ก้อน","เส้น","ชุด","ม้วน","คิว","แผ่น","ครั้ง"].map(u=><option key={u}>{u}</option>)}</FSel></FG>
            <FG label="จำนวน"><FIn type="number" value={editBoq[0].qty} onChange={e=>setEditBoq([{...editBoq[0],qty:+e.target.value}])}/></FG>
            <FG label="ราคาต่อหน่วย (฿)"><FIn type="number" value={editBoq[0].boqPrice} onChange={e=>setEditBoq([{...editBoq[0],boqPrice:+e.target.value}])}/></FG>
            <FG label="วันเริ่มงาน"><FIn type="date" value={editBoq[0].startDate} onChange={e=>setEditBoq([{...editBoq[0],startDate:e.target.value}])}/></FG>
            <FG label="วันเสร็จงาน"><FIn type="date" value={editBoq[0].endDate} onChange={e=>setEditBoq([{...editBoq[0],endDate:e.target.value}])}/></FG>
          </div>
        </Mdl>
      )}
      {addBoqMdl&&(
        <Mdl title="+ เพิ่มรายการ BOQ" onClose={()=>setAddBoqMdl(false)} footer={<><Btn variant="ghost" onClick={()=>setAddBoqMdl(false)}>ยกเลิก</Btn><Btn onClick={addBoq} disabled={!nb.name}>+ เพิ่ม</Btn></>}>
          <div style={{gridColumn:"1/-1"}}><FG label="ชื่อรายการ *"><FIn value={nb.name} onChange={e=>setNb(b=>({...b,name:e.target.value}))} placeholder="เช่น ปูนซีเมนต์..."/></FG></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="หมวดงาน"><FSel value={nb.phaseId} onChange={e=>setNb(b=>({...b,phaseId:+e.target.value}))}>{data.phases.map(p=><option key={p.id} value={p.id}>หมวด {p.order} — {p.name}</option>)}</FSel></FG>
            <FG label="หน่วย"><FSel value={nb.unit} onChange={e=>setNb(b=>({...b,unit:e.target.value}))}>{["ถุง","เมตร","ก้อน","เส้น","ชุด","ม้วน","คิว","แผ่น","ครั้ง"].map(u=><option key={u}>{u}</option>)}</FSel></FG>
            <FG label="จำนวน"><FIn type="number" value={nb.qty} onChange={e=>setNb(b=>({...b,qty:e.target.value}))}/></FG>
            <FG label="ราคาต่อหน่วย (฿)"><FIn type="number" value={nb.boqPrice} onChange={e=>setNb(b=>({...b,boqPrice:e.target.value}))}/></FG>
            <FG label="วันเริ่มงาน"><FIn type="date" value={nb.startDate} onChange={e=>setNb(b=>({...b,startDate:e.target.value}))}/></FG>
            <FG label="วันเสร็จงาน"><FIn type="date" value={nb.endDate} onChange={e=>setNb(b=>({...b,endDate:e.target.value}))}/></FG>
          </div>
        </Mdl>
      )}
    </div>
  );
}

function GanttTab({phases,pp,house,role,setData,editPh,setEditPh}) {
  if(!phases||!house){
    return<div style={{padding:20,color:C.red}}>ไม่มีข้อมูล Gantt</div>;
  }
  
  return(
    <div>
      <div style={{fontSize:12,color:C.muted,marginBottom:12}}>แผนก่อสร้าง {house.days} วัน ตั้งแต่ {fmtDate(house.start)}</div>
      
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {phases.map(phase=>{
          const phProg=pp?.[phase.id]||{s:"waiting",dur:phase.days,act:0};
          const pctDone=phProg.dur>0?Math.round((phProg.act/phProg.dur)*100):0;
          
          return(
            <Card key={phase.id} style={{padding:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:12,fontWeight:600,color:C.text}}>หมวด {phase.order} — {phase.name}</div>
                {["owner","engineer","foreman"].includes(role)&&<span style={{fontSize:12,color:C.blue,cursor:"pointer"}} onClick={()=>setEditPh({phase,p:{...phProg}})} onMouseDown={e=>e.stopPropagation()}>✏️ แก้ไข</span>}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:6}}>
                <span>{phProg.s==="done"?"✓ เสร็จ":phProg.s==="inprogress"?"กำลังทำ":"รอ"}</span>
                <span>{phProg.act}/{phProg.dur} วัน ({pctDone}%)</span>
              </div>
              <div style={{height:6,background:C.faint,borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${Math.min(pctDone,100)}%`,background:phProg.s==="done"?C.green:phProg.s==="inprogress"?C.blue:C.muted,borderRadius:3}}/>
              </div>
            </Card>
          );
        })}
      </div>
      
      {editPh&&<Mdl title={`แก้ไข หมวด ${editPh.phase.order}`} onClose={()=>setEditPh(null)} footer={<><Btn variant="ghost" onClick={()=>setEditPh(null)}>ยกเลิก</Btn><Btn onClick={()=>{setData(d=>({...d,phaseProgress:{...d.phaseProgress,[house.id]:{...(d.phaseProgress[house.id]||{}),[editPh.phase.id]:editPh.p}}}));setEditPh(null);}}>บันทึก</Btn></>}>
        <FG label="สถานะ"><FSel value={editPh.p.s} onChange={e=>setEditPh(ep=>({...ep,p:{...ep.p,s:e.target.value}}))}><option value="waiting">รอ</option><option value="inprogress">กำลังทำ</option><option value="done">เสร็จ</option></FSel></FG>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FG label="วันแผน"><FIn type="number" value={editPh.p.dur} onChange={e=>setEditPh(ep=>({...ep,p:{...ep.p,dur:+e.target.value||0}}))}/></FG>
          <FG label="วันใช้จริง"><FIn type="number" value={editPh.p.act} onChange={e=>setEditPh(ep=>({...ep,p:{...ep.p,act:+e.target.value||0}}))}/></FG>
        </div>
      </Mdl>}
    </div>
  );
}

function OrderMdl({item,onConfirm,onClose}) {
  const [qty,setQty]=useState(item.qty);
  const [note,setNote]=useState("");
  return (
    <Mdl title="🛒 สั่งซื้อวัสดุ" onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>ยกเลิก</Btn><Btn onClick={()=>onConfirm(item,qty,note)}>📤 ส่งคำสั่ง</Btn></>}>
      <Alrt type="info">คำสั่งซื้อจะส่งให้วิศวกร Approve ก่อน</Alrt>
      <FG label="รายการ"><FIn value={item.name} style={{opacity:.7}} onChange={()=>{}}/></FG>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <FG label="จำนวน"><FIn type="number" value={qty} onChange={e=>setQty(+e.target.value)}/></FG>
        <FG label="หน่วย"><FIn value={item.unit} style={{opacity:.7}} onChange={()=>{}}/></FG>
      </div>
      <FG label="หมายเหตุ"><FIn value={note} onChange={e=>setNote(e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." rows={2}/></FG>
    </Mdl>
  );
}

function ApproveMdl({item,req,onApprove,onReject,onClose}) {
  const [qty,setQty]=useState(req?.qty||item.qty);
  const [note,setNote]=useState("");
  const [rej,setRej]=useState(false);
  const [reason,setReason]=useState("");
  return (
    <Mdl title="⚙️ ตรวจสอบคำสั่งซื้อ" onClose={onClose}
      footer={rej?<><Btn variant="ghost" onClick={()=>setRej(false)}>← กลับ</Btn><Btn variant="danger" onClick={()=>onReject(req,reason)} disabled={!reason}>ยืนยันปฏิเสธ</Btn></>
        :<><Btn variant="danger" size="sm" onClick={()=>setRej(true)}>❌ ปฏิเสธ</Btn><Btn variant="ghost" onClick={onClose}>ยกเลิก</Btn><Btn variant="success" onClick={()=>onApprove(req,{qty,note})}>✅ อนุมัติ</Btn></>}>
      {!rej?<>
        <FG label="รายการ"><FIn value={item.name} style={{opacity:.7}} onChange={()=>{}}/></FG>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FG label="จำนวน (แก้ไขได้)"><FIn type="number" value={qty} onChange={e=>setQty(+e.target.value)}/></FG>
          <FG label="ราคา BOQ"><FIn value={`฿${fmtMoney(item.boqPrice*qty)}`} style={{opacity:.7}} onChange={()=>{}}/></FG>
        </div>
        {req?.note&&<Alrt type="info">หมายเหตุโฟร์แมน: {req.note}</Alrt>}
        <FG label="หมายเหตุถึงจัดซื้อ"><FIn value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder="รายละเอียดถึงฝ่ายจัดซื้อ..."/></FG>
      </>:<>
        <Alrt type="danger">กรุณาระบุเหตุผลเพื่อแจ้งโฟร์แมน</Alrt>
        <FG label="เหตุผล *"><FIn value={reason} onChange={e=>setReason(e.target.value)} rows={3} placeholder="เหตุผล..."/></FG>
      </>}
    </Mdl>
  );
}

function BillMdl({item,onSave,onClose}) {
  const [price,setPrice]=useState(item.actualPrice||item.boqPrice);
  const diff=(price-item.boqPrice)*item.qty;
  return (
    <Mdl title="💰 อัปเดตราคาจริง" onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>ยกเลิก</Btn><Btn variant="success" onClick={()=>onSave(item,price)}>✅ บันทึกราคา</Btn></>}>
      <Alrt type="info">อัปเดตราคาที่จ่ายจริง เปรียบเทียบกับราคาที่คาดการณ์ไว้ (BOQ)</Alrt>
      <FG label="รายการ"><FIn value={item.name} style={{opacity:.7}} onChange={()=>{}}/></FG>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <FG label="จำนวน"><FIn value={item.qty} style={{opacity:.7}} onChange={()=>{}}/></FG>
        <FG label="หน่วย"><FIn value={item.unit} style={{opacity:.7}} onChange={()=>{}}/></FG>
      </div>
      <FG label="ราคาต่อหน่วยจริง (฿) *"><FIn type="number" value={price} onChange={e=>setPrice(+e.target.value)}/></FG>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,background:C.border,borderRadius:8,overflow:"hidden",marginBottom:14}}>
        {[["ราคา BOQ",`฿${fmtMoney(item.boqPrice*item.qty)}`,C.text],["ราคาจริง",`฿${fmtMoney(price*item.qty)}`,diff>0?C.red:C.green],["ส่วนต่าง",(diff>0?"+":"")+`฿${fmtMoney(diff)}`,diff>0?C.red:C.green]].map(([l,v,col])=>(
          <div key={l} style={{background:C.panel,padding:"9px",textAlign:"center"}}><div style={{fontSize:9,color:C.muted}}>{l}</div><div style={{fontSize:13,fontWeight:700,color:col,marginTop:2}}>{v}</div></div>
        ))}
      </div>
    </Mdl>
  );
}

function EditNotesMdl({item,phases,onSave,onClose}) {
  const [startDate,setStartDate]=useState(item.startDate);
  const [endDate,setEndDate]=useState(item.endDate);
  const [remarks,setRemarks]=useState(item.notes||"");
  const dur=Math.ceil((new Date(endDate)-new Date(startDate))/86400000);
  return (
    <Mdl title="📝 แก้ไขหมายเหตุและวันที่" onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>ยกเลิก</Btn><Btn variant="success" onClick={()=>onSave(item,remarks,startDate,endDate)}>✅ บันทึก</Btn></>}>
      <Alrt type="info">แก้ไขวันเริ่ม/สิ้นสุดและเพิ่มหมายเหตุสำหรับรายการนี้</Alrt>
      <FG label="รายการ"><FIn value={item.name} style={{opacity:.7}} onChange={()=>{}}/></FG>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <FG label="📅 วันเริ่มงาน"><FIn type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></FG>
        <FG label="📅 วันเสร็จงาน"><FIn type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></FG>
      </div>
      {dur>0&&<div style={{fontSize:11,color:C.muted,padding:"8px 12px",background:C.faint,borderRadius:8,marginBottom:12}}>⏱️ ระยะเวลา: {dur} วัน</div>}
      <FG label="📝 หมายเหตุ/ความคิดเห็น"><FIn value={remarks} onChange={e=>setRemarks(e.target.value)} rows={4} placeholder="เพิ่มหมายเหตุ เช่น ปัญหา ความล่าช้า หรือหมายเหตุพิเศษ..."/></FG>
    </Mdl>
  );
}

// ═══════════════════════════════════════════════════════════════
// END OF PART 5
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// PART 6: Marketing Page
// ═══════════════════════════════════════════════════════════════

function MarketingPage({data,setData}) {
  const [editMdl,setEditMdl]=useState(null);
  const [form,setForm]=useState({});
  const PCOL={50:C.red,75:C.orange,100:C.green};
  function openEdit(house){const c=data.customers.find(c=>c.houseId===house.id)||{houseId:house.id,name:"",phone:"",type:"loan",bank:"",preApproved:false,prob:50,note:""};setForm({...c});setEditMdl(house);}
  function save(){setData(d=>{const e=d.customers.find(c=>c.houseId===form.houseId);return{...d,customers:e?d.customers.map(c=>c.houseId===form.houseId?form:c):[...d.customers,form],houses:d.houses.map(h=>h.id===form.houseId?{...h,customer:form.name}:h)};});setEditMdl(null);}
  return (
    <div style={{padding:24}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div><div style={{fontSize:22,fontWeight:700,color:C.text}}>ภาพรวมการตลาด</div><div style={{fontSize:13,color:C.muted,marginTop:2}}>สถานะลูกค้าและความคืบหน้าทุกหลัง</div></div>
        <div style={{display:"flex",gap:8}}>{[[100,C.green,"แน่นอน"],[75,C.orange,"โอกาสสูง"],[50,C.red,"ติดตาม"]].map(([p,col,l])=><Card key={p} style={{padding:"8px 13px",textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:col}}>{data.customers.filter(c=>c.prob===p).length}</div><div style={{fontSize:10,color:C.muted}}>{p}% {l}</div></Card>)}</div>
      </div>
      <Card>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["บ้าน","ลูกค้า","ประเภท","% โอกาส","ความคืบหน้า","ขั้นตอน","วันเสร็จ","เหลือ",""].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,background:"#0d1117",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>
            {data.houses.map(h=>{
              const c=data.customers.find(cu=>cu.houseId===h.id);
              const dl=daysLeft(h.start,h.days);
              return (
                <tr key={h.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background=C.panel} onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td style={{padding:"9px 12px"}}><Tag color="blue">{h.name}</Tag><div style={{fontSize:10,color:C.muted,marginTop:2}}>{data.projects.find(p=>p.id===h.projectId)?.name}</div></td>
                  <td style={{padding:"9px 12px"}}><div style={{fontSize:13,color:C.text}}>{c?.name||<span style={{color:C.muted}}>— ว่าง</span>}</div>{c?.phone&&<div style={{fontSize:11,color:C.muted}}>{c.phone}</div>}</td>
                  <td style={{padding:"9px 12px"}}>{c?<><Tag color={c.type==="cash"?"green":"blue"}>{c.type==="cash"?"💵 ซื้อสด":`🏦 ${c.bank||"กู้ธนาคาร"}`}</Tag>{c.preApproved&&<Tag color="green" style={{marginLeft:4}}>✓ Pre-approved</Tag>}</>:"—"}</td>
                  <td style={{padding:"9px 12px"}}>{c?<span style={{fontSize:13,fontWeight:700,color:PCOL[c.prob]}}>{c.prob}%</span>:"—"}</td>
                  <td style={{padding:"9px 12px",minWidth:110}}><div style={{display:"flex",alignItems:"center",gap:7}}><div style={{flex:1,height:5,background:C.faint,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${h.pct}%`,background:C.blue,borderRadius:3}}/></div><span style={{fontSize:11,fontWeight:700,color:C.blue}}>{h.pct}%</span></div></td>
                  <td style={{padding:"9px 12px",fontSize:12,color:C.muted}}>{h.phase}</td>
                  <td style={{padding:"9px 12px",fontSize:12,color:C.text}}>{fmtDate(addDays(h.start,h.days))}</td>
                  <td style={{padding:"9px 12px",fontSize:12,color:h.status==="completed"?C.green:dl<0?C.red:dl<30?C.orange:C.muted}}>{h.status==="completed"?"✓ เสร็จ":dl<0?`เกิน ${Math.abs(dl)} วัน`:`${dl} วัน`}</td>
                  <td style={{padding:"9px 12px"}}><Btn size="sm" variant="ghost" onClick={()=>openEdit(h)}>✏️</Btn></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {editMdl&&(
        <Mdl title={`👤 ลูกค้า — บ้าน ${editMdl.name}`} onClose={()=>setEditMdl(null)} footer={<><Btn variant="ghost" onClick={()=>setEditMdl(null)}>ยกเลิก</Btn><Btn onClick={save}>💾 บันทึก</Btn></>}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="ชื่อ-นามสกุล"><FIn value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></FG>
            <FG label="เบอร์โทร"><FIn value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></FG>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="ประเภทการซื้อ"><FSel value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option value="cash">💵 ซื้อสด</option><option value="loan">🏦 กู้ธนาคาร</option><option value="unknown">— ยังไม่ระบุ</option></FSel></FG>
            {form.type==="loan"&&<FG label="ธนาคาร"><FIn value={form.bank} onChange={e=>setForm(f=>({...f,bank:e.target.value}))} placeholder="ชื่อธนาคาร..."/></FG>}
          </div>
          <FG label="% โอกาสซื้อ"><FSel value={form.prob} onChange={e=>setForm(f=>({...f,prob:+e.target.value}))}><option value={50}>50% — อาจกู้ไม่ผ่าน</option><option value={75}>75% — โอกาสสูง</option><option value={100}>100% — ซื้อสด / Pre-approved</option></FSel></FG>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderTop:`1px solid ${C.border}`,marginBottom:12}}>
            <span style={{fontSize:12,fontWeight:700,color:C.muted}}>Pre-approved แล้ว</span>
            <label style={{position:"relative",width:40,height:22,cursor:"pointer",display:"block"}}>
              <input type="checkbox" checked={form.preApproved} onChange={e=>setForm(f=>({...f,preApproved:e.target.checked,prob:e.target.checked?100:f.prob}))} style={{opacity:0,width:0,height:0,position:"absolute"}}/>
              <span style={{position:"absolute",inset:0,background:form.preApproved?C.blue:C.faint,borderRadius:22,transition:".2s"}}/>
              <span style={{position:"absolute",width:16,height:16,top:3,left:form.preApproved?21:3,background:"#fff",borderRadius:"50%",transition:".2s"}}/>
            </label>
          </div>
          <FG label="หมายเหตุ"><FIn value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} rows={2} placeholder="บันทึกการติดตาม..."/></FG>
        </Mdl>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// END OF PART 6
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// PART 7: Payments, Analytics & Finance Pages
// ═══════════════════════════════════════════════════════════════

function PaymentsPage({data,setData,role}) {
  const [filter,setFilter]=useState("all");
  const payments=data.payments.filter(p=>filter==="all"||p.status===filter);
  const getHouse=id=>data.houses.find(h=>h.id===id);
  const canEdit=["owner","engineer"].includes(role);
  
  function updatePayment(id,updates){
    setData(d=>({...d,payments:d.payments.map(p=>p.id===id?{...p,...updates}:p)}));
  }

  const ps=getPaymentStatus(data);
  const totalEarned=getTotalEarned(data);
  const totalDue=getTotalDueAmount(data);

  return (
    <div style={{padding:24}}>
      <div style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:20}}>💰 การจัดการชำระเงิน</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        <Card style={{padding:15}}><div style={{fontSize:18,marginBottom:5}}>💵</div><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>ชำระแล้ว</div><div style={{fontSize:20,fontWeight:800,color:C.green}}>฿{fmtMoney(totalEarned)}</div><div style={{fontSize:11,color:C.muted,marginTop:3}}>{ps.paid} รายการ</div></Card>
        <Card style={{padding:15}}><div style={{fontSize:18,marginBottom:5}}>⏳</div><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>รอชำระ</div><div style={{fontSize:20,fontWeight:800,color:C.blue}}>฿{fmtMoney(totalDue)}</div><div style={{fontSize:11,color:C.muted,marginTop:3}}>{ps.pending} รายการ</div></Card>
        <Card style={{padding:15}}><div style={{fontSize:18,marginBottom:5}}>⚠️</div><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>ชำระล่าช้า</div><div style={{fontSize:20,fontWeight:800,color:C.red}}>฿{fmtMoney(data.payments.filter(p=>p.status==="pending"&&new Date(p.dueDate)<new Date()).reduce((s,p)=>s+p.amount,0))}</div><div style={{fontSize:11,color:C.muted,marginTop:3}}>{ps.late} รายการ</div></Card>
        <Card style={{padding:15}}><div style={{fontSize:18,marginBottom:5}}>📊</div><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>รวมทั้งหมด</div><div style={{fontSize:20,fontWeight:800,color:C.text}}>฿{fmtMoney(totalEarned+totalDue)}</div><div style={{fontSize:11,color:C.muted,marginTop:3}}>{data.payments.length} ราย</div></Card>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {[["all","ทั้งหมด"],["pending","รอชำระ"],["paid","ชำระแล้ว"]].map(([v,l])=><Btn key={v} variant={filter===v?"primary":"ghost"} size="sm" onClick={()=>setFilter(v)}>{l}</Btn>)}
        <div style={{flex:1}}/>
        <Btn variant="ghost" size="sm" onClick={()=>exp2CSV(["วันที่","บ้าน","จำนวน","สถานะ","กำหนดชำระ"],[...payments.map(p=>{const h=getHouse(p.houseId);return[p.date,h?.name||"?",`฿${fmtMoney(p.amount)}`,p.status,p.dueDate];})])}>📥 Export CSV</Btn>
      </div>
      <Card>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["วันที่","บ้าน","ลูกค้า","จำนวน","สถานะ","กำหนดชำระ","ชำระเมื่อ","หมายเหตุ",""].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>{h}</th>)}</tr></thead>
          <tbody>
            {payments.map(p=>{
              const h=getHouse(p.houseId);const daysLeft=Math.ceil((new Date(p.dueDate)-new Date())/86400000);const isLate=daysLeft<0;
              return (
                <tr key={p.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background=C.panel} onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td style={{padding:"9px 12px",fontSize:12,color:C.muted}}>{p.date}</td>
                  <td style={{padding:"9px 12px"}}><Tag color="blue">{h?.name}</Tag></td>
                  <td style={{padding:"9px 12px",fontSize:13,color:C.text}}>{h?.customer||"—"}</td>
                  <td style={{padding:"9px 12px",fontSize:13,fontWeight:700,color:C.blue}}>฿{fmtMoney(p.amount)}</td>
                  <td style={{padding:"9px 12px"}}>{p.status==="paid"?<Tag color="green">✓ ชำระแล้ว</Tag>:isLate?<Tag color="red">⚠️ ล่าช้า</Tag>:<Tag color="orange">⏳ รอ</Tag>}</td>
                  <td style={{padding:"9px 12px",fontSize:12,color:isLate?C.red:C.muted}}>{p.dueDate}{isLate&&`  (เกิน ${Math.abs(daysLeft)} วัน)`}</td>
                  <td style={{padding:"9px 12px",fontSize:12,color:C.muted}}>{p.paidDate||"—"}</td>
                  <td style={{padding:"9px 12px",fontSize:12,color:C.muted}}>{p.milestone}</td>
                  <td style={{padding:"9px 12px"}}>{canEdit&&p.status==="pending"&&<Btn size="sm" variant="success" onClick={()=>updatePayment(p.id,{status:"paid",paidDate:new Date().toISOString().slice(0,10),method:"transfer"})}>✓</Btn>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PART 7: Timeline Page (Construction Progress for all users)
// ═══════════════════════════════════════════════════════════════

function TimelinePage({data,role,onOpenHouse}) {
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");
  
  const filtered=data.houses.filter(h=>{
    const matchSearch=h.name.toLowerCase().includes(search.toLowerCase())||h.customer?.toLowerCase().includes(search.toLowerCase());
    const matchStatus=statusFilter==="all"||h.status===statusFilter;
    return matchSearch&&matchStatus;
  });

  return (
    <div style={{padding:12}}>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:16,fontWeight:700,color:C.text}}>📈 ไทม์ไลน์</div>
        <div style={{fontSize:10,color:C.muted,marginTop:1}}>{filtered.length} หลัง</div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:150}}>
          <FIn 
            placeholder="🔍 ค้นหา..." 
            value={search} 
            onChange={e=>setSearch(e.target.value)}
            style={{fontSize:11,padding:"4px 8px"}}
          />
        </div>
        <div style={{display:"flex",gap:4}}>
          {[["all","ทั้งหมด"],["inprogress","🔄"],["completed","✓"],["notstarted","⏳"]].map(([val,label])=>(
            <button 
              key={val}
              onClick={()=>setStatusFilter(val)}
              style={{
                padding:"3px 8px",
                borderRadius:4,
                border:`1px solid ${statusFilter===val?C.blue:C.border2}`,
                background:statusFilter===val?C.blueDim:"transparent",
                color:statusFilter===val?C.blue:C.muted,
                fontSize:10,
                fontWeight:600,
                cursor:"pointer"
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:6}}>
        {filtered.map(house=>{
          const project=data.projects.find(p=>p.id===house.projectId);
          const totalCost=data.boqItems.filter(b=>b.houseId===house.id).reduce((s,i)=>s+i.qty*i.boqPrice,0);
          const actualCost=data.boqItems.filter(b=>b.houseId===house.id).reduce((s,i)=>s+i.qty*i.actualPrice,0);
          const isOver=actualCost>totalCost;
          return (
            <div 
              key={house.id} 
              onClick={()=>onOpenHouse(house)}
              style={{background:C.panel,borderLeft:`3px solid ${house.status==="completed"?C.green:house.status==="inprogress"?C.blue:C.muted}`,borderRadius:6,padding:8,cursor:"pointer",transition:"all .2s",border:`1px solid ${C.border}`}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.blue}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
            >
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:6}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>บ้าน {house.name}</div>
                  <div style={{fontSize:9,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{project?.name}</div>
                </div>
                <Tag color={house.status==="completed"?"green":house.status==="inprogress"?"blue":"gray"} style={{fontSize:8,padding:"1px 4px",marginLeft:4,flexShrink:0}}>{ST_LBL[house.status]}</Tag>
              </div>
              
              <div style={{marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2,fontSize:8}}>
                  <span style={{color:C.muted,fontWeight:700}}>ก่อ</span>
                  <span style={{fontWeight:700,color:C.blue}}>{house.pct}%</span>
                </div>
                <PBar pct={house.pct} color={C.blue} h={4}/>
              </div>

              <div style={{display:"grid",gridTemplateColumns:role==="owner"?"1fr 1fr":"1fr",gap:4,fontSize:8}}>
                <div style={{background:"#0d1117",borderRadius:3,padding:"3px 4px"}}>
                  <div style={{color:C.muted,fontWeight:700,fontSize:7}}>เฟส</div>
                  <div style={{color:C.text,fontWeight:600,fontSize:9,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{house.phase}</div>
                </div>
                <div style={{background:"#0d1117",borderRadius:3,padding:"3px 4px",textAlign:"center"}}>
                  <div style={{color:C.muted,fontWeight:700,fontSize:7}}>วัน</div>
                  <div style={{color:daysLeft(house.start,house.days)<0?C.red:C.text,fontWeight:600,fontSize:9}}>
                    {daysLeft(house.start,house.days)<0?`-${Math.abs(daysLeft(house.start,house.days))}`:`${daysLeft(house.start,house.days)}`}
                  </div>
                </div>
              </div>

              {role==="owner"&&(
                <div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:3,fontSize:8,textAlign:"center"}}>
                  <div>
                    <div style={{color:C.muted,fontWeight:700,fontSize:7,marginBottom:1}}>งบ</div>
                    <div style={{color:C.blue,fontWeight:700,fontSize:9}}>฿{fmtMoney(totalCost/1000)}K</div>
                  </div>
                  <div>
                    <div style={{color:C.muted,fontWeight:700,fontSize:7,marginBottom:1}}>ใช้</div>
                    <div style={{color:isOver?C.red:C.text,fontWeight:700,fontSize:9}}>฿{fmtMoney(actualCost/1000)}K</div>
                  </div>
                  <div>
                    <div style={{color:C.muted,fontWeight:700,fontSize:7,marginBottom:1}}>Δ</div>
                    <div style={{color:isOver?C.red:C.green,fontWeight:700,fontSize:9}}>{isOver?"+":""}฿{fmtMoney(Math.abs(totalCost-actualCost)/1000)}K</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length===0&&(
        <div style={{textAlign:"center",padding:"20px 0",color:C.muted,fontSize:12}}>
          ไม่พบบ้านตรงกับเงื่อนไข
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PART 8: Analytics & Finance Pages
// ═══════════════════════════════════════════════════════════════

function AnalyticsPage({data}) {
  const [chartType,setChartType]=useState("progress");
  const [selectedHouseId,setSelectedHouseId]=useState(null);
  const metrics=getProjectMetrics(data);
  const costBreakdown=getCostBreakdown(data);
  const selectedHouse=data.houses.find(h=>h.id===selectedHouseId);
  
  return (
    <div style={{padding:24}}>
      <div style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:20}}>📊 Analytics & Reports</div>
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {[["cost","🔍 ต้นทุนตามหมวดงาน"],["progress","📈 ความคืบหน้า"],["team","👥 ทีมงาน"]].map(([v,l])=><Btn key={v} variant={chartType===v?"primary":"ghost"} size="sm" onClick={()=>setChartType(v)}>{l}</Btn>)}
      </div>
      
      {chartType==="cost"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Card style={{padding:20}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:15}}>ต้นทุนตามหมวดงาน</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {costBreakdown.sort((a,b)=>b.cost-a.cost).slice(0,8).map((c,i)=>{
                const total=costBreakdown.reduce((s,x)=>s+x.cost,0);
                const pct=total>0?Math.round(c.cost/total*100):0;
                return (
                  <div key={i}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12,color:C.text}}>{c.phase}</span>
                      <span style={{fontSize:12,fontWeight:700,color:C.blue}}>฿{fmtMoney(c.cost)}</span>
                    </div>
                    <div style={{height:8,background:C.faint,borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${pct}%`,background:C.blue,borderRadius:4}}/>
                    </div>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card style={{padding:20}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:15}}>สรุปตามโครงการ</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {Object.entries(metrics).map(([name,m])=>(
                <div key={name} style={{padding:10,background:"#0d1117",borderRadius:8,border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:6}}>{name}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,fontSize:11}}>
                    <div><span style={{color:C.muted}}>บ้าน:</span> <span style={{fontWeight:700,color:C.blue}}>{m.total}</span></div>
                    <div><span style={{color:C.muted}}>เสร็จ:</span> <span style={{fontWeight:700,color:C.green}}>{m.completed}</span></div>
                    <div><span style={{color:C.muted}}>กำลังทำ:</span> <span style={{fontWeight:700,color:C.blue}}>{m.inprogress}</span></div>
                  </div>
                  <div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",fontSize:11}}>
                    <div><span style={{color:C.muted}}>BOQ:</span> <span style={{fontWeight:700,color:C.blue}}>฿{fmtMoney(m.boq)}</span></div>
                    <div><span style={{color:C.muted}}>ใช้จริง:</span> <span style={{fontWeight:700,color:m.actual>m.boq?C.red:C.green}}>฿{fmtMoney(m.actual)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {chartType==="progress"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:12}}>
          {data.houses.map(h=>{
            const status=({inprogress:C.blue,completed:C.green,notstarted:C.muted,delayed:C.red})[h.status]||C.muted;
            return (
              <Card key={h.id} onClick={()=>setSelectedHouseId(h.id)} style={{padding:15,cursor:"pointer",transition:"all 0.2s",border:`2px solid ${selectedHouseId===h.id?C.blue:C.border}`,background:selectedHouseId===h.id?"#1a2942":C.panel}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:10}}>
                  <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>บ้าน {h.name}</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{h.customer||"—"}</div></div>
                  <Tag color={h.status==="completed"?"green":h.status==="inprogress"?"blue":"gray"}>{ST_LBL[h.status]}</Tag>
                </div>
                <PBar pct={h.pct} color={status} h={6}/>
                <div style={{fontSize:11,color:C.muted,marginTop:6}}>ความคืบหน้า {h.pct}% · {h.phase}</div>
              </Card>
            );
          })}
        </div>
      )}

      {chartType==="team"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:12}}>
          {data.team.map(t=>{
            const count=data.houses.filter(h=>h.foreman===t.name||h.engineer===t.name).length;
            return (
              <Card key={t.id} style={{padding:15}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <div style={{width:40,height:40,borderRadius:8,background:ROLE_COL[t.role],display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{(t.name||"?")[0]}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:C.text}}>{t.name}</div>
                    <div style={{fontSize:11,color:ROLE_COL[t.role]}}>{ROLE_LBL[t.role]}</div>
                  </div>
                  <div style={{marginLeft:"auto"}}>
                    <Tag color={t.status==="active"?"green":"gray"}>{t.status==="active"?"✓ Active":"Inactive"}</Tag>
                  </div>
                </div>
                <div style={{paddingTop:10,borderTop:`1px solid ${C.border}`,fontSize:12}}>
                  <div><span style={{color:C.muted}}>📧</span> {t.email}</div>
                  <div style={{color:C.muted,marginTop:4}}><span style={{color:C.muted}}>📞</span> {t.phone}</div>
                  {count>0&&<div style={{marginTop:6,padding:6,background:"#0d1117",borderRadius:6,fontSize:11,color:C.blue,fontWeight:700}}>👷 อยู่ในโครงการ: {count}</div>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selectedHouse&&selectedHouseId&&(
        <Mdl title={`📋 รายละเอียดบ้าน ${selectedHouse.name} — ${selectedHouse.customer||"—"}`} onClose={()=>setSelectedHouseId(null)} size="lg">
          <div style={{marginBottom:20}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:16}}>
              <div><div style={{fontSize:11,color:C.muted,fontWeight:700}}>สถานะโครงการ</div><div style={{fontSize:13,fontWeight:700,color:C.text,marginTop:4}}>{ST_LBL[selectedHouse.status]}</div></div>
              <div><div style={{fontSize:11,color:C.muted,fontWeight:700}}>ความคืบหน้า</div><div style={{fontSize:13,fontWeight:700,color:C.blue,marginTop:4}}>{selectedHouse.pct}%</div></div>
              <div><div style={{fontSize:11,color:C.muted,fontWeight:700}}>โฟร์แมน</div><div style={{fontSize:13,color:C.text,marginTop:4}}>{selectedHouse.foreman||"—"}</div></div>
              <div><div style={{fontSize:11,color:C.muted,fontWeight:700}}>วิศวกร</div><div style={{fontSize:13,color:C.text,marginTop:4}}>{selectedHouse.engineer||"—"}</div></div>
            </div>
            <PBar pct={selectedHouse.pct} h={10}/>
            <div style={{fontSize:11,color:C.muted,marginTop:8}}>งบประมาณ ฿{fmtMoney(selectedHouse.boq)} | ใช้จริง ฿{fmtMoney(selectedHouse.actual)}</div>
          </div>

          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>📊 สถานะทั้ง 15 หมวดงาน</div>
          <div style={{display:"flex",flexDirection:"column",gap:10,maxHeight:400,overflowY:"auto"}}>
            {data.phases.map(phase=>{
              const phProg=data.phaseProgress[selectedHouse.id]?.[phase.id];
              const status=phProg?.s||"waiting";
              const act=phProg?.act||0;
              const dur=phProg?.dur||phase.days;
              const statusColor=status==="done"?C.green:status==="inprogress"?C.blue:C.muted;
              const statusLabel=status==="done"?"✓ เสร็จ":status==="inprogress"?"⚙ กำลังทำ":"⊘ รอการเริ่ม";
              return (
                <div key={phase.id} style={{padding:12,background:"#0d1117",borderRadius:8,border:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700,color:C.text}}>หมวด {phase.order} — {phase.name}</div>
                    </div>
                    <Tag color={status==="done"?"green":status==="inprogress"?"blue":"gray"}>{statusLabel}</Tag>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:11,marginBottom:8,color:C.muted}}>
                    <div>วางแผน: {dur} วัน</div>
                    <div>ใช้จริง: {act} วัน {act>dur&&<span style={{color:C.red}}>({act-dur} วัน เกิน)</span>}</div>
                  </div>
                  <div style={{height:6,background:C.faint,borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${dur>0?Math.min(Math.round(act/dur*100),100):0}%`,background:statusColor,borderRadius:3}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </Mdl>
      )}
    </div>
  );
}

function FinancePage({data,role}) {
  if(role!=="owner")return<div style={{padding:24,color:C.red,fontSize:14}}>🔒 Only owner can access Financial Dashboard</div>;
  
  // Calculate overall metrics
  const metrics=getProjectMetrics(data);
  const totalBOQ=Object.values(metrics).reduce((s,m)=>s+m.boq,0);
  const totalActual=Object.values(metrics).reduce((s,m)=>s+m.actual,0);
  const utilization=totalBOQ>0?Math.round((totalActual/totalBOQ)*100):0;
  const totalProfit=getTotalEarned(data)-totalActual;
  const totalReceived=getTotalEarned(data);

  // Helper function to get budget status color
  const getBudgetColor=(actual,boq)=>{
    if(actual>boq)return C.red;
    const pct=(actual/boq)*100;
    if(pct>=95)return C.red;
    if(pct>=80)return C.orange;
    return C.green;
  };

  // Helper to calculate phase-level costs for a project
  const getProjectPhaseBreakdown=(projectId)=>{
    const projectHouses=data.houses.filter(h=>h.projectId===projectId);
    const phaseMap={};
    data.boqItems.forEach(item=>{
      const house=projectHouses.find(h=>h.id===item.houseId);
      if(house){
        const phase=data.phases.find(p=>p.id===item.phaseId);
        if(phase){
          if(!phaseMap[phase.name])phaseMap[phase.name]={costs:[],count:0};
          const cost=item.actualPrice>0?item.qty*item.actualPrice:item.qty*item.boqPrice;
          phaseMap[phase.name].costs.push(cost);
        }
      }
    });
    return Object.entries(phaseMap).map(([name,data])=>({
      name,
      avg:data.costs.length>0?Math.round(data.costs.reduce((a,b)=>a+b,0)/data.costs.length):0,
      min:Math.min(...data.costs),
      max:Math.max(...data.costs)
    }));
  };

  // Get houses by project with full details
  const housesByProject={};
  data.projects.forEach(proj=>{
    housesByProject[proj.id]={
      name:proj.name,
      houses:data.houses.filter(h=>h.projectId===proj.id)
    };
  });

  return (
    <div style={{padding:24}}>
      <div style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:20}}>💹 Financial Dashboard — Detailed Analysis</div>
      
      {/* HEADER KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:24}}>
        <Card style={{padding:15}}><div style={{fontSize:18,marginBottom:5}}>💰</div><div style={{fontSize:10,fontWeight:700,color:C.muted}}>ค่าใช้จ่ายจริง</div><div style={{fontSize:18,fontWeight:800,color:C.blue}}>฿{fmtMoney(totalActual)}</div></Card>
        <Card style={{padding:15}}><div style={{fontSize:18,marginBottom:5}}>📊</div><div style={{fontSize:10,fontWeight:700,color:C.muted}}>งบ BOQ</div><div style={{fontSize:18,fontWeight:800,color:C.text}}>฿{fmtMoney(totalBOQ)}</div></Card>
        <Card style={{padding:15}}><div style={{fontSize:18,marginBottom:5}}>📈</div><div style={{fontSize:10,fontWeight:700,color:C.muted}}>ผลกำไร</div><div style={{fontSize:18,fontWeight:800,color:totalProfit>0?C.green:C.red}}>฿{fmtMoney(totalProfit)}</div></Card>
        <Card style={{padding:15}}><div style={{fontSize:18,marginBottom:5}}>%</div><div style={{fontSize:10,fontWeight:700,color:C.muted}}>ค่าใช้จ่าย / งบ BOQ</div><div style={{fontSize:18,fontWeight:800,color:utilization<80?C.green:utilization<95?C.orange:C.red}}>{utilization}%</div></Card>
        <Card style={{padding:15}}><div style={{fontSize:18,marginBottom:5}}>💵</div><div style={{fontSize:10,fontWeight:700,color:C.muted}}>ชำระแล้ว</div><div style={{fontSize:18,fontWeight:800,color:C.green}}>฿{fmtMoney(totalReceived)}</div></Card>
      </div>

      {/* TWO COLUMN LAYOUT */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        
        {/* LEFT COLUMN: Cost Breakdown by Project */}
        <Card style={{padding:20}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:16}}>📊 Cost Breakdown by Project</div>
          
          {data.projects.map(project=>{
            const pMetrics=metrics[project.name];
            if(!pMetrics)return null;
            
            const remaining=pMetrics.boq-pMetrics.actual;
            const variance=pMetrics.boq>0?Math.round(((pMetrics.actual-pMetrics.boq)/pMetrics.boq)*100):0;
            const utilPct=pMetrics.boq>0?Math.round((pMetrics.actual/pMetrics.boq)*100):0;
            const statusColor=getBudgetColor(pMetrics.actual,pMetrics.boq);
            const phaseBreakdown=getProjectPhaseBreakdown(project.id);
            
            return (
              <div key={project.id} style={{marginBottom:16,paddingBottom:16,borderBottom:`1px solid ${C.border}`}}>
                {/* Project Header */}
                <div style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:8}}>{project.name}</div>
                
                {/* Summary Row */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:11,marginBottom:8}}>
                  <div><span style={{color:C.muted}}>งบ BOQ:</span><span style={{color:C.text,fontWeight:700,marginLeft:6}}>฿{fmtMoney(pMetrics.boq)}</span></div>
                  <div><span style={{color:C.muted}}>ค่าใช้จ่ายจริง:</span><span style={{color:C.text,fontWeight:700,marginLeft:6}}>฿{fmtMoney(pMetrics.actual)}</span></div>
                  <div><span style={{color:C.muted}}>คงเหลือ:</span><span style={{color:statusColor,fontWeight:700,marginLeft:6}}>฿{fmtMoney(remaining)}</span></div>
                  <div><span style={{color:C.muted}}>ส่วนต่าง:</span><span style={{color:statusColor,fontWeight:700,marginLeft:6}}>{variance>0?"+":""}{variance}%</span></div>
                </div>
                
                {/* Progress Bar */}
                <div style={{height:6,background:C.faint,borderRadius:3,overflow:"hidden",marginBottom:8}}>
                  <div style={{height:"100%",width:`${Math.min(utilPct,100)}%`,background:statusColor}}/>
                </div>
                <div style={{fontSize:10,color:statusColor,marginBottom:10}}>{utilPct}% utilization</div>
                
                {/* Phase Breakdown */}
                {phaseBreakdown.length>0&&(
                  <div style={{background:C.faint,padding:10,borderRadius:6,fontSize:10}}>
                    <div style={{color:C.muted,fontWeight:700,marginBottom:6}}>Average cost per phase:</div>
                    {phaseBreakdown.slice(0,3).map((p,i)=>(
                      <div key={i} style={{color:C.text,marginBottom:4}}>
                        <span style={{color:C.muted}}>{p.name}:</span>
                        <span style={{marginLeft:6,fontWeight:600}}>฿{fmtMoney(p.avg)}</span>
                        <span style={{marginLeft:8,color:C.muted}}>({fmtMoney(p.min)}-{fmtMoney(p.max)})</span>
                      </div>
                    ))}
                    {phaseBreakdown.length>3&&<div style={{color:C.muted,marginTop:6}}>... +{phaseBreakdown.length-3} more phases</div>}
                  </div>
                )}
              </div>
            );
          })}
        </Card>

        {/* RIGHT COLUMN: Cost by House per Project */}
        <Card style={{padding:20}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:16}}>🏠 Cost by House per Project</div>
          
          {Object.entries(housesByProject).map(([projId,projData])=>{
            if(projData.houses.length===0)return null;
            
            return (
              <div key={projId} style={{marginBottom:16,paddingBottom:16,borderBottom:`1px solid ${C.border}`}}>
                {/* Project Header */}
                <div style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:10}}>{projData.name}</div>
                
                {/* Houses */}
                {projData.houses.map(house=>{
                  const remaining=house.boq-house.actual;
                  const variance=house.boq>0?house.actual-house.boq:0;
                  const variancePct=house.boq>0?Math.round(((house.actual-house.boq)/house.boq)*100):0;
                  const statusColor=getBudgetColor(house.actual,house.boq);
                  const customer=data.customers.find(c=>c.houseId===house.id);
                  
                  return (
                    <div key={house.id} style={{background:C.panel,padding:10,borderRadius:6,marginBottom:10,fontSize:11}}>
                      {/* House Header */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                        <span style={{color:C.text,fontWeight:700}}>🏠 บ้านเลขที่ {house.name}</span>
                        <Tag color={house.status==="completed"?"green":house.status==="inprogress"?"blue":"gray"} style={{fontSize:9}}>
                          {ST_LBL[house.status]||house.status}
                        </Tag>
                      </div>
                      
                      {/* Customer Name */}
                      {customer&&<div style={{color:C.muted,marginBottom:8,fontSize:10}}>👤 {customer.name}</div>}
                      
                      {/* Financial Details */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8,fontSize:10}}>
                        <div><span style={{color:C.muted}}>งบ BOQ:</span><br/><span style={{color:C.text,fontWeight:700}}>฿{fmtMoney(house.boq)}</span></div>
                        <div><span style={{color:C.muted}}>ใช้จ่ายแล้ว:</span><br/><span style={{color:C.text,fontWeight:700}}>฿{fmtMoney(house.actual)}</span></div>
                        <div><span style={{color:C.muted}}>อีก:</span><br/><span style={{color:statusColor,fontWeight:700}}>฿{fmtMoney(remaining)}</span></div>
                        <div><span style={{color:C.muted}}>ส่วนต่าง:</span><br/><span style={{color:variance>0?C.red:C.green,fontWeight:700}}>{variance>0?"+":""}฿{fmtMoney(variance)}</span></div>
                      </div>
                      
                      {/* Progress */}
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1,height:4,background:C.faint,borderRadius:2,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${Math.min(house.pct,100)}%`,background:statusColor}}/>
                        </div>
                        <span style={{color:statusColor,fontWeight:700,fontSize:10,minWidth:30}}>{house.pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// END OF PART 7
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// PART 8: Team & Settings Pages
// ═══════════════════════════════════════════════════════════════

function TeamPage({data,setData,role}) {
  const [editMdl,setEditMdl]=useState(null);
  const [form,setForm]=useState({});
  const [showNew,setShowNew]=useState(false);
  const canManage=role==="owner";

  function openEdit(member){setForm({...member});setEditMdl(member);}
  function save(){setData(d=>({...d,team:d.team.map(t=>t.id===form.id?form:t)}));setEditMdl(null);}
  function addTeam(){if(!form.name)return;setData(d=>({...d,team:[...d.team,{id:uid(),...form,name:form.name||"",role:"foreman",email:form.email||"",phone:form.phone||"",status:"active"}]}));setShowNew(false);setForm({name:"",email:"",phone:"",role:"foreman",status:"active"});}

  return (
    <div style={{padding:24}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div><div style={{fontSize:22,fontWeight:700,color:C.text}}>👥 Team Management</div><div style={{fontSize:13,color:C.muted,marginTop:2}}>{data.team.filter(t=>t.status==="active").length} members active</div></div>
        {canManage&&<Btn onClick={()=>setShowNew(true)}>+ Add Member</Btn>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
        {data.team.map(member=>(
          <Card key={member.id} style={{padding:16}}>
            <div style={{display:"flex",alignItems:"start",marginBottom:12}}>
              <div style={{width:40,height:40,borderRadius:8,background:ROLE_COL[member.role],display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#fff",flexShrink:0}}>{(member.name||"?")[0]}</div>
              <div style={{marginLeft:12,flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{member.name}</div>
                <div style={{fontSize:11,color:ROLE_COL[member.role],marginTop:2}}>{ROLE_LBL[member.role]}</div>
              </div>
              <Tag color={member.status==="active"?"green":"gray"} style={{fontSize:10}}>{member.status==="active"?"✓":"○"}</Tag>
            </div>
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:6}}>📧 {member.email}</div>
              <div style={{fontSize:11,color:C.muted,marginBottom:10}}>📞 {member.phone}</div>
              {canManage&&<Btn size="sm" variant="ghost" style={{width:"100%"}} onClick={()=>openEdit(member)}>✏️ Edit</Btn>}
            </div>
          </Card>
        ))}
      </div>
      {editMdl&&<Mdl title={`✏️ Edit Team Member`} onClose={()=>setEditMdl(null)} footer={<><Btn variant="ghost" onClick={()=>setEditMdl(null)}>Cancel</Btn><Btn onClick={save}>💾 Save</Btn></>}>
        <FG label="Name"><FIn value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></FG>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FG label="Email"><FIn type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></FG>
          <FG label="Phone"><FIn value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></FG>
        </div>
        <FG label="Role"><FSel value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>{Object.entries(ROLE_LBL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</FSel></FG>
        <FG label="Status"><FSel value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}><option value="active">Active</option><option value="inactive">Inactive</option></FSel></FG>
      </Mdl>}
      {showNew&&<Mdl title="➕ Add Team Member" onClose={()=>setShowNew(false)} footer={<><Btn variant="ghost" onClick={()=>setShowNew(false)}>Cancel</Btn><Btn onClick={addTeam} disabled={!form.name}>+ Add</Btn></>}>
        <FG label="Name *"><FIn value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></FG>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FG label="Role"><FSel value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>{Object.entries(ROLE_LBL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</FSel></FG>
          <FG label="Email"><FIn type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></FG>
        </div>
        <FG label="Phone"><FIn value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></FG>
      </Mdl>}
    </div>
  );
}

function SettingsPage({data,setData}) {
  const [tab,setTab]=useState("projects");
  const [newTpl,setNewTpl]=useState({name:"",boqBudget:1800000,defaultDays:180});
  const [showNew,setShowNew]=useState(false);
  const [editPh,setEditPh]=useState(null);
  const [editTpl,setEditTpl]=useState(null);
  const [editTplName,setEditTplName]=useState(null);
  const [newBoqItem,setNewBoqItem]=useState({phaseId:1,name:"",unit:"",qty:1,boqPrice:0});
  const [showAddBoq,setShowAddBoq]=useState(false);
  const [notif,setNotif]=useState(data.notifications||{emailOnPayment:true,emailOnDelay:true,emailOnCompletion:true,pushOnOrder:true,pushOnApproval:true,smsAlert:false});
  const [showNewProj,setShowNewProj]=useState(false);
  const [newProj,setNewProj]=useState({name:"",address:""});
  const [selectedProj,setSelectedProj]=useState(null);
  const [showNewHouse,setShowNewHouse]=useState(false);
  const [newHouse,setNewHouse]=useState({name:"",customer:"",start:"",days:180,boq:1800000,templateId:1,foreman:"",engineer:""});
  return (
    <div style={{padding:24}}>
      <div style={{marginBottom:20}}><div style={{fontSize:22,fontWeight:700,color:C.text}}>⚙️ ตั้งค่าระบบ</div><div style={{fontSize:13,color:C.muted,marginTop:2}}>จัดการโครงการ เทมเพลท หมวดงาน และการแจ้งเตือน</div></div>
      <div style={{display:"flex",gap:2,background:"#0d1117",borderRadius:10,padding:3,marginBottom:20,border:`1px solid ${C.border}`,width:"fit-content"}}>
        {[["projects","🏢 โครงการ"],["templates","🏠 เทมเพลทบ้าน"],["phases","📋 15 หมวดงาน"],["notifications","🔔 Notifications"]].map(([id,label])=><button key={id} onClick={()=>setTab(id)} style={{padding:"5px 13px",borderRadius:8,border:"none",background:tab===id?C.panel:"transparent",color:tab===id?C.blue:C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>{label}</button>)}
      </div>
      {tab==="projects"&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text}}>โครงการทั้งหมด ({data.projects.length})</div>
            <Btn size="sm" onClick={()=>setShowNewProj(true)}>+ สร้างโครงการใหม่</Btn>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:12}}>
            {data.projects.map(proj=>{
              const houses=data.houses.filter(h=>h.projectId===proj.id);
              return (
                <Card key={proj.id} style={{padding:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:12}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,color:C.text,fontSize:13}}>{proj.name}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:2}}>{proj.address||"ไม่มีที่อยู่"}</div>
                    </div>
                    <button onClick={()=>setData(d=>({...d,projects:d.projects.filter(p=>p.id!==proj.id)}))} style={{width:24,height:24,borderRadius:4,border:`1px solid ${C.border2}`,background:"none",color:C.muted,cursor:"pointer",fontSize:11}}>🗑</button>
                  </div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>บ้าน {houses.length} หลัง</div>
                  <div style={{display:"grid",gap:8}}>
                    {houses.length===0&&<div style={{padding:"8px",background:"#0d1117",borderRadius:6,color:C.muted,fontSize:11,textAlign:"center"}}>ยังไม่มีบ้านในโครงการนี้</div>}
                    {houses.slice(0,3).map(h=>(
                      <div key={h.id} style={{padding:"8px",background:"#0d1117",borderRadius:6,borderLeft:`3px solid ${C.blue}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{color:C.text,fontSize:11,fontWeight:600}}>บ้าน {h.name}</div>
                        <span style={{fontSize:10,color:C.muted}}>{h.customer||"—"}</span>
                      </div>
                    ))}
                    {houses.length>3&&<div style={{fontSize:10,color:C.muted,textAlign:"center",padding:"4px"}}>และอีก {houses.length-3} หลัง</div>}
                  </div>
                  <Btn size="sm" style={{width:"100%",marginTop:12}} onClick={()=>{setSelectedProj(proj.id);setShowNewHouse(true);}}>+ เพิ่มบ้านในโครงการนี้</Btn>
                </Card>
              );
            })}
          </div>
          {showNewProj&&<Mdl title="🏢 สร้างโครงการใหม่" onClose={()=>{setShowNewProj(false);setNewProj({name:"",address:""});}} footer={<><Btn variant="ghost" onClick={()=>{setShowNewProj(false);setNewProj({name:"",address:""});}}>ยกเลิก</Btn><Btn onClick={()=>{setData(d=>({...d,projects:[...d.projects,{id:uid(),...newProj}]}));setShowNewProj(false);setNewProj({name:"",address:""});}} disabled={!newProj.name}>✓ สร้าง</Btn></>}>
            <FG label="ชื่อโครงการ *"><FIn value={newProj.name} onChange={e=>setNewProj(p=>({...p,name:e.target.value}))} placeholder="เช่น The Greenery Phase 1"/></FG>
            <FG label="ที่อยู่/สถานที่"><FIn value={newProj.address} onChange={e=>setNewProj(p=>({...p,address:e.target.value}))} placeholder="เช่น อ.ปากช่อง นครราชสีมา"/></FG>
          </Mdl>}
          {showNewHouse&&selectedProj&&<Mdl title="🏠 เพิ่มบ้านในโครงการ" onClose={()=>{setShowNewHouse(false);setSelectedProj(null);setNewHouse({name:"",customer:"",start:"",days:180,boq:1800000,templateId:1,foreman:"",engineer:""});}} size="lg" footer={<><Btn variant="ghost" onClick={()=>{setShowNewHouse(false);setSelectedProj(null);setNewHouse({name:"",customer:"",start:"",days:180,boq:1800000,templateId:1,foreman:"",engineer:""});}}>ยกเลิก</Btn><Btn onClick={()=>{if(!newHouse.name||!newHouse.start)return;const newHouseId=uid();const newBoqItems=[];if(newHouse.templateId){const templateItems=data.templateBOQItems.filter(t=>t.templateId===newHouse.templateId);templateItems.forEach(tItem=>{const phaseOrder=data.phases.find(p=>p.id===tItem.phaseId)?.order||1;const cumulativeDays=data.phases.filter(p=>p.order<phaseOrder).reduce((sum,p)=>sum+p.days,0);const startDate=addDays(new Date(newHouse.start),cumulativeDays);const phaseEndDate=addDays(startDate,data.phases.find(p=>p.id===tItem.phaseId)?.days||0);newBoqItems.push({id:uid(),houseId:newHouseId,phaseId:tItem.phaseId,name:tItem.name,unit:tItem.unit,qty:tItem.qty,boqPrice:tItem.boqPrice,actualPrice:0,status:"notstarted",startDate:fmtDate(startDate),endDate:fmtDate(phaseEndDate),orderedBy:"",approvedBy:""});});}setData(d=>({...d,houses:[...d.houses,{id:newHouseId,projectId:selectedProj,...newHouse,boq:Number(newHouse.boq),days:Number(newHouse.days),actual:0,status:"notstarted",pct:0,phase:"ยังไม่เริ่ม"}],boqItems:[...d.boqItems,...newBoqItems]}));setShowNewHouse(false);setSelectedProj(null);setNewHouse({name:"",customer:"",start:"",days:180,boq:1800000,templateId:1,foreman:"",engineer:""});}} disabled={!newHouse.name||!newHouse.start}>✓ สร้างบ้าน</Btn></>}>
            <Alrt type="info">ระบบจะ Copy BOQ จาก Template ที่เลือก</Alrt>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FG label="โครงการ"><span style={{fontSize:13,color:C.text,padding:"8px 0",fontWeight:700}}>{data.projects.find(p=>p.id===selectedProj)?.name}</span></FG>
              <FG label="เลขที่/ชื่อบ้าน *"><FIn value={newHouse.name} onChange={e=>setNewHouse(h=>({...h,name:e.target.value}))} placeholder="เช่น A-07"/></FG>
              <FG label="เทมเพลท"><FSel value={newHouse.templateId} onChange={e=>{const t=data.templates.find(t=>t.id===+e.target.value);setNewHouse(h=>({...h,templateId:+e.target.value,boq:t?.boqBudget||h.boq,days:t?.defaultDays||h.days}));}}>{data.templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</FSel></FG>
              <div style={{gridColumn:"1/-1"}}><FG label="ชื่อลูกค้า"><FIn value={newHouse.customer} onChange={e=>setNewHouse(h=>({...h,customer:e.target.value}))} placeholder="กรอกภายหลังได้"/></FG></div>
              <FG label="วันเริ่มก่อสร้าง *"><FIn type="date" value={newHouse.start} onChange={e=>setNewHouse(h=>({...h,start:e.target.value}))}/></FG>
              <FG label="จำนวนวัน"><FIn type="number" value={newHouse.days} onChange={e=>setNewHouse(h=>({...h,days:e.target.value}))}/></FG>
              <div style={{gridColumn:"1/-1"}}><FG label="งบ BOQ (฿)"><FIn type="number" value={newHouse.boq} onChange={e=>setNewHouse(h=>({...h,boq:e.target.value}))}/></FG></div>
            </div>
          </Mdl>}
        </>
      )}
      {tab==="notifications"&&(
        <Card style={{padding:20,maxWidth:500}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:16}}>Notification Preferences</div>
          {[{key:"emailOnPayment",label:"📧 Email on Payment",desc:"ส่ง Email เมื่อได้รับชำระเงิน"},{key:"emailOnDelay",label:"⚠️ Email on Delay",desc:"ส่ง Email เมื่อล่าช้ากำหนด"},{key:"emailOnCompletion",label:"✓ Email on Completion",desc:"ส่ง Email เมื่องานเสร็จสิ้น"},{key:"pushOnOrder",label:"📤 Push on Order",desc:"ส่ง Push เมื่อมีคำสั่งซื้อใหม่"},{key:"pushOnApproval",label:"✅ Push on Approval",desc:"ส่ง Push เมื่อมีการอนุมัติ"},{key:"smsAlert",label:"💬 SMS Alert",desc:"ส่ง SMS สำหรับเรื่องด่วน"}].map((item,i)=>(
            <div key={item.key} style={{display:"flex",alignItems:"start",justifyContent:"space-between",padding:"11px 0",borderBottom:i<5?`1px solid ${C.border}`:"none"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:C.text}}>{item.label}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{item.desc}</div>
              </div>
              <label style={{position:"relative",width:40,height:22,cursor:"pointer",display:"block",marginLeft:8,flexShrink:0}}>
                <input type="checkbox" checked={notif[item.key]||false} onChange={e=>setNotif(n=>({...n,[item.key]:e.target.checked}))} style={{opacity:0,width:0,height:0,position:"absolute"}}/>
                <span style={{position:"absolute",inset:0,background:notif[item.key]?C.blue:C.faint,borderRadius:22,transition:".2s"}}/>
                <span style={{position:"absolute",width:16,height:16,top:3,left:notif[item.key]?21:3,background:"#fff",borderRadius:"50%",transition:".2s"}}/>
              </label>
            </div>
          ))}
          <Btn style={{marginTop:16,width:"100%"}} onClick={()=>setData(d=>({...d,notifications:notif}))}>💾 บันทึกการตั้งค่า</Btn>
        </Card>
      )}
      {tab==="templates"&&(
        <>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:14}}><Btn variant="ghost" size="sm">📁 Import Excel BOQ</Btn><Btn size="sm" onClick={()=>setShowNew(true)}>+ สร้างเทมเพลทใหม่</Btn></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:12}}>
            {data.templates.map(t=>{
              const tItems=data.templateBOQItems.filter(ti=>ti.templateId===t.id);
              return (
              <Card key={t.id} style={{padding:16}}>
                <div style={{fontWeight:700,color:C.text,marginBottom:6}}>{t.name}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
                  <div style={{background:"#0d1117",borderRadius:8,padding:"8px 10px",border:`1px solid ${C.border}`}}><div style={{fontSize:9,color:C.muted,textTransform:"uppercase"}}>งบ BOQ</div><div style={{fontSize:13,fontWeight:700,color:C.blue,marginTop:2}}>฿{fmtMoney(t.boqBudget)}</div></div>
                  <div style={{background:"#0d1117",borderRadius:8,padding:"8px 10px",border:`1px solid ${C.border}`}}><div style={{fontSize:9,color:C.muted,textTransform:"uppercase"}}>จำนวนวัน</div><div style={{fontSize:13,fontWeight:700,color:C.text,marginTop:2}}>{t.defaultDays} วัน</div></div>
                </div>
                <div style={{fontSize:10,color:C.muted,marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}`}}>ประกอบด้วย {tItems.length} รายการ</div>
                <div style={{display:"flex",gap:6,marginTop:12}}>
                  <Btn variant="ghost" size="sm" style={{flex:1}} onClick={()=>setEditTplName(t)}>📝 ชื่อ</Btn>
                  <Btn variant="ghost" size="sm" style={{flex:1}} onClick={()=>setEditTpl(t)}>✏️ BOQ</Btn>
                  <Btn variant="ghost" size="sm" style={{flex:1}} onClick={()=>{const newTemplateId=uid();setData(d=>({...d,templates:[...d.templates,{...t,id:newTemplateId,name:t.name+" (Copy)"}],templateBOQItems:[...d.templateBOQItems,...tItems.map(ti=>({...ti,id:uid(),templateId:newTemplateId}))]}));}}>⧉ Copy</Btn>
                  <Btn variant="danger" size="sm" onClick={()=>{setData(d=>({...d,templates:d.templates.filter(tm=>tm.id!==t.id),templateBOQItems:d.templateBOQItems.filter(ti=>ti.templateId!==t.id)}));}} style={{padding:"4px 8px"}}>🗑</Btn>
                </div>
              </Card>
            )})}
          </div>
          {showNew&&<Mdl title="🏠 สร้างเทมเพลทใหม่" onClose={()=>setShowNew(false)} footer={<><Btn variant="ghost" onClick={()=>setShowNew(false)}>ยกเลิก</Btn><Btn onClick={()=>{setData(d=>({...d,templates:[...d.templates,{id:uid(),...newTpl}]}));setShowNew(false);}} disabled={!newTpl.name}>✓ สร้าง</Btn></>}>
            <FG label="ชื่อเทมเพลท *"><FIn value={newTpl.name} onChange={e=>setNewTpl(t=>({...t,name:e.target.value}))} placeholder="เช่น บ้านแบบ C — ชั้นเดียว"/></FG>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FG label="งบ BOQ (฿)"><FIn type="number" value={newTpl.boqBudget} onChange={e=>setNewTpl(t=>({...t,boqBudget:+e.target.value}))}/></FG>
              <FG label="จำนวนวัน"><FIn type="number" value={newTpl.defaultDays} onChange={e=>setNewTpl(t=>({...t,defaultDays:+e.target.value}))}/></FG>
            </div>
          </Mdl>}
          {editTpl&&<Mdl title={`✏️ แก้ไข ${editTpl.name} — BOQ Items`} onClose={()=>setEditTpl(null)} style={{minWidth:600}} footer={<><Btn variant="ghost" onClick={()=>setEditTpl(null)}>ปิด</Btn></>}>
            <div style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:C.text}}>BOQ Items ({data.templateBOQItems.filter(ti=>ti.templateId===editTpl.id).length} รายการ)</div><Btn size="sm" onClick={()=>setShowAddBoq(true)}>+ เพิ่ม</Btn></div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["หมวดงาน","ชื่อรายการ","หน่วย","จำนวน","ราคา/หน่วย","ราคารวม",""].map(h=><th key={h} style={{padding:"8px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.templateBOQItems.filter(ti=>ti.templateId===editTpl.id).map(item=>(
                    <tr key={item.id} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"8px",fontSize:12,color:C.muted}}>{data.phases.find(p=>p.id===item.phaseId)?.name||"?"}</td>
                      <td style={{padding:"8px",fontSize:12,color:C.text}}>{item.name}</td>
                      <td style={{padding:"8px",fontSize:12,color:C.muted}}>{item.unit}</td>
                      <td style={{padding:"8px",fontSize:12,color:C.text}}>{item.qty}</td>
                      <td style={{padding:"8px",fontSize:12,color:C.blue}}>฿{fmtMoney(item.boqPrice)}</td>
                      <td style={{padding:"8px",fontSize:12,fontWeight:700,color:C.text}}>฿{fmtMoney(item.qty*item.boqPrice)}</td>
                      <td style={{padding:"8px"}}><Btn size="sm" variant="danger" onClick={()=>setData(d=>({...d,templateBOQItems:d.templateBOQItems.filter(ti=>ti.id!==item.id)}))} style={{padding:"2px 6px"}}>🗑️</Btn></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {showAddBoq&&<div style={{background:"#0d1117",borderRadius:8,border:`1px solid ${C.border}`,padding:12}}>
              <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:8}}>เพิ่มรายการ BOQ ใหม่</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <FG label="หมวดงาน"><FSel value={newBoqItem.phaseId} onChange={e=>setNewBoqItem(b=>({...b,phaseId:+e.target.value}))}>{data.phases.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</FSel></FG>
                <FG label="ชื่อรายการ"><FIn value={newBoqItem.name} onChange={e=>setNewBoqItem(b=>({...b,name:e.target.value}))} placeholder="เช่น ปูนซีเมนต์"/></FG>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                <FG label="หน่วย"><FIn value={newBoqItem.unit} onChange={e=>setNewBoqItem(b=>({...b,unit:e.target.value}))} placeholder="เช่น ถุง"/></FG>
                <FG label="จำนวน"><FIn type="number" value={newBoqItem.qty} onChange={e=>setNewBoqItem(b=>({...b,qty:+e.target.value}))}/></FG>
                <FG label="ราคา"><FIn type="number" value={newBoqItem.boqPrice} onChange={e=>setNewBoqItem(b=>({...b,boqPrice:+e.target.value}))}/></FG>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn size="sm" onClick={()=>{setData(d=>({...d,templateBOQItems:[...d.templateBOQItems,{id:uid(),templateId:editTpl.id,...newBoqItem}]}));setNewBoqItem({phaseId:1,name:"",unit:"",qty:1,boqPrice:0});setShowAddBoq(false);}} disabled={!newBoqItem.name} style={{flex:1}}>✓ เพิ่ม</Btn>
                <Btn variant="ghost" size="sm" onClick={()=>{setShowAddBoq(false);setNewBoqItem({phaseId:1,name:"",unit:"",qty:1,boqPrice:0});}} style={{flex:1}}>ยกเลิก</Btn>
              </div>
            </div>}
          </Mdl>}
          {editTplName&&<Mdl title={`📝 แก้ไขชื่อเทมเพลท`} onClose={()=>setEditTplName(null)} footer={<><Btn variant="ghost" onClick={()=>setEditTplName(null)}>ยกเลิก</Btn><Btn onClick={()=>{setData(d=>({...d,templates:d.templates.map(t=>t.id===editTplName.id?{...t,name:editTplName.name}:t)}));setEditTplName(null);}}>✓ บันทึก</Btn></>}>
            <FG label="ชื่อเทมเพลท *"><FIn value={editTplName.name} onChange={e=>setEditTplName(t=>({...t,name:e.target.value}))} placeholder="เช่น บ้านแบบ A — 2 ชั้น"/></FG>
          </Mdl>}
        </>
      )}
      {tab==="phases"&&(
        <>
          <Alrt type="info">จำนวนวันใช้เป็นค่า Default เมื่อสร้างบ้านใหม่ สามารถแก้ไขได้ต่อบ้าน</Alrt>
          <Card>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["#","ชื่อหมวดงาน","จำนวนวัน","วันเริ่ม(Default)",""].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>{h}</th>)}</tr></thead>
              <tbody>
                {data.phases.map(p=>{
                  const startDay=data.phases.slice(0,p.order-1).reduce((s,ph)=>s+ph.days,1);
                  const isE=editPh?.id===p.id;
                  return (
                    <tr key={p.id} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"8px 12px",fontWeight:700,color:C.blue,fontSize:12}}>{p.order}</td>
                      <td style={{padding:"8px 12px",fontSize:13,color:C.text}}>{isE?<FIn value={editPh.name} onChange={e=>setEditPh(ep=>({...ep,name:e.target.value}))} style={{padding:"4px 8px"}}/>:p.name}</td>
                      <td style={{padding:"8px 12px",fontSize:12,color:C.muted}}>{isE?<FIn type="number" value={editPh.days} onChange={e=>setEditPh(ep=>({...ep,days:+e.target.value}))} style={{padding:"4px 8px",width:70}}/>:`${p.days} วัน`}</td>
                      <td style={{padding:"8px 12px",fontSize:12,color:C.muted}}>วันที่ {startDay}</td>
                      <td style={{padding:"8px 12px"}}>{isE?<div style={{display:"flex",gap:4}}><Btn size="sm" variant="success" onClick={()=>{setData(d=>({...d,phases:d.phases.map(ph=>ph.id===p.id?{...ph,name:editPh.name,days:editPh.days}:ph)}));setEditPh(null);}}>💾</Btn><Btn size="sm" variant="ghost" onClick={()=>setEditPh(null)}>✕</Btn></div>:<div style={{display:"flex",gap:4}}><Btn size="sm" variant="ghost" onClick={()=>setEditPh({...p})}>✏️</Btn><Btn size="sm" variant="danger" onClick={()=>setData(d=>({...d,phases:d.phases.filter(ph=>ph.id!==p.id).map((ph,i)=>({...ph,order:i+1}))}))}>🗑️</Btn></div>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}><Btn variant="ghost" size="sm" onClick={()=>setData(d=>({...d,phases:[...d.phases,{id:uid(),name:"หมวดงานใหม่",days:14,order:d.phases.length+1}]}))}>+ เพิ่มหมวดงาน</Btn></div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// END OF PART 8
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// PART 9: Main App Component & Export
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [data,setData]=useState(INIT);
  const [role,setRole]=useState("owner");
  const [page,setPage]=useState("dash");
  const [openId,setOpenId]=useState(null);

  function handleRole(r){setRole(r);setOpenId(null);setPage(r==="marketing"?"marketing":"dash");}
  function handleOpen(h){setOpenId(h.id);setPage("house");}
  function handleBack(){setOpenId(null);setPage("dash");}
  function handleSetPage(p){setPage(p);setOpenId(null);}

  const topTitle=openId?`บ้าน ${data.houses.find(h=>h.id===openId)?.name||""}`:({dash:"Dashboard",finance:"💹 Financial Dashboard",purchase:role==="engineer"?"อนุมัติคำสั่งซื้อ":"รายการจัดซื้อ",payments:"💰 Payments",analytics:"📊 Analytics",team:"👥 Team",marketing:"การตลาด",settings:"ตั้งค่า"}[page]||"");

  return (
    <>
      <style>{GS}</style>
      <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
        <Sidebar page={page} setPage={handleSetPage} role={role} data={data}/>
        <div style={{marginLeft:220,flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{height:52,background:C.panel,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",padding:"0 20px",gap:12,flexShrink:0}}>
            <div style={{flex:1,fontSize:15,fontWeight:700,color:C.text}}>{topTitle}</div>
            <Notifs data={data} setData={setData} role={role} onOpenHouse={handleOpen} setPage={handleSetPage} onScrollToPhase={page==="house"?((phaseId,messageId)=>{
        const element=document.getElementById(`phase-${phaseId}`);
        if(element)element.scrollIntoView({behavior:"smooth",block:"start"});
        if(messageId){
          setTimeout(()=>{
            const msgElement=document.getElementById(`msg-${messageId}`);
            if(msgElement){
              msgElement.scrollIntoView({behavior:"smooth",block:"nearest"});
              msgElement.style.background="#1d3a6e";
              msgElement.style.transition="background 0.3s";
              setTimeout(()=>msgElement.style.background="",500);
            }
          },600);
        }
      }):null}/>
            <RoleSwitcher role={role} setRole={handleRole}/>
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            {page==="house"&&openId&&<HousePage houseId={openId} data={data} setData={setData} role={role} onBack={handleBack}/>}
            {page==="dash"&&<DashPage data={data} setData={setData} role={role} onOpenHouse={handleOpen}/>}
            {page==="timeline"&&<TimelinePage data={data} role={role} onOpenHouse={handleOpen}/>}

            {page==="analytics"&&<AnalyticsPage data={data}/>}
            {page==="finance"&&role==="owner"&&<FinancePage data={data} role={role}/>}
            {page==="team"&&<TeamPage data={data} setData={setData} role={role}/>}
            {page==="marketing"&&<MarketingPage data={data} setData={setData}/>}
            {page==="settings"&&["owner","engineer"].includes(role)&&<SettingsPage data={data} setData={setData}/>}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// END OF PART 9 — App.jsx COMPLETE ✓
// ═══════════════════════════════════════════════════════════════



