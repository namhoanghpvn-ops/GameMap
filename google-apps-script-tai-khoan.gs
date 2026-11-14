/* =====================================================================
   MÁY CHỦ NĂNG LƯỢNG THEO IP · MAP CỘNG ĐỒNG  (Google Apps Script) - KHÔNG CẦN ĐĂNG NHẬP
   CÀI ĐẶT: dán vào Apps Script của 1 Google Sheet riêng → Triển khai → Ứng dụng web
   (Thực thi: Tôi · Truy cập: Bất kỳ ai) → dán link /exec vào ACC_API trong index.html.
   Sửa code xong phải "Triển khai phiên bản mới". Admin: đặt ADMIN_KEY, rồi trên web mở ô ⚡ → "🛡 Quản trị" nhập đúng mã đó.
   Lưu ý: IP do trình duyệt gửi lên nên người rành kỹ thuật có thể giả IP để lấy thêm năng lượng.
   ===================================================================== */
var C={SALT:"doi-chuoi-bi-mat-nay",ADMIN_KEY:"250319", // ĐẶT 1 MẬT KHẨU DÀI, BÍ MẬT. Chỉ ai nhập đúng mã này trên web mới xóa được map.
 DAILY:10,      // năng lượng mỗi ngày (reset 00:00 giờ VN, không cộng dồn)
 COST:4,        // tải 1 map tốn
 ONL_EVERY:600, // online mỗi 600 giây = +1
 ONL_MAX:5,     // tối đa +5/ngày từ online
 POST_REW:5, POST_REW_MAX:2, // đăng map +5, tối đa 2 lần/ngày được thưởng
 POST_LIMIT:5,  // tối đa 5 map/ngày
 CODE_BAD:5,    // nhập sai mã quá 5 lần/ngày thì bị khóa nhập mã đến hôm sau
 CHECKIN:[1,1,2,2,3,3,5], // ⚡ thưởng điểm danh ngày thứ 1..7 của chuỗi (nên khớp CHECKIN trong index.html)
 CHECKIN_KEEP:true, // true = ⚡ điểm danh được giữ sang ngày sau (như mã quà tặng); false = reset 00:00 như ⚡ thường
 MYST:2,       // hộp map bí ẩn tốn
 SHOP:{fr1:6,fr2:6,fr3:12,fr4:20,co1:4,co2:4,co3:8,co4:15,ic1:3,ic2:5,ic3:8,ic4:10,ic5:15}, // GIÁ CỬA HÀNG ⚡ (máy chủ tự kiểm tra giá, không tin số web gửi lên)
 TZ:"Asia/Ho_Chi_Minh",
 /* ===== ĐĂNG NHẬP (điền ID/khóa lấy từ trang nhà phát triển của từng nền tảng; để trống = tắt nền tảng đó) ===== */
 GOOGLE_ID:"",            // Google Client ID (dạng xxxx.apps.googleusercontent.com)
 ZALO_ID:"",ZALO_SECRET:"", // Zalo App ID + Secret Key
 TT_KEY:"",TT_SECRET:"",    // TikTok Client Key + Client Secret
 SESSION_DAYS:30};          // đăng nhập giữ bao nhiêu ngày
var H={Users:["id","prov","name","av","day","n","onlSec","onlG","posts","postRew","lastPing","bonus","codeBad","ciLast","ciStreak"],
 Sessions:["h","uid","exp"],Identities:["key","uid","prov","ts"],Maps:["id","ts","uid","by","av","t","p","d","s","u","img","st"],Downloads:["ts","uid","mid"],
 Shop:["ts","uid","item","price"],Equip:["uid","by","fr","co","ic","ts"],Boxes:["ts","uid","map"],
 Codes:["code","energy","max","exp","note"],Redeems:["ts","uid","code"],
 SLinks:["key","t","u"],Videos:["id","ts","src","url","t","th","by","uid"],Config:["k","v"],SMaps:["id","ts","t","p","d","s","u","st"],MapBuys:["ts","uid","key","title","price"]};
var DF=["Dễ","Trung Bình","Khó","Cực Khó","Siêu Cấp"],SZ=["Nhỏ","Vừa","Rộng"];
function sh(n){var ss=SpreadsheetApp.getActive(),s=ss.getSheetByName(n);if(!s){s=ss.insertSheet(n);s.appendRow(H[n])}else if(s.getLastColumn()<H[n].length)s.getRange(1,1,1,H[n].length).setValues([H[n]]);return s}
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
function roll(u){if(u.day!==today()){var cr=Math.min(+u.bonus||0,+u.n||0);u.day=today();u.n=C.DAILY+cr;u.bonus=cr;u.onlSec=0;u.onlG=0;u.posts=0;u.postRew=0;u.codeBad=0}} // cr = ⚡ từ mã quà tặng chưa dùng hết, được giữ sang ngày mới
function nrm(s){return String(s||"").replace(/\s+/g,"").toUpperCase()}
function expired(x){if(x===""||x==null)return false;var t=x instanceof Date?x.getTime():Date.parse(String(x));return!isNaN(t)&&Date.now()>t+864e5}
function khoiTao(){["Shop","Equip","Boxes","Codes","Redeems","Config","SMaps","MapBuys","SLinks","Videos"].forEach(sh);Logger.log("Đã tạo xong các sheet")} // chạy 1 lần trong trình soạn thảo để tạo sẵn sheet Codes
function isAd(d){return!!C.ADMIN_KEY&&d.ak===C.ADMIN_KEY}
function uv(u,d){var lg=/^a/.test(String(u.id));return{id:u.id,admin:isAd(d),name:String(u.name||""),av:String(u.av||""),login:lg,links:lg?all("Identities").filter(function(r){return r.uid===u.id}).map(function(r){return String(r.prov)}):[]}}
function who(d,mk){var su=sess(d);if(su)return su;var ip=d.ip;if(!/^[0-9a-fA-F:.]{3,45}$/.test(String(ip||"")))throw new Error("Không xác định được IP");
 var id="u"+sha(ip+"|"+C.SALT).slice(0,12),u=all("Users").filter(function(r){return r.id===id})[0];
 if(!u&&mk){u={id:id,prov:"ip",name:"",av:"",day:"",n:0,onlSec:0,onlG:0,posts:0,postRew:0,lastPing:Date.now(),bonus:0,codeBad:0};roll(u);put("Users",u);u=all("Users").filter(function(r){return r.id===id})[0]}
 return u||null}
function owned(uid){return all("Shop").filter(function(r){return r.uid===uid}).map(function(r){return String(r.item)})}
/* ===== GIÁ MAP SINH TỒN ⚡ · MAP DO ADMIN ĐĂNG ===== */
var MT={"Dễ":2,"Trung Bình":4,"Khó":6,"Cực Khó":8,"Siêu Cấp":10}; // giá mặc định theo độ khó; admin sửa trên web (lưu ở sheet Config)
function mk(t){return String(t).replace(/[.#$\/\[\]\s"'<>&%?+\\]+/g,"_").slice(0,80)}
function canon(a,v){v=String(v||"").normalize("NFC").trim();return a.filter(function(x){return x.normalize("NFC")===v})[0]||""}
function mcfg(){var r=all("Config").filter(function(x){return x.k==="mprices"})[0],o={tier:{},map:{}};if(r){try{var j=JSON.parse(r.v);if(j&&j.tier)o.tier=j.tier;if(j&&j.map)o.map=j.map}catch(e){}}return o}
function has(o,k){return Object.prototype.hasOwnProperty.call(o,k)&&o[k]!==null&&o[k]!==""}
function mprice(t,dd){var c=mcfg(),k=mk(t),v=has(c.map,k)?c.map[k]:has(c.tier,dd)?c.tier[dd]:MT[dd];v=Math.round(+v);return isNaN(v)?2:Math.max(0,Math.min(99,v))}
function smaps(adm){return all("SMaps").filter(function(m){return m.st==="on"}).map(function(m){return{id:m.id,ts:new Date(+m.ts).toISOString(),t:m.t,p:+m.p,d:m.d,s:m.s,u:adm?m.u:""}})} // link chỉ trả cho Admin; người chơi lấy qua op "mdl" sau khi mở khóa
function mbOwned(uid){var a=all("MapBuys").filter(function(r){return r.uid===uid}).map(function(r){return String(r.key)});all("Boxes").forEach(function(r){if(r.uid===uid&&r.map)a.push(mk(r.map))});return a}
function doGet(){return J(pub(null))}
function doPost(e){var l=LockService.getScriptLock();l.waitLock(25000);try{return J(run(JSON.parse(e.postData.contents)))}catch(x){var em=String(x.message||x);return J(em==="AUTH"?{ok:false,auth:true,err:"Phiên đăng nhập đã hết hạn, hãy đăng nhập lại"}:err(em))}finally{l.releaseLock()}}
function pub(u){var dl={},t0=new Date(en({n:0}).resetAt-864e5).getTime(),now=Date.now(),got={};
 all("Downloads").forEach(function(r){var o=dl[r.mid]||(dl[r.mid]={a:0,b:0,c:0});o.a++;if(+r.ts>=t0)o.b++;if(+r.ts>=now-6048e5)o.c++;if(u&&r.uid===u.id)got[r.mid]=1});
 return{ok:true,maps:all("Maps").filter(function(m){return m.st==="on"}).reverse().slice(0,500).map(function(m){var o=dl[m.id]||{a:0,b:0,c:0};
  return{id:m.id,ts:new Date(+m.ts).toISOString(),by:m.by,av:m.av,t:m.t,p:+m.p,d:m.d,s:m.s,img:m.img,dl:o.a,dl1:o.b,dl7:o.c,got:!!got[m.id],own:!!u&&m.uid===u.id}})}}
function run(d){var op=d.op;if(op==="vlist"||op==="vadd"||op==="vdel")return vidRun(d);if(op==="login")return loginOp(d);if(op==="logout")return logoutOp(d);var u=who(d,op!=="maps");if(op==="maps")return pub(u);
 if(op==="cos"){var cs={};all("Equip").forEach(function(r){if(r.fr||r.co||r.ic)cs[String(r.by).toLowerCase()]={fr:String(r.fr||""),co:String(r.co||""),ic:String(r.ic||"")}});return{ok:true,cos:cs,own:owned(u.id),box:all("Boxes").filter(function(r){return r.uid===u.id&&r.map}).map(function(r){return String(r.map)}),mp:mcfg(),ms:smaps(isAd(d)),mb:mbOwned(u.id)}}
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
 else if(op==="spend"){var kd=String(d.kind||"");
  if(kd==="mystery"){var mp=cl(d.map,80);if(mp.length<2)return err("Thiếu tên map trong hộp");
   if(all("Boxes").some(function(r){return r.uid===u.id&&String(r.map)===mp}))return err("Bạn đã mở map này rồi");
   if(+u.n<C.MYST)return err("Không đủ năng lượng (cần ⚡"+C.MYST+")");u.n=+u.n-C.MYST;put("Boxes",{ts:now,uid:u.id,map:mp})}
  else if(kd==="shop"){var it=String(d.item||"");if(!Object.prototype.hasOwnProperty.call(C.SHOP,it))return err("Món đồ không tồn tại");var pr=C.SHOP[it];
   if(owned(u.id).indexOf(it)>=0)return err("Bạn đã sở hữu món này");if(+u.n<pr)return err("Không đủ năng lượng (cần ⚡"+pr+")");
   u.n=+u.n-pr;put("Shop",{ts:now,uid:u.id,item:it,price:pr})}
  else if(kd==="mapbuy"){var mt=cl(d.map,80),sm=all("SMaps").filter(function(x){return x.st==="on"&&String(x.t).toLowerCase()===mt.toLowerCase()})[0],dd=canon(DF,sm?sm.d:d.d);
   if(mt.length<2)return err("Thiếu tên map");if(!dd)return err("Độ khó không hợp lệ");
   var key=mk(mt);if(mbOwned(u.id).indexOf(key)>=0)return err("Bạn đã mở map này rồi");
   var pm=mprice(mt,dd);if(d.price!==undefined&&+d.price!==pm)return err("Giá map vừa đổi thành ⚡"+pm+", hãy bấm mở khóa lại");
   if(+u.n<pm)return err("Không đủ năng lượng (cần ⚡"+pm+")");u.n=+u.n-pm;put("MapBuys",{ts:now,uid:u.id,key:key,title:mt,price:pm})}
  else return err("Loại giao dịch không hợp lệ")}
 else if(op==="mdl"){var mn=cl(d.map,80),ky=mk(mn);if(mn.length<2)return err("Thiếu tên map");
  if(!isAd(d)&&mbOwned(u.id).indexOf(ky)<0)return err("Bạn chưa mở khóa map này");
  var sm2=all("SMaps").filter(function(x){return x.st==="on"&&String(x.t).toLowerCase()===mn.toLowerCase()})[0],lnk=sm2?String(sm2.u):"";
  if(!lnk){var sl=all("SLinks").filter(function(x){return String(x.key)===ky})[0];
   if(!sl&&all("SLinks").length<SEEDN){nhapLinkMap(true);sl=all("SLinks").filter(function(x){return String(x.key)===ky})[0]} // tự nạp link lần đầu nếu quên chạy nhapLinkMap
   lnk=sl?String(sl.u):""}
  if(!lnk)return err("Map này chưa có link trên máy chủ (Admin cần chạy nhapLinkMap hoặc điền sheet SLinks)");res.u=lnk}
 else if(op==="mlink"){if(!isAd(d))return err("Chỉ admin mới được sửa link");var tl=cl(d.t,80),ul=String(d.u||"").trim();if(tl.length<2||!/^https?:\/\/\S{4,480}$/.test(ul))return err("Tên map hoặc link không hợp lệ");
  var kl=mk(tl),ex=all("SLinks").filter(function(x){return String(x.key)===kl})[0];if(ex){ex.u=ul;ex.t=tl;upd("SLinks",ex)}else put("SLinks",{key:kl,t:tl,u:ul})}
 else if(op==="madd"){if(!isAd(d))return err("Chỉ admin mới được đăng map");var ta=cl(d.t,80),pa=+d.p,la=String(d.u||"").trim(),da=canon(DF,d.d),sa=canon(SZ,d.s);
  if(ta.length<2)return err("Tên map quá ngắn");if(!(pa>=2&&pa<=8))return err("Số người không hợp lệ");if(!da)return err("Độ khó không hợp lệ");if(!sa)return err("Cỡ map không hợp lệ");
  if(!/^https?:\/\/\S{4,480}$/.test(la))return err("Link tải không hợp lệ");
  if(all("SMaps").some(function(m){return m.st==="on"&&String(m.t).toLowerCase()===ta.toLowerCase()}))return err("Đã có map trùng tên");
  put("SMaps",{id:"s"+now.toString(36)+Math.random().toString(36).slice(2,5),ts:now,t:ta,p:pa,d:da,s:sa,u:la,st:"on"})}
 else if(op==="mdel"){if(!isAd(d))return err("Chỉ admin mới được xóa map");var sd=all("SMaps").filter(function(x){return x.id===d.id})[0];if(!sd)return err("Map không tồn tại");sd.st="del";upd("SMaps",sd)}
 else if(op==="mset"){if(!isAd(d))return err("Chỉ admin mới được sửa giá");var tr=d.tier||{},mpp=d.map||{},o={tier:{},map:{}},ks=Object.keys(mpp),i2;
  for(i2=0;i2<DF.length;i2++){var tv=tr[DF[i2]];if(tv===undefined||tv===null||tv==="")continue;tv=Math.round(+tv);if(!(tv>=0&&tv<=99))return err("Giá phải từ 0 đến 99");o.tier[DF[i2]]=tv}
  if(ks.length>600)return err("Quá nhiều giá riêng");
  for(i2=0;i2<ks.length;i2++){var mv=mpp[ks[i2]];if(mv===undefined||mv===null||mv==="")continue;mv=Math.round(+mv);if(!(mv>=0&&mv<=99))return err("Giá phải từ 0 đến 99");o.map[cl(ks[i2],80)]=mv}
  var cr=all("Config").filter(function(x){return x.k==="mprices"})[0];if(cr){cr.v=JSON.stringify(o);upd("Config",cr)}else put("Config",{k:"mprices",v:JSON.stringify(o)})}
 else if(op==="equip"){var nb=cl(d.by,40);if(nb.length<2)return err("Nhập tên hiển thị trước");var ow=owned(u.id),eq=d.eq||{},nw={},sl=["fr","co","ic"];
  for(var i=0;i<3;i++){var v=String(eq[sl[i]]||"");if(v&&(v.indexOf(sl[i])!==0||ow.indexOf(v)<0))return err("Bạn chưa sở hữu món «"+cl(v,10)+"»");nw[sl[i]]=v}
  var lo=nb.toLowerCase(),eqs=all("Equip");
  if(eqs.some(function(r){return r.uid!==u.id&&String(r.by).toLowerCase()===lo&&(r.fr||r.co||r.ic)}))return err("Tên «"+nb+"» đang được người khác dùng cho đồ cửa hàng, hãy chọn tên khác");
  var mine=eqs.filter(function(r){return r.uid===u.id})[0];
  if(mine){mine.by=nb;mine.fr=nw.fr;mine.co=nw.co;mine.ic=nw.ic;mine.ts=now;upd("Equip",mine)}else put("Equip",{uid:u.id,by:nb,fr:nw.fr,co:nw.co,ic:nw.ic,ts:now})}
 else if(op==="redeem"){var cd=nrm(d.code);if(cd.length<2)return err("Nhập mã quà tặng");
  if((+u.codeBad||0)>=C.CODE_BAD)return err("Hôm nay bạn nhập sai quá "+C.CODE_BAD+" lần, hãy thử lại vào ngày mai");
  var cr2=all("Codes").filter(function(r){return nrm(r.code)===cd&&+r.energy>0})[0];
  if(!cr2||expired(cr2.exp)){u.codeBad=(+u.codeBad||0)+1;upd("Users",u);return err("Mã không đúng hoặc đã hết hạn")}
  var rds=all("Redeems").filter(function(r){return nrm(r.code)===cd});
  if(rds.some(function(r){return r.uid===u.id}))return err("Bạn đã dùng mã này rồi");
  if(+cr2.max>0&&rds.length>=+cr2.max)return err("Mã đã hết lượt sử dụng");
  var gn=Math.min(1000,Math.floor(+cr2.energy));u.n=+u.n+gn;u.bonus=(+u.bonus||0)+gn;put("Redeems",{ts:now,uid:u.id,code:cd});res.gain=gn}
 else if(op==="checkin"){var td=today(),yd="d"+Utilities.formatDate(new Date(Date.now()-864e5),C.TZ,"yyyyMMdd");
  if(String(u.ciLast)===td)return err("Hôm nay bạn đã điểm danh rồi");
  var cs=String(u.ciLast)===yd?(+u.ciStreak||0)+1:1,rw=C.CHECKIN[(cs-1)%C.CHECKIN.length];
  u.ciLast=td;u.ciStreak=cs;u.n=+u.n+rw;if(C.CHECKIN_KEEP)u.bonus=(+u.bonus||0)+rw;res.checkin={streak:cs,reward:rw}}
 else if(op==="setname"){var nn=cl(d.name,40);if(nn.length<2)return err("Tên quá ngắn (ít nhất 2 ký tự)");u.name=nn}
 else if(op!=="me")return err("Thao tác không hợp lệ");
 upd("Users",u);res.user=uv(u,d);res.en=en(u);res.cfg=cfg();return res}

/* CHẠY 1 LẦN trong trình soạn thảo Apps Script (chọn hàm nhapLinkMap → Chạy): nạp link tải của 76 map sinh tồn vào sheet SLinks.
   Sau đó link không còn nằm trong trang web nữa. Muốn đổi link 1 map: sửa trực tiếp ô trong sheet SLinks (cột u). */
var SEEDN=76; // số map có sẵn trong nhapLinkMap
function nhapLinkMap(keep){var L=[
  ["Up Side Down Temp","https://www.mediafire.com/file/sscutde5nzunam7/USD+Temp.mpr/file"],
  ["Up Side Down Super V1.2","https://www.mediafire.com/file/km8fqc2ftwhbk7j/upsidedown+super+v1.2.mpr/file"],
  ["Up Side Down Super Water Lv2","https://www.mediafire.com/file/pz8h6pkeg3sjl2p/upsidedown+super+water++Lv2.mpr/file"],
  ["Up Side Down Super Water Lv6.1","https://www.mediafire.com/file/nmy4hwj435x4bja/upsidedown+super+water++Lv6.1.mpr/file"],
  ["Up Side Down Super Water Lv6.1 Snow","https://www.mediafire.com/file/7hfd12vephhvuxt/upsidedown+super+water++Lv6.1_Snow.mpr/file"],
  ["Up Side Down Super Water Speed Up","https://www.mediafire.com/file/9qsnvv7sdparzvu/upsidedown+super+water++Speed+Up.mpr/file"],
  ["Up Side Down Super Water Lv7","https://www.mediafire.com/file/k1wwuacrvpirhzv/upsidedown+super+water++Lv7.mpr/file"],
  ["Up Side Down NH V2.2","https://www.mediafire.com/file/yruxuv3j5ln1bld/upsidedownnh+ver2.2.mpr/file"],
  ["Up Side Down NH V2.3","https://www.mediafire.com/file/jfg1jty6etkeybt/upsidedownnh+ver2.3+Warter.mpr/file"],
  ["USD City War","https://www.mediafire.com/file/wnzpoqcfm0i28yq/USD+City+War.mpr/file"],
  ["USD Snow","https://www.mediafire.com/file/h47mn9xjzf17e8t/USD+Snow.mpr/file"],
  ["USD Super War Ship Easy Temp","https://www.mediafire.com/file/lfd6gxsh8kbl8m4/USD+Super+War+Ship+Snow+Easy+Temp.mpr/file"],
  ["USD Super War Ship Snow Finish","https://www.mediafire.com/file/upbuhmwgj3kv37i/USD+Super+War+Ship+Snow+Finish.mpr/file"],
  ["USD Super V1.3 Snow","https://www.mediafire.com/file/rcjvm9cx29moxam/upsidedown+super+v1.3+Snow.mpr/file"],
  ["Transil Vanie V1","https://www.mediafire.com/file/rxd3ka82mb8h3s4/transilvanie+v1.mpr/file"],
  ["Up Side Down City","https://www.mediafire.com/file/u4mcqv2d81rvekq/UP+SiDE+Down+City.mpr/file"],
  ["No Hope NH","https://www.mediafire.com/file/bpclx15atp55iiy/No+Hope+NH.mpr/file"],
  ["AFG Speed","https://www.mediafire.com/file/5abjq6hu1w98pkv/afg+speed+5pl.mpr/file"],
  ["Snapper Solo 1-1","https://www.mediafire.com/file/mt5cuizxzy6lpjn/downtown+snapper+solo+1-1.mpr/file"],
  ["Delivery Country 6","https://www.mediafire.com/file/wot5ny4ejm56ihu/Delivery+country+6.mpr/file"],
  ["Route 66","https://www.mediafire.com/file/938de8y6wn42g24/Route+66.mpr/file"],
  ["Valley Of Death","https://www.mediafire.com/file/78z7l99xqd6iumh/valley+of+death.mpr/file"],
  ["Up Side Down Snow Super","https://www.mediafire.com/file/ewljv25l9qghy4o/USD+Snow+Super.mpr/file"],
  ["Valley Of Death Super","https://www.mediafire.com/file/qeooccd5vdkn5uz/valley+of+death+Super.mpr/file"],
  ["Arctic Circle By NamHoang [8]","https://www.mediafire.com/file/arruu3d88se0q42/Arctic+Circle+By+NamHoang+[8].mpr/file"],
  ["Arctic Circle By NamHoang Super [8]","https://www.mediafire.com/file/1ob5h25p1bea1u5/Arctic+Circle+By+NamHoang+Super+[8].mpr/file"],
  ["Heck_Freezes_Over_NH Super","https://www.mediafire.com/file/8pt6k5i7oky6cv2/Heck_Freezes_Over_NH+Super.mpr/file"],
  ["War Pro 3 NamHoang","https://www.mediafire.com/file/v2ajczr0e5h8fi8/War+Pro+3+Nam+Hoang.mpr/file"],
  ["Blaze Of Glory","https://www.mediafire.com/file/39fn5z5rxgskj5n/Blaze+of+Glory.mpr/file"],
  ["Viet Nam Medium NH","https://www.mediafire.com/file/ld1ux6uxv8m7gpc/vietnam+Medium+NH.mpr/file"],
  ["Viet Nam Super NH","https://www.mediafire.com/file/6p8qbhmq5lc0phs/vietnam+Super+NH.mpr/file"],
  ["USD War Ship Temp 3","https://www.mediafire.com/file/qu2uxtcc6uz5o4u/USD+War+Ship+Temp+3.mpr/file"],
  ["USD War Ship Temp 3 Super","https://www.mediafire.com/file/en2u1ty59dze15u/USD+War+Ship+Temp+3++Super.mpr/file"],
  ["USD Dark","https://www.mediafire.com/file/ivs3i00x51ecbpo/USD+Dark.mpr/file"],
  ["sota 3 NamHoang Mod","https://www.mediafire.com/file/mi0evq2zj00bezt/sota+ai+3p+vn-NamHoang+Mod.mpr/file"],
  ["Heck_Freezes_Over_NH Super 2","https://www.mediafire.com/file/ofxjhjm56sp2d9e/Heck_Freezes_Over_NH+Super+2.mpr/file"],
  ["Inland NH Super","https://www.mediafire.com/file/bptj1w15d7ewutc/Inland+NH+Super.mpr/file"],
  ["USD final terro","https://www.mediafire.com/file/l74pm4st7fbnorm/USD++final+terro.mpr/file"],
  ["x 8 blocks namhoang tryhard","https://www.mediafire.com/file/2m87p0sbcqh4qek/x+8+blocks+namhoang+tryhard.mpr/file"],
  ["Attack Kirov NH","https://www.mediafire.com/file/bo8xo2ngltcnmhc/Attack+Kirov+NH.mpr/file"],
  ["The Ivory Throne- winter NH","https://www.mediafire.com/file/61y74iiknpudeqm/The+Ivory+Throne-+winter+NH.mpr/file"],
  ["War Pro 4 Super","https://www.mediafire.com/file/mysiie8ze2c55bs/War+Pro+4+Super+_NamHoang.mpr/file"],
  ["War City Super","https://www.mediafire.com/file/cj6y6oy47edvi99/War+City+Super.mpr/file"],
  ["USD No Hope","https://www.mediafire.com/file/hc5tphrltb67na8/USD+No+Hope.mpr/file"],
  ["Inland Death Infinity","https://www.mediafire.com/file/25fcty23tzq8a9q/Inland+Death+Infinity.mpr/file"],
  ["(~.~)","https://www.mediafire.com/file/h6krfsz2b12l5qu/(~.~).mpr/file"],
  ["Tropical Technology","https://www.mediafire.com/file/wep05zm71dsg31r/Tropical+Technology+(2-8).mpr/file"],
  ["Ultimate island AI","https://www.mediafire.com/file/1mgwv8omkzrlnte/Ultimate+island+AI.mpr/file"],
  ["Ultimate island Easy","https://www.mediafire.com/file/00hgfdlktca1kce/Ultimate+island+Easy.mpr/file"],
  ["heck freez ( The Silent Hell 2 Super)","https://www.mediafire.com/file/qzc6l5uyyscm4bp/heck+freez+(+the+silent+hell+2+Super).mpr/file"],
  ["War Ship","https://www.mediafire.com/file/8qo5nbpezpubthl/War+Ship.mpr/file"],
  ["Mountain","https://www.mediafire.com/file/o7j2n64f6h8e7rx/Mountain.mpr/file"],
  ["Wild animal park snow","https://www.mediafire.com/file/0zvsttkjth804jo/wild+animal+park+snow.mpr/file"],
  ["Heck_Freezes_Over_NH Solo Star","https://www.mediafire.com/file/u92wcin7jp10f6u/Heck_Freezes_Over_NH+Solo+Star.mpr/file"],
  ["hazard by affenjunge","https://www.mediafire.com/file/rkzn5ioxrt0h51r/hazard+by+affenjunge.mpr/file"],
  ["Jungle v3","https://www.mediafire.com/file/e54c0kccvj0ugjq/Jungle+v3.mpr/file"],
  ["urban-desert","https://www.mediafire.com/file/rdq5tx36a3lyy2b/urban-desert.mpr/file"],
  ["War Ship 2","https://www.mediafire.com/file/xxs9ax2sde97z4k/War+Ship+2.mpr/file"],
  ["War Pro 5 By Nam Hoang","https://www.mediafire.com/file/n0c219xvn9nzl4x/War+Pro+5+By+Nam+Hoang.mpr/file"],
  ["Fake Map","https://www.mediafire.com/file/0og071wb8t52a53/fake+map.mpr/file"],
  ["War Pro 4 Sample","https://www.mediafire.com/file/r81pbn64s5gf0qm/War+pro+4+Sample.mpr/file"],
  ["War Pro 5 Sample","https://www.mediafire.com/file/nqwujw6eg91tzi7/War+Pro+5+Sample.MPR/file"],
  ["USD Easy","https://www.mediafire.com/file/l953mj8qetju7ty/USD+Easy.mpr/file"],
  ["War Pro 6","https://www.mediafire.com/file/mdnujy6lq7xrdsa/War+Pro+6.mpr/file"],
  ["War Ship 3","https://www.mediafire.com/file/rk6w3f9dwj1vq0s/War+Ship+3.mpr/file"],
  ["Ultimate island AI 2.0","https://www.mediafire.com/file/i4ibcvm8hlb5u9z/Ultimate+island+AI+2.0.mpr/file"],
  ["War Pro 7","https://www.mediafire.com/file/top29fpyxtmbkxk/War_Pro_7.mpr/file"],
  ["War Pro 8","https://www.mediafire.com/file/qqtfx3biz69jwr3/War+Pro+8.mpr/file"],
  ["War Pro 9","https://www.mediafire.com/file/rq33w5gzmo7wlmq/War+Pro+9.mpr/file"],
  ["Iland War","https://www.mediafire.com/file/61ncj441nbj7g4s/iland+war.mpr/file"],
  ["War Ship 5","https://www.mediafire.com/file/n4qqzxh4mjv83l3/War+Ship+5.mpr/file"],
  ["Skira IsLand","https://www.mediafire.com/file/3epwgc4s4jxyvyl/Skira+island.mpr/file"],
  ["Allvsone5","https://www.mediafire.com/file/65k7w9iloe7w0p1/allvsone5.mpr/file"],
  ["Super 8","https://www.mediafire.com/file/qzr4c5thixco01q/super8.mpr/file"],
  ["Hot Map 4","https://www.mediafire.com/file/76jg2797hji7y9g/hot+map+4.mpr/file"],
  ["USD Super Water Remake","https://www.mediafire.com/file/cxo3iv8mvv54ves/upsidedown+super+water++Lv6.1+Remake.mpr/file"]
 ],s=sh("SLinks"),m={},ord=[],add=0;
 all("SLinks").forEach(function(r){var k=String(r.key);if(!k)return;if(!m[k])ord.push(k);m[k]=[k,r.t,r.u]});
 L.forEach(function(x){var k=mk(x[0]);if(m[k]){if(keep)return}else{ord.push(k);add++}m[k]=[k,x[0],x[1]]});
 var rows=ord.map(function(k){return m[k]});if(rows.length)s.getRange(2,1,rows.length,3).setValues(rows);
 Logger.log("Đã nạp "+L.length+" link vào sheet SLinks (thêm mới "+add+")");return L.length}

/* ===== VIDEO CHƠI (YouTube / TikTok do người chơi chia sẻ) · lưu ở sheet "Videos" =====
   Lệnh web gọi: vlist (xem, ai cũng được) · vadd (thêm) · vdel (xóa, CHỈ Admin: isAd(d) kiểm tra ADMIN_KEY).
   Mỗi IP: cách nhau 20 giây, tối đa 10 video/ngày. Tối đa VID_MAX video trong danh sách. */
var VID_MAX=300,VID_GAP=20000,VID_DAY=10;
function vidParse(u){u=String(u||"").trim();if(!u||u.length>300)return null;var m;
 if((m=u.match(/^https:\/\/(?:www\.|m\.|music\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([\w-]{11})/i))||(m=u.match(/^https:\/\/youtu\.be\/([\w-]{11})/i))||(m=u.match(/^https:\/\/(?:www\.|m\.)?youtube\.com\/(?:shorts|embed|live|v)\/([\w-]{11})/i)))return{src:"yt",vid:m[1],url:"https://www.youtube.com/watch?v="+m[1]};
 if(m=u.match(/^(https:\/\/(?:[\w-]+\.)?tiktok\.com\/[^?#\s]*\/video\/(\d{8,25}))/i))return{src:"tt",vid:m[2],url:m[1].replace(/\/+$/,"")};
 if((m=u.match(/^(https:\/\/(?:vm|vt)\.tiktok\.com\/[\w-]+)/i))||(m=u.match(/^(https:\/\/(?:www\.)?tiktok\.com\/t\/[\w-]+)/i)))return{src:"tt",vid:"",url:m[1]};
 return null}
function vidTxt(s,n){s=cl(s,n);return/^[=+\-@]/.test(s)?" "+s:s} // chặn công thức Google Sheet
function vidList(){return all("Videos").map(function(r){var p=vidParse(r.url);return p?{id:String(r.id),ts:+r.ts||0,src:p.src,vid:p.vid,url:p.url,t:String(r.t||""),th:String(r.th||""),by:String(r.by||"Ẩn danh")}:null}).filter(Boolean).sort(function(a,b){return b.ts-a.ts}).slice(0,VID_MAX)}
function vidRun(d){var op=d.op;
 if(op==="vlist")return{ok:true,vids:vidList()};
 if(op==="vadd"){var v=d.v||{},p=vidParse(v.url);if(!p)return err("Link không hợp lệ (chỉ nhận YouTube hoặc TikTok)");
  var rows=all("Videos"),now=Date.now(),uid=uidOf(d);
  if(rows.some(function(r){return String(r.url).toLowerCase()===p.url.toLowerCase()}))return err("Video này đã có trong danh sách rồi");
  if(rows.length>=VID_MAX)return err("Danh sách video đã đầy, nhờ Admin dọn bớt");
  if(uid){var mine=rows.filter(function(r){return r.uid===uid}),t0=now-864e5;
   if(mine.some(function(r){return now-(+r.ts||0)<VID_GAP}))return err("Bạn thêm hơi nhanh, đợi vài giây nhé");
   if(mine.filter(function(r){return(+r.ts||0)>t0}).length>=VID_DAY)return err("Hôm nay bạn đã thêm đủ "+VID_DAY+" video")}
  var th=String(v.th||""),rec={id:"v"+now.toString(36)+Math.floor(Math.random()*46656).toString(36),ts:now,src:p.src,url:p.url,t:vidTxt(v.t,140),th:/^https:\/\/[^\s"'<>]{4,580}$/.test(th)?th:"",by:vidTxt(v.by||"Ẩn danh",30)||"Ẩn danh",uid:uid};
  put("Videos",rec);return{ok:true,v:{id:rec.id,ts:rec.ts,src:p.src,vid:p.vid,url:p.url,t:rec.t,th:rec.th,by:rec.by},vids:vidList()}}
 if(op==="vdel"){if(!isAd(d))return err("Chỉ Admin mới được xóa video");var id=String(d.id||""),r=all("Videos").filter(function(x){return String(x.id)===id})[0];
  if(!r)return err("Không tìm thấy video");sh("Videos").deleteRow(r._r);return{ok:true}}
 return err("Lệnh không hỗ trợ")}


/* ===================== ĐĂNG NHẬP GOOGLE · ZALO · TIKTOK =====================
   Luồng: web lấy mã đăng nhập từ nền tảng → gửi op "login" → máy chủ tự xác minh với nền tảng
   → trả về token phiên (lưu ở sheet Sessions, hết hạn sau SESSION_DAYS ngày). Chưa đăng nhập vẫn dùng theo IP như cũ.
   Người mới đăng nhập lần đầu sẽ được chuyển năng lượng/đồ/map đang có theo IP sang tài khoản. */
function sv(u){u=String(u||"");return/^https:\/\/[^\s"'<>]{4,500}$/.test(u)?u:""}
function sessH(t){return"h"+sha(t+"|"+C.SALT).slice(0,40)}
function sess(d){var t=String(d.tok||"");if(!t)return null;if(!/^[0-9a-f]{64}$/.test(t))throw new Error("AUTH");
 var h=sessH(t),s=all("Sessions").filter(function(r){return r.h===h})[0],u=s&&+s.exp>Date.now()?all("Users").filter(function(r){return r.id===s.uid})[0]:null;
 if(!u)throw new Error("AUTH");return u}
function uidOf(d){if(String(d.tok||""))return sess(d).id;return/^[0-9a-fA-F:.]{3,45}$/.test(String(d.ip||""))?"u"+sha(d.ip+"|"+C.SALT).slice(0,12):""}
function prof(p,d){var j,t,m,us;
 if(p==="google"){if(!C.GOOGLE_ID)throw new Error("Chưa bật đăng nhập Google");
  j=fj("https://oauth2.googleapis.com/tokeninfo?id_token="+encodeURIComponent(String(d.cred||"")));
  if(!j||!j.sub||j.aud!==C.GOOGLE_ID||!/accounts\.google\.com$/.test(String(j.iss)))throw new Error("Google từ chối đăng nhập");
  return{id:String(j.sub),name:j.name||String(j.email||"").split("@")[0],av:j.picture}}
 if(p==="zalo"){if(!C.ZALO_ID)throw new Error("Chưa bật đăng nhập Zalo");
  t=fj("https://oauth.zaloapp.com/v4/access_token",{method:"post",headers:{secret_key:C.ZALO_SECRET},payload:{code:String(d.code||""),app_id:C.ZALO_ID,grant_type:"authorization_code",code_verifier:String(d.ver||"")}});
  if(!t||!t.access_token)throw new Error("Zalo từ chối đăng nhập: "+cl(t&&(t.error_description||t.error_name||t.message),80));
  m=fj("https://graph.zalo.me/v2.0/me?fields=id,name,picture",{headers:{access_token:t.access_token}});
  if(!m||!m.id)throw new Error("Không lấy được thông tin Zalo");
  return{id:String(m.id),name:m.name,av:m.picture&&m.picture.data&&m.picture.data.url}}
 if(p==="tiktok"){if(!C.TT_KEY)throw new Error("Chưa bật đăng nhập TikTok");
  t=fj("https://open.tiktokapis.com/v2/oauth/token/",{method:"post",payload:{client_key:C.TT_KEY,client_secret:C.TT_SECRET,code:String(d.code||""),grant_type:"authorization_code",redirect_uri:String(d.ru||"")}});
  if(!t||!t.access_token)throw new Error("TikTok từ chối đăng nhập: "+cl(t&&(t.error_description||t.error),80));
  m=fj("https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name",{headers:{Authorization:"Bearer "+t.access_token}});
  us=m&&m.data&&m.data.user;if(!us||!us.open_id)throw new Error("Không lấy được thông tin TikTok");
  return{id:String(us.open_id),name:us.display_name,av:us.avatar_url}}
 throw new Error("Nền tảng đăng nhập không hỗ trợ")}
function moveUid(n,from,to){var s=sh(n),c=H[n].indexOf("uid")+1,L=s.getLastRow();if(!c||L<2)return;var r=s.getRange(2,c,L-1,1),v=r.getValues(),ch=0;v.forEach(function(x){if(x[0]===from){x[0]=to;ch=1}});if(ch)r.setValues(v)}
function purge(){var s=sh("Sessions"),L=s.getLastRow();if(L<2)return;var v=s.getRange(2,3,L-1,1).getValues(),now=Date.now();for(var i=v.length-1;i>=0;i--)if(+v[i][0]<now)s.deleteRow(i+2)}
function loginOp(d){var p=String(d.prov||""),f=prof(p,d),now=Date.now(),key=p+":"+f.id,idn=all("Identities").filter(function(r){return r.key===key})[0],u;
 if(d.link){var cur=sess(d);if(!cur)throw new Error("AUTH");if(idn&&idn.uid!==cur.id)return err("Tài khoản "+p+" này đã gắn với người dùng khác");
  if(!idn)put("Identities",{key:key,uid:cur.id,prov:p,ts:now});return{ok:true,linked:1,user:uv(cur,d),en:en(cur),cfg:cfg()}}
 if(idn)u=all("Users").filter(function(r){return r.id===idn.uid})[0];
 if(u){roll(u);var av=sv(f.av);if(av)u.av=av;upd("Users",u)}
 else{var id="a"+sha(key+"|"+C.SALT).slice(0,12),ipid=/^[0-9a-fA-F:.]{3,45}$/.test(String(d.ip||""))?"u"+sha(d.ip+"|"+C.SALT).slice(0,12):"",
   gs=ipid?all("Users").filter(function(r){return r.id===ipid})[0]:null,nm=cl(f.name,40);
  u={id:id,prov:p,name:nm.length>=2?nm:"Người chơi "+id.slice(1,5),av:sv(f.av),day:"",n:0,onlSec:0,onlG:0,posts:0,postRew:0,lastPing:now,bonus:0,codeBad:0,ciLast:"",ciStreak:0};
  if(gs){["day","n","onlSec","onlG","posts","postRew","bonus","codeBad","ciLast","ciStreak"].forEach(function(k){u[k]=gs[k]});if(String(gs.name||"").length>=2)u.name=gs.name; // chuyển dữ liệu IP cũ sang tài khoản
   ["Shop","Equip","Boxes","MapBuys","Downloads","Redeems","Maps","Videos"].forEach(function(n){moveUid(n,ipid,id)});
   gs.n=0;gs.bonus=0;gs.prov="ip>"+id;upd("Users",gs)}
  roll(u);put("Users",u);put("Identities",{key:key,uid:id,prov:p,ts:now})}
 var tok=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,"");purge();put("Sessions",{h:sessH(tok),uid:u.id,exp:now+C.SESSION_DAYS*864e5});
 return{ok:true,tok:tok,user:uv(u,d),en:en(u),cfg:cfg()}}
function logoutOp(d){var t=String(d.tok||"");if(/^[0-9a-f]{64}$/.test(t)){var h=sessH(t),s=all("Sessions").filter(function(r){return r.h===h})[0];if(s)sh("Sessions").deleteRow(s._r)}return{ok:true}}
