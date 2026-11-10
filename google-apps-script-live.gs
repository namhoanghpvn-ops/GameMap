/**
 * LƯU DANH SÁCH LIVE TIKTOK DÙNG CHUNG CHO WEB "GÓC GAME"
 *
 * CÁCH CÀI (khoảng 3 phút, làm giống script bình luận cũ):
 * 1. Vào https://script.google.com → Dự án mới → dán toàn bộ file này vào, đặt tên "Live TikTok".
 * 2. Sửa ADMIN_KEY bên dưới thành mật khẩu admin của bạn (nên trùng khóa admin bạn đang dùng trên web).
 * 3. Triển khai → Triển khai mới → loại «Ứng dụng web»
 *      Thực thi với tư cách: Tôi
 *      Ai có quyền truy cập: Bất kỳ ai
 *    Cấp quyền khi được hỏi (script tự tạo sheet «Live» trong 1 Google Sheet mới).
 * 4. Chép link Web App (đuôi /exec) dán vào biến LIVE_API trong index.html.
 * Mỗi lần sửa script phải «Quản lý bản triển khai → Chỉnh sửa → Phiên bản mới».
 */
var ADMIN_KEY = "ĐỔI_THÀNH_MẬT_KHẨU_ADMIN";
var TTL_H = 6;            // nên bằng LIVE_TTL_H trong index.html
var MAX_ACTIVE = 60;      // tối đa số live hiện cùng lúc
var MAX_PER_HOUR = 4;     // mỗi người (theo mã trên trình duyệt) đăng tối đa bấy nhiêu lần / giờ
var SHEET = "Live";
var HEAD = ["id", "ts", "u", "t", "g", "by", "tok", "end"];

function sheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("SSID"), ss;
  if (id) { ss = SpreadsheetApp.openById(id); }
  else { ss = SpreadsheetApp.create("Live TikTok - Góc game"); props.setProperty("SSID", ss.getId()); }
  var sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  if (sh.getLastRow() === 0) sh.appendRow(HEAD);
  return sh;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function rows_(sh) {
  var n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, HEAD.length).getValues().map(function (r, i) {
    return { row: i + 2, id: String(r[0]), ts: +r[1], u: String(r[2]), t: String(r[3]), g: String(r[4]), by: String(r[5]), tok: String(r[6]), end: r[7] === true || r[7] === "TRUE" || r[7] === 1 };
  });
}
function active_(x) { return !x.end && x.ts > Date.now() - TTL_H * 3600000; }

// Trả danh sách live đang hoạt động. Không lộ mã tok, chỉ báo "mine" cho đúng người đăng.
function doGet(e) {
  var tok = (e && e.parameter && e.parameter.tok) || "";
  var list = rows_(sheet_()).filter(active_).sort(function (a, b) { return b.ts - a.ts; }).slice(0, MAX_ACTIVE)
    .map(function (x) { return { id: x.id, ts: x.ts, u: x.u, t: x.t, g: x.g, by: x.by, mine: !!tok && x.tok === tok }; });
  return out_({ ok: true, lives: list });
}

function doPost(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var d = JSON.parse(e.postData.contents), sh = sheet_(), all = rows_(sh), tok = String(d.tok || "").slice(0, 60);
    if (!tok) return out_({ ok: false, err: "Thiếu mã trình duyệt." });

    if (d.op === "add") {
      var r = d.row || {}, u = String(r.u || "").replace(/^@/, "");
      if (!/^[A-Za-z0-9._]{2,24}$/.test(u)) return out_({ ok: false, err: "Username TikTok không hợp lệ." });
      var t = String(r.t || "").replace(/[\r\n<>]/g, " ").trim().slice(0, 60);
      if (t.length < 3) return out_({ ok: false, err: "Tiêu đề quá ngắn." });
      var g = String(r.g || "").replace(/[\r\n<>]/g, " ").trim().slice(0, 40);
      var hourAgo = Date.now() - 3600000;
      if (all.filter(function (x) { return x.tok === tok && x.ts > hourAgo; }).length >= MAX_PER_HOUR)
        return out_({ ok: false, err: "Bạn đăng quá nhiều lần trong 1 giờ, thử lại sau." });
      var dup = all.filter(function (x) { return active_(x) && x.u.toLowerCase() === u.toLowerCase(); })[0];
      if (dup) {
        if (dup.tok !== tok) return out_({ ok: false, err: "Live của @" + u + " đã được chia sẻ rồi." });
        sh.getRange(dup.row, 2, 1, 5).setValues([[Date.now(), u, t, g, u]]);   // cùng người đăng lại: làm mới
        return out_({ ok: true, id: dup.id });
      }
      if (all.filter(active_).length >= MAX_ACTIVE) return out_({ ok: false, err: "Danh sách live đang đầy, thử lại sau." });
      var id = "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      sh.appendRow([id, Date.now(), u, t, g, u, tok, false]);
      return out_({ ok: true, id: id });
    }

    var x = all.filter(function (y) { return y.id === String(d.id || ""); })[0];
    if (!x) return out_({ ok: false, err: "Không tìm thấy live này (có thể đã hết hạn)." });

    // Chỉ Admin được kết thúc live sớm (người đăng và người xem đều không thể). Live còn lại tự hết hạn sau TTL_H giờ.
    if (d.op === "end" || d.op === "del") {
      if (!d.ak || d.ak !== ADMIN_KEY) return out_({ ok: false, err: "Chỉ Admin mới được kết thúc live." });
      sh.getRange(x.row, 8).setValue(true);
      return out_({ ok: true });
    }
    return out_({ ok: false, err: "Thao tác không hợp lệ." });
  } catch (err) {
    return out_({ ok: false, err: "Lỗi máy chủ: " + err });
  } finally { lock.releaseLock(); }
}
