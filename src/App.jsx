import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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
const getDayName=d=>{if(!d)return"";const dt=new Date(d+"T00:00:00");const days=["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];return days[dt.getDay()];};
const fmtDateWithDay=d=>{if(!d)return"—";const day=getDayName(d);const dt=new Date(d);return`${day} ${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()+543}`;};
const STATUS_ICONS={notstarted:"😴",inprogress:"⏳",completed:"✅",cancelled:"❌"};
const getStatusColor=s=>({notstarted:C.muted,inprogress:C.orange,completed:C.green,cancelled:C.red}[s]||C.muted);

// Export functions
const dlBlob=(blob,filename)=>{const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.style.display="none";document.body.appendChild(a);a.click();setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},200);};
const exp2CSV=(headers,rows)=>{const csv=[headers.join(","),...rows.map(r=>r.map(c=>`"${c}"`).join(","))].join("\n");dlBlob(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),`report_${Date.now()}.csv`);};
const exp2JSON=(data,name)=>{const json=JSON.stringify(data,null,2);dlBlob(new Blob([json],{type:"application/json"}),`${name}_${Date.now()}.json`);};

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
    {id:1,role:"owner",name:"นายณญาน์ สุวรรณ",email:"owner@thecrown.com",phone:"089-001-0001",status:"active",username:"owner",password:"1234",avatar:"",location:{lat:null,lng:null,address:"",updatedAt:""}},
    {id:2,role:"engineer",name:"วศ.ประสิทธิ์ บ้านบิน",email:"engineer@thecrown.com",phone:"089-002-0002",status:"active",username:"engineer",password:"1234",avatar:"",location:{lat:null,lng:null,address:"",updatedAt:""}},
    {id:3,role:"foreman",name:"นายวิชัย ก่อสร้าง",email:"foreman@thecrown.com",phone:"089-003-0003",status:"active",username:"foreman",password:"1234",avatar:"",location:{lat:null,lng:null,address:"",updatedAt:""}},
    {id:5,role:"purchasing",name:"นางสุรีย์พร จัดซื้อ",email:"purchasing@thecrown.com",phone:"089-004-0004",status:"active",username:"purchasing",password:"1234",avatar:"",location:{lat:null,lng:null,address:"",updatedAt:""}},
    {id:6,role:"marketing",name:"นางสิรินรา ตลาด",email:"marketing@thecrown.com",phone:"089-005-0005",status:"active",username:"marketing",password:"1234",avatar:"",location:{lat:null,lng:null,address:"",updatedAt:""}},
  ],
  employeeLevels:{
    2:3,3:2,5:2,6:1,
  },
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
  tracking:[
    {id:uid(),taskName:"หาราคา supplier เรือนมุก",assignedTo:3,assignedBy:1,level:2,deadline:"2025-04-20",status:"inprogress",remarks:"รอข้อมูลจาก 3 ร้าน",jobDetails:{what:"ตรวจสอบราคาปูนซีเมนต์จาก 3 ร้านค้า",why:"เพื่อวัดราคาที่แข่งขันกันได้",when:"จันทร์ 21/4/2568",how:["ติดต่อ supplier ทั้ง 3 แห่ง","ขอใบเสนอราคาแบบส่วนตัว","เปรียบเทียบราคาและส่งสรุปให้เจ้าของ"],obstacles:"ร้านที่ 2 ยังไม่ออกราคา"},createdDate:"2025-04-05"},
    {id:uid(),taskName:"ตรวจสอบคุณภาพวัสดุวัฒนา",assignedTo:2,assignedBy:1,level:3,deadline:"2025-04-18",status:"notstarted",remarks:"",jobDetails:{what:"",why:"",when:"",how:[],obstacles:""},createdDate:"2025-04-06"},
    {id:uid(),taskName:"ติดตามการก่อสร้างบ้าน A-01",assignedTo:3,assignedBy:1,level:2,deadline:"2025-04-22",status:"inprogress",remarks:"ความคืบหน้า 65%",jobDetails:{what:"ตรวจสอบความคืบหน้างานก่อสร้าง",why:"เพื่อให้ทราบสถานะตามแผนการก่อสร้าง",when:"เสาร์ 22/4/2568",how:["ไปตรวจสอบหน้างาน","ปรึกษากับหัวหน้าทีม","รายงานผลให้เจ้าของทราบ"],obstacles:""},createdDate:"2025-04-02"},
    {id:uid(),taskName:"เตรียมเอกสารสำหรับลูกค้า",assignedTo:6,assignedBy:1,level:1,deadline:"2025-04-15",status:"completed",completedDate:"2025-04-15",remarks:"ส่งให้ลูกค้าแล้ว",jobDetails:{what:"",why:"",when:"",how:[],obstacles:""},createdDate:"2025-03-30"},
    {id:uid(),taskName:"อนุมัติคำสั่งซื้อกระเบื้อง",assignedTo:2,assignedBy:1,level:3,deadline:"2025-04-17",status:"inprogress",remarks:"รอใบเสนอราคา",jobDetails:{what:"",why:"",when:"",how:[],obstacles:""},createdDate:"2025-04-06"},
    {id:uid(),taskName:"ประชุมทีมโฟร์แมน",assignedTo:4,assignedBy:1,level:1,deadline:"2025-04-24",status:"notstarted",remarks:"",jobDetails:{what:"",why:"",when:"",how:[],obstacles:""},createdDate:"2025-04-07"},
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
  const ref=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const handler=(e)=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[open]);
  return (
    <div ref={ref} style={{position:"relative"}}>
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
  const ref=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const handler=(e)=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[open]);
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
  // ── งานที่ถูกมอบหมายใหม่ (แจ้งผู้รับงาน) ──
  const authedId=data.team.find(m=>m.role===role&&m.status==="active")?.id;
  const taskAssignItems=(data.tracking||[]).filter(t=>t.assignedTo===authedId&&t.status!=="completed"&&t.status!=="cancelled").map(t=>{
    const aBy=data.team.find(m=>m.id===t.assignedBy);
    const isViewed=data.notificationViewed?.[`task-assign-${t.id}`];
    if(isViewed)return null;
    return {
      id:`task-assign-${t.id}`,
      t:"info",
      msg:`📋 ${aBy?.name||"เจ้าของ"} มอบหมายงาน "${t.taskName}" ให้คุณ — กำหนด ${fmtDate(t.deadline)}`,
      taskId:t.id,
      page:"tracking",
      show:true
    };
  }).filter(Boolean);
  // ── งานใกล้ถึงกำหนด (≤1 วัน) & ถึงกำหนดวันนี้/เลยกำหนด ──
  const taskDeadlineItems=(data.tracking||[]).filter(t=>t.status!=="completed"&&t.status!=="cancelled"&&t.deadline).flatMap(t=>{
    const aTo=data.team.find(m=>m.id===t.assignedTo);
    const dl=Math.ceil((new Date(t.deadline+"T23:59:59")-new Date())/86400000);
    const items=[];
    const showToMe=t.assignedTo===authedId||t.assignedBy===authedId||role==="owner";
    if(!showToMe)return[];
    if(dl===1){
      const viewed=data.notificationViewed?.[`task-due-soon-${t.id}`];
      if(!viewed)items.push({id:`task-due-soon-${t.id}`,t:"warning",msg:`🟠 งาน "${t.taskName}" (${aTo?.name||"-"}) จะถึงกำหนดพรุ่งนี้!`,taskId:t.id,page:"tracking",show:true});
    }
    if(dl<=0){
      const viewed=data.notificationViewed?.[`task-overdue-${t.id}`];
      if(!viewed)items.push({id:`task-overdue-${t.id}`,t:"danger",msg:`🔴 งาน "${t.taskName}" (${aTo?.name||"-"}) ${dl===0?"ถึงกำหนดวันนี้!":"เกินกำหนด "+Math.abs(dl)+" วันแล้ว!"}`,taskId:t.id,page:"tracking",show:true});
    }
    return items;
  });
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
  
  const allItems=[...taskDeadlineItems,...taskAssignItems,...messageItems,...waitingReviewItems,...orderItems,...overBudgetItems].filter(n=>n.show);
  const unviewedCount=allItems.filter(n=>!data.notificationViewed?.[n.id]).length;
  
  const handleNotifClick=(n)=>{
    if(n.messageId){
      setData(d=>({...d,messageViewed:{...d.messageViewed,[n.messageId]:true}}));
    }else{
      setData(d=>({...d,notificationViewed:{...d.notificationViewed,[n.id]:true}}));
    }
    if(n.page==="tracking"){
      setPage("tracking");
      setOpen(false);
      return;
    }
    onOpenHouse(data.houses.find(h=>h.id===n.houseId));
    setOpen(false);
    if(n.phaseId&&onScrollToPhase){
      setTimeout(()=>onScrollToPhase(n.phaseId,n.messageId),300);
    }
  };
  
  return (
    <div ref={ref} style={{position:"relative"}}>
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

function Sidebar({page,setPage,role,data,authedUserId,isMobileMode,onLogout,onChangePw,isOwner,unviewedNotifs,onOpenNotif}) {
  const authedMember=data.team.find(m=>m.id===authedUserId);
  const pending=data.requests.filter(r=>r.status==="pending").length;
  const pendingMembers=data.team.filter(t=>t.status==="pending").length;
  const pendingPwChanges=data.team.filter(t=>t.pendingPassword).length;
  const settingsBadge=pendingMembers+pendingPwChanges;
  const navByRole={
    owner:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"dash",icon:"⊞",label:"Dashboard"},{id:"tracking",icon:"📋",label:"ติดตามงาน"},{id:"finance",icon:"💹",label:"Finance"},{id:"analytics",icon:"📊",label:"Analytics"},{id:"team",icon:"👥",label:"Team"},{id:"marketing",icon:"📢",label:"การตลาด"},{id:"settings",icon:"⚙️",label:"ตั้งค่า",badge:settingsBadge}],
    engineer:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"dash",icon:"⊞",label:"บ้านที่ดูแล"},{id:"tracking",icon:"📋",label:"ติดตามงาน"},{id:"analytics",icon:"📊",label:"Analytics"},{id:"team",icon:"👥",label:"ทีมงาน"},{id:"settings",icon:"⚙️",label:"ตั้งค่า"}],
    foreman:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"dash",icon:"⊞",label:"บ้านที่ดูแล"},{id:"tracking",icon:"📋",label:"ติดตามงาน"},{id:"team",icon:"👥",label:"ทีมงาน"}],
    purchasing:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"dash",icon:"⊞",label:"ภาพรวม"},{id:"tracking",icon:"📋",label:"ติดตามงาน"},{id:"team",icon:"👥",label:"ทีมงาน"}],
    marketing:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"tracking",icon:"📋",label:"ติดตามงาน"},{id:"analytics",icon:"📊",label:"Analytics"},{id:"team",icon:"👥",label:"ทีมงาน"},{id:"marketing",icon:"📢",label:"การตลาด"}],
  };
  const items=navByRole[role]||navByRole.owner;
  return (
    <div style={{width:220,background:C.panel,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,bottom:0,zIndex:100}}>
      <div style={{padding:"16px 14px 13px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:9}}>
        <div style={{width:34,height:34,background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>🏗️</div>
        <div><div style={{fontSize:14,fontWeight:700,color:C.text}}>The Crown</div><div style={{fontSize:10,color:C.muted}}>Management</div></div>
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
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 9px",background:"#0d1117",borderRadius:8,marginBottom:isMobileMode?8:0}}>
          <Avatar member={authedMember} size={28} fontSize={12}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:600,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{authedMember?.name||"—"}</div>
            <div style={{fontSize:10,color:C.muted}}>{ROLE_LBL[role]}</div>
          </div>
        </div>
        {isMobileMode&&(
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {unviewedNotifs>0&&<button onClick={onOpenNotif} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px",borderRadius:8,border:`1px solid ${C.border2}`,background:"none",color:C.text,fontSize:13,cursor:"pointer"}}>
              <span>🔔</span><span style={{flex:1,textAlign:"left"}}>การแจ้งเตือน</span><span style={{background:C.red,color:"#fff",fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:10}}>{unviewedNotifs}</span>
            </button>}
            {!isOwner&&<button onClick={onChangePw} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px",borderRadius:8,border:`1px solid ${C.border2}`,background:"none",color:C.muted,fontSize:13,cursor:"pointer"}}>
              <span>🔑</span><span>ขอเปลี่ยนรหัสผ่าน</span>
            </button>}
            <button onClick={onLogout} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px",borderRadius:8,border:`1px solid ${C.red}44`,background:`${C.red}11`,color:"#fca5a5",fontSize:13,cursor:"pointer"}}>
              <span>🔓</span><span>ออกจากระบบ</span>
            </button>
          </div>
        )}
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

function DashPage({data,setData,role,onOpenHouse,isMobileMode}) {
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
    <Card style={{padding:isMobileMode?12:15}}>
      <div style={{fontSize:isMobileMode?16:20,marginBottom:5}}>{icon}</div>
      <div style={{fontSize:isMobileMode?9:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>{label}</div>
      <div style={{fontSize:isMobileMode?16:20,fontWeight:800,color:warn?C.red:C.text}}>{val}</div>
      {sub&&<div style={{fontSize:isMobileMode?10:11,color:C.muted,marginTop:3}}>{sub}</div>}
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
    <div style={{padding:isMobileMode?12:24}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:isMobileMode?16:22,flexWrap:isMobileMode?"wrap":"nowrap",gap:isMobileMode?10:0}}>
        <div><div style={{fontSize:isMobileMode?18:22,fontWeight:700,color:C.text}}>Dashboard ภาพรวม</div><div style={{fontSize:isMobileMode?11:13,color:C.muted,marginTop:2}}>ทุกโครงการ ทุกบ้าน Real-Time</div></div>
        {["owner","engineer"].includes(role)&&<Btn onClick={()=>setProjMdl(true)} size={isMobileMode?"sm":"md"}>+ สร้าง</Btn>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"repeat(auto-fit,minmax(200px,1fr))",gap:isMobileMode?8:12,marginBottom:isMobileMode?16:24}}>
        <KCard icon="📦" label="โครงการ" val={data.projects.length} sub="Active"/>
        <KCard icon="🏠" label="บ้านทั้งหมด" val={data.houses.length} sub={`${data.houses.filter(h=>h.status==="inprogress").length} กำลังก่อสร้าง`}/>
        {["owner","engineer","purchasing"].includes(role)&&<KCard icon="💰" label="ใช้จ่ายจริงรวม" val={`฿${fmtMoney(totalAct)}`} sub="ทุกโครงการ"/>}
        {["owner","engineer","purchasing"].includes(role)&&<KCard icon="📊" label="งบ BOQ รวม" val={`฿${fmtMoney(totalBOQ)}`} sub="ทุกโครงการ"/>}
        {["owner","engineer","purchasing"].includes(role)&&<KCard icon="⚠️" label="บ้านเกินงบ" val={overC} sub="เสร็จแล้วเกิน BOQ" warn={overC>0}/>}
      </div>
      <div style={{fontSize:isMobileMode?10:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>โครงการและบ้าน<div style={{flex:1,height:1,background:C.border}}/></div>
      {data.projects.map(proj=>{
        const houses=data.houses.filter(h=>h.projectId===proj.id);
        const open=expanded[proj.id];
        return (
          <Card key={proj.id} style={{marginBottom:14,overflow:"hidden"}}>
            <div onClick={()=>setExpanded(e=>({...e,[proj.id]:!e[proj.id]}))} style={{display:"flex",alignItems:"center",gap:10,padding:isMobileMode?"10px 12px":"12px 15px",cursor:"pointer",borderBottom:open?`1px solid ${C.border}`:"none"}}>
              <span style={{color:C.muted,fontSize:11,display:"inline-block",transform:open?"rotate(90deg)":"rotate(0)",transition:"transform .2s"}}>▶</span>
              <span style={{fontWeight:700,color:C.text,fontSize:isMobileMode?12:14,flex:1}}>{proj.name}</span>
              {!isMobileMode&&<span style={{fontSize:11,color:C.muted}}>{proj.address}</span>}
              <span style={{fontSize:isMobileMode?10:11,color:C.muted,marginLeft:isMobileMode?0:10}}>{houses.length} หลัง</span>
              {["owner","engineer"].includes(role)&&<Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();setHouseMdl(proj.id);}}>+ {isMobileMode?"บ้าน":"เพิ่มบ้าน"}</Btn>}
            </div>
            {open&&(
              <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr 1fr":"repeat(auto-fill,minmax(280px,1fr))",gap:isMobileMode?8:10,padding:isMobileMode?10:12}}>
                {houses.length===0&&<div style={{padding:"14px",color:C.muted,fontSize:13}}>ยังไม่มีบ้านในโครงการนี้</div>}
                {houses.map(h=>{
                  const isOver=h.status==="completed"&&h.actual>h.boq;
                  const isNear=h.actual/h.boq>0.9&&h.status!=="completed";
                  const dl=daysLeft(h.start,h.days);
                  const remain=h.boq-h.actual;
                  const showFinance=["owner","engineer","purchasing"].includes(role);
                  return (
                    <div key={h.id} onClick={()=>onOpenHouse(h)} style={{background:"#0d1117",border:`1px solid ${isOver?C.red:C.border}`,borderRadius:10,padding:isMobileMode?10:13,cursor:"pointer",transition:"border-color .15s"}}
                      onMouseEnter={e=>{if(!isOver&&!isMobileMode)e.currentTarget.style.borderColor=C.blue;}} onMouseLeave={e=>{if(!isOver&&!isMobileMode)e.currentTarget.style.borderColor=C.border;}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div>
                          <div style={{fontWeight:700,color:C.text,fontSize:isMobileMode?12:13}}>บ้านเลขที่ {h.name}</div>
                          <div style={{fontSize:isMobileMode?10:11,color:C.muted,marginTop:2}}>{h.customer||"— ยังไม่มีลูกค้า"}</div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <Tag color={h.status==="completed"?"green":h.status==="inprogress"?"blue":h.status==="delayed"?"red":"gray"}>{ST_LBL[h.status]}</Tag>
                          {["owner","engineer"].includes(role)&&!isMobileMode&&(
                            <div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:3}}>
                              <button title="แก้ไข" onClick={()=>setEditHouse(h)} style={{width:25,height:25,borderRadius:6,border:`1px solid ${C.border2}`,background:"none",color:C.muted,cursor:"pointer",fontSize:12}}>✏️</button>
                              <button title="Copy" onClick={()=>copyHouse(h)} style={{width:25,height:25,borderRadius:6,border:`1px solid ${C.border2}`,background:"none",color:C.muted,cursor:"pointer",fontSize:12}}>⧉</button>
                              <button title="ลบ" onClick={()=>delHouse(h.id)} style={{width:25,height:25,borderRadius:6,border:`1px solid ${C.border2}`,background:"none",color:C.muted,cursor:"pointer",fontSize:12}}>🗑</button>
                            </div>
                          )}
                        </div>
                      </div>
                      {showFinance&&!isMobileMode&&<div style={{display:"flex",gap:1,marginBottom:10,borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`}}>
                        {[["งบ BOQ",`฿${fmtMoney(h.boq)}`,C.text],["ใช้ไปแล้ว",(isOver?"⚠️ ":"")+`฿${fmtMoney(h.actual)}`,isOver?C.red:isNear?C.orange:C.text],["คงเหลือ",(isOver?"เกิน ":"")+`฿${fmtMoney(Math.abs(remain))}`,isOver?C.red:C.green]].map(([l,v,col],i)=>(
                          <div key={i} style={{flex:1,padding:"7px 8px",background:C.panel,textAlign:"center"}}>
                            <div style={{fontSize:9,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.3}}>{l}</div>
                            <div style={{fontSize:12,fontWeight:700,color:col,marginTop:3}}>{v}</div>
                          </div>
                        ))}
                      </div>}
                      <div style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:isMobileMode?10:11,fontWeight:700,color:C.blue}}>{h.pct}%</span>
                          <span style={{fontSize:isMobileMode?10:11,color:C.muted}}>{isMobileMode?h.phase.substring(0,10):h.phase}</span>
                        </div>
                        <PBar pct={h.pct} color={h.pct>=100?C.green:C.blue}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4,fontSize:isMobileMode?10:11}}>
                        <span style={{color:C.muted}}>เริ่ม {fmtDate(h.start)} → เสร็จ {fmtDate(addDays(h.start,h.days))}</span>
                        {h.status!=="completed"&&h.status!=="notstarted"&&<span style={{color:dl<0?C.red:dl<30?C.orange:C.muted}}>{dl<0?`เกิน ${Math.abs(dl)} วัน`:`เหลือ ${dl} วัน`}</span>}
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
          <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:12}}>
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
        <Mdl title="🏠 เพิ่มบ้านใหม่" onClose={()=>setHouseMdl(null)} size={isMobileMode?"sm":"lg"} footer={<><Btn variant="ghost" onClick={()=>setHouseMdl(null)}>ยกเลิก</Btn><Btn onClick={addHouse} disabled={!hf.name||!hf.start}>🏠 สร้างบ้าน</Btn></>}>
          <Alrt type="info">ระบบจะ Copy BOQ จาก Template ที่เลือก</Alrt>
          <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:12}}>
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
// PART 4B: Image Picker + Crop Preview Modal
// ═══════════════════════════════════════════════════════════════

function ImagePickerModal({onSend,onClose}){
  const [imgs,setImgs]=useState([]);
  const fileInputRef=useRef(null);

  function addFiles(files){
    const newImgs=Array.from(files).filter(f=>f.type.startsWith("image/")).map(file=>({id:uid(),file,url:URL.createObjectURL(file),caption:""}));
    setImgs(prev=>[...prev,...newImgs]);
  }
  function removeImg(id){setImgs(prev=>prev.filter(i=>i.id!==id));}
  function updateCaption(id,cap){setImgs(prev=>prev.map(i=>i.id===id?{...i,caption:cap}:i));}

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1080,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:12}}>
      <div style={{width:"100%",maxWidth:560,maxHeight:"92vh",display:"flex",flexDirection:"column",background:C.panel,borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"#060d1a",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <span style={{fontSize:13,fontWeight:700,color:C.text,flex:1}}>📷 เลือกรูปภาพ</span>
          <span style={{fontSize:11,color:C.muted}}>{imgs.length} รูป</span>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:8,background:"none",border:`1px solid ${C.border2}`,color:C.muted,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>✕</button>
        </div>

        {/* Image preview grid */}
        <div style={{flex:1,overflowY:"auto",padding:12,display:"flex",flexWrap:"wrap",gap:10,alignContent:"flex-start",minHeight:120}}>
          {imgs.length===0&&(
            <div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,padding:32,color:C.muted}}>
              <span style={{fontSize:36}}>🖼️</span>
              <span style={{fontSize:12}}>กดปุ่มด้านล่างเพื่อเลือกรูป</span>
            </div>
          )}
          {imgs.map(img=>(
            <div key={img.id} style={{width:130,display:"flex",flexDirection:"column",gap:4}}>
              <div style={{position:"relative",width:130,height:100,borderRadius:8,overflow:"hidden",border:`1px solid ${C.border2}`}}>
                <img src={img.url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                <button onClick={()=>removeImg(img.id)} style={{position:"absolute",top:4,right:4,width:20,height:20,borderRadius:"50%",background:"rgba(0,0,0,0.8)",border:"none",color:"#fff",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>✕</button>
              </div>
              <input value={img.caption} onChange={e=>updateCaption(img.id,e.target.value)}
                placeholder="คำบรรยาย..."
                style={{width:"100%",background:"#0d1117",border:`1px solid ${C.border2}`,borderRadius:6,color:C.text,fontSize:11,padding:"5px 8px",outline:"none",fontFamily:"inherit"}}/>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{display:"flex",gap:8,padding:"10px 14px",borderTop:`1px solid ${C.border}`,flexShrink:0,background:"#060d1a"}}>
          <label style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"9px",borderRadius:8,border:`1px dashed ${C.border2}`,cursor:"pointer",color:C.muted,fontSize:12}}>
            📁 เลือกรูปภาพ (หลายรูปได้)
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>addFiles(e.target.files)}/>
          </label>
          <button onClick={()=>{if(imgs.length>0)onSend(imgs);}} disabled={imgs.length===0}
            style={{padding:"9px 22px",borderRadius:8,background:imgs.length>0?C.blue:"#1e293b",border:"none",color:imgs.length>0?"#fff":C.muted,cursor:imgs.length>0?"pointer":"not-allowed",fontSize:13,fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap"}}>
            ส่ง {imgs.length>0?`(${imgs.length} รูป)`:""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PART 5: House Detail Page & Modals
// ═══════════════════════════════════════════════════════════════

function generateConstructionReport(house,data){
  const rp=(!Array.isArray(house.reportPhotos)&&house.reportPhotos)||{};
  const phases=data.phases;
  const phasesWithPhotos=phases.filter(ph=>(rp[ph.id]||[]).length>0);
  const totalPhotos=phasesWithPhotos.reduce((s,ph)=>s+(rp[ph.id]||[]).length,0);
  if(totalPhotos===0){alert("ยังไม่มีรูปภาพในเล่ม กรุณาเลือกรูปก่อน");return null;}
  const thM=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const now=new Date();
  const reportDate=`${now.getDate()} ${thM[now.getMonth()]} ${now.getFullYear()+543}`;
  const phaseSectionsHtml=phasesWithPhotos.map(ph=>{
    const photos=rp[ph.id]||[];
    const gc=photos.length===1?"g1":photos.length===2?"g2":photos.length===3?"g3":"g4";
    const photosHtml=photos.map(p=>`<div class="photo-card"><img class="photo-img" src="${p.base64}" alt=""/><div class="photo-cap-wrap"><div class="photo-cap">${p.caption||""}</div><div class="photo-meta">${p.addedBy||""}${p.addedBy&&p.addedAt?" &bull; ":""}${p.addedAt||""}</div></div></div>`).join("");
    return `<div class="phase-block"><div class="phase-banner"><div class="phase-num">หมวดที่ ${ph.order}</div><div class="phase-name">${ph.name}</div><div class="phase-cnt">${photos.length} รูป</div></div><div class="photo-grid ${gc}">${photosHtml}</div></div>`;
  }).join("");
  const html=`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>รูปเล่มงานก่อสร้าง — ${house.name}</title><style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans Thai',sans-serif;background:#dde3ea;color:#1e293b;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;margin:20px auto;background:#fff;box-shadow:0 6px 40px rgba(0,0,0,.15);overflow:hidden}
.cv-hero{background:linear-gradient(145deg,#0c1f3d 0%,#1a3a8f 45%,#1d4ed8 75%,#2563eb 100%);padding:60px 52px 90px;position:relative;overflow:hidden;clip-path:polygon(0 0,100% 0,100% 87%,0 100%)}
.cv-hero::before{content:'';position:absolute;top:-50px;right:-50px;width:260px;height:260px;background:rgba(255,255,255,.05);border-radius:50%}
.cv-badge{position:relative;display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:5px 18px;font-size:10px;font-weight:700;letter-spacing:2.5px;color:rgba(255,255,255,.92);text-transform:uppercase;margin-bottom:26px}
.cv-title{position:relative;font-size:40px;font-weight:800;color:#fff;line-height:1.18;margin-bottom:10px;text-shadow:0 2px 12px rgba(0,0,0,.2)}
.cv-sub{position:relative;font-size:16px;font-weight:400;color:rgba(255,255,255,.72)}
.cv-body{padding:38px 52px 30px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden}
.ic{padding:16px 22px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0}
.ic:nth-child(2n){border-right:none}.ic:nth-last-child(-n+2){border-bottom:none}.ic.full{grid-column:1/-1;border-right:none}
.ilb{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:4px}
.iv{font-size:14px;font-weight:700;color:#1e293b}.iv.blue{color:#2563eb}
.pbar-bg{height:6px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin-top:7px}
.pbar-fill{height:100%;background:linear-gradient(90deg,#2563eb,#7c3aed);border-radius:99px}
.cv-foot{display:flex;justify-content:space-between;align-items:center;padding:14px 52px 22px;border-top:1px solid #f1f5f9;font-size:10px;color:#94a3b8}
.cv-foot strong{color:#64748b}
.photos-wrap{padding:32px 44px 20px}
.phase-block{margin-bottom:38px;page-break-inside:avoid}
.phase-banner{display:flex;align-items:stretch;margin-bottom:20px;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(14,30,80,.18)}
.phase-num{background:linear-gradient(180deg,#0c1f3d,#0f2a55);color:#fff;font-size:11px;font-weight:800;padding:14px 20px;white-space:nowrap;display:flex;align-items:center;letter-spacing:.5px}
.phase-name{flex:1;background:linear-gradient(135deg,#0f2744,#1e40af);color:#fff;font-size:16px;font-weight:700;padding:12px 20px;display:flex;align-items:center}
.phase-cnt{background:rgba(30,64,175,.7);color:rgba(255,255,255,.8);font-size:11px;font-weight:600;padding:14px 20px;white-space:nowrap;display:flex;align-items:center}
.photo-grid{display:grid;gap:16px}
.g1{grid-template-columns:1fr;max-width:62%;margin:0 auto}
.g2{grid-template-columns:1fr 1fr}
.g3{grid-template-columns:1fr 1fr 1fr}
.g4{grid-template-columns:1fr 1fr 1fr 1fr}
.photo-card{border-radius:10px;overflow:hidden;border:1px solid #dde4ef;background:#fff;box-shadow:0 3px 12px rgba(0,0,0,.08)}
.photo-img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}
.photo-cap-wrap{padding:11px 14px 13px}
.photo-cap{font-size:12px;font-weight:700;color:#1e293b;margin-bottom:4px;min-height:15px;line-height:1.35}
.photo-meta{font-size:9px;color:#94a3b8}
.rpt-foot{display:flex;justify-content:space-between;align-items:center;padding:14px 44px;border-top:2px solid #f0f4f8;font-size:9.5px;color:#94a3b8;background:linear-gradient(90deg,#f8fafc,#f0f4f8)}
.rpt-foot strong{color:#64748b}
@media print{body{background:#fff}.page{margin:0;box-shadow:none;width:auto}@page{size:A4;margin:10mm}.phase-block{page-break-inside:avoid}}
</style></head><body>
<div class="page">
<div class="cv-hero"><div class="cv-badge">📋 รูปเล่มงานก่อสร้าง</div><div class="cv-title">บ้านเลขที่ ${house.name}</div><div class="cv-sub">${house.customer||"รายงานความคืบหน้าการก่อสร้าง"}</div></div>
<div class="cv-body"><div class="info-grid"><div class="ic"><div class="ilb">บ้านเลขที่</div><div class="iv blue">${house.name}</div></div><div class="ic"><div class="ilb">ชื่อลูกค้า</div><div class="iv">${house.customer||"—"}</div></div><div class="ic"><div class="ilb">วิศวกรควบคุมงาน</div><div class="iv">${house.engineer||"—"}</div></div><div class="ic"><div class="ilb">โฟร์แมน</div><div class="iv">${house.foreman||"—"}</div></div><div class="ic"><div class="ilb">วันเริ่มก่อสร้าง</div><div class="iv">${house.start||"—"}</div></div><div class="ic"><div class="ilb">ความคืบหน้ารวม</div><div class="iv blue">${house.pct||0}%</div><div class="pbar-bg"><div class="pbar-fill" style="width:${Math.min(house.pct||0,100)}%"></div></div></div><div class="ic full"><div class="ilb">รูปภาพในเล่ม</div><div class="iv">${totalPhotos} รูป จาก ${phasesWithPhotos.length} หมวดงาน</div></div></div></div>
<div class="cv-foot"><span>📋 CPMS Construction Management</span><strong>วันที่จัดทำ: ${reportDate}</strong></div>
<div class="photos-wrap">${phaseSectionsHtml}</div>
<div class="rpt-foot"><span>รูปเล่มงานก่อสร้าง — บ้านเลขที่ ${house.name}</span><strong>${totalPhotos} รูป | วันที่ ${reportDate}</strong></div>
</div></body></html>`;
  return html;
}

const MAX_REPORT_PHOTOS=4;

function PhotoReportModal({house,data,setData,role,onClose,isMobileMode}){
  const [editCaption,setEditCaption]=useState(null);
  const [previewImg,setPreviewImg]=useState(null);
  const [expandedPhases,setExpandedPhases]=useState({});
  const [slotPickerPhase,setSlotPickerPhase]=useState(null);
  const [reportHtml,setReportHtml]=useState(null);
  const canEdit=["owner","engineer","foreman"].includes(role);

  const rp=(!Array.isArray(house.reportPhotos)&&house.reportPhotos)||{};
  const totalCount=Object.values(rp).reduce((s,arr)=>s+arr.length,0);

  const getChatImgs=(phaseId)=>data.phaseMessages.filter(
    m=>m.houseId===house.id&&m.phaseId===phaseId&&m.file?.type?.startsWith("image/")&&typeof m.file.data==="string"
  );
  const isInReport=(phaseId,msgId)=>(rp[phaseId]||[]).some(p=>p.fromMsgId===msgId);
  const toggleExpand=(phaseId)=>setExpandedPhases(ex=>({...ex,[phaseId]:!ex[phaseId]}));

  // group msgs by date, sorted newest first within date, dates sorted newest first
  const groupByDate=(msgs)=>{
    const groups={};
    msgs.forEach(m=>{const d=m.date||"ไม่ทราบวันที่";if(!groups[d])groups[d]=[];groups[d].push(m);});
    return Object.entries(groups).sort(([a],[b])=>b.localeCompare(a));
  };

  const fmtThaiDate=(iso)=>{
    if(!iso||iso==="ไม่ทราบวันที่")return iso;
    try{const d=new Date(iso);const thM=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];return`${d.getDate()} ${thM[d.getMonth()]} ${d.getFullYear()+543}`;}catch{return iso;}
  };

  const toggleChatImg=(phaseId,msg,fromPicker=false)=>{
    if(!canEdit)return;
    const cur=(rp[phaseId]||[]);
    if(isInReport(phaseId,msg.id)){
      setData(d=>({...d,houses:d.houses.map(h=>h.id===house.id?{...h,reportPhotos:{...((!Array.isArray(h.reportPhotos)&&h.reportPhotos)||{}),[phaseId]:cur.filter(p=>p.fromMsgId!==msg.id)}}:h)}));
    }else{
      if(cur.length>=MAX_REPORT_PHOTOS)return;
      const caption=(msg.text&&!msg.text.startsWith("📎"))?msg.text:msg.file.name.replace(/\.[^/.]+$/,"");
      const photo={id:uid(),fromMsgId:msg.id,base64:msg.file.data,caption,addedBy:msg.sender,addedAt:msg.date};
      setData(d=>({...d,houses:d.houses.map(h=>h.id===house.id?{...h,reportPhotos:{...((!Array.isArray(h.reportPhotos)&&h.reportPhotos)||{}),[phaseId]:[...cur,photo]}}:h)}));
      // ปิด picker อัตโนมัติเมื่อเลือกครบ 4 รูป
      if(fromPicker&&cur.length+1>=MAX_REPORT_PHOTOS)setSlotPickerPhase(null);
    }
  };

  const handleFilesForPhase=(phaseId,files)=>{
    Array.from(files).forEach(file=>{
      if(!file.type.startsWith("image/"))return;
      const reader=new FileReader();
      reader.onload=e=>{
        setData(d=>{
          const h2=d.houses.find(h=>h.id===house.id);
          const cur2=((!Array.isArray(h2.reportPhotos)&&h2.reportPhotos)||{})[phaseId]||[];
          if(cur2.length>=MAX_REPORT_PHOTOS)return d;
          const photo={id:uid(),base64:e.target.result,caption:file.name.replace(/\.[^/.]+$/,"").replace(/_/g," "),addedBy:ROLE_LBL[role],addedAt:new Date().toISOString().slice(0,10)};
          return{...d,houses:d.houses.map(h=>h.id===house.id?{...h,reportPhotos:{...((!Array.isArray(h.reportPhotos)&&h.reportPhotos)||{}),[phaseId]:[...cur2,photo]}}:h)};
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto=(phaseId,photoId)=>setData(d=>({...d,houses:d.houses.map(h=>h.id===house.id?{...h,reportPhotos:{...((!Array.isArray(h.reportPhotos)&&h.reportPhotos)||{}),[phaseId]:(((!Array.isArray(h.reportPhotos)&&h.reportPhotos)||{})[phaseId]||[]).filter(p=>p.id!==photoId)}}:h)}));
  const saveCaption=(phaseId,photoId,caption)=>setData(d=>({...d,houses:d.houses.map(h=>h.id===house.id?{...h,reportPhotos:{...((!Array.isArray(h.reportPhotos)&&h.reportPhotos)||{}),[phaseId]:(((!Array.isArray(h.reportPhotos)&&h.reportPhotos)||{})[phaseId]||[]).map(p=>p.id===photoId?{...p,caption}:p)}}:h)}));

  const SLOT_SIZE=isMobileMode?84:108;

  return(
    <>
    <Mdl title="📸 รูปเล่มงานก่อสร้าง" onClose={onClose} size="xl"
      footer={<>
        <Btn variant="ghost" onClick={onClose}>ปิด</Btn>
        {totalCount>0&&<Btn onClick={()=>{const h=generateConstructionReport(house,data);if(h)setReportHtml(h);}}>📄 ดูรายงาน / บันทึก PDF ({totalCount} รูป)</Btn>}
      </>}
    >
      {/* Summary bar */}
      <div style={{background:"#0a1120",borderRadius:8,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{fontSize:11,fontWeight:700,color:C.text}}>รูปที่เลือก:</span>
        {data.phases.map(ph=>{const cnt=(rp[ph.id]||[]).length;return cnt>0?<span key={ph.id} style={{background:`${C.green}22`,color:C.green,borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700,border:`1px solid ${C.green}44`}}>หมวด {ph.order} ({cnt}/4)</span>:null;})}
        {totalCount===0&&<span style={{fontSize:11,color:C.muted}}>ยังไม่ได้เลือกรูป</span>}
        {totalCount>0&&<span style={{fontSize:11,color:C.muted,marginLeft:"auto"}}>{totalCount} รูป รวมทั้งหมด</span>}
      </div>

      {/* Phase sections */}
      {data.phases.map(phase=>{
        const chatImgs=getChatImgs(phase.id);
        const selected=rp[phase.id]||[];
        const full=selected.length>=MAX_REPORT_PHOTOS;
        const hasChatImgs=chatImgs.length>0;
        const isExpanded=expandedPhases[phase.id]!==false&&(hasChatImgs||selected.length>0||canEdit);
        const autoCollapse=!hasChatImgs&&selected.length===0;
        const expanded=autoCollapse?!!expandedPhases[phase.id]:isExpanded;

        return(
          <div key={phase.id} style={{marginBottom:10,borderRadius:10,border:`1px solid ${selected.length>0?C.green+"55":C.border}`,overflow:"hidden",transition:"border-color 0.2s"}}>
            {/* Phase header */}
            <div onClick={()=>toggleExpand(phase.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#060d1a",cursor:"pointer",userSelect:"none"}}>
              <span style={{background:selected.length>0?`${C.green}22`:`${C.blue}22`,color:selected.length>0?C.green:C.blue,borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700,flexShrink:0,border:`1px solid ${selected.length>0?C.green+"44":C.blue+"44"}`}}>หมวด {phase.order}</span>
              <span style={{fontWeight:700,color:C.text,fontSize:12,flex:1}}>{phase.name}</span>
              {hasChatImgs&&<span style={{fontSize:10,color:C.orange,fontWeight:600,flexShrink:0}}>📷 {chatImgs.length} รูปในงาน</span>}
              <span style={{fontSize:11,fontWeight:700,color:selected.length>0?C.green:C.muted,flexShrink:0}}>{selected.length}/{MAX_REPORT_PHOTOS}</span>
              <span style={{fontSize:11,color:C.muted,transition:"transform 0.25s",transform:expanded?"rotate(180deg)":"rotate(0deg)",display:"inline-block",flexShrink:0}}>▾</span>
            </div>

            {/* Expandable body */}
            {expanded&&(
              <div style={{padding:"12px 14px",background:"#0d1117"}}>
                {/* 4-slot grid */}
                <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>
                  ✅ รูปที่จะลงเล่ม ({selected.length}/{MAX_REPORT_PHOTOS})
                  {canEdit&&selected.length<MAX_REPORT_PHOTOS&&<span style={{color:C.blue,fontWeight:400,textTransform:"none",letterSpacing:0,marginLeft:6}}>— คลิกช่องว่างเพื่อเลือกรูป</span>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                  {selected.map(photo=>(
                    <div key={photo.id} style={{borderRadius:8,overflow:"hidden",border:`2px solid ${C.green}55`,background:C.panel}}>
                      <div style={{position:"relative"}}>
                        <img src={photo.base64} style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block"}}/>
                        {canEdit&&<button onClick={()=>removePhoto(phase.id,photo.id)} style={{position:"absolute",top:4,right:4,width:20,height:20,borderRadius:"50%",background:"rgba(0,0,0,0.85)",border:"none",color:"#fff",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>✕</button>}
                        <button onClick={()=>setPreviewImg({src:photo.base64,caption:photo.caption,sender:photo.addedBy,date:photo.addedAt,time:""})} style={{position:"absolute",top:4,left:4,width:20,height:20,borderRadius:4,background:"rgba(0,0,0,0.7)",border:"none",color:"#fff",cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>⛶</button>
                      </div>
                      <div style={{padding:"5px 7px"}}>
                        {editCaption?.phaseId===phase.id&&editCaption?.photoId===photo.id?(
                          <input value={editCaption.caption} onChange={e=>setEditCaption(ec=>({...ec,caption:e.target.value}))} onBlur={()=>{saveCaption(phase.id,photo.id,editCaption.caption);setEditCaption(null);}} onKeyDown={e=>{if(e.key==="Enter")e.target.blur();if(e.key==="Escape")setEditCaption(null);}} style={{width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${C.blue}`,color:C.text,fontSize:10,outline:"none",padding:"1px 0"}} autoFocus/>
                        ):(
                          <div onClick={()=>canEdit&&setEditCaption({phaseId:phase.id,photoId:photo.id,caption:photo.caption||""})} style={{fontSize:10,color:photo.caption?C.text:C.muted,cursor:canEdit?"text":"default",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle:photo.caption?"normal":"italic",minHeight:14}} title={photo.caption||"คลิกเพื่อใส่คำบรรยาย"}>{photo.caption||"+ คำบรรยาย"}</div>
                        )}
                        <div style={{fontSize:8,color:C.muted,marginTop:2}}>{photo.addedBy}</div>
                      </div>
                    </div>
                  ))}
                  {/* Empty slots — เปิด Picker แทน OS file picker */}
                  {canEdit&&Array.from({length:MAX_REPORT_PHOTOS-selected.length}).map((_,i)=>(
                    <div key={`e${i}`} onClick={()=>setSlotPickerPhase(phase.id)}
                      style={{borderRadius:8,border:`2px dashed ${hasChatImgs?C.orange:C.border2}`,aspectRatio:"4/3",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",color:hasChatImgs?C.orange:C.muted,gap:3,transition:"all 0.15s",background:"transparent"}}
                      onMouseOver={e=>{e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.background=`${C.blue}11`;e.currentTarget.style.color=C.blue;}}
                      onMouseOut={e=>{e.currentTarget.style.borderColor=hasChatImgs?C.orange:C.border2;e.currentTarget.style.background="transparent";e.currentTarget.style.color=hasChatImgs?C.orange:C.muted;}}>
                      <span style={{fontSize:18}}>📷</span>
                      <span style={{fontSize:9,textAlign:"center",lineHeight:1.3,fontWeight:hasChatImgs?700:400}}>{hasChatImgs?"เลือกรูป\nในงาน":"เลือก\nรูปภาพ"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </Mdl>

    {/* ── Slot Picker Sheet ── */}
    {slotPickerPhase&&(()=>{
      const pp=data.phases.find(p=>p.id===slotPickerPhase);
      const pChatImgs=getChatImgs(slotPickerPhase);
      const pSelected=rp[slotPickerPhase]||[];
      const pFull=pSelected.length>=MAX_REPORT_PHOTOS;
      const PSIZE=isMobileMode?84:100;
      return(
        <div onMouseDown={()=>setSlotPickerPhase(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:1050,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onMouseDown={e=>e.stopPropagation()} style={{width:"100%",maxWidth:900,maxHeight:"82vh",display:"flex",flexDirection:"column",background:C.panel,borderRadius:"16px 16px 0 0",border:`1px solid ${C.border}`,overflow:"hidden"}}>
            {/* Picker header */}
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 18px",background:"#060d1a",flexShrink:0,borderBottom:`1px solid ${C.border}`}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>เลือกรูปสำหรับเล่มรายงาน</div>
                <div style={{fontSize:10,color:C.muted,marginTop:2}}>หมวด {pp?.order}: {pp?.name}</div>
              </div>
              <span style={{background:pSelected.length>=MAX_REPORT_PHOTOS?`${C.green}22`:`${C.blue}22`,color:pSelected.length>=MAX_REPORT_PHOTOS?C.green:C.blue,borderRadius:20,padding:"3px 12px",fontSize:11,fontWeight:700,border:`1px solid ${pSelected.length>=MAX_REPORT_PHOTOS?C.green+"44":C.blue+"44"}`}}>
                {pSelected.length}/{MAX_REPORT_PHOTOS} รูป
              </span>
              <button onClick={()=>setSlotPickerPhase(null)} style={{width:28,height:28,borderRadius:8,background:"none",border:`1px solid ${C.border2}`,color:C.muted,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>

            {/* Selected preview strip */}
            {pSelected.length>0&&(
              <div style={{display:"flex",gap:6,padding:"10px 18px",background:"#0a1120",flexShrink:0,overflowX:"auto",borderBottom:`1px solid ${C.border}`}}>
                {pSelected.map(ph=>(
                  <div key={ph.id} style={{position:"relative",flexShrink:0,width:52,height:52,borderRadius:6,overflow:"hidden",border:`2px solid ${C.green}77`}}>
                    <img src={ph.base64} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    <button onClick={()=>removePhoto(slotPickerPhase,ph.id)} style={{position:"absolute",top:1,right:1,width:16,height:16,borderRadius:"50%",background:"rgba(0,0,0,0.85)",border:"none",color:"#fff",cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                  </div>
                ))}
                <div style={{flexShrink:0,width:52,height:52,borderRadius:6,border:`2px dashed ${C.border2}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:C.muted,lineHeight:1.2,textAlign:"center"}}>
                  {MAX_REPORT_PHOTOS-pSelected.length}<br/>ว่าง
                </div>
              </div>
            )}

            {/* Chat images grouped by date — scrollable */}
            <div style={{flex:1,overflowY:"auto",padding:"14px 18px"}}>
              {pChatImgs.length>0?(
                <>
                  <div style={{fontSize:10,fontWeight:700,color:C.orange,marginBottom:12,textTransform:"uppercase",letterSpacing:0.5}}>
                    📷 รูปจากการรายงานในหมวดนี้ ({pChatImgs.length} รูป) — คลิกเพื่อเลือก
                  </div>
                  {groupByDate(pChatImgs).map(([date,msgs])=>(
                    <div key={date} style={{marginBottom:16}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <div style={{height:1,flex:1,background:C.border}}/>
                        <span style={{fontSize:10,fontWeight:700,color:C.blue,background:`${C.blue}18`,border:`1px solid ${C.blue}33`,borderRadius:20,padding:"2px 12px",whiteSpace:"nowrap"}}>
                          📅 {fmtThaiDate(date)} • {msgs.length} รูป
                        </span>
                        <div style={{height:1,flex:1,background:C.border}}/>
                      </div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        {msgs.map(msg=>{
                          const sel=isInReport(slotPickerPhase,msg.id);
                          const blocked=!sel&&pFull;
                          const caption=(msg.text&&!msg.text.startsWith("📎"))?msg.text:"";
                          return(
                            <div key={msg.id} style={{flexShrink:0,width:PSIZE}}>
                              <div onClick={()=>!blocked&&toggleChatImg(slotPickerPhase,msg,true)}
                                style={{width:PSIZE,height:PSIZE,borderRadius:8,overflow:"hidden",border:`2px solid ${sel?C.green:blocked?"#2a3040":C.border2}`,cursor:blocked?"not-allowed":"pointer",opacity:blocked?0.3:1,position:"relative",transition:"border-color 0.15s,transform 0.1s",transform:sel?"scale(0.95)":"scale(1)"}}>
                                <img src={msg.file.data} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                                {sel&&<div style={{position:"absolute",inset:0,background:"rgba(34,197,94,0.32)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:28,filter:"drop-shadow(0 1px 4px rgba(0,0,0,0.9))"}}>✓</span></div>}
                                {blocked&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:20}}>🔒</span></div>}
                                <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(0,0,0,0.85))",padding:"10px 5px 4px",pointerEvents:"none"}}>
                                  <div style={{fontSize:9,color:"#fff",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{msg.sender}</div>
                                  <div style={{fontSize:8,color:"rgba(255,255,255,0.7)"}}>{msg.time}</div>
                                </div>
                                <button onClick={e=>{e.stopPropagation();setPreviewImg({src:msg.file.data,caption,sender:msg.sender,date,time:msg.time});}} style={{position:"absolute",top:3,left:3,width:20,height:20,borderRadius:4,background:"rgba(0,0,0,0.7)",border:"none",color:"#fff",cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}} title="ดูรูปขนาดเต็ม">⛶</button>
                              </div>
                              {caption&&<div style={{fontSize:9,color:C.muted,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:PSIZE}} title={caption}>{caption}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              ):(
                <div style={{textAlign:"center",padding:"32px 0",color:C.muted}}>
                  <div style={{fontSize:32,marginBottom:8}}>📭</div>
                  <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:4}}>ยังไม่มีรูปรายงานในหมวดนี้</div>
                  <div style={{fontSize:11}}>โฟแมน/วิศวกรส่งรูปผ่านกล่องข้อความหมวดนี้ก่อน</div>
                  <div style={{fontSize:11,marginTop:4}}>หรืออัปโหลดจากเครื่องด้านล่าง</div>
                </div>
              )}
            </div>

            {/* Footer: upload from device fallback */}
            <div style={{padding:"12px 18px",borderTop:`1px solid ${C.border}`,flexShrink:0,background:"#060d1a"}}>
              <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px 0",borderRadius:8,border:`1px dashed ${C.border2}`,cursor:"pointer",color:C.muted,fontSize:11,transition:"all 0.15s"}} onMouseOver={e=>{e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.color=C.blue;e.currentTarget.style.background=`${C.blue}0a`;}} onMouseOut={e=>{e.currentTarget.style.borderColor=C.border2;e.currentTarget.style.color=C.muted;e.currentTarget.style.background="none";}}>
                <span style={{fontSize:16}}>📁</span>
                <span>อัปโหลดจากเครื่อง{pChatImgs.length>0?" (สำรองเผื่อรูปไม่สวย)":""}</span>
                <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={ev=>{handleFilesForPhase(slotPickerPhase,ev.target.files);setSlotPickerPhase(null);ev.target.value="";}}/>
              </label>
            </div>
          </div>
        </div>
      );
    })()}

    {/* Full-size preview overlay */}
    {previewImg&&(
      <div onMouseDown={()=>setPreviewImg(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div onMouseDown={e=>e.stopPropagation()} style={{maxWidth:"min(90vw,700px)",width:"100%",borderRadius:12,overflow:"hidden",background:"#0d1117",border:`1px solid ${C.border}`}}>
          <img src={previewImg.src} style={{width:"100%",maxHeight:"65vh",objectFit:"contain",display:"block",background:"#000"}}/>
          <div style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>{previewImg.caption||"(ไม่มีคำบรรยาย)"}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:3}}>{previewImg.sender} • {previewImg.date}{previewImg.time?" • "+previewImg.time:""}</div>
            </div>
            <button onClick={()=>setPreviewImg(null)} style={{padding:"7px 16px",borderRadius:8,border:`1px solid ${C.border2}`,background:"none",color:C.muted,cursor:"pointer",fontSize:12}}>ปิด</button>
          </div>
        </div>
      </div>
    )}

    {/* ── Report Preview ── */}
    {reportHtml&&(
      <div id="cpms-report-overlay" style={{position:"fixed",inset:0,zIndex:1200,background:"#fff",overflowY:"auto"}}>
        {/* Toolbar */}
        <div style={{position:"sticky",top:0,zIndex:10,display:"flex",gap:10,padding:"10px 16px",background:"#020817",alignItems:"center",borderBottom:"1px solid #334155"}}>
          <button id="cpms-pdf-btn" onClick={async()=>{
            const btn=document.getElementById("cpms-pdf-btn");
            const oldText=btn.textContent;
            btn.textContent="⏳ กำลังสร้าง PDF...";
            btn.disabled=true;
            try{
              const el=document.getElementById("cpms-report-content");
              const canvas=await html2canvas(el,{scale:2,useCORS:true,allowTaint:true,logging:false,windowWidth:900});
              const imgData=canvas.toDataURL("image/jpeg",0.92);
              const pdf=new jsPDF("p","mm","a4");
              const pw=pdf.internal.pageSize.getWidth();
              const ph=pdf.internal.pageSize.getHeight();
              const iw=pw;
              const ih=(canvas.height*iw)/canvas.width;
              let pos=0;
              pdf.addImage(imgData,"JPEG",0,pos,iw,ih);
              let left=ih-ph;
              while(left>0){pdf.addPage();pos-=ph;pdf.addImage(imgData,"JPEG",0,pos,iw,ih);left-=ph;}
              dlBlob(pdf.output('blob'),`รูปเล่มงาน_${house.name}.pdf`);
            }catch(e){alert("เกิดข้อผิดพลาด: "+e.message);}
            btn.textContent=oldText;
            btn.disabled=false;
          }} style={{padding:"10px 22px",borderRadius:10,background:"#2563eb",border:"none",color:"#fff",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>💾 บันทึก PDF</button>
          <span style={{fontSize:11,color:"#64748b",marginLeft:"auto"}}>บ้าน {house.name} | {totalCount} รูป</span>
          <button onClick={()=>setReportHtml(null)} style={{padding:"8px 16px",borderRadius:8,background:"none",border:"1px solid #334155",color:"#94a3b8",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>✕ ปิด</button>
        </div>
        {/* Content */}
        <div id="cpms-report-content" dangerouslySetInnerHTML={{__html:reportHtml}} />
      </div>
    )}
    </>
  );
}

function PhaseCard({phase,house,data,setData,role,pp,boqItems,canEditDur,setEditPhaseNameMdl,editPhaseNameMdl}){
  const phPP=pp[phase.id]||{s:"waiting",dur:phase.days,act:0};
  const items=boqItems.filter(b=>b.phaseId===phase.id);
  const phMsgs=data.phaseMessages.filter(m=>m.houseId===house.id&&m.phaseId===phase.id);
  const msgScrollRef=useRef(null);
  const [phaseChatTxt,setPhaseChatTxt]=useState("");
  const [phaseChatFile,setPhaseChatFile]=useState(null);
  const [showImgPicker,setShowImgPicker]=useState(false);
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

  // Send multiple cropped images from picker
  function handlePickerSend(imgs){
    setShowImgPicker(false);
    imgs.forEach((imgItem,idx)=>{
      const reader=new FileReader();
      reader.onload=()=>{
        const msgText=imgItem.caption||phaseChatTxt.trim()||(imgs.length>1?`📷 รูป ${idx+1}/${imgs.length}`:`📷 ${imgItem.file.name}`);
        setData(d=>({...d,phaseMessages:[...d.phaseMessages,{id:uid(),houseId:house.id,phaseId:phase.id,role,sender:ROLE_LBL[role],text:msgText,file:{name:imgItem.file.name,size:imgItem.file.size,type:imgItem.file.type,data:reader.result},time:new Date().toLocaleTimeString("th",{hour:"2-digit",minute:"2-digit"}),date:new Date().toISOString().slice(0,10)}]}));
        if(idx===imgs.length-1){setPhaseChatTxt("");setTimeout(()=>msgScrollRef.current?.scrollIntoView({behavior:"smooth"}),100);}
      };
      reader.readAsDataURL(imgItem.file);
    });
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
              {msg.role!==role&&<Avatar member={data.team.find(m=>m.role===msg.role)} size={32} fontSize={12}/>}
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
              {msg.role===role&&<Avatar member={data.team.find(m=>m.role===msg.role)} size={32} fontSize={12}/>}
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end",padding:"12px 0"}}>
          <div style={{flex:1,minWidth:250}}>
            <FIn value={phaseChatTxt} onChange={e=>setPhaseChatTxt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendPhaseMsg();}}} placeholder="พิมพ์ข้อความ... (Enter ส่ง)" rows={3} style={{fontSize:14,padding:"14px 16px",borderRadius:12,border:`2px solid ${C.border2}`,boxShadow:`0 4px 12px rgba(0,0,0,0.3)`,transition:"all 0.2s",fontWeight:"500"}}/>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {/* 📷 camera — opens multi-image picker with crop */}
            <button onClick={()=>setShowImgPicker(true)} title="เลือกรูปภาพหลายรูป + ปรับภาพ" style={{cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:42,height:42,borderRadius:10,border:`2px solid ${C.border2}`,color:C.muted,fontSize:18,background:C.panel,boxShadow:`0 2px 8px rgba(0,0,0,0.2)`}}>📷</button>
            {/* 📎 paperclip — opens file picker for non-image files */}
            <label htmlFor={`file-input-${phase.id}`} title="แนบไฟล์ (PDF, DWG, DOC...)" style={{cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:42,height:42,borderRadius:10,border:`2px solid ${C.border2}`,color:phaseChatFile?C.blue:C.muted,fontSize:16,background:C.panel,boxShadow:`0 2px 8px rgba(0,0,0,0.2)`}}>
              📎
              <input id={`file-input-${phase.id}`} type="file" accept=".pdf,.skp,.dwg,.dxf,.doc,.docx,.xls,.xlsx" onChange={e=>{if(e.target.files?.[0])setPhaseChatFile(e.target.files[0]);}} style={{display:"none"}}/>
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

      {/* Image Picker Modal */}
      {showImgPicker&&<ImagePickerModal onSend={handlePickerSend} onClose={()=>setShowImgPicker(false)}/>}

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

function HousePage({houseId,data,setData,role,onBack,onScrollToPhase,isMobileMode}) {
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
  const [showPhotoReport,setShowPhotoReport]=useState(false);
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
    <div style={{padding:isMobileMode?12:24}}>
      <div style={{display:"flex",alignItems:"center",gap:isMobileMode?8:12,marginBottom:isMobileMode?16:20,flexWrap:isMobileMode?"wrap":"nowrap"}}>
        <Btn variant="ghost" size="sm" onClick={onBack}>← {isMobileMode?"":"กลับ"}</Btn>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:isMobileMode?16:20,fontWeight:700,color:C.text}}>บ้านเลขที่ {house.name}</div><div style={{fontSize:isMobileMode?10:12,color:C.muted,marginTop:2}}>{house.customer||"ยังไม่มีลูกค้า"} · {house.phase}</div></div>
        <Tag color={house.status==="completed"?"green":house.status==="inprogress"?"blue":"gray"} style={{fontSize:isMobileMode?10:12,padding:"4px 12px"}}>{ST_LBL[house.status]}</Tag>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr 1fr":"repeat(4,1fr)",gap:isMobileMode?8:12,marginBottom:isMobileMode?16:22}}>
        {[["ความคืบหน้า",`${house.pct}%`,C.blue,true],["วันคงเหลือ",dl<0?`เกิน ${Math.abs(dl)} วัน`:`${dl} วัน`,dl<0?C.red:dl<30?C.orange:C.text,false],canPrice&&["ค่าใช้จ่ายจริง",`฿${fmtMoney(house.actual)}`,isOver?C.red:C.text,false],canPrice&&["เทียบ BOQ",(isOver?"เกิน ":"")+`฿${fmtMoney(Math.abs(house.boq-house.actual))}`,isOver?C.red:C.green,false]].filter(Boolean).map(([l,v,col,showBar],i)=>(
          <Card key={i} style={{padding:isMobileMode?"10px 12px":"13px 16px"}}><div style={{fontSize:isMobileMode?16:20,fontWeight:800,color:col}}>{v}</div>{showBar&&<PBar pct={house.pct} color={C.blue} h={4}/>}<div style={{fontSize:isMobileMode?10:11,color:C.muted,marginTop:4}}>{l}</div></Card>
        ))}
      </div>
      <div style={{display:"flex",gap:2,background:"#0d1117",borderRadius:10,padding:3,marginBottom:18,border:`1px solid ${C.border}`,width:"fit-content",overflowX:"auto"}}>
        {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:isMobileMode?"4px 10px":"5px 13px",borderRadius:8,border:"none",background:tab===t.id?C.panel:"transparent",color:tab===t.id?C.blue:C.muted,fontSize:isMobileMode?11:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>{isMobileMode?t.l.split(" ")[0]:t.l}</button>)}
      </div>

      {tab==="boq"&&(
        <div>
          {data.phases.map((phase)=>(
            <PhaseCard key={phase.id} phase={phase} house={house} data={data} setData={setData} role={role} pp={pp} boqItems={boqItems} canEditDur={canEdit} setEditPhaseNameMdl={setEditPhaseNameMdl} editPhaseNameMdl={editPhaseNameMdl} isMobileMode={isMobileMode}/>
          ))}
          {/* Photo Report Book — below last phase  */}
          {["owner","engineer","foreman"].includes(role)&&(
            <div style={{marginTop:8,paddingTop:16,borderTop:`2px dashed ${C.border2}`}}>
              <button onClick={()=>setShowPhotoReport(true)} style={{width:"100%",padding:"16px 20px",borderRadius:12,border:`1px solid ${C.border2}`,background:"linear-gradient(135deg,#0f1f3d 0%,#162040 100%)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,transition:"all 0.2s",color:C.text}}>
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <span style={{fontSize:28}}>📸</span>
                  <div style={{textAlign:"left"}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.text}}>รูปเล่มงานก่อสร้าง</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>{(()=>{const rp=(!Array.isArray(house.reportPhotos)&&house.reportPhotos)||{};const total=Object.values(rp).reduce((s,a)=>s+a.length,0);const phases=Object.keys(rp).filter(k=>(rp[k]||[]).length>0).length;return total>0?`${total} รูป จาก ${phases} หมวด — กดเพื่อดู / พิมพ์ / ดาวน์โหลด`:"เลือกรูปจากแต่ละหมวดเพื่อสร้างเล่มงานให้ลูกค้า";})()}</div>
                  </div>
                </div>
                <span style={{fontSize:13,color:C.blue,fontWeight:600,flexShrink:0}}>{(()=>{const rp=(!Array.isArray(house.reportPhotos)&&house.reportPhotos)||{};return Object.values(rp).some(a=>a.length>0)?"เปิดดู ›":"+ เลือกรูป ›";})()}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {tab==="gantt"&&(
        <Card style={{padding:isMobileMode?10:16,overflowX:"auto"}}>
          <div style={{fontSize:isMobileMode?12:14,fontWeight:700,color:C.text,marginBottom:4}}>Gantt Chart</div>
          <div style={{fontSize:isMobileMode?10:11,color:C.muted,marginBottom:16}}>{fmtDate(house.start)} — {fmtDate(addDays(house.start,totalDays))} ({totalDays} วัน)</div>
          <div style={{position:"relative",paddingLeft:isMobileMode?100:160,minWidth:isMobileMode?500:700,minHeight:ganttData.length*36+96}}>
            {/* Month header */}
            <div style={{position:"absolute",top:0,left:isMobileMode?100:160,right:0,height:36,display:"flex",borderBottom:`1px solid ${C.border}`}}>
              {ganttMonths.months.map((m,i)=>(
                <div key={i} style={{flex:`0 0 ${m.width}%`,position:"relative",borderLeft:`1px solid ${C.border}`,boxSizing:"border-box"}}>
                  <div style={{textAlign:"center",fontSize:isMobileMode?8:10,color:C.text,fontWeight:600,lineHeight:"16px",paddingTop:2,whiteSpace:"nowrap"}}>{m.label}</div>
                  <div style={{textAlign:"center",fontSize:isMobileMode?7:8,color:C.muted,lineHeight:"12px"}}>{m.yearLabel}</div>
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
      {showPhotoReport&&<PhotoReportModal house={house} data={data} setData={setData} role={role} onClose={()=>setShowPhotoReport(false)} isMobileMode={isMobileMode}/>}
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
                  <td style={{padding:"9px 12px"}}><div style={{fontSize:13,color:C.text}}>{c?.name||<span style={{color:C.muted}}>— ว่าง</span>}</div>{c?.phone&&<div style={{fontSize:11}}><a href={`tel:${c.phone}`} onClick={e=>e.stopPropagation()} style={{color:C.blue,textDecoration:"none"}}>📞 {c.phone}</a></div>}</td>
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

function TimelinePage({data,role,onOpenHouse,isMobileMode}) {
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");
  
  const filtered=data.houses.filter(h=>{
    const matchSearch=h.name.toLowerCase().includes(search.toLowerCase())||h.customer?.toLowerCase().includes(search.toLowerCase());
    const matchStatus=statusFilter==="all"||h.status===statusFilter;
    return matchSearch&&matchStatus;
  });

  return (
    <div style={{padding:isMobileMode?8:12}}>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:isMobileMode?14:16,fontWeight:700,color:C.text}}>📈 ไทม์ไลน์</div>
        <div style={{fontSize:isMobileMode?9:10,color:C.muted,marginTop:1}}>{filtered.length} หลัง</div>
      </div>

      <div style={{display:"flex",gap:isMobileMode?6:8,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:isMobileMode?120:150}}>
          <FIn 
            placeholder="🔍 ค้นหา..." 
            value={search} 
            onChange={e=>setSearch(e.target.value)}
            style={{fontSize:isMobileMode?10:11,padding:isMobileMode?"3px 6px":"4px 8px"}}
          />
        </div>
        <div style={{display:"flex",gap:isMobileMode?2:4,flexWrap:"wrap"}}>
          {[["all","ทั้งหมด"],["inprogress","🔄"],["completed","✓"],["notstarted","⏳"]].map(([val,label])=>(
            <button 
              key={val}
              onClick={()=>setStatusFilter(val)}
              style={{
                padding:isMobileMode?"2px 6px":"3px 8px",
                borderRadius:4,
                border:`1px solid ${statusFilter===val?C.blue:C.border2}`,
                background:statusFilter===val?C.blueDim:"transparent",
                color:statusFilter===val?C.blue:C.muted,
                fontSize:isMobileMode?9:10,
                fontWeight:600,
                cursor:"pointer",
                whiteSpace:"nowrap"
              }}
            >
              {isMobileMode?label.charAt(0):label}
            </button>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"repeat(auto-fill,minmax(120px,1fr))",gap:isMobileMode?8:4}}>
        {filtered.map(house=>{
          const project=data.projects.find(p=>p.id===house.projectId);
          const totalCost=data.boqItems.filter(b=>b.houseId===house.id).reduce((s,i)=>s+i.qty*i.boqPrice,0);
          const actualCost=data.boqItems.filter(b=>b.houseId===house.id).reduce((s,i)=>s+i.qty*i.actualPrice,0);
          const isOver=actualCost>totalCost;
          return (
            <div 
              key={house.id} 
              onClick={()=>onOpenHouse(house)}
              style={{background:C.panel,borderLeft:`2px solid ${house.status==="completed"?C.green:house.status==="inprogress"?C.blue:C.muted}`,borderRadius:4,padding:4,cursor:"pointer",transition:"all .2s",border:`1px solid ${C.border}`}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.blue}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
            >
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:9,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{house.name}</div>
                </div>
                <Tag color={house.status==="completed"?"green":house.status==="inprogress"?"blue":"gray"} style={{fontSize:7,padding:"0px 3px",marginLeft:2,flexShrink:0}}>{ST_LBL[house.status]}</Tag>
              </div>
              
              <div style={{marginBottom:3}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:1,fontSize:7}}>
                  <span style={{color:C.muted,fontWeight:700}}>ก่อ</span>
                  <span style={{fontWeight:700,color:C.blue}}>{house.pct}%</span>
                </div>
                <PBar pct={house.pct} color={C.blue} h={3}/>
              </div>

              <div style={{display:"flex",gap:2,fontSize:7}}>
                <div style={{flex:1,background:"#0d1117",borderRadius:2,padding:"2px 3px"}}>
                  <div style={{color:C.muted,fontWeight:700,fontSize:6}}>เฟส</div>
                  <div style={{color:C.text,fontWeight:600,fontSize:7,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{house.phase}</div>
                </div>
                <div style={{width:32,background:"#0d1117",borderRadius:2,padding:"2px 3px",textAlign:"center"}}>
                  <div style={{color:C.muted,fontWeight:700,fontSize:6}}>วัน</div>
                  <div style={{color:daysLeft(house.start,house.days)<0?C.red:C.text,fontWeight:600,fontSize:7}}>
                    {daysLeft(house.start,house.days)<0?`-${Math.abs(daysLeft(house.start,house.days))}`:`${daysLeft(house.start,house.days)}`}
                  </div>
                </div>
              </div>

              {role==="owner"&&(
                <div style={{marginTop:3,paddingTop:3,borderTop:`1px solid ${C.border}`,display:"flex",gap:2,fontSize:7,textAlign:"center"}}>
                  <div style={{flex:1}}>
                    <div style={{color:C.muted,fontWeight:700,fontSize:6}}>งบ</div>
                    <div style={{color:C.blue,fontWeight:700,fontSize:7}}>฿{fmtMoney(totalCost/1000)}K</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{color:C.muted,fontWeight:700,fontSize:6}}>ใช้</div>
                    <div style={{color:isOver?C.red:C.text,fontWeight:700,fontSize:7}}>฿{fmtMoney(actualCost/1000)}K</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{color:C.muted,fontWeight:700,fontSize:6}}>Δ</div>
                    <div style={{color:isOver?C.red:C.green,fontWeight:700,fontSize:7}}>{isOver?"+":""}฿{fmtMoney(Math.abs(totalCost-actualCost)/1000)}K</div>
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
        {[["cost","🔍 ต้นทุนตามหมวดงาน"],["progress","📈 ความคืบหน้า"]].map(([v,l])=><Btn key={v} variant={chartType===v?"primary":"ghost"} size="sm" onClick={()=>setChartType(v)}>{l}</Btn>)}
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
                  <Avatar member={t} size={40} fontSize={18}/>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:C.text}}>{t.name}</div>
                    <div style={{fontSize:11,color:ROLE_COL[t.role]}}>{ROLE_LBL[t.role]}</div>
                  </div>
                  <div style={{marginLeft:"auto"}}>
                    <Tag color={t.status==="active"?"green":"gray"}>{t.status==="active"?"✓ Active":"Inactive"}</Tag>
                  </div>
                </div>
                <div style={{paddingTop:10,borderTop:`1px solid ${C.border}`,fontSize:12}}>
                  {t.phone&&<div style={{marginTop:4}}><a href={`tel:${t.phone}`} style={{color:C.blue,textDecoration:"none",fontSize:12}}>📞 {t.phone}</a></div>}
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
              <Avatar member={member} size={40} fontSize={16}/>
              <div style={{marginLeft:12,flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{member.name}</div>
                <div style={{fontSize:11,color:ROLE_COL[member.role],marginTop:2}}>{ROLE_LBL[member.role]}</div>
              </div>
              <Tag color={member.status==="active"?"green":"gray"} style={{fontSize:10}}>{member.status==="active"?"✓":"○"}</Tag>
            </div>
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
              {member.phone&&<div style={{fontSize:11,marginBottom:10}}><a href={`tel:${member.phone}`} style={{color:C.blue,textDecoration:"none"}}>📞 {member.phone}</a></div>}
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

function SettingsPage({data,setData,role}) {
  const [tab,setTab]=useState("projects");
  const [newTpl,setNewTpl]=useState({name:"",boqBudget:1800000,defaultDays:180});
  const [showNew,setShowNew]=useState(false);
  const [editPh,setEditPh]=useState(null);
  const [editTpl,setEditTpl]=useState(null);
  const [editTplName,setEditTplName]=useState(null);
  const [newBoqItem,setNewBoqItem]=useState({phaseId:1,name:"",unit:"",qty:1,boqPrice:0});
  const [showAddBoq,setShowAddBoq]=useState(false);
  const [notif,setNotif]=useState(data.notifications||{emailOnPayment:true,emailOnDelay:true,emailOnCompletion:true,pushOnOrder:true,pushOnApproval:true,smsAlert:false});
  const [editingName,setEditingName]=useState(null); // {id, value}
  const [editingPhone,setEditingPhone]=useState(null); // {id, value}
  const [showNewProj,setShowNewProj]=useState(false);
  const [newProj,setNewProj]=useState({name:"",address:""});
  const [selectedProj,setSelectedProj]=useState(null);
  const [showNewHouse,setShowNewHouse]=useState(false);
  const [newHouse,setNewHouse]=useState({name:"",customer:"",start:"",days:180,boq:1800000,templateId:1,foreman:"",engineer:""});
  return (
    <div style={{padding:24}}>
      <div style={{marginBottom:20}}><div style={{fontSize:22,fontWeight:700,color:C.text}}>⚙️ ตั้งค่าระบบ</div><div style={{fontSize:13,color:C.muted,marginTop:2}}>จัดการโครงการ เทมเพลท หมวดงาน และการแจ้งเตือน</div></div>
      <div style={{display:"flex",gap:2,background:"#0d1117",borderRadius:10,padding:3,marginBottom:20,border:`1px solid ${C.border}`,width:"fit-content"}}>
        {[["projects","🏢 โครงการ"],["templates","🏠 เทมเพลทบ้าน"],["phases","📋 15 หมวดงาน"],["employees","👥 ทีมงาน"],["notifications","🔔 Notifications"]].map(([id,label])=><button key={id} onClick={()=>setTab(id)} style={{padding:"5px 13px",borderRadius:8,border:"none",background:tab===id?C.panel:"transparent",color:tab===id?C.blue:C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>{label}</button>)}
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
      {tab==="employees"&&(
        <Card style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:16}}>👥 จัดการพนักงาน</div>
          {/* ── Pending Approvals ── */}
          {data.team.filter(t=>t.status==="pending").length>0&&(
            <div style={{marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:12,fontWeight:700,color:C.orange}}>⏳ รอการอนุมัติ</span>
                <span style={{background:C.orange,color:"#000",borderRadius:99,padding:"1px 8px",fontSize:11,fontWeight:700}}>{data.team.filter(t=>t.status==="pending").length}</span>
              </div>
              <div style={{display:"grid",gap:10}}>
                {data.team.filter(t=>t.status==="pending").map(member=>(
                  <div key={member.id} style={{background:`${C.orange}11`,border:`1px solid ${C.orange}44`,borderRadius:12,padding:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <Avatar member={member} size={40}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.text}}>{member.name}</div>
                        <div style={{fontSize:11,color:ROLE_COL[member.role]||C.muted}}>{ROLE_LBL[member.role]} • @{member.username}</div>
                        {member.phone&&<div style={{fontSize:10,marginTop:1}}><a href={`tel:${member.phone}`} style={{color:C.blue,textDecoration:"none"}}>📞 {member.phone}</a></div>}
                        {member.registeredAt&&<div style={{fontSize:10,color:C.muted}}>สมัครเมื่อ {new Date(member.registeredAt).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"})}</div>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>{
                        setData(d=>({...d,
                          team:d.team.map(t=>t.id===member.id?{...t,status:"active"}:t),
                          employeeLevels:{...d.employeeLevels,[member.id]:d.employeeLevels[member.id]||1}
                        }));
                      }} style={{flex:1,padding:"8px",borderRadius:8,border:"none",background:C.green,color:"#000",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                        ✓ อนุมัติ
                      </button>
                      <button onClick={()=>{
                        if(!window.confirm(`ปฏิเสธคำขอของ ${member.name}?`))return;
                        setData(d=>({...d,team:d.team.filter(t=>t.id!==member.id)}));
                      }} style={{flex:1,padding:"8px",borderRadius:8,border:`1px solid ${C.red}44`,background:`${C.red}22`,color:"#fca5a5",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                        ✗ ปฏิเสธ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{height:1,background:C.border,margin:"16px 0"}}/>
            </div>
          )}
          {/* ── Pending Password Changes ── */}
          {data.team.filter(t=>t.pendingPassword).length>0&&(
            <div style={{marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:12,fontWeight:700,color:C.blue}}>🔑 รอยืนยันเปลี่ยนรหัสผ่าน</span>
                <span style={{background:C.blue,color:"#000",borderRadius:99,padding:"1px 8px",fontSize:11,fontWeight:700}}>{data.team.filter(t=>t.pendingPassword).length}</span>
              </div>
              <div style={{display:"grid",gap:10}}>
                {data.team.filter(t=>t.pendingPassword).map(member=>(
                  <div key={member.id} style={{background:`${C.blue}11`,border:`1px solid ${C.blue}44`,borderRadius:12,padding:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <Avatar member={member} size={40}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.text}}>{member.name}</div>
                        <div style={{fontSize:11,color:ROLE_COL[member.role]||C.muted}}>{ROLE_LBL[member.role]} • @{member.username}</div>
                        {member.pendingPasswordAt&&<div style={{fontSize:10,color:C.muted,marginTop:1}}>ขอเมื่อ {new Date(member.pendingPasswordAt).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"})}</div>}
                        <div style={{fontSize:11,color:C.blue,marginTop:4}}>รหัสใหม่ที่ขอ: <span style={{letterSpacing:2}}>{"•".repeat(member.pendingPassword.length)}</span></div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>{
                        setData(d=>({...d,team:d.team.map(t=>t.id===member.id?{...t,password:t.pendingPassword,pendingPassword:null,pendingPasswordAt:null}:t)}));
                      }} style={{flex:1,padding:"8px",borderRadius:8,border:"none",background:C.green,color:"#000",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                        ✓ อนุมัติ
                      </button>
                      <button onClick={()=>{
                        setData(d=>({...d,team:d.team.map(t=>t.id===member.id?{...t,pendingPassword:null,pendingPasswordAt:null}:t)}));
                      }} style={{flex:1,padding:"8px",borderRadius:8,border:`1px solid ${C.red}44`,background:`${C.red}22`,color:"#fca5a5",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                        ✗ ปฏิเสธ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{height:1,background:C.border,margin:"16px 0"}}/>
            </div>
          )}
          {/* ── Active Members ── */}
          <div style={{display:"grid",gap:16}}>
            {data.team.filter(t=>t.status==="active").map(member=>(
              <div key={member.id} style={{background:"#0d1117",borderRadius:12,padding:16,border:`1px solid ${C.border}`}}>
                {/* Row: avatar + name + level */}
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                  {/* Avatar with upload */}
                  <div style={{position:"relative",flexShrink:0}}>
                    <Avatar member={member} size={52} fontSize={20}/>
                    <label style={{position:"absolute",bottom:-4,right:-4,width:20,height:20,borderRadius:10,background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:11,border:`2px solid ${C.bg}`}} title="เปลี่ยนรูปโปรไฟล์">
                      📷
                      <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                        const file=e.target.files[0];
                        if(!file)return;
                        if(file.size>2*1024*1024){alert("ไฟล์ใหญ่เกิน 2MB");return;}
                        const reader=new FileReader();
                        reader.onloadend=()=>setData(d=>({...d,team:d.team.map(t=>t.id===member.id?{...t,avatar:reader.result}:t)}));
                        reader.readAsDataURL(file);
                        e.target.value="";
                      }}/>
                    </label>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    {editingName?.id===member.id?(
                      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:2}}>
                        <input
                          autoFocus
                          value={editingName.value}
                          onChange={e=>setEditingName(v=>({...v,value:e.target.value}))}
                          onKeyDown={e=>{
                            if(e.key==="Enter"&&editingName.value.trim()){
                              setData(d=>({...d,team:d.team.map(t=>t.id===member.id?{...t,name:editingName.value.trim()}:t)}));
                              setEditingName(null);
                            } else if(e.key==="Escape") setEditingName(null);
                          }}
                          style={{flex:1,background:"#060d1a",border:`1px solid ${C.blue}`,borderRadius:6,padding:"4px 8px",color:C.text,fontSize:13,fontWeight:700,outline:"none",minWidth:0}}
                        />
                        <button onClick={()=>{if(editingName.value.trim()){setData(d=>({...d,team:d.team.map(t=>t.id===member.id?{...t,name:editingName.value.trim()}:t)}));setEditingName(null);}}} style={{background:C.green,border:"none",borderRadius:6,color:"#000",fontSize:11,fontWeight:700,cursor:"pointer",padding:"4px 8px"}}>✓</button>
                        <button onClick={()=>setEditingName(null)} style={{background:"none",border:`1px solid ${C.border2}`,borderRadius:6,color:C.muted,fontSize:11,cursor:"pointer",padding:"4px 8px"}}>✕</button>
                      </div>
                    ):(
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{member.name}</div>
                        <button onClick={()=>setEditingName({id:member.id,value:member.name})} title="แก้ไขชื่อ" style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:12,padding:0,flexShrink:0,lineHeight:1}}>✏️</button>
                      </div>
                    )}
                    <div style={{fontSize:11,color:ROLE_COL[member.role]||C.muted}}>{ROLE_LBL[member.role]}</div>
                    {member.avatar&&<button onClick={()=>setData(d=>({...d,team:d.team.map(t=>t.id===member.id?{...t,avatar:""}:t)}))} style={{fontSize:10,color:"#ef4444",background:"none",border:"none",cursor:"pointer",padding:0,marginTop:4}}>ลบรูป ×</button>}
                  </div>
                  {/* Level selector — owner only */}
                  {role==="owner"&&<div style={{textAlign:"right"}}>
                    <div style={{fontSize:9,color:C.muted,marginBottom:4}}>Delegation Level</div>
                    <select value={data.employeeLevels[member.id]||1} onChange={e=>setData(d=>({...d,employeeLevels:{...d.employeeLevels,[member.id]:+e.target.value}}))} style={{background:"#060d1a",border:`1px solid ${C.border2}`,borderRadius:8,padding:"6px 10px",color:C.text,fontSize:12}}>
                      {[1,2,3,4,5].map(l=><option key={l} value={l}>Level {l}</option>)}
                    </select>
                  </div>}
                </div>
                {/* Credentials row */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <div style={{fontSize:11,color:C.muted}}>
                    <span style={{color:C.text,fontWeight:600}}>Username: </span>
                    <span style={{color:C.blue,fontFamily:"monospace"}}>{member.username||"-"}</span>
                  </div>
                  <div style={{fontSize:11,color:C.muted}}>
                    <span style={{color:C.text,fontWeight:600}}>Password: </span>
                    <span style={{color:C.muted,fontFamily:"monospace"}}>{"•".repeat(member.password?.length||4)}</span>
                  </div>
                </div>
                {/* Phone row */}
                <div style={{marginBottom:8}}>
                  {editingPhone?.id===member.id?(
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:12}}>📞</span>
                      <input
                        autoFocus
                        type="tel"
                        value={editingPhone.value}
                        onChange={e=>setEditingPhone(v=>({...v,value:e.target.value}))}
                        onKeyDown={e=>{
                          if(e.key==="Enter"&&editingPhone.value.trim()){
                            setData(d=>({...d,team:d.team.map(t=>t.id===member.id?{...t,phone:editingPhone.value.trim()}:t)}));
                            setEditingPhone(null);
                          } else if(e.key==="Escape") setEditingPhone(null);
                        }}
                        placeholder="เบอร์โทรศัพท์"
                        style={{flex:1,background:"#060d1a",border:`1px solid ${C.blue}`,borderRadius:6,padding:"4px 8px",color:C.text,fontSize:12,outline:"none",minWidth:0}}
                      />
                      <button onClick={()=>{if(editingPhone.value.trim()){setData(d=>({...d,team:d.team.map(t=>t.id===member.id?{...t,phone:editingPhone.value.trim()}:t)}));setEditingPhone(null);} else {setData(d=>({...d,team:d.team.map(t=>t.id===member.id?{...t,phone:""}:t)}));setEditingPhone(null);}}} style={{background:C.green,border:"none",borderRadius:6,color:"#000",fontSize:11,fontWeight:700,cursor:"pointer",padding:"4px 8px"}}>✓</button>
                      <button onClick={()=>setEditingPhone(null)} style={{background:"none",border:`1px solid ${C.border2}`,borderRadius:6,color:C.muted,fontSize:11,cursor:"pointer",padding:"4px 8px"}}>✕</button>
                    </div>
                  ):(
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {member.phone?(
                        <a href={`tel:${member.phone}`} style={{fontSize:12,color:C.blue,textDecoration:"none",flex:1}}>📞 {member.phone}</a>
                      ):(
                        <span style={{fontSize:11,color:C.muted,flex:1}}>📞 ยังไม่มีเบอร์โทร</span>
                      )}
                      <button onClick={()=>setEditingPhone({id:member.id,value:member.phone||""})} title="แก้ไขเบอร์โทร" style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:11,padding:0,flexShrink:0,lineHeight:1}}>✏️</button>
                    </div>
                  )}
                </div>
                {/* Location row */}
                {member.location?.address&&(
                  <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",background:`${C.green}11`,borderRadius:8,border:`1px solid ${C.green}22`}}>
                    <span style={{fontSize:12}}>📍</span>
                    <span style={{fontSize:11,color:C.green,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{member.location.address}</span>
                    {member.location.updatedAt&&<span style={{fontSize:9,color:C.muted,flexShrink:0}}>{new Date(member.location.updatedAt).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"})}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PART 8.3: Login Page
// ═══════════════════════════════════════════════════════════════

const OWNER_EMAIL="Bostonth738@gmail.com";

function LoginPage({data,onLogin}){
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [showPw,setShowPw]=useState(false);
  const [loading,setLoading]=useState(false);

  const handleLogin=()=>{
    if(!username.trim()||!password.trim()){setError("กรุณากรอก Username และ Password");return;}
    setLoading(true);setError("");
    setTimeout(()=>{
      const member=data.team.find(m=>m.username===username.trim()&&m.password===password);
      if(!member){setError("Username หรือ Password ไม่ถูกต้อง");setPassword("");setLoading(false);return;}
      if(member.status!=="active"){setError("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อเจ้าของโครงการ");setLoading(false);return;}
      onLogin(member.id,member.role);
      setLoading(false);
    },400);
  };

  const accounts=[
    {username:"owner",role:"owner",color:"#a78bfa",icon:"👑"},
    {username:"engineer",role:"engineer",color:"#38bdf8",icon:"🔧"},
    {username:"foreman",role:"foreman",color:"#fb923c",icon:"🏗"},
    {username:"purchasing",role:"purchasing",color:"#4ade80",icon:"🛒"},
    {username:"marketing",role:"marketing",color:"#f472b6",icon:"📢"},
  ];

  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:72,height:72,borderRadius:20,background:`${C.blue}22`,border:`2px solid ${C.blue}44`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontSize:36}}>👑</div>
          <div style={{fontSize:22,fontWeight:700,color:C.text}}>The Crown CPMS</div>
          <div style={{fontSize:12,color:C.muted,marginTop:4}}>Construction Project Management</div>
        </div>
        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:28}}>
          <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:18}}>🔑 เข้าสู่ระบบ</div>
          <FG label="Username">
            <FIn value={username} onChange={e=>{setUsername(e.target.value);setError("");}} placeholder="username" onKeyDown={e=>e.key==="Enter"&&handleLogin()} autoComplete="username"/>
          </FG>
          <FG label="Password">
            <div style={{position:"relative"}}>
              <FIn type={showPw?"text":"password"} value={password} onChange={e=>{setPassword(e.target.value);setError("");}} placeholder="รหัสผ่าน" onKeyDown={e=>e.key==="Enter"&&handleLogin()} autoComplete="current-password"/>
              <button type="button" onClick={()=>setShowPw(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16,padding:0,lineHeight:1}}>{showPw?"🙈":"👁️"}</button>
            </div>
          </FG>
          {error&&<div style={{background:`${C.red}22`,border:`1px solid ${C.red}44`,borderRadius:8,padding:"8px 12px",color:"#fca5a5",fontSize:12,marginBottom:12}}>{error}</div>}
          <Btn onClick={handleLogin} disabled={loading} style={{width:"100%",justifyContent:"center",marginBottom:0}}>
            {loading?"กำลังตรวจสอบ...":"เข้าสู่ระบบ"}
          </Btn>
          {/* Accounts reference */}
          <div style={{marginTop:18,borderTop:`1px solid ${C.border}`,paddingTop:14}}>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>บัญชีในระบบ (รหัสผ่านเริ่มต้น: 1234)</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {accounts.map(a=>(
                <button key={a.username} type="button" onClick={()=>{setUsername(a.username);setPassword("1234");setError("");}} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:"#0d1117",cursor:"pointer",textAlign:"left",width:"100%",transition:"border-color 0.15s"}} onMouseOver={e=>e.currentTarget.style.borderColor=a.color} onMouseOut={e=>e.currentTarget.style.borderColor=C.border}>
                  <span style={{fontSize:16,width:22,textAlign:"center"}}>{a.icon}</span>
                  <span style={{fontFamily:"monospace",fontSize:12,color:a.color,fontWeight:700,minWidth:80}}>{a.username}</span>
                  <span style={{fontSize:11,color:C.muted}}>{ROLE_LBL[a.role]}</span>
                  <span style={{marginLeft:"auto",fontSize:10,color:C.muted}}>คลิกเพื่อเลือก</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// PART 8.4: Thai Date Picker (วัน/เดือน/ปี แบบไทย)
// ═══════════════════════════════════════════════════════════════

const THAI_MONTHS=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const THAI_MONTHS_SHORT=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function ThaiDatePicker({value,onChange,placeholder="เลือกวันที่",useISO=false}){
  // value = "YYYY-MM-DD" (ISO) or Thai text like "15 เมษายน 2569"
  // useISO=true → onChange emits "YYYY-MM-DD" (CE year); false → emits "15 เมษายน 2569"
  const parseVal=v=>{
    if(!v)return{day:1,month:4,year:2569};
    // Try ISO format first
    const iso=v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(iso)return{day:+iso[3],month:+iso[2],year:+iso[1]+543};
    // Try "15 เมษายน 2569"
    const th=v.match(/^(\d+)\s+(\S+)\s+(\d+)$/);
    if(th){const mi=THAI_MONTHS.indexOf(th[2]);return{day:+th[1],month:mi>=0?mi+1:1,year:+th[3]};}
    return{day:1,month:4,year:2569};
  };
  const {day,month,year}=parseVal(value);
  const [open,setOpen]=useState(false);
  const [d,setD]=useState(day);
  const [m,setM]=useState(month);
  const [y,setY]=useState(year);
  const startYear=2569;
  const years=Array.from({length:10},(_,i)=>startYear+i);
  const daysInMonth=(mo,yr)=>{const ceYr=yr-543;return new Date(ceYr,mo,0).getDate();};
  const maxDay=daysInMonth(m,y);
  const emit=(nd,nm,ny)=>{
    const dd=Math.min(nd,daysInMonth(nm,ny));
    if(useISO){
      const ceYr=ny-543;
      const mm=String(nm).padStart(2,"0");
      const ds=String(dd).padStart(2,"0");
      onChange(`${ceYr}-${mm}-${ds}`);
    } else {
      onChange(`${dd} ${THAI_MONTHS[nm-1]} ${ny}`);
    }
  };
  const display=value?`${d} ${THAI_MONTHS[m-1]} ${y}`:placeholder;
  return(
    <div style={{position:"relative"}}>
      <button type="button" onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"#0d1117",border:`2px solid ${C.border2}`,borderRadius:12,padding:"12px 14px",color:value?C.text:C.muted,fontSize:13,textAlign:"left",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>{display}</span><span style={{fontSize:11}}>📅</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:16,zIndex:400,boxShadow:"0 8px 24px rgba(0,0,0,.4)",minWidth:280}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 2fr 1fr",gap:8,marginBottom:12}}>
            {/* Day */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>วัน</div>
              <div style={{height:160,overflowY:"auto",borderRadius:8,border:`1px solid ${C.border}`,background:"#0d1117"}}>
                {Array.from({length:maxDay},(_,i)=>i+1).map(n=>(
                  <div key={n} onClick={()=>{setD(n);emit(n,m,y);}} style={{padding:"7px 12px",cursor:"pointer",background:d===n?`${C.blue}33`:"transparent",color:d===n?C.blue:C.text,fontSize:13,fontWeight:d===n?700:400,transition:"background 0.1s"}}>
                    {n}
                  </div>
                ))}
              </div>
            </div>
            {/* Month */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>เดือน</div>
              <div style={{height:160,overflowY:"auto",borderRadius:8,border:`1px solid ${C.border}`,background:"#0d1117"}}>
                {THAI_MONTHS.map((mn,i)=>(
                  <div key={i} onClick={()=>{setM(i+1);emit(d,i+1,y);}} style={{padding:"7px 12px",cursor:"pointer",background:m===i+1?`${C.blue}33`:"transparent",color:m===i+1?C.blue:C.text,fontSize:12,fontWeight:m===i+1?700:400,transition:"background 0.1s",whiteSpace:"nowrap"}}>
                    {mn}
                  </div>
                ))}
              </div>
            </div>
            {/* Year */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>ปี พ.ศ.</div>
              <div style={{height:160,overflowY:"auto",borderRadius:8,border:`1px solid ${C.border}`,background:"#0d1117"}}>
                {years.map(yr=>(
                  <div key={yr} onClick={()=>{setY(yr);emit(d,m,yr);}} style={{padding:"7px 12px",cursor:"pointer",background:y===yr?`${C.blue}33`:"transparent",color:y===yr?C.blue:C.text,fontSize:13,fontWeight:y===yr?700:400,transition:"background 0.1s"}}>
                    {yr}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:12,color:C.text,fontWeight:600}}>{d} {THAI_MONTHS[m-1]} {y}</div>
            <Btn size="sm" onClick={()=>setOpen(false)}>✓ ตกลง</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// Avatar component
function Avatar({member,size=40,fontSize=16}){
  if(member?.avatar){
    return <img src={member.avatar} alt={member.name} style={{width:size,height:size,borderRadius:size/2,objectFit:"cover",flexShrink:0}}/>;
  }
  return(
    <div style={{width:size,height:size,borderRadius:size/2,background:ROLE_COL[member?.role]||C.blue,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize,flexShrink:0}}>
      {(member?.name||"?")[0]}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PART 8.5: Tracking Pages
// ═══════════════════════════════════════════════════════════════

// Print a Delegation Slip in a new window (also supports save-as-image via html2canvas)
function printDelegationSlip(task,data,role){
  const aTo=data.team.find(t=>t.id===task.assignedTo);
  const aBy=data.team.find(t=>t.id===task.assignedBy);
  const steps=Array.isArray(task.jobDetails?.how)?task.jobDetails.how:(task.jobDetails?.how?[task.jobDetails.how]:[]);
  const statusTh={inprogress:"⏳ กำลังทำ",notstarted:"😴 ยังไม่เริ่ม",completed:"✅ เสร็จแล้ว",cancelled:"❌ ยกเลิก"}[task.status]||task.status;
  const lc={1:"#22c55e",2:"#3b82f6",3:"#f97316",4:"#a855f7",5:"#ef4444"}[task.level]||"#3b82f6";
  const safeName=(task.taskName||"slip").replace(/\s+/g,"_").slice(0,30);
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ใบมอบหมายงาน</title><script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script><style>@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans Thai',sans-serif;background:#f1f5f9;color:#1a1a1a}
.toolbar{display:flex;gap:8px;padding:10px 16px;background:#1e293b;position:sticky;top:0;z-index:10}
.tbtn{padding:7px 16px;border-radius:6px;border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600}
.tbtn-print{background:#3b82f6;color:#fff}.tbtn-save{background:#16a34a;color:#fff}.tbtn-close{background:#374151;color:#ccc}
.wrap{padding:24px;max-width:480px;margin:0 auto;background:#fff}
.hdr{border-bottom:3px solid #1a1a1a;padding-bottom:14px;margin-bottom:18px;text-align:center}.hdr-title{font-size:18px;font-weight:700}.hdr-meta{font-size:11px;color:#666;margin-top:4px}
.task-name{font-size:16px;font-weight:700;margin-bottom:4px}.remarks{font-size:12px;color:#666;margin-bottom:12px}
.info-row{display:flex;gap:16px;margin-bottom:16px}.info-item{flex:1}.info-label{font-size:10px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.5px}.info-val{font-size:13px;font-weight:600;margin-top:2px}
.lvl{display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;border:2px solid ${lc};color:${lc}}
.slip{border:2px dashed #aaa;border-radius:8px;padding:20px;margin-top:14px}
.recipient{font-size:15px;font-weight:700;margin-bottom:14px}
.field{margin-bottom:10px}.field-lbl{font-size:10px;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px}.field-val{font-size:13px;line-height:1.6}
.step{display:flex;gap:8px;margin-bottom:5px;align-items:flex-start}.snum{width:22px;height:22px;border-radius:11px;background:#dbeafe;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#2563eb;flex-shrink:0;margin-top:1px}
.sig{border-top:1px solid #ddd;padding-top:14px;margin-top:18px;display:flex;justify-content:flex-end}.sig-inner{text-align:right;font-size:11px;color:#888}
@media print{.toolbar{display:none}}</style></head><body>
<div class="toolbar">
  <button class="tbtn tbtn-print" onclick="window.print()">🖨️ พิมพ์</button>
  <button class="tbtn tbtn-save" id="saveBtn">📸 บันทึกเป็นรูปภาพ</button>
  <button class="tbtn tbtn-close" onclick="window.close()">✕ ปิด</button>
</div>
<div class="wrap" id="slipEl">
<div class="hdr"><div class="hdr-title">ใบมอบหมายงาน</div><div class="hdr-meta">สร้างวันที่: ${task.createdDate||""} &nbsp;|&nbsp; สถานะ: ${statusTh}</div></div>
<div class="task-name">${task.taskName}</div>
${task.remarks?`<div class="remarks">หมายเหตุ: ${task.remarks}</div>`:""}
<div class="info-row">
<div class="info-item"><div class="info-label">มอบหมายให้</div><div class="info-val">${aTo?.name||"-"}</div></div>
${role==="owner"?`<div class="info-item"><div class="info-label">ระดับ Delegation</div><div class="info-val"><span class="lvl">Level ${task.level}</span></div></div>`:""}
</div>
<div class="slip">
<div class="recipient">${aTo?.name||""},</div>
${task.jobDetails?.what?`<div class="field"><div class="field-lbl">What</div><div class="field-val">ช่วย ${task.jobDetails.what} นะ</div></div>`:""}
${task.jobDetails?.why?`<div class="field"><div class="field-lbl">Why</div><div class="field-val">เพราะ${task.jobDetails.why}</div></div>`:""}
<div class="field"><div class="field-lbl">When</div><div class="field-val">ส่งให้ฉันภายใน ${task.deadline}</div></div>
${steps.length>0?`<div class="field"><div class="field-lbl">How</div>${steps.map((s,i)=>`<div class="step"><div class="snum">${i+1}</div><div class="field-val">${s}</div></div>`).join("")}</div>`:""}
${task.jobDetails?.obstacles?`<div class="field"><div class="field-lbl">ถ้ามีอะไรติดขัด</div><div class="field-val">${task.jobDetails.obstacles}</div></div>`:""}
</div>
<div class="sig"><div class="sig-inner"><div>ผู้มอบหมาย: ${aBy?.name||"เจ้าของ"}</div><div style="margin-top:28px">ลายเซ็น: _______________________</div></div></div>
</div>
<script>
document.getElementById('saveBtn').addEventListener('click',function(){
  var btn=this;var tbar=document.querySelector('.toolbar');
  btn.textContent='กำลังสร้าง...';btn.disabled=true;tbar.style.visibility='hidden';
  html2canvas(document.getElementById('slipEl'),{scale:2,useCORS:true,backgroundColor:'#ffffff'}).then(function(c){
    var a=document.createElement('a');a.download='${safeName}.png';a.href=c.toDataURL('image/png');a.click();
    tbar.style.visibility='visible';btn.textContent='📸 บันทึกเป็นรูปภาพ';btn.disabled=false;
  }).catch(function(){tbar.style.visibility='visible';btn.textContent='📸 บันทึกเป็นรูปภาพ';btn.disabled=false;});
});
<\/script></body></html>`;
  const blob=new Blob([html],{type:"text/html;charset=utf-8"});
  const blobUrl=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=blobUrl;link.target="_blank";link.rel="noopener noreferrer";
  document.body.appendChild(link);link.click();document.body.removeChild(link);
  setTimeout(()=>URL.revokeObjectURL(blobUrl),60000);
}

// Shared form for add/edit task - matches paper template layout
function DelegationForm({task,setTask,data,role,isMobileMode}){
  const [newStep,setNewStep]=useState("");
  const assignedMember=data.team.find(t=>t.id===+task.assignedTo);
  const steps=Array.isArray(task.jobDetails?.how)?task.jobDetails.how:[];
  const addStep=()=>{if(!newStep.trim())return;setTask(t=>({...t,jobDetails:{...t.jobDetails,how:[...steps,newStep.trim()]}}));setNewStep("");};
  const removeStep=(i)=>setTask(t=>({...t,jobDetails:{...t.jobDetails,how:steps.filter((_,idx)=>idx!==i)}}));
  const updateStep=(i,v)=>setTask(t=>({...t,jobDetails:{...t.jobDetails,how:steps.map((s,idx)=>idx===i?v:s)}}));
  return(
    <div style={{display:"grid",gap:12}}>
      <FG label="งาน / หัวข้องาน *"><FIn value={task.taskName} onChange={e=>setTask(t=>({...t,taskName:e.target.value}))} placeholder="เช่น หาราคา supplier"/></FG>
      <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:12}}>
        <FG label="มอบหมายให้ *">
          <FSel value={task.assignedTo} onChange={e=>setTask(t=>({...t,assignedTo:e.target.value}))}>
            <option value="">-- เลือกทีมงาน --</option>
            {data.team.filter(m=>m.id!==1&&m.status==="active").map(m=><option key={m.id} value={m.id}>{m.name} ({ROLE_LBL[m.role]})</option>)}
          </FSel>
        </FG>
        {role==="owner"&&<FG label="ระดับ Delegation Level"><FSel value={task.level} onChange={e=>setTask(t=>({...t,level:+e.target.value}))}>{[1,2,3,4,5].map(l=><option key={l} value={l}>Level {l}</option>)}</FSel></FG>}
      </div>
      {task.assignedTo?(
        <div style={{background:"#060d1a",border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginTop:4}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:16}}>{assignedMember?.name||"..."},</div>
          <FG label="What — ช่วย ... นะ"><FIn value={task.jobDetails.what} onChange={e=>setTask(t=>({...t,jobDetails:{...t.jobDetails,what:e.target.value}}))} placeholder="ตรวจสอบราคาปูนซีเมนต์จาก 3 ร้านค้า"/></FG>
          <FG label="Why — เพราะ"><FIn value={task.jobDetails.why} onChange={e=>setTask(t=>({...t,jobDetails:{...t.jobDetails,why:e.target.value}}))} placeholder="เพื่อวัดราคาที่แข่งขันกันได้"/></FG>
          <FG label="When — กำหนดส่ง *">
            <ThaiDatePicker useISO value={task.deadline} onChange={v=>setTask(t=>({...t,deadline:v}))} placeholder="เลือกวันกำหนดส่ง"/>
          </FG>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>How — ขั้นตอน</div>
            {steps.map((step,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                <div style={{width:24,height:24,borderRadius:12,background:`${C.blue}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.blue,flexShrink:0}}>{i+1}</div>
                <FIn value={step} onChange={e=>updateStep(i,e.target.value)} style={{flex:1}}/>
                <button onClick={()=>removeStep(i)} style={{width:28,height:28,borderRadius:6,border:`1px solid ${C.border2}`,background:"none",color:"#ef4444",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>×</button>
              </div>
            ))}
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4}}>
              <div style={{width:24,height:24,borderRadius:12,background:C.faint,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:C.muted,flexShrink:0}}>{steps.length+1}</div>
              <FIn value={newStep} onChange={e=>setNewStep(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addStep();}}} placeholder="พิมพ์ขั้นตอน แล้วกด Enter หรือปุ่ม + เพิ่ม" style={{flex:1}}/>
              <Btn size="sm" onClick={addStep} disabled={!newStep.trim()}>+ เพิ่ม</Btn>
            </div>
          </div>
          <FG label="ถ้ามีอะไรติดขัด"><FIn value={task.jobDetails.obstacles} onChange={e=>setTask(t=>({...t,jobDetails:{...t.jobDetails,obstacles:e.target.value}}))} placeholder="แจ้งให้ฉันทราบทันที"/></FG>
        </div>
      ):(
        <div style={{background:"#0d1117",border:`1px dashed ${C.border}`,borderRadius:10,padding:20,textAlign:"center",color:C.muted,fontSize:12}}>
          กรุณาเลือกผู้รับมอบหมายก่อน เพื่อกรอกรายละเอียดงาน
        </div>
      )}
      <FG label="หมายเหตุ"><FIn value={task.remarks} onChange={e=>setTask(t=>({...t,remarks:e.target.value}))} placeholder="เช่น รอข้อมูลจากร้าน 3"/></FG>
    </div>
  );
}

// Delegation Slip Card (inline display matching paper template)
function DelegationSlipCard({task,data,role,isMobileMode}){
  const aTo=data.team.find(t=>t.id===task.assignedTo);
  const aBy=data.team.find(t=>t.id===task.assignedBy);
  const steps=Array.isArray(task.jobDetails?.how)?task.jobDetails.how:(task.jobDetails?.how?[task.jobDetails.how]:[]);
  const sc=getStatusColor(task.status);
  return(
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.taskName}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:2}}>สร้างวันที่ {task.createdDate}</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
          {role==="owner"&&<Tag color="blue"><span style={{fontWeight:700}}>L{task.level}</span></Tag>}
          <div style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",background:`${sc}22`,color:sc,borderRadius:6,fontSize:11,fontWeight:600,border:`1px solid ${sc}44`}}>
            {STATUS_ICONS[task.status]} {task.status==="inprogress"?"กำลังทำ":task.status==="notstarted"?"รอเริ่ม":task.status==="completed"?"เสร็จแล้ว":"ยกเลิก"}
          </div>
        </div>
      </div>
      <div style={{padding:16}}>
        <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:16}}>{aTo?.name||"-"},</div>
        {task.jobDetails?.what&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>What</div>
            <div style={{fontSize:13,color:C.text}}>ช่วย {task.jobDetails.what} นะ</div>
          </div>
        )}
        {task.jobDetails?.why&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Why</div>
            <div style={{fontSize:13,color:C.text}}>เพราะ{task.jobDetails.why}</div>
          </div>
        )}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>When</div>
          <div style={{fontSize:13,color:C.text}}>ส่งให้ฉันภายใน {fmtDateWithDay(task.deadline)}</div>
        </div>
        {steps.length>0&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>How</div>
            {steps.map((step,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:6}}>
                <div style={{width:22,height:22,borderRadius:11,background:`${C.blue}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.blue,flexShrink:0,marginTop:1}}>{i+1}</div>
                <div style={{fontSize:13,color:C.text,lineHeight:1.5,paddingTop:2}}>{step}</div>
              </div>
            ))}
          </div>
        )}
        {task.jobDetails?.obstacles&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>ถ้ามีอะไรติดขัด</div>
            <div style={{fontSize:13,color:C.text}}>{task.jobDetails.obstacles}</div>
          </div>
        )}
        {task.remarks&&(
          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`,fontSize:12,color:C.muted}}>หมายเหตุ: {task.remarks}</div>
        )}
      </div>
      <div style={{padding:"10px 16px",borderTop:`1px solid ${C.border}`,background:"#0d1117",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:11,color:C.muted}}>มอบหมายโดย: {aBy?.name||"เจ้าของ"}</div>
        <button onClick={()=>printDelegationSlip(task,data,role)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${C.border2}`,background:"none",color:C.muted,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:4}}>🖨️ พิมพ์</button>
      </div>
    </div>
  );
}

// Compact task table for non-owner view
function NonOwnerTaskTable({tasks,data,setData,role,isMobileMode}){
  const [slipModal,setSlipModal]=useState(null);
  const updateStatus=(id,status)=>setData(d=>({...d,tracking:d.tracking.map(t=>t.id===id?{...t,status,...((status==="completed"||status==="cancelled")&&!t.completedDate?{completedDate:new Date().toISOString().slice(0,10)}:{})}:t)}));
  return(
    <>
      <Card>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:380}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>
                <th style={{padding:"10px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>งาน</th>
                <th style={{padding:"10px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>กำหนดส่ง</th>
                <th style={{padding:"10px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>สถานะ</th>
                <th style={{padding:"10px 12px",textAlign:"center",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>ใบมอบหมาย</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task=>{
                const sc=getStatusColor(task.status);
                const hasDetails=task.jobDetails&&(task.jobDetails.what||task.jobDetails.why||(Array.isArray(task.jobDetails.how)&&task.jobDetails.how.length>0));
                const _dl=task.deadline&&task.status!=="completed"&&task.status!=="cancelled"?Math.ceil((new Date(task.deadline+"T23:59:59")-new Date())/86400000):999;
                const _dlColor=_dl<=0?C.red:_dl===1?C.orange:C.muted;
                const _dlLabel=_dl<0?` (เกิน ${Math.abs(_dl)} วัน!)`:_dl===0?" (วันนี้!)":_dl===1?" (พรุ่งนี้!)":"";
                return(
                  <tr key={task.id} style={{borderBottom:`1px solid ${C.border}`,background:_dl<=0?`${C.red}08`:_dl===1?`${C.orange}08`:"transparent"}}>
                    <td style={{padding:"10px 12px",fontSize:12,color:C.text}}>{task.taskName}</td>
                    <td style={{padding:"10px 12px",fontSize:11,color:_dlColor,fontWeight:_dl<=1?700:400,whiteSpace:"nowrap"}}>{fmtDateWithDay(task.deadline)}{_dlLabel}</td>
                    <td style={{padding:"10px 12px"}}>
                      <select value={task.status} onChange={e=>updateStatus(task.id,e.target.value)} style={{background:`${sc}22`,border:`1px solid ${sc}44`,borderRadius:6,color:sc,fontSize:11,fontWeight:600,padding:"3px 8px",cursor:"pointer",outline:"none"}}>
                        <option value="notstarted">😴 รอเริ่ม</option>
                        <option value="inprogress">⏳ กำลังทำ</option>
                        <option value="completed">✅ เสร็จแล้ว</option>
                        <option value="cancelled">❌ ยกเลิก</option>
                      </select>
                    </td>
                    <td style={{padding:"10px 12px",textAlign:"center"}}>
                      {hasDetails?(
                        <button onClick={()=>setSlipModal(task)} style={{padding:"4px 12px",borderRadius:6,border:`1px solid ${C.border2}`,background:"none",color:C.muted,cursor:"pointer",fontSize:11}}>📄 ดู</button>
                      ):<span style={{color:C.faint,fontSize:11}}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {slipModal&&(
        <Mdl title="📄 ใบมอบหมายงาน" onClose={()=>setSlipModal(null)} size="lg" footer={<><Btn variant="ghost" onClick={()=>setSlipModal(null)}>ปิด</Btn><Btn onClick={()=>printDelegationSlip(slipModal,data,role)}>🖨️ พิมพ์</Btn></>}>
          <DelegationSlipCard task={slipModal} data={data} role={role} isMobileMode={isMobileMode}/>
        </Mdl>
      )}
    </>
  );
}

// Returns true if task is completed/cancelled AND ref date is ≥ 7 days ago
function isArchived(task){
  if(task.status!=="completed"&&task.status!=="cancelled")return false;
  const ref=task.completedDate||task.deadline;
  if(!ref)return false;
  return(Date.now()-new Date(ref).getTime())>=7*86400000;
}

function TrackingPage({data,setData,role,isMobileMode,authedUserId,isOwner}) {
  const [selectedTeam,setSelectedTeam]=useState(null);
  const [showAddTask,setShowAddTask]=useState(false);
  const [showHistory,setShowHistory]=useState(false);
  const emptyTask=()=>({taskName:"",assignedTo:"",level:1,deadline:"",status:"notstarted",remarks:"",jobDetails:{what:"",why:"",when:"",how:[],obstacles:""}});
  const [newTask,setNewTask]=useState(emptyTask());

  // Use authedUserId passed from App (supports owner "view as")
  const currentUserId=authedUserId||(data.team.find(m=>m.role===role&&m.status==="active")?.id);
  const ownerView=isOwner&&role==="owner"; // true only when owner views in owner mode
  const [locLoading,setLocLoading]=useState(false);
  const [locLoading2,setLocLoading2]=useState(false);
  const [manualMode,setManualMode]=useState(false);
  const [manualAddr,setManualAddr]=useState("");
  const [locExpanded,setLocExpanded]=useState(false);
  const [histDetailTask,setHistDetailTask]=useState(null);
  const currentMemberObj=data.team.find(m=>m.id===currentUserId);

  const saveLocation=(lat,lng,address)=>{
    if(!currentUserId){return;}
    setData(d=>({...d,team:d.team.map(t=>t.id===currentUserId?{...t,location:{lat,lng,address,updatedAt:new Date().toISOString()}}:t)}));
  };

  // Auto-detect location silently on mount + every 5 minutes
  useEffect(()=>{
    if(!currentUserId||!navigator.geolocation)return;
    const detect=()=>{
      navigator.geolocation.getCurrentPosition(async pos=>{
        const lat=pos.coords.latitude,lng=pos.coords.longitude;
        let address=`${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try{
          const res=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,{headers:{"Accept-Language":"th"}});
          const json=await res.json();
          if(json.address){const a=json.address;address=[a.road||a.pedestrian,a.suburb||a.neighbourhood||a.village||a.town||a.city,a.county||a.state_district].filter(Boolean).join(", ")||json.display_name;}
        }catch(e){}
        saveLocation(lat,lng,address);
      },()=>{/* silent fail — user can still press button or type manually */},{enableHighAccuracy:true,timeout:8000});
    };
    detect(); // run immediately on mount
    const interval=setInterval(detect,5*60*1000); // refresh every 5 min
    return ()=>clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[currentUserId]);

  const doCheckIn2=()=>{
    if(!navigator.geolocation){
      setManualMode(true);return;
    }
    setLocLoading2(true);
    navigator.geolocation.getCurrentPosition(async pos=>{
      const lat=pos.coords.latitude,lng=pos.coords.longitude;
      let address=`${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try{
        const res=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,{headers:{"Accept-Language":"th"}});
        const json=await res.json();
        if(json.address){const a=json.address;address=[a.road||a.pedestrian,a.suburb||a.neighbourhood||a.village||a.town||a.city,a.county||a.state_district].filter(Boolean).join(", ")||json.display_name;}
      }catch(e){}
      saveLocation(lat,lng,address);
      setLocLoading2(false);
    },err=>{
      setLocLoading2(false);
      if(err.code===1){
        // Permission denied — switch to manual input
        setManualMode(true);
      } else if(err.code===2){
        alert("ไม่สามารถระบุตำแหน่งได้ (GPS ไม่มีสัญญาณ)\nลองเปิด Location ในโทรศัพท์ก่อน หรือกรอกที่อยู่เอง");
        setManualMode(true);
      } else {
        alert("GPS timeout — ลองใหม่หรือกรอกที่อยู่เอง");
        setManualMode(true);
      }
    },{enableHighAccuracy:true,timeout:10000});
  };

  // Permission filter: owner (in owner mode) sees all, others see only their tasks
  const visibleTasks=ownerView
    ?data.tracking
    :data.tracking.filter(t=>t.assignedTo===currentUserId||t.assignedBy===currentUserId);

  const activeTasks=data.tracking.filter(t=>t.status!=="completed"&&t.status!=="cancelled");
  const archivedAll=data.tracking.filter(t=>isArchived(t));

  const getTeamSummary=(teamId)=>{
    const tasks=data.tracking.filter(t=>t.assignedTo===teamId&&!isArchived(t));
    return {total:tasks.length,completed:tasks.filter(t=>t.status==="completed").length,inprogress:tasks.filter(t=>t.status==="inprogress").length,pending:tasks.filter(t=>t.status==="notstarted").length};
  };

  // ── Shared add-task modal (all roles) ──────────────────────
  const addTaskModal=showAddTask&&(
    <Mdl title="📋 มอบหมายงานใหม่" onClose={()=>{setShowAddTask(false);setNewTask(emptyTask());}} size="lg"
      footer={<>
        <Btn variant="ghost" onClick={()=>{setShowAddTask(false);setNewTask(emptyTask());}}>ยกเลิก</Btn>
        <Btn onClick={()=>{
          if(!newTask.taskName||!newTask.assignedTo||!newTask.deadline)return;
          const aId=+newTask.assignedTo;
          const lv=role==="owner"?+newTask.level:(data.employeeLevels[aId]||1);
          setData(d=>({...d,tracking:[...d.tracking,{id:uid(),...newTask,assignedTo:aId,assignedBy:currentUserId||1,level:lv,createdDate:new Date().toISOString().slice(0,10)}]}));
          setShowAddTask(false);setNewTask(emptyTask());
        }} disabled={!newTask.taskName||!newTask.assignedTo||!newTask.deadline}>✓ มอบหมาย</Btn>
      </>}
    >
      <DelegationForm task={newTask} setTask={setNewTask} data={data} role={role} isMobileMode={isMobileMode}/>
    </Mdl>
  );

  // ── Shared history modal (all roles) ───────────────────────
  const historyTasks=role==="owner"?archivedAll:archivedAll.filter(t=>t.assignedTo===currentUserId||t.assignedBy===currentUserId);
  const historyModal=showHistory&&(
    <Mdl title="📚 ประวัติงาน" onClose={()=>setShowHistory(false)} size="lg"
      footer={<Btn variant="ghost" onClick={()=>setShowHistory(false)}>ปิด</Btn>}
    >
      {historyTasks.length===0?(
        <div style={{textAlign:"center",padding:40,color:C.muted}}>ยังไม่มีประวัติงาน</div>
      ):(
        <div style={{display:"grid",gap:8}}>
          {historyTasks.map(task=>{
            const aTo=data.team.find(t=>t.id===task.assignedTo);
            const sc=getStatusColor(task.status);
            return(
              <div key={task.id} onClick={()=>setHistDetailTask(task)} style={{background:"#0d1117",borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",cursor:"pointer",transition:"background 0.15s"}} onMouseOver={e=>e.currentTarget.style.background="#161d2a"} onMouseOut={e=>e.currentTarget.style.background="#0d1117"}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.taskName}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>มอบให้: {aTo?.name||"-"} • กำหนด: {task.deadline}{task.completedDate?` • เสร็จ: ${task.completedDate}`:""}</div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                  <span style={{fontSize:10,color:C.muted}}>รายละเอียด ›</span>
                  <div style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",background:`${sc}22`,color:sc,borderRadius:6,fontSize:10,fontWeight:600,border:`1px solid ${sc}44`}}>
                    {STATUS_ICONS[task.status]} {task.status==="completed"?"เสร็จแล้ว":"ยกเลิก"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Mdl>
  );
  const histDetailModal=histDetailTask&&(
    <Mdl title="📄 รายละเอียดงาน" onClose={()=>setHistDetailTask(null)} size="lg"
      footer={<>
        <Btn variant="ghost" onClick={()=>setHistDetailTask(null)}>ปิด</Btn>
        <Btn onClick={()=>printDelegationSlip(histDetailTask,data,role)}>🖨️ พิมพ์ / ดาวน์โหลด</Btn>
      </>}
    >
      <DelegationSlipCard task={histDetailTask} data={data} role={role} isMobileMode={isMobileMode}/>
    </Mdl>
  );

  if(selectedTeam){
    return <TrackingDetailPage teamId={selectedTeam} data={data} setData={setData} role={role} onBack={()=>setSelectedTeam(null)} isMobileMode={isMobileMode} currentUserId={currentUserId} isOwner={isOwner}/>;
  }

  // ── Non-owner view (or owner viewing as someone) ────────────
  if(!ownerView){
    const myActive=visibleTasks.filter(t=>t.assignedTo===currentUserId&&!isArchived(t));
    const assignedByMeActive=visibleTasks.filter(t=>t.assignedBy===currentUserId&&t.assignedTo!==currentUserId&&!isArchived(t));
    const noActive=myActive.length===0&&assignedByMeActive.length===0;
    return(
      <div style={{padding:isMobileMode?12:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontSize:isMobileMode?18:24,fontWeight:700,color:C.text}}>📋 ติดตามงาน</div>
            <div style={{fontSize:isMobileMode?11:13,color:C.muted,marginTop:2}}>งานที่เกี่ยวข้องกับคุณ</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            {historyTasks.length>0&&<Btn size="sm" variant="ghost" onClick={()=>setShowHistory(true)}>📚 ประวัติ ({historyTasks.length})</Btn>}
            <Btn size="sm" onClick={()=>setShowAddTask(true)}>+ เพิ่มงาน</Btn>
          </div>
        </div>
        {/* GPS Check-in card */}
        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 16px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <Avatar member={currentMemberObj} size={40}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,color:C.text}}>{currentMemberObj?.name||"..."}  <span style={{fontWeight:400,color:C.muted,fontSize:10}}>({ROLE_LBL[role]})</span></div>
              {currentMemberObj?.location?.address?(
                <div style={{fontSize:11,color:C.green,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={currentMemberObj.location.address}>
                  📍 {currentMemberObj.location.address}
                </div>
              ):(
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>ยังไม่ได้เช็คอินตำแหน่ง</div>
              )}
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <Btn size="sm" variant={locLoading2?"ghost":"primary"} onClick={doCheckIn2} disabled={!!locLoading2}>
                {locLoading2?"⏳ กำลังดึง...":"📍 GPS"}
              </Btn>
              <Btn size="sm" variant="ghost" onClick={()=>{setManualMode(m=>!m);setManualAddr("");}}>
                ✏️ กรอกเอง
              </Btn>
            </div>
          </div>
          {manualMode&&(
            <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
              <div style={{fontSize:11,color:C.orange,marginBottom:6}}>⚠️ GPS ถูกบล็อก — กรอกที่อยู่ปัจจุบันของคุณ</div>
              <div style={{display:"flex",gap:6}}>
                <input
                  value={manualAddr}
                  onChange={e=>setManualAddr(e.target.value)}
                  placeholder="เช่น หน้างาน ม.บ้านใหม่ ต.หนองไผ่ อ.เมือง"
                  style={{flex:1,background:"#0d1117",border:`1px solid ${C.border2}`,borderRadius:8,padding:"7px 10px",color:C.text,fontSize:12,outline:"none"}}
                  onKeyDown={e=>{if(e.key==="Enter"&&manualAddr.trim()){saveLocation(null,null,manualAddr.trim());setManualMode(false);setManualAddr("");}}}
                />
                <Btn size="sm" onClick={()=>{if(!manualAddr.trim())return;saveLocation(null,null,manualAddr.trim());setManualMode(false);setManualAddr("");}} disabled={!manualAddr.trim()}>บันทึก</Btn>
                <Btn size="sm" variant="ghost" onClick={()=>{setManualMode(false);setManualAddr("");}}>✕</Btn>
              </div>
            </div>
          )}
        </div>
        {noActive&&(
          <Card style={{padding:40,textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:32,marginBottom:8}}>📋</div>
            <div style={{color:C.muted,fontSize:13}}>ไม่มีงานที่เกี่ยวข้องกับคุณในขณะนี้</div>
          </Card>
        )}
        {myActive.length>0&&(
          <div style={{marginBottom:24}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>📥 งานที่ได้รับมอบหมาย ({myActive.length})</div>
            <NonOwnerTaskTable tasks={myActive} data={data} setData={setData} role={role} isMobileMode={isMobileMode}/>
          </div>
        )}
        {assignedByMeActive.length>0&&(
          <div>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>📤 งานที่คุณมอบหมาย ({assignedByMeActive.length})</div>
            <NonOwnerTaskTable tasks={assignedByMeActive} data={data} setData={setData} role={role} isMobileMode={isMobileMode}/>
          </div>
        )}
        {addTaskModal}
        {historyModal}
        {histDetailModal}
      </div>
    );
  }

  // ── Owner view ──────────────────────────────────────────────
  const teamMembers=data.team.filter(t=>t.status==="active");

  const doCheckIn=(memberId)=>{
    if(!navigator.geolocation){alert("เบราว์เซอร์นี้ไม่รองรับ GPS");return;}
    setLocLoading(memberId);
    navigator.geolocation.getCurrentPosition(async pos=>{
      const lat=pos.coords.latitude,lng=pos.coords.longitude;
      let address=`${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try{
        const res=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=th`,{headers:{"Accept-Language":"th"}});
        const json=await res.json();
        if(json.address){
          const a=json.address;
          address=[a.road||a.pedestrian,a.suburb||a.neighbourhood||a.village||a.town||a.city,a.county||a.state_district].filter(Boolean).join(", ")||json.display_name;
        }
      }catch(e){/* use coords as fallback */}
      setData(d=>({...d,team:d.team.map(t=>t.id===memberId?{...t,location:{lat,lng,address,updatedAt:new Date().toISOString()}}:t)}));
      setLocLoading(false);
    },err=>{
      if(err.code===1) alert("ไม่ได้รับอนุญาต GPS\nไปที่ Settings > Privacy > Location ในเบราว์เซอร์แล้วอนุญาตก่อน");
      else if(err.code===2) alert("ไม่พบสัญญาณ GPS — ลองเปิด Location ในโทรศัพท์ก่อน");
      else alert("GPS timeout — ลองใหม่อีกครั้ง");
      setLocLoading(false);
    },{enableHighAccuracy:true,timeout:10000});
  };

  return (
    <div style={{padding:isMobileMode?12:24}}>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:isMobileMode?18:24,fontWeight:700,color:C.text}}>📋 ติดตามงาน</div>
        <div style={{fontSize:isMobileMode?11:13,color:C.muted,marginTop:2}}>ดูภาพรวมงานที่มอบหมายให้ทุกคนในทีม</div>
      </div>

      {/* ── Location overview strip ── */}
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,marginBottom:16,overflow:"hidden",transition:"box-shadow 0.2s",...(locExpanded?{boxShadow:"0 4px 24px rgba(59,130,246,0.12)"}:{})}}>
        {/* Header row — always visible, click to toggle */}
        <div onClick={()=>setLocExpanded(e=>!e)} style={{padding:"11px 16px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",userSelect:"none"}}>
          <span style={{fontSize:13}}>📍</span>
          <span style={{fontSize:12,fontWeight:700,color:C.text}}>ตำแหน่งล่าสุดของทีม</span>
          {/* live dots preview */}
          <div style={{display:"flex",gap:4,marginLeft:4}}>
            {teamMembers.slice(0,5).map(m=>{
              const ago=m.location?.updatedAt?Math.floor((Date.now()-new Date(m.location.updatedAt).getTime())/60000):null;
              return <div key={m.id} style={{width:7,height:7,borderRadius:"50%",background:ago!==null&&ago<60?C.green:"#374151",transition:"background 0.3s"}}/>;
            })}
          </div>
          <span style={{marginLeft:"auto",fontSize:11,color:C.muted,fontWeight:400}}>
            {teamMembers.filter(m=>m.location?.address).length}/{teamMembers.length} ออนไลน์
          </span>
          {/* Chevron */}
          <span style={{fontSize:12,color:C.muted,transition:"transform 0.3s",transform:locExpanded?"rotate(180deg)":"rotate(0deg)",display:"inline-block"}}>▾</span>
        </div>

        {/* Expandable body */}
        <div style={{
          maxHeight:locExpanded?800:0,
          overflow:"hidden",
          transition:"max-height 0.4s cubic-bezier(0.4,0,0.2,1)",
        }}>
          <div style={{padding:"0 16px 16px",display:"grid",gridTemplateColumns:isMobileMode?"1fr 1fr":"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
            {teamMembers.map(member=>{
              const hasLoc=!!member.location?.address;
              const updatedAt=member.location?.updatedAt?new Date(member.location.updatedAt):null;
              const minutesAgo=updatedAt?Math.floor((Date.now()-updatedAt.getTime())/60000):null;
              const isRecent=minutesAgo!==null&&minutesAgo<60;
              const timeLabel=minutesAgo===null?"ยังไม่ได้เช็คอิน":minutesAgo<60?`${minutesAgo} นาทีที่แล้ว`:minutesAgo<1440?`${Math.floor(minutesAgo/60)} ชม. ที่แล้ว`:updatedAt.toLocaleDateString("th-TH");
              return(
                <div key={member.id} style={{
                  background:"#0d1117",
                  borderRadius:10,
                  padding:"10px 12px",
                  border:`1px solid ${isRecent?C.green+"44":C.border}`,
                  display:"flex",
                  gap:10,
                  alignItems:"center",
                  transition:"border-color 0.3s",
                }}>
                  <div style={{position:"relative",flexShrink:0}}>
                    <Avatar member={member} size={36} fontSize={14}/>
                    <div style={{position:"absolute",bottom:-1,right:-1,width:10,height:10,borderRadius:5,background:isRecent?C.green:"#374151",border:`2px solid #0d1117`,transition:"background 0.3s"}}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{member.name.split(" ")[0]}</div>
                    {hasLoc?(
                      <div style={{fontSize:10,color:C.green,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={member.location.address}>
                        {member.location.address}
                      </div>
                    ):(
                      <div style={{fontSize:10,color:C.muted}}>ยังไม่ทราบตำแหน่ง</div>
                    )}
                    <div style={{fontSize:9,color:C.muted,marginTop:1}}>{timeLabel}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"repeat(auto-fit,minmax(240px,1fr))",gap:12,marginBottom:20}}>
        {teamMembers.map(member=>{
          const s=getTeamSummary(member.id);
          const activeMemberTasks=data.tracking.filter(t=>t.assignedTo===member.id&&!isArchived(t)&&t.status!=="completed"&&t.status!=="cancelled");
          const showTasks=activeMemberTasks.slice(0,3);
          const overflowCount=activeMemberTasks.length-showTasks.length;
          return(
            <div key={member.id} onClick={()=>setSelectedTeam(member.id)} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:16,cursor:"pointer",transition:"all 0.2s",position:"relative"}}>
              {/* Header: avatar + name */}
              <div style={{display:"flex",alignItems:"center",marginBottom:12,gap:10}}>
                <Avatar member={member} size={42}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,color:C.text,fontSize:13,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{member.name}</div>
                  <div style={{fontSize:10,color:ROLE_COL[member.role]||C.muted,marginTop:2,fontWeight:600}}>{ROLE_LBL[member.role]}</div>
                </div>
                <div style={{width:8,height:8,borderRadius:"50%",background:s.inprogress>0?C.green:"#374151",flexShrink:0}} title={s.inprogress>0?"มีงานกำลังทำ":"ไม่มีงาน"}/>
              </div>
              {/* Stat boxes */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:activeMemberTasks.length>0?10:0}}>
                <div style={{background:"#0d1117",borderRadius:7,padding:"7px 4px",textAlign:"center",borderTop:`2px solid ${C.orange}`}}>
                  <div style={{fontSize:16,fontWeight:700,color:C.orange}}>{s.inprogress}</div>
                  <div style={{fontSize:9,color:C.muted,marginTop:1}}>กำลังทำ</div>
                </div>
                <div style={{background:"#0d1117",borderRadius:7,padding:"7px 4px",textAlign:"center",borderTop:`2px solid ${C.blue}`}}>
                  <div style={{fontSize:16,fontWeight:700,color:C.blue}}>{s.pending}</div>
                  <div style={{fontSize:9,color:C.muted,marginTop:1}}>รอทำ</div>
                </div>
                <div style={{background:"#0d1117",borderRadius:7,padding:"7px 4px",textAlign:"center",borderTop:`2px solid ${C.green}`}}>
                  <div style={{fontSize:16,fontWeight:700,color:C.green}}>{s.completed}</div>
                  <div style={{fontSize:9,color:C.muted,marginTop:1}}>เสร็จแล้ว</div>
                </div>
              </div>
              {/* Active task pills */}
              {activeMemberTasks.length>0&&(
                <div style={{borderTop:`1px solid ${C.border}`,paddingTop:8}}>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {showTasks.map(task=>{
                      const sc=task.status==="inprogress"?C.orange:C.blue;
                      const icon=task.status==="inprogress"?"⏳":"😴";
                      const lvlColor=["","#94a3b8","#38bdf8","#f59e0b","#f87171","#c084fc"][task.level]||C.muted;
                      const _dlPill=task.deadline&&task.status!=="completed"&&task.status!=="cancelled"?Math.ceil((new Date(task.deadline+"T23:59:59")-new Date())/86400000):999;
                      const _pillBorder=_dlPill<=0?C.red:_dlPill===1?C.orange:sc;
                      return(
                        <div key={task.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",background:_dlPill<=0?`${C.red}11`:_dlPill===1?`${C.orange}11`:"#0d1117",borderRadius:6,borderLeft:`2px solid ${_pillBorder}`}}>
                          <span style={{fontSize:10}}>{_dlPill<=0?"🔴":_dlPill===1?"🟠":icon}</span>
                          <span style={{flex:1,fontSize:11,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.taskName}</span>
                          {_dlPill<=1?<span style={{fontSize:9,color:_dlPill<=0?C.red:C.orange,fontWeight:700,flexShrink:0}}>{_dlPill<=0?(_dlPill===0?"วันนี้!":`เกิน${Math.abs(_dlPill)}วัน`):"พรุ่งนี้"}</span>:<span style={{fontSize:9,color:lvlColor,fontWeight:700,flexShrink:0}}>L{task.level}</span>}
                        </div>
                      );
                    })}
                    {overflowCount>0&&<div style={{fontSize:10,color:C.muted,textAlign:"center",paddingTop:2}}>+{overflowCount} งานอื่น...</div>}
                  </div>
                </div>
              )}
              {activeMemberTasks.length===0&&s.total===0&&(
                <div style={{textAlign:"center",color:C.muted,fontSize:11,paddingTop:4}}>ไม่มีงานที่รับผิดชอบ</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text}}>มอบหมายงานใหม่</div>
        <div style={{display:"flex",gap:8}}>
          {archivedAll.length>0&&<Btn size="sm" variant="ghost" onClick={()=>setShowHistory(true)}>📚 ประวัติ ({archivedAll.length})</Btn>}
          <Btn size="sm" onClick={()=>setShowAddTask(true)}>+ เพิ่มงาน</Btn>
        </div>
      </div>

      <div style={{marginTop:20}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>📊 สรุปงานทั้งหมด</div>
        <Card style={{padding:16}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
            <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:C.orange}}>{activeTasks.filter(t=>t.status==="inprogress").length}</div><div style={{fontSize:11,color:C.muted,marginTop:4}}>⏳ กำลังทำ</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:C.blue}}>{activeTasks.filter(t=>t.status==="notstarted").length}</div><div style={{fontSize:11,color:C.muted,marginTop:4}}>😴 รอเริ่ม</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:C.green}}>{data.tracking.filter(t=>t.status==="completed"&&!isArchived(t)).length}</div><div style={{fontSize:11,color:C.muted,marginTop:4}}>✅ เสร็จแล้ว</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:C.muted}}>{archivedAll.length}</div><div style={{fontSize:11,color:C.muted,marginTop:4}}>📚 ในประวัติ</div></div>
          </div>
        </Card>
      </div>
      {addTaskModal}
      {historyModal}
      {histDetailModal}
    </div>
  );
}

function TrackingDetailPage({teamId,data,setData,role,onBack,isMobileMode,currentUserId}) {
  const [activeTab,setActiveTab]=useState("tasks");
  const [editModal,setEditModal]=useState(null);
  const [slipModal,setSlipModal]=useState(null);
  const [showHistory,setShowHistory]=useState(false);

  const team=data.team.find(t=>t.id===teamId);
  const allTasks=data.tracking.filter(t=>t.assignedTo===teamId);
  const tasks=allTasks.filter(t=>!isArchived(t));
  const archivedTasks=allTasks.filter(t=>isArchived(t));
  const completed=tasks.filter(t=>t.status==="completed").length;
  const inprogress=tasks.filter(t=>t.status==="inprogress").length;
  const detailedTasks=tasks.filter(t=>t.jobDetails&&(t.jobDetails.what||t.jobDetails.why||(Array.isArray(t.jobDetails.how)&&t.jobDetails.how.length>0)));

  if(!team)return null;

  const canManage=(task)=>role==="owner"||task.assignedBy===currentUserId||task.assignedTo===currentUserId;

  const handleUpdateTask=(taskId,updates)=>{
    const withDate={...updates};
    if((updates.status==="completed"||updates.status==="cancelled")&&!updates.completedDate){
      withDate.completedDate=new Date().toISOString().slice(0,10);
    }
    setData(d=>({...d,tracking:d.tracking.map(t=>t.id===taskId?{...t,...withDate}:t)}));
  };
  const handleDeleteTask=(taskId)=>{
    if(!window.confirm("ลบงานนี้?"))return;
    setData(d=>({...d,tracking:d.tracking.filter(t=>t.id!==taskId)}));
  };
  const openEdit=(task,type)=>{
    const normalized={...task,_type:type,jobDetails:{...task.jobDetails,how:Array.isArray(task.jobDetails?.how)?task.jobDetails.how:(task.jobDetails?.how?[task.jobDetails.how]:[]) }};
    setEditModal(normalized);
  };

  return (
    <div style={{padding:isMobileMode?12:24}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.muted,fontSize:18,cursor:"pointer",padding:"6px 10px"}}>← ย้อนกลับ</button>
        <div style={{flex:1}}>
          <div style={{fontSize:isMobileMode?18:20,fontWeight:700,color:C.text}}>{team.name}</div>
          <div style={{fontSize:isMobileMode?10:11,color:C.muted,marginTop:2}}>{ROLE_LBL[team.role]} • งานปัจจุบัน {tasks.length} งาน</div>
        </div>
        {archivedTasks.length>0&&(
          <Btn size="sm" variant="ghost" onClick={()=>setShowHistory(true)}>📚 ประวัติ ({archivedTasks.length})</Btn>
        )}
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        <Card style={{padding:14,textAlign:"center"}}><div style={{fontSize:24,fontWeight:700,color:C.blue,marginBottom:4}}>{tasks.length}</div><div style={{fontSize:10,color:C.muted}}>ทั้งหมด</div></Card>
        <Card style={{padding:14,textAlign:"center"}}><div style={{fontSize:24,fontWeight:700,color:C.orange,marginBottom:4}}>{inprogress}</div><div style={{fontSize:10,color:C.muted}}>⏳ กำลังทำ</div></Card>
        <Card style={{padding:14,textAlign:"center"}}><div style={{fontSize:24,fontWeight:700,color:C.green,marginBottom:4}}>{completed}</div><div style={{fontSize:10,color:C.muted}}>✅ เสร็จ</div></Card>
        <Card style={{padding:14,textAlign:"center"}}><div style={{fontSize:24,fontWeight:700,color:C.muted,marginBottom:4}}>{Math.round((completed/(tasks.length||1))*100)}%</div><div style={{fontSize:10,color:C.muted}}>คืบหน้า</div></Card>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:`1px solid ${C.border}`}}>
        {[{id:"tasks",label:"📋 งาน"},{id:"details",label:"📄 รายละเอียดงาน"}].map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{padding:"10px 18px",border:"none",background:"none",color:activeTab===tab.id?C.blue:C.muted,fontWeight:activeTab===tab.id?700:400,fontSize:13,cursor:"pointer",borderBottom:activeTab===tab.id?`2px solid ${C.blue}`:"2px solid transparent",marginBottom:-1,transition:"all 0.15s"}}>
            {tab.label}
            {tab.id==="details"&&detailedTasks.length>0&&<span style={{marginLeft:6,background:`${C.blue}33`,color:C.blue,borderRadius:10,fontSize:10,padding:"1px 7px",fontWeight:700}}>{detailedTasks.length}</span>}
          </button>
        ))}
      </div>

      {/* Tab: งาน */}
      {activeTab==="tasks"&&(
        <Card>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:isMobileMode?400:560}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>
                  <th style={{padding:isMobileMode?"10px 8px":"12px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}># งาน</th>
                  {role==="owner"&&<th style={{padding:isMobileMode?"10px 8px":"12px 14px",textAlign:"center",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>ระดับ</th>}
                  <th style={{padding:isMobileMode?"10px 8px":"12px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>กำหนดส่ง</th>
                  <th style={{padding:isMobileMode?"10px 8px":"12px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>สถานะ</th>
                  <th style={{padding:isMobileMode?"10px 8px":"12px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>หมายเหตุ</th>
                  <th style={{padding:isMobileMode?"10px 8px":"12px 14px",textAlign:"center",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length===0?(
                  <tr><td colSpan="6" style={{padding:"20px",textAlign:"center",color:C.muted}}>ไม่มีงานที่มอบหมาย</td></tr>
                ):tasks.map(task=>{
                  const sc=getStatusColor(task.status);
                  const hasDetails=task.jobDetails&&(task.jobDetails.what||task.jobDetails.why||(Array.isArray(task.jobDetails.how)&&task.jobDetails.how.length>0));
                  const can=canManage(task);
                  const _dl2=task.deadline&&task.status!=="completed"&&task.status!=="cancelled"?Math.ceil((new Date(task.deadline+"T23:59:59")-new Date())/86400000):999;
                  const _dlColor2=_dl2<=0?C.red:_dl2===1?C.orange:C.muted;
                  const _dlLabel2=_dl2<0?` (เกิน ${Math.abs(_dl2)} วัน!)`:_dl2===0?" (วันนี้!)":_dl2===1?" (พรุ่งนี้!)":"";
                  return(
                    <tr key={task.id} style={{borderBottom:`1px solid ${C.border}`,background:_dl2<=0?`${C.red}08`:_dl2===1?`${C.orange}08`:"transparent"}}>
                      <td style={{padding:isMobileMode?"10px 8px":"12px 14px",fontSize:12,color:C.text,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={task.taskName}>{task.taskName}</td>
                      {role==="owner"&&<td style={{padding:isMobileMode?"10px 8px":"12px 14px",textAlign:"center"}}><Tag color="blue"><span style={{fontWeight:700}}>L{task.level}</span></Tag></td>}
                      <td style={{padding:isMobileMode?"10px 8px":"12px 14px",fontSize:11,color:_dlColor2,fontWeight:_dl2<=1?700:400,whiteSpace:"nowrap"}}>{fmtDateWithDay(task.deadline)}{_dlLabel2}</td>
                      <td style={{padding:isMobileMode?"10px 8px":"12px 14px"}} onClick={can?()=>openEdit(task,"status"):undefined}>
                        <div style={{cursor:can?"pointer":"default",display:"inline-flex",alignItems:"center",gap:4,padding:"4px 8px",background:`${sc}22`,color:sc,borderRadius:6,fontSize:11,fontWeight:600,border:`1px solid ${sc}44`}}>
                          {STATUS_ICONS[task.status]} {task.status==="inprogress"?"กำลังทำ":task.status==="notstarted"?"รอเริ่ม":task.status==="completed"?"เสร็จแล้ว":"ยกเลิก"}
                        </div>
                      </td>
                      <td style={{padding:isMobileMode?"10px 8px":"12px 14px",fontSize:11,color:C.muted,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={task.remarks}>{task.remarks||"—"}</td>
                      <td style={{padding:isMobileMode?"10px 8px":"12px 14px",textAlign:"center"}}>
                        <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                          {hasDetails&&<button onClick={()=>setSlipModal(task)} style={{width:28,height:28,borderRadius:4,border:`1px solid ${C.border2}`,background:"none",color:C.muted,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}} title="ดูใบมอบหมาย">📄</button>}
                          {can&&<button onClick={()=>openEdit(task,"all")} style={{width:28,height:28,borderRadius:4,border:`1px solid ${C.border2}`,background:"none",color:C.muted,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}} title="แก้ไข">✏️</button>}
                          {can&&<button onClick={()=>handleDeleteTask(task.id)} style={{width:28,height:28,borderRadius:4,border:`1px solid ${C.border2}`,background:"none",color:C.muted,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}} title="ลบ">🗑</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab: รายละเอียดงาน */}
      {activeTab==="details"&&(
        <div>
          {detailedTasks.length===0?(
            <Card style={{padding:40,textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:8}}>📄</div>
              <div style={{color:C.muted,fontSize:13}}>ยังไม่มีงานที่กรอกรายละเอียด What/Why/How</div>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>ไปที่แท็บ "งาน" และกด ✏️ เพื่อเพิ่มรายละเอียด</div>
            </Card>
          ):(
            <div style={{display:"grid",gap:16}}>
              {detailedTasks.map(task=>(
                <DelegationSlipCard key={task.id} task={task} data={data} role={role} isMobileMode={isMobileMode}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Slip Modal */}
      {slipModal&&(
        <Mdl title="📄 ใบมอบหมายงาน" onClose={()=>setSlipModal(null)} size="lg"
          footer={<><Btn variant="ghost" onClick={()=>setSlipModal(null)}>ปิด</Btn><Btn onClick={()=>printDelegationSlip(slipModal,data,role)}>🖨️ พิมพ์ / ดาวน์โหลด</Btn></>}
        >
          <DelegationSlipCard task={slipModal} data={data} role={role} isMobileMode={isMobileMode}/>
        </Mdl>
      )}

      {/* History Modal */}
      {showHistory&&(
        <Mdl title={`📚 ประวัติงาน — ${team.name}`} onClose={()=>setShowHistory(false)} size="lg"
          footer={<Btn variant="ghost" onClick={()=>setShowHistory(false)}>ปิด</Btn>}
        >
          {archivedTasks.length===0?(
            <div style={{textAlign:"center",padding:40,color:C.muted}}>ยังไม่มีประวัติงาน</div>
          ):(
            <div style={{display:"grid",gap:8}}>
              {archivedTasks.map(task=>{
                const sc=getStatusColor(task.status);
                return(
                  <div key={task.id} onClick={()=>setSlipModal(task)} style={{background:"#0d1117",borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",cursor:"pointer",transition:"background 0.15s"}} onMouseOver={e=>e.currentTarget.style.background="#161d2a"} onMouseOut={e=>e.currentTarget.style.background="#0d1117"}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.taskName}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:2}}>กำหนด: {task.deadline}{task.completedDate?` • เสร็จ: ${task.completedDate}`:""}</div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                      <span style={{fontSize:10,color:C.muted}}>รายละเอียด ›</span>
                      <div style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",background:`${sc}22`,color:sc,borderRadius:6,fontSize:10,fontWeight:600,border:`1px solid ${sc}44`}}>
                        {STATUS_ICONS[task.status]} {task.status==="completed"?"เสร็จแล้ว":"ยกเลิก"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Mdl>
      )}

      {/* Edit Modal */}
      {editModal&&(
        <Mdl title={editModal._type==="status"?"เปลี่ยนสถานะ":"✏️ แก้ไขงาน"} onClose={()=>setEditModal(null)} size="lg"
          footer={<><Btn variant="ghost" onClick={()=>setEditModal(null)}>ยกเลิก</Btn><Btn onClick={()=>{const{_type,...task}=editModal;handleUpdateTask(task.id,task);setEditModal(null);}}>✓ บันทึก</Btn></>}
        >
          {editModal._type==="status"?(
            <FG label="สถานะ">
              <FSel value={editModal.status} onChange={e=>setEditModal(t=>({...t,status:e.target.value}))}>
                <option value="notstarted">😴 ยังไม่เริ่ม</option>
                <option value="inprogress">⏳ กำลังทำ</option>
                <option value="completed">✅ เสร็จแล้ว</option>
                <option value="cancelled">❌ ยกเลิก</option>
              </FSel>
            </FG>
          ):(
            <DelegationForm task={editModal} setTask={setEditModal} data={data} role={role} isMobileMode={isMobileMode}/>
          )}
        </Mdl>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// END OF PART 8.5
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// END OF PART 8
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// PART 9: Main App Component & Export
// ═══════════════════════════════════════════════════════════════

// localStorage helpers
const STORAGE_KEY="thecrown_data";
const STORAGE_ROLE="thecrown_role";
function loadData(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed=JSON.parse(raw);
      const merged={...INIT,...parsed};
      // Always base team on INIT ids; merge saved mutable fields (avatar, password, location, pendingPassword)
      // Also keep any pending-registration members from saved data
      const savedById={};
      (parsed.team||[]).forEach(m=>{savedById[m.id]=m;});
      const baseTeam=INIT.team.map(m=>{
        const saved=savedById[m.id]||{};
        return {...m,
          name:saved.name||m.name,
          email:saved.email||m.email,
          phone:saved.phone||m.phone,
          avatar:saved.avatar||m.avatar,
          password:saved.password||m.password,
          location:saved.location||m.location,
          pendingPassword:saved.pendingPassword||null,
          pendingPasswordAt:saved.pendingPasswordAt||null,
        };
      });
      // Add pending registration members (status==='pending') from saved data
      const pendingNew=(parsed.team||[]).filter(m=>m.status==="pending"&&!INIT.team.find(b=>b.id===m.id));
      merged.team=[...baseTeam,...pendingNew];
      return merged;
    }
  }catch(e){console.warn("Failed to load saved data",e);}
  return INIT;
}
function saveData(d){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}
  catch(e){console.warn("Failed to save data",e);}
}
function loadRole(){
  try{return localStorage.getItem(STORAGE_ROLE)||"owner";}
  catch(e){return"owner";}
}

export default function App() {
  const [data,setData]=useState(()=>loadData());
  const [role,setRole]=useState(()=>loadRole());
  const [page,setPage]=useState("dash");
  const [openId,setOpenId]=useState(null);
  const [isMobileMode,setIsMobileMode]=useState(()=>window.innerWidth<768);
  const [sidebarOpen,setSidebarOpen]=useState(false);

  // Auto-detect mobile on resize
  useEffect(()=>{
    const onResize=()=>setIsMobileMode(window.innerWidth<768);
    window.addEventListener("resize",onResize);
    return()=>window.removeEventListener("resize",onResize);
  },[]);

  // ── Auth state ─────────────────────────────────────────────
  const [loggedIn,setLoggedIn]=useState(()=>{try{return JSON.parse(localStorage.getItem("cpms_loggedin")||"false");}catch(e){return false;}});
  const [authedUserId,setAuthedUserId]=useState(()=>{try{return JSON.parse(localStorage.getItem("cpms_authed_uid")||"null");}catch(e){return null;}});
  const [viewAsId,setViewAsId]=useState(null); // owner can "view as" an employee
  const [showChangePw,setShowChangePw]=useState(false);
  const [changePwForm,setChangePwForm]=useState({newPw:"",confirm:"",showNew:false,showConfirm:false,err:"",sent:false});

  // Auto-save data to localStorage
  useEffect(()=>{saveData(data);},[data]);
  useEffect(()=>{try{localStorage.setItem(STORAGE_ROLE,role);}catch(e){}},[role]);
  useEffect(()=>{try{localStorage.setItem("cpms_loggedin",JSON.stringify(loggedIn));}catch(e){}},[loggedIn]);
  useEffect(()=>{try{localStorage.setItem("cpms_authed_uid",JSON.stringify(authedUserId));}catch(e){}},[authedUserId]);

  function handleLogin(memberId,memberRole){
    setLoggedIn(true);
    setAuthedUserId(memberId);
    setRole(memberRole);
    setViewAsId(null);
    setPage(memberRole==="marketing"?"marketing":"dash");
  }
  function handleLogout(){
    setLoggedIn(false);setAuthedUserId(null);setViewAsId(null);
    try{localStorage.removeItem("cpms_loggedin");localStorage.removeItem("cpms_authed_uid");}catch(e){}
  }

  const realRole=role; // current role context (may differ if owner viewing as someone)
  const effectiveUserId=viewAsId||authedUserId; // the user ID for task filtering
  const authedMember=data.team.find(m=>m.id===authedUserId);
  const isOwner=authedMember?.role==="owner";

  function handleRole(r){setRole(r);setOpenId(null);setPage(r==="marketing"?"marketing":"dash");}
  function handleOpen(h){setOpenId(h.id);setPage("house");}
  function handleBack(){setOpenId(null);setPage("dash");}
  function handleSetPage(p){setPage(p);setOpenId(null);setSidebarOpen(false);}

  // Sync browser history with page/openId state
  useEffect(()=>{
    const state={page,openId};
    const hash=`#${page}${openId?"/"+openId:""}`;
    history.pushState(state,"",hash);
  },[page,openId]);
  useEffect(()=>{
    const fn=e=>{
      if(e.state&&e.state.page){setPage(e.state.page);setOpenId(e.state.openId||null);}
    };
    window.addEventListener("popstate",fn);
    return()=>window.removeEventListener("popstate",fn);
  },[]);

  // If not logged in, show LoginPage
  if(!loggedIn){
    return(<><style>{GS}</style><LoginPage data={data} onLogin={handleLogin}/></>);
  }

  const handleRequestChangePw=()=>{
    const f=changePwForm;
    if(!f.newPw||!f.confirm){setChangePwForm(v=>({...v,err:"กรุณากรอกรหัสผ่านใหม่ทั้งสองช่อง"}));return;}
    if(f.newPw.length<4){setChangePwForm(v=>({...v,err:"รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร"}));return;}
    if(f.newPw!==f.confirm){setChangePwForm(v=>({...v,err:"รหัสผ่านไม่ตรงกัน"}));return;}
    // Store pending password change
    setData(d=>({...d,team:d.team.map(t=>t.id===authedUserId?{...t,pendingPassword:f.newPw,pendingPasswordAt:new Date().toISOString()}:t)}));
    // Send email to owner
    const member=data.team.find(m=>m.id===authedUserId);
    const subject=encodeURIComponent(`[CPMS] ขอเปลี่ยนรหัสผ่าน - ${member?.name||""}`);
    const body=encodeURIComponent(
      `มีคำขอเปลี่ยนรหัสผ่านในระบบ CPMS\n\n`+
      `ผู้ขอ: ${member?.name||""}\nUsername: ${member?.username||""}\nตำแหน่ง: ${ROLE_LBL[member?.role||""]}\n`+
      `วันที่ขอ: ${new Date().toLocaleString("th-TH")}\n\n`+
      `กรุณาเข้าสู่ระบบในฐานะ owner แล้วไปที่ ตั้งค่า → ทีมงาน เพื่ออนุมัติการเปลี่ยนรหัสผ่าน`
    );
    try{window.open(`mailto:${OWNER_EMAIL}?subject=${subject}&body=${body}`);}catch(e){}
    setChangePwForm(v=>({...v,err:"",sent:true}));
  };

  const changePwModal=showChangePw&&(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={e=>{if(e.target===e.currentTarget){setShowChangePw(false);setChangePwForm({newPw:"",confirm:"",showNew:false,showConfirm:false,err:"",sent:false});}}}>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:28,width:"100%",maxWidth:360}}>
        <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:16}}>🔑 ขอเปลี่ยนรหัสผ่าน</div>
        {changePwForm.sent?(
          <>
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{fontSize:40,marginBottom:10}}>📨</div>
              <div style={{fontSize:13,color:C.text,fontWeight:600,marginBottom:6}}>ส่งคำขอสำเร็จ</div>
              <div style={{fontSize:12,color:C.muted,lineHeight:1.7}}>ระบบเปิดอีเมลแจ้งเจ้าของโครงการแล้ว<br/>รอการอนุมัติจาก <span style={{color:C.blue}}>{OWNER_EMAIL}</span></div>
            </div>
            <Btn onClick={()=>{setShowChangePw(false);setChangePwForm({newPw:"",confirm:"",showNew:false,showConfirm:false,err:"",sent:false});}} style={{width:"100%",justifyContent:"center"}}>ปิด</Btn>
          </>
        ):(
          <>
            <FG label="รหัสผ่านใหม่ (≥4 ตัว)">
              <div style={{position:"relative"}}>
                <FIn type={changePwForm.showNew?"text":"password"} value={changePwForm.newPw} onChange={e=>setChangePwForm(v=>({...v,newPw:e.target.value,err:""}))} placeholder="รหัสผ่านใหม่"/>
                <button type="button" onClick={()=>setChangePwForm(v=>({...v,showNew:!v.showNew}))} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:14,padding:0}}>{changePwForm.showNew?"🙈":"👁️"}</button>
              </div>
            </FG>
            <FG label="ยืนยันรหัสผ่านใหม่">
              <div style={{position:"relative"}}>
                <FIn type={changePwForm.showConfirm?"text":"password"} value={changePwForm.confirm} onChange={e=>setChangePwForm(v=>({...v,confirm:e.target.value,err:""}))} placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"/>
                <button type="button" onClick={()=>setChangePwForm(v=>({...v,showConfirm:!v.showConfirm}))} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:14,padding:0}}>{changePwForm.showConfirm?"🙈":"👁️"}</button>
              </div>
            </FG>
            {changePwForm.err&&<div style={{background:`${C.red}22`,border:`1px solid ${C.red}44`,borderRadius:8,padding:"8px 12px",color:"#fca5a5",fontSize:12,marginBottom:12}}>{changePwForm.err}</div>}
            <div style={{background:`${C.orange}11`,border:`1px solid ${C.orange}33`,borderRadius:8,padding:"8px 12px",fontSize:11,color:C.orange,marginBottom:14}}>
              ⚠️ รหัสผ่านจะเปลี่ยนได้เมื่อเจ้าของโครงการอนุมัติทางอีเมล <span style={{color:C.blue}}>{OWNER_EMAIL}</span> เท่านั้น
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn variant="ghost" onClick={()=>{setShowChangePw(false);setChangePwForm({newPw:"",confirm:"",showNew:false,showConfirm:false,err:"",sent:false});}} style={{flex:1,justifyContent:"center"}}>ยกเลิก</Btn>
              <Btn onClick={handleRequestChangePw} style={{flex:2,justifyContent:"center"}}>📨 ส่งคำขอ</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const topTitle=openId?`บ้าน ${data.houses.find(h=>h.id===openId)?.name||""}`:({dash:"Dashboard",finance:"💹 Financial Dashboard",purchase:role==="engineer"?"อนุมัติคำสั่งซื้อ":"รายการจัดซื้อ",payments:"💰 Payments",analytics:"📊 Analytics",team:"👥 Team",tracking:"📋 ติดตามงาน",marketing:"การตลาด",settings:"ตั้งค่า"}[page]||"");

  // Compute unviewed notif count for mobile sidebar badge
  const allNotifItems=[
    ...data.phaseMessages.filter(msg=>!data.messageViewed?.[msg.id]),
    ...data.houses.flatMap(h=>data.phases.filter(p=>data.phaseProgress[h.id]?.[p.id]?.s==="waiting_review").map(p=>({id:`waiting-${h.id}-${p.id}`}))),
    ...data.requests.filter(r=>r.status==="pending").map(r=>({id:`order-${r.id}`})),
  ];
  const mobileUnviewedCount=allNotifItems.filter(n=>!data.notificationViewed?.[n.id]).length;

  // Bottom nav items per role (max 5 slots)
  const bottomNavByRole={
    owner:[{id:"dash",icon:"⊞",label:"Dashboard"},{id:"tracking",icon:"📋",label:"ติดตาม"},{id:"analytics",icon:"📊",label:"วิเคราะห์"},{id:"team",icon:"👥",label:"ทีม"},{id:"settings",icon:"⚙️",label:"ตั้งค่า"}],
    engineer:[{id:"dash",icon:"⊞",label:"บ้าน"},{id:"tracking",icon:"📋",label:"ติดตาม"},{id:"team",icon:"👥",label:"ทีม"},{id:"analytics",icon:"📊",label:"วิเคราะห์"},{id:"settings",icon:"⚙️",label:"ตั้งค่า"}],
    foreman:[{id:"dash",icon:"⊞",label:"บ้าน"},{id:"tracking",icon:"📋",label:"ติดตาม"},{id:"team",icon:"👥",label:"ทีม"},{id:"timeline",icon:"📈",label:"Timeline"}],
    purchasing:[{id:"dash",icon:"⊞",label:"ภาพรวม"},{id:"tracking",icon:"📋",label:"ติดตาม"},{id:"team",icon:"👥",label:"ทีม"},{id:"timeline",icon:"📈",label:"Timeline"}],
    marketing:[{id:"marketing",icon:"📢",label:"การตลาด"},{id:"tracking",icon:"📋",label:"ติดตาม"},{id:"analytics",icon:"📊",label:"วิเคราะห์"},{id:"team",icon:"👥",label:"ทีม"}],
  };
  const mobileBottomItems=bottomNavByRole[role]||bottomNavByRole.owner;

  return (
    <>
      <style>{GS}</style>
      <div style={{display:"flex",height:"100dvh",overflow:"hidden"}}>
        {/* SIDEBAR - Desktop always visible; Mobile: drawer overlay */}
        {(!isMobileMode||sidebarOpen)&&(
          <div style={{position:isMobileMode?"fixed":"relative",left:0,top:0,width:isMobileMode?280:220,height:"100%",zIndex:200,boxShadow:isMobileMode?"4px 0 24px rgba(0,0,0,0.5)":"none"}}>
            <Sidebar page={page} setPage={handleSetPage} role={role} data={data} authedUserId={authedUserId}
              isMobileMode={isMobileMode} isOwner={isOwner}
              onLogout={handleLogout}
              onChangePw={()=>{setShowChangePw(true);setSidebarOpen(false);}}
              unviewedNotifs={mobileUnviewedCount}
              onOpenNotif={()=>{setSidebarOpen(false);}}
            />
          </div>
        )}
        
        {/* OVERLAY on mobile when sidebar is open */}
        {isMobileMode&&sidebarOpen&&(
          <div onClick={()=>setSidebarOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:150,backdropFilter:"blur(4px)"}}/>
        )}

        {/* MAIN CONTENT AREA */}
        <div style={{marginLeft:isMobileMode?0:220,flex:1,display:"flex",flexDirection:"column",overflow:"hidden",width:isMobileMode?"100%":"auto"}}>
          {/* HEADER */}
          <div style={{height:isMobileMode?50:52,background:C.panel,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",padding:isMobileMode?"0 12px":"0 20px",gap:isMobileMode?8:12,flexShrink:0}}>
            {isMobileMode&&(
              <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{background:"none",border:"none",color:C.text,fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",width:38,height:38,flexShrink:0}}>
                ☰
              </button>
            )}
            <div style={{flex:1,fontSize:isMobileMode?14:15,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{topTitle}</div>
            {/* Mobile: notification bell */}
            {isMobileMode&&<Notifs data={data} setData={setData} role={role} onOpenHouse={handleOpen} setPage={handleSetPage} onScrollToPhase={null}/>}
            {/* User avatar + name */}
            <div style={{display:"flex",alignItems:"center",gap:isMobileMode?5:8,padding:isMobileMode?"3px 7px":"4px 10px",background:C.faint,borderRadius:8,border:`1px solid ${C.border}`,flexShrink:0}}>
              <Avatar member={authedMember} size={isMobileMode?20:22} fontSize={9}/>
              <span style={{fontSize:isMobileMode?11:12,fontWeight:600,color:C.text,maxWidth:isMobileMode?60:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{authedMember?.name?.split(" ")[0]||role}</span>
              <span style={{width:5,height:5,borderRadius:"50%",background:ROLE_COL[realRole]||C.blue,flexShrink:0}}/>
            </div>
            {/* Desktop-only: RoleSwitcher / PwChange + Logout */}
            <div style={{display:isMobileMode?"none":"flex",alignItems:"center",gap:8}}>
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
              {isOwner&&<RoleSwitcher role={role} setRole={r=>{
                handleRole(r);
                const member=data.team.find(m=>m.role===r&&m.status==="active");
                setViewAsId(r==="owner"?null:member?.id||null);
              }}/>}
              {!isOwner&&(
                <button onClick={()=>setShowChangePw(true)} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border2}`,background:"none",color:C.muted,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:4}}>
                  🔑 รหัสผ่าน
                </button>
              )}
              <button onClick={handleLogout} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border2}`,background:"none",color:C.muted,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:4}}>
                🔓 ออก
              </button>
            </div>
          </div>
          
          {/* CONTENT AREA */}
          <div style={{flex:1,overflowY:"auto",overflowX:"hidden",paddingBottom:isMobileMode?70:0}}>
            {page==="house"&&openId&&<HousePage houseId={openId} data={data} setData={setData} role={role} onBack={handleBack} isMobileMode={isMobileMode}/>}
            {page==="dash"&&<DashPage data={data} setData={setData} role={role} onOpenHouse={handleOpen} isMobileMode={isMobileMode}/>}
            {page==="timeline"&&<TimelinePage data={data} role={role} onOpenHouse={handleOpen} isMobileMode={isMobileMode}/>}
            {page==="tracking"&&<TrackingPage data={data} setData={setData} role={role} isMobileMode={isMobileMode} authedUserId={effectiveUserId} isOwner={isOwner}/>}
            {page==="analytics"&&<AnalyticsPage data={data} isMobileMode={isMobileMode}/>}
            {page==="finance"&&role==="owner"&&<FinancePage data={data} role={role} isMobileMode={isMobileMode}/>}
            {page==="team"&&<TeamPage data={data} setData={setData} role={role} isMobileMode={isMobileMode}/>}
            {page==="marketing"&&<MarketingPage data={data} setData={setData} isMobileMode={isMobileMode}/>}
            {page==="settings"&&["owner","engineer"].includes(role)&&<SettingsPage data={data} setData={setData} role={role} isMobileMode={isMobileMode}/>}
          </div>

          {/* MOBILE BOTTOM NAVIGATION BAR */}
          {isMobileMode&&(
            <div style={{position:"fixed",bottom:0,left:0,right:0,height:62,background:C.panel,borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"stretch",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
              {mobileBottomItems.map(item=>{
                const active=page===item.id;
                return (
                  <button key={item.id} onClick={()=>handleSetPage(item.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,background:"none",border:"none",cursor:"pointer",padding:"6px 2px",position:"relative",transition:"all 0.15s"}}>
                    <span style={{fontSize:20,lineHeight:1,filter:active?"drop-shadow(0 0 6px "+C.blue+")":"none"}}>{item.icon}</span>
                    <span style={{fontSize:9,fontWeight:active?700:500,color:active?C.blue:C.muted,letterSpacing:.2}}>{item.label}</span>
                    {active&&<span style={{position:"absolute",top:0,left:"20%",right:"20%",height:2,background:C.blue,borderRadius:"0 0 2px 2px"}}/>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {changePwModal}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// END OF PART 9 — App.jsx COMPLETE ✓
// ═══════════════════════════════════════════════════════════════



