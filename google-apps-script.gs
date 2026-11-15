/* =====================================================================
   MÁY CHỦ BÌNH LUẬN · LƯỢT TẢI · SAO · BÌNH CHỌN THÁNG  (API_URL)
   CÀI ĐẶT:
   1. Mở Google Sheet riêng (hoặc dự án Apps Script "Dự án không có tiêu đề")
      → Tiện ích mở rộng → Apps Script → xóa mã cũ, dán toàn bộ file này → Ctrl+S.
   2. Triển khai → Bản triển khai mới → Loại: Ứng dụng web
      Thực thi: Tôi · Truy cập: Bất kỳ ai → Triển khai → cấp quyền.
   3. Copy link /exec dán vào API_URL trong index.html.
   Sau này sửa code: Triển khai → Quản lý bản triển khai → bút chì → Phiên bản mới.
   ===================================================================== */
var HEAD = {
  BinhLuan: ["id", "ts", "ten", "map", "noidung"],
  Dem: ["ts", "loai", "key", "val", "ip"]
};
var ADMIN_KEY = "250319"; // PHẢI GIỐNG mã admin trong script năng lượng; chỉ admin mới xóa được bình luận
var MAX_CMT = 300; // số bình luận mới nhất trả về cho web

function sheet_(name) {
  var ss = SpreadsheetApp.getActive();
  var s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); s.appendRow(HEAD[name]); }
  return s;
}

function rows_(name) {
  var v = sheet_(name).getDataRange().getValues();
  var h = v.shift();
  return v.map(function (r) {
    var o = {};
    h.forEach(function (k, j) { o[k] = r[j]; });
    return o;
  });
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function clean_(s, n) {
  return String(s == null ? "" : s).replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n);
}

/* GET:
   (không tham số)        → {BinhLuan:[...], Dem:[...]}  (web tự tính sao, tải, bình chọn)
   ?chk=<ip>&m=<2026-11>  → {v:"tên map đã chọn"} hoặc {v:""} */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.chk) {
    var val = "m" + p.m, v = "";
    rows_("Dem").some(function (r) {
      if (r.loai === "vt" && r.val === val && String(r.ip) === String(p.chk)) { v = r.key; return true; }
      return false;
    });
    return out_({ v: v });
  }
  var cmt = rows_("BinhLuan").slice(-MAX_CMT);
  var dem = rows_("Dem").map(function (r) {
    return { ts: r.ts, loai: r.loai, key: r.key, val: r.val }; // không gửi ip ra ngoài
  });
  return out_({ BinhLuan: cmt, Dem: dem });
}

/* POST: {sh:"BinhLuan", row:{id,ts,ten,map,noidung}}
         {sh:"Dem", row:{ts,loai:"dl|rt|vt",key,val,ip?}} */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var d = JSON.parse(e.postData.contents), r = d.row || {};
    if (d.op === "delcmt") { // admin xóa bình luận theo id
      if (!ADMIN_KEY || String(d.ak) !== ADMIN_KEY) return out_({ ok: 0, err: "Sai mã admin, không được xóa" });
      var sh = sheet_("BinhLuan"), ids = sh.getDataRange().getValues();
      for (var i = ids.length - 1; i >= 1; i--) {
        if (String(ids[i][0]) === String(d.id)) { sh.deleteRow(i + 1); return out_({ ok: 1 }); }
      }
      return out_({ ok: 0, err: "Không tìm thấy bình luận (có thể đã bị xóa)" });
    }
    if (d.sh === "BinhLuan") {
      var nd = clean_(r.noidung, 400);
      if (nd.length < 3) return out_({ ok: 0, err: "Bình luận quá ngắn" });
      sheet_("BinhLuan").appendRow([
        clean_(r.id, 40), Number(r.ts) || Date.now(),
        clean_(r.ten, 30), clean_(r.map, 80), nd
      ]);
      return out_({ ok: 1 });
    }
    if (d.sh === "Dem") {
      var loai = clean_(r.loai, 4);
      if (["dl", "rt", "vt"].indexOf(loai) < 0) return out_({ ok: 0, err: "loai không hợp lệ" });
      var key = clean_(r.key, 100), val = clean_(r.val, 40), ip = clean_(r.ip, 64);
      if (loai === "vt" && ip) { // mỗi IP 1 phiếu / tháng
        var dup = rows_("Dem").some(function (x) {
          return x.loai === "vt" && x.val === val && String(x.ip) === ip;
        });
        if (dup) return out_({ ok: 0, err: "Bạn đã bình chọn tháng này" });
      }
      sheet_("Dem").appendRow([Number(r.ts) || Date.now(), loai, key, val, ip]);
      return out_({ ok: 1 });
    }
    return out_({ ok: 0, err: "Thao tác không hợp lệ" });
  } catch (x) {
    return out_({ ok: 0, err: String(x.message || x) });
  } finally {
    lock.releaseLock();
  }
}
