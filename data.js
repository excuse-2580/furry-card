/* ============================================================
   Furry 扩列墙 · 预设数据 + 编码/解码
   ============================================================ */

const DATA = {
  /* ---------- 常用头像 emoji ---------- */
  EMOJIS: ['🦊', '🐺', '🐱', '🐶', '🐯', '🦁', '🐻', '🐼', '🐨', '🐰',
           '🦄', '🐲', '🦅', '🦉', '🐸', '🦎', '🐍', '🦈', '🐬', '🐳',
           '🦋', '🐝', '🦔', '🐿️', '🦦', '🦥', '🐾', '🌸', '🌙', '⭐'],

  /* ---------- 性格标签 ---------- */
  TRAITS: ['活泼', '元气', '温柔', '内向', '慢热', '话痨', '安静', '傲娇',
           '呆萌', '腹黑', '热情', '社恐', '社牛', '治愈系', '中二', '成熟',
           '天真', '敏感', '乐观', '佛系'],

  /* ---------- 兴趣标签 ---------- */
  INTERESTS: ['绘画', '写作', '音乐', '游戏', '动画', 'cosplay', '手工',
              '摄影', '编程', '配音', '舞蹈', '兽装', '模型', '阅读',
              '美食', '运动', '猫猫', '狗狗'],

  /* ---------- 扩列诉求（想找什么样的兽友） ---------- */
  WANTS: ['找同类兽友', '找兽装友', '找画手约稿', '找写手搭档', '找游戏搭子',
          '找语聊伙伴', '找同好群', '单纯扩列', '找师父/学生', '找线下聚会',
          '互换名片', '找 CP / 亲友'],

  /* ---------- 在线时段快选 ---------- */
  ONLINES: ['工作日晚上', '周末全天', '全天在线', '深夜党', '早起党', '随缘'],

  /* ---------- 卡片主题色（MD3 tonal 种子色） ---------- */
  SEEDS: [
    { id: 'violet', name: '紫罗兰', c: '#7C4DFF', c2: '#B388FF' },
    { id: 'pink',   name: '樱粉',   c: '#C2185B', c2: '#F48FB1' },
    { id: 'teal',   name: '青碧',   c: '#00695C', c2: '#4DB6AC' },
    { id: 'blue',   name: '天蓝',   c: '#1565C0', c2: '#64B5F6' },
    { id: 'green',  name: '森绿',   c: '#2E7D32', c2: '#81C784' },
    { id: 'orange', name: '暖橙',   c: '#E65100', c2: '#FFB74D' },
    { id: 'brown',  name: '可可',   c: '#5D4037', c2: '#A1887F' },
    { id: 'indigo', name: '靛蓝',   c: '#3949AB', c2: '#7986CB' },
  ],

  seed(id) {
    return this.SEEDS.find(s => s.id === id) || this.SEEDS[0];
  },
};

/* ============================================================
   QQ 加好友链接
   ------------------------------------------------------------
   用 wpa.qq.com 这套公开网页入口，手机浏览器点开能直接加好友
   或发起临时会话，不需要对方装任何东西。
   QQ 号非法（非纯数字）时返回 null，绝不拼出坏链接。
   ============================================================ */
const QQ = {
  addUrl(qq) {
    const n = String(qq || '').trim();
    if (!/^\d{5,15}$/.test(n)) return null;
    return `https://wpa.qq.com/msgrd?v=3&uin=${n}&site=qq&menu=yes`;
  },
  valid(qq) { return /^\d{5,15}$/.test(String(qq || '').trim()); },
};

/* ============================================================
   分享链接编码
   ------------------------------------------------------------
   把资料压成一个紧凑对象，JSON → UTF-8 → base64url，放进 #c=
   注意：btoa 只吃 latin1，中文要先 encodeURIComponent 再转义，
   否则会抛 InvalidCharacterError。
   ============================================================ */
const Codec = {
  encode(obj) {
    const json = JSON.stringify(obj);
    const utf8 = unescape(encodeURIComponent(json));
    return btoa(utf8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(str) {
    try {
      let s = String(str).trim().replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      const bin = atob(s);
      const json = decodeURIComponent(escape(bin));
      const o = JSON.parse(json);
      return (o && typeof o === 'object') ? o : null;
    } catch (e) {
      return null;
    }
  },
  /* 只取链接里的 #c= 部分，容错掉多余的 & 参数 */
  fromHash(hash) {
    const m = String(hash || '').match(/[#&]c=([^&]+)/);
    return m ? this.decode(m[1]) : null;
  },
};

/* ============================================================
   本地存储
   ============================================================ */
const Store = {
  K_ME: 'furry.me.v1',
  K_WALL: 'furry.wall.v1',

  loadMe() {
    try { return JSON.parse(localStorage.getItem(this.K_ME)) || null; }
    catch (e) { return null; }
  },
  saveMe(o) {
    try { localStorage.setItem(this.K_ME, JSON.stringify(o)); return true; }
    catch (e) { return false; }
  },
  loadWall() {
    try { return JSON.parse(localStorage.getItem(this.K_WALL)) || []; }
    catch (e) { return []; }
  },
  saveWall(arr) {
    try { localStorage.setItem(this.K_WALL, JSON.stringify(arr)); return true; }
    catch (e) { return false; }
  },
  /* 估算占用，给设置页显示 */
  usage() {
    let n = 0;
    for (const k of [this.K_ME, this.K_WALL]) {
      const v = localStorage.getItem(k);
      if (v) n += v.length;
    }
    return n;
  },
  wipe() {
    localStorage.removeItem(this.K_ME);
    localStorage.removeItem(this.K_WALL);
  },
};
