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
const ROLE_COL={owner:"#a78bfa",engineer:"#38bdf8",foreman:"#fb923c",purchasing:"#4ade80",marketing:"#f472b6",sales:"#facc15"};
const ROLE_LBL={owner:"เจ้าของ",engineer:"วิศวกร",foreman:"โฟร์แมน",purchasing:"จัดซื้อ",marketing:"การตลาด",sales:"เซลล์"};
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
    {id:7,role:"sales",name:"นายพิชัย ขายดี",email:"sales@thecrown.com",phone:"089-006-0006",status:"active",username:"sales",password:"1234",avatar:"",location:{lat:null,lng:null,address:"",updatedAt:""}},
  ],
  employeeLevels:{
    2:3,3:2,5:2,6:1,7:2,
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
  marketingBudget:[],
  walkInCustomers:[],
  monthlyResults:[],
  bookingAlerts:[],
  infrastructureCosts:{},
  transferredHouses:[],
  weeklyPayments:{},
  houseAttachments:{},
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

function resizeImg(dataUrl,maxW=800){return new Promise(resolve=>{const img=new Image();img.onload=()=>{let w=img.width,h=img.height;if(w>maxW){h=Math.round(h*(maxW/w));w=maxW;}const cv=document.createElement("canvas");cv.width=w;cv.height=h;cv.getContext("2d").drawImage(img,0,0,w,h);resolve(cv.toDataURL("image/jpeg",0.8));};img.src=dataUrl;});}

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
  // ── บ้านติดจอง แจ้งเตือนทุกคน ──
  const bookingItems=(data.bookingAlerts||[]).filter(a=>!data.notificationViewed?.[`booking-${a.id}`]).map(a=>({
    id:`booking-${a.id}`,
    t:"info",
    msg:`🏠 บ้าน ${a.houseName} ติดจองแล้ว! ลูกค้า: ${a.customerName} — โดย ${a.bookedBy} (${fmtDate(a.date)})`,
    page:"marketing",
    show:true
  }));
  
  const allItems=[...bookingItems,...taskDeadlineItems,...taskAssignItems,...messageItems,...waitingReviewItems,...orderItems,...overBudgetItems].filter(n=>n.show);
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
    owner:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"dash",icon:"⊞",label:"Dashboard"},{id:"tracking",icon:"📋",label:"ติดตามงาน"},{id:"finance",icon:"💹",label:"Finance"},{id:"costPage",icon:"💰",label:"ต้นทุนค่าใช้จ่าย"},{id:"analytics",icon:"📊",label:"Analytics"},{id:"team",icon:"👥",label:"Team"},{id:"customerData",icon:"👤",label:"ข้อมูลลูกค้า"},{id:"marketing",icon:"🏠",label:"บ้านและจอง"},{id:"transferredHouses",icon:"🏡",label:"บ้านที่โอนแล้ว"},{id:"mktResult",icon:"📊",label:"ผลลัพธ์"},{id:"mktBudget",icon:"💰",label:"งบการตลาด"},{id:"settings",icon:"⚙️",label:"ตั้งค่า",badge:settingsBadge}],
    engineer:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"dash",icon:"⊞",label:"บ้านที่ดูแล"},{id:"tracking",icon:"📋",label:"ติดตามงาน"},{id:"costPage",icon:"💰",label:"ต้นทุนค่าใช้จ่าย"},{id:"analytics",icon:"📊",label:"Analytics"},{id:"team",icon:"👥",label:"ทีมงาน"},{id:"settings",icon:"⚙️",label:"ตั้งค่า"}],
    foreman:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"dash",icon:"⊞",label:"บ้านที่ดูแล"},{id:"tracking",icon:"📋",label:"ติดตามงาน"},{id:"team",icon:"👥",label:"ทีมงาน"}],
    purchasing:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"dash",icon:"⊞",label:"ภาพรวม"},{id:"costPage",icon:"💰",label:"ต้นทุนค่าใช้จ่าย"},{id:"tracking",icon:"📋",label:"ติดตามงาน"},{id:"team",icon:"👥",label:"ทีมงาน"}],
    marketing:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"tracking",icon:"📋",label:"ติดตามงาน"},{id:"customerData",icon:"👤",label:"ข้อมูลลูกค้า"},{id:"marketing",icon:"🏠",label:"บ้านและจอง"},{id:"transferredHouses",icon:"🏡",label:"บ้านที่โอนแล้ว"},{id:"mktResult",icon:"📊",label:"ผลลัพธ์"},{id:"mktBudget",icon:"💰",label:"งบการตลาด"},{id:"team",icon:"👥",label:"ทีมงาน"}],
    sales:[{id:"timeline",icon:"📈",label:"Timeline"},{id:"tracking",icon:"📋",label:"ติดตามงาน"},{id:"customerData",icon:"👤",label:"ข้อมูลลูกค้า"},{id:"marketing",icon:"🏠",label:"บ้านและจอง"},{id:"transferredHouses",icon:"🏡",label:"บ้านที่โอนแล้ว"},{id:"mktResult",icon:"📊",label:"ผลลัพธ์"},{id:"team",icon:"👥",label:"ทีมงาน"}],
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
    <div id={`phase-${phase.id}`} style={{marginBottom:18,border:`1px solid ${phPP.s==="done"?"rgba(34,197,94,0.3)":phPP.s==="inprogress"?"rgba(59,130,246,0.3)":C.border}`,borderRadius:12,overflow:"hidden",background:C.panel}}>
      {/* Phase Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 15px",background:phPP.s==="done"?"rgba(34,197,94,0.10)":phPP.s==="inprogress"?"rgba(249,115,22,0.08)":phPP.s==="waiting_review"?"rgba(245,158,11,0.06)":"#0d1117",borderBottom:`1px solid ${C.border}`,borderLeft:phPP.s==="done"?`4px solid #22c55e`:phPP.s==="inprogress"?`4px solid #f97316`:phPP.s==="waiting_review"?`4px solid #f59e0b`:`4px solid #334155`}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:24,height:24,borderRadius:6,fontSize:14,background:phPP.s==="done"?"#22c55e":phPP.s==="inprogress"?"#f97316":phPP.s==="waiting_review"?"#f59e0b":"#334155",color:"#fff",flexShrink:0}}>{phPP.s==="done"?"✓":phPP.s==="inprogress"?"▶":phPP.s==="waiting_review"?"⏳":"•"}</span>
            <span style={{fontWeight:700,color:C.text,fontSize:14}}>หมวด {phase.order} — {phase.name}</span>
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
        <Card style={{padding:isMobileMode?10:20,overflowX:"auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div>
              <div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:C.text}}>📅 แผนงานก่อสร้าง (Gantt Chart)</div>
              <div style={{fontSize:isMobileMode?10:12,color:C.muted,marginTop:2}}>📆 {fmtDate(house.start)} — {fmtDate(addDays(house.start,totalDays))} ({totalDays} วัน)</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{padding:"6px 12px",background:C.faint,borderRadius:8,fontSize:11,color:C.text,fontWeight:700}}>
                เสร็จ {ganttData.filter(g=>g.s==="done").length}/{ganttData.length}
              </div>
            </div>
          </div>
          {/* Summary progress */}
          <div style={{height:6,background:C.faint,borderRadius:3,overflow:"hidden",marginBottom:16}}>
            <div style={{height:"100%",width:`${ganttData.length>0?(ganttData.filter(g=>g.s==="done").length/ganttData.length*100):0}%`,background:C.green,borderRadius:3,transition:"width .3s"}}/>
          </div>
          {/* Gantt Table */}
          <div style={{minWidth:isMobileMode?650:900}}>
            {/* Header row */}
            <div style={{display:"grid",gridTemplateColumns:isMobileMode?"140px 1fr":"200px 1fr",borderBottom:`2px solid ${C.border}`,marginBottom:2}}>
              <div style={{padding:"8px 12px",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1}}>หมวดงาน</div>
              <div style={{display:"flex",position:"relative",height:42}}>
                {ganttMonths.months.map((m,i)=>(
                  <div key={i} style={{flex:`0 0 ${m.width}%`,borderLeft:`1px solid ${C.border}`,padding:"4px 6px",boxSizing:"border-box"}}>
                    <div style={{fontSize:isMobileMode?8:10,color:C.text,fontWeight:700,whiteSpace:"nowrap"}}>{isMobileMode?m.label.slice(0,3):m.label}</div>
                    <div style={{fontSize:isMobileMode?7:9,color:C.muted}}>{m.yearLabel}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Phase rows */}
            {ganttData.map((g,i)=>{
              const barColor=g.s==="done"?"#22c55e":g.s==="inprogress"?"#3b82f6":g.s==="waiting_review"?"#f59e0b":"#334155";
              const barBg=g.s==="done"?"rgba(34,197,94,0.08)":g.s==="inprogress"?"rgba(59,130,246,0.06)":g.s==="waiting_review"?"rgba(245,158,11,0.06)":"transparent";
              const projectStartMs=ganttMonths.timelineStart.getTime();
              const barStartMs=new Date(g.startDate).getTime();
              const barEndMs=new Date(g.endDate).getTime();
              const leftPct=((barStartMs-projectStartMs)/86400000/ganttMonths.timelineTotal)*100;
              const widthPct=((barEndMs-barStartMs)/86400000/ganttMonths.timelineTotal)*100;
              const phPP=pp[g.phase.id]||{s:"waiting",dur:g.dur,act:0};
              let varText="",varColor=C.text;
              if(g.s!=="waiting"){const v=phPP.act-phPP.dur;varText=v===0?"ตรงแผน":v>0?`ช้า ${v} วัน`:`เร็ว ${-v} วัน`;varColor=v===0?C.text:v>0?C.red:C.green;}
              const statusEmoji=g.s==="done"?"✅":g.s==="inprogress"?"🔵":g.s==="waiting_review"?"🟡":"⚪";
              return(
                <div key={g.phase.id} style={{display:"grid",gridTemplateColumns:isMobileMode?"140px 1fr":"200px 1fr",borderBottom:`1px solid ${C.border}`,background:barBg,transition:"background .2s"}} onMouseEnter={e=>e.currentTarget.style.background=C.faint} onMouseLeave={e=>e.currentTarget.style.background=barBg}>
                  {/* Phase label */}
                  <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",justifyContent:"center",borderRight:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{fontSize:11}}>{statusEmoji}</span>
                      <span style={{fontSize:isMobileMode?10:12,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.phase.order}. {g.phase.name}</span>
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:3}}>
                      <span style={{fontSize:9,color:C.muted}}>แผน {g.dur}d</span>
                      {phPP.act>0&&<span style={{fontSize:9,color:varColor,fontWeight:700}}>จริง {phPP.act}d</span>}
                      <span style={{fontSize:9,color:C.muted}}>{fmtDate(g.startDate)} — {fmtDate(g.endDate)}</span>
                    </div>
                  </div>
                  {/* Bar area */}
                  <div style={{position:"relative",height:48,display:"flex",alignItems:"center"}}>
                    <div style={{position:"absolute",left:`${Math.max(leftPct,0)}%`,width:`${Math.max(widthPct,0.5)}%`,height:24,borderRadius:6,background:`linear-gradient(90deg,${barColor},${barColor}dd)`,display:"flex",alignItems:"center",paddingLeft:6,paddingRight:6,cursor:"default",boxShadow:g.s==="inprogress"?`0 0 8px ${barColor}44`:"none",border:g.s==="inprogress"?`1px solid ${barColor}88`:"none"}} title={`${g.phase.name}\n${fmtDate(g.startDate)} → ${fmtDate(g.endDate)}\nแผน ${g.dur} วัน / จริง ${phPP.act} วัน`}>
                      {widthPct>8&&<span style={{fontSize:isMobileMode?8:10,color:"#fff",fontWeight:700,whiteSpace:"nowrap",textShadow:"0 1px 3px rgba(0,0,0,0.4)"}}>{varText}</span>}
                    </div>
                    {widthPct<=8&&varText&&<span style={{position:"absolute",left:`${Math.max(leftPct+widthPct+1,0)}%`,top:"50%",transform:"translateY(-50%)",fontSize:9,color:varColor,fontWeight:700,whiteSpace:"nowrap"}}>{varText}</span>}
                  </div>
                </div>
              );
            })}
            {/* Today line overlay */}
            {(()=>{
              const today=new Date();
              const daysSince=Math.round((today-ganttMonths.timelineStart)/86400000);
              if(daysSince>=0&&daysSince<=ganttMonths.timelineTotal){
                const leftPct=(daysSince/ganttMonths.timelineTotal)*100;
                return <div style={{position:"absolute",top:0,bottom:0,left:`calc(${isMobileMode?140:200}px + ${leftPct}% * (100% - ${isMobileMode?140:200}px) / 100%)`,width:0,borderLeft:`2px dashed ${C.red}`,zIndex:5,pointerEvents:"none"}}><div style={{position:"absolute",top:-2,left:-16,fontSize:8,color:C.red,fontWeight:800,background:C.bg,padding:"1px 4px",borderRadius:3,whiteSpace:"nowrap"}}>📍 วันนี้</div></div>;
              }
              return null;
            })()}
          </div>
          {/* Legend */}
          <div style={{display:"flex",gap:14,marginTop:16,paddingTop:12,borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
            {[["✅","เสร็จแล้ว",C.green],["🔵","กำลังทำ",C.blue],["🟡","รอตรวจ",C.orange],["⚪","รอเริ่ม","#334155"],["📍","วันนี้",C.red]].map(([e,l,c])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:11}}>
                <div style={{width:14,height:14,borderRadius:4,background:c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8}}>{e==="📍"?"":""}</div>
                <span style={{color:C.muted}}>{l}</span>
              </div>
            ))}
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

function MarketingPage({data,setData,role,isMobileMode}) {
  const [editMdl,setEditMdl]=useState(null);
  const [form,setForm]=useState({});
  const [pdfLoading,setPdfLoading]=useState(null);
  const [showConfetti,setShowConfetti]=useState(false);
  const canEdit=["owner","marketing","sales"].includes(role);
  const PCOL={50:C.red,75:C.orange,100:C.green};
  const salesMembers=data.team.filter(t=>t.role==="sales"&&t.status==="active");
  const bankOpts=["ธอส. (GHB)","กสิกรไทย (KBank)","กรุงไทย (KTB)","ไทยพาณิชย์ (SCB)","กรุงเทพ (BBL)","ทหารไทยธนชาต (TTB)","กรุงศรี (BAY)","ออมสิน (GSB)","เกียรตินาคินภัทร (KKP)","ซีไอเอ็มบี (CIMB)","อื่นๆ"];
  function calcMth(principal,annualRate,years){if(!principal||!annualRate||!years)return 0;const r=annualRate/100/12;const n=years*12;if(r===0)return principal/n;return Math.round(principal*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1));}
  function openEdit(house){
    const c=data.customers.find(c=>c.houseId===house.id)||{houseId:house.id,name:"",phone:"",type:"loan",bank:"",preApproved:false,prob:50,note:"",price:"",promotionItems:[],booked:false,isModelHouse:false,bankLoans:[],salesPersons:[]};
    const bl=c.bankLoans||[];
    const migratedBL=bl.length===0&&c.bank?[{id:uid(),bankName:c.bank,promoName:"",rate1:"",rate2:"",rate3:"",loanAmount:"",loanYears:30}]:bl;
    setForm({...c,price:c.price||"",promotionItems:c.promotionItems||(c.promotion?[{id:uid(),text:c.promotion}]:[]),booked:c.booked||false,isModelHouse:c.isModelHouse||false,bankLoans:migratedBL,salesPersons:c.salesPersons||[]});
    setEditMdl(house);
  }
  function addPromoItem(){setForm(f=>({...f,promotionItems:[...f.promotionItems,{id:uid(),text:""}]}));}
  function removePromoItem(id){setForm(f=>({...f,promotionItems:f.promotionItems.filter(p=>p.id!==id)}));}
  function updatePromoItem(id,text){setForm(f=>({...f,promotionItems:f.promotionItems.map(p=>p.id===id?{...p,text}:p)}));}
  function addBankLoan(){setForm(f=>({...f,bankLoans:[...(f.bankLoans||[]),{id:uid(),bankName:"",promoName:"",rate1:"",rate2:"",rate3:"",loanAmount:"",loanYears:30}]}));}
  function removeBankLoan(id){setForm(f=>({...f,bankLoans:f.bankLoans.filter(b=>b.id!==id)}));}
  function updateBankLoan(id,key,val){setForm(f=>({...f,bankLoans:f.bankLoans.map(b=>b.id===id?{...b,[key]:val}:b)}));}
  function addSalesPerson(){setForm(f=>({...f,salesPersons:[...(f.salesPersons||[]),""]}));}
  function removeSalesPerson(i){setForm(f=>({...f,salesPersons:f.salesPersons.filter((_,idx)=>idx!==i)}));}
  function updateSalesPerson(i,val){setForm(f=>({...f,salesPersons:f.salesPersons.map((s,idx)=>idx===i?val:s)}));}
  function save(){
    const wasBooked=data.customers.find(c=>c.houseId===form.houseId)?.booked||false;
    const nowBooked=form.booked;
    setData(d=>{
      const e=d.customers.find(c=>c.houseId===form.houseId);
      let newAlerts=d.bookingAlerts||[];
      if(!wasBooked&&nowBooked){
        const h=d.houses.find(h=>h.id===form.houseId);
        const me=d.team.find(t=>t.role===role&&t.status==="active");
        newAlerts=[...newAlerts,{id:uid(),houseId:form.houseId,houseName:h?.name||"",customerName:form.name,bookedBy:me?.name||ROLE_LBL[role],salesPersons:form.salesPersons||[],date:new Date().toISOString().slice(0,10)}];
      }
      return{...d,bookingAlerts:newAlerts,customers:e?d.customers.map(c=>c.houseId===form.houseId?form:c):[...d.customers,form],houses:d.houses.map(h=>h.id===form.houseId?{...h,customer:form.name}:h)};
    });
    if(!wasBooked&&nowBooked){setShowConfetti(true);setTimeout(()=>setShowConfetti(false),4000);}
    setEditMdl(null);
  }
  function deleteBooking(houseId){
    if(!confirm("ลบข้อมูลจองบ้านนี้? (กู้ไม่ผ่าน / ยกเลิก)"))return;
    setData(d=>({...d,customers:d.customers.filter(c=>c.houseId!==houseId),houses:d.houses.map(h=>h.id===houseId?{...h,customer:""}:h)}));
    setEditMdl(null);
  }
  function transferHouse(houseId){
    if(!confirm("โอนบ้านนี้? ข้อมูลจะย้ายไปหน้า 'บ้านที่โอนแล้ว'"))return;
    const house=data.houses.find(h=>h.id===houseId);
    const cust=data.customers.find(c=>c.houseId===houseId);
    if(!house||!cust){alert("ไม่พบข้อมูลลูกค้า");return;}
    const proj=data.projects.find(p=>p.id===house.projectId);
    const record={id:uid(),houseId,houseName:house.name,projectId:house.projectId,projectName:proj?.name||"",customerName:cust.name,customerPhone:cust.phone||"",price:cust.price||"",type:cust.type||"loan",promotionItems:cust.promotionItems||[],bankLoans:cust.bankLoans||[],salesPersons:cust.salesPersons||[],prob:cust.prob,note:cust.note||"",transferDate:new Date().toISOString().slice(0,10),booked:cust.booked,preApproved:cust.preApproved||false};
    setData(d=>({...d,transferredHouses:[...(d.transferredHouses||[]),record],customers:d.customers.filter(c=>c.houseId!==houseId),houses:d.houses.map(h=>h.id===houseId?{...h,customer:""}:h)}));
    setEditMdl(null);
  }
  async function exportPDF(house){
    setPdfLoading(house.id);
    const c=data.customers.find(cu=>cu.houseId===house.id);
    const project=data.projects.find(p=>p.id===house.projectId);
    const salesMember=data.team.find(t=>t.role==="sales"&&t.status==="active");
    const promoItems=c?.promotionItems||(c?.promotion?[{id:1,text:c.promotion}]:[]);
    const el=document.createElement("div");
    el.style.cssText="position:fixed;left:-9999px;top:0;width:794px;background:#fff;padding:48px 44px;font-family:'Noto Sans Thai',sans-serif;color:#1a1a1a;line-height:1.6;";
    el.innerHTML=`
      <div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:3px solid #2563eb;">
        <div style="font-size:32px;font-weight:800;color:#2563eb;letter-spacing:1px;">🏠 ${project?.name||"โครงการ"}</div>
        <div style="font-size:14px;color:#6b7280;margin-top:8px;">${project?.address||""}</div>
      </div>
      <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:16px;padding:24px 28px;margin-bottom:28px;">
        <div style="font-size:13px;color:#6b7280;text-transform:uppercase;font-weight:700;letter-spacing:1px;">รายละเอียดบ้าน</div>
        <div style="font-size:26px;font-weight:800;color:#1e3a5f;margin-top:8px;">บ้าน ${house.name}</div>
        ${c?.price?`<div style="font-size:30px;font-weight:800;color:#2563eb;margin-top:8px;">฿${fmtMoney(Number(c.price))}</div>`:""}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px;">
        <div style="background:#f8fafc;border-radius:14px;padding:20px;border:1px solid #e2e8f0;">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700;letter-spacing:1px;margin-bottom:10px;">👤 ข้อมูลลูกค้า</div>
          <div style="font-size:18px;font-weight:700;color:#1e293b;">${c?.name||"—"}</div>
          <div style="font-size:15px;color:#3b82f6;margin-top:6px;">📞 ${c?.phone||"—"}</div>
        </div>
        <div style="background:#f8fafc;border-radius:14px;padding:20px;border:1px solid #e2e8f0;">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700;letter-spacing:1px;margin-bottom:10px;">💼 เซลล์ผู้ดูแล</div>
          <div style="font-size:18px;font-weight:700;color:#1e293b;">${salesMember?.name||"—"}</div>
          <div style="font-size:15px;color:#3b82f6;margin-top:6px;">📞 ${salesMember?.phone||"—"}</div>
        </div>
      </div>
      ${promoItems.length>0?`
        <div style="margin-bottom:28px;">
          <div style="font-size:16px;font-weight:700;color:#1e3a5f;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #e2e8f0;">🏷️ โปรโมชั่นพิเศษ</div>
          ${promoItems.map((item,i)=>`
            <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;background:${i%2===0?"#fffbeb":"#fff"};border-radius:10px;margin-bottom:6px;border:1px solid ${i%2===0?"#fef3c7":"#f1f5f9"};">
              <div style="width:30px;height:30px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;">${i+1}</div>
              <div style="font-size:15px;color:#1a1a1a;padding-top:4px;font-weight:500;">${item.text}</div>
            </div>
          `).join("")}
        </div>
      `:""}
      <div style="margin-top:36px;padding-top:18px;border-top:2px solid #e2e8f0;text-align:center;">
        <div style="color:#9ca3af;font-size:11px;">เอกสารโดยระบบ CPMS — ${new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"})}</div>
      </div>
    `;
    document.body.appendChild(el);
    try{
      const canvas=await html2canvas(el,{scale:2,useCORS:true,allowTaint:true,logging:false,windowWidth:794});
      const imgData=canvas.toDataURL("image/jpeg",0.95);
      const pdf=new jsPDF("p","mm","a4");
      const pw=pdf.internal.pageSize.getWidth();
      const ph=pdf.internal.pageSize.getHeight();
      const iw=pw;
      const ih=(canvas.height*iw)/canvas.width;
      let pos=0;
      pdf.addImage(imgData,"JPEG",0,pos,iw,ih);
      let left=ih-ph;
      while(left>0){pdf.addPage();pos-=ph;pdf.addImage(imgData,"JPEG",0,pos,iw,ih);left-=ph;}
      dlBlob(pdf.output("blob"),`บ้าน_${house.name}_${c?.name||"ข้อมูล"}.pdf`);
    }catch(e){alert("เกิดข้อผิดพลาด: "+e.message);}
    document.body.removeChild(el);
    setPdfLoading(null);
  }
  const bookedCount=data.customers.filter(c=>c.booked).length;
  const modelCount=data.customers.filter(c=>c.isModelHouse).length;
  return (
    <div style={{padding:isMobileMode?12:24}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:8}}>
        <div><div style={{fontSize:isMobileMode?18:22,fontWeight:700,color:C.text}}>🏠 รายละเอียดบ้านและการจอง</div><div style={{fontSize:13,color:C.muted,marginTop:2}}>ราคา โปรโมชั่น สถานะจอง บ้านตัวอย่าง</div></div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Card style={{padding:"8px 13px",textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:C.blue}}>{data.houses.length}</div><div style={{fontSize:10,color:C.muted}}>ทั้งหมด</div></Card>
          <Card style={{padding:"8px 13px",textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:C.green}}>{bookedCount}</div><div style={{fontSize:10,color:C.muted}}>ติดจอง</div></Card>
          <Card style={{padding:"8px 13px",textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:C.orange}}>{modelCount}</div><div style={{fontSize:10,color:C.muted}}>บ้านตัวอย่าง</div></Card>
        </div>
      </div>
      {isMobileMode?(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {data.houses.map(h=>{
            const c=data.customers.find(cu=>cu.houseId===h.id);
            const promoItems=c?.promotionItems||(c?.promotion?[{id:1,text:c.promotion}]:[]);
            return (
              <Card key={h.id} style={{padding:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:8}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    <Tag color="blue">{h.name}</Tag>
                    {c?.booked&&<Tag color="green">ติดจอง</Tag>}
                    {c?.isModelHouse&&<Tag color="orange">บ้านตัวอย่าง</Tag>}
                  </div>
                  <div style={{display:"flex",gap:4}}>
                    <Btn size="sm" variant="ghost" onClick={()=>exportPDF(h)} disabled={pdfLoading===h.id}>{pdfLoading===h.id?"⏳":"📄"}</Btn>
                    {canEdit&&<Btn size="sm" variant="ghost" onClick={()=>openEdit(h)}>✏️</Btn>}
                  </div>
                </div>
                <div style={{fontSize:13,color:C.text,marginBottom:4}}>{c?.name||<span style={{color:C.muted}}>— ว่าง</span>}</div>
                {c?.phone&&<div style={{fontSize:11,marginBottom:4}}><a href={`tel:${c.phone}`} style={{color:C.blue,textDecoration:"none"}}>📞 {c.phone}</a></div>}
                {c?.price&&<div style={{fontSize:12,color:C.blue,fontWeight:700}}>💰 ฿{fmtMoney(Number(c.price))}</div>}
                {(c?.salesPersons||[]).length>0&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>👤 เซลล์: {c.salesPersons.join(", ")}</div>}
                {(c?.bankLoans||[]).length>0&&<div style={{fontSize:11,color:C.blue,marginTop:2}}>🏦 {c.bankLoans.map(b=>b.bankName).join(", ")}</div>}
                {promoItems.length>0&&<div style={{marginTop:4}}>{promoItems.map((p,i)=><div key={p.id} style={{fontSize:11,color:C.orange}}>  {i+1}. {p.text}</div>)}</div>}
                <div style={{display:"flex",alignItems:"center",gap:7,marginTop:6}}>
                  <div style={{flex:1,height:5,background:C.faint,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${h.pct}%`,background:C.blue,borderRadius:3}}/></div>
                  <span style={{fontSize:11,fontWeight:700,color:C.blue}}>{h.pct}%</span>
                </div>
              </Card>
            );
          })}
        </div>
      ):(
      <Card>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["บ้าน","สถานะ","ลูกค้า","ราคา","โปรโมชั่น","ธนาคาร","% โอกาส","ก่อสร้าง","เหลือ",""].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,background:"#0d1117",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>
            {data.houses.map(h=>{
              const c=data.customers.find(cu=>cu.houseId===h.id);
              const dl=daysLeft(h.start,h.days);
              const promoItems=c?.promotionItems||(c?.promotion?[{id:1,text:c.promotion}]:[]);
              return (
                <tr key={h.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background=C.panel} onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td style={{padding:"9px 12px"}}><Tag color="blue">{h.name}</Tag>{c?.isModelHouse&&<Tag color="orange" style={{marginLeft:4}}>ตัวอย่าง</Tag>}<div style={{fontSize:10,color:C.muted,marginTop:2}}>{data.projects.find(p=>p.id===h.projectId)?.name}</div></td>
                  <td style={{padding:"9px 12px"}}>{c?.booked?<Tag color="green">ติดจอง</Tag>:<Tag color="gray">ว่าง</Tag>}</td>
                  <td style={{padding:"9px 12px"}}><div style={{fontSize:13,color:C.text}}>{c?.name||<span style={{color:C.muted}}>—</span>}</div>{c?.phone&&<div style={{fontSize:11}}><a href={`tel:${c.phone}`} onClick={e=>e.stopPropagation()} style={{color:C.blue,textDecoration:"none"}}>📞 {c.phone}</a></div>}{(c?.salesPersons||[]).length>0&&<div style={{fontSize:10,color:C.muted,marginTop:2}}>👤 {c.salesPersons.join(", ")}</div>}</td>
                  <td style={{padding:"9px 12px",fontSize:13,fontWeight:700,color:C.blue}}>{c?.price?`฿${fmtMoney(Number(c.price))}`:"—"}</td>
                  <td style={{padding:"9px 12px",fontSize:12,maxWidth:200}}>{promoItems.length>0?promoItems.map((p,i)=><div key={p.id} style={{color:C.orange,fontSize:11}}>{i+1}. {p.text}</div>):"—"}</td>
                  <td style={{padding:"9px 12px"}}>{c?(c.type==="cash"?<Tag color="green">💵 สด</Tag>:(c.bankLoans||[]).length>0?<div>{c.bankLoans.map(b=><div key={b.id} style={{fontSize:11,color:C.blue}}>🏦 {b.bankName}</div>)}</div>:c.bank?<Tag color="blue">🏦 {c.bank}</Tag>:<Tag color="blue">🏦 กู้</Tag>):"—"}</td>
                  <td style={{padding:"9px 12px"}}>{c?<span style={{fontSize:13,fontWeight:700,color:PCOL[c.prob]}}>{c.prob}%</span>:"—"}</td>
                  <td style={{padding:"9px 12px",minWidth:90}}><div style={{display:"flex",alignItems:"center",gap:7}}><div style={{flex:1,height:5,background:C.faint,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${h.pct}%`,background:C.blue,borderRadius:3}}/></div><span style={{fontSize:11,fontWeight:700,color:C.blue}}>{h.pct}%</span></div></td>
                  <td style={{padding:"9px 12px",fontSize:12,color:dl<0?C.red:dl<30?C.orange:C.muted}}>{h.status==="completed"?"✓":dl<0?`เกิน ${Math.abs(dl)} วัน`:`${dl} วัน`}</td>
                  <td style={{padding:"9px 12px"}}><div style={{display:"flex",gap:4}}><Btn size="sm" variant="ghost" onClick={()=>exportPDF(h)} disabled={pdfLoading===h.id}>{pdfLoading===h.id?"⏳":"📄"}</Btn>{canEdit&&<Btn size="sm" variant="ghost" onClick={()=>openEdit(h)}>✏️</Btn>}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      )}
      {editMdl&&(
        <Mdl title={`🏠 บ้าน ${editMdl.name}`} onClose={()=>setEditMdl(null)} footer={<div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"space-between",width:"100%"}}><div style={{display:"flex",gap:6}}>{canEdit&&data.customers.find(c=>c.houseId===editMdl.id)&&<Btn size="sm" variant="ghost" onClick={()=>deleteBooking(editMdl.id)} style={{color:C.red}}>🗑 ลบจอง</Btn>}{canEdit&&data.customers.find(c=>c.houseId===editMdl.id&&c.booked)&&<Btn size="sm" variant="ghost" onClick={()=>transferHouse(editMdl.id)} style={{color:C.green}}>🏡 โอน</Btn>}</div><div style={{display:"flex",gap:8}}><Btn variant="ghost" onClick={()=>setEditMdl(null)}>ยกเลิก</Btn><Btn onClick={save}>💾 บันทึก</Btn></div></div>}>
          <FG label="ราคา (บาท)"><FIn type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} placeholder="เช่น 2500000"/></FG>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginTop:8,marginBottom:8}}>🏷️ โปรโมชั่น (ของแถม)</div>
          {form.promotionItems?.map((item,i)=>(
            <div key={item.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:13,fontWeight:700,color:C.orange,minWidth:24}}>{i+1}.</span>
              <FIn value={item.text} onChange={e=>updatePromoItem(item.id,e.target.value)} placeholder={`รายการที่ ${i+1} เช่น ฟรีค่าโอน, เฟอร์นิเจอร์`} style={{flex:1}}/>
              <Btn size="sm" variant="ghost" onClick={()=>removePromoItem(item.id)} style={{color:C.red}}>✕</Btn>
            </div>
          ))}
          <Btn size="sm" variant="ghost" onClick={addPromoItem} style={{color:C.blue,fontSize:12,marginBottom:12}}>+ เพิ่มรายการโปรโมชั่น</Btn>
          <div style={{display:"flex",gap:16,padding:"10px 0",borderTop:`1px solid ${C.border}`,marginBottom:12}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:C.text}}>
              <input type="checkbox" checked={form.booked} onChange={e=>setForm(f=>({...f,booked:e.target.checked}))}/>
              ติดจอง
            </label>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:C.text}}>
              <input type="checkbox" checked={form.isModelHouse} onChange={e=>setForm(f=>({...f,isModelHouse:e.target.checked}))}/>
              บ้านตัวอย่าง
            </label>
          </div>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:8,paddingTop:8,borderTop:`1px solid ${C.border}`}}>👤 ข้อมูลลูกค้า</div>
          <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:12}}>
            <FG label="ชื่อ-นามสกุล"><FIn value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></FG>
            <FG label="เบอร์โทร"><FIn value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></FG>
          </div>
          <FG label="ประเภทการซื้อ"><FSel value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option value="cash">💵 ซื้อสด</option><option value="loan">🏦 กู้ธนาคาร</option><option value="unknown">— ยังไม่ระบุ</option></FSel></FG>
          {form.type==="loan"&&(
            <>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginTop:12,marginBottom:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>🏦 ธนาคารที่ยื่นกู้ (เพิ่มได้ไม่จำกัด)</div>
              {(form.bankLoans||[]).map((bank,bi)=>{
                const loanAmt=bank.loanAmount?Number(bank.loanAmount):(form.price?Number(form.price):0);
                const yrs=bank.loanYears?Number(bank.loanYears):30;
                const pay1=calcMth(loanAmt,Number(bank.rate1)||0,yrs);
                const pay2=calcMth(loanAmt,Number(bank.rate2)||0,yrs);
                const pay3=calcMth(loanAmt,Number(bank.rate3)||0,yrs);
                return(
                  <Card key={bank.id} style={{padding:14,marginBottom:10,border:`1px solid ${C.border2}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.blue}}>🏦 ธนาคารที่ {bi+1}</div>
                      <Btn size="sm" variant="ghost" onClick={()=>removeBankLoan(bank.id)} style={{color:C.red}}>✕ ลบ</Btn>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:10}}>
                      <FG label="ชื่อธนาคาร"><FSel value={bank.bankName} onChange={e=>updateBankLoan(bank.id,"bankName",e.target.value)}><option value="">— เลือกธนาคาร —</option>{bankOpts.map(b=><option key={b} value={b}>{b}</option>)}</FSel></FG>
                      <FG label="โปรโมชั่นธนาคาร"><FIn value={bank.promoName} onChange={e=>updateBankLoan(bank.id,"promoName",e.target.value)} placeholder="เช่น โปรโมชั่นเพื่อคุณ"/></FG>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr 1fr",gap:10}}>
                      <FG label="ดอกเบี้ยปีที่ 1 (%)"><FIn type="number" step="0.01" value={bank.rate1} onChange={e=>updateBankLoan(bank.id,"rate1",e.target.value)} placeholder="2.99"/></FG>
                      <FG label="ดอกเบี้ยปีที่ 2 (%)"><FIn type="number" step="0.01" value={bank.rate2} onChange={e=>updateBankLoan(bank.id,"rate2",e.target.value)} placeholder="4.40"/></FG>
                      <FG label="ดอกเบี้ยปีที่ 3+ (%)"><FIn type="number" step="0.01" value={bank.rate3} onChange={e=>updateBankLoan(bank.id,"rate3",e.target.value)} placeholder="5.95"/></FG>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:10}}>
                      <FG label="ยอดกู้ (บาท)"><FIn type="number" value={bank.loanAmount} onChange={e=>updateBankLoan(bank.id,"loanAmount",e.target.value)} placeholder={form.price?`อ้างอิง ฿${fmtMoney(Number(form.price))}`:"ระบุยอดกู้"}/></FG>
                      <FG label="ระยะเวลากู้ (ปี)"><FSel value={bank.loanYears} onChange={e=>updateBankLoan(bank.id,"loanYears",e.target.value)}>{Array.from({length:40},(_,i)=>i+1).map(y=><option key={y} value={y}>{y} ปี ({y*12} งวด)</option>)}</FSel></FG>
                    </div>
                    {loanAmt>0&&(Number(bank.rate1)>0||Number(bank.rate2)>0||Number(bank.rate3)>0)&&(
                      <div style={{background:"linear-gradient(135deg,#1e3a5f,#0f172a)",borderRadius:10,padding:14,marginTop:8}}>
                        <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8}}>📊 ยอดผ่อน/เดือน (฿{fmtMoney(loanAmt)} / {yrs} ปี)</div>
                        <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr 1fr",gap:10}}>
                          {Number(bank.rate1)>0&&<div style={{textAlign:"center",padding:10,background:C.faint,borderRadius:8}}><div style={{fontSize:10,color:C.muted}}>ปีที่ 1 ({bank.rate1}%)</div><div style={{fontSize:18,fontWeight:800,color:C.green}}>฿{fmtMoney(pay1)}</div></div>}
                          {Number(bank.rate2)>0&&<div style={{textAlign:"center",padding:10,background:C.faint,borderRadius:8}}><div style={{fontSize:10,color:C.muted}}>ปีที่ 2 ({bank.rate2}%)</div><div style={{fontSize:18,fontWeight:800,color:C.orange}}>฿{fmtMoney(pay2)}</div></div>}
                          {Number(bank.rate3)>0&&<div style={{textAlign:"center",padding:10,background:C.faint,borderRadius:8}}><div style={{fontSize:10,color:C.muted}}>ปีที่ 3+ ({bank.rate3}%)</div><div style={{fontSize:18,fontWeight:800,color:C.blue}}>฿{fmtMoney(pay3)}</div></div>}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
              <Btn size="sm" variant="ghost" onClick={addBankLoan} style={{color:C.blue,fontSize:12,marginBottom:12}}>+ เพิ่มธนาคาร</Btn>
            </>
          )}
          <FG label="% โอกาสซื้อ"><FSel value={form.prob} onChange={e=>setForm(f=>({...f,prob:+e.target.value}))}><option value={50}>50% — อาจกู้ไม่ผ่าน</option><option value={75}>75% — โอกาสสูง</option><option value={100}>100% — ซื้อสด / Pre-approved</option></FSel></FG>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderTop:`1px solid ${C.border}`,marginBottom:12}}>
            <span style={{fontSize:12,fontWeight:700,color:C.muted}}>Pre-approved แล้ว</span>
            <label style={{position:"relative",width:40,height:22,cursor:"pointer",display:"block"}}>
              <input type="checkbox" checked={form.preApproved} onChange={e=>setForm(f=>({...f,preApproved:e.target.checked,prob:e.target.checked?100:f.prob}))} style={{opacity:0,width:0,height:0,position:"absolute"}}/>
              <span style={{position:"absolute",inset:0,background:form.preApproved?C.blue:C.faint,borderRadius:22,transition:".2s"}}/>
              <span style={{position:"absolute",width:16,height:16,top:3,left:form.preApproved?21:3,background:"#fff",borderRadius:"50%",transition:".2s"}}/>
            </label>
          </div>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginTop:12,marginBottom:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>👥 เซลล์ผู้พาลูกค้ามาจอง</div>
          {(form.salesPersons||[]).map((sp,i)=>(
            <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
              <FSel value={sp} onChange={e=>updateSalesPerson(i,e.target.value)} style={{flex:1}}>
                <option value="">— เลือกเซลล์ —</option>
                {salesMembers.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                <option value="__other">อื่นๆ (พิมพ์เอง)</option>
              </FSel>
              {sp==="__other"&&<FIn value="" onChange={e=>updateSalesPerson(i,e.target.value)} placeholder="ชื่อเซลล์..." style={{flex:1}}/>}
              <Btn size="sm" variant="ghost" onClick={()=>removeSalesPerson(i)} style={{color:C.red}}>✕</Btn>
            </div>
          ))}
          <Btn size="sm" variant="ghost" onClick={addSalesPerson} style={{color:C.blue,fontSize:12,marginBottom:12}}>+ เพิ่มเซลล์</Btn>
          <FG label="หมายเหตุ"><FIn value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} rows={2} placeholder="บันทึกการติดตาม..."/></FG>
          {/* ── Attachments Section ── */}
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginTop:12,marginBottom:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>📎 เอกสารแนบ / รูปภาพ</div>
          <div style={{fontSize:11,color:C.muted,marginBottom:8}}>อัปโหลดรูปหรือเอกสาร เช่น แบบติดแอร์, ใบเสนอราคา, คำขอเพิ่มเติม (ข้อมูลจะลิงก์ไปยังหน้า "บ้านที่โอนแล้ว" ด้วย)</div>
          {(()=>{
            const atts=(data.houseAttachments||{})[editMdl.id]||[];
            return(<>
              {atts.length>0&&<div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr 1fr":"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                {atts.map(a=>(
                  <div key={a.id} style={{background:C.faint,borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`}}>
                    {a.type?.startsWith("image/")?<img src={a.data} alt={a.name} style={{width:"100%",height:100,objectFit:"cover"}}/>:<div style={{height:60,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>📄</div>}
                    <div style={{padding:"6px 8px"}}>
                      <div style={{fontSize:10,color:C.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                      <div style={{fontSize:9,color:C.muted}}>{a.uploadedBy} — {a.date}</div>
                      <div style={{display:"flex",gap:4,marginTop:4}}>
                        <a href={a.data} download={a.name} style={{fontSize:10,color:C.blue,textDecoration:"none"}}>⬇️ ดาวน์โหลด</a>
                        {canEdit&&<span style={{fontSize:10,color:C.red,cursor:"pointer"}} onClick={()=>setData(d=>({...d,houseAttachments:{...d.houseAttachments,[editMdl.id]:(d.houseAttachments?.[editMdl.id]||[]).filter(x=>x.id!==a.id)}}))}>🗑 ลบ</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>}
              {canEdit&&<label style={{display:"inline-flex",alignItems:"center",gap:6,cursor:"pointer",padding:"8px 14px",borderRadius:8,background:C.faint,border:`1px dashed ${C.border}`,color:C.blue,fontSize:12,fontWeight:600}}>
                📎 เลือกไฟล์แนบ
                <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" multiple style={{display:"none"}} onChange={e=>{
                  Array.from(e.target.files).forEach(file=>{
                    const reader=new FileReader();
                    reader.onload=async ev=>{
                      let fileData=ev.target.result;
                      if(file.type.startsWith("image/"))fileData=await resizeImg(fileData,800);
                      const att={id:uid(),name:file.name,type:file.type,data:fileData,date:new Date().toISOString().slice(0,10),uploadedBy:ROLE_LBL[role]};
                      setData(d=>({...d,houseAttachments:{...d.houseAttachments,[editMdl.id]:[...(d.houseAttachments?.[editMdl.id]||[]),att]}}));
                    };
                    reader.readAsDataURL(file);
                  });
                  e.target.value="";
                }}/>
              </label>}
            </>);
          })()}
        </Mdl>
      )}
      {showConfetti&&(()=>{
        const colors=["#fbbf24","#ef4444","#3b82f6","#10b981","#a855f7","#f97316","#ec4899"];
        return(
          <div style={{position:"fixed",inset:0,zIndex:9999,pointerEvents:"none",overflow:"hidden"}}>
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",background:"rgba(0,0,0,0.92)",borderRadius:20,padding:isMobileMode?"30px 24px":"40px 60px",textAlign:"center",pointerEvents:"auto",zIndex:1,border:"2px solid #fbbf24",boxShadow:"0 0 60px rgba(251,191,36,.3)",animation:"bookBounce .5s ease-out"}}>
              <div style={{fontSize:60}}>🎉🏠🎊</div>
              <div style={{fontSize:isMobileMode?20:26,fontWeight:800,color:"#fbbf24",marginTop:12}}>ยินดีด้วย!</div>
              <div style={{fontSize:isMobileMode?14:18,color:"#fff",marginTop:8}}>บ้านติดจองเรียบร้อยแล้ว</div>
              <div style={{fontSize:13,color:"#9ca3af",marginTop:12}}>ระบบแจ้งเตือนทุกคนแล้ว ✓</div>
            </div>
            {Array.from({length:50}).map((_,i)=><div key={i} style={{position:"absolute",left:`${(i*2)%100}%`,top:-10,width:`${6+i%6}px`,height:`${6+i%6}px`,background:colors[i%7],borderRadius:i%3?"50%":"2px",opacity:0,animation:`${i%2?"cFallL":"cFallR"} ${2+(i%4)*.5}s linear ${i*.06}s forwards`}}/>)}
            <style>{`@keyframes cFallL{0%{top:-10px;opacity:1;transform:rotate(0)}25%{opacity:1}100%{top:105vh;opacity:0;transform:rotate(720deg) translateX(-60px)}}@keyframes cFallR{0%{top:-10px;opacity:1;transform:rotate(0)}25%{opacity:1}100%{top:105vh;opacity:0;transform:rotate(-720deg) translateX(60px)}}@keyframes bookBounce{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}50%{transform:translate(-50%,-50%) scale(1.05)}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}`}</style>
          </div>
        );
      })()}
    </div>
  );
}

// ── Marketing Budget Page ─────────────────────────────────────
function MktBudgetPage({data,setData,role,isMobileMode}) {
  const canEdit=["owner","marketing"].includes(role);
  const now=new Date();
  const [selMonth,setSelMonth]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);
  const [editMdl,setEditMdl]=useState(false);
  const [viewMode,setViewMode]=useState("month"); // month | chart | compare
  const [chartYear,setChartYear]=useState(now.getFullYear());
  const [cmpFrom,setCmpFrom]=useState(`${now.getFullYear()}-01`);
  const [cmpTo,setCmpTo]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);
  const channels=["Facebook Ads","TikTok Ads","LINE Ads","Google Ads","จ้าง Influencer","ออฟไลน์ ป้ายโฆษณา"];
  const chColors=["#3b82f6","#000000","#22c55e","#f59e0b","#a855f7","#ef4444"];
  const budgets=data.marketingBudget||[];
  const cur=budgets.find(b=>b.month===selMonth)||{month:selMonth,items:channels.map(ch=>({channel:ch,budget:0,actual:0}))};
  const [form,setForm]=useState(cur);
  function openEdit(){setForm(JSON.parse(JSON.stringify(cur)));setEditMdl(true);}
  function save(){
    setData(d=>{
      const mb=d.marketingBudget||[];
      const idx=mb.findIndex(b=>b.month===form.month);
      const items=form.items.map(it=>({...it,budget:Number(it.budget)||0,actual:Number(it.actual)||0}));
      const updated={...form,items};
      return{...d,marketingBudget:idx>=0?mb.map((b,i)=>i===idx?updated:b):[...mb,updated]};
    });
    setEditMdl(false);
  }
  function changeMonth(delta){
    const [y,m]=selMonth.split("-").map(Number);
    const d=new Date(y,m-1+delta,1);
    setSelMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }
  const totalBudget=cur.items.reduce((s,it)=>s+(Number(it.budget)||0),0);
  const totalActual=cur.items.reduce((s,it)=>s+(Number(it.actual)||0),0);
  const thMonths=["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const thMonthsFull=["","มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const [y,mo]=selMonth.split("-").map(Number);

  // Helper: get 12 months data for a year
  function getYearData(yr){
    return Array.from({length:12},(_,i)=>{
      const mKey=`${yr}-${String(i+1).padStart(2,"0")}`;
      const md=budgets.find(b=>b.month===mKey);
      const items=md?md.items:channels.map(ch=>({channel:ch,budget:0,actual:0}));
      return{month:i+1,mKey,items,totalBudget:items.reduce((s,it)=>s+(Number(it.budget)||0),0),totalActual:items.reduce((s,it)=>s+(Number(it.actual)||0),0)};
    });
  }

  // Helper: get range data for comparison
  function getRangeData(from,to){
    const [fy,fm]=from.split("-").map(Number);
    const [ty,tm]=to.split("-").map(Number);
    const result=[];
    let cy=fy,cm=fm;
    while(cy<ty||(cy===ty&&cm<=tm)){
      const mKey=`${cy}-${String(cm).padStart(2,"0")}`;
      const md=budgets.find(b=>b.month===mKey);
      const items=md?md.items:channels.map(ch=>({channel:ch,budget:0,actual:0}));
      result.push({year:cy,month:cm,mKey,items,totalBudget:items.reduce((s,it)=>s+(Number(it.budget)||0),0),totalActual:items.reduce((s,it)=>s+(Number(it.actual)||0),0)});
      cm++;if(cm>12){cm=1;cy++;}
      if(result.length>60)break;
    }
    return result;
  }

  // Available years
  const allYears=[...new Set(budgets.map(b=>Number(b.month.split("-")[0])))].sort();
  if(!allYears.includes(now.getFullYear()))allYears.push(now.getFullYear());
  allYears.sort((a,b)=>a-b);

  return (
    <div style={{padding:isMobileMode?12:24}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:16}}>
        <div>
          <div style={{fontSize:isMobileMode?18:22,fontWeight:700,color:C.text}}>💰 งบประมาณการตลาด</div>
          <div style={{fontSize:13,color:C.muted,marginTop:2}}>งบรายเดือน สถิติ และเปรียบเทียบค่าใช้จ่ายด้านการตลาด</div>
        </div>
      </div>
      {/* TAB BUTTONS */}
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {[{k:"month",l:"📅 รายเดือน"},{k:"chart",l:"📊 กราฟรายปี"},{k:"compare",l:"📈 เปรียบเทียบ"}].map(t=>(
          <Btn key={t.k} size="sm" variant={viewMode===t.k?"default":"ghost"} onClick={()=>setViewMode(t.k)} style={viewMode===t.k?{background:C.blue,color:"#fff"}:{}}>{t.l}</Btn>
        ))}
      </div>

      {/* ═══ MONTHLY VIEW ═══ */}
      {viewMode==="month"&&<>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <Btn size="sm" variant="ghost" onClick={()=>changeMonth(-1)}>◀</Btn>
          <span style={{fontSize:16,fontWeight:700,color:C.text}}>{thMonthsFull[mo]} {y+543}</span>
          <Btn size="sm" variant="ghost" onClick={()=>changeMonth(1)}>▶</Btn>
          <div style={{flex:1}}/>
          {canEdit&&<Btn onClick={openEdit}>✏️ แก้ไขงบ</Btn>}
        </div>
        {/* KPI Cards */}
        <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:12,marginBottom:20}}>
          <Card style={{padding:15,borderLeft:`4px solid ${C.blue}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>📋 งบประมาณ</div><div style={{fontSize:isMobileMode?16:20,fontWeight:800,color:C.blue}}>฿{fmtMoney(totalBudget)}</div></Card>
          <Card style={{padding:15,borderLeft:`4px solid ${totalActual>totalBudget?C.red:C.green}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>💸 ใช้จริง</div><div style={{fontSize:isMobileMode?16:20,fontWeight:800,color:totalActual>totalBudget?C.red:C.green}}>฿{fmtMoney(totalActual)}</div></Card>
          <Card style={{padding:15,borderLeft:`4px solid ${(totalBudget-totalActual)<0?C.red:C.green}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>💰 คงเหลือ</div><div style={{fontSize:isMobileMode?16:20,fontWeight:800,color:(totalBudget-totalActual)<0?C.red:C.text}}>฿{fmtMoney(Math.abs(totalBudget-totalActual))}{(totalBudget-totalActual)<0?" (เกิน!)":""}</div></Card>
          <Card style={{padding:15,borderLeft:`4px solid ${C.orange}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>📊 ใช้ไป</div><div style={{fontSize:isMobileMode?16:20,fontWeight:800,color:C.orange}}>{totalBudget>0?Math.round(totalActual/totalBudget*100):0}%</div></Card>
        </div>
        {/* Platform cards with over-budget indicator */}
        <Card style={{padding:0,marginBottom:20}}>
          {cur.items.map((it,i)=>{
            const bgt=Number(it.budget)||0;const act=Number(it.actual)||0;
            const isOver=act>bgt&&bgt>0;const diff=act-bgt;
            const pct=bgt>0?Math.min(Math.round(act/bgt*100),150):0;
            return (
              <div key={i} style={{padding:isMobileMode?"10px 12px":"14px 18px",borderBottom:`1px solid ${C.border}`,background:isOver?"rgba(239,68,68,0.04)":"transparent"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:10,height:10,borderRadius:3,background:chColors[i],flexShrink:0}}/>
                    <span style={{fontSize:13,fontWeight:600,color:C.text}}>{it.channel}</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={{fontSize:12,fontWeight:700,color:isOver?C.red:C.blue}}>฿{fmtMoney(act)} / ฿{fmtMoney(bgt)}</span>
                    {isOver&&<div style={{fontSize:10,fontWeight:800,color:C.red}}>⚠️ เกิน ฿{fmtMoney(diff)} (+{bgt>0?Math.round(diff/bgt*100):0}%)</div>}
                  </div>
                </div>
                <div style={{height:8,background:C.faint,borderRadius:4,overflow:"hidden",position:"relative"}}>
                  <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:isOver?C.red:C.blue,borderRadius:4,transition:"width .3s"}}/>
                  {isOver&&<div style={{position:"absolute",top:0,left:`${Math.min(100*(bgt/act),100)}%`,width:2,height:"100%",background:"#fff"}}/>}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                  <span style={{fontSize:10,color:C.muted}}>{pct}%</span>
                  {act>0&&bgt>0&&<span style={{fontSize:10,color:isOver?C.red:C.green}}>{isOver?`เกินงบ ${Math.round(diff/bgt*100)}%`:`ประหยัด ฿${fmtMoney(bgt-act)}`}</span>}
                </div>
              </div>
            );
          })}
        </Card>
        {/* Donut chart — spend proportion */}
        <Card style={{padding:isMobileMode?12:20}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>🍩 สัดส่วนค่าใช้จ่ายจริง — {thMonthsFull[mo]} {y+543}</div>
          <div style={{display:"flex",alignItems:isMobileMode?"flex-start":"center",gap:20,flexDirection:isMobileMode?"column":"row"}}>
            <svg viewBox="0 0 120 120" style={{width:isMobileMode?140:160,height:isMobileMode?140:160,flexShrink:0}}>
              {(()=>{
                const total=cur.items.reduce((s,it)=>s+(Number(it.actual)||0),0);
                if(total===0)return<text x="60" y="64" textAnchor="middle" fill={C.muted} fontSize="10">ไม่มีข้อมูล</text>;
                let cum=0;
                return cur.items.map((it,i)=>{
                  const val=Number(it.actual)||0;if(val===0)return null;
                  const pct=val/total;const start=cum;cum+=pct;
                  const startAngle=start*2*Math.PI-Math.PI/2;
                  const endAngle=(start+pct)*2*Math.PI-Math.PI/2;
                  const largeArc=pct>0.5?1:0;
                  const x1=60+42*Math.cos(startAngle),y1=60+42*Math.sin(startAngle);
                  const x2=60+42*Math.cos(endAngle),y2=60+42*Math.sin(endAngle);
                  return<path key={i} d={`M60,60 L${x1},${y1} A42,42 0 ${largeArc},1 ${x2},${y2} Z`} fill={chColors[i]} opacity=".85"/>;
                });
              })()}
              <circle cx="60" cy="60" r="24" fill={C.bg}/>
              <text x="60" y="58" textAnchor="middle" fill={C.text} fontSize="10" fontWeight="800">{totalActual>0?`฿${totalActual>=1000000?(totalActual/1000000).toFixed(1)+"M":totalActual>=1000?(totalActual/1000).toFixed(0)+"K":totalActual}`:""}</text>
              <text x="60" y="70" textAnchor="middle" fill={C.muted} fontSize="7">ใช้จริงรวม</text>
            </svg>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
              {cur.items.map((it,i)=>{const act=Number(it.actual)||0;const pct=totalActual>0?Math.round(act/totalActual*100):0;return act>0?(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                  <div style={{width:10,height:10,borderRadius:3,background:chColors[i],flexShrink:0}}/>
                  <span style={{flex:1,color:C.text,fontWeight:600}}>{it.channel}</span>
                  <span style={{fontWeight:700,color:C.text}}>฿{fmtMoney(act)}</span>
                  <span style={{color:C.muted,fontSize:10,minWidth:35,textAlign:"right"}}>{pct}%</span>
                </div>
              ):null;})}
            </div>
          </div>
        </Card>
      </>}

      {/* ═══ YEARLY CHART VIEW ═══ */}
      {viewMode==="chart"&&(()=>{
        const yd=getYearData(chartYear);
        const maxTotal=Math.max(...yd.map(m=>Math.max(m.totalBudget,m.totalActual)),1);
        const grandBudget=yd.reduce((s,m)=>s+m.totalBudget,0);
        const grandActual=yd.reduce((s,m)=>s+m.totalActual,0);
        // Per-channel yearly totals
        const chTotals=channels.map((ch,ci)=>{
          const bgt=yd.reduce((s,m)=>{const it=m.items.find(x=>x.channel===ch);return s+(it?Number(it.budget)||0:0);},0);
          const act=yd.reduce((s,m)=>{const it=m.items.find(x=>x.channel===ch);return s+(it?Number(it.actual)||0:0);},0);
          return{channel:ch,color:chColors[ci],budget:bgt,actual:act,diff:act-bgt};
        });
        // Find most expensive month
        const topMonth=yd.reduce((best,m)=>m.totalActual>best.totalActual?m:best,yd[0]);
        return<>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <Btn size="sm" variant="ghost" onClick={()=>setChartYear(y=>y-1)}>◀</Btn>
            <span style={{fontSize:16,fontWeight:700,color:C.text}}>ปี {chartYear+543}</span>
            <Btn size="sm" variant="ghost" onClick={()=>setChartYear(y=>y+1)}>▶</Btn>
          </div>
          {/* Yearly KPI */}
          <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:12,marginBottom:20}}>
            <Card style={{padding:14,borderLeft:`4px solid ${C.blue}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4}}>📋 งบทั้งปี</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:C.blue}}>฿{fmtMoney(grandBudget)}</div></Card>
            <Card style={{padding:14,borderLeft:`4px solid ${grandActual>grandBudget?C.red:C.green}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4}}>💸 ใช้จริงทั้งปี</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:grandActual>grandBudget?C.red:C.green}}>฿{fmtMoney(grandActual)}</div></Card>
            <Card style={{padding:14,borderLeft:`4px solid ${C.orange}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4}}>🔥 เดือนแพงสุด</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:C.orange}}>{thMonths[topMonth.month]} ฿{fmtMoney(topMonth.totalActual)}</div></Card>
            <Card style={{padding:14,borderLeft:`4px solid ${C.green}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4}}>📊 เฉลี่ย/เดือน</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:C.text}}>฿{fmtMoney(Math.round(grandActual/12))}</div></Card>
          </div>
          {/* BAR CHART: Monthly spend */}
          <Card style={{padding:isMobileMode?12:20,marginBottom:20}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:14}}>📊 งบ vs ใช้จริง รายเดือน — ปี {chartYear+543}</div>
            <div style={{overflowX:"auto"}}>
              <svg viewBox="0 0 700 280" style={{width:"100%",minWidth:600,height:280}}>
                {[0,0.25,0.5,0.75,1].map((r,i)=>{const v=Math.round(maxTotal*(1-r));const yp=30+r*200;return<g key={i}><line x1="55" y1={yp} x2="690" y2={yp} stroke={C.border} strokeWidth=".5" strokeDasharray="4"/><text x="50" y={yp+4} textAnchor="end" fill={C.muted} fontSize="8" fontFamily="monospace">{fmtMoney(v)}</text></g>;})}
                {yd.map((m,i)=>{
                  const x=65+i*52;const bH=maxTotal>0?(m.totalBudget/maxTotal)*200:0;const aH=maxTotal>0?(m.totalActual/maxTotal)*200:0;
                  const isOver=m.totalActual>m.totalBudget&&m.totalBudget>0;
                  const isTop=m.month===topMonth.month&&topMonth.totalActual>0;
                  return<g key={i}>
                    {isTop&&<rect x={x-4} y={25} width={52} height={240} rx="4" fill={C.orange} opacity=".06"/>}
                    <rect x={x} y={230-bH} width={20} height={bH} rx="3" fill={C.blue} opacity=".6"/>
                    <rect x={x+22} y={230-aH} width={20} height={aH} rx="3" fill={isOver?C.red:C.green} opacity=".85"/>
                    <text x={x+21} y={248} textAnchor="middle" fill={isTop?C.orange:C.text} fontSize="9" fontWeight={isTop?"800":"500"}>{thMonths[m.month]}</text>
                    {isOver&&<text x={x+21} y={225-Math.max(bH,aH)} textAnchor="middle" fill={C.red} fontSize="7" fontWeight="700">+{fmtMoney(m.totalActual-m.totalBudget)}</text>}
                  </g>;
                })}
              </svg>
            </div>
            <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:8}}>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}><div style={{width:12,height:12,borderRadius:3,background:C.blue,opacity:.6}}/><span style={{color:C.muted}}>งบประมาณ</span></div>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}><div style={{width:12,height:12,borderRadius:3,background:C.green,opacity:.85}}/><span style={{color:C.muted}}>ใช้จริง (ไม่เกิน)</span></div>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}><div style={{width:12,height:12,borderRadius:3,background:C.red,opacity:.85}}/><span style={{color:C.muted}}>เกินงบ</span></div>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}><div style={{width:12,height:12,borderRadius:3,background:C.orange,opacity:.15}}/><span style={{color:C.muted}}>เดือนแพงสุด</span></div>
            </div>
          </Card>
          {/* STACKED AREA: Per-channel trend */}
          <Card style={{padding:isMobileMode?12:20,marginBottom:20}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:14}}>📈 ค่าใช้จ่ายรายแพลตฟอร์ม — ปี {chartYear+543}</div>
            <div style={{overflowX:"auto"}}>
              {(()=>{
                const maxCh=Math.max(...yd.map(m=>Math.max(...m.items.map(it=>Number(it.actual)||0))),1);
                return<svg viewBox="0 0 700 240" style={{width:"100%",minWidth:600,height:240}}>
                  {[0,0.5,1].map((r,i)=>{const v=Math.round(maxCh*(1-r));const yp=20+r*180;return<g key={i}><line x1="55" y1={yp} x2="690" y2={yp} stroke={C.border} strokeWidth=".5" strokeDasharray="4"/><text x="50" y={yp+4} textAnchor="end" fill={C.muted} fontSize="8">{fmtMoney(v)}</text></g>;})}
                  {channels.map((ch,ci)=>{
                    const pts=yd.map((m,mi)=>{const it=m.items.find(x=>x.channel===ch);const val=it?Number(it.actual)||0:0;const x=65+mi*52+21;const yp=20+(1-val/maxCh)*180;return`${x},${yp}`;}).join(" ");
                    return<polyline key={ci} points={pts} fill="none" stroke={chColors[ci]} strokeWidth="2.5" opacity=".85"/>;
                  })}
                  {yd.map((m,mi)=>{
                    return channels.map((ch,ci)=>{
                      const it=m.items.find(x=>x.channel===ch);const val=it?Number(it.actual)||0:0;
                      if(val===0)return null;
                      const x=65+mi*52+21;const yp=20+(1-val/maxCh)*180;
                      return<circle key={`${mi}-${ci}`} cx={x} cy={yp} r="3" fill={chColors[ci]}/>;
                    });
                  })}
                  {yd.map((m,mi)=><text key={mi} x={65+mi*52+21} y={215} textAnchor="middle" fill={C.muted} fontSize="9">{thMonths[m.month]}</text>)}
                </svg>;
              })()}
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center",marginTop:10}}>
              {channels.map((ch,ci)=><div key={ci} style={{display:"flex",alignItems:"center",gap:4,fontSize:10}}><div style={{width:10,height:10,borderRadius:3,background:chColors[ci]}}/><span style={{color:C.muted}}>{ch}</span></div>)}
            </div>
          </Card>
          {/* Per-channel yearly summary table */}
          <Card style={{padding:isMobileMode?12:20}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>📋 สรุปรายแพลตฟอร์ม — ปี {chartYear+543}</div>
            {chTotals.map((ch,ci)=>{
              const isOver=ch.actual>ch.budget&&ch.budget>0;
              const maxChVal=Math.max(...chTotals.map(c=>Math.max(c.budget,c.actual)),1);
              return<div key={ci} style={{padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:3,background:ch.color}}/><span style={{fontSize:13,fontWeight:600,color:C.text}}>{ch.channel}</span></div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:12,fontWeight:700}}><span style={{color:C.blue}}>฿{fmtMoney(ch.budget)}</span> → <span style={{color:isOver?C.red:C.green}}>฿{fmtMoney(ch.actual)}</span></div>
                    {isOver&&<div style={{fontSize:10,fontWeight:800,color:C.red}}>⚠️ เกิน ฿{fmtMoney(ch.diff)} (+{ch.budget>0?Math.round(ch.diff/ch.budget*100):0}%)</div>}
                    {!isOver&&ch.budget>0&&ch.actual>0&&<div style={{fontSize:10,color:C.green}}>✅ ประหยัด ฿{fmtMoney(Math.abs(ch.diff))}</div>}
                  </div>
                </div>
                <div style={{height:6,background:C.faint,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min((ch.actual/maxChVal)*100,100)}%`,background:isOver?C.red:ch.color,opacity:.7,borderRadius:3}}/>
                </div>
              </div>;
            })}
          </Card>
        </>;
      })()}

      {/* ═══ COMPARE VIEW ═══ */}
      {viewMode==="compare"&&(()=>{
        const rangeData=getRangeData(cmpFrom,cmpTo);
        const maxR=Math.max(...rangeData.map(m=>m.totalActual),1);
        const grandCmpBudget=rangeData.reduce((s,m)=>s+m.totalBudget,0);
        const grandCmpActual=rangeData.reduce((s,m)=>s+m.totalActual,0);
        // Per-channel totals for range
        const chRangeTotals=channels.map((ch,ci)=>{
          const act=rangeData.reduce((s,m)=>{const it=m.items.find(x=>x.channel===ch);return s+(it?Number(it.actual)||0:0);},0);
          const bgt=rangeData.reduce((s,m)=>{const it=m.items.find(x=>x.channel===ch);return s+(it?Number(it.budget)||0:0);},0);
          return{channel:ch,color:chColors[ci],actual:act,budget:bgt};
        }).sort((a,b)=>b.actual-a.actual);
        return<>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            <span style={{fontSize:12,fontWeight:700,color:C.muted}}>ตั้งแต่:</span>
            <input type="month" value={cmpFrom} onChange={e=>setCmpFrom(e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.panel,color:C.text,fontSize:12}}/>
            <span style={{fontSize:12,fontWeight:700,color:C.muted}}>ถึง:</span>
            <input type="month" value={cmpTo} onChange={e=>setCmpTo(e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.panel,color:C.text,fontSize:12}}/>
            <Tag color="blue">{rangeData.length} เดือน</Tag>
          </div>
          {/* KPI */}
          <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr 1fr":"1fr 1fr 1fr",gap:12,marginBottom:20}}>
            <Card style={{padding:14,borderLeft:`4px solid ${C.blue}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4}}>📋 งบรวม</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:C.blue}}>฿{fmtMoney(grandCmpBudget)}</div></Card>
            <Card style={{padding:14,borderLeft:`4px solid ${grandCmpActual>grandCmpBudget?C.red:C.green}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4}}>💸 ใช้จริงรวม</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:grandCmpActual>grandCmpBudget?C.red:C.green}}>฿{fmtMoney(grandCmpActual)}</div></Card>
            <Card style={{padding:14,borderLeft:`4px solid ${C.orange}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4}}>📊 เฉลี่ย/เดือน</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:C.text}}>฿{fmtMoney(rangeData.length>0?Math.round(grandCmpActual/rangeData.length):0)}</div></Card>
          </div>
          {/* Trend chart for range */}
          <Card style={{padding:isMobileMode?12:20,marginBottom:20}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:14}}>📈 แนวโน้มค่าใช้จ่าย</div>
            <div style={{overflowX:"auto"}}>
              {(()=>{
                const bW=Math.max(52,Math.min(700/rangeData.length,70));
                const cW=Math.max(rangeData.length*bW+80,500);
                return<svg viewBox={`0 0 ${cW} 260`} style={{width:"100%",minWidth:cW,height:260}}>
                  {[0,0.25,0.5,0.75,1].map((r,i)=>{const v=Math.round(maxR*(1-r));const yp=30+r*190;return<g key={i}><line x1="55" y1={yp} x2={cW-10} y2={yp} stroke={C.border} strokeWidth=".5" strokeDasharray="4"/><text x="50" y={yp+4} textAnchor="end" fill={C.muted} fontSize="8">{fmtMoney(v)}</text></g>;})}
                  {rangeData.map((m,i)=>{
                    const x=65+i*bW;const aH=maxR>0?(m.totalActual/maxR)*190:0;
                    const isOver=m.totalActual>m.totalBudget&&m.totalBudget>0;
                    // Stacked bars per channel
                    let cy=220;
                    return<g key={i}>
                      {channels.map((ch,ci)=>{
                        const it=m.items.find(x2=>x2.channel===ch);const val=it?Number(it.actual)||0:0;
                        const h=maxR>0?(val/maxR)*190:0;
                        const prevY=cy;cy-=h;
                        return h>0?<rect key={ci} x={x+4} y={prevY-h} width={bW-8} height={h} fill={chColors[ci]} opacity=".8"/>:null;
                      })}
                      <text x={x+bW/2} y={238} textAnchor="middle" fill={C.muted} fontSize={rangeData.length>18?"7":"8"} fontWeight="500">{thMonths[m.month]}{rangeData.length>12?`'${String(m.year).slice(2)}`:""}</text>
                      {isOver&&<text x={x+bW/2} y={220-aH-4} textAnchor="middle" fill={C.red} fontSize="7" fontWeight="700">!</text>}
                    </g>;
                  })}
                </svg>;
              })()}
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center",marginTop:10}}>
              {channels.map((ch,ci)=><div key={ci} style={{display:"flex",alignItems:"center",gap:4,fontSize:10}}><div style={{width:10,height:10,borderRadius:3,background:chColors[ci]}}/><span style={{color:C.muted}}>{ch}</span></div>)}
            </div>
          </Card>
          {/* Ranking: platform spend */}
          <Card style={{padding:isMobileMode?12:20}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>🏆 อันดับแพลตฟอร์ม (ใช้มากสุด → น้อยสุด)</div>
            {chRangeTotals.map((ch,i)=>{
              const maxChR=Math.max(...chRangeTotals.map(c=>c.actual),1);
              const isOver=ch.actual>ch.budget&&ch.budget>0;
              return<div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{width:28,height:28,borderRadius:8,background:i===0?C.orange:i===1?"#94a3b8":"#78716c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",flexShrink:0}}>{i+1}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:2,background:ch.color}}/><span style={{fontSize:13,fontWeight:600,color:C.text}}>{ch.channel}</span></div>
                    <div style={{textAlign:"right"}}>
                      <span style={{fontSize:13,fontWeight:800,color:isOver?C.red:C.text}}>฿{fmtMoney(ch.actual)}</span>
                      {isOver&&<span style={{fontSize:10,color:C.red,marginLeft:6}}>เกิน ฿{fmtMoney(ch.actual-ch.budget)}</span>}
                    </div>
                  </div>
                  <div style={{height:6,background:C.faint,borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${(ch.actual/maxChR*100)}%`,background:ch.color,opacity:.75,borderRadius:3}}/>
                  </div>
                </div>
              </div>;
            })}
          </Card>
        </>;
      })()}

      {/* EDIT MODAL */}
      {editMdl&&(
        <Mdl title={`💰 งบการตลาด — ${thMonthsFull[mo]} ${y+543}`} onClose={()=>setEditMdl(false)} footer={<><Btn variant="ghost" onClick={()=>setEditMdl(false)}>ยกเลิก</Btn><Btn onClick={save}>💾 บันทึก</Btn></>}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {form.items.map((it,i)=>(
              <div key={i} style={{padding:12,background:"#0d1117",borderRadius:8,border:`1px solid ${C.border}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><div style={{width:10,height:10,borderRadius:3,background:chColors[i]}}/><span style={{fontSize:13,fontWeight:700,color:C.text}}>{it.channel}</span></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <FG label="งบประมาณ"><FIn type="number" value={it.budget} onChange={e=>{const items=[...form.items];items[i]={...items[i],budget:e.target.value};setForm(f=>({...f,items}));}}/></FG>
                  <FG label="ใช้จริง"><FIn type="number" value={it.actual} onChange={e=>{const items=[...form.items];items[i]={...items[i],actual:e.target.value};setForm(f=>({...f,items}));}}/></FG>
                </div>
              </div>
            ))}
          </div>
        </Mdl>
      )}
    </div>
  );
}

// ── Customer Data (Walk-in) Page ──────────────────────────────
function CustomerDataPage({data,setData,role,isMobileMode,setPage}) {
  const canEdit=["owner","marketing","sales"].includes(role);
  const [editMdl,setEditMdl]=useState(null);
  const [form,setForm]=useState({});
  const [pdfPreview,setPdfPreview]=useState(null);
  const [pdfLoading2,setPdfLoading2]=useState(false);
  const interestOpts=["ชอบบ้าน","ชอบบ้านแต่เครดิตไม่ถึง","ไม่ชอบบ้าน","จอง"];
  const INTEREST_COL={"ชอบบ้าน":"green","ชอบบ้านแต่เครดิตไม่ถึง":"orange","ไม่ชอบบ้าน":"red","จอง":"blue"};
  const customers=data.walkInCustomers||[];
  const salesMembers=data.team.filter(t=>t.role==="sales"&&t.status==="active");
  const channelOpts=["Facebook","TikTok TheCloud","TikTok บ้านสไตล์บอส","เซลล์โครงการ","LINE","Google","อื่นๆ"];
  const bankOpts=["ธอส. (GHB)","กสิกรไทย (KBank)","กรุงไทย (KTB)","ไทยพาณิชย์ (SCB)","กรุงเทพ (BBL)","ทหารไทยธนชาต (TTB)","กรุงศรี (BAY)","ออมสิน (GSB)","เกียรตินาคินภัทร (KKP)","ซีไอเอ็มบี (CIMB)","อื่นๆ"];
  const maritalOpts=["โสด","แต่งงานแล้ว","หย่า/แยกทาง"];
  const houseStyleOpts=["ทาวน์โฮม","บ้านเดี่ยว","บ้านแฝด","คอนโดมิเนียม","อาคารพาณิชย์","ที่ดินเปล่า"];
  const houseFloorOpts=["1 ชั้น","2 ชั้น","3 ชั้น","4 ชั้น","มากกว่า 4 ชั้น"];
  const bedroomOpts=["1 นอน 1 น้ำ","2 นอน 1 น้ำ","2 นอน 2 น้ำ","3 นอน 2 น้ำ","3 นอน 3 น้ำ","4 นอน 2 น้ำ","4 นอน 3 น้ำ","4 นอน 4 น้ำ","5 นอน 3 น้ำ","5 นอน 4 น้ำ","5 นอน 5 น้ำ","อื่นๆ"];
  const thaiProvinces=["กรุงเทพมหานคร","กระบี่","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร","ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี","ชัยนาท","ชัยภูมิ","ชุมพร","เชียงราย","เชียงใหม่","ตรัง","ตราด","ตาก","นครนายก","นครปฐม","นครพนม","นครราชสีมา","นครศรีธรรมราช","นครสวรรค์","นนทบุรี","นราธิวาส","น่าน","บึงกาฬ","บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์","ปราจีนบุรี","ปัตตานี","พระนครศรีอยุธยา","พะเยา","พังงา","พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี","เพชรบูรณ์","แพร่","ภูเก็ต","มหาสารคาม","มุกดาหาร","แม่ฮ่องสอน","ยโสธร","ยะลา","ร้อยเอ็ด","ระนอง","ระยอง","ราชบุรี","ลพบุรี","ลำปาง","ลำพูน","เลย","ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ","สมุทรสงคราม","สมุทรสาคร","สระแก้ว","สระบุรี","สิงห์บุรี","สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์","หนองคาย","หนองบัวลำภู","อ่างทอง","อำนาจเจริญ","อุดรธานี","อุตรดิตถ์","อุทัยธานี","อุบลราชธานี"];
  function calcMonthly(principal,annualRate,years){
    if(!principal||!annualRate||!years)return 0;
    const r=annualRate/100/12;
    const n=years*12;
    if(r===0)return principal/n;
    return Math.round(principal*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1));
  }
  function openAdd(){setForm({id:uid(),name:"",phone:"",age:"",occupation:"",income:"",walkInDate:new Date().toISOString().slice(0,10),channel:"",channels:[],channelOther:"",channelDetail:"",channelDetailOther:"",salesPerson:"",bookingDate:"",bookingHouseId:"",note:"",bankLoans:[],interestLevel:"",lookingForHouseType:"",houseStyle:"",houseFloors:"",bedroomConfig:"",workPlace:"",preferredArea:"",searchZone:"",province:"",district:"",subDistrict:"",carInstallment:"",otherDebts:"",numberOfChildren:"",maritalStatus:"",notBookedReason:"",promotion:""});setEditMdl("add");}
  function openEdit(c){const chs=c.channels||(c.channel?[c.channel]:[]);setForm({...c,channels:chs,channelOther:c.channelOther||"",bankLoans:c.bankLoans||[],interestLevel:c.interestLevel||"",lookingForHouseType:c.lookingForHouseType||"",houseStyle:c.houseStyle||"",houseFloors:c.houseFloors||"",bedroomConfig:c.bedroomConfig||"",workPlace:c.workPlace||"",preferredArea:c.preferredArea||"",searchZone:c.searchZone||"",province:c.province||"",district:c.district||"",subDistrict:c.subDistrict||"",carInstallment:c.carInstallment||"",otherDebts:c.otherDebts||"",numberOfChildren:c.numberOfChildren||"",maritalStatus:c.maritalStatus||"",notBookedReason:c.notBookedReason||"",promotion:c.promotion||""});setEditMdl("edit");}
  function addBank(){setForm(f=>({...f,bankLoans:[...(f.bankLoans||[]),{id:uid(),bankName:"",promoName:"",rate1:"",rate2:"",rate3:"",loanAmount:"",loanYears:30}]}));}
  function removeBank(id){setForm(f=>({...f,bankLoans:f.bankLoans.filter(b=>b.id!==id)}));}
  function updateBank(id,key,val){setForm(f=>({...f,bankLoans:f.bankLoans.map(b=>b.id===id?{...b,[key]:val}:b)}));}
  function save(){
    const isBooking=form.interestLevel==="จอง"&&form.bookingHouseId;
    setData(d=>{
      const wc=d.walkInCustomers||[];
      const idx=wc.findIndex(c=>c.id===form.id);
      let nd={...d,walkInCustomers:idx>=0?wc.map(c=>c.id===form.id?form:c):[...wc,form]};
      if(isBooking){
        const hId=Number(form.bookingHouseId);
        const ec=nd.customers.find(c=>c.houseId===hId);
        const cd={houseId:hId,name:form.name,phone:form.phone,type:"loan",bank:"",preApproved:false,prob:75,note:form.note||"",price:ec?.price||"",promotionItems:ec?.promotionItems||[],booked:true,isModelHouse:ec?.isModelHouse||false,bankLoans:form.bankLoans||[],salesPersons:ec?.salesPersons||[]};
        nd={...nd,customers:ec?nd.customers.map(c=>c.houseId===hId?{...c,...cd}:c):[...nd.customers,cd],houses:nd.houses.map(h=>h.id===hId?{...h,customer:form.name}:h)};
        if(!ec?.booked){
          const h=nd.houses.find(h=>h.id===hId);
          const me=nd.team.find(t=>t.role===role&&t.status==="active");
          nd={...nd,bookingAlerts:[...(nd.bookingAlerts||[]),{id:uid(),houseId:hId,houseName:h?.name||"",customerName:form.name,bookedBy:me?.name||ROLE_LBL[role],salesPersons:[],date:new Date().toISOString().slice(0,10)}]};
        }
      }
      return nd;
    });
    setEditMdl(null);
    if(isBooking&&setPage)setPage("marketing");
  }
  async function exportCustPDF(c){
    setPdfLoading2(true);
    const linked=getLinkedHouseData(c.bookingHouseId);
    const houseTypeStr=[c.houseStyle,c.houseFloors,c.bedroomConfig].filter(Boolean).join(" / ")||(c.lookingForHouseType||"");
    const areaStr=c.searchZone||[c.subDistrict,c.district,c.province].filter(Boolean).join(", ")||(c.preferredArea||"");
    const projectName=linked?data.projects.find(p=>p.id===linked.house.projectId)?.name||"":"";
    const promoText=c.promotion||"";
    const el=document.createElement("div");
    el.style.cssText="position:fixed;left:-9999px;top:0;width:794px;background:#fff;padding:48px 44px;font-family:'Noto Sans Thai',sans-serif;color:#1a1a1a;line-height:1.6;";
    el.innerHTML=`
      <div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:3px solid #2563eb;">
        <div style="font-size:28px;font-weight:800;color:#2563eb;">📋 ข้อมูลลูกค้า</div>
        ${projectName?`<div style="font-size:14px;color:#1e3a5f;margin-top:6px;font-weight:600;">โครงการ ${projectName}</div>`:""}
        <div style="font-size:14px;color:#6b7280;margin-top:8px;">ระบบ CPMS — ${new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"})}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">วัน Walk-in: ${c.walkInDate||"—"}${c.bookingDate?` | วันจอง: ${c.bookingDate}`:""}</div>
      </div>
      ${linked?`<div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:16px;padding:20px;margin-bottom:24px;border:1px solid #86efac;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;"><div><div style="font-size:11px;color:#15803d;font-weight:700;text-transform:uppercase;">ข้อมูลบ้านที่จอง</div><div style="font-size:22px;font-weight:900;color:#166534;margin-top:4px;">🏡 บ้าน ${linked.house.name}</div></div>${linked.customer?.price?`<div style="text-align:right;"><div style="font-size:11px;color:#15803d;font-weight:700;">ราคาบ้าน</div><div style="font-size:26px;font-weight:900;color:#166534;">฿${Number(linked.customer.price).toLocaleString()}</div></div>`:""}</div></div>`:""}
      ${promoText?`<div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border-radius:16px;padding:18px;margin-bottom:24px;border:1px solid #fbbf24;"><div style="font-size:14px;font-weight:800;color:#92400e;margin-bottom:6px;">🏷️ โปรโมชั่น/ของแถม</div><div style="font-size:13px;color:#78350f;">${promoText}</div></div>`:""}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div style="background:#f8fafc;border-radius:12px;padding:16px;border:1px solid #e2e8f0;">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700;">ข้อมูลส่วนตัว</div>
          <div style="font-size:18px;font-weight:700;margin-top:8px;">${c.name||"—"}</div>
          <div style="margin-top:6px;font-size:13px;">📞 ${c.phone||"—"}</div>
          <div style="margin-top:4px;font-size:13px;">อายุ: ${c.age||"—"} | อาชีพ: ${c.occupation||"—"}</div>
          <div style="margin-top:4px;font-size:13px;">รายได้: ${c.income?"฿"+Number(c.income).toLocaleString():"—"}/เดือน</div>
          ${c.maritalStatus?`<div style="margin-top:4px;font-size:13px;">สถานะ: ${c.maritalStatus} | บุตร: ${c.numberOfChildren||"—"} คน</div>`:""}
          ${c.workPlace?`<div style="margin-top:4px;font-size:13px;">💼 ${c.workPlace}</div>`:""}
        </div>
        <div style="background:#f8fafc;border-radius:12px;padding:16px;border:1px solid #e2e8f0;">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700;">ความสนใจ & การค้นหา</div>
          ${c.interestLevel?`<div style="margin-top:8px;font-size:14px;font-weight:600;">⭐ ${c.interestLevel}</div>`:""}
          ${houseTypeStr?`<div style="margin-top:6px;font-size:13px;">🏠 บ้านที่สนใจ: ${houseTypeStr}</div>`:""}
          ${areaStr?`<div style="margin-top:4px;font-size:13px;">📍 พื้นที่: ${areaStr}</div>`:""}
          ${(c.channels||[]).length>0?`<div style="margin-top:6px;font-size:13px;">📢 ช่องทาง: ${c.channels.join(", ")}${c.channelOther?` (${c.channelOther})`:""}</div>`:""}
          ${c.channelDetail?`<div style="margin-top:4px;font-size:13px;">👤 เซลล์: ${c.channelDetail}</div>`:""}
        </div>
      </div>
      ${c.notBookedReason?`<div style="background:#fef3c7;border-radius:12px;padding:16px;border:1px solid #fbbf24;margin-bottom:24px;"><div style="font-size:11px;color:#92400e;font-weight:700;">📝 สาเหตุที่ยังไม่จอง</div><div style="margin-top:8px;font-size:14px;font-weight:600;color:#78350f;">${c.notBookedReason}</div></div>`:""}
      ${c.carInstallment||c.otherDebts?`<div style="background:#fffbeb;border-radius:12px;padding:16px;border:1px solid #fef3c7;margin-bottom:24px;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700;">ภาระหนี้สิน</div>${c.carInstallment?`<div style="margin-top:8px;font-size:13px;">🚗 ค่าผ่อนรถ: ฿${Number(c.carInstallment).toLocaleString()}/เดือน</div>`:""}${c.otherDebts?`<div style="margin-top:4px;font-size:13px;">💳 หนี้อื่นๆ: ${c.otherDebts}</div>`:""}</div>`:""}
      ${linked?`<div style="background:#f0fdf4;border-radius:12px;padding:16px;border:1px solid #bbf7d0;margin-bottom:24px;"><div style="font-size:11px;color:#6b7280;font-weight:700;">ข้อมูลการจอง</div><div style="margin-top:8px;font-size:16px;font-weight:700;color:#16a34a;">🏠 บ้าน ${linked.house.name}</div>${linked.customer?.price?`<div style="font-size:14px;color:#2563eb;font-weight:700;">ราคา: ฿${Number(linked.customer.price).toLocaleString()}</div>`:""}${c.bookingDate?`<div style="font-size:13px;">📅 วันจอง: ${c.bookingDate}</div>`:""}</div>`:""}
      ${(c.bankLoans||[]).length>0?`<div style="margin-bottom:24px;"><div style="font-size:14px;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;">🏦 ธนาคารที่ยื่นกู้</div>${c.bankLoans.map((b,i)=>{const la=b.loanAmount?Number(b.loanAmount):0;const yr=b.loanYears?Number(b.loanYears):30;const r1=Number(b.rate1)||0;const r2=Number(b.rate2)||0;const r3=Number(b.rate3)||0;const cm=(p,r,y)=>{if(!p||!r||!y)return 0;const mr=r/100/12;const n=y*12;return Math.round(p*mr*Math.pow(1+mr,n)/(Math.pow(1+mr,n)-1));};return`<div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:8px;border:1px solid #e2e8f0;"><div style="font-weight:700;color:#2563eb;">ธนาคารที่ ${i+1}: ${b.bankName||"—"}</div>${b.promoName?`<div style="font-size:12px;color:#6b7280;">โปรโมชั่น: ${b.promoName}</div>`:""}${la?`<div style="font-size:12px;">ยอดกู้: ฿${la.toLocaleString()} / ${yr} ปี</div>`:""}${la&&(r1||r2||r3)?`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px;">${r1?`<div style="text-align:center;background:#f0fdf4;border-radius:8px;padding:8px;"><div style="font-size:10px;color:#6b7280;">ปีที่ 1 (${b.rate1}%)</div><div style="font-size:16px;font-weight:800;color:#16a34a;">฿${cm(la,r1,yr).toLocaleString()}</div></div>`:"<div></div>"}${r2?`<div style="text-align:center;background:#fffbeb;border-radius:8px;padding:8px;"><div style="font-size:10px;color:#6b7280;">ปีที่ 2 (${b.rate2}%)</div><div style="font-size:16px;font-weight:800;color:#ea580c;">฿${cm(la,r2,yr).toLocaleString()}</div></div>`:"<div></div>"}${r3?`<div style="text-align:center;background:#eff6ff;border-radius:8px;padding:8px;"><div style="font-size:10px;color:#6b7280;">ปีที่ 3+ (${b.rate3}%)</div><div style="font-size:16px;font-weight:800;color:#2563eb;">฿${cm(la,r3,yr).toLocaleString()}</div></div>`:"<div></div>"}</div>`:""}</div>`;}).join("")}</div>`:""}
      ${c.note?`<div style="background:#f8fafc;border-radius:12px;padding:16px;border:1px solid #e2e8f0;margin-bottom:24px;"><div style="font-size:11px;color:#6b7280;font-weight:700;">หมายเหตุ</div><div style="margin-top:8px;font-size:13px;">${c.note}</div></div>`:""}
      <div style="margin-top:36px;padding-top:18px;border-top:2px solid #e2e8f0;text-align:center;"><div style="color:#9ca3af;font-size:11px;">เอกสารโดยระบบ CPMS — ${new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"})}</div></div>
    `;
    document.body.appendChild(el);
    try{
      const canvas=await html2canvas(el,{scale:2,useCORS:true,allowTaint:true,logging:false,windowWidth:794});
      const imgData=canvas.toDataURL("image/jpeg",0.95);
      const pdf=new jsPDF("p","mm","a4");
      const pw=pdf.internal.pageSize.getWidth();const ph2=pdf.internal.pageSize.getHeight();
      const iw=pw;const ih=(canvas.height*iw)/canvas.width;
      let pos=0;pdf.addImage(imgData,"JPEG",0,pos,iw,ih);
      let left=ih-ph2;while(left>0){pdf.addPage();pos-=ph2;pdf.addImage(imgData,"JPEG",0,pos,iw,ih);left-=ph2;}
      dlBlob(pdf.output("blob"),`ข้อมูลลูกค้า_${c.name||"ลูกค้า"}.pdf`);
    }catch(e){alert("เกิดข้อผิดพลาด: "+e.message);}
    document.body.removeChild(el);setPdfLoading2(false);
  }
  const [custPdfPreview,setCustPdfPreview]=useState(null);
  async function exportCustomerFacingPDF(c){
    setPdfLoading2(true);
    const linked=getLinkedHouseData(c.bookingHouseId);
    const housePromos=linked?.customer?.promotionItems||(linked?.customer?.promotion?[{id:1,text:linked.customer.promotion}]:[]);
    const custPromo=c.promotion||"";
    const houseTypeStr=[c.houseStyle,c.houseFloors,c.bedroomConfig].filter(Boolean).join(" / ")||(c.lookingForHouseType||"");
    const areaStr=c.searchZone||[c.subDistrict,c.district,c.province].filter(Boolean).join(", ")||(c.preferredArea||"");
    const projectName=linked?data.projects.find(p=>p.id===linked.house.projectId)?.name||"":"";
    const el=document.createElement("div");
    el.style.cssText="position:fixed;left:-9999px;top:0;width:794px;background:#fff;padding:0;font-family:'Noto Sans Thai',sans-serif;color:#1a1a1a;line-height:1.6;";
    el.innerHTML=`
      <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);color:#fff;padding:40px 44px 32px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-30px;right:-30px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.06);"></div>
        <div style="position:absolute;bottom:-40px;left:-20px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.04);"></div>
        <div style="position:relative;z-index:1;">
          <div style="font-size:30px;font-weight:900;letter-spacing:1px;">🏠 เอกสารข้อมูลบ้าน</div>
          ${projectName?`<div style="font-size:16px;margin-top:6px;font-weight:600;opacity:0.9;">โครงการ ${projectName}</div>`:""}
          <div style="font-size:12px;margin-top:10px;opacity:0.7;">วันที่ออกเอกสาร: ${new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"})}</div>
        </div>
      </div>
      <div style="padding:32px 44px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <div style="font-size:20px;font-weight:800;color:#1e3a5f;">คุณ ${c.name||"—"}</div>
          ${houseTypeStr?`<div style="background:#dbeafe;color:#2563eb;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">${houseTypeStr}</div>`:""}
        </div>
        ${linked?`
        <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #86efac;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
            <div>
              <div style="font-size:11px;color:#15803d;font-weight:700;text-transform:uppercase;letter-spacing:1px;">ข้อมูลบ้าน</div>
              <div style="font-size:24px;font-weight:900;color:#166534;margin-top:6px;">🏡 บ้าน ${linked.house.name}</div>
              ${areaStr?`<div style="font-size:13px;color:#15803d;margin-top:4px;">📍 ${areaStr}</div>`:""}
            </div>
            ${linked.customer?.price?`<div style="text-align:right;"><div style="font-size:11px;color:#15803d;font-weight:700;">ราคาบ้าน</div><div style="font-size:28px;font-weight:900;color:#166534;">฿${Number(linked.customer.price).toLocaleString()}</div></div>`:""}
          </div>
        </div>
        `:""}
        ${housePromos.length>0?`
        <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border-radius:16px;padding:20px;margin-bottom:24px;border:1px solid #fbbf24;">
          <div style="font-size:14px;font-weight:800;color:#92400e;margin-bottom:10px;">🏷️ โปรโมชั่นพิเศษ</div>
          ${housePromos.map((p,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;${i>0?"border-top:1px solid #fde68a;":""}"><div style="width:24px;height:24px;border-radius:50%;background:#f59e0b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;">${i+1}</div><div style="font-size:13px;color:#78350f;font-weight:600;">${p.text}</div></div>`).join("")}
          ${custPromo?`<div style="margin-top:8px;padding-top:8px;border-top:1px solid #fde68a;font-size:13px;color:#78350f;">🎁 ${custPromo}</div>`:""}
        </div>
        `:""}
        ${!housePromos.length&&custPromo?`
        <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border-radius:16px;padding:20px;margin-bottom:24px;border:1px solid #fbbf24;">
          <div style="font-size:14px;font-weight:800;color:#92400e;margin-bottom:10px;">🏷️ โปรโมชั่นพิเศษ</div>
          <div style="font-size:13px;color:#78350f;font-weight:600;">🎁 ${custPromo}</div>
        </div>
        `:""}
        ${(c.bankLoans||[]).length>0?`
        <div style="margin-bottom:24px;">
          <div style="font-size:16px;font-weight:800;color:#1e3a5f;margin-bottom:16px;padding-bottom:8px;border-bottom:3px solid #2563eb;">🏦 ตัวเลือกสินเชื่อ</div>
          ${c.bankLoans.map((b,i)=>{const la=b.loanAmount?Number(b.loanAmount):0;const yr=b.loanYears?Number(b.loanYears):30;const r1=Number(b.rate1)||0;const r2=Number(b.rate2)||0;const r3=Number(b.rate3)||0;const cm=(p,r,y)=>{if(!p||!r||!y)return 0;const mr=r/100/12;const n=y*12;return Math.round(p*mr*Math.pow(1+mr,n)/(Math.pow(1+mr,n)-1));};const p1=cm(la,r1,yr);const p2=cm(la,r2,yr);const p3=cm(la,r3,yr);return`
          <div style="background:#f8fafc;border-radius:14px;padding:20px;margin-bottom:12px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <div>
                <div style="font-size:16px;font-weight:800;color:#2563eb;">${b.bankName||"ธนาคาร"}</div>
                ${b.promoName?`<div style="font-size:12px;color:#6b7280;margin-top:2px;">✨ ${b.promoName}</div>`:""}
              </div>
              ${la?`<div style="text-align:right;"><div style="font-size:10px;color:#6b7280;">ยอดกู้</div><div style="font-size:18px;font-weight:800;color:#1e3a5f;">฿${la.toLocaleString()}</div><div style="font-size:10px;color:#6b7280;">ระยะเวลา ${yr} ปี (${yr*12} งวด)</div></div>`:""}
            </div>
            ${la&&(r1||r2||r3)?`
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
              ${r1?`<div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:12px;padding:14px;text-align:center;border:1px solid #86efac;">
                <div style="font-size:10px;color:#15803d;font-weight:600;">ปีที่ 1</div>
                <div style="font-size:11px;color:#6b7280;margin-top:2px;">ดอกเบี้ย ${b.rate1}%</div>
                <div style="font-size:22px;font-weight:900;color:#166534;margin-top:6px;">฿${p1.toLocaleString()}</div>
                <div style="font-size:10px;color:#15803d;">บาท/เดือน</div>
              </div>`:`<div></div>`}
              ${r2?`<div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border-radius:12px;padding:14px;text-align:center;border:1px solid #fbbf24;">
                <div style="font-size:10px;color:#92400e;font-weight:600;">ปีที่ 2</div>
                <div style="font-size:11px;color:#6b7280;margin-top:2px;">ดอกเบี้ย ${b.rate2}%</div>
                <div style="font-size:22px;font-weight:900;color:#92400e;margin-top:6px;">฿${p2.toLocaleString()}</div>
                <div style="font-size:10px;color:#92400e;">บาท/เดือน</div>
              </div>`:`<div></div>`}
              ${r3?`<div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:12px;padding:14px;text-align:center;border:1px solid #93c5fd;">
                <div style="font-size:10px;color:#1e40af;font-weight:600;">ปีที่ 3+</div>
                <div style="font-size:11px;color:#6b7280;margin-top:2px;">ดอกเบี้ย ${b.rate3}%</div>
                <div style="font-size:22px;font-weight:900;color:#1e40af;margin-top:6px;">฿${p3.toLocaleString()}</div>
                <div style="font-size:10px;color:#1e40af;">บาท/เดือน</div>
              </div>`:`<div></div>`}
            </div>
            `:""}</div>`;}).join("")}
        </div>
        `:""}
        <div style="margin-top:32px;padding-top:20px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
          <div style="color:#9ca3af;font-size:11px;">เอกสารนี้จัดทำโดยระบบ CPMS<br/>${new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"})}</div>
          <div style="text-align:right;color:#6b7280;font-size:10px;">เอกสารนี้ใช้เพื่อการพิจารณาเท่านั้น<br/>ข้อมูลอาจเปลี่ยนแปลงได้โดยไม่ต้องแจ้งล่วงหน้า</div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    try{
      const canvas=await html2canvas(el,{scale:2,useCORS:true,allowTaint:true,logging:false,windowWidth:794});
      const imgData=canvas.toDataURL("image/jpeg",0.95);
      const pdf=new jsPDF("p","mm","a4");
      const pw=pdf.internal.pageSize.getWidth();const ph2=pdf.internal.pageSize.getHeight();
      const iw=pw;const ih=(canvas.height*iw)/canvas.width;
      let pos=0;pdf.addImage(imgData,"JPEG",0,pos,iw,ih);
      let left=ih-ph2;while(left>0){pdf.addPage();pos-=ph2;pdf.addImage(imgData,"JPEG",0,pos,iw,ih);left-=ph2;}
      dlBlob(pdf.output("blob"),`เอกสารบ้าน_${c.name||"ลูกค้า"}.pdf`);
    }catch(e){alert("เกิดข้อผิดพลาด: "+e.message);}
    document.body.removeChild(el);setPdfLoading2(false);
  }
  function del(id){if(confirm("ลบข้อมูลลูกค้านี้?")){setData(d=>({...d,walkInCustomers:(d.walkInCustomers||[]).filter(c=>c.id!==id)}));}}
  function getLinkedHouseData(houseId){
    if(!houseId)return null;
    const house=data.houses.find(h=>h.id===Number(houseId));
    const cust=data.customers.find(c=>c.houseId===Number(houseId));
    return house?{house,customer:cust}:null;
  }
  return (
    <div style={{padding:isMobileMode?12:24}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:8}}>
        <div><div style={{fontSize:isMobileMode?18:22,fontWeight:700,color:C.text}}>👤 ข้อมูลลูกค้าการตลาด</div><div style={{fontSize:13,color:C.muted,marginTop:2}}>ข้อมูลลูกค้า Walk-in ช่องทางการตลาด และสินเชื่อธนาคาร</div></div>
        <div style={{display:"flex",gap:8}}>
          <Card style={{padding:"8px 13px",textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:C.blue}}>{customers.length}</div><div style={{fontSize:10,color:C.muted}}>ทั้งหมด</div></Card>
          <Card style={{padding:"8px 13px",textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:C.green}}>{customers.filter(c=>c.bookingHouseId).length}</div><div style={{fontSize:10,color:C.muted}}>จองแล้ว</div></Card>
          {canEdit&&<Btn onClick={openAdd}>+ เพิ่มลูกค้า</Btn>}
        </div>
      </div>
      {isMobileMode?(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {customers.length===0&&<Card style={{padding:20,textAlign:"center"}}><div style={{color:C.muted}}>ยังไม่มีข้อมูลลูกค้า</div></Card>}
          {customers.map(c=>{
            const linked=getLinkedHouseData(c.bookingHouseId);
            const promoItems=linked?.customer?.promotionItems||(linked?.customer?.promotion?[{id:1,text:linked.customer.promotion}]:[]);
            return (
              <Card key={c.id} style={{padding:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:6}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.text}}>{c.name||"—"}</div>
                  <div style={{display:"flex",gap:4}}>
                    {canEdit&&<Btn size="sm" variant="ghost" onClick={()=>openEdit(c)}>✏️</Btn>}
                    {canEdit&&<Btn size="sm" variant="ghost" onClick={()=>del(c.id)}>🗑</Btn>}
                  </div>
                </div>
                {c.phone&&<div style={{fontSize:12,marginBottom:2}}><a href={`tel:${c.phone}`} style={{color:C.blue,textDecoration:"none"}}>📞 {c.phone}</a></div>}
                <div style={{fontSize:11,color:C.muted}}>Walk-in: {fmtDate(c.walkInDate)} | ช่องทาง: {(c.channels||[c.channel]).filter(Boolean).join(", ")||"—"}{c.channelOther?` (${c.channelOther})`:""}{c.channelDetail?` (${c.channelDetail})`:""}</div>
                {c.interestLevel&&<div style={{marginTop:4}}><Tag color={INTEREST_COL[c.interestLevel]||"gray"}>{c.interestLevel}</Tag></div>}
                {linked&&<div style={{fontSize:11,color:C.green,marginTop:4}}>🏠 {linked.house.name} · {fmtDate(c.bookingDate)}{linked.customer?.price?` · ฿${fmtMoney(Number(linked.customer.price))}`:""}</div>}
                {promoItems.length>0&&<div style={{marginTop:4,padding:"6px 8px",background:C.faint,borderRadius:6}}><div style={{fontSize:10,fontWeight:700,color:C.orange,marginBottom:2}}>🏷️ โปรโมชั่นบ้าน:</div>{promoItems.map((p,i)=><div key={p.id} style={{fontSize:10,color:C.orange}}>{i+1}. {p.text}</div>)}</div>}
                {(c.bankLoans||[]).length>0&&<div style={{marginTop:4}}><div style={{fontSize:10,fontWeight:700,color:C.blue}}>🏦 ธนาคาร: {c.bankLoans.map(b=>b.bankName).join(", ")}</div></div>}
              </Card>
            );
          })}
        </div>
      ):(
      <Card>
        <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:1050}}>
          <thead><tr>{["ชื่อ","เบอร์โทร","อายุ","อาชีพ","รายได้","วัน Walk-in","ช่องทาง","ความสนใจ","โปรโมชั่นบ้าน","ธนาคารกู้","วันจอง",""].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`,background:"#0d1117",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>
            {customers.length===0&&<tr><td colSpan={12} style={{padding:20,textAlign:"center",color:C.muted}}>ยังไม่มีข้อมูลลูกค้า</td></tr>}
            {customers.map(c=>{
              const linked=getLinkedHouseData(c.bookingHouseId);
              const promoItems=linked?.customer?.promotionItems||(linked?.customer?.promotion?[{id:1,text:linked.customer.promotion}]:[]);
              return (
                <tr key={c.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background=C.panel} onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td style={{padding:"8px 10px",fontSize:13,color:C.text,fontWeight:600}}>{c.name}</td>
                  <td style={{padding:"8px 10px",fontSize:12}}><a href={`tel:${c.phone}`} style={{color:C.blue,textDecoration:"none"}}>{c.phone}</a></td>
                  <td style={{padding:"8px 10px",fontSize:12,color:C.muted}}>{c.age||"—"}</td>
                  <td style={{padding:"8px 10px",fontSize:12,color:C.muted}}>{c.occupation||"—"}</td>
                  <td style={{padding:"8px 10px",fontSize:12,color:C.muted}}>{c.income?`฿${fmtMoney(Number(c.income))}`:"—"}</td>
                  <td style={{padding:"8px 10px",fontSize:12,color:C.text}}>{fmtDate(c.walkInDate)}</td>
                  <td style={{padding:"8px 10px"}}>{(()=>{const chs=(c.channels||[c.channel]).filter(Boolean);return chs.length>0?chs.map((ch,i)=><Tag key={i} color="blue" style={{marginRight:4,marginBottom:2}}>{ch}</Tag>):"—";})()}</td>
                  <td style={{padding:"8px 10px"}}>{c.interestLevel?<Tag color={INTEREST_COL[c.interestLevel]||"gray"}>{c.interestLevel}{linked?` 🏠${linked.house.name}`:""}</Tag>:"—"}</td>
                  <td style={{padding:"8px 10px",fontSize:11,maxWidth:180}}>{promoItems.length>0?promoItems.map((p,i)=><div key={p.id} style={{color:C.orange}}>{i+1}. {p.text}</div>):"—"}</td>
                  <td style={{padding:"8px 10px",fontSize:11}}>{(c.bankLoans||[]).length>0?c.bankLoans.map(b=><div key={b.id} style={{color:C.blue}}>{b.bankName}</div>):"—"}</td>
                  <td style={{padding:"8px 10px",fontSize:12,color:C.text}}>{c.bookingDate?fmtDate(c.bookingDate):"—"}</td>
                  <td style={{padding:"8px 10px"}}>
                    <div style={{display:"flex",gap:4}}>
                      {canEdit&&<Btn size="sm" variant="ghost" onClick={()=>openEdit(c)}>✏️</Btn>}
                      {canEdit&&<Btn size="sm" variant="ghost" onClick={()=>del(c.id)}>🗑</Btn>}
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
      {editMdl&&(()=>{
        const linked=getLinkedHouseData(form.bookingHouseId);
        const housePromos=linked?.customer?.promotionItems||(linked?.customer?.promotion?[{id:1,text:linked.customer.promotion}]:[]);
        return(
        <Mdl title={editMdl==="add"?"➕ เพิ่มลูกค้า Walk-in":"✏️ แก้ไขข้อมูลลูกค้า"} onClose={()=>setEditMdl(null)} footer={<><Btn variant="ghost" onClick={()=>setEditMdl(null)}>ยกเลิก</Btn><Btn variant="ghost" onClick={()=>setPdfPreview({...form})} style={{color:C.blue}}>👁 PDF</Btn><Btn variant="ghost" onClick={()=>setCustPdfPreview({...form})} style={{color:C.green}}>🏠 PDF ลูกค้า</Btn><Btn onClick={save}>💾 บันทึก</Btn></>}>
          <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:12}}>
            <FG label="ชื่อ-นามสกุล"><FIn value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></FG>
            <FG label="เบอร์โทร"><FIn value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></FG>
            <FG label="อายุ"><FIn type="number" value={form.age} onChange={e=>setForm(f=>({...f,age:e.target.value}))}/></FG>
            <FG label="อาชีพ"><FIn value={form.occupation} onChange={e=>setForm(f=>({...f,occupation:e.target.value}))}/></FG>
            <FG label="รายได้ (บาท/เดือน)"><FIn type="number" value={form.income} onChange={e=>setForm(f=>({...f,income:e.target.value}))}/></FG>
            <FG label="วัน Walk-in"><FIn type="date" value={form.walkInDate} onChange={e=>setForm(f=>({...f,walkInDate:e.target.value}))}/></FG>
          </div>
          <FG label="ช่องทางสื่อที่ลูกค้ารับรู้ (เลือกได้หลายช่องทาง)">
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {channelOpts.map(ch=>{const checked=(form.channels||[]).includes(ch);return(
                <label key={ch} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:12,color:checked?C.blue:C.muted,padding:"4px 10px",background:checked?"rgba(59,130,246,0.1)":"transparent",borderRadius:6,border:`1px solid ${checked?C.blue:C.border}`}}>
                  <input type="checkbox" checked={checked} onChange={()=>setForm(f=>{const chs=f.channels||[];return{...f,channels:checked?chs.filter(c=>c!==ch):[...chs,ch]};})} style={{accentColor:C.blue}}/>
                  {ch}
                </label>
              );})}
            </div>
            {(form.channels||[]).includes("อื่นๆ")&&<FIn style={{marginTop:8}} value={form.channelOther||""} onChange={e=>setForm(f=>({...f,channelOther:e.target.value}))} placeholder="ระบุช่องทางอื่น..."/>}
            {(form.channels||[]).includes("เซลล์โครงการ")&&(
              <div style={{marginTop:8}}>
                <FSel value={form.channelDetail||""} onChange={e=>setForm(f=>({...f,channelDetail:e.target.value}))}>
                  <option value="">— เลือกเซลล์ —</option>
                  {salesMembers.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                </FSel>
              </div>
            )}
          </FG>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginTop:12,marginBottom:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>⭐ ความสนใจ</div>
          <FG label="ระดับความสนใจ">
            <FSel value={form.interestLevel} onChange={e=>{const v=e.target.value;setForm(f=>({...f,interestLevel:v,bookingHouseId:v!=="จอง"?f.bookingHouseId:f.bookingHouseId,bookingDate:v!=="จอง"?"":f.bookingDate}))}}>
              <option value="">— ยังไม่ประเมิน —</option>
              {interestOpts.map(o=><option key={o} value={o}>{o==="ชอบบ้าน"?"💚 ":""}{"ชอบบ้านแต่เครดิตไม่ถึง"===o?"🟡 ":""}{"ไม่ชอบบ้าน"===o?"❌ ":""}{"จอง"===o?"🏠 ":""}{o}</option>)}
            </FSel>
          </FG>
          {form.interestLevel==="จอง"&&(
            <div style={{background:C.faint,borderRadius:10,padding:14,marginBottom:12}}>
              <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:12}}>
                <FG label="🏠 เลือกบ้านที่จอง">
                  <FSel value={form.bookingHouseId} onChange={e=>setForm(f=>({...f,bookingHouseId:e.target.value}))}>
                    <option value="">— เลือกบ้าน —</option>
                    {data.houses.map(h=><option key={h.id} value={h.id}>บ้าน {h.name} ({data.projects.find(p=>p.id===h.projectId)?.name})</option>)}
                  </FSel>
                </FG>
                <FG label="วันที่จอง"><FIn type="date" value={form.bookingDate||""} onChange={e=>setForm(f=>({...f,bookingDate:e.target.value}))}/></FG>
              </div>
              <Alrt type="info">เมื่อบันทึก ข้อมูลจะเชื่อมต่อไปหน้า "บ้านและจอง" อัตโนมัติ</Alrt>
            </div>
          )}
          {form.interestLevel&&form.interestLevel!=="จอง"&&(
            <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:12}}>
              <FG label="บ้านที่สนใจ (ถ้ามี)">
                <FSel value={form.bookingHouseId} onChange={e=>setForm(f=>({...f,bookingHouseId:e.target.value}))}>
                  <option value="">— ยังไม่ระบุ —</option>
                  {data.houses.map(h=><option key={h.id} value={h.id}>บ้าน {h.name} ({data.projects.find(p=>p.id===h.projectId)?.name})</option>)}
                </FSel>
              </FG>
              <FG label="วันที่จอง"><FIn type="date" value={form.bookingDate||""} onChange={e=>setForm(f=>({...f,bookingDate:e.target.value}))}/></FG>
            </div>
          )}
          {linked&&(
            <div style={{background:C.faint,borderRadius:10,padding:14,marginBottom:12,marginTop:4}}>
              <div style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:6}}>📋 ข้อมูลจากบ้าน {linked.house.name}</div>
              {linked.customer?.price&&<div style={{fontSize:13,color:C.blue,fontWeight:700}}>ราคา: ฿{fmtMoney(Number(linked.customer.price))}</div>}
              {housePromos.length>0&&(
                <div style={{marginTop:6}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.orange,marginBottom:4}}>🏷️ โปรโมชั่น:</div>
                  {housePromos.map((p,i)=><div key={p.id} style={{fontSize:12,color:C.orange,paddingLeft:8}}>{i+1}. {p.text}</div>)}
                </div>
              )}
            </div>
          )}
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginTop:12,marginBottom:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>📋 ข้อมูลส่วนตัวเพิ่มเติม</div>
          <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr 1fr",gap:12}}>
            <FG label="สถานะสมรส"><FSel value={form.maritalStatus} onChange={e=>setForm(f=>({...f,maritalStatus:e.target.value}))}><option value="">— เลือก —</option>{maritalOpts.map(o=><option key={o} value={o}>{o}</option>)}</FSel></FG>
            <FG label="จำนวนบุตร"><FIn type="number" value={form.numberOfChildren} onChange={e=>setForm(f=>({...f,numberOfChildren:e.target.value}))} placeholder="0"/></FG>
            <FG label="ค่าผ่อนรถ/เดือน"><FIn type="number" value={form.carInstallment} onChange={e=>setForm(f=>({...f,carInstallment:e.target.value}))} placeholder="เช่น 8000"/></FG>
          </div>
          <FG label="หนี้สินอื่นๆ (รายละเอียด + จำนวนเงิน)"><FIn value={form.otherDebts} onChange={e=>setForm(f=>({...f,otherDebts:e.target.value}))} rows={2} placeholder="เช่น บัตรเครดิต 5,000/เดือน, สินเชื่อส่วนบุคคล 3,000/เดือน"/></FG>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginTop:12,marginBottom:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>🔍 ข้อมูลการค้นหาบ้าน</div>
          <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr 1fr",gap:12}}>
            <FG label="ประเภทบ้านที่สนใจ">
              <FSel value={form.houseStyle} onChange={e=>setForm(f=>({...f,houseStyle:e.target.value}))}>
                <option value="">— เลือกประเภท —</option>
                {houseStyleOpts.map(o=><option key={o} value={o}>{o}</option>)}
              </FSel>
            </FG>
            <FG label="จำนวนชั้น">
              <FSel value={form.houseFloors} onChange={e=>setForm(f=>({...f,houseFloors:e.target.value}))}>
                <option value="">— เลือกจำนวนชั้น —</option>
                {houseFloorOpts.map(o=><option key={o} value={o}>{o}</option>)}
              </FSel>
            </FG>
            <FG label="ห้องนอน/ห้องน้ำ">
              <FSel value={form.bedroomConfig} onChange={e=>setForm(f=>({...f,bedroomConfig:e.target.value}))}>
                <option value="">— เลือกรูปแบบ —</option>
                {bedroomOpts.map(o=><option key={o} value={o}>{o}</option>)}
              </FSel>
            </FG>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:C.muted,marginTop:12,marginBottom:6}}>📍 โซน/พื้นที่ที่สนใจ</div>
          <FG label="โซนที่กำลังหาบ้าน"><FIn value={form.searchZone||""} onChange={e=>setForm(f=>({...f,searchZone:e.target.value}))} placeholder="เช่น โซนตลาด, โซนหนองไผ่ล้อม, โซนบางแสน"/></FG>
          <FG label="ที่ทำงาน/สถานที่ทำงาน"><FIn value={form.workPlace} onChange={e=>setForm(f=>({...f,workPlace:e.target.value}))} placeholder="เช่น บริษัท ABC อ.เมือง จ.ชลบุรี"/></FG>
          <div style={{fontSize:13,fontWeight:700,color:C.muted,marginTop:12,marginBottom:6}}>🏷️ โปรโมชั่น/ของแถม</div>
          <FG label="โปรโมชั่นสำหรับลูกค้า"><FIn value={form.promotion||""} onChange={e=>setForm(f=>({...f,promotion:e.target.value}))} rows={2} placeholder="เช่น ฟรีเครื่องปรับอากาศ 3 ตัว, ฟรีเฟอร์นิเจอร์ครบชุด, ส่วนลดพิเศษ 50,000 บาท"/></FG>
          {form.interestLevel&&form.interestLevel!=="จอง"&&(
            <FG label="📝 สาเหตุที่ยังไม่จอง / หมายเหตุติดตาม"><FIn value={form.notBookedReason||""} onChange={e=>setForm(f=>({...f,notBookedReason:e.target.value}))} rows={2} placeholder="เช่น ลูกค้าไปถามพ่อแม่, จะกลับมาดูอีกที, รอเปรียบเทียบโครงการอื่น..."/></FG>
          )}
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginTop:12,marginBottom:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>🏦 ธนาคารที่ยื่นกู้</div>
          {(form.bankLoans||[]).map((bank,bi)=>{
            const housePrice=linked?.customer?.price?Number(linked.customer.price):0;
            const loanAmt=bank.loanAmount?Number(bank.loanAmount):housePrice;
            const yrs=bank.loanYears?Number(bank.loanYears):30;
            const pay1=calcMonthly(loanAmt,Number(bank.rate1)||0,yrs);
            const pay2=calcMonthly(loanAmt,Number(bank.rate2)||0,yrs);
            const pay3=calcMonthly(loanAmt,Number(bank.rate3)||0,yrs);
            return(
              <Card key={bank.id} style={{padding:14,marginBottom:10,border:`1px solid ${C.border2}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.blue}}>🏦 ธนาคารที่ {bi+1}</div>
                  <Btn size="sm" variant="ghost" onClick={()=>removeBank(bank.id)} style={{color:C.red}}>✕ ลบ</Btn>
                </div>
                <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:10}}>
                  <FG label="ชื่อธนาคาร">
                    <FSel value={bank.bankName} onChange={e=>updateBank(bank.id,"bankName",e.target.value)}>
                      <option value="">— เลือกธนาคาร —</option>
                      {bankOpts.map(b=><option key={b} value={b}>{b}</option>)}
                    </FSel>
                  </FG>
                  <FG label="โปรโมชั่นธนาคาร"><FIn value={bank.promoName} onChange={e=>updateBank(bank.id,"promoName",e.target.value)} placeholder="เช่น โปรโมชั่นเพื่อคุณ"/></FG>
                </div>
                <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr 1fr",gap:10}}>
                  <FG label="ดอกเบี้ยปีที่ 1 (%)"><FIn type="number" step="0.01" value={bank.rate1} onChange={e=>updateBank(bank.id,"rate1",e.target.value)} placeholder="เช่น 2.99"/></FG>
                  <FG label="ดอกเบี้ยปีที่ 2 (%)"><FIn type="number" step="0.01" value={bank.rate2} onChange={e=>updateBank(bank.id,"rate2",e.target.value)} placeholder="เช่น 4.40"/></FG>
                  <FG label="ดอกเบี้ยปีที่ 3+ (%)"><FIn type="number" step="0.01" value={bank.rate3} onChange={e=>updateBank(bank.id,"rate3",e.target.value)} placeholder="เช่น 5.95"/></FG>
                </div>
                <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:10}}>
                  <FG label="ยอดกู้ (บาท)"><FIn type="number" value={bank.loanAmount} onChange={e=>updateBank(bank.id,"loanAmount",e.target.value)} placeholder={housePrice?`อ้างอิงจากราคาบ้าน ฿${fmtMoney(housePrice)}`:"ระบุยอดกู้"}/></FG>
                  <FG label="ระยะเวลากู้ (ปี)">
                    <FSel value={bank.loanYears} onChange={e=>updateBank(bank.id,"loanYears",e.target.value)}>
                      {Array.from({length:40},(_,i)=>i+1).map(y=><option key={y} value={y}>{y} ปี ({y*12} งวด)</option>)}
                    </FSel>
                  </FG>
                </div>
                {loanAmt>0&&(Number(bank.rate1)>0||Number(bank.rate2)>0||Number(bank.rate3)>0)&&(
                  <div style={{background:"linear-gradient(135deg,#1e3a5f,#0f172a)",borderRadius:10,padding:14,marginTop:8}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8}}>📊 ยอดผ่อนต่อเดือน (ยอดกู้ ฿{fmtMoney(loanAmt)} / {yrs} ปี)</div>
                    <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr 1fr",gap:10}}>
                      {Number(bank.rate1)>0&&<div style={{textAlign:"center",padding:10,background:C.faint,borderRadius:8}}>
                        <div style={{fontSize:10,color:C.muted}}>ปีที่ 1 ({bank.rate1}%)</div>
                        <div style={{fontSize:18,fontWeight:800,color:C.green}}>฿{fmtMoney(pay1)}</div>
                        <div style={{fontSize:10,color:C.muted}}>บาท/เดือน</div>
                      </div>}
                      {Number(bank.rate2)>0&&<div style={{textAlign:"center",padding:10,background:C.faint,borderRadius:8}}>
                        <div style={{fontSize:10,color:C.muted}}>ปีที่ 2 ({bank.rate2}%)</div>
                        <div style={{fontSize:18,fontWeight:800,color:C.orange}}>฿{fmtMoney(pay2)}</div>
                        <div style={{fontSize:10,color:C.muted}}>บาท/เดือน</div>
                      </div>}
                      {Number(bank.rate3)>0&&<div style={{textAlign:"center",padding:10,background:C.faint,borderRadius:8}}>
                        <div style={{fontSize:10,color:C.muted}}>ปีที่ 3+ ({bank.rate3}%)</div>
                        <div style={{fontSize:18,fontWeight:800,color:C.blue}}>฿{fmtMoney(pay3)}</div>
                        <div style={{fontSize:10,color:C.muted}}>บาท/เดือน</div>
                      </div>}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
          <Btn size="sm" variant="ghost" onClick={addBank} style={{color:C.blue,fontSize:12,marginBottom:12}}>+ เพิ่มธนาคาร</Btn>
          <FG label="หมายเหตุ"><FIn value={form.note||""} onChange={e=>setForm(f=>({...f,note:e.target.value}))} rows={2} placeholder="บันทึก..."/></FG>
        </Mdl>
        );
      })()}
      {pdfPreview&&(()=>{
        const pvLinked=getLinkedHouseData(pdfPreview.bookingHouseId);
        const pvProjName=pvLinked?data.projects.find(p=>p.id===pvLinked.house.projectId)?.name||"":"";
        const pvPromo=pdfPreview.promotion||"";
        return(
        <Mdl title="👁 พรีวิว PDF ข้อมูลลูกค้า" onClose={()=>setPdfPreview(null)} footer={<><Btn variant="ghost" onClick={()=>setPdfPreview(null)}>ปิด</Btn><Btn onClick={()=>{exportCustPDF(pdfPreview);setPdfPreview(null);}} disabled={pdfLoading2}>{pdfLoading2?"⏳ กำลังสร้าง...":"📄 ดาวน์โหลด PDF"}</Btn></>}>
          <div style={{background:"#fff",color:"#1a1a1a",borderRadius:12,padding:20,maxHeight:"60vh",overflowY:"auto"}}>
            <div style={{textAlign:"center",marginBottom:20,paddingBottom:16,borderBottom:"3px solid #2563eb"}}>
              <div style={{fontSize:22,fontWeight:800,color:"#2563eb"}}>📋 ข้อมูลลูกค้า</div>
              {pvProjName&&<div style={{fontSize:14,color:"#1e3a5f",marginTop:4,fontWeight:600}}>โครงการ {pvProjName}</div>}
              <div style={{fontSize:11,color:"#6b7280",marginTop:4}}>วัน Walk-in: {pdfPreview.walkInDate||"—"}{pdfPreview.bookingDate?` | วันจอง: ${pdfPreview.bookingDate}`:""}</div>
            </div>
            {pvLinked&&<div style={{background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",borderRadius:12,padding:16,marginBottom:16,border:"1px solid #86efac"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
                <div><div style={{fontSize:10,color:"#15803d",fontWeight:700}}>ข้อมูลบ้านที่จอง</div><div style={{fontSize:18,fontWeight:900,color:"#166534",marginTop:3}}>🏡 บ้าน {pvLinked.house.name}</div></div>
                {pvLinked.customer?.price&&<div style={{fontSize:20,fontWeight:900,color:"#166534"}}>฿{fmtMoney(Number(pvLinked.customer.price))}</div>}
              </div>
            </div>}
            {pvPromo&&<div style={{background:"linear-gradient(135deg,#fffbeb,#fef3c7)",borderRadius:10,padding:14,marginBottom:14,border:"1px solid #fbbf24"}}><div style={{fontSize:11,fontWeight:700,color:"#92400e"}}>🏷️ โปรโมชั่น/ของแถม</div><div style={{fontSize:13,marginTop:6,color:"#78350f"}}>{pvPromo}</div></div>}
            <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:14,marginBottom:16}}>
              <div style={{background:"#f8fafc",borderRadius:10,padding:14}}>
                <div style={{fontSize:10,color:"#6b7280",fontWeight:700,textTransform:"uppercase"}}>ข้อมูลส่วนตัว</div>
                <div style={{fontSize:16,fontWeight:700,marginTop:6}}>{pdfPreview.name||"—"}</div>
                <div style={{fontSize:12,marginTop:4}}>📞 {pdfPreview.phone||"—"}</div>
                <div style={{fontSize:12,marginTop:2}}>อายุ: {pdfPreview.age||"—"} | อาชีพ: {pdfPreview.occupation||"—"}</div>
                <div style={{fontSize:12,marginTop:2}}>รายได้: {pdfPreview.income?`฿${fmtMoney(Number(pdfPreview.income))}`:"—"}/เดือน</div>
                {pdfPreview.maritalStatus&&<div style={{fontSize:12,marginTop:2}}>สถานะ: {pdfPreview.maritalStatus} | บุตร: {pdfPreview.numberOfChildren||"0"} คน</div>}
                {pdfPreview.workPlace&&<div style={{fontSize:12,marginTop:2}}>💼 {pdfPreview.workPlace}</div>}
              </div>
              <div style={{background:"#f8fafc",borderRadius:10,padding:14}}>
                <div style={{fontSize:10,color:"#6b7280",fontWeight:700,textTransform:"uppercase"}}>ความสนใจ & การค้นหา</div>
                {pdfPreview.interestLevel&&<div style={{fontSize:14,fontWeight:600,marginTop:6,color:INTEREST_COL[pdfPreview.interestLevel]==="green"?"#16a34a":INTEREST_COL[pdfPreview.interestLevel]==="red"?"#dc2626":INTEREST_COL[pdfPreview.interestLevel]==="orange"?"#ea580c":"#2563eb"}}>⭐ {pdfPreview.interestLevel}</div>}
                {(pdfPreview.houseStyle||pdfPreview.houseFloors||pdfPreview.bedroomConfig)&&<div style={{fontSize:12,marginTop:4}}>🏠 {[pdfPreview.houseStyle,pdfPreview.houseFloors,pdfPreview.bedroomConfig].filter(Boolean).join(" / ")}</div>}
                {!pdfPreview.houseStyle&&pdfPreview.lookingForHouseType&&<div style={{fontSize:12,marginTop:4}}>🏠 {pdfPreview.lookingForHouseType}</div>}
                {pdfPreview.searchZone&&<div style={{fontSize:12,marginTop:2}}>📍 โซน: {pdfPreview.searchZone}</div>}
                {!pdfPreview.searchZone&&(pdfPreview.province||pdfPreview.district||pdfPreview.subDistrict)&&<div style={{fontSize:12,marginTop:2}}>📍 {[pdfPreview.subDistrict,pdfPreview.district,pdfPreview.province].filter(Boolean).join(", ")}</div>}
                {(pdfPreview.channels||[]).length>0&&<div style={{fontSize:12,marginTop:4}}>📢 ช่องทาง: {pdfPreview.channels.join(", ")}{pdfPreview.channelOther?` (${pdfPreview.channelOther})`:""}</div>}
                {pdfPreview.salesPerson&&<div style={{fontSize:12,marginTop:2}}>👤 เซลล์: {pdfPreview.channelDetail||pdfPreview.salesPerson}</div>}
              </div>
            </div>
            {pdfPreview.notBookedReason&&(
              <div style={{background:"#fef3c7",borderRadius:10,padding:14,marginBottom:14,border:"1px solid #fbbf24"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#92400e"}}>📝 สาเหตุที่ยังไม่จอง / หมายเหตุติดตาม</div>
                <div style={{fontSize:13,marginTop:6,color:"#78350f",fontWeight:600}}>{pdfPreview.notBookedReason}</div>
              </div>
            )}
            {(pdfPreview.carInstallment||pdfPreview.otherDebts)&&(
              <div style={{background:"#fffbeb",borderRadius:10,padding:14,marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:700,color:"#6b7280"}}>ภาระหนี้สิน</div>
                {pdfPreview.carInstallment&&<div style={{fontSize:12,marginTop:6}}>🚗 ค่าผ่อนรถ: ฿{fmtMoney(Number(pdfPreview.carInstallment))}/เดือน</div>}
                {pdfPreview.otherDebts&&<div style={{fontSize:12,marginTop:2}}>💳 {pdfPreview.otherDebts}</div>}
              </div>
            )}
            {(pdfPreview.bankLoans||[]).length>0&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>🏦 ธนาคารที่ยื่นกู้</div>
                {pdfPreview.bankLoans.map((b,i)=>(
                  <div key={b.id} style={{background:"#f8fafc",borderRadius:8,padding:12,marginBottom:6}}>
                    <div style={{fontWeight:700,color:"#2563eb",fontSize:12}}>ธนาคารที่ {i+1}: {b.bankName||"—"}</div>
                    {b.promoName&&<div style={{fontSize:11,color:"#6b7280"}}>โปรโมชั่น: {b.promoName}</div>}
                    {b.loanAmount&&<div style={{fontSize:11}}>ยอดกู้: ฿{fmtMoney(Number(b.loanAmount))} / {b.loanYears||30} ปี</div>}
                  </div>
                ))}
              </div>
            )}
            {pdfPreview.note&&<div style={{background:"#f8fafc",borderRadius:10,padding:14}}><div style={{fontSize:10,fontWeight:700,color:"#6b7280"}}>หมายเหตุ</div><div style={{fontSize:12,marginTop:6}}>{pdfPreview.note}</div></div>}
          </div>
        </Mdl>
        );
      })()}
      {custPdfPreview&&(()=>{
        const linked=getLinkedHouseData(custPdfPreview.bookingHouseId);
        const housePromos=linked?.customer?.promotionItems||(linked?.customer?.promotion?[{id:1,text:linked.customer.promotion}]:[]);
        const houseTypeStr=[custPdfPreview.houseStyle,custPdfPreview.houseFloors,custPdfPreview.bedroomConfig].filter(Boolean).join(" / ")||(custPdfPreview.lookingForHouseType||"");
        const areaStr=[custPdfPreview.subDistrict,custPdfPreview.district,custPdfPreview.province].filter(Boolean).join(", ")||(custPdfPreview.preferredArea||"");
        const projectName=linked?data.projects.find(p=>p.id===linked.house.projectId)?.name||"":"";
        return(
        <Mdl title="🏠 พรีวิว PDF สำหรับลูกค้า" onClose={()=>setCustPdfPreview(null)} footer={<><Btn variant="ghost" onClick={()=>setCustPdfPreview(null)}>ปิด</Btn><Btn onClick={()=>{exportCustomerFacingPDF(custPdfPreview);setCustPdfPreview(null);}} disabled={pdfLoading2} style={{background:"#16a34a",color:"#fff"}}>{pdfLoading2?"⏳ กำลังสร้าง...":"📄 ดาวน์โหลด PDF"}</Btn></>}>
          <div style={{background:"#fff",color:"#1a1a1a",borderRadius:12,overflow:"hidden",maxHeight:"60vh",overflowY:"auto"}}>
            {/* Header */}
            <div style={{background:"linear-gradient(135deg,#1e3a5f,#2563eb)",color:"#fff",padding:"28px 24px 22px"}}>
              <div style={{fontSize:22,fontWeight:900}}>🏠 เอกสารข้อมูลบ้าน</div>
              {projectName&&<div style={{fontSize:14,marginTop:4,fontWeight:600,opacity:.9}}>โครงการ {projectName}</div>}
              <div style={{fontSize:11,marginTop:8,opacity:.7}}>วันที่ออกเอกสาร: {new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"})}</div>
            </div>
            <div style={{padding:"20px 24px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                <div style={{fontSize:18,fontWeight:800,color:"#1e3a5f"}}>คุณ {custPdfPreview.name||"—"}</div>
                {houseTypeStr&&<div style={{background:"#dbeafe",color:"#2563eb",padding:"3px 10px",borderRadius:16,fontSize:11,fontWeight:600}}>{houseTypeStr}</div>}
              </div>
              {/* House info */}
              {linked&&(
                <div style={{background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",borderRadius:12,padding:18,marginBottom:16,border:"1px solid #86efac"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                    <div>
                      <div style={{fontSize:10,color:"#15803d",fontWeight:700,textTransform:"uppercase"}}>ข้อมูลบ้าน</div>
                      <div style={{fontSize:20,fontWeight:900,color:"#166534",marginTop:4}}>🏡 บ้าน {linked.house.name}</div>
                      {areaStr&&<div style={{fontSize:12,color:"#15803d",marginTop:3}}>📍 {areaStr}</div>}
                    </div>
                    {linked.customer?.price&&<div style={{textAlign:"right"}}><div style={{fontSize:10,color:"#15803d",fontWeight:700}}>ราคาบ้าน</div><div style={{fontSize:22,fontWeight:900,color:"#166534"}}>฿{fmtMoney(Number(linked.customer.price))}</div></div>}
                  </div>
                </div>
              )}
              {/* Promotions */}
              {housePromos.length>0&&(
                <div style={{background:"linear-gradient(135deg,#fffbeb,#fef3c7)",borderRadius:12,padding:16,marginBottom:16,border:"1px solid #fbbf24"}}>
                  <div style={{fontSize:13,fontWeight:800,color:"#92400e",marginBottom:8}}>🏷️ โปรโมชั่นพิเศษ</div>
                  {housePromos.map((p,i)=><div key={p.id} style={{fontSize:12,color:"#78350f",fontWeight:600,padding:"4px 0",borderTop:i>0?"1px solid #fde68a":"none"}}>{i+1}. {p.text}</div>)}
                </div>
              )}
              {/* Bank loans */}
              {(custPdfPreview.bankLoans||[]).length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:14,fontWeight:800,color:"#1e3a5f",marginBottom:12,paddingBottom:6,borderBottom:"2px solid #2563eb"}}>🏦 ตัวเลือกสินเชื่อ</div>
                  {custPdfPreview.bankLoans.map((b,bi)=>{
                    const la=b.loanAmount?Number(b.loanAmount):0;
                    const yr=b.loanYears?Number(b.loanYears):30;
                    const p1=calcMonthly(la,Number(b.rate1)||0,yr);
                    const p2=calcMonthly(la,Number(b.rate2)||0,yr);
                    const p3=calcMonthly(la,Number(b.rate3)||0,yr);
                    return(
                      <div key={b.id} style={{background:"#f8fafc",borderRadius:10,padding:14,marginBottom:8,border:"1px solid #e2e8f0"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <div>
                            <div style={{fontSize:14,fontWeight:800,color:"#2563eb"}}>{b.bankName||"ธนาคาร"}</div>
                            {b.promoName&&<div style={{fontSize:11,color:"#6b7280"}}>✨ {b.promoName}</div>}
                          </div>
                          {la>0&&<div style={{textAlign:"right"}}><div style={{fontSize:9,color:"#6b7280"}}>ยอดกู้</div><div style={{fontSize:15,fontWeight:800,color:"#1e3a5f"}}>฿{fmtMoney(la)}</div><div style={{fontSize:9,color:"#6b7280"}}>{yr} ปี ({yr*12} งวด)</div></div>}
                        </div>
                        {la>0&&(Number(b.rate1)>0||Number(b.rate2)>0||Number(b.rate3)>0)&&(
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                            {Number(b.rate1)>0&&<div style={{background:"#f0fdf4",borderRadius:8,padding:10,textAlign:"center",border:"1px solid #86efac"}}><div style={{fontSize:9,color:"#15803d"}}>ปีที่ 1 ({b.rate1}%)</div><div style={{fontSize:16,fontWeight:900,color:"#166534"}}>฿{fmtMoney(p1)}</div><div style={{fontSize:9,color:"#15803d"}}>บาท/เดือน</div></div>}
                            {Number(b.rate2)>0&&<div style={{background:"#fffbeb",borderRadius:8,padding:10,textAlign:"center",border:"1px solid #fbbf24"}}><div style={{fontSize:9,color:"#92400e"}}>ปีที่ 2 ({b.rate2}%)</div><div style={{fontSize:16,fontWeight:900,color:"#92400e"}}>฿{fmtMoney(p2)}</div><div style={{fontSize:9,color:"#92400e"}}>บาท/เดือน</div></div>}
                            {Number(b.rate3)>0&&<div style={{background:"#eff6ff",borderRadius:8,padding:10,textAlign:"center",border:"1px solid #93c5fd"}}><div style={{fontSize:9,color:"#1e40af"}}>ปีที่ 3+ ({b.rate3}%)</div><div style={{fontSize:16,fontWeight:900,color:"#1e40af"}}>฿{fmtMoney(p3)}</div><div style={{fontSize:9,color:"#1e40af"}}>บาท/เดือน</div></div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{paddingTop:14,borderTop:"2px solid #e2e8f0",display:"flex",justifyContent:"space-between",fontSize:10,color:"#9ca3af"}}>
                <span>เอกสารจัดทำโดยระบบ CPMS</span>
                <span>ข้อมูลอาจเปลี่ยนแปลงได้โดยไม่ต้องแจ้งล่วงหน้า</span>
              </div>
            </div>
          </div>
        </Mdl>
        );
      })()}
    </div>
  );
}

// ── Monthly Results Page (flexible date range, granularity, up to 12 comparisons) ──
function MktResultPage({data,setData,role,isMobileMode}) {
  const canEdit=["owner","marketing","sales"].includes(role);
  const now=new Date();
  const [viewMode,setViewMode]=useState("month");
  const [selMonth,setSelMonth]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);
  const [editMdl,setEditMdl]=useState(false);
  const [dailyMdl,setDailyMdl]=useState(null);
  const [showDaily,setShowDaily]=useState(false);
  const [chartFrom,setChartFrom]=useState(`${now.getFullYear()}-01`);
  const [chartTo,setChartTo]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);
  const [gran,setGran]=useState("month");
  const [chartType,setChartType]=useState("bar");
  const [cmpPeriods,setCmpPeriods]=useState([
    {id:1,from:`${now.getFullYear()}-01`,to:`${now.getFullYear()}-12`},
    {id:2,from:`${now.getFullYear()-1}-01`,to:`${now.getFullYear()-1}-12`}
  ]);
  const [cmpMetric,setCmpMetric]=useState("totalInbox");
  const [exportLoading,setExportLoading]=useState(false);
  const chartRef=useRef(null);
  const [form,setForm]=useState({});
  const [dForm,setDForm]=useState({});
  const metrics=[
    {key:"fbInbox",label:"Facebook Inbox",icon:"📘",color:"#3b82f6"},
    {key:"tiktokCloudInbox",label:"TikTok TheCloud Inbox",icon:"🎵",color:"#06b6d4"},
    {key:"tiktokBossInbox",label:"TikTok บ้านสไตล์บอส",icon:"🎶",color:"#8b5cf6"},
    {key:"lineInbox",label:"LINE Inbox",icon:"💚",color:"#22c55e"},
    {key:"walkIn",label:"Walk-in",icon:"🚶",color:"#f59e0b"},
    {key:"bookings",label:"ยอดจอง (หลัง)",icon:"📝",color:"#ec4899"},
    {key:"transfers",label:"โอนแล้ว (หลัง)",icon:"✅",color:"#a78bfa"},
  ];
  const inboxKeys=["fbInbox","tiktokCloudInbox","tiktokBossInbox","lineInbox"];
  const resultKeys=["walkIn","bookings","transfers"];
  const allMetricOpts=[{key:"totalInbox",label:"📨 รวม Inbox",color:"#3b82f6"},...metrics];
  const results=data.monthlyResults||[];
  const dailyResults=data.dailyResults||[];
  const thMonths=["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const thMonthsFull=["","มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const cmpColors=["#3b82f6","#ef4444","#22c55e","#f59e0b","#8b5cf6","#06b6d4","#ec4899","#f97316","#14b8a6","#6366f1","#84cc16","#e11d48"];
  const [y,mo]=selMonth.split("-").map(Number);
  const cur=results.find(r=>r.month===selMonth)||{month:selMonth,fbInbox:0,tiktokCloudInbox:0,tiktokBossInbox:0,lineInbox:0,walkIn:0,bookings:0,transfers:0,note:""};
  const totalInbox=(cur.fbInbox||0)+(cur.tiktokCloudInbox||0)+(cur.tiktokBossInbox||0)+(cur.lineInbox||0);
  function openEdit(){setForm({...cur});setEditMdl(true);}
  function save(){
    const cleaned={...form};
    metrics.forEach(m=>{cleaned[m.key]=Number(cleaned[m.key])||0;});
    setData(d=>{
      const mr=d.monthlyResults||[];
      const idx=mr.findIndex(r=>r.month===cleaned.month);
      return{...d,monthlyResults:idx>=0?mr.map((r,i)=>i===idx?cleaned:r):[...mr,cleaned]};
    });
    setEditMdl(false);
  }
  function changeMonth(delta){
    const [yy,mm]=selMonth.split("-").map(Number);
    const d=new Date(yy,mm-1+delta,1);
    setSelMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }
  function getDailyData(ds){return dailyResults.find(r=>r.date===ds)||{date:ds,fbInbox:0,tiktokCloudInbox:0,tiktokBossInbox:0,lineInbox:0,walkIn:0,bookings:0,transfers:0,note:""};}
  function openDailyEdit(ds){setDForm({...getDailyData(ds)});setDailyMdl(ds);}
  function saveDaily(){
    const cleaned={...dForm};
    metrics.forEach(m=>{cleaned[m.key]=Number(cleaned[m.key])||0;});
    setData(d=>{
      const dr=d.dailyResults||[];
      const idx=dr.findIndex(r=>r.date===cleaned.date);
      const newDR=idx>=0?dr.map((r,i)=>i===idx?cleaned:r):[...dr,cleaned];
      // Auto-sync daily totals → monthly totals
      const [dy,dm]=cleaned.date.split("-").map(Number);
      const monthKey=`${dy}-${String(dm).padStart(2,"0")}`;
      const daysInMonth=new Date(dy,dm,0).getDate();
      const monthDaily=Array.from({length:daysInMonth},(_,i)=>{
        const ds=`${dy}-${String(dm).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`;
        if(ds===cleaned.date)return cleaned;
        return newDR.find(r=>r.date===ds)||{};
      });
      const monthSum={month:monthKey,note:""};
      metrics.forEach(m=>{monthSum[m.key]=monthDaily.reduce((s,dd)=>s+(Number(dd[m.key])||0),0);});
      const mr=d.monthlyResults||[];
      const mIdx=mr.findIndex(r=>r.month===monthKey);
      const existingNote=mIdx>=0?mr[mIdx].note||"":"";
      monthSum.note=existingNote;
      const newMR=mIdx>=0?mr.map((r,i)=>i===mIdx?{...r,...monthSum}:r):[...mr,monthSum];
      return{...d,dailyResults:newDR,monthlyResults:newMR};
    });
    setDailyMdl(null);
  }
  function numDays(yy,mm){return new Date(yy,mm,0).getDate();}
  function getMonthRow(mk){return results.find(r=>r.month===mk)||{month:mk,fbInbox:0,tiktokCloudInbox:0,tiktokBossInbox:0,lineInbox:0,walkIn:0,bookings:0,transfers:0};}
  function sumM(arr){const s={};metrics.forEach(m=>{s[m.key]=arr.reduce((a,d)=>a+(d[m.key]||0),0);});s.totalInbox=(s.fbInbox||0)+(s.tiktokCloudInbox||0)+(s.tiktokBossInbox||0)+(s.lineInbox||0);return s;}
  function genPts(from,to,g){
    const [fy,fm]=from.split("-").map(Number);const [ty,tm]=to.split("-").map(Number);const pts=[];
    if(g==="year"){for(let yr=fy;yr<=ty&&pts.length<12;yr++){const months=Array.from({length:12},(_,i)=>getMonthRow(`${yr}-${String(i+1).padStart(2,"0")}`));const s=sumM(months);pts.push({label:`${yr+543}`,short:`${(yr+543)%100}`,...s});}}
    else if(g==="month"){let cy=fy,cm=fm;while((cy<ty||(cy===ty&&cm<=tm))&&pts.length<120){const d=getMonthRow(`${cy}-${String(cm).padStart(2,"0")}`);const ti=(d.fbInbox||0)+(d.tiktokCloudInbox||0)+(d.tiktokBossInbox||0)+(d.lineInbox||0);pts.push({label:`${thMonths[cm]} ${(cy+543)%100}`,short:thMonths[cm],...d,totalInbox:ti});cm++;if(cm>12){cm=1;cy++;}}}
    else if(g==="week"){let cy=fy,cm=fm,wBuf=[],wn=1;while((cy<ty||(cy===ty&&cm<=tm))&&pts.length<104){const days=numDays(cy,cm);for(let dd=1;dd<=days;dd++){const ds=`${cy}-${String(cm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;wBuf.push(getDailyData(ds));if(new Date(cy,cm-1,dd).getDay()===0||(dd===days&&cy===ty&&cm===tm)){const s=sumM(wBuf);pts.push({label:`W${wn}`,short:`W${wn}`,...s});wBuf=[];wn++;}}cm++;if(cm>12){cm=1;cy++;}}if(wBuf.length){const s=sumM(wBuf);pts.push({label:`W${wn}`,short:`W${wn}`,...s});}}
    else if(g==="day"){let cy=fy,cm=fm;while((cy<ty||(cy===ty&&cm<=tm))&&pts.length<366){const days=numDays(cy,cm);for(let dd=1;dd<=days;dd++){const ds=`${cy}-${String(cm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;const r=getDailyData(ds);const ti=(r.fbInbox||0)+(r.tiktokCloudInbox||0)+(r.tiktokBossInbox||0)+(r.lineInbox||0);pts.push({label:`${dd}/${cm}`,short:`${dd}`,...r,totalInbox:ti,date:ds});}cm++;if(cm>12){cm=1;cy++;}}}
    return pts;
  }
  function addPeriod(){if(cmpPeriods.length>=12)return;const nid=Math.max(0,...cmpPeriods.map(p=>p.id))+1;const yr=now.getFullYear()-cmpPeriods.length;setCmpPeriods(p=>[...p,{id:nid,from:`${yr}-01`,to:`${yr}-12`}]);}
  function rmPeriod(id){if(cmpPeriods.length<=1)return;setCmpPeriods(p=>p.filter(pp=>pp.id!==id));}
  function updPeriod(id,f,v){setCmpPeriods(p=>p.map(pp=>pp.id===id?{...pp,[f]:v}:pp));}

  // Chart components
  function BarChart({dataArr,metricKeys,height=220}){
    if(!dataArr.length)return<div style={{color:C.muted,fontSize:12,padding:20,textAlign:"center"}}>ไม่มีข้อมูล</div>;
    const cW=isMobileMode?320:700;
    const n=dataArr.length;const gW=cW/n;
    const bN=metricKeys.length;
    const bW=Math.max(1,Math.min(12,(gW-4)/bN));
    const mx=Math.max(1,...dataArr.flatMap(d=>metricKeys.map(k=>d[k]||0)));
    return(
      <svg width="100%" viewBox={`0 0 ${cW} ${height+30}`} style={{display:"block"}}>
        {[0,.25,.5,.75,1].map(p=>{const yp=height-(p*height);return<g key={p}><line x1={0} y1={yp} x2={cW} y2={yp} stroke={C.border} strokeWidth={.5}/><text x={2} y={yp-3} fill={C.muted} fontSize={8}>{fmtMoney(Math.round(mx*p))}</text></g>;})}
        {dataArr.map((d,i)=>{
          const x=i*gW+gW/2-((bN*bW)/2);
          return<g key={i}>
            {metricKeys.map((k,ki)=>{const v=d[k]||0;const h=(v/mx)*height;const md=metrics.find(m=>m.key===k)||(k==="totalInbox"?{color:"#3b82f6",label:"รวม Inbox"}:{});return<rect key={k} x={x+ki*bW} y={height-h} width={bW-1} height={h} fill={md.color||C.blue} rx={1} opacity={.85}><title>{md.label||k}: {v}</title></rect>;})}
            {(n<=31||i%(Math.ceil(n/15))===0)&&<text x={i*gW+gW/2} y={height+14} textAnchor="middle" fill={C.muted} fontSize={n>60?4:n>31?6:n>12?7:9}>{d.short||d.label}</text>}
          </g>;
        })}
      </svg>
    );
  }
  function LineChart({dataArr,metricKeys,height=200}){
    if(dataArr.length<2)return null;
    const cW=isMobileMode?320:700;const n=dataArr.length;
    const mx=Math.max(1,...dataArr.flatMap(d=>metricKeys.map(k=>d[k]||0)));
    const gx=i=>(i/(n-1))*(cW-40)+20;const gy=v=>height-(v/mx)*height;
    return(
      <svg width="100%" viewBox={`0 0 ${cW} ${height+30}`} style={{display:"block"}}>
        {[0,.25,.5,.75,1].map(p=>{const yp=height-(p*height);return<g key={p}><line x1={0} y1={yp} x2={cW} y2={yp} stroke={C.border} strokeWidth={.5} strokeDasharray="4,4"/><text x={2} y={yp-3} fill={C.muted} fontSize={8}>{fmtMoney(Math.round(mx*p))}</text></g>;})}
        {metricKeys.map(k=>{
          const md=metrics.find(m=>m.key===k)||(k==="totalInbox"?{color:"#3b82f6",label:"รวม Inbox"}:{});
          const path=dataArr.map((d,i)=>`${i===0?"M":"L"}${gx(i)},${gy(d[k]||0)}`).join(" ");
          return<g key={k}><path d={path} fill="none" stroke={md.color||C.blue} strokeWidth={2} opacity={.9}/>{n<=60&&dataArr.map((d,i)=><circle key={i} cx={gx(i)} cy={gy(d[k]||0)} r={n>31?1.5:3} fill={md.color||C.blue}><title>{md.label}: {d[k]||0}</title></circle>)}</g>;
        })}
        {dataArr.map((d,i)=>{const step=n>60?Math.ceil(n/15):n>31?Math.ceil(n/10):1;if(i%step!==0&&i!==n-1)return null;return<text key={i} x={gx(i)} y={height+14} textAnchor="middle" fill={C.muted} fontSize={n>60?4:n>31?6:n>12?7:9}>{d.short||d.label}</text>;})}
      </svg>
    );
  }
  function CmpBarChart({periodData,height=200}){
    if(!periodData.length)return null;
    const cW=isMobileMode?320:700;const n=periodData.length;
    const bW=Math.max(10,Math.min(60,cW/(n+1)));
    const mx=Math.max(1,...periodData.map(p=>p.val));
    const gap=(cW-n*bW)/(n+1);
    return(
      <svg width="100%" viewBox={`0 0 ${cW} ${height+40}`} style={{display:"block"}}>
        {[0,.25,.5,.75,1].map(p=>{const yp=height-(p*height);return<g key={p}><line x1={0} y1={yp} x2={cW} y2={yp} stroke={C.border} strokeWidth={.5}/><text x={2} y={yp-3} fill={C.muted} fontSize={8}>{fmtMoney(Math.round(mx*p))}</text></g>;})}
        {periodData.map((p,i)=>{
          const x=gap+(gap+bW)*i;const h=(p.val/mx)*height;
          return<g key={i}><rect x={x} y={height-h} width={bW} height={h} fill={cmpColors[i%12]} rx={3} opacity={.85}><title>{p.label}: {fmtMoney(p.val)}</title></rect><text x={x+bW/2} y={height-h-6} textAnchor="middle" fill={cmpColors[i%12]} fontSize={10} fontWeight={700}>{fmtMoney(p.val)}</text><text x={x+bW/2} y={height+14} textAnchor="middle" fill={C.muted} fontSize={9}>{p.label}</text></g>;
        })}
      </svg>
    );
  }

  async function exportPDF(){
    setExportLoading(true);
    try{
      const pts=genPts(chartFrom,chartTo,gran);
      const totals=sumM(pts);
      const rangeStr=fmtRange(chartFrom,chartTo);
      const granLabel=gran==="day"?"รายวัน":gran==="week"?"รายสัปดาห์":gran==="month"?"รายเดือน":"รายปี";
      const dateStr=new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"});
      // Build offscreen template
      const wrap=document.createElement("div");
      wrap.style.cssText="position:fixed;left:-9999px;top:0;width:1100px;background:#fff;color:#1a1a1a;padding:40px;font-family:sans-serif;";
      document.body.appendChild(wrap);
      // SVG bar chart for inbox
      const cW=1020;const cH=200;
      const n=pts.length;
      const inboxMax=Math.max(1,...pts.map(d=>(d.fbInbox||0)+(d.tiktokCloudInbox||0)+(d.tiktokBossInbox||0)+(d.lineInbox||0)));
      const resultMax=Math.max(1,...pts.flatMap(d=>[(d.walkIn||0),(d.bookings||0),(d.transfers||0)]));
      function makeSVG(keys,mx,h){
        const colors={fbInbox:"#3b82f6",tiktokCloudInbox:"#06b6d4",tiktokBossInbox:"#8b5cf6",lineInbox:"#22c55e",walkIn:"#f59e0b",bookings:"#ec4899",transfers:"#a78bfa",totalInbox:"#3b82f6"};
        let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${cW}" height="${h+30}" viewBox="0 0 ${cW} ${h+30}">`;
        [0,.25,.5,.75,1].forEach(p=>{const yp=h-(p*h);svg+=`<line x1="0" y1="${yp}" x2="${cW}" y2="${yp}" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="4,4"/><text x="2" y="${yp-3}" fill="#9ca3af" font-size="8">${fmtMoney(Math.round(mx*p))}</text>`;});
        const gx=i=>(i/Math.max(1,n-1))*(cW-40)+20;
        const gy=v=>h-(v/mx)*h;
        keys.forEach(k=>{
          if(n<2)return;
          const path=pts.map((d,i)=>`${i===0?"M":"L"}${gx(i)},${gy(d[k]||0)}`).join(" ");
          svg+=`<path d="${path}" fill="none" stroke="${colors[k]||"#3b82f6"}" stroke-width="2.5" opacity="0.9"/>`;
          if(n<=60)pts.forEach((d,i)=>{svg+=`<circle cx="${gx(i)}" cy="${gy(d[k]||0)}" r="${n>31?1.5:3}" fill="${colors[k]||"#3b82f6"}"/>`;});
        });
        const step=n>60?Math.ceil(n/15):n>31?Math.ceil(n/10):1;
        pts.forEach((d,i)=>{if(i%step===0||i===n-1)svg+=`<text x="${gx(i)}" y="${h+14}" text-anchor="middle" fill="#9ca3af" font-size="${n>60?5:n>31?7:9}">${d.short||d.label}</text>`;});
        svg+=`</svg>`;return svg;
      }
      const inboxSVG=makeSVG(["fbInbox","tiktokCloudInbox","tiktokBossInbox","lineInbox"],inboxMax,cH);
      const resultSVG=makeSVG(["walkIn","bookings","transfers"],resultMax,160);
      wrap.innerHTML=`
        <div style="text-align:center;margin-bottom:28px;padding-bottom:18px;border-bottom:3px solid #2563eb">
          <div style="font-size:26px;font-weight:800;color:#2563eb">📊 รายงานผลลัพธ์การตลาด</div>
          <div style="font-size:14px;color:#1e3a5f;margin-top:6px;font-weight:600">${rangeStr} · ${granLabel} · ${pts.length} จุดข้อมูล</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:6px">ระบบ CPMS — ${dateStr}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px">
          <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:12px;padding:18px;text-align:center;border:1px solid #93c5fd"><div style="font-size:10px;color:#2563eb;font-weight:700">📨 รวม Inbox ทั้งหมด</div><div style="font-size:28px;font-weight:900;color:#1e40af;margin-top:8px">${fmtMoney(totals.totalInbox)}</div></div>
          <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border-radius:12px;padding:18px;text-align:center;border:1px solid #fbbf24"><div style="font-size:10px;color:#92400e;font-weight:700">🚶 Walk-in</div><div style="font-size:28px;font-weight:900;color:#92400e;margin-top:8px">${fmtMoney(totals.walkIn||0)}</div></div>
          <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:12px;padding:18px;text-align:center;border:1px solid #86efac"><div style="font-size:10px;color:#166534;font-weight:700">📝 ยอดจอง</div><div style="font-size:28px;font-weight:900;color:#166534;margin-top:8px">${fmtMoney(totals.bookings||0)} หลัง</div></div>
          <div style="background:linear-gradient(135deg,#f5f3ff,#ede9fe);border-radius:12px;padding:18px;text-align:center;border:1px solid #c4b5fd"><div style="font-size:10px;color:#5b21b6;font-weight:700">✅ โอนแล้ว</div><div style="font-size:28px;font-weight:900;color:#5b21b6;margin-top:8px">${fmtMoney(totals.transfers||0)} หลัง</div></div>
        </div>
        <div style="margin-bottom:24px">
          <div style="font-size:15px;font-weight:700;color:#1e3a5f;margin-bottom:4px">📨 Inbox ทุกช่องทาง</div>
          <div style="display:flex;gap:14px;margin-bottom:10px">
            ${[{k:"fbInbox",l:"Facebook",c:"#3b82f6"},{k:"tiktokCloudInbox",l:"TikTok Cloud",c:"#06b6d4"},{k:"tiktokBossInbox",l:"TikTok Boss",c:"#8b5cf6"},{k:"lineInbox",l:"LINE",c:"#22c55e"}].map(m=>`<div style="display:flex;align-items:center;gap:4px;font-size:10px"><div style="width:10px;height:10px;border-radius:2px;background:${m.c}"></div><span style="color:#6b7280">${m.l}: <strong style="color:${m.c}">${fmtMoney(totals[m.k]||0)}</strong></span></div>`).join("")}
          </div>
          ${inboxSVG}
        </div>
        <div style="margin-bottom:24px">
          <div style="font-size:15px;font-weight:700;color:#1e3a5f;margin-bottom:4px">🏠 Walk-in / จอง / โอน</div>
          <div style="display:flex;gap:14px;margin-bottom:10px">
            ${[{k:"walkIn",l:"Walk-in",c:"#f59e0b"},{k:"bookings",l:"จอง",c:"#ec4899"},{k:"transfers",l:"โอน",c:"#a78bfa"}].map(m=>`<div style="display:flex;align-items:center;gap:4px;font-size:10px"><div style="width:10px;height:10px;border-radius:2px;background:${m.c}"></div><span style="color:#6b7280">${m.l}: <strong style="color:${m.c}">${fmtMoney(totals[m.k]||0)}</strong></span></div>`).join("")}
          </div>
          ${resultSVG}
        </div>
        <div style="font-size:15px;font-weight:700;color:#1e3a5f;margin-bottom:10px">📋 ตารางสรุป</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead><tr><th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;border-bottom:2px solid #e2e8f0;background:#f8fafc">${gran==="day"?"วัน":gran==="week"?"สัปดาห์":gran==="month"?"เดือน":"ปี"}</th>${metrics.map(m=>`<th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;color:${m.color};border-bottom:2px solid #e2e8f0;background:#f8fafc">${m.icon} ${m.label}</th>`).join("")}<th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;color:#2563eb;border-bottom:2px solid #e2e8f0;background:#f8fafc">รวม Inbox</th></tr></thead>
          <tbody>${pts.map((d,i)=>{const ti=(d.fbInbox||0)+(d.tiktokCloudInbox||0)+(d.tiktokBossInbox||0)+(d.lineInbox||0);return`<tr style="border-bottom:1px solid #e2e8f0;background:${i%2===0?"#fff":"#f8fafc"}"><td style="padding:6px 10px;font-size:11px;font-weight:600">${d.label}</td>${metrics.map(m=>`<td style="padding:6px 10px;text-align:right;font-size:11px">${d[m.key]||0}</td>`).join("")}<td style="padding:6px 10px;text-align:right;font-size:11px;font-weight:700;color:#2563eb">${ti}</td></tr>`;}).join("")}
          <tr style="background:#eff6ff;font-weight:700"><td style="padding:8px 10px;font-size:12px">รวมทั้งหมด</td>${metrics.map(m=>`<td style="padding:8px 10px;text-align:right;font-size:12px;color:${m.color};font-weight:800">${fmtMoney(totals[m.key]||0)}</td>`).join("")}<td style="padding:8px 10px;text-align:right;font-size:13px;color:#2563eb;font-weight:800">${fmtMoney(totals.totalInbox)}</td></tr>
          </tbody>
        </table>
        <div style="padding-top:16px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af">
          <span>เอกสารจัดทำโดยระบบ CPMS</span>
          <span>ข้อมูล ณ วันที่ ${dateStr}</span>
        </div>
      `;
      const canvas=await html2canvas(wrap,{scale:2,useCORS:true,allowTaint:true,logging:false,backgroundColor:"#ffffff",windowWidth:1100});
      document.body.removeChild(wrap);
      const imgData=canvas.toDataURL("image/jpeg",.95);
      const pdf=new jsPDF("l","mm","a4");
      const pw=pdf.internal.pageSize.getWidth();const pgH=pdf.internal.pageSize.getHeight();
      const iw=pw-20;const ih=(canvas.height*iw)/canvas.width;
      let yOff=10;
      pdf.addImage(imgData,"JPEG",10,yOff,iw,ih);
      let remaining=ih+yOff-pgH;
      while(remaining>0){pdf.addPage();yOff-=pgH;pdf.addImage(imgData,"JPEG",10,yOff,iw,ih);remaining-=pgH;}
      dlBlob(pdf.output("blob"),"ผลลัพธ์การตลาด.pdf");
    }catch(e){alert("เกิดข้อผิดพลาด: "+e.message);}
    setExportLoading(false);
  }
  async function exportImage(){
    setExportLoading(true);
    try{
      const pts=genPts(chartFrom,chartTo,gran);
      const totals=sumM(pts);
      const rangeStr=fmtRange(chartFrom,chartTo);
      const granLabel=gran==="day"?"รายวัน":gran==="week"?"รายสัปดาห์":gran==="month"?"รายเดือน":"รายปี";
      const dateStr=new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"});
      const wrap=document.createElement("div");
      wrap.style.cssText="position:fixed;left:-9999px;top:0;width:1100px;background:#0d1117;color:#e6edf3;padding:40px;font-family:sans-serif;";
      document.body.appendChild(wrap);
      const cW=1020;
      const n=pts.length;
      const inboxMax=Math.max(1,...pts.map(d=>(d.fbInbox||0)+(d.tiktokCloudInbox||0)+(d.tiktokBossInbox||0)+(d.lineInbox||0)));
      const resultMax=Math.max(1,...pts.flatMap(d=>[(d.walkIn||0),(d.bookings||0),(d.transfers||0)]));
      function makeSVGDark(keys,mx,h){
        const colors={fbInbox:"#3b82f6",tiktokCloudInbox:"#06b6d4",tiktokBossInbox:"#8b5cf6",lineInbox:"#22c55e",walkIn:"#f59e0b",bookings:"#ec4899",transfers:"#a78bfa"};
        let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${cW}" height="${h+30}" viewBox="0 0 ${cW} ${h+30}">`;
        [0,.25,.5,.75,1].forEach(p=>{const yp=h-(p*h);svg+=`<line x1="0" y1="${yp}" x2="${cW}" y2="${yp}" stroke="#30363d" stroke-width="0.5" stroke-dasharray="4,4"/><text x="2" y="${yp-3}" fill="#8b949e" font-size="8">${fmtMoney(Math.round(mx*p))}</text>`;});
        const gx=i=>(i/Math.max(1,n-1))*(cW-40)+20;const gy=v=>h-(v/mx)*h;
        keys.forEach(k=>{if(n<2)return;const path=pts.map((d,i)=>`${i===0?"M":"L"}${gx(i)},${gy(d[k]||0)}`).join(" ");svg+=`<path d="${path}" fill="none" stroke="${colors[k]||"#3b82f6"}" stroke-width="2.5" opacity="0.9"/>`;if(n<=60)pts.forEach((d,i)=>{svg+=`<circle cx="${gx(i)}" cy="${gy(d[k]||0)}" r="${n>31?1.5:3}" fill="${colors[k]||"#3b82f6"}"/>`;});});
        const step=n>60?Math.ceil(n/15):n>31?Math.ceil(n/10):1;
        pts.forEach((d,i)=>{if(i%step===0||i===n-1)svg+=`<text x="${gx(i)}" y="${h+14}" text-anchor="middle" fill="#8b949e" font-size="${n>60?5:n>31?7:9}">${d.short||d.label}</text>`;});
        svg+=`</svg>`;return svg;
      }
      wrap.innerHTML=`
        <div style="text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #3b82f6">
          <div style="font-size:26px;font-weight:800;color:#58a6ff">📊 ผลลัพธ์การตลาด</div>
          <div style="font-size:14px;color:#c9d1d9;margin-top:6px">${rangeStr} · ${granLabel}</div>
          <div style="font-size:11px;color:#8b949e;margin-top:4px">CPMS — ${dateStr}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px">
          <div style="background:#161b22;border-radius:12px;padding:18px;text-align:center;border:1px solid #30363d"><div style="font-size:10px;color:#8b949e;font-weight:700">📨 รวม Inbox</div><div style="font-size:28px;font-weight:900;color:#58a6ff;margin-top:8px">${fmtMoney(totals.totalInbox)}</div></div>
          <div style="background:#161b22;border-radius:12px;padding:18px;text-align:center;border:1px solid #30363d"><div style="font-size:10px;color:#8b949e;font-weight:700">🚶 Walk-in</div><div style="font-size:28px;font-weight:900;color:#f59e0b;margin-top:8px">${fmtMoney(totals.walkIn||0)}</div></div>
          <div style="background:#161b22;border-radius:12px;padding:18px;text-align:center;border:1px solid #30363d"><div style="font-size:10px;color:#8b949e;font-weight:700">📝 จอง</div><div style="font-size:28px;font-weight:900;color:#3fb950;margin-top:8px">${fmtMoney(totals.bookings||0)} หลัง</div></div>
          <div style="background:#161b22;border-radius:12px;padding:18px;text-align:center;border:1px solid #30363d"><div style="font-size:10px;color:#8b949e;font-weight:700">✅ โอน</div><div style="font-size:28px;font-weight:900;color:#a78bfa;margin-top:8px">${fmtMoney(totals.transfers||0)} หลัง</div></div>
        </div>
        <div style="margin-bottom:20px">
          <div style="font-size:14px;font-weight:700;color:#c9d1d9;margin-bottom:8px">📨 Inbox ทุกช่องทาง</div>
          ${makeSVGDark(["fbInbox","tiktokCloudInbox","tiktokBossInbox","lineInbox"],inboxMax,200)}
        </div>
        <div style="margin-bottom:20px">
          <div style="font-size:14px;font-weight:700;color:#c9d1d9;margin-bottom:8px">🏠 Walk-in / จอง / โอน</div>
          ${makeSVGDark(["walkIn","bookings","transfers"],resultMax,160)}
        </div>
        <div style="padding-top:12px;border-top:1px solid #30363d;text-align:center;font-size:10px;color:#8b949e">CPMS — ${dateStr}</div>
      `;
      const canvas=await html2canvas(wrap,{scale:2,useCORS:true,allowTaint:true,logging:false,backgroundColor:"#0d1117",windowWidth:1100});
      document.body.removeChild(wrap);
      canvas.toBlob(blob=>{if(blob)dlBlob(blob,"ผลลัพธ์การตลาด.png");setExportLoading(false);},"image/png");
    }catch(e){alert("เกิดข้อผิดพลาด: "+e.message);setExportLoading(false);}
  }

  const chartPts=genPts(chartFrom,chartTo,gran);
  const inputSt={background:"#0d1117",border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:"6px 10px",fontSize:13};
  const fmtRange=(f,t)=>{const [fy2,fm2]=f.split("-").map(Number);const [ty2,tm2]=t.split("-").map(Number);return`${thMonths[fm2]} ${fy2+543} — ${thMonths[tm2]} ${ty2+543}`;};
  const monthDays=numDays(y,mo);
  const monthDailyData=Array.from({length:monthDays},(_,i)=>{const ds=`${y}-${String(mo).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`;return getDailyData(ds);});
  const dailyTotals=sumM(monthDailyData);

  return (
    <div style={{padding:isMobileMode?12:24}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:isMobileMode?18:22,fontWeight:700,color:C.text}}>📊 ผลลัพธ์การตลาด</div>
          <div style={{fontSize:13,color:C.muted,marginTop:2}}>เปรียบเทียบได้ถึง 12 ช่วง · เลือก วัน/สัปดาห์/เดือน/ปี · ไม่จำกัดปีย้อนหลัง</div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[["month","📅 รายเดือน"],["chart","📊 กราฟ"],["compare","🔄 เปรียบเทียบ"]].map(([v,l])=>(
            <Btn key={v} size="sm" variant={viewMode===v?"primary":"ghost"} onClick={()=>setViewMode(v)}>{l}</Btn>
          ))}
        </div>
      </div>

      {/* ── MONTHLY VIEW ── */}
      {viewMode==="month"&&<>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          <Btn size="sm" variant="ghost" onClick={()=>changeMonth(-1)}>◀</Btn>
          <span style={{fontSize:16,fontWeight:700,color:C.text}}>{thMonthsFull[mo]} {y+543}</span>
          <Btn size="sm" variant="ghost" onClick={()=>changeMonth(1)}>▶</Btn>
          <div style={{flex:1}}/>
          <Btn size="sm" variant={showDaily?"primary":"ghost"} onClick={()=>setShowDaily(v=>!v)}>📊 รายวัน</Btn>
          {canEdit&&<Btn onClick={openEdit}>✏️ แก้ไข</Btn>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:20}}>
          <Card style={{padding:15}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>📨 รวม Inbox</div><div style={{fontSize:24,fontWeight:800,color:C.blue}}>{fmtMoney(totalInbox)}</div></Card>
          <Card style={{padding:15}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>🚶 Walk-in</div><div style={{fontSize:24,fontWeight:800,color:C.orange}}>{cur.walkIn||0}</div></Card>
          <Card style={{padding:15}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>📝 ยอดจอง</div><div style={{fontSize:24,fontWeight:800,color:C.green}}>{cur.bookings||0} หลัง</div></Card>
          <Card style={{padding:15}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>✅ โอนแล้ว</div><div style={{fontSize:24,fontWeight:800,color:"#a78bfa"}}>{cur.transfers||0} หลัง</div></Card>
        </div>
        <Card style={{padding:isMobileMode?14:20,marginBottom:showDaily?16:0}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:16}}>รายละเอียดแต่ละช่องทาง</div>
          <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:12}}>
            {metrics.map(m=>(
              <div key={m.key} style={{padding:12,background:"#0d1117",borderRadius:8,border:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:4,height:24,borderRadius:2,background:m.color}}/>
                  <span style={{fontSize:13,color:C.text}}>{m.icon} {m.label}</span>
                </div>
                <span style={{fontSize:18,fontWeight:800,color:m.color}}>{cur[m.key]||0}</span>
              </div>
            ))}
          </div>
          {cur.note&&<div style={{marginTop:12,padding:10,background:"#0d1117",borderRadius:8,fontSize:12,color:C.muted}}>📝 {cur.note}</div>}
        </Card>
        {showDaily&&<Card style={{padding:isMobileMode?12:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text}}>📊 ข้อมูลรายวัน — {thMonthsFull[mo]} {y+543}</div>
            <div style={{fontSize:11,color:C.muted}}>Inbox รวม: {fmtMoney(dailyTotals.totalInbox)}</div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
              <thead><tr>
                <th style={{padding:"6px 4px",textAlign:"left",fontSize:9,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>วัน</th>
                {metrics.slice(0,4).map(m=><th key={m.key} style={{padding:"6px 4px",textAlign:"right",fontSize:9,fontWeight:700,color:m.color,borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>{m.icon}</th>)}
                <th style={{padding:"6px 4px",textAlign:"right",fontSize:9,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>🚶</th>
                <th style={{padding:"6px 4px",textAlign:"right",fontSize:9,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>📝</th>
                <th style={{padding:"6px 4px",textAlign:"right",fontSize:9,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>✅</th>
                {canEdit&&<th style={{padding:"6px 4px",textAlign:"center",fontSize:9,borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}/>}
              </tr></thead>
              <tbody>
                {monthDailyData.map((dd,i)=>{const hasData=metrics.some(m=>(dd[m.key]||0)>0);return<tr key={i} style={{borderBottom:`1px solid ${C.border}`,opacity:hasData?1:.5}}>
                  <td style={{padding:"4px",fontSize:12,color:C.text,fontWeight:600}}>{i+1}</td>
                  {metrics.slice(0,4).map(m=><td key={m.key} style={{padding:"4px",textAlign:"right",fontSize:12,color:C.text}}>{dd[m.key]||0}</td>)}
                  <td style={{padding:"4px",textAlign:"right",fontSize:12,color:C.text}}>{dd.walkIn||0}</td>
                  <td style={{padding:"4px",textAlign:"right",fontSize:12,color:C.text}}>{dd.bookings||0}</td>
                  <td style={{padding:"4px",textAlign:"right",fontSize:12,color:C.text}}>{dd.transfers||0}</td>
                  {canEdit&&<td style={{padding:"4px",textAlign:"center"}}><Btn size="sm" variant="ghost" onClick={()=>openDailyEdit(dd.date)}>✏️</Btn></td>}
                </tr>;})}
              </tbody>
            </table>
          </div>
        </Card>}
      </>}

      {/* ── CHART VIEW ── */}
      {viewMode==="chart"&&<>
        <Card style={{padding:12,marginBottom:16}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"flex-end"}}>
            <div><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4}}>จาก</div><input type="month" value={chartFrom} onChange={e=>setChartFrom(e.target.value)} style={inputSt}/></div>
            <div><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4}}>ถึง</div><input type="month" value={chartTo} onChange={e=>setChartTo(e.target.value)} style={inputSt}/></div>
            <div><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4}}>ความละเอียด</div><div style={{display:"flex",gap:4}}>{[["day","วัน"],["week","สัปดาห์"],["month","เดือน"],["year","ปี"]].map(([v,l])=><Btn key={v} size="sm" variant={gran===v?"primary":"ghost"} onClick={()=>setGran(v)}>{l}</Btn>)}</div></div>
            <div><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4}}>แบบกราฟ</div><div style={{display:"flex",gap:4}}>{[["bar","📊 แท่ง"],["line","📈 เส้น"]].map(([v,l])=><Btn key={v} size="sm" variant={chartType===v?"primary":"ghost"} onClick={()=>setChartType(v)}>{l}</Btn>)}</div></div>
            <div style={{flex:1}}/>
            <Btn size="sm" variant="ghost" onClick={exportImage} disabled={exportLoading}>🖼️ PNG</Btn>
            <Btn size="sm" variant="ghost" onClick={exportPDF} disabled={exportLoading}>📄 PDF</Btn>
          </div>
        </Card>
        <div ref={chartRef} style={{padding:isMobileMode?10:20}}>
          <Card style={{padding:isMobileMode?12:20,marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>📨 Inbox ทุกช่องทาง</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:12}}>{fmtRange(chartFrom,chartTo)} · {gran==="day"?"รายวัน":gran==="week"?"รายสัปดาห์":gran==="month"?"รายเดือน":"รายปี"} · {chartPts.length} จุด</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
              {metrics.slice(0,4).map(m=><div key={m.key} style={{display:"flex",alignItems:"center",gap:4,fontSize:10}}><div style={{width:10,height:10,borderRadius:2,background:m.color}}/><span style={{color:C.muted}}>{m.label}</span></div>)}
            </div>
            {chartType==="bar"?<BarChart dataArr={chartPts} metricKeys={inboxKeys}/>:<LineChart dataArr={chartPts} metricKeys={inboxKeys}/>}
          </Card>
          <Card style={{padding:isMobileMode?12:20,marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>🏠 Walk-in / จอง / โอน</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:12}}>เปรียบเทียบผลลัพธ์สำคัญ</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
              {metrics.slice(4).map(m=><div key={m.key} style={{display:"flex",alignItems:"center",gap:4,fontSize:10}}><div style={{width:10,height:10,borderRadius:2,background:m.color}}/><span style={{color:C.muted}}>{m.label}</span></div>)}
            </div>
            {chartType==="bar"?<BarChart dataArr={chartPts} metricKeys={resultKeys} height={180}/>:<LineChart dataArr={chartPts} metricKeys={resultKeys} height={180}/>}
          </Card>
          <Card style={{padding:isMobileMode?12:20}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>📋 ตารางสรุป</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
                <thead><tr><th style={{padding:"6px 8px",textAlign:"left",fontSize:9,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>{gran==="day"?"วัน":gran==="week"?"สัปดาห์":gran==="month"?"เดือน":"ปี"}</th>{metrics.map(m=><th key={m.key} style={{padding:"6px 8px",textAlign:"right",fontSize:9,fontWeight:700,color:m.color,borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>{m.icon}</th>)}<th style={{padding:"6px 8px",textAlign:"right",fontSize:9,fontWeight:700,color:C.text,borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>รวม Inbox</th></tr></thead>
                <tbody>
                  {chartPts.map((d,i)=>{const ti=(d.fbInbox||0)+(d.tiktokCloudInbox||0)+(d.tiktokBossInbox||0)+(d.lineInbox||0);return<tr key={i} style={{borderBottom:`1px solid ${C.border}`}}><td style={{padding:"6px 8px",fontSize:12,color:C.text,fontWeight:600}}>{d.label}</td>{metrics.map(m=><td key={m.key} style={{padding:"6px 8px",textAlign:"right",fontSize:12,color:C.text}}>{d[m.key]||0}</td>)}<td style={{padding:"6px 8px",textAlign:"right",fontSize:12,fontWeight:700,color:C.blue}}>{ti}</td></tr>;})}
                  {chartPts.length>1&&(()=>{const s=sumM(chartPts);return<tr style={{background:C.faint,fontWeight:700}}><td style={{padding:"8px",fontSize:12,color:C.text}}>รวมทั้งหมด</td>{metrics.map(m=><td key={m.key} style={{padding:"8px",textAlign:"right",fontSize:13,color:m.color,fontWeight:800}}>{fmtMoney(s[m.key])}</td>)}<td style={{padding:"8px",textAlign:"right",fontSize:13,color:C.blue,fontWeight:800}}>{fmtMoney(s.totalInbox)}</td></tr>;})()}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </>}

      {/* ── COMPARE VIEW ── */}
      {viewMode==="compare"&&<>
        <Card style={{padding:12,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text}}>🔄 ช่วงเปรียบเทียบ ({cmpPeriods.length}/12)</div>
            <div style={{display:"flex",gap:6}}>
              {cmpPeriods.length<12&&<Btn size="sm" onClick={addPeriod}>+ เพิ่มช่วง</Btn>}
              <Btn size="sm" variant="ghost" onClick={exportImage} disabled={exportLoading}>🖼️ PNG</Btn>
              <Btn size="sm" variant="ghost" onClick={exportPDF} disabled={exportLoading}>📄 PDF</Btn>
            </div>
          </div>
          {cmpPeriods.map((p,i)=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
              <div style={{width:16,height:16,borderRadius:4,background:cmpColors[i%12],flexShrink:0}}/>
              <input type="month" value={p.from} onChange={e=>updPeriod(p.id,"from",e.target.value)} style={{...inputSt,width:140}}/>
              <span style={{color:C.muted,fontSize:12}}>→</span>
              <input type="month" value={p.to} onChange={e=>updPeriod(p.id,"to",e.target.value)} style={{...inputSt,width:140}}/>
              {cmpPeriods.length>1&&<Btn size="sm" variant="ghost" onClick={()=>rmPeriod(p.id)} style={{color:C.red}}>✕</Btn>}
            </div>
          ))}
          <div style={{marginTop:12}}>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4}}>ตัวชี้วัดที่ต้องการเปรียบเทียบ</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{allMetricOpts.map(m=><Btn key={m.key} size="sm" variant={cmpMetric===m.key?"primary":"ghost"} onClick={()=>setCmpMetric(m.key)}>{m.label}</Btn>)}</div>
          </div>
        </Card>
        {(()=>{
          const periodSums=cmpPeriods.map((p,i)=>{const pts=genPts(p.from,p.to,"month");const s=sumM(pts);return{...p,summary:s,pts,label:fmtRange(p.from,p.to),color:cmpColors[i%12]};});
          const selDef=allMetricOpts.find(m=>m.key===cmpMetric)||allMetricOpts[0];
          const barData=periodSums.map(p=>({label:p.label,val:p.summary[cmpMetric]||0}));
          return<div ref={chartRef} style={{padding:isMobileMode?10:20}}>
            <Card style={{padding:isMobileMode?12:20,marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>📊 เปรียบเทียบ: {selDef.label}</div>
              <div style={{fontSize:11,color:C.muted,marginBottom:12}}>{cmpPeriods.length} ช่วงเวลา</div>
              <CmpBarChart periodData={barData}/>
            </Card>
            {(()=>{const lens=periodSums.map(p=>p.pts.length);const allSame=lens.every(l=>l===lens[0])&&lens[0]>1&&lens[0]<=12;if(!allSame)return null;
              return<Card style={{padding:isMobileMode?12:20,marginBottom:16}}>
                <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>📈 แนวโน้มรายเดือน: {selDef.label}</div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>{periodSums.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:4,fontSize:10}}><div style={{width:10,height:10,borderRadius:2,background:p.color}}/><span style={{color:C.muted}}>{p.label}</span></div>)}</div>
                {(()=>{const cW2=isMobileMode?320:700;const h2=200;const nn=lens[0];const mx2=Math.max(1,...periodSums.flatMap(p=>p.pts.map(d=>cmpMetric==="totalInbox"?(d.fbInbox||0)+(d.tiktokCloudInbox||0)+(d.tiktokBossInbox||0)+(d.lineInbox||0):(d[cmpMetric]||0))));const gx2=i2=>(i2/(nn-1))*(cW2-40)+20;const gy2=v2=>h2-(v2/mx2)*h2;const gv=d=>cmpMetric==="totalInbox"?(d.fbInbox||0)+(d.tiktokCloudInbox||0)+(d.tiktokBossInbox||0)+(d.lineInbox||0):(d[cmpMetric]||0);
                  return<svg width="100%" viewBox={`0 0 ${cW2} ${h2+30}`} style={{display:"block"}}>
                    {[0,.25,.5,.75,1].map(pp=>{const yp=h2-(pp*h2);return<g key={pp}><line x1={0} y1={yp} x2={cW2} y2={yp} stroke={C.border} strokeWidth={.5} strokeDasharray="4,4"/><text x={2} y={yp-3} fill={C.muted} fontSize={8}>{fmtMoney(Math.round(mx2*pp))}</text></g>;})}
                    {periodSums.map((p,pi)=>{const path2=p.pts.map((d,i2)=>`${i2===0?"M":"L"}${gx2(i2)},${gy2(gv(d))}`).join(" ");return<g key={pi}><path d={path2} fill="none" stroke={p.color} strokeWidth={2} opacity={.9}/>{nn<=12&&p.pts.map((d,i2)=><circle key={i2} cx={gx2(i2)} cy={gy2(gv(d))} r={3} fill={p.color}><title>{p.label} {thMonths[i2+1]}: {fmtMoney(gv(d))}</title></circle>)}</g>;})}
                    {periodSums[0].pts.map((d,i2)=><text key={i2} x={gx2(i2)} y={h2+14} textAnchor="middle" fill={C.muted} fontSize={9}>{thMonths[i2+1]||d.label}</text>)}
                  </svg>;})()}
              </Card>;})()}
            <Card style={{padding:isMobileMode?12:20}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>📋 ตารางเปรียบเทียบ</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:400}}>
                  <thead><tr><th style={{padding:"8px 10px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>ตัวชี้วัด</th>{periodSums.map((p,i)=><th key={i} style={{padding:"8px 10px",textAlign:"right",fontSize:10,fontWeight:700,color:cmpColors[i%12],borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>{p.label}</th>)}</tr></thead>
                  <tbody>
                    {allMetricOpts.map(m=>{const vals=periodSums.map(p=>p.summary[m.key]||0);const maxV2=Math.max(1,...vals);return<tr key={m.key} style={{borderBottom:`1px solid ${C.border}`,background:m.key===cmpMetric?C.faint:"transparent"}}><td style={{padding:"8px 10px",fontSize:12,color:C.text}}>{m.label}</td>{vals.map((v,i)=><td key={i} style={{padding:"8px 10px",textAlign:"right"}}><div style={{fontSize:14,fontWeight:700,color:v===maxV2&&v>0?cmpColors[i%12]:C.text}}>{fmtMoney(v)}</div>{i>0&&vals[0]>0&&<div style={{fontSize:9,color:v>vals[0]?C.green:v<vals[0]?C.red:C.muted}}>{v>vals[0]?`▲ ${Math.round(((v-vals[0])/vals[0])*100)}%`:v<vals[0]?`▼ ${Math.round(((vals[0]-v)/vals[0])*100)}%`:"="}</div>}</td>)}</tr>;})}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card style={{padding:isMobileMode?12:20,marginTop:16}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>💡 สรุปภาพรวม</div>
              <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"repeat("+Math.min(periodSums.length,3)+",1fr)",gap:12}}>
                {periodSums.slice(0,3).map((p,i)=>(
                  <div key={i} style={{padding:14,background:`linear-gradient(135deg,${p.color}22,#0f172a)`,borderRadius:10,textAlign:"center",border:`1px solid ${p.color}33`}}>
                    <div style={{fontSize:10,color:C.muted,marginBottom:6}}>{p.label}</div>
                    <div style={{fontSize:24,fontWeight:800,color:p.color}}>{fmtMoney(p.summary.totalInbox)}</div>
                    <div style={{fontSize:10,color:C.muted}}>Inbox ทั้งหมด</div>
                    <div style={{marginTop:8,display:"flex",justifyContent:"center",gap:12}}>
                      <div><div style={{fontSize:16,fontWeight:700,color:C.green}}>{p.summary.bookings||0}</div><div style={{fontSize:9,color:C.muted}}>จอง</div></div>
                      <div><div style={{fontSize:16,fontWeight:700,color:"#a78bfa"}}>{p.summary.transfers||0}</div><div style={{fontSize:9,color:C.muted}}>โอน</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>;
        })()}
      </>}

      {editMdl&&(
        <Mdl title={`📊 ผลลัพธ์ — ${thMonthsFull[mo]} ${y+543}`} onClose={()=>setEditMdl(false)} footer={<><Btn variant="ghost" onClick={()=>setEditMdl(false)}>ยกเลิก</Btn><Btn onClick={save}>💾 บันทึก</Btn></>}>
          <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:12}}>
            {metrics.map(m=>(
              <FG key={m.key} label={`${m.icon} ${m.label}`}><FIn type="number" value={form[m.key]||""} onChange={e=>setForm(f=>({...f,[m.key]:e.target.value}))}/></FG>
            ))}
          </div>
          <FG label="หมายเหตุ"><FIn value={form.note||""} onChange={e=>setForm(f=>({...f,note:e.target.value}))} rows={2} placeholder="หมายเหตุประจำเดือน..."/></FG>
        </Mdl>
      )}
      {dailyMdl&&(
        <Mdl title={`📊 ข้อมูลรายวัน — ${dailyMdl}`} onClose={()=>setDailyMdl(null)} footer={<><Btn variant="ghost" onClick={()=>setDailyMdl(null)}>ยกเลิก</Btn><Btn onClick={saveDaily}>💾 บันทึก</Btn></>}>
          <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:12}}>
            {metrics.map(m=>(
              <FG key={m.key} label={`${m.icon} ${m.label}`}><FIn type="number" value={dForm[m.key]||""} onChange={e=>setDForm(f=>({...f,[m.key]:e.target.value}))}/></FG>
            ))}
          </div>
          <FG label="หมายเหตุ"><FIn value={dForm.note||""} onChange={e=>setDForm(f=>({...f,note:e.target.value}))} rows={2} placeholder="หมายเหตุ..."/></FG>
        </Mdl>
      )}
    </div>
  );
}

// ── Cost & Expense Page (ต้นทุนและค่าใช้จ่าย) ──
function CostPage({data,setData,role,isMobileMode}) {
  const canEdit=["owner","engineer","purchasing"].includes(role);
  const [selProj,setSelProj]=useState(data.projects[0]?.id||null);
  const [infraMdl,setInfraMdl]=useState(null);
  const [addInfraMdl,setAddInfraMdl]=useState(false);
  const [infraForm,setInfraForm]=useState({});
  const [boqActMdl,setBoqActMdl]=useState(null);
  const [boqActAmt,setBoqActAmt]=useState("");
  const [boqActReason,setBoqActReason]=useState("");
  const [exportLoading,setExportLoading]=useState(false);
  const [viewMode,setViewMode]=useState("detail"); // detail | summary | weekly
  const [pdfPreviewMdl,setPdfPreviewMdl]=useState(false);
  const [wpMdl,setWpMdl]=useState(null); // add/edit weekly payment
  const [wpForm,setWpForm]=useState({});
  const [wpMonth,setWpMonth]=useState(()=>{const n=new Date();return`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;});
  const [addExtraMdl,setAddExtraMdl]=useState(null); // {houseId}
  const [extraForm,setExtraForm]=useState({phaseId:"",name:"",unit:"",qty:1,boqPrice:0,actualPrice:0});
  const costRef=useRef(null);
  const chartRef=useRef(null);

  const DEFAULT_INFRA=[
    {id:uid(),name:"ถนน",unit:"เหมา",qty:1,boqPrice:0,actualPrice:0,note:""},
    {id:uid(),name:"ท่อระบายน้ำ",unit:"เหมา",qty:1,boqPrice:0,actualPrice:0,note:""},
    {id:uid(),name:"กำแพงกันดินรอบโครงการ",unit:"เหมา",qty:1,boqPrice:0,actualPrice:0,note:""},
    {id:uid(),name:"กำแพงรอบโครงการ",unit:"เหมา",qty:1,boqPrice:0,actualPrice:0,note:""},
    {id:uid(),name:"กำแพงขั้นระหว่างบ้าน",unit:"เหมา",qty:1,boqPrice:0,actualPrice:0,note:""},
    {id:uid(),name:"ขยายเขตไฟฟ้า",unit:"เหมา",qty:1,boqPrice:0,actualPrice:0,note:""},
    {id:uid(),name:"ขยายเขตประปา",unit:"เหมา",qty:1,boqPrice:0,actualPrice:0,note:""},
    {id:uid(),name:"ค่าถมดิน",unit:"คิว",qty:0,boqPrice:0,actualPrice:0,note:""},
    {id:uid(),name:"ค่าเคลียริ่ง",unit:"เหมา",qty:1,boqPrice:0,actualPrice:0,note:""},
    {id:uid(),name:"ค่าติดมิเตอร์ไฟชั่วคราว",unit:"จุด",qty:1,boqPrice:0,actualPrice:0,note:""},
    {id:uid(),name:"ค่าน้ำค่าไฟก่อสร้าง",unit:"เดือน",qty:0,boqPrice:0,actualPrice:0,note:""},
    {id:uid(),name:"ค่าทำแคมป์คนงาน",unit:"เหมา",qty:1,boqPrice:0,actualPrice:0,note:""},
  ];

  function getInfra(projId){return(data.infrastructureCosts||{})[projId]||[];}
  function setInfra(projId,items){setData(d=>({...d,infrastructureCosts:{...(d.infrastructureCosts||{}),[projId]:items}}));}
  function initInfra(projId){if(getInfra(projId).length===0)setInfra(projId,DEFAULT_INFRA.map(d=>({...d,id:uid()})));}
  function openInfraEdit(item){setInfraForm({...item});setInfraMdl(item.id);}
  function saveInfra(){const items=getInfra(selProj).map(i=>i.id===infraForm.id?{...infraForm,qty:Number(infraForm.qty)||0,boqPrice:Number(infraForm.boqPrice)||0,actualPrice:Number(infraForm.actualPrice)||0}:i);setInfra(selProj,items);setInfraMdl(null);}
  function addNewInfra(){setInfraForm({id:uid(),name:"",unit:"เหมา",qty:1,boqPrice:0,actualPrice:0,note:""});setAddInfraMdl(true);}
  function saveNewInfra(){const item={...infraForm,id:uid(),qty:Number(infraForm.qty)||0,boqPrice:Number(infraForm.boqPrice)||0,actualPrice:Number(infraForm.actualPrice)||0};setInfra(selProj,[...getInfra(selProj),item]);setAddInfraMdl(false);}
  function delInfra(id){if(confirm("ลบรายการนี้?")){setInfra(selProj,getInfra(selProj).filter(i=>i.id!==id));}}
  function openBoqAct(item){setBoqActMdl(item);setBoqActAmt(item.actualPrice||"");setBoqActReason(item.overBudgetReason||"");}
  function saveBoqAct(){setData(d=>({...d,boqItems:d.boqItems.map(b=>b.id===boqActMdl.id?{...b,actualPrice:Number(boqActAmt)||0,overBudgetReason:boqActReason}:b)}));setBoqActMdl(null);}
  // Add extra BOQ item to a house under a specific phase
  function openAddExtra(houseId){setAddExtraMdl({houseId});setExtraForm({phaseId:data.phases[0]?.id||"",name:"",unit:"ชิ้น",qty:1,boqPrice:0,actualPrice:0});}
  function saveExtra(){
    const item={id:uid(),houseId:addExtraMdl.houseId,phaseId:Number(extraForm.phaseId),name:extraForm.name,unit:extraForm.unit,qty:Number(extraForm.qty)||1,boqPrice:Number(extraForm.boqPrice)||0,actualPrice:Number(extraForm.actualPrice)||0,isExtra:true};
    setData(d=>({...d,boqItems:[...d.boqItems,item]}));setAddExtraMdl(null);
  }
  function delBoqItem(id){if(confirm("ลบรายการนี้?")){setData(d=>({...d,boqItems:d.boqItems.filter(b=>b.id!==id)}));}}

  // ── Weekly Payment functions ──
  function getWeeklyPayments(projId){return(data.weeklyPayments||{})[projId]||[];}
  function setWeeklyPayments(projId,items){setData(d=>({...d,weeklyPayments:{...(d.weeklyPayments||{}),[projId]:items}}));}
  function openAddWP(prefillDate){
    const dayNames=["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
    const d=prefillDate?new Date(prefillDate):new Date();
    const dayName=dayNames[d.getDay()];
    setWpForm({id:uid(),date:prefillDate||new Date().toISOString().slice(0,10),dayName,type:"material",amount:"",laborAmount:"",note:"",items:[]});
    setWpMdl("add");
  }
  function openEditWP(wp){setWpForm({...wp});setWpMdl("edit");}
  function saveWP(){
    const entry={...wpForm,amount:Number(wpForm.amount)||0,laborAmount:Number(wpForm.laborAmount)||0};
    const existing=getWeeklyPayments(selProj);
    const idx=existing.findIndex(w=>w.id===entry.id);
    setWeeklyPayments(selProj,idx>=0?existing.map(w=>w.id===entry.id?entry:w):[...existing,entry]);
    setWpMdl(null);
  }
  function delWP(id){if(confirm("ลบรายการนี้?")){setWeeklyPayments(selProj,getWeeklyPayments(selProj).filter(w=>w.id!==id));}}

  const proj=data.projects.find(p=>p.id===selProj);
  const projHouses=data.houses.filter(h=>h.projectId===selProj);
  const infraItems=getInfra(selProj);
  const infraBOQ=infraItems.reduce((s,i)=>s+(i.qty*i.boqPrice),0);
  const infraActual=infraItems.reduce((s,i)=>s+(i.qty*i.actualPrice),0);
  const projBoqItems=data.boqItems.filter(b=>projHouses.some(h=>h.id===b.houseId));
  const totalBoq=projHouses.reduce((s,h)=>s+h.boq,0);
  const totalActual=projBoqItems.reduce((s,b)=>s+(b.actualPrice>0?b.qty*b.actualPrice:0),0);
  const grandBoq=totalBoq+infraBOQ;
  const grandActual=totalActual+infraActual;

  // Per-house summary data for chart
  const houseSummary=projHouses.map(h=>{
    const items=data.boqItems.filter(b=>b.houseId===h.id);
    const boq=items.reduce((s,b)=>s+b.qty*b.boqPrice,0);
    const act=items.reduce((s,b)=>s+(b.actualPrice>0?b.qty*b.actualPrice:0),0);
    return{id:h.id,name:h.name,boq,actual:act,diff:act-boq,customer:h.customer||"ว่าง"};
  });
  const overBudgetHouses=houseSummary.filter(h=>h.actual>0&&h.diff>0);
  const maxVal=Math.max(...houseSummary.map(h=>Math.max(h.boq,h.actual)),1);

  async function exportCostPDF(){
    setExportLoading(true);
    try{
      // Build offscreen div for PDF
      const wrap=document.createElement("div");
      wrap.style.cssText="position:fixed;left:-9999px;top:0;width:900px;background:#fff;color:#1a1a1a;padding:32px;font-family:sans-serif;";
      document.body.appendChild(wrap);
      const pName=proj?.name||"โครงการ";
      const dateStr=new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"});
      wrap.innerHTML=`
        <div style="text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #2563eb">
          <div style="font-size:24px;font-weight:800;color:#2563eb">💰 รายงานต้นทุนและค่าใช้จ่าย</div>
          <div style="font-size:16px;font-weight:600;color:#1e3a5f;margin-top:6px">${pName}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:6px">ระบบ CPMS — ${dateStr}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:24px">
          <div style="background:#f8fafc;border-radius:10px;padding:16px;text-align:center"><div style="font-size:10px;color:#6b7280;font-weight:700">BOQ รวม</div><div style="font-size:18px;font-weight:800;color:#2563eb;margin-top:6px">฿${fmtMoney(grandBoq)}</div></div>
          <div style="background:#f8fafc;border-radius:10px;padding:16px;text-align:center"><div style="font-size:10px;color:#6b7280;font-weight:700">จ่ายจริง</div><div style="font-size:18px;font-weight:800;color:${grandActual>grandBoq?"#ef4444":"#22c55e"};margin-top:6px">฿${fmtMoney(grandActual)}</div></div>
          <div style="background:#f8fafc;border-radius:10px;padding:16px;text-align:center"><div style="font-size:10px;color:#6b7280;font-weight:700">สาธารณูปโภค</div><div style="font-size:18px;font-weight:800;color:#f59e0b;margin-top:6px">฿${fmtMoney(infraActual)}</div></div>
          <div style="background:#f8fafc;border-radius:10px;padding:16px;text-align:center"><div style="font-size:10px;color:#6b7280;font-weight:700">ส่วนต่าง</div><div style="font-size:18px;font-weight:800;color:${grandActual>grandBoq?"#ef4444":"#22c55e"};margin-top:6px">${grandActual>grandBoq?"+":""}฿${fmtMoney(Math.abs(grandBoq-grandActual))}</div></div>
        </div>
        <div style="font-size:15px;font-weight:700;margin-bottom:12px;color:#1e3a5f">📋 สรุปต้นทุนรายบ้าน</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead><tr>${["บ้าน","ลูกค้า","BOQ","จ่ายจริง","ส่วนต่าง","สถานะ"].map(h=>`<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;border-bottom:2px solid #e2e8f0;background:#f8fafc">${h}</th>`).join("")}</tr></thead>
          <tbody>${houseSummary.map(h=>`<tr style="border-bottom:1px solid #e2e8f0">
            <td style="padding:8px 10px;font-size:12px;font-weight:600">${h.name}</td>
            <td style="padding:8px 10px;font-size:12px;color:#6b7280">${h.customer}</td>
            <td style="padding:8px 10px;font-size:12px;color:#2563eb">฿${fmtMoney(h.boq)}</td>
            <td style="padding:8px 10px;font-size:12px;font-weight:700;color:${h.actual>h.boq?"#ef4444":"#22c55e"}">฿${fmtMoney(h.actual)}</td>
            <td style="padding:8px 10px;font-size:12px;color:${h.diff>0?"#ef4444":"#22c55e"};font-weight:700">${h.diff>0?"+":""}฿${fmtMoney(Math.abs(h.diff))}</td>
            <td style="padding:8px 10px"><span style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${h.diff>0?"#fef2f2":"#f0fdf4"};color:${h.diff>0?"#ef4444":"#22c55e"}">${h.diff>0?"เกินงบ":"ปกติ"}</span></td>
          </tr>`).join("")}</tbody>
        </table>
        ${infraItems.length>0?`
        <div style="font-size:15px;font-weight:700;margin-bottom:12px;color:#1e3a5f">🏗️ รายการสาธารณูปโภค</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead><tr>${["รายการ","หน่วย","จำนวน","BOQ/หน่วย","จริง/หน่วย","รวม BOQ","รวมจริง"].map(h=>`<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;border-bottom:2px solid #e2e8f0;background:#f8fafc">${h}</th>`).join("")}</tr></thead>
          <tbody>${infraItems.map(it=>`<tr style="border-bottom:1px solid #e2e8f0">
            <td style="padding:6px 10px;font-size:11px">${it.name}</td>
            <td style="padding:6px 10px;font-size:11px;color:#6b7280">${it.unit}</td>
            <td style="padding:6px 10px;font-size:11px">${fmtMoney(it.qty)}</td>
            <td style="padding:6px 10px;font-size:11px;color:#2563eb">฿${fmtMoney(it.boqPrice)}</td>
            <td style="padding:6px 10px;font-size:11px;color:${it.actualPrice>it.boqPrice?"#ef4444":"#22c55e"}">฿${fmtMoney(it.actualPrice)}</td>
            <td style="padding:6px 10px;font-size:11px">฿${fmtMoney(it.qty*it.boqPrice)}</td>
            <td style="padding:6px 10px;font-size:11px;font-weight:700">฿${fmtMoney(it.qty*it.actualPrice)}</td>
          </tr>`).join("")}</tbody>
        </table>`:""}
        <div style="padding-top:16px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af">
          <span>เอกสารจัดทำโดยระบบ CPMS</span>
          <span>ข้อมูล ณ วันที่ ${dateStr}</span>
        </div>
      `;
      const canvas=await html2canvas(wrap,{scale:2,useCORS:true,allowTaint:true,logging:false,backgroundColor:"#ffffff",windowWidth:900});
      document.body.removeChild(wrap);
      const imgData=canvas.toDataURL("image/jpeg",0.95);
      const pdf=new jsPDF("p","mm","a4");
      const pw=pdf.internal.pageSize.getWidth();const pgH=pdf.internal.pageSize.getHeight();
      const iw=pw-20;const ih=(canvas.height*iw)/canvas.width;
      let yOff=10;
      pdf.addImage(imgData,"JPEG",10,yOff,iw,ih);
      let remaining=ih+yOff-pgH;
      while(remaining>0){pdf.addPage();yOff-=pgH;pdf.addImage(imgData,"JPEG",10,yOff,iw,ih);remaining-=pgH;}
      dlBlob(pdf.output("blob"),`ต้นทุน_${pName}.pdf`);
    }catch(e){alert("เกิดข้อผิดพลาด: "+e.message);}
    setExportLoading(false);
  }
  async function exportChartImage(){
    const el=chartRef.current;if(!el)return;
    try{
      const canvas=await html2canvas(el,{scale:2,useCORS:true,allowTaint:true,logging:false,backgroundColor:"#0d1117",windowWidth:900});
      canvas.toBlob(blob=>{if(blob)dlBlob(blob,`สรุปต้นทุน_${proj?.name||"โครงการ"}.png`);},"image/png");
    }catch(e){alert("Error: "+e.message);}
  }

  return(
    <div style={{padding:isMobileMode?12:24}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:isMobileMode?18:22,fontWeight:700,color:C.text}}>💰 ต้นทุนและค่าใช้จ่าย</div>
          <div style={{fontSize:13,color:C.muted,marginTop:2}}>สาธารณูปโภค, วัสดุก่อสร้าง, ต้นทุนรวมแต่ละโครงการ</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[["detail","📋 รายละเอียด"],["weekly","💳 รายจ่ายรายสัปดาห์"],["summary","📊 สรุป"]].map(([m,l])=><Btn key={m} size="sm" variant={viewMode===m?"primary":"ghost"} onClick={()=>setViewMode(m)}>{l}</Btn>)}
          <Btn size="sm" variant="ghost" onClick={()=>setPdfPreviewMdl(true)}>👁 Preview PDF</Btn>
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {data.projects.map(p=><Btn key={p.id} size="sm" variant={selProj===p.id?"primary":"ghost"} onClick={()=>{setSelProj(p.id);if(getInfra(p.id).length===0)initInfra(p.id);}}>{p.name}</Btn>)}
      </div>

      {viewMode==="detail"?(
      <div ref={costRef}>
        <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:20}}>
          <Card style={{padding:14}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>🏗️ ต้นทุน BOQ รวม</div><div style={{fontSize:isMobileMode?16:20,fontWeight:800,color:C.blue}}>฿{fmtMoney(grandBoq)}</div></Card>
          <Card style={{padding:14}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>💸 ใช้จ่ายจริง</div><div style={{fontSize:isMobileMode?16:20,fontWeight:800,color:grandActual>grandBoq?C.red:C.green}}>฿{fmtMoney(grandActual)}</div></Card>
          <Card style={{padding:14}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>🏠 จำนวนบ้าน</div><div style={{fontSize:isMobileMode?16:20,fontWeight:800,color:C.text}}>{projHouses.length} หลัง</div></Card>
          <Card style={{padding:14}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>{grandActual<=grandBoq?"✅":"⚠️"} ส่วนต่าง</div><div style={{fontSize:isMobileMode?16:20,fontWeight:800,color:grandActual>grandBoq?C.red:C.green}}>฿{fmtMoney(Math.abs(grandBoq-grandActual))}</div><div style={{fontSize:10,color:C.muted}}>{grandActual>grandBoq?"เกินงบ":"ประหยัด"}</div></Card>
        </div>
        {/* Infrastructure */}
        <Card style={{padding:isMobileMode?12:20,marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div><div style={{fontSize:15,fontWeight:700,color:C.text}}>🚧 งานสาธารณูปโภค — {proj?.name}</div><div style={{fontSize:11,color:C.muted}}>BOQ: ฿{fmtMoney(infraBOQ)} | จ่ายจริง: ฿{fmtMoney(infraActual)} | ส่วนต่าง: <span style={{color:infraActual>infraBOQ?C.red:C.green}}>฿{fmtMoney(Math.abs(infraBOQ-infraActual))}</span></div></div>
            {canEdit&&<Btn size="sm" onClick={addNewInfra}>+ เพิ่มรายการ</Btn>}
          </div>
          {infraItems.length===0?<div style={{textAlign:"center",padding:20}}><div style={{color:C.muted,marginBottom:8}}>ยังไม่มีข้อมูลสาธารณูปโภค</div>{["owner","engineer"].includes(role)&&<Btn onClick={()=>initInfra(selProj)}>🚧 สร้างรายการเริ่มต้น</Btn>}</div>:(
            <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
              <thead><tr>{["รายการ","หน่วย","จำนวน","ราคา BOQ/หน่วย","รวม BOQ","ราคาจริง/หน่วย","รวมจริง","ส่วนต่าง",""].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",fontSize:9,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`,background:"#0d1117",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>
                {infraItems.map(item=>{const boqT=item.qty*item.boqPrice;const actT=item.qty*item.actualPrice;const diff=boqT-actT;return(
                    <tr key={item.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background=C.panel} onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <td style={{padding:"8px 10px",fontSize:12,color:C.text,fontWeight:600}}>{item.name}</td><td style={{padding:"8px 10px",fontSize:11,color:C.muted}}>{item.unit}</td><td style={{padding:"8px 10px",fontSize:12,color:C.text}}>{fmtMoney(item.qty)}</td><td style={{padding:"8px 10px",fontSize:12,color:C.blue}}>฿{fmtMoney(item.boqPrice)}</td><td style={{padding:"8px 10px",fontSize:12,color:C.blue,fontWeight:700}}>฿{fmtMoney(boqT)}</td><td style={{padding:"8px 10px",fontSize:12,color:item.actualPrice>0?C.text:C.muted}}>{item.actualPrice>0?`฿${fmtMoney(item.actualPrice)}`:"—"}</td><td style={{padding:"8px 10px",fontSize:12,color:actT>0?(actT>boqT?C.red:C.green):C.muted,fontWeight:700}}>{actT>0?`฿${fmtMoney(actT)}`:"—"}</td><td style={{padding:"8px 10px",fontSize:11,color:diff>=0?C.green:C.red}}>{actT>0?(diff>=0?`+฿${fmtMoney(diff)}`:`-฿${fmtMoney(Math.abs(diff))}`):"—"}</td>
                      <td style={{padding:"8px 10px"}}><div style={{display:"flex",gap:4}}>{canEdit&&<Btn size="sm" variant="ghost" onClick={()=>openInfraEdit(item)}>✏️</Btn>}{canEdit&&<Btn size="sm" variant="ghost" onClick={()=>delInfra(item.id)} style={{color:C.red}}>🗑</Btn>}</div></td>
                    </tr>);})}
                <tr style={{background:C.faint}}><td colSpan={4} style={{padding:"8px 10px",fontSize:12,fontWeight:700,color:C.text}}>รวมสาธารณูปโภค</td><td style={{padding:"8px 10px",fontSize:13,fontWeight:800,color:C.blue}}>฿{fmtMoney(infraBOQ)}</td><td></td><td style={{padding:"8px 10px",fontSize:13,fontWeight:800,color:infraActual>infraBOQ?C.red:C.green}}>฿{fmtMoney(infraActual)}</td><td style={{padding:"8px 10px",fontSize:12,fontWeight:700,color:infraBOQ>=infraActual?C.green:C.red}}>{infraBOQ>=infraActual?`+฿${fmtMoney(infraBOQ-infraActual)}`:`-฿${fmtMoney(infraActual-infraBOQ)}`}</td><td></td></tr>
              </tbody>
            </table></div>
          )}
        </Card>
        {/* BOQ Cost per House */}
        <Card style={{padding:isMobileMode?12:20}}>
          <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:4}}>🏠 ต้นทุนก่อสร้างแต่ละบ้าน</div>
          <div style={{fontSize:11,color:C.muted,marginBottom:12}}>ข้อมูลจาก BOQ — จัดซื้อใส่ราคาจริง + เพิ่มรายการนอกเหนือได้</div>
          {projHouses.length===0?<div style={{padding:20,textAlign:"center",color:C.muted}}>ไม่มีบ้านในโครงการนี้</div>:
            projHouses.map(h=>{
              const houseBoqItems=data.boqItems.filter(b=>b.houseId===h.id);
              const hBoq=houseBoqItems.reduce((s,b)=>s+b.qty*b.boqPrice,0);
              const hAct=houseBoqItems.reduce((s,b)=>s+(b.actualPrice>0?b.qty*b.actualPrice:0),0);
              return(
                <div key={h.id} style={{marginBottom:16,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
                  <div style={{padding:"10px 14px",background:C.faint,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                    <div><span style={{fontSize:13,fontWeight:700,color:C.text}}>🏠 {h.name}</span><span style={{fontSize:11,color:C.muted,marginLeft:8}}>{h.customer||"ว่าง"}</span><Tag color={h.status==="completed"?"green":h.status==="inprogress"?"blue":"gray"} style={{marginLeft:8}}>{ST_LBL[h.status]}</Tag></div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{textAlign:"right"}}><div style={{fontSize:11,color:C.muted}}>BOQ ฿{fmtMoney(h.boq)} | จ่ายจริง ฿{fmtMoney(hAct)}</div><div style={{fontSize:11,color:hAct>h.boq?C.red:C.green,fontWeight:700}}>{hAct>h.boq?`เกินงบ ฿${fmtMoney(hAct-h.boq)}`:`เหลือ ฿${fmtMoney(h.boq-hAct)}`}</div></div>
                      {canEdit&&<Btn size="sm" variant="ghost" onClick={()=>openAddExtra(h.id)} style={{color:C.blue}}>+ รายการ</Btn>}
                    </div>
                  </div>
                  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
                    <thead><tr>{["หมวด","รายการ","หน่วย","จำนวน","ราคา BOQ","ราคาจริง","ส่วนต่าง",""].map(th=><th key={th} style={{padding:"5px 8px",textAlign:"left",fontSize:9,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>{th}</th>)}</tr></thead>
                    <tbody>
                      {houseBoqItems.map(b=>{const ph=data.phases.find(p=>p.id===b.phaseId);const bT=b.qty*b.boqPrice;const aT=b.actualPrice>0?b.qty*b.actualPrice:0;return(
                          <tr key={b.id} style={{borderBottom:`1px solid ${C.border}`,background:b.isExtra?"rgba(59,130,246,0.05)":""}}>
                            <td style={{padding:"6px 8px",fontSize:10,color:C.muted}}>{ph?.name||"—"}{b.isExtra&&<span style={{color:C.orange,marginLeft:4,fontSize:9}}>✦ เพิ่มเติม</span>}</td>
                            <td style={{padding:"6px 8px",fontSize:11,color:C.text}}>{b.name}</td><td style={{padding:"6px 8px",fontSize:10,color:C.muted}}>{b.unit}</td><td style={{padding:"6px 8px",fontSize:11,color:C.text}}>{fmtMoney(b.qty)}</td><td style={{padding:"6px 8px",fontSize:11,color:C.blue}}>฿{fmtMoney(bT)}</td>
                            <td style={{padding:"6px 8px",fontSize:11,color:aT>0?(aT>bT?C.red:C.green):C.muted,fontWeight:aT>0?700:400}}>{aT>0?`฿${fmtMoney(aT)}`:"—"}</td>
                            <td style={{padding:"6px 8px",fontSize:10,color:aT>0?(bT>=aT?C.green:C.red):C.muted}}>{aT>0?(bT>=aT?`+฿${fmtMoney(bT-aT)}`:`-฿${fmtMoney(aT-bT)}`):"—"}</td>
                            <td style={{padding:"6px 8px"}}><div style={{display:"flex",gap:4}}>{canEdit&&<Btn size="sm" variant="ghost" onClick={()=>openBoqAct(b)}>💰</Btn>}{b.isExtra&&canEdit&&<Btn size="sm" variant="ghost" onClick={()=>delBoqItem(b.id)} style={{color:C.red}}>🗑</Btn>}</div></td>
                          </tr>);})}
                    </tbody>
                  </table></div>
                </div>
              );
            })
          }
        </Card>
      </div>
      ):viewMode==="weekly"?(
      /* ═══ WEEKLY PAYMENT TRACKING VIEW ═══ */
      (()=>{
        const wpItems=getWeeklyPayments(selProj).filter(w=>w.date&&w.date.startsWith(wpMonth)).sort((a,b)=>a.date.localeCompare(b.date));
        const monthMaterialTotal=wpItems.reduce((s,w)=>s+(Number(w.amount)||0),0);
        const monthLaborTotal=wpItems.reduce((s,w)=>s+(Number(w.laborAmount)||0),0);
        const monthGrandTotal=monthMaterialTotal+monthLaborTotal;
        // Group by week (ISO week)
        const getWeekKey=(dateStr)=>{const d=new Date(dateStr);const jan1=new Date(d.getFullYear(),0,1);const days=Math.floor((d-jan1)/86400000);return`W${Math.ceil((days+jan1.getDay()+1)/7)}`;};
        const weekGroups={};
        wpItems.forEach(w=>{const wk=getWeekKey(w.date);if(!weekGroups[wk])weekGroups[wk]={key:wk,items:[],matTotal:0,laborTotal:0};weekGroups[wk].items.push(w);weekGroups[wk].matTotal+=Number(w.amount)||0;weekGroups[wk].laborTotal+=Number(w.laborAmount)||0;});
        const weekList=Object.values(weekGroups);
        const dayNames=["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
        return(
        <div>
          {/* KPI Cards */}
          <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:20}}>
            <Card style={{padding:14}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>🛒 ค่าวัสดุ (เดือนนี้)</div><div style={{fontSize:isMobileMode?16:20,fontWeight:800,color:C.blue}}>฿{fmtMoney(monthMaterialTotal)}</div></Card>
            <Card style={{padding:14}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>👷 ค่าแรง (เดือนนี้)</div><div style={{fontSize:isMobileMode?16:20,fontWeight:800,color:C.orange}}>฿{fmtMoney(monthLaborTotal)}</div></Card>
            <Card style={{padding:14}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>💰 รวมทั้งเดือน</div><div style={{fontSize:isMobileMode?16:20,fontWeight:800,color:C.text}}>฿{fmtMoney(monthGrandTotal)}</div></Card>
            <Card style={{padding:14}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>📊 เทียบ BOQ จ่ายจริง</div><div style={{fontSize:isMobileMode?16:20,fontWeight:800,color:monthGrandTotal>grandActual?C.red:C.green}}>฿{fmtMoney(grandActual)}</div><div style={{fontSize:9,color:C.muted}}>ยอดจ่ายจริงจาก BOQ ทั้งโครงการ</div></Card>
          </div>
          {/* Month Selector + Add Button */}
          <Card style={{padding:isMobileMode?12:20,marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:15,fontWeight:700,color:C.text}}>💳 รายจ่ายประจำสัปดาห์ — {proj?.name}</span>
                <FIn type="month" value={wpMonth} onChange={e=>setWpMonth(e.target.value)} style={{width:160,padding:"6px 10px",fontSize:12}}/>
              </div>
              {canEdit&&<Btn size="sm" onClick={()=>openAddWP()}>+ เพิ่มรายการจ่าย</Btn>}
            </div>
            {/* Weekly groups */}
            {weekList.length===0&&<div style={{textAlign:"center",padding:30,color:C.muted}}>ยังไม่มีข้อมูลรายจ่ายในเดือนนี้<br/><span style={{fontSize:11}}>กดปุ่มด้านบนหรือคลิกที่วันที่เพื่อเพิ่ม</span></div>}
            {weekList.map(wk=>(
              <div key={wk.key} style={{marginBottom:16,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
                <div style={{padding:"10px 14px",background:C.faint,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>📆 {wk.key} — {wk.items.length} รายการ</div>
                  <div style={{display:"flex",gap:12,fontSize:12}}>
                    <span style={{color:C.blue,fontWeight:700}}>🛒 วัสดุ ฿{fmtMoney(wk.matTotal)}</span>
                    <span style={{color:C.orange,fontWeight:700}}>👷 ค่าแรง ฿{fmtMoney(wk.laborTotal)}</span>
                    <span style={{color:C.text,fontWeight:800}}>รวม ฿{fmtMoney(wk.matTotal+wk.laborTotal)}</span>
                  </div>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["วันที่","วัน","🛒 ค่าวัสดุ","👷 ค่าแรง","รวม","หมายเหตุ",""].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",fontSize:9,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`,background:"#0d1117"}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {wk.items.map(w=>{const dt=new Date(w.date);const dayName=dayNames[dt.getDay()];const rowTotal=(Number(w.amount)||0)+(Number(w.laborAmount)||0);return(
                      <tr key={w.id} style={{borderBottom:`1px solid ${C.border}`}}>
                        <td style={{padding:"8px 10px",fontSize:12,color:C.text,fontWeight:600}}>{w.date}</td>
                        <td style={{padding:"8px 10px",fontSize:11,color:dt.getDay()===3?C.blue:C.green,fontWeight:600}}>{dayName}</td>
                        <td style={{padding:"8px 10px",fontSize:12,color:C.blue,fontWeight:700}}>฿{fmtMoney(Number(w.amount)||0)}</td>
                        <td style={{padding:"8px 10px",fontSize:12,color:C.orange,fontWeight:700}}>฿{fmtMoney(Number(w.laborAmount)||0)}</td>
                        <td style={{padding:"8px 10px",fontSize:12,color:C.text,fontWeight:800}}>฿{fmtMoney(rowTotal)}</td>
                        <td style={{padding:"8px 10px",fontSize:11,color:C.muted,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.note||"—"}</td>
                        <td style={{padding:"8px 10px"}}><div style={{display:"flex",gap:4}}>{canEdit&&<Btn size="sm" variant="ghost" onClick={()=>openEditWP(w)}>✏️</Btn>}{canEdit&&<Btn size="sm" variant="ghost" onClick={()=>delWP(w.id)} style={{color:C.red}}>🗑</Btn>}</div></td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            ))}
            {/* Monthly Totals Footer */}
            {wpItems.length>0&&(
            <div style={{marginTop:12,padding:14,background:C.faint,borderRadius:10}}>
              <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:8}}>📊 สรุปรายจ่ายเดือน {wpMonth}</div>
              <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr 1fr",gap:12}}>
                <div style={{padding:12,background:C.panel,borderRadius:8,textAlign:"center"}}><div style={{fontSize:10,color:C.muted,fontWeight:700}}>🛒 ค่าวัสดุรวม</div><div style={{fontSize:20,fontWeight:800,color:C.blue,marginTop:4}}>฿{fmtMoney(monthMaterialTotal)}</div></div>
                <div style={{padding:12,background:C.panel,borderRadius:8,textAlign:"center"}}><div style={{fontSize:10,color:C.muted,fontWeight:700}}>👷 ค่าแรงรวม</div><div style={{fontSize:20,fontWeight:800,color:C.orange,marginTop:4}}>฿{fmtMoney(monthLaborTotal)}</div></div>
                <div style={{padding:12,background:C.panel,borderRadius:8,textAlign:"center"}}><div style={{fontSize:10,color:C.muted,fontWeight:700}}>💰 รวมทั้งหมด</div><div style={{fontSize:20,fontWeight:800,color:C.text,marginTop:4}}>฿{fmtMoney(monthGrandTotal)}</div></div>
              </div>
              {/* Reconciliation with BOQ */}
              <div style={{marginTop:12,padding:12,background:"rgba(59,130,246,0.06)",borderRadius:8,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:6}}>🔍 เปรียบเทียบกับยอด BOQ จ่ายจริง</div>
                <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr 1fr",gap:10}}>
                  <div><div style={{fontSize:10,color:C.muted}}>ยอดจ่ายจริง BOQ (ทั้งโครงการ)</div><div style={{fontSize:14,fontWeight:700,color:C.blue}}>฿{fmtMoney(grandActual)}</div></div>
                  <div><div style={{fontSize:10,color:C.muted}}>ยอดโอนจ่ายสะสม (ทุกเดือน)</div><div style={{fontSize:14,fontWeight:700,color:C.text}}>฿{fmtMoney(getWeeklyPayments(selProj).reduce((s,w)=>s+(Number(w.amount)||0)+(Number(w.laborAmount)||0),0))}</div></div>
                  <div><div style={{fontSize:10,color:C.muted}}>ส่วนต่าง</div>{(()=>{const allWpTotal=getWeeklyPayments(selProj).reduce((s,w)=>s+(Number(w.amount)||0)+(Number(w.laborAmount)||0),0);const diff=grandActual-allWpTotal;return<div style={{fontSize:14,fontWeight:700,color:diff>=0?C.green:C.red}}>{diff>=0?`ยังไม่ได้โอน ฿${fmtMoney(diff)}`:`โอนเกิน ฿${fmtMoney(Math.abs(diff))}`}</div>;})()}</div>
                </div>
              </div>
            </div>
            )}
          </Card>
        </div>
        );
      })()
      ):(
      /* ═══ SUMMARY VIEW with chart ═══ */
      <div ref={chartRef} style={{background:C.bg,padding:isMobileMode?8:20}}>
        {/* Header */}
        <div style={{textAlign:"center",marginBottom:20,paddingBottom:16,borderBottom:`3px solid ${C.blue}`}}>
          <div style={{fontSize:isMobileMode?18:24,fontWeight:900,color:C.text}}>💰 รายงานสรุปต้นทุน — {proj?.name}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:4}}>ระบบ CPMS — {new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"})}</div>
        </div>
        {/* KPI Cards */}
        <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr 1fr":"repeat(5,1fr)",gap:12,marginBottom:20}}>
          <Card style={{padding:14,borderLeft:`4px solid ${C.blue}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>🏗️ ต้นทุน BOQ รวม</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:C.blue}}>฿{fmtMoney(grandBoq)}</div></Card>
          <Card style={{padding:14,borderLeft:`4px solid ${grandActual>grandBoq?C.red:C.green}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>💸 ใช้จ่ายจริง</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:grandActual>grandBoq?C.red:C.green}}>฿{fmtMoney(grandActual)}</div></Card>
          <Card style={{padding:14,borderLeft:`4px solid ${C.orange}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>🚧 สาธารณูปโภค</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:C.orange}}>฿{fmtMoney(infraActual)}</div></Card>
          <Card style={{padding:14,borderLeft:`4px solid ${C.red}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>⚠️ บ้านเกินงบ</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:C.red}}>{overBudgetHouses.length} หลัง</div></Card>
          <Card style={{padding:14,borderLeft:`4px solid ${grandActual>grandBoq?C.red:C.green}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:5}}>{grandActual<=grandBoq?"✅":"⚠️"} ส่วนต่าง</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:grandActual>grandBoq?C.red:C.green}}>{grandActual>grandBoq?"+":""}฿{fmtMoney(Math.abs(grandBoq-grandActual))}</div></Card>
        </div>
        {/* ── BAR CHART: BOQ vs Actual per house (full numbers) ── */}
        <Card style={{padding:isMobileMode?12:20,marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:15,fontWeight:700,color:C.text}}>📊 เปรียบเทียบ BOQ vs จ่ายจริง รายบ้าน</div>
            <Btn size="sm" variant="ghost" onClick={exportChartImage}>🖼️ โหลดรูป</Btn>
          </div>
          <div style={{overflowX:"auto"}}>
          {(()=>{
            const barW=isMobileMode?70:90;const chartW=Math.max(houseSummary.length*barW+100,400);
            return(
            <svg viewBox={`0 0 ${chartW} 320`} style={{width:"100%",minWidth:chartW,height:320}}>
              {/* Y axis grid lines */}
              {[0,0.25,0.5,0.75,1].map((r,i)=>{const v=Math.round(maxVal*(1-r));const y=40+r*220;return(<g key={i}><line x1="80" y1={y} x2={chartW-10} y2={y} stroke={C.border} strokeWidth=".5" strokeDasharray="4"/><text x="75" y={y+4} textAnchor="end" fill={C.muted} fontSize="9" fontFamily="monospace">{fmtMoney(v)}</text></g>);})}
              {houseSummary.map((h,i)=>{const x=90+i*barW;const boqH=maxVal>0?(h.boq/maxVal)*220:0;const actH=maxVal>0?(h.actual/maxVal)*220:0;const isOver=h.actual>h.boq&&h.actual>0;return(
                <g key={h.id}>
                  <rect x={x} y={260-boqH} width={barW/2-4} height={boqH} rx="4" fill={C.blue} opacity=".75"/>
                  <rect x={x+barW/2} y={260-actH} width={barW/2-4} height={actH} rx="4" fill={isOver?C.red:C.green} opacity=".85"/>
                  {/* House name */}
                  <text x={x+barW/2-2} y={278} textAnchor="middle" fill={C.text} fontSize="10" fontWeight="700">{h.name}</text>
                  {/* BOQ value on bar */}
                  <text x={x+barW/4-2} y={255-boqH} textAnchor="middle" fill={C.blue} fontSize="8" fontWeight="600">{fmtMoney(h.boq)}</text>
                  {/* Actual value on bar */}
                  {h.actual>0&&<text x={x+barW*3/4-2} y={255-actH} textAnchor="middle" fill={isOver?C.red:C.green} fontSize="8" fontWeight="700">{fmtMoney(h.actual)}</text>}
                  {/* Diff label */}
                  {isOver&&<text x={x+barW/2-2} y={290} textAnchor="middle" fill={C.red} fontSize="8" fontWeight="800">+฿{fmtMoney(h.diff)}</text>}
                </g>
              );})}
              <text x="15" y="160" textAnchor="middle" fill={C.muted} fontSize="10" transform="rotate(-90,15,160)">บาท (฿)</text>
            </svg>
            );
          })()}
          </div>
          <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}><div style={{width:14,height:14,borderRadius:4,background:C.blue,opacity:.75}}/><span style={{color:C.muted}}>BOQ ประมาณการ</span></div>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}><div style={{width:14,height:14,borderRadius:4,background:C.green,opacity:.85}}/><span style={{color:C.muted}}>จ่ายจริง (ไม่เกิน)</span></div>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}><div style={{width:14,height:14,borderRadius:4,background:C.red,opacity:.85}}/><span style={{color:C.muted}}>จ่ายจริง (เกินงบ)</span></div>
          </div>
        </Card>
        {/* ── PHASE-LEVEL COST BREAKDOWN ── */}
        <Card style={{padding:isMobileMode?12:20,marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:14}}>📋 วิเคราะห์ต้นทุนรายหมวดงาน — {proj?.name}</div>
          {(()=>{
            // Calculate per-phase cost across all houses
            const phaseData=data.phases.map(ph=>{
              const items=projBoqItems.filter(b=>b.phaseId===ph.id);
              const boq=items.reduce((s,b)=>s+b.qty*b.boqPrice,0);
              const act=items.reduce((s,b)=>s+(b.actualPrice>0?b.qty*b.actualPrice:0),0);
              const diff=act-boq;
              const overItems=items.filter(b=>b.actualPrice>0&&b.qty*b.actualPrice>b.qty*b.boqPrice);
              return{id:ph.id,order:ph.order,name:ph.name,boq,act,diff,overItems,itemCount:items.length,filledCount:items.filter(b=>b.actualPrice>0).length};
            }).filter(p=>p.boq>0||p.act>0);
            const maxPhaseVal=Math.max(...phaseData.map(p=>Math.max(p.boq,p.act)),1);
            return(
              <div>
                {phaseData.map(ph=>{const isOver=ph.act>ph.boq&&ph.act>0;const pct=ph.boq>0?((ph.diff/ph.boq)*100).toFixed(1):0;return(
                  <div key={ph.id} style={{marginBottom:12,border:`1px solid ${isOver?"rgba(239,68,68,0.3)":C.border}`,borderRadius:10,overflow:"hidden",background:isOver?"rgba(239,68,68,0.03)":"transparent"}}>
                    <div style={{padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:28,height:28,borderRadius:6,fontSize:12,fontWeight:800,background:isOver?C.red:ph.act>0?C.green:"#334155",color:"#fff"}}>{ph.order}</span>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:C.text}}>{ph.name}</div>
                          <div style={{fontSize:10,color:C.muted}}>{ph.filledCount}/{ph.itemCount} รายการมีราคาจริง</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:16,alignItems:"center",fontSize:12}}>
                        <div style={{textAlign:"right"}}><div style={{fontSize:9,color:C.muted}}>BOQ</div><div style={{fontWeight:700,color:C.blue}}>฿{fmtMoney(ph.boq)}</div></div>
                        <div style={{textAlign:"right"}}><div style={{fontSize:9,color:C.muted}}>จ่ายจริง</div><div style={{fontWeight:700,color:isOver?C.red:C.green}}>฿{fmtMoney(ph.act)}</div></div>
                        <div style={{textAlign:"right"}}><div style={{fontSize:9,color:C.muted}}>ส่วนต่าง</div><div style={{fontWeight:800,color:isOver?C.red:C.green}}>{isOver?"+":""}฿{fmtMoney(Math.abs(ph.diff))}{isOver?` (+${pct}%)`:""}</div></div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{padding:"0 14px 8px",display:"flex",gap:4,alignItems:"center"}}>
                      <div style={{flex:1,height:6,background:C.faint,borderRadius:3,overflow:"hidden",position:"relative"}}>
                        <div style={{height:"100%",width:`${Math.min((ph.boq/maxPhaseVal)*100,100)}%`,background:C.blue,opacity:.5,borderRadius:3}}/>
                        <div style={{position:"absolute",top:0,height:"100%",width:`${Math.min((ph.act/maxPhaseVal)*100,100)}%`,background:isOver?C.red:C.green,opacity:.8,borderRadius:3}}/>
                      </div>
                    </div>
                    {/* Over-budget items with reasons */}
                    {isOver&&ph.overItems.length>0&&(
                      <div style={{padding:"0 14px 10px"}}>
                        <div style={{fontSize:10,fontWeight:700,color:C.red,marginBottom:6}}>⚠️ รายการที่เกินงบ:</div>
                        {ph.overItems.map(b=>{const bDiff=b.qty*b.actualPrice-b.qty*b.boqPrice;return(
                          <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,padding:"4px 0",borderBottom:`1px solid ${C.border}`,fontSize:11}}>
                            <div style={{flex:1}}>
                              <span style={{color:C.text,fontWeight:600}}>{b.name}</span>
                              <span style={{color:C.muted,marginLeft:6}}>({fmtMoney(b.qty)} {b.unit})</span>
                              {b.overBudgetReason&&<div style={{fontSize:10,color:C.orange,marginTop:2}}>💬 {b.overBudgetReason}</div>}
                            </div>
                            <div style={{textAlign:"right",flexShrink:0}}>
                              <div style={{color:C.red,fontWeight:700}}>+฿{fmtMoney(bDiff)}</div>
                              <div style={{fontSize:9,color:C.muted}}>BOQ ฿{fmtMoney(b.boqPrice)} → จริง ฿{fmtMoney(b.actualPrice)}/หน่วย</div>
                            </div>
                          </div>
                        );})}
                      </div>
                    )}
                  </div>
                );})}
              </div>
            );
          })()}
        </Card>
        {/* ── OVER-BUDGET HOUSES TABLE ── */}
        {overBudgetHouses.length>0&&(
        <Card style={{padding:isMobileMode?12:20,marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:700,color:C.red,marginBottom:12}}>⚠️ บ้านที่เกินงบประมาณ ({overBudgetHouses.length} หลัง)</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["บ้าน","ลูกค้า","BOQ","จ่ายจริง","เกินงบ","% เกิน"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,borderBottom:`2px solid ${C.border}`,background:"#0d1117"}}>{h}</th>)}</tr></thead>
            <tbody>{overBudgetHouses.map(h=>{
              // Find top over-budget items for this house
              const houseItems=data.boqItems.filter(b=>b.houseId===h.id&&b.actualPrice>0&&b.qty*b.actualPrice>b.qty*b.boqPrice).sort((a,b)=>(b.qty*b.actualPrice-b.qty*b.boqPrice)-(a.qty*a.actualPrice-a.qty*a.boqPrice)).slice(0,3);
              return(<React.Fragment key={h.id}>
              <tr style={{borderBottom:`1px solid ${C.border}`,background:"rgba(239,68,68,0.04)"}}>
                <td style={{padding:"8px 12px",fontSize:13,fontWeight:700,color:C.text}}>🏠 {h.name}</td>
                <td style={{padding:"8px 12px",fontSize:12,color:C.muted}}>{h.customer}</td>
                <td style={{padding:"8px 12px",fontSize:12,color:C.blue,fontWeight:600}}>฿{fmtMoney(h.boq)}</td>
                <td style={{padding:"8px 12px",fontSize:12,color:C.red,fontWeight:700}}>฿{fmtMoney(h.actual)}</td>
                <td style={{padding:"8px 12px",fontSize:12,color:C.red,fontWeight:700}}>+฿{fmtMoney(h.diff)}</td>
                <td style={{padding:"8px 12px",fontSize:12,color:C.red,fontWeight:700}}>+{h.boq>0?((h.diff/h.boq)*100).toFixed(1):0}%</td>
              </tr>
              {houseItems.length>0&&<tr><td colSpan={6} style={{padding:"4px 12px 8px 40px",fontSize:10,color:C.muted}}>
                <span style={{fontWeight:700}}>สาเหตุหลัก: </span>
                {houseItems.map((b,i)=>{const ph=data.phases.find(p=>p.id===b.phaseId);return<span key={b.id}>{i>0?" | ":""}<span style={{color:C.red,fontWeight:600}}>{ph?.name||""} — {b.name} (+฿{fmtMoney(b.qty*b.actualPrice-b.qty*b.boqPrice)})</span>{b.overBudgetReason?<span style={{color:C.orange}}> [{b.overBudgetReason}]</span>:""}</span>;})}
              </td></tr>}
              </React.Fragment>);
            })}</tbody>
          </table>
        </Card>
        )}
        {/* ── ALL HOUSES TABLE ── */}
        <Card style={{padding:isMobileMode?12:20}}>
          <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:12}}>📋 สรุปต้นทุนรายบ้าน — {proj?.name}</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["บ้าน","ลูกค้า","BOQ","จ่ายจริง","ส่วนต่าง","สถานะ"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,borderBottom:`2px solid ${C.border}`,background:"#0d1117"}}>{h}</th>)}</tr></thead>
            <tbody>{houseSummary.map(h=><tr key={h.id} style={{borderBottom:`1px solid ${C.border}`}}>
              <td style={{padding:"8px 12px",fontSize:13,fontWeight:600,color:C.text}}>{h.name}</td>
              <td style={{padding:"8px 12px",fontSize:12,color:C.muted}}>{h.customer}</td>
              <td style={{padding:"8px 12px",fontSize:12,color:C.blue,fontWeight:600}}>฿{fmtMoney(h.boq)}</td>
              <td style={{padding:"8px 12px",fontSize:12,color:h.actual>h.boq?C.red:C.green,fontWeight:700}}>฿{fmtMoney(h.actual)}</td>
              <td style={{padding:"8px 12px",fontSize:12,color:h.diff>0?C.red:C.green,fontWeight:700}}>{h.diff>0?"+":""}{h.diff!==0?`฿${fmtMoney(Math.abs(h.diff))}`:"—"}</td>
              <td style={{padding:"8px 12px"}}><Tag color={h.diff>0?"red":h.actual>0?"green":"gray"}>{h.diff>0?"เกินงบ":h.actual>0?"ปกติ":"ยังไม่มีข้อมูล"}</Tag></td>
            </tr>)}</tbody>
          </table>
          <div style={{marginTop:12,padding:14,background:C.faint,borderRadius:10}}>
            <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:10,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700}}>
                <span style={{color:C.text}}>🚧 สาธารณูปโภค</span><span style={{color:infraActual>infraBOQ?C.red:C.green}}>฿{fmtMoney(infraActual)} / BOQ ฿{fmtMoney(infraBOQ)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700}}>
                <span style={{color:C.text}}>🏠 ก่อสร้างรวม</span><span style={{color:totalActual>totalBoq?C.red:C.green}}>฿{fmtMoney(totalActual)} / BOQ ฿{fmtMoney(totalBoq)}</span>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:900,paddingTop:10,borderTop:`2px solid ${C.border}`}}>
              <span style={{color:C.text}}>💰 รวมทั้งโครงการ</span><span style={{color:grandActual>grandBoq?C.red:C.green}}>฿{fmtMoney(grandActual)} / BOQ ฿{fmtMoney(grandBoq)} {grandActual>grandBoq?`(เกิน +฿${fmtMoney(grandActual-grandBoq)})`:`(ประหยัด ฿${fmtMoney(grandBoq-grandActual)})`}</span>
            </div>
          </div>
        </Card>
      </div>
      )}

      {/* Modals */}
      {infraMdl&&<Mdl title="✏️ แก้ไขรายการสาธารณูปโภค" onClose={()=>setInfraMdl(null)} footer={<><Btn variant="ghost" onClick={()=>setInfraMdl(null)}>ยกเลิก</Btn><Btn onClick={saveInfra}>💾 บันทึก</Btn></>}><FG label="ชื่อรายการ"><FIn value={infraForm.name} onChange={e=>setInfraForm(f=>({...f,name:e.target.value}))}/></FG><div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:12}}><FG label="หน่วย"><FIn value={infraForm.unit} onChange={e=>setInfraForm(f=>({...f,unit:e.target.value}))}/></FG><FG label="จำนวน"><FIn type="number" value={infraForm.qty} onChange={e=>setInfraForm(f=>({...f,qty:e.target.value}))}/></FG><FG label="ราคา BOQ/หน่วย"><FIn type="number" value={infraForm.boqPrice} onChange={e=>setInfraForm(f=>({...f,boqPrice:e.target.value}))}/></FG><FG label="ราคาจริง/หน่วย"><FIn type="number" value={infraForm.actualPrice} onChange={e=>setInfraForm(f=>({...f,actualPrice:e.target.value}))}/></FG></div><FG label="หมายเหตุ"><FIn value={infraForm.note||""} onChange={e=>setInfraForm(f=>({...f,note:e.target.value}))} rows={2}/></FG></Mdl>}
      {addInfraMdl&&<Mdl title="➕ เพิ่มรายการสาธารณูปโภค" onClose={()=>setAddInfraMdl(false)} footer={<><Btn variant="ghost" onClick={()=>setAddInfraMdl(false)}>ยกเลิก</Btn><Btn onClick={saveNewInfra}>💾 เพิ่ม</Btn></>}><FG label="ชื่อรายการ"><FIn value={infraForm.name} onChange={e=>setInfraForm(f=>({...f,name:e.target.value}))} placeholder="เช่น ค่ายกพื้น, ค่าไฟสนาม"/></FG><div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:12}}><FG label="หน่วย"><FIn value={infraForm.unit} onChange={e=>setInfraForm(f=>({...f,unit:e.target.value}))} placeholder="เหมา, คิว, จุด"/></FG><FG label="จำนวน"><FIn type="number" value={infraForm.qty} onChange={e=>setInfraForm(f=>({...f,qty:e.target.value}))}/></FG><FG label="ราคา BOQ/หน่วย"><FIn type="number" value={infraForm.boqPrice} onChange={e=>setInfraForm(f=>({...f,boqPrice:e.target.value}))}/></FG><FG label="ราคาจริง/หน่วย"><FIn type="number" value={infraForm.actualPrice} onChange={e=>setInfraForm(f=>({...f,actualPrice:e.target.value}))}/></FG></div><FG label="หมายเหตุ"><FIn value={infraForm.note||""} onChange={e=>setInfraForm(f=>({...f,note:e.target.value}))} rows={2}/></FG></Mdl>}
      {boqActMdl&&<Mdl title={`💰 ใส่ราคาจริง — ${boqActMdl.name}`} onClose={()=>setBoqActMdl(null)} size="sm" footer={<><Btn variant="ghost" onClick={()=>setBoqActMdl(null)}>ยกเลิก</Btn><Btn onClick={saveBoqAct}>💾 บันทึก</Btn></>}><div style={{fontSize:12,color:C.muted,marginBottom:8}}>จำนวน: {fmtMoney(boqActMdl.qty)} {boqActMdl.unit} | BOQ: ฿{fmtMoney(boqActMdl.boqPrice)}/หน่วย (รวม ฿{fmtMoney(boqActMdl.qty*boqActMdl.boqPrice)})</div><FG label="ราคาจริงต่อหน่วย (บาท)"><FIn type="number" value={boqActAmt} onChange={e=>setBoqActAmt(e.target.value)} placeholder="ราคาจริงที่สั่งซื้อ"/></FG>{Number(boqActAmt)>0&&<div style={{padding:10,background:C.faint,borderRadius:8,marginTop:8}}><div style={{fontSize:12,color:C.text}}>รวมจริง: ฿{fmtMoney(boqActMdl.qty*Number(boqActAmt))}</div><div style={{fontSize:11,color:boqActMdl.qty*Number(boqActAmt)>boqActMdl.qty*boqActMdl.boqPrice?C.red:C.green}}>{boqActMdl.qty*Number(boqActAmt)>boqActMdl.qty*boqActMdl.boqPrice?`เกินงบ ฿${fmtMoney(boqActMdl.qty*Number(boqActAmt)-boqActMdl.qty*boqActMdl.boqPrice)}`:`ประหยัด ฿${fmtMoney(boqActMdl.qty*boqActMdl.boqPrice-boqActMdl.qty*Number(boqActAmt))}`}</div></div>}{Number(boqActAmt)>0&&boqActMdl.qty*Number(boqActAmt)>boqActMdl.qty*boqActMdl.boqPrice&&<FG label="📝 เหตุผลที่ราคาจริงสูงกว่า BOQ"><FIn value={boqActReason} onChange={e=>setBoqActReason(e.target.value)} rows={2} placeholder="เช่น ราคาเหล็กปรับขึ้น 15%, ต้องเปลี่ยนยี่ห้อเพราะของหมด, ราคาตลาดสูงกว่าประเมิน"/></FG>}</Mdl>}
      {addExtraMdl&&<Mdl title={`➕ เพิ่มรายการนอกเหนือ BOQ — บ้าน ${data.houses.find(h=>h.id===addExtraMdl.houseId)?.name||""}`} onClose={()=>setAddExtraMdl(null)} footer={<><Btn variant="ghost" onClick={()=>setAddExtraMdl(null)}>ยกเลิก</Btn><Btn onClick={saveExtra}>💾 เพิ่ม</Btn></>}>
        <FG label="หมวดงาน (เลือกจาก Phase ที่วิศวกร/เจ้าของโครงการเซตไว้)"><FSel value={extraForm.phaseId} onChange={e=>setExtraForm(f=>({...f,phaseId:e.target.value}))}>{data.phases.map(p=><option key={p.id} value={p.id}>{p.order}. {p.name}</option>)}</FSel></FG>
        <FG label="ชื่อรายการ"><FIn value={extraForm.name} onChange={e=>setExtraForm(f=>({...f,name:e.target.value}))} placeholder="เช่น วัสดุเพิ่มเติม, งานซ่อมพิเศษ"/></FG>
        <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr 1fr",gap:12}}>
          <FG label="หน่วย"><FIn value={extraForm.unit} onChange={e=>setExtraForm(f=>({...f,unit:e.target.value}))} placeholder="ชิ้น, เมตร, ชุด"/></FG>
          <FG label="จำนวน"><FIn type="number" value={extraForm.qty} onChange={e=>setExtraForm(f=>({...f,qty:e.target.value}))}/></FG>
          <FG label="ราคา BOQ/หน่วย"><FIn type="number" value={extraForm.boqPrice} onChange={e=>setExtraForm(f=>({...f,boqPrice:e.target.value}))}/></FG>
        </div>
        <FG label="ราคาจริง/หน่วย (ถ้ามี)"><FIn type="number" value={extraForm.actualPrice} onChange={e=>setExtraForm(f=>({...f,actualPrice:e.target.value}))} placeholder="ใส่ทีหลังได้"/></FG>
      </Mdl>}
      {pdfPreviewMdl&&<Mdl title="👁 พรีวิว PDF ต้นทุน" onClose={()=>setPdfPreviewMdl(false)} size="lg" footer={<><Btn variant="ghost" onClick={()=>setPdfPreviewMdl(false)}>ปิด</Btn><Btn onClick={()=>{exportCostPDF();setPdfPreviewMdl(false);}} disabled={exportLoading}>{exportLoading?"⏳":"📄"} ดาวน์โหลด PDF</Btn>{viewMode==="summary"&&<Btn variant="ghost" onClick={()=>{exportChartImage();setPdfPreviewMdl(false);}}>🖼️ โหลดรูป Chart</Btn>}</>}>
        <div style={{background:"#fff",color:"#1a1a1a",borderRadius:12,padding:20,maxHeight:"60vh",overflowY:"auto"}}>
          <div style={{textAlign:"center",marginBottom:20,paddingBottom:16,borderBottom:"3px solid #2563eb"}}><div style={{fontSize:22,fontWeight:800,color:"#2563eb"}}>💰 รายงานต้นทุน — {proj?.name}</div><div style={{fontSize:12,color:"#6b7280",marginTop:4}}>ระบบ CPMS — {new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"})}</div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12,marginBottom:20}}>
            {[["BOQ รวม",`฿${fmtMoney(grandBoq)}`,"#2563eb"],["จ่ายจริง",`฿${fmtMoney(grandActual)}`,grandActual>grandBoq?"#ef4444":"#22c55e"],["สาธารณูปโภค",`฿${fmtMoney(infraActual)}`,"#f59e0b"],["ส่วนต่าง",`${grandActual>grandBoq?"+":""}฿${fmtMoney(Math.abs(grandBoq-grandActual))}`,grandActual>grandBoq?"#ef4444":"#22c55e"]].map(([l,v,c])=><div key={l} style={{background:"#f8fafc",borderRadius:10,padding:14,textAlign:"center"}}><div style={{fontSize:10,color:"#6b7280",fontWeight:700}}>{l}</div><div style={{fontSize:16,fontWeight:800,color:c,marginTop:4}}>{v}</div></div>)}
          </div>
          <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>📋 สรุปต้นทุนรายบ้าน</div>
          <table style={{width:"100%",borderCollapse:"collapse",marginBottom:16}}>
            <thead><tr>{["บ้าน","BOQ","จ่ายจริง","ส่วนต่าง","สถานะ"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",fontSize:10,fontWeight:700,color:"#6b7280",borderBottom:"1px solid #e2e8f0"}}>{h}</th>)}</tr></thead>
            <tbody>{houseSummary.map(h=><tr key={h.id} style={{borderBottom:"1px solid #e2e8f0"}}><td style={{padding:"6px 10px",fontSize:12,fontWeight:600}}>{h.name} ({h.customer})</td><td style={{padding:"6px 10px",fontSize:12,color:"#2563eb"}}>฿{fmtMoney(h.boq)}</td><td style={{padding:"6px 10px",fontSize:12,fontWeight:700,color:h.actual>h.boq?"#ef4444":"#22c55e"}}>฿{fmtMoney(h.actual)}</td><td style={{padding:"6px 10px",fontSize:12,color:h.diff>0?"#ef4444":"#22c55e",fontWeight:700}}>{h.diff>0?"+":""}฿{fmtMoney(Math.abs(h.diff))}</td><td style={{padding:"6px 10px"}}><span style={{padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700,background:h.diff>0?"#fef2f2":"#f0fdf4",color:h.diff>0?"#ef4444":"#22c55e"}}>{h.diff>0?"เกินงบ":"ปกติ"}</span></td></tr>)}</tbody>
          </table>
        </div>
      </Mdl>}
      {wpMdl&&<Mdl title={wpMdl==="add"?"➕ เพิ่มรายการจ่ายเงิน":"✏️ แก้ไขรายการจ่ายเงิน"} onClose={()=>setWpMdl(null)} footer={<><Btn variant="ghost" onClick={()=>setWpMdl(null)}>ยกเลิก</Btn><Btn onClick={saveWP}>💾 บันทึก</Btn></>}>
        <Alrt type="info">📌 ระบุยอดเงินที่โอนจ่ายในวันนี้ — แยกยอด "ค่าวัสดุ" (ซื้อของ) และ "ค่าแรง" (ผู้รับเหมา)</Alrt>
        <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:12}}>
          <FG label="📅 วันที่จ่ายเงิน"><FIn type="date" value={wpForm.date||""} onChange={e=>{const d=new Date(e.target.value);const dayNames=["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];setWpForm(f=>({...f,date:e.target.value,dayName:dayNames[d.getDay()]}));}}/></FG>
          <FG label="วัน">{(()=>{const dayNames=["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];const d=wpForm.date?new Date(wpForm.date):new Date();const dayIdx=d.getDay();return<div style={{padding:"10px 14px",background:"rgba(59,130,246,0.1)",borderRadius:8,border:`1px solid ${C.blue}`,fontSize:13,fontWeight:700,color:C.blue}}>{dayNames[dayIdx]}</div>;})()}</FG>
        </div>
        <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:12}}>
          <FG label="🛒 ยอดค่าวัสดุ (ซื้อของ)"><FIn type="number" value={wpForm.amount||""} onChange={e=>setWpForm(f=>({...f,amount:e.target.value}))} placeholder="เช่น 50000"/></FG>
          <FG label="👷 ยอดค่าแรงผู้รับเหมา"><FIn type="number" value={wpForm.laborAmount||""} onChange={e=>setWpForm(f=>({...f,laborAmount:e.target.value}))} placeholder="เช่น 30000"/></FG>
        </div>
        {(Number(wpForm.amount)>0||Number(wpForm.laborAmount)>0)&&(
          <div style={{padding:12,background:C.faint,borderRadius:8,marginBottom:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,textAlign:"center"}}>
              <div><div style={{fontSize:10,color:C.muted}}>ค่าวัสดุ</div><div style={{fontSize:16,fontWeight:800,color:C.blue}}>฿{fmtMoney(Number(wpForm.amount)||0)}</div></div>
              <div><div style={{fontSize:10,color:C.muted}}>ค่าแรง</div><div style={{fontSize:16,fontWeight:800,color:C.orange}}>฿{fmtMoney(Number(wpForm.laborAmount)||0)}</div></div>
              <div><div style={{fontSize:10,color:C.muted}}>รวมโอน</div><div style={{fontSize:16,fontWeight:800,color:C.text}}>฿{fmtMoney((Number(wpForm.amount)||0)+(Number(wpForm.laborAmount)||0))}</div></div>
            </div>
          </div>
        )}
        <FG label="📝 หมายเหตุ / รายละเอียด"><FIn value={wpForm.note||""} onChange={e=>setWpForm(f=>({...f,note:e.target.value}))} rows={2} placeholder="เช่น ซื้อปูนซีเมนต์ 50 ถุง + เหล็ก 2 ตัน, จ่ายค่าแรงทีมฐานราก"/></FG>
      </Mdl>}
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

// ── Transferred Houses Page ──────────────────────────────────
function TransferredHousesPage({data,setData,role,isMobileMode}){
  const canSeeAll=["owner","marketing","sales"].includes(role);
  const items=data.transferredHouses||[];
  const grouped={};
  items.forEach(r=>{if(!grouped[r.projectName])grouped[r.projectName]=[];grouped[r.projectName].push(r);});
  const [editTrMdl,setEditTrMdl]=useState(null);
  const [editTrForm,setEditTrForm]=useState({});
  const [detailMdl,setDetailMdl]=useState(null);
  const [pdfLoading,setPdfLoading]=useState(null);
  function openEditTransfer(r){setEditTrForm({...r});setEditTrMdl(r.id);}
  function saveEditTransfer(){setData(d=>({...d,transferredHouses:(d.transferredHouses||[]).map(t=>t.id===editTrMdl?{...t,...editTrForm}:t)}));setEditTrMdl(null);}
  function delTransfer(id){if(confirm("ลบรายการโอนนี้? (ข้อมูลจะหายถาวร)")){setData(d=>({...d,transferredHouses:(d.transferredHouses||[]).filter(t=>t.id!==id)}));}}
  function undoTransfer(r){if(!confirm(`ยกเลิกการโอน "${r.houseName}"?\nข้อมูลลูกค้าจะย้ายกลับไปหน้า "บ้านและจอง"`))return;const cust={houseId:r.houseId,name:r.customerName,phone:r.customerPhone||"",price:r.price||"",type:r.type||"loan",promotionItems:r.promotionItems||[],bankLoans:r.bankLoans||[],salesPersons:r.salesPersons||[],prob:r.prob||100,note:r.note||"",booked:r.booked||"",preApproved:r.preApproved||false};setData(d=>({...d,transferredHouses:(d.transferredHouses||[]).filter(t=>t.id!==r.id),customers:[...d.customers,cust],houses:d.houses.map(h=>h.id===r.houseId?{...h,customer:r.customerName}:h)}));}
  function uploadAttachment(houseId,files){
    Array.from(files).forEach(file=>{
      const reader=new FileReader();
      reader.onload=async ev=>{
        let fileData=ev.target.result;
        if(file.type.startsWith("image/"))fileData=await resizeImg(fileData,800);
        const att={id:uid(),name:file.name,type:file.type,data:fileData,date:new Date().toISOString().slice(0,10),uploadedBy:ROLE_LBL[role]};
        setData(d=>({...d,houseAttachments:{...d.houseAttachments,[houseId]:[...(d.houseAttachments?.[houseId]||[]),att]}}));
      };
      reader.readAsDataURL(file);
    });
  }
  function delAttachment(houseId,attId){setData(d=>({...d,houseAttachments:{...d.houseAttachments,[houseId]:(d.houseAttachments?.[houseId]||[]).filter(a=>a.id!==attId)}}));}
  async function exportTransferPDF(r){
    setPdfLoading(r.id);
    try{
      const house=data.houses.find(h=>h.id===r.houseId);
      const reportPhotos=(house&&!Array.isArray(house.reportPhotos)&&house.reportPhotos)||{};
      const atts=(data.houseAttachments||{})[r.houseId]||[];
      // Build HTML
      const el=document.createElement("div");
      el.style.cssText="width:794px;padding:40px;background:#fff;color:#1e293b;font-family:'Noto Sans Thai',sans-serif;";
      el.innerHTML=`
        <div style="text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #3b82f6">
          <div style="font-size:22px;font-weight:800;color:#1e293b">🏡 รายงานบ้านที่โอนแล้ว</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">ระบบ CPMS — ${new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"})}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
          <div style="background:#f1f5f9;padding:14px;border-radius:10px">
            <div style="font-size:10px;color:#64748b;font-weight:700">🏠 บ้าน / โครงการ</div>
            <div style="font-size:16px;font-weight:800">${r.houseName} — ${r.projectName}</div>
          </div>
          <div style="background:#f1f5f9;padding:14px;border-radius:10px">
            <div style="font-size:10px;color:#64748b;font-weight:700">📅 วันโอน</div>
            <div style="font-size:16px;font-weight:800">${r.transferDate||"—"}</div>
          </div>
        </div>
        <div style="background:#f1f5f9;padding:16px;border-radius:10px;margin-bottom:20px">
          <div style="font-size:14px;font-weight:700;margin-bottom:10px">👤 ข้อมูลลูกค้า</div>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:4px 8px;font-size:12px;color:#64748b;width:120px">ชื่อ-นามสกุล</td><td style="padding:4px 8px;font-size:13px;font-weight:700">${r.customerName}</td></tr>
            <tr><td style="padding:4px 8px;font-size:12px;color:#64748b">เบอร์โทร</td><td style="padding:4px 8px;font-size:13px">${r.customerPhone||"—"}</td></tr>
            <tr><td style="padding:4px 8px;font-size:12px;color:#64748b">ราคา</td><td style="padding:4px 8px;font-size:13px;font-weight:700;color:#3b82f6">${r.price?`฿${fmtMoney(Number(r.price))}`:"—"}</td></tr>
            <tr><td style="padding:4px 8px;font-size:12px;color:#64748b">ประเภทซื้อ</td><td style="padding:4px 8px;font-size:13px">${r.type==="cash"?"💵 สด":"🏦 กู้"}</td></tr>
            ${(r.salesPersons||[]).length>0?`<tr><td style="padding:4px 8px;font-size:12px;color:#64748b">เซลล์</td><td style="padding:4px 8px;font-size:13px">${r.salesPersons.join(", ")}</td></tr>`:""}
            ${(r.bankLoans||[]).length>0?`<tr><td style="padding:4px 8px;font-size:12px;color:#64748b">ธนาคาร</td><td style="padding:4px 8px;font-size:13px">${r.bankLoans.map(b=>b.bankName).join(", ")}</td></tr>`:""}
            ${(r.promotionItems||[]).length>0?`<tr><td style="padding:4px 8px;font-size:12px;color:#64748b">โปรโมชั่น</td><td style="padding:4px 8px;font-size:13px;color:#f97316">${r.promotionItems.map((p,i)=>`${i+1}. ${p.text}`).join("<br/>")}</td></tr>`:""}
            ${r.note?`<tr><td style="padding:4px 8px;font-size:12px;color:#64748b">หมายเหตุ</td><td style="padding:4px 8px;font-size:13px">${r.note}</td></tr>`:""}
          </table>
        </div>
        ${Object.keys(reportPhotos).length>0?`
          <div style="margin-bottom:20px">
            <div style="font-size:14px;font-weight:700;margin-bottom:10px">📸 รูปก่อสร้างรายหมวด</div>
            ${Object.entries(reportPhotos).map(([phId,photos])=>{
              const ph=data.phases.find(p=>p.id===Number(phId));
              return`<div style="margin-bottom:12px">
                <div style="font-size:12px;font-weight:700;color:#3b82f6;margin-bottom:6px">${ph?.name||`หมวดที่ ${phId}`}</div>
                <div style="display:flex;flex-wrap:wrap;gap:8px">
                  ${photos.slice(0,6).map(p=>`<div style="width:120px"><img src="${p.base64}" style="width:120px;height:90px;object-fit:cover;border-radius:6px"/><div style="font-size:9px;color:#64748b;margin-top:2px">${p.caption||""}</div></div>`).join("")}
                </div>
              </div>`;
            }).join("")}
          </div>
        `:""}
        ${atts.length>0?`
          <div style="margin-bottom:20px">
            <div style="font-size:14px;font-weight:700;margin-bottom:10px">📎 เอกสารแนบ</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${atts.filter(a=>a.type?.startsWith("image/")).map(a=>`<div style="width:150px"><img src="${a.data}" style="width:150px;height:110px;object-fit:cover;border-radius:6px"/><div style="font-size:9px;color:#64748b;margin-top:2px">${a.name} (${a.date})</div></div>`).join("")}
            </div>
            ${atts.filter(a=>!a.type?.startsWith("image/")).length>0?`<div style="margin-top:8px;font-size:11px;color:#64748b">${atts.filter(a=>!a.type?.startsWith("image/")).map(a=>`📄 ${a.name}`).join(" | ")}</div>`:""}
          </div>
        `:""}
      `;
      document.body.appendChild(el);
      const canvas=await html2canvas(el,{scale:2,useCORS:true,allowTaint:true,logging:false,windowWidth:794});
      document.body.removeChild(el);
      const imgData=canvas.toDataURL("image/jpeg",0.95);
      const pdf=new jsPDF("p","mm","a4");
      const pw=pdf.internal.pageSize.getWidth()-20;
      const iw=pw;const ih=(canvas.height*iw)/canvas.width;
      let yOff=10;
      const pageH=pdf.internal.pageSize.getHeight()-20;
      while(yOff<ih+10){
        if(yOff>10)pdf.addPage();
        pdf.addImage(imgData,"JPEG",10,10-yOff+10,iw,ih);
        yOff+=pageH;
      }
      pdf.save(`บ้านโอน_${r.houseName}_${r.customerName}.pdf`);
    }catch(e){console.error(e);alert("เกิดข้อผิดพลาด: "+e.message);}
    setPdfLoading(null);
  }
  return(
    <div style={{padding:isMobileMode?12:24}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:8}}>
        <div><div style={{fontSize:isMobileMode?18:22,fontWeight:700,color:C.text}}>🏡 บ้านที่โอนแล้ว</div><div style={{fontSize:13,color:C.muted,marginTop:2}}>รายการบ้านที่ลูกค้าโอนกรรมสิทธิ์เรียบร้อย</div></div>
        <Card style={{padding:"8px 13px",textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:C.green}}>{items.length}</div><div style={{fontSize:10,color:C.muted}}>โอนแล้ว</div></Card>
      </div>
      {items.length===0?<Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>🏡</div><div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:4}}>ยังไม่มีบ้านที่โอนแล้ว</div><div style={{fontSize:13,color:C.muted}}>เมื่อโอนบ้านจากหน้า "บ้านและจอง" จะแสดงที่นี่</div></Card>:(
        Object.entries(grouped).map(([projName,records])=>(
          <Card key={projName} style={{padding:isMobileMode?12:20,marginBottom:16}}>
            <div style={{fontSize:15,fontWeight:700,color:C.green,marginBottom:12}}>🏗️ {projName} ({records.length} หลัง)</div>
            {isMobileMode?(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {records.map(r=>{const atts=(data.houseAttachments||{})[r.houseId]||[];return(
                  <div key={r.id} style={{background:C.faint,borderRadius:10,padding:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:6}}>
                      <div><Tag color="green">🏠 {r.houseName}</Tag></div>
                      <div style={{display:"flex",gap:4}}>
                        <Btn size="sm" variant="ghost" onClick={()=>setDetailMdl(r)} style={{color:C.blue}}>👁</Btn>
                        <Btn size="sm" variant="ghost" onClick={()=>exportTransferPDF(r)} style={{color:C.green}}>{pdfLoading===r.id?"⏳":"📄"}</Btn>
                        {role==="owner"&&<><Btn size="sm" variant="ghost" onClick={()=>openEditTransfer(r)} style={{color:C.blue}}>✏️</Btn><Btn size="sm" variant="ghost" onClick={()=>undoTransfer(r)} style={{color:C.orange}}>↩️</Btn><Btn size="sm" variant="ghost" onClick={()=>delTransfer(r.id)} style={{color:C.red}}>🗑</Btn></>}
                      </div>
                    </div>
                    <div style={{fontSize:14,fontWeight:700,color:C.text}}>{r.customerName}</div>
                    {r.customerPhone&&<div style={{fontSize:12,color:C.blue,marginTop:2}}>📞 {r.customerPhone}</div>}
                    {canSeeAll&&r.price&&<div style={{fontSize:13,color:C.blue,fontWeight:700,marginTop:4}}>💰 ฿{fmtMoney(Number(r.price))}</div>}
                    <div style={{fontSize:11,color:C.muted,marginTop:4}}>📅 โอนเมื่อ: {fmtDate(r.transferDate)}</div>
                    {canSeeAll&&r.type&&<div style={{fontSize:11,color:C.muted}}>ซื้อแบบ: {r.type==="cash"?"💵 สด":"🏦 กู้"}</div>}
                    {canSeeAll&&(r.salesPersons||[]).length>0&&<div style={{fontSize:11,color:C.muted}}>👤 เซลล์: {r.salesPersons.join(", ")}</div>}
                    {canSeeAll&&(r.bankLoans||[]).length>0&&<div style={{fontSize:11,color:C.blue,marginTop:2}}>🏦 {r.bankLoans.map(b=>b.bankName).join(", ")}</div>}
                    {canSeeAll&&(r.promotionItems||[]).length>0&&<div style={{marginTop:4}}><div style={{fontSize:10,fontWeight:700,color:C.orange}}>🏷️ โปรโมชั่น:</div>{r.promotionItems.map((p,i)=><div key={p.id||i} style={{fontSize:10,color:C.orange}}>{i+1}. {p.text}</div>)}</div>}
                    {r.note&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>📝 {r.note}</div>}
                    {atts.length>0&&<div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${C.border}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,marginBottom:4}}>📎 {atts.length} ไฟล์แนบ</div><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{atts.filter(a=>a.type?.startsWith("image/")).slice(0,3).map(a=><img key={a.id} src={a.data} style={{width:50,height:50,objectFit:"cover",borderRadius:6}}/>)}{atts.length>3&&<div style={{width:50,height:50,borderRadius:6,background:C.panel,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:C.muted}}>+{atts.length-3}</div>}</div></div>}
                    <div style={{display:"flex",gap:6,marginTop:8}}>
                      <label style={{display:"inline-flex",alignItems:"center",gap:4,cursor:"pointer",padding:"4px 10px",borderRadius:6,background:C.panel,fontSize:10,color:C.blue,fontWeight:600}}>📎 แนบไฟล์<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" multiple style={{display:"none"}} onChange={e=>{uploadAttachment(r.houseId,e.target.files);e.target.value="";}}/></label>
                    </div>
                  </div>
                );})}
              </div>
            ):(
              <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:canSeeAll?1000:600}}>
                <thead><tr>{["บ้าน","ลูกค้า","เบอร์โทร",canSeeAll?"ราคา":"",canSeeAll?"ซื้อแบบ":"","วันโอน","ไฟล์แนบ","จัดการ"].filter(Boolean).map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,borderBottom:`1px solid ${C.border}`,background:"#0d1117",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                <tbody>{records.map(r=>{const atts=(data.houseAttachments||{})[r.houseId]||[];return(
                  <tr key={r.id} style={{borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background=C.panel} onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td style={{padding:"8px 10px"}}><Tag color="green">{r.houseName}</Tag></td>
                  <td style={{padding:"8px 10px",fontSize:13,fontWeight:600,color:C.text}}>{r.customerName}</td>
                  <td style={{padding:"8px 10px",fontSize:12}}>{r.customerPhone?<a href={`tel:${r.customerPhone}`} style={{color:C.blue,textDecoration:"none"}}>{r.customerPhone}</a>:"—"}</td>
                  {canSeeAll&&<td style={{padding:"8px 10px",fontSize:13,fontWeight:700,color:C.blue}}>{r.price?`฿${fmtMoney(Number(r.price))}`:"—"}</td>}
                  {canSeeAll&&<td style={{padding:"8px 10px"}}>{r.type==="cash"?<Tag color="green">💵 สด</Tag>:<Tag color="blue">🏦 กู้</Tag>}</td>}
                  <td style={{padding:"8px 10px",fontSize:12,color:C.text}}>{fmtDate(r.transferDate)}</td>
                  <td style={{padding:"8px 10px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      {atts.length>0&&<span style={{fontSize:11,color:C.muted}}>📎 {atts.length}</span>}
                      <label style={{cursor:"pointer",fontSize:10,color:C.blue}}>+<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" multiple style={{display:"none"}} onChange={e=>{uploadAttachment(r.houseId,e.target.files);e.target.value="";}}/></label>
                    </div>
                  </td>
                  <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                    <Btn size="sm" variant="ghost" onClick={()=>setDetailMdl(r)} style={{color:C.blue}} title="ดูรายละเอียด">👁</Btn>
                    <Btn size="sm" variant="ghost" onClick={()=>exportTransferPDF(r)} style={{color:C.green}} title="PDF">{pdfLoading===r.id?"⏳":"📄"}</Btn>
                    {role==="owner"&&<><Btn size="sm" variant="ghost" onClick={()=>openEditTransfer(r)} style={{color:C.blue}}>✏️</Btn><Btn size="sm" variant="ghost" onClick={()=>undoTransfer(r)} style={{color:C.orange}} title="ยกเลิกโอน">↩️</Btn><Btn size="sm" variant="ghost" onClick={()=>delTransfer(r.id)} style={{color:C.red}}>🗑</Btn></>}
                  </td>
                </tr>);})}</tbody>
              </table></div>
            )}
          </Card>
        ))
      )}
      {/* ── Detail Modal ── */}
      {detailMdl&&(()=>{
        const r=detailMdl;
        const house=data.houses.find(h=>h.id===r.houseId);
        const reportPhotos=(house&&!Array.isArray(house.reportPhotos)&&house.reportPhotos)||{};
        const atts=(data.houseAttachments||{})[r.houseId]||[];
        return(
          <Mdl title={`🏡 ${r.houseName} — ${r.customerName}`} onClose={()=>setDetailMdl(null)} size="xl" footer={<div style={{display:"flex",gap:8}}><Btn variant="ghost" onClick={()=>setDetailMdl(null)}>ปิด</Btn><Btn onClick={()=>{setDetailMdl(null);exportTransferPDF(r);}}>📄 โหลด PDF</Btn></div>}>
            {/* Customer info */}
            <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:10,marginBottom:16}}>
              <div style={{background:C.faint,padding:12,borderRadius:8}}><div style={{fontSize:10,color:C.muted,fontWeight:700}}>📅 วันโอน</div><div style={{fontSize:14,fontWeight:700,color:C.text}}>{fmtDate(r.transferDate)}</div></div>
              <div style={{background:C.faint,padding:12,borderRadius:8}}><div style={{fontSize:10,color:C.muted,fontWeight:700}}>💰 ราคา</div><div style={{fontSize:14,fontWeight:700,color:C.blue}}>{r.price?`฿${fmtMoney(Number(r.price))}`:"—"}</div></div>
            </div>
            <div style={{background:C.faint,padding:12,borderRadius:8,marginBottom:16}}>
              <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:8,fontSize:12}}>
                <div><span style={{color:C.muted}}>📞 </span><span style={{color:C.text}}>{r.customerPhone||"—"}</span></div>
                <div><span style={{color:C.muted}}>ซื้อแบบ: </span><span style={{color:C.text}}>{r.type==="cash"?"💵 สด":"🏦 กู้"}</span></div>
                {(r.salesPersons||[]).length>0&&<div><span style={{color:C.muted}}>👤 เซลล์: </span><span style={{color:C.text}}>{r.salesPersons.join(", ")}</span></div>}
                {(r.bankLoans||[]).length>0&&<div><span style={{color:C.muted}}>🏦 </span><span style={{color:C.blue}}>{r.bankLoans.map(b=>b.bankName).join(", ")}</span></div>}
              </div>
              {(r.promotionItems||[]).length>0&&<div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}`}}><div style={{fontSize:10,fontWeight:700,color:C.orange}}>🏷️ โปรโมชั่น:</div>{r.promotionItems.map((p,i)=><div key={p.id||i} style={{fontSize:11,color:C.orange}}>{i+1}. {p.text}</div>)}</div>}
              {r.note&&<div style={{marginTop:6,fontSize:11,color:C.muted}}>📝 {r.note}</div>}
            </div>
            {/* Construction photos */}
            {Object.keys(reportPhotos).length>0&&<div style={{marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:10}}>📸 รูปก่อสร้างรายหมวด</div>
              {Object.entries(reportPhotos).map(([phId,photos])=>{const ph=data.phases.find(p=>p.id===Number(phId));return(
                <div key={phId} style={{marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:6}}>{ph?.name||`หมวดที่ ${phId}`} ({photos.length} รูป)</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {photos.map(p=><div key={p.id} style={{position:"relative"}}><img src={p.base64} style={{width:isMobileMode?80:120,height:isMobileMode?60:90,objectFit:"cover",borderRadius:6}}/>{p.caption&&<div style={{fontSize:8,color:C.muted,marginTop:2,maxWidth:isMobileMode?80:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.caption}</div>}</div>)}
                  </div>
                </div>
              );})}
            </div>}
            {/* Attachments */}
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:14,fontWeight:700,color:C.text}}>📎 เอกสารแนบ ({atts.length})</div>
                <label style={{display:"inline-flex",alignItems:"center",gap:4,cursor:"pointer",padding:"6px 12px",borderRadius:6,background:C.faint,border:`1px dashed ${C.border}`,fontSize:11,color:C.blue,fontWeight:600}}>
                  📎 อัปโหลด
                  <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" multiple style={{display:"none"}} onChange={e=>{uploadAttachment(r.houseId,e.target.files);e.target.value="";}}/>
                </label>
              </div>
              {atts.length===0?<div style={{textAlign:"center",padding:20,color:C.muted,fontSize:12}}>ยังไม่มีเอกสารแนบ</div>:(
                <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:10}}>
                  {atts.map(a=>(
                    <div key={a.id} style={{background:C.faint,borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`}}>
                      {a.type?.startsWith("image/")?<img src={a.data} alt={a.name} style={{width:"100%",height:100,objectFit:"cover"}}/>:<div style={{height:60,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>📄</div>}
                      <div style={{padding:"6px 8px"}}>
                        <div style={{fontSize:10,color:C.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                        <div style={{fontSize:9,color:C.muted}}>{a.uploadedBy} — {a.date}</div>
                        <div style={{display:"flex",gap:6,marginTop:4}}>
                          <a href={a.data} download={a.name} style={{fontSize:10,color:C.blue,textDecoration:"none"}}>⬇️ โหลด</a>
                          {role==="owner"&&<span style={{fontSize:10,color:C.red,cursor:"pointer"}} onClick={()=>delAttachment(r.houseId,a.id)}>🗑 ลบ</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Mdl>
        );
      })()}
      {/* Edit Transfer Modal */}
      {editTrMdl&&<Mdl title="✏️ แก้ไขข้อมูลบ้านที่โอนแล้ว" onClose={()=>setEditTrMdl(null)} footer={<><Btn variant="ghost" onClick={()=>setEditTrMdl(null)}>ยกเลิก</Btn><Btn onClick={saveEditTransfer}>💾 บันทึก</Btn></>}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div><label style={{fontSize:11,fontWeight:700,color:C.muted}}>🏠 บ้าน</label><FIn value={editTrForm.houseName||""} onChange={()=>{}} style={{opacity:.6}}/></div>
          <div><label style={{fontSize:11,fontWeight:700,color:C.muted}}>👤 ชื่อลูกค้า</label><FIn value={editTrForm.customerName||""} onChange={e=>setEditTrForm(f=>({...f,customerName:e.target.value}))}/></div>
          <div><label style={{fontSize:11,fontWeight:700,color:C.muted}}>📞 เบอร์โทร</label><FIn value={editTrForm.customerPhone||""} onChange={e=>setEditTrForm(f=>({...f,customerPhone:e.target.value}))}/></div>
          <div><label style={{fontSize:11,fontWeight:700,color:C.muted}}>💰 ราคา</label><FIn type="number" value={editTrForm.price||""} onChange={e=>setEditTrForm(f=>({...f,price:e.target.value}))}/></div>
          <div><label style={{fontSize:11,fontWeight:700,color:C.muted}}>ซื้อแบบ</label><select value={editTrForm.type||"loan"} onChange={e=>setEditTrForm(f=>({...f,type:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.panel,color:C.text,fontSize:13}}><option value="cash">💵 สด</option><option value="loan">🏦 กู้</option></select></div>
          <div><label style={{fontSize:11,fontWeight:700,color:C.muted}}>📅 วันโอน</label><FIn type="date" value={editTrForm.transferDate||""} onChange={e=>setEditTrForm(f=>({...f,transferDate:e.target.value}))}/></div>
          <div><label style={{fontSize:11,fontWeight:700,color:C.muted}}>📝 หมายเหตุ</label><textarea value={editTrForm.note||""} onChange={e=>setEditTrForm(f=>({...f,note:e.target.value}))} rows={3} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.panel,color:C.text,fontSize:13,resize:"vertical"}}/></div>
        </div>
      </Mdl>}
    </div>
  );
}

function FinancePage({data,role,isMobileMode}) {
  if(role!=="owner")return<div style={{padding:24,color:C.red,fontSize:14}}>🔒 Only owner can access Financial Dashboard</div>;
  
  const metrics=getProjectMetrics(data);
  const totalBOQ=Object.values(metrics).reduce((s,m)=>s+m.boq,0);
  const totalActual=Object.values(metrics).reduce((s,m)=>s+m.actual,0);
  // Infrastructure totals
  const infraTotals=data.projects.map(p=>{const items=(data.infrastructureCosts||{})[p.id]||[];const boq=items.reduce((s,i)=>s+i.qty*i.boqPrice,0);const act=items.reduce((s,i)=>s+i.qty*i.actualPrice,0);return{id:p.id,name:p.name,boq,actual:act};});
  const totalInfraBOQ=infraTotals.reduce((s,i)=>s+i.boq,0);
  const totalInfraActual=infraTotals.reduce((s,i)=>s+i.actual,0);
  const grandBOQ=totalBOQ+totalInfraBOQ;
  const grandActual=totalActual+totalInfraActual;
  const utilization=grandBOQ>0?Math.round((grandActual/grandBOQ)*100):0;
  const totalProfit=getTotalEarned(data)-grandActual;
  const totalReceived=getTotalEarned(data);

  const getBudgetColor=(actual,boq)=>{if(actual>boq)return C.red;const pct=(actual/boq)*100;if(pct>=95)return C.red;if(pct>=80)return C.orange;return C.green;};

  const getProjectPhaseBreakdown=(projectId)=>{
    const projectHouses=data.houses.filter(h=>h.projectId===projectId);
    const phaseMap={};
    data.boqItems.forEach(item=>{const house=projectHouses.find(h=>h.id===item.houseId);if(house){const phase=data.phases.find(p=>p.id===item.phaseId);if(phase){if(!phaseMap[phase.name])phaseMap[phase.name]={costs:[],count:0};const cost=item.actualPrice>0?item.qty*item.actualPrice:item.qty*item.boqPrice;phaseMap[phase.name].costs.push(cost);}}});
    return Object.entries(phaseMap).map(([name,data])=>({name,avg:data.costs.length>0?Math.round(data.costs.reduce((a,b)=>a+b,0)/data.costs.length):0,min:Math.min(...data.costs),max:Math.max(...data.costs)}));
  };

  const housesByProject={};
  data.projects.forEach(proj=>{housesByProject[proj.id]={name:proj.name,houses:data.houses.filter(h=>h.projectId===proj.id)};});

  return (
    <div style={{padding:isMobileMode?12:24}}>
      <div style={{fontSize:isMobileMode?18:22,fontWeight:700,color:C.text,marginBottom:20}}>💹 Financial Dashboard — Detailed Analysis</div>
      
      <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr 1fr":"repeat(5,1fr)",gap:12,marginBottom:24}}>
        <Card style={{padding:15}}><div style={{fontSize:18,marginBottom:5}}>💰</div><div style={{fontSize:10,fontWeight:700,color:C.muted}}>ค่าใช้จ่ายจริง</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:C.blue}}>฿{fmtMoney(grandActual)}</div></Card>
        <Card style={{padding:15}}><div style={{fontSize:18,marginBottom:5}}>📊</div><div style={{fontSize:10,fontWeight:700,color:C.muted}}>งบ BOQ รวม</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:C.text}}>฿{fmtMoney(grandBOQ)}</div></Card>
        <Card style={{padding:15}}><div style={{fontSize:18,marginBottom:5}}>📈</div><div style={{fontSize:10,fontWeight:700,color:C.muted}}>ผลกำไร</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:totalProfit>0?C.green:C.red}}>฿{fmtMoney(totalProfit)}</div></Card>
        <Card style={{padding:15}}><div style={{fontSize:18,marginBottom:5}}>%</div><div style={{fontSize:10,fontWeight:700,color:C.muted}}>ค่าใช้จ่าย / งบ BOQ</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:utilization<80?C.green:utilization<95?C.orange:C.red}}>{utilization}%</div></Card>
        <Card style={{padding:15}}><div style={{fontSize:18,marginBottom:5}}>💵</div><div style={{fontSize:10,fontWeight:700,color:C.muted}}>ชำระแล้ว</div><div style={{fontSize:isMobileMode?14:18,fontWeight:800,color:C.green}}>฿{fmtMoney(totalReceived)}</div></Card>
      </div>

      {/* Infrastructure Costs per Project */}
      <Card style={{padding:isMobileMode?12:20,marginBottom:20}}>
        <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:14}}>🚧 สาธารณูปโภครายโครงการ</div>
        <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"repeat(auto-fit,minmax(280px,1fr))",gap:12}}>
          {infraTotals.map(p=>{const diff=p.boq-p.actual;const color=p.actual>p.boq?C.red:C.green;return(
            <div key={p.id} style={{background:C.faint,borderRadius:10,padding:14}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>{p.name}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:11}}>
                <div><span style={{color:C.muted}}>BOQ:</span><span style={{color:C.blue,fontWeight:700,marginLeft:6}}>฿{fmtMoney(p.boq)}</span></div>
                <div><span style={{color:C.muted}}>จ่ายจริง:</span><span style={{color,fontWeight:700,marginLeft:6}}>฿{fmtMoney(p.actual)}</span></div>
              </div>
              <div style={{height:5,background:C.border,borderRadius:3,overflow:"hidden",marginTop:8}}>
                <div style={{height:"100%",width:`${p.boq>0?Math.min((p.actual/p.boq)*100,100):0}%`,background:color,borderRadius:3}}/>
              </div>
              <div style={{fontSize:10,color,fontWeight:700,marginTop:4}}>{diff>=0?`ประหยัด ฿${fmtMoney(diff)}`:`เกินงบ ฿${fmtMoney(Math.abs(diff))}`}</div>
            </div>
          );})}
        </div>
        <div style={{marginTop:12,padding:10,background:C.panel,borderRadius:8,display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:700}}>
          <span style={{color:C.text}}>รวมสาธารณูปโภคทุกโครงการ</span>
          <span style={{color:totalInfraActual>totalInfraBOQ?C.red:C.green}}>BOQ ฿{fmtMoney(totalInfraBOQ)} | จ่ายจริง ฿{fmtMoney(totalInfraActual)}</span>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:isMobileMode?"1fr":"1fr 1fr",gap:16}}>
        <Card style={{padding:20}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:16}}>📊 Cost Breakdown by Project</div>
          {data.projects.map(project=>{
            const pMetrics=metrics[project.name];if(!pMetrics)return null;
            const remaining=pMetrics.boq-pMetrics.actual;const variance=pMetrics.boq>0?Math.round(((pMetrics.actual-pMetrics.boq)/pMetrics.boq)*100):0;
            const utilPct=pMetrics.boq>0?Math.round((pMetrics.actual/pMetrics.boq)*100):0;const statusColor=getBudgetColor(pMetrics.actual,pMetrics.boq);
            const phaseBreakdown=getProjectPhaseBreakdown(project.id);
            return(
              <div key={project.id} style={{marginBottom:16,paddingBottom:16,borderBottom:`1px solid ${C.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:8}}>{project.name}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:11,marginBottom:8}}>
                  <div><span style={{color:C.muted}}>งบ BOQ:</span><span style={{color:C.text,fontWeight:700,marginLeft:6}}>฿{fmtMoney(pMetrics.boq)}</span></div>
                  <div><span style={{color:C.muted}}>ค่าใช้จ่ายจริง:</span><span style={{color:C.text,fontWeight:700,marginLeft:6}}>฿{fmtMoney(pMetrics.actual)}</span></div>
                  <div><span style={{color:C.muted}}>คงเหลือ:</span><span style={{color:statusColor,fontWeight:700,marginLeft:6}}>฿{fmtMoney(remaining)}</span></div>
                  <div><span style={{color:C.muted}}>ส่วนต่าง:</span><span style={{color:statusColor,fontWeight:700,marginLeft:6}}>{variance>0?"+":""}{variance}%</span></div>
                </div>
                <div style={{height:6,background:C.faint,borderRadius:3,overflow:"hidden",marginBottom:8}}><div style={{height:"100%",width:`${Math.min(utilPct,100)}%`,background:statusColor}}/></div>
                <div style={{fontSize:10,color:statusColor,marginBottom:10}}>{utilPct}% utilization</div>
                {phaseBreakdown.length>0&&<div style={{background:C.faint,padding:10,borderRadius:6,fontSize:10}}><div style={{color:C.muted,fontWeight:700,marginBottom:6}}>Average cost per phase:</div>{phaseBreakdown.slice(0,3).map((p,i)=><div key={i} style={{color:C.text,marginBottom:4}}><span style={{color:C.muted}}>{p.name}:</span><span style={{marginLeft:6,fontWeight:600}}>฿{fmtMoney(p.avg)}</span><span style={{marginLeft:8,color:C.muted}}>({fmtMoney(p.min)}-{fmtMoney(p.max)})</span></div>)}{phaseBreakdown.length>3&&<div style={{color:C.muted,marginTop:6}}>... +{phaseBreakdown.length-3} more phases</div>}</div>}
              </div>
            );
          })}
        </Card>

        <Card style={{padding:20}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:16}}>🏠 Cost by House per Project</div>
          {Object.entries(housesByProject).map(([projId,projData])=>{
            if(projData.houses.length===0)return null;
            return(
              <div key={projId} style={{marginBottom:16,paddingBottom:16,borderBottom:`1px solid ${C.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:10}}>{projData.name}</div>
                {projData.houses.map(house=>{
                  const remaining=house.boq-house.actual;const variance=house.boq>0?house.actual-house.boq:0;
                  const statusColor=getBudgetColor(house.actual,house.boq);const customer=data.customers.find(c=>c.houseId===house.id);
                  return(
                    <div key={house.id} style={{background:C.panel,padding:10,borderRadius:6,marginBottom:10,fontSize:11}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                        <span style={{color:C.text,fontWeight:700}}>🏠 บ้านเลขที่ {house.name}</span>
                        <Tag color={house.status==="completed"?"green":house.status==="inprogress"?"blue":"gray"} style={{fontSize:9}}>{ST_LBL[house.status]||house.status}</Tag>
                      </div>
                      {customer&&<div style={{color:C.muted,marginBottom:8,fontSize:10}}>👤 {customer.name}</div>}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8,fontSize:10}}>
                        <div><span style={{color:C.muted}}>งบ BOQ:</span><br/><span style={{color:C.text,fontWeight:700}}>฿{fmtMoney(house.boq)}</span></div>
                        <div><span style={{color:C.muted}}>ใช้จ่ายแล้ว:</span><br/><span style={{color:C.text,fontWeight:700}}>฿{fmtMoney(house.actual)}</span></div>
                        <div><span style={{color:C.muted}}>อีก:</span><br/><span style={{color:statusColor,fontWeight:700}}>฿{fmtMoney(remaining)}</span></div>
                        <div><span style={{color:C.muted}}>ส่วนต่าง:</span><br/><span style={{color:variance>0?C.red:C.green,fontWeight:700}}>{variance>0?"+":""}฿{fmtMoney(variance)}</span></div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1,height:4,background:C.faint,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(house.pct,100)}%`,background:statusColor}}/></div>
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
    {username:"sales",role:"sales",color:"#facc15",icon:"💰"},
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
  const ownerView=(isOwner&&role==="owner")||role==="sales"; // sales sees full team view too
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
  const [bookingCelebration,setBookingCelebration]=useState(null);

  // Auto-save data to localStorage
  useEffect(()=>{saveData(data);},[data]);
  useEffect(()=>{try{localStorage.setItem(STORAGE_ROLE,role);}catch(e){}},[role]);
  useEffect(()=>{try{localStorage.setItem("cpms_loggedin",JSON.stringify(loggedIn));}catch(e){}},[loggedIn]);
  useEffect(()=>{try{localStorage.setItem("cpms_authed_uid",JSON.stringify(authedUserId));}catch(e){}},[authedUserId]);
  // Show booking celebration on login when there are unviewed booking alerts
  useEffect(()=>{
    if(!loggedIn)return;
    const alerts=(data.bookingAlerts||[]).filter(a=>!data.notificationViewed?.[`booking-${a.id}`]);
    if(alerts.length>0){
      setBookingCelebration(alerts[alerts.length-1]);
      setTimeout(()=>setBookingCelebration(null),6000);
    }
  },[loggedIn]);

  function handleLogin(memberId,memberRole){
    setLoggedIn(true);
    setAuthedUserId(memberId);
    setRole(memberRole);
    setViewAsId(null);
    setPage(memberRole==="marketing"?"marketing":memberRole==="sales"?"marketing":"dash");
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

  const topTitle=openId?`บ้าน ${data.houses.find(h=>h.id===openId)?.name||""}`:({dash:"Dashboard",finance:"💹 Financial Dashboard",purchase:role==="engineer"?"อนุมัติคำสั่งซื้อ":"รายการจัดซื้อ",payments:"💰 Payments",analytics:"📊 Analytics",team:"👥 Team",tracking:"📋 ติดตามงาน",marketing:"🏠 รายละเอียดบ้านและการจอง",customerData:"👤 ข้อมูลลูกค้าการตลาด",mktResult:"📊 ผลลัพธ์",mktBudget:"💰 งบประมาณการตลาด",settings:"ตั้งค่า"}[page]||"");

  // Compute unviewed notif count for mobile sidebar badge
  const allNotifItems=[
    ...data.phaseMessages.filter(msg=>!data.messageViewed?.[msg.id]),
    ...data.houses.flatMap(h=>data.phases.filter(p=>data.phaseProgress[h.id]?.[p.id]?.s==="waiting_review").map(p=>({id:`waiting-${h.id}-${p.id}`}))),
    ...data.requests.filter(r=>r.status==="pending").map(r=>({id:`order-${r.id}`})),
  ];
  const mobileUnviewedCount=allNotifItems.filter(n=>!data.notificationViewed?.[n.id]).length;

  // Bottom nav items per role (max 5 slots)
  const bottomNavByRole={
    owner:[{id:"dash",icon:"⊞",label:"Dashboard"},{id:"tracking",icon:"📋",label:"ติดตาม"},{id:"marketing",icon:"🏠",label:"บ้าน"},{id:"mktResult",icon:"📊",label:"ผลลัพธ์"},{id:"settings",icon:"⚙️",label:"ตั้งค่า"}],
    engineer:[{id:"dash",icon:"⊞",label:"บ้าน"},{id:"tracking",icon:"📋",label:"ติดตาม"},{id:"team",icon:"👥",label:"ทีม"},{id:"analytics",icon:"📊",label:"วิเคราะห์"},{id:"settings",icon:"⚙️",label:"ตั้งค่า"}],
    foreman:[{id:"dash",icon:"⊞",label:"บ้าน"},{id:"tracking",icon:"📋",label:"ติดตาม"},{id:"team",icon:"👥",label:"ทีม"},{id:"timeline",icon:"📈",label:"Timeline"}],
    purchasing:[{id:"dash",icon:"⊞",label:"ภาพรวม"},{id:"costPage",icon:"💰",label:"ต้นทุน"},{id:"tracking",icon:"📋",label:"ติดตาม"},{id:"team",icon:"👥",label:"ทีม"},{id:"timeline",icon:"📈",label:"Timeline"}],
    marketing:[{id:"marketing",icon:"🏠",label:"บ้าน"},{id:"customerData",icon:"👤",label:"ลูกค้า"},{id:"mktResult",icon:"📊",label:"ผลลัพธ์"},{id:"mktBudget",icon:"💰",label:"งบ"},{id:"tracking",icon:"📋",label:"ติดตาม"}],
    sales:[{id:"marketing",icon:"🏠",label:"บ้าน"},{id:"customerData",icon:"👤",label:"ลูกค้า"},{id:"mktResult",icon:"📊",label:"ผลลัพธ์"},{id:"tracking",icon:"📋",label:"ติดตาม"},{id:"team",icon:"👥",label:"ทีม"}],
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
            {page==="transferredHouses"&&["owner","marketing","sales"].includes(role)&&<TransferredHousesPage data={data} setData={setData} role={role} isMobileMode={isMobileMode}/>}
            {page==="team"&&<TeamPage data={data} setData={setData} role={role} isMobileMode={isMobileMode}/>}
            {page==="marketing"&&<MarketingPage data={data} setData={setData} role={role} isMobileMode={isMobileMode}/>}
            {page==="customerData"&&["owner","marketing","sales"].includes(role)&&<CustomerDataPage data={data} setData={setData} role={role} isMobileMode={isMobileMode} setPage={handleSetPage}/>}
            {page==="mktResult"&&["owner","marketing","sales"].includes(role)&&<MktResultPage data={data} setData={setData} role={role} isMobileMode={isMobileMode}/>}
            {page==="mktBudget"&&["owner","marketing"].includes(role)&&<MktBudgetPage data={data} setData={setData} role={role} isMobileMode={isMobileMode}/>}
            {page==="costPage"&&["owner","engineer","purchasing"].includes(role)&&<CostPage data={data} setData={setData} role={role} isMobileMode={isMobileMode}/>}
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
      {bookingCelebration&&(()=>{
        const a=bookingCelebration;
        const colors=["#fbbf24","#ef4444","#3b82f6","#10b981","#a855f7","#f97316","#ec4899"];
        return(
          <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}} onClick={()=>setBookingCelebration(null)}>
            <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",borderRadius:24,padding:isMobileMode?"30px 20px":"48px 64px",textAlign:"center",border:"2px solid #fbbf24",boxShadow:"0 0 80px rgba(251,191,36,.25)",maxWidth:480,width:"90%",animation:"celebBounce .6s ease-out"}} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:64,marginBottom:12}}>🎉🏠🎊</div>
              <div style={{fontSize:isMobileMode?22:28,fontWeight:800,color:"#fbbf24",marginBottom:8}}>ยินดีด้วย!</div>
              <div style={{fontSize:isMobileMode?16:20,color:"#fff",marginBottom:16}}>บ้าน {a.houseName} ติดจองแล้ว!</div>
              <div style={{background:"rgba(255,255,255,0.08)",borderRadius:14,padding:"16px 20px",marginBottom:16}}>
                <div style={{fontSize:14,color:"#d1d5db"}}>👤 ลูกค้า: <span style={{color:"#fff",fontWeight:700}}>{a.customerName||"—"}</span></div>
                <div style={{fontSize:14,color:"#d1d5db",marginTop:6}}>📝 โดย: <span style={{color:"#fff",fontWeight:700}}>{a.bookedBy||"—"}</span></div>
                {(a.salesPersons||[]).length>0&&<div style={{fontSize:14,color:"#d1d5db",marginTop:6}}>👥 เซลล์: <span style={{color:"#fff",fontWeight:700}}>{a.salesPersons.join(", ")}</span></div>}
                <div style={{fontSize:14,color:"#d1d5db",marginTop:6}}>📅 {fmtDate(a.date)}</div>
              </div>
              <div style={{fontSize:12,color:"#6b7280"}}>แตะเพื่อปิด</div>
            </div>
            {Array.from({length:60}).map((_,i)=><div key={i} style={{position:"absolute",left:`${(i*1.67)%100}%`,top:-10,width:`${5+i%7}px`,height:`${5+i%7}px`,background:colors[i%7],borderRadius:i%3?"50%":"2px",opacity:0,animation:`${i%2?"cFallL2":"cFallR2"} ${2+(i%5)*.4}s linear ${i*.05}s forwards`}}/>)}
            <style>{`@keyframes cFallL2{0%{top:-10px;opacity:1;transform:rotate(0)}25%{opacity:1}100%{top:105vh;opacity:0;transform:rotate(720deg) translateX(-80px)}}@keyframes cFallR2{0%{top:-10px;opacity:1;transform:rotate(0)}25%{opacity:1}100%{top:105vh;opacity:0;transform:rotate(-720deg) translateX(80px)}}@keyframes celebBounce{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}`}</style>
          </div>
        );
      })()}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// END OF PART 9 — App.jsx COMPLETE ✓
// ═══════════════════════════════════════════════════════════════



