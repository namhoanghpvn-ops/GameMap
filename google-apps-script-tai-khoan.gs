/* =====================================================================
   MÁY CHỦ NĂNG LƯỢNG THEO IP · MAP CỘNG ĐỒNG  (Google Apps Script) - KHÔNG CẦN ĐĂNG NHẬP
   CÀI ĐẶT: dán vào Apps Script của 1 Google Sheet riêng → Triển khai → Ứng dụng web
   (Thực thi: Tôi · Truy cập: Bất kỳ ai) → dán link /exec vào ACC_API trong index.html.
   Sửa code xong phải "Triển khai phiên bản mới". Admin: đặt ADMIN_KEY, rồi trên web mở ô ⚡ → "🛡 Quản trị" nhập đúng mã đó.
   Lưu ý: IP do trình duyệt gửi lên nên người rành kỹ thuật có thể giả IP để lấy thêm năng lượng.
   ===================================================================== */
var C={SALT:"doi-chuoi-bi-mat-nay",ADMIN_KEY:"", // ĐẶT 1 MẬT KHẨU DÀI, BÍ MẬT. Chỉ ai nhập đúng mã này trên web mới xóa được map.
 DAILY:10,      // năng lượng mỗi ngày (reset 00:00 giờ VN, không cộng dồn)
 COST:4,        // tải 1 map tốn
 ONL_EVERY:600, // online mỗi 600 giây = +1
 ONL_MAX:5,     // tối đa +5/ngày từ online
 POST_REW:5, POST_REW_MAX:2, // đăng map +5, tối đa 2 lần/ngày được thưởng
 POST_LIMIT:5,  // tối đa 5 map/ngày
 TZ:"Asia/Ho_Chi_Minh"};
var H={Users:["id","prov","name","av","day","n","onlSec","onlG","posts","postRew","lastPing"],
 Sessions:["h","uid","exp"],Maps:["id","ts","uid","by","av","t","p","d","s","u","img","st"],Downloads:["ts","uid","mid"]};
var DF=["Dễ","Trung Bình","Khó","Cực Khó","Siêu Cấp"],SZ=["Nhỏ","Vừa","Rộng"];
function sh(n){var ss=SpreadsheetApp.getActive(),s=ss.getSheetByName(n);if(!s){s=ss.insertSheet(n);s.appendRow(H[n])}return s}
function all(n){var v=sh(n).getDataRange().getValues(),h=v.shift();return v.map(function(r,i){var o={_r:i+2};h.forEach(function(k,j){o[k]=r[j]});return o})}
function row(n,o){return H[n].map(function(k){return o[k]===undefined?"":o[k]})}
function put(n,o){sh(n).appendRow(row(n,o))}
function upd(n,o){sh(n).getRange(o._r,1,1,H[n].length).setValues([row(n,o)])}
function J(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
function sha(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(function(b){return("0"+(b&255).toString(16)).slice(-2)}).join("")}
function today(){return"d"+Utilities.formatDate(new Date(),C.TZ,"yyyyMMdd")}
function fj(u,o){o=o||{};o.muteHttpExceptions=true;return JSON.parse(UrlFetchApp.fetch(u,o).getContentText())}
function cl(s,n){return String(s||"").replace(/[\u0000-\u001f<>]/g,"").trim().slice(0,n)}
function inl(a,v){v=String(v||"").normalize("NFC").trim();return a.some(function(x){return x.normalize("NFC")===v})}
function err(m){return{ok:false,err:m}}
function cfg(){return{cost:C.COST,daily:C.DAILY,onlMax:C.ONL_MAX,postRew:C.POST_REW,postRewMax:C.POST_REW_MAX}}
function en(u){var t=new Date(today().slice(1,5)+"-"+today().slice(5,7)+"-"+today().slice(7,9)+"T00:00:00+07:00").getTime()+864e5;return{n:+u.n,resetAt:t,onl:+u.onlG,post:+u.postRew}}
function roll(u){if(u.day!==today()){u.day=today();u.n=C.DAILY;u.onlSec=0;u.onlG=0;u.posts=0;u.postRew=0}}
function isAd(d){return!!C.ADMIN_KEY&&d.ak===C.ADMIN_KEY}
function uv(u,d){return{id:u.id,admin:isAd(d)}}
function who(ip,mk){if(!/^[0-9a-fA-F:.]{3,45}$/.test(String(ip||"")))throw new Error("Không xác định được IP");
 var id="u"+sha(ip+"|"+C.SALT).slice(0,12),u=all("Users").filter(function(r){return r.id===id})[0];
 if(!u&&mk){u={id:id,prov:"ip",name:"",av:"",day:"",n:0,onlSec:0,onlG:0,posts:0,postRew:0,lastPing:Date.now()};roll(u);put("Users",u);u=all("Users").filter(function(r){return r.id===id})[0]}
 return u||null}
function doGet(){return J(pub(null))}
function doPost(e){var l=LockService.getScriptLock();l.waitLock(25000);try{return J(run(JSON.parse(e.postData.contents)))}catch(x){return J(err(String(x.message||x)))}finally{l.releaseLock()}}
function pub(u){var dl={},t0=new Date(en({n:0}).resetAt-864e5).getTime(),now=Date.now(),got={};
 all("Downloads").forEach(function(r){var o=dl[r.mid]||(dl[r.mid]={a:0,b:0,c:0});o.a++;if(+r.ts>=t0)o.b++;if(+r.ts>=now-6048e5)o.c++;if(u&&r.uid===u.id)got[r.mid]=1});
 return{ok:true,maps:all("Maps").filter(function(m){return m.st==="on"}).reverse().slice(0,500).map(function(m){var o=dl[m.id]||{a:0,b:0,c:0};
  return{id:m.id,ts:new Date(+m.ts).toISOString(),by:m.by,av:m.av,t:m.t,p:+m.p,d:m.d,s:m.s,img:m.img,dl:o.a,dl1:o.b,dl7:o.c,got:!!got[m.id],own:!!u&&m.uid===u.id}})}}
function run(d){var op=d.op,u=who(d.ip,op!=="maps");if(op==="maps")return pub(u);
 roll(u);var res={ok:true},now=Date.now();
 if(op==="ping"){var dt=Math.min(90,Math.max(0,(now-(+u.lastPing||now))/1000));u.lastPing=now;u.onlSec=+u.onlSec+dt;
  var t=Math.min(C.ONL_MAX,Math.floor(u.onlSec/C.ONL_EVERY));if(t>+u.onlG){u.n=+u.n+t-u.onlG;u.onlG=t}}
 else if(op==="submit"){var by=cl(d.by,40);if(by.length<2)return err("Nhập tên người đóng góp");var t2=cl(d.t,80),p=+d.p,lk=String(d.u||"").trim(),im=String(d.img||"").trim(),re=/^https?:\/\/\S{4,480}$/;
  if(t2.length<2)return err("Tên map quá ngắn");if(!(p>=2&&p<=8))return err("Số người không hợp lệ");
  if(!inl(DF,d.d))return err("Độ khó không hợp lệ: "+cl(d.d,20));if(!inl(SZ,d.s))return err("Cỡ map không hợp lệ: "+cl(d.s,20));
  if(!re.test(lk))return err("Link tải không hợp lệ (phải bắt đầu http/https, không chứa khoảng trắng)");if(im&&!re.test(im))return err("Link ảnh không hợp lệ");
  if(+u.posts>=C.POST_LIMIT)return err("Hôm nay bạn đã đăng tối đa "+C.POST_LIMIT+" map");
  if(all("Maps").some(function(m){return m.st==="on"&&m.u===lk}))return err("Link này đã có người đăng");
  put("Maps",{id:"m"+now.toString(36)+Math.random().toString(36).slice(2,5),ts:now,uid:u.id,by:by,av:"",t:t2,p:p,d:cl(d.d,20),s:cl(d.s,20),u:lk,img:im,st:"on"});
  u.posts=+u.posts+1;res.reward=0;if(+u.postRew<C.POST_REW_MAX){u.postRew=+u.postRew+1;u.n=+u.n+C.POST_REW;res.reward=C.POST_REW}}
 else if(op==="dl"){var m=all("Maps").filter(function(x){return x.id===d.id&&x.st==="on"})[0];if(!m)return err("Map không còn tồn tại");
  var had=m.uid===u.id||all("Downloads").some(function(r){return r.uid===u.id&&r.mid===m.id});
  if(!had){if(+u.n<C.COST)return err("Không đủ năng lượng (cần ⚡"+C.COST+")");u.n=+u.n-C.COST;put("Downloads",{ts:now,uid:u.id,mid:m.id})}res.u=m.u}
 else if(op==="del"){var m2=all("Maps").filter(function(x){return x.id===d.id})[0];if(!isAd(d))return err("Chỉ admin mới được xóa map");if(!m2)return err("Map không tồn tại");m2.st="del";upd("Maps",m2)}
 else if(op!=="me")return err("Thao tác không hợp lệ");
 upd("Users",u);res.user=uv(u,d);res.en=en(u);res.cfg=cfg();return res}
