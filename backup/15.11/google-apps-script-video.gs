/* =====================================================================
   VIDEO CHƠI: thêm vào script năng lượng (ACC_API), KHÔNG tạo script mới.
   Web gọi 3 lệnh: vlist (xem), vadd (thêm), vdel (xóa, chỉ Admin).

   CÁCH GẮN:
   1) Dán toàn bộ file này vào cuối file .gs của script ACC_API.
   2) Trong hàm doPost, ngay sau chỗ đã đọc dữ liệu gửi lên (biến d) và đã có
      cách kiểm tra Admin, thêm đoạn sau (đổi ISADMIN thành đúng điều kiện admin
      bạn đang dùng cho các lệnh như xóa map):

      if (d.op === 'vlist' || d.op === 'vadd' || d.op === 'vdel') {
        return ContentService.createTextOutput(JSON.stringify(vidOp_(d, ISADMIN)))
          .setMimeType(ContentService.MimeType.JSON);
      }

   3) Triển khai > Quản lý bản triển khai > Sửa > Phiên bản mới > Triển khai.

   Lưu ý: video lưu trong Script Properties (tối đa ~500 KB cho cả script).
   VID_MAX = 300 video là an toàn. Nếu script đã dùng Properties nhiều, hãy
   giảm VID_MAX hoặc chuyển sang lưu bằng Google Sheet.
   ===================================================================== */
var VID_MAX = 300;

function vidParse_(u) {
  u = String(u || '').trim();
  if (!u || u.length > 300) return null;
  var m;
  // YouTube
  if ((m = u.match(/^https:\/\/(?:www\.|m\.|music\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([\w-]{11})/i)) ||
      (m = u.match(/^https:\/\/youtu\.be\/([\w-]{11})/i)) ||
      (m = u.match(/^https:\/\/(?:www\.|m\.)?youtube\.com\/(?:shorts|embed|live|v)\/([\w-]{11})/i))) {
    return { src: 'yt', vid: m[1], url: 'https://www.youtube.com/watch?v=' + m[1] };
  }
  // TikTok
  if ((m = u.match(/^(https:\/\/(?:[\w-]+\.)?tiktok\.com\/[^?#\s]*\/video\/(\d{8,25}))/i))) {
    return { src: 'tt', vid: m[2], url: m[1].replace(/\/+$/, '') };
  }
  if ((m = u.match(/^(https:\/\/(?:vm|vt)\.tiktok\.com\/[\w-]+)/i)) ||
      (m = u.match(/^(https:\/\/(?:www\.)?tiktok\.com\/t\/[\w-]+)/i))) {
    return { src: 'tt', vid: '', url: m[1] };
  }
  return null;
}

function vidAll_(P) {
  var all = P.getProperties(), out = [];
  for (var k in all) {
    if (k.indexOf('vid:') !== 0) continue;
    try { out.push(JSON.parse(all[k])); } catch (e) {}
  }
  out.sort(function (a, b) { return b.ts - a.ts; });
  return out;
}

function vidOp_(d, isAdmin) {
  var P = PropertiesService.getScriptProperties();

  if (d.op === 'vlist') return { ok: true, vids: vidAll_(P) };

  if (d.op === 'vadd') {
    var v = d.v || {}, p = vidParse_(v.url);
    if (!p) return { ok: false, err: 'Link không hợp lệ (chỉ nhận YouTube hoặc TikTok)' };
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var all = vidAll_(P);
      if (all.some(function (x) { return x.url === p.url; }))
        return { ok: false, err: 'Video này đã có trong danh sách rồi' };
      if (all.length >= VID_MAX)
        return { ok: false, err: 'Danh sách video đã đầy, nhờ Admin dọn bớt' };
      var rec = {
        id: 'v' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36),
        src: p.src, vid: p.vid, url: p.url,
        t: String(v.t || '').slice(0, 140),
        th: /^https:\/\//.test(String(v.th || '')) ? String(v.th).slice(0, 600) : '',
        by: String(v.by || 'Ẩn danh').slice(0, 30),
        ts: Date.now()
      };
      P.setProperty('vid:' + rec.id, JSON.stringify(rec));
      return { ok: true, v: rec, vids: vidAll_(P) };
    } finally {
      lock.releaseLock();
    }
  }

  if (d.op === 'vdel') {
    if (!isAdmin) return { ok: false, err: 'Chỉ Admin mới được xóa video' };
    var id = String(d.id || '');
    if (!/^[\w-]{1,40}$/.test(id)) return { ok: false, err: 'Mã video không hợp lệ' };
    P.deleteProperty('vid:' + id);
    return { ok: true };
  }

  return { ok: false, err: 'Lệnh không hỗ trợ' };
}
