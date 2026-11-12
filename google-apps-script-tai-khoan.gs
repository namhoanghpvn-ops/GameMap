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
 MYST:2,       // hộp map bí ẩn tốn
 SHOP:{fr1:6,fr2:6,fr3:12,fr4:20,co1:4,co2:4,co3:8,co4:15,ic1:3,ic2:5,ic3:8,ic4:10,ic5:15}, // GIÁ CỬA HÀNG ⚡ (máy chủ tự kiểm tra giá, không tin số web gửi lên)
 TZ:"Asia/Ho_Chi_Minh"};
var H={Users:["id","prov","name","av","day","n","onlSec","onlG","posts","postRew","lastPing","bonus","codeBad"],
 Sessions:["h","uid","exp"],Maps:["id","ts","uid","by","av","t","p","d","s","u","img","st"],Downloads:["ts","uid","mid"],
 Shop:["ts","uid","item","price"],Equip:["uid","by","fr","co","ic","ts"],Boxes:["ts","uid","map"],
 Codes:["code","energy","max","exp","note"],Redeems:["ts","uid","code"],
 Config:["k","v"],SMaps:["id","ts","t","p","d","s","u","st"],MapBuys:["ts","uid","key","title","price"]};
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
function khoiTao(){["Shop","Equip","Boxes","Codes","Redeems","Config","SMaps","MapBuys"].forEach(sh);Logger.log("Đã tạo xong các sheet")} // chạy 1 lần trong trình soạn thảo để tạo sẵn sheet Codes
function isAd(d){return!!C.ADMIN_KEY&&d.ak===C.ADMIN_KEY}
function uv(u,d){return{id:u.id,admin:isAd(d),name:String(u.name||"")}}
function who(ip,mk){if(!/^[0-9a-fA-F:.]{3,45}$/.test(String(ip||"")))throw new Error("Không xác định được IP");
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
function smaps(){return all("SMaps").filter(function(m){return m.st==="on"}).map(function(m){return{id:m.id,ts:new Date(+m.ts).toISOString(),t:m.t,p:+m.p,d:m.d,s:m.s,u:m.u}})}
function mbOwned(uid){var a=all("MapBuys").filter(function(r){return r.uid===uid}).map(function(r){return String(r.key)});all("Boxes").forEach(function(r){if(r.uid===uid&&r.map)a.push(mk(r.map))});return a}
function doGet(){return J(pub(null))}
function doPost(e){var l=LockService.getScriptLock();l.waitLock(25000);try{return J(run(JSON.parse(e.postData.contents)))}catch(x){return J(err(String(x.message||x)))}finally{l.releaseLock()}}
function pub(u){var dl={},t0=new Date(en({n:0}).resetAt-864e5).getTime(),now=Date.now(),got={};
 all("Downloads").forEach(function(r){var o=dl[r.mid]||(dl[r.mid]={a:0,b:0,c:0});o.a++;if(+r.ts>=t0)o.b++;if(+r.ts>=now-6048e5)o.c++;if(u&&r.uid===u.id)got[r.mid]=1});
 return{ok:true,maps:all("Maps").filter(function(m){return m.st==="on"}).reverse().slice(0,500).map(function(m){var o=dl[m.id]||{a:0,b:0,c:0};
  return{id:m.id,ts:new Date(+m.ts).toISOString(),by:m.by,av:m.av,t:m.t,p:+m.p,d:m.d,s:m.s,img:m.img,dl:o.a,dl1:o.b,dl7:o.c,got:!!got[m.id],own:!!u&&m.uid===u.id}})}}
function run(d){var op=d.op,u=who(d.ip,op!=="maps");if(op==="maps")return pub(u);
 if(op==="cos"){var cs={};all("Equip").forEach(function(r){if(r.fr||r.co||r.ic)cs[String(r.by).toLowerCase()]={fr:String(r.fr||""),co:String(r.co||""),ic:String(r.ic||"")}});return{ok:true,cos:cs,own:owned(u.id),box:all("Boxes").filter(function(r){return r.uid===u.id&&r.map}).map(function(r){return String(r.map)}),mp:mcfg(),ms:smaps(),mb:mbOwned(u.id)}}
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
 else if(op==="setname"){var nn=cl(d.name,40);if(nn.length<2)return err("Tên quá ngắn (ít nhất 2 ký tự)");u.name=nn}
 else if(op!=="me")return err("Thao tác không hợp lệ");
 upd("Users",u);res.user=uv(u,d);res.en=en(u);res.cfg=cfg();return res}
