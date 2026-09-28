/* ============================================================
   Furry 扩列墙 · 应用逻辑
   ============================================================ */

const App = {
  me: null,
  wall: [],
  view: 'card',

  /* ---------- 空白资料 ---------- */
  blank() {
    return {
      name: '', species: '', emoji: '🦊',
      traits: [], interests: [],
      age: '', height: '', color: '', bio: '',
      qq: '', contact: '', hideContact: false,
      wants: [], online: '', group: '',
      seed: 'violet',
    };
  },

  init() {
    this.me = Store.loadMe() || this.blank();
    this.wall = Store.loadWall();

    const savedTh = localStorage.getItem('furry.theme');
    if (savedTh) document.documentElement.setAttribute('data-theme', savedTh);

    this.applySeed(this.me.seed || 'violet');
    this.renderPickers();
    this.fillForm(this.me);
    this.renderCard();
    this.renderWall();
    this.bind();

    // 带分享链接进来 → 直接展示对方名片并提示收藏
    const shared = Codec.fromHash(location.hash);
    if (shared) this.showShared(shared);
  },

  /* ============================================================
     绑定
     ============================================================ */
  bind() {
    // 主题
    document.getElementById('themeBtn').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('furry.theme', next);
      this.syncThemePick();
    });
    document.querySelectorAll('#themePick button').forEach(b =>
      b.addEventListener('click', () => {
        document.documentElement.setAttribute('data-theme', b.dataset.v);
        localStorage.setItem('furry.theme', b.dataset.v);
        this.syncThemePick();
      }));
    this.syncThemePick();

    // 视图切换
    document.querySelectorAll('.tab').forEach(b =>
      b.addEventListener('click', () => this.go(b.dataset.view)));

    // 表单输入 → 实时更新预览
    const IDS = ['iName', 'iSpecies', 'iEmoji', 'iAge', 'iHeight', 'iColor', 'iBio',
                 'iQQ', 'iContact', 'iOnline', 'iGroup'];
    IDS.forEach(id => {
      const el = document.getElementById(id);
      el.addEventListener('input', () => { this.readForm(); this.renderCard(); });
    });
    document.getElementById('iHideContact').addEventListener('change', () => {
      this.readForm(); this.renderCard();
    });
    document.getElementById('iBio').addEventListener('input', () => {
      document.getElementById('bioCount').textContent =
        document.getElementById('iBio').value.length;
    });

    // 自定义标签回车添加
    const ct = document.getElementById('iCustomTag');
    ct.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = ct.value.trim();
      if (!v) return;
      if (!this.me.interests.includes(v)) this.me.interests.push(v);
      ct.value = '';
      this.renderPickers();
      this.renderCard();
    });

    // 保存 / 加墙 / 清空
    document.getElementById('btnSave').addEventListener('click', () => {
      this.readForm();
      if (!this.me.name.trim()) { this.toast('先填个兽设名吧'); return; }
      Store.saveMe(this.me);
      this.toast('已保存到本机');
    });
    document.getElementById('btnAddToWall').addEventListener('click', () => {
      this.readForm();
      if (!this.me.name.trim()) { this.toast('先填个兽设名吧'); return; }
      /* 顺手把名片本身也存了：用户填完资料直接点加墙是常见路径，
         不存的话一刷新填写的内容就没了。 */
      Store.saveMe(this.me);
      this.addToWall({ ...this.me, mine: true });
      this.toast('已加入扩列墙');
      this.go('wall');
    });
    document.getElementById('btnClear').addEventListener('click', () => {
      if (!confirm('确定清空名片内容？')) return;
      this.me = this.blank();
      this.fillForm(this.me);
      this.applySeed('violet');
      this.renderPickers();
      this.renderCard();
      this.toast('已清空');
    });

    // 导出图片 / 分享
    document.getElementById('btnExport').addEventListener('click', () => this.exportPng());
    document.getElementById('btnShare').addEventListener('click', () => this.openShare());

    // 分享弹层
    document.getElementById('shareClose').addEventListener('click', () => {
      document.getElementById('shareSheet').hidden = true;
    });
    document.getElementById('shareSheet').addEventListener('click', (e) => {
      if (e.target.id === 'shareSheet') document.getElementById('shareSheet').hidden = true;
    });
    document.getElementById('btnCopyUrl').addEventListener('click', () => {
      const ta = document.getElementById('shareUrl');
      this.copy(ta.value, '链接已复制');
    });
    document.getElementById('btnCopyText').addEventListener('click', () => {
      this.copy(this.plainText(this.me), '纯文本版已复制');
    });

    // 导入
    document.getElementById('btnImport').addEventListener('click', () => {
      document.getElementById('importSheet').hidden = false;
      document.getElementById('importErr').hidden = true;
      document.getElementById('importUrl').value = '';
    });
    document.getElementById('importClose').addEventListener('click', () => {
      document.getElementById('importSheet').hidden = true;
    });
    document.getElementById('importSheet').addEventListener('click', (e) => {
      if (e.target.id === 'importSheet') document.getElementById('importSheet').hidden = true;
    });
    document.getElementById('btnDoImport').addEventListener('click', () => {
      const v = document.getElementById('importUrl').value.trim();
      const err = document.getElementById('importErr');
      const o = Codec.fromHash(v) || Codec.decode(v);
      if (!o || !o.name) {
        err.textContent = '这段链接里没有有效的名片数据，检查一下是不是复制全了。';
        err.hidden = false;
        return;
      }
      this.addToWall(o);
      document.getElementById('importSheet').hidden = true;
      this.toast(`已收藏 ${o.name}`);
    });

    // 扩列墙
    document.getElementById('btnAddMine').addEventListener('click', () => {
      if (!this.me.name.trim()) { this.toast('先去「我的名片」填一下资料'); this.go('card'); return; }
      Store.saveMe(this.me);
      this.addToWall({ ...this.me, mine: true });
      this.toast('已加入扩列墙');
    });
    document.getElementById('wallSearch').addEventListener('input', () => this.renderWall());

    // 数据管理
    document.getElementById('btnExportJson').addEventListener('click', () => this.exportJson());
    document.getElementById('btnImportJson').addEventListener('click', () =>
      document.getElementById('jsonFile').click());
    document.getElementById('jsonFile').addEventListener('change', (e) => this.importJson(e));
    document.getElementById('btnWipe').addEventListener('click', () => {
      if (!confirm('确定清空全部数据？我的名片和扩列墙都会消失，且无法恢复。')) return;
      Store.wipe();
      this.me = this.blank();
      this.wall = [];
      this.fillForm(this.me);
      this.renderCard();
      this.renderWall();
      this.updateStat();
      this.toast('已清空全部数据');
    });

    this.updateStat();
  },

  /* ============================================================
     表单 ↔ 数据
     ============================================================ */
  readForm() {
    this.me.name = document.getElementById('iName').value;
    this.me.species = document.getElementById('iSpecies').value;
    this.me.emoji = document.getElementById('iEmoji').value.trim() || '🦊';
    this.me.age = document.getElementById('iAge').value;
    this.me.height = document.getElementById('iHeight').value;
    this.me.color = document.getElementById('iColor').value;
    this.me.bio = document.getElementById('iBio').value;
    this.me.qq = document.getElementById('iQQ').value.trim();
    this.me.contact = document.getElementById('iContact').value;
    this.me.hideContact = document.getElementById('iHideContact').checked;
    this.me.online = document.getElementById('iOnline').value;
    this.me.group = document.getElementById('iGroup').value;
    this.syncQqHint();
  },

  /* QQ 号合法性提示：非法就不生成加好友链接，避免拼出坏地址 */
  syncQqHint() {
    const el = document.getElementById('qqHint');
    if (!el) return;
    const v = this.me.qq;
    if (!v) { el.textContent = '可留空'; el.className = 'hintline'; return; }
    if (QQ.valid(v)) { el.textContent = '✓ 对方点名片上的 QQ 就能加你好友'; el.className = 'hintline ok'; }
    else { el.textContent = 'QQ 号应为 5-15 位数字，当前不会生成加好友链接'; el.className = 'hintline warn'; }
  },

  fillForm(m) {
    document.getElementById('iName').value = m.name || '';
    document.getElementById('iSpecies').value = m.species || '';
    document.getElementById('iEmoji').value = m.emoji || '🦊';
    document.getElementById('iAge').value = m.age || '';
    document.getElementById('iHeight').value = m.height || '';
    document.getElementById('iColor').value = m.color || '';
    document.getElementById('iBio').value = m.bio || '';
    document.getElementById('iQQ').value = m.qq || '';
    document.getElementById('iContact').value = m.contact || '';
    document.getElementById('iHideContact').checked = !!m.hideContact;
    document.getElementById('iOnline').value = m.online || '';
    document.getElementById('iGroup').value = m.group || '';
    document.getElementById('bioCount').textContent = (m.bio || '').length;
  },

  /* ============================================================
     选择器
     ============================================================ */
  renderPickers() {
    // emoji
    const ep = document.getElementById('emojiPick');
    ep.innerHTML = DATA.EMOJIS.map(e =>
      `<button data-e="${e}" class="${this.me.emoji === e ? 'on' : ''}">${e}</button>`).join('');
    ep.querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => {
        this.me.emoji = b.dataset.e;
        document.getElementById('iEmoji').value = b.dataset.e;
        this.renderPickers(); this.renderCard();
      }));

    // 性格
    const tp = document.getElementById('traitPick');
    tp.innerHTML = DATA.TRAITS.map(t =>
      `<button data-t="${t}" class="${this.me.traits.includes(t) ? 'on' : ''}">${t}</button>`).join('');
    tp.querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => {
        const t = b.dataset.t;
        const i = this.me.traits.indexOf(t);
        if (i >= 0) this.me.traits.splice(i, 1); else this.me.traits.push(t);
        this.renderPickers(); this.renderCard();
      }));

    // 兴趣
    const ip = document.getElementById('interestPick');
    const all = DATA.INTERESTS.concat(this.me.interests.filter(x => !DATA.INTERESTS.includes(x)));
    ip.innerHTML = all.map(t =>
      `<button data-t="${this.esc(t)}" class="${this.me.interests.includes(t) ? 'on' : ''}">${this.esc(t)}</button>`).join('');
    ip.querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => {
        const t = b.dataset.t;
        const i = this.me.interests.indexOf(t);
        if (i >= 0) this.me.interests.splice(i, 1); else this.me.interests.push(t);
        this.renderPickers(); this.renderCard();
      }));

    // 在线时段快选（点一下填进输入框）
    const op = document.getElementById('onlinePick');
    if (op) {
      op.innerHTML = DATA.ONLINES.map(o =>
        `<button data-o="${this.esc(o)}" class="${this.me.online === o ? 'on' : ''}">${this.esc(o)}</button>`).join('');
      op.querySelectorAll('button').forEach(b =>
        b.addEventListener('click', () => {
          this.me.online = b.dataset.o;
          document.getElementById('iOnline').value = b.dataset.o;
          this.renderPickers(); this.renderCard();
        }));
    }

    // 扩列诉求
    const wp = document.getElementById('wantPick');
    if (wp) {
      const allW = DATA.WANTS.concat((this.me.wants || []).filter(x => !DATA.WANTS.includes(x)));
      wp.innerHTML = allW.map(t =>
        `<button data-t="${this.esc(t)}" class="${(this.me.wants || []).includes(t) ? 'on' : ''}">${this.esc(t)}</button>`).join('');
      wp.querySelectorAll('button').forEach(b =>
        b.addEventListener('click', () => {
          const v = b.dataset.t;
          this.me.wants = this.me.wants || [];
          const i = this.me.wants.indexOf(v);
          if (i >= 0) this.me.wants.splice(i, 1); else this.me.wants.push(v);
          this.renderPickers(); this.renderCard();
        }));
    }

    // 种子色
    const sp = document.getElementById('seedPick');
    sp.innerHTML = DATA.SEEDS.map(s =>
      `<button data-s="${s.id}" class="${this.me.seed === s.id ? 'on' : ''}"
        style="background:linear-gradient(135deg,${s.c},${s.c2})" title="${s.name}"></button>`).join('');
    sp.querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => {
        this.me.seed = b.dataset.s;
        this.applySeed(b.dataset.s);
        this.renderPickers();
      }));
  },

  applySeed(id) {
    const s = DATA.seed(id);
    document.documentElement.style.setProperty('--seed', s.c);
    document.documentElement.style.setProperty('--seed2', s.c2);
    document.documentElement.setAttribute('data-seed', s.id);
  },

  syncThemePick() {
    const cur = document.documentElement.getAttribute('data-theme');
    document.querySelectorAll('#themePick button').forEach(b =>
      b.classList.toggle('on', b.dataset.v === cur));
  },

  /* ============================================================
     名片渲染
     ============================================================ */
  renderCard(m) {
    const d = m || this.me;
    const s = DATA.seed(d.seed);
    const cv = document.getElementById('fcCover');
    cv.style.background = `linear-gradient(135deg, ${s.c}, ${s.c2})`;

    document.getElementById('fcAvatar').textContent = d.emoji || '🦊';
    document.getElementById('fcName').textContent = d.name || '未命名';
    document.getElementById('fcSpecies').textContent = d.species || '未填写兽种';

    const tags = (d.traits || []).map(t => `<span class="chip">${this.esc(t)}</span>`)
      .concat((d.interests || []).map(t => `<span class="chip alt">${this.esc(t)}</span>`));
    document.getElementById('fcTags').innerHTML = tags.join('');

    document.getElementById('fcBio').textContent = d.bio || '';

    // 扩列诉求作为第三类标签展示
    const wantTags = (d.wants || []).map(t => `<span class="chip want">${this.esc(t)}</span>`);
    document.getElementById('fcTags').insertAdjacentHTML('beforeend', wantTags.join(''));

    const rows = [];
    if (d.age) rows.push(['年龄', d.age]);
    if (d.height) rows.push(['身高', d.height]);
    if (d.color) rows.push(['毛色', d.color]);
    if (d.online) rows.push(['在线', d.online]);
    if (d.group) rows.push(['常驻群', d.group]);
    if (!d.hideContact) {
      if (d.qq) rows.push(['QQ', d.qq]);
      if (d.contact) rows.push(['其他', d.contact]);
    }
    document.getElementById('fcRows').innerHTML = rows.map(([k, v]) =>
      `<div class="fcard__row"><div class="fcard__row-k">${this.esc(k)}</div>
       <div class="fcard__row-v">${this.esc(v)}</div></div>`).join('');

    // QQ 加好友按钮：只有填了合法 QQ 且未隐藏时才出现
    const qbox = document.getElementById('fcQq');
    if (qbox) {
      const u = QQ.addUrl(d.qq);
      qbox.innerHTML = (u && !d.hideContact)
        ? `<a class="qqbtn" href="${u}" target="_blank" rel="noopener noreferrer">加 QQ 好友 · ${this.esc(d.qq)}</a>`
        : '';
      qbox.hidden = !(u && !d.hideContact);
    }

    document.getElementById('fcFoot').textContent =
      d.hideContact ? '用 Furry 扩列墙制作 · 联系方式已隐藏' : '用 Furry 扩列墙制作';
  },

  /* ============================================================
     扩列墙
     ============================================================ */
  addToWall(o) {
    // 同名则覆盖（去掉 mine 标记，避免重复条目）
    const clean = { ...o };
    delete clean.mine;
    const i = this.wall.findIndex(x => x.name === clean.name);
    if (i >= 0) this.wall[i] = clean;
    else this.wall.push(clean);
    Store.saveWall(this.wall);
    this.renderWall();
    this.updateStat();
  },

  renderWall() {
    const q = document.getElementById('wallSearch').value.trim().toLowerCase();
    const list = this.wall.filter(x => {
      if (!q) return true;
      return (x.name || '').toLowerCase().includes(q)
        || (x.species || '').toLowerCase().includes(q)
        || (x.traits || []).some(t => t.toLowerCase().includes(q))
        || (x.interests || []).some(t => t.toLowerCase().includes(q));
    });

    document.getElementById('wallCount').textContent = this.wall.length;
    const empty = document.getElementById('wallEmpty');
    const box = document.getElementById('wall');
    empty.hidden = this.wall.length > 0;
    if (!list.length) { box.innerHTML = ''; return; }

    box.innerHTML = list.map((x, idx) => {
      const s = DATA.seed(x.seed);
      const tags = (x.traits || []).slice(0, 3).concat((x.interests || []).slice(0, 3))
        .map(t => `<span>${this.esc(t)}</span>`).join('');
      const wants = (x.wants || []).slice(0, 3).map(t => `<span class="want">${this.esc(t)}</span>`).join('');
      const qqUrl = QQ.addUrl(x.qq);
      return `<div class="wcard" data-i="${idx}">
        <div class="wcard__hd" style="--c1:${s.c};--c2:${s.c2}">
          <div class="wcard__ava">${this.esc(x.emoji || '🦊')}</div>
        </div>
        <div class="wcard__bd">
          <div class="wcard__nm">${this.esc(x.name || '未命名')}</div>
          <div class="wcard__sp">${this.esc(x.species || '')}</div>
          ${tags ? `<div class="wcard__tags">${tags}</div>` : ''}
          ${wants ? `<div class="wcard__tags">${wants}</div>` : ''}
          ${x.bio ? `<div class="wcard__bio">${this.esc(x.bio)}</div>` : ''}
          ${(!x.hideContact && (x.qq || x.contact))
            ? `<div class="wcard__meta">${this.esc(x.qq ? 'QQ ' + x.qq : '')}${x.qq && x.contact ? ' · ' : ''}${this.esc(x.contact || '')}</div>` : ''}
          ${(qqUrl && !x.hideContact)
            ? `<a class="qqbtn" href="${qqUrl}" target="_blank" rel="noopener noreferrer" style="margin-top:10px">加 QQ 好友</a>` : ''}
        </div>
        <div class="wcard__act">
          <button data-act="share" data-i="${idx}">分享</button>
          <button data-act="copy" data-i="${idx}">复制资料</button>
          <button data-act="del" data-i="${idx}" class="danger">删除</button>
        </div>
      </div>`;
    }).join('');

    box.querySelectorAll('[data-act]').forEach(b =>
      b.addEventListener('click', () => {
        const i = +b.dataset.i;
        const name = list[i].name;
        if (b.dataset.act === 'share') {
          this.copy(this.shareUrl(list[i]), `已复制 ${name} 的分享链接`);
        } else if (b.dataset.act === 'copy') {
          this.copy(this.plainText(list[i]), `已复制 ${name} 的资料`);
        } else if (b.dataset.act === 'del') {
          if (!confirm(`确定把「${name}」从扩列墙移除？`)) return;
          const real = this.wall.findIndex(x => x.name === name);
          if (real >= 0) this.wall.splice(real, 1);
          Store.saveWall(this.wall);
          this.renderWall();
          this.updateStat();
          this.toast(`已移除 ${name}`);
        }
      }));
  },

  /* ---------- 收到分享链接 ---------- */
  showShared(o) {
    this.renderCard(o);
    document.getElementById('view-card').hidden = false;
    this.go('card');
    const nm = o.name || '这位兽友';
    setTimeout(() => {
      if (confirm(`收到「${nm}」的扩列名片。要收藏到你的扩列墙吗？`)) {
        this.addToWall(o);
        this.toast(`已收藏 ${nm}`);
        // 清掉 hash，避免刷新重复弹
        history.replaceState(null, '', location.pathname + location.search);
      }
    }, 300);
  },

  /* ============================================================
     分享 / 导出
     ============================================================ */
  shareUrl(m) {
    const d = m || this.me;
    const payload = {
      name: d.name, species: d.species, emoji: d.emoji,
      traits: d.traits, interests: d.interests,
      wants: d.wants, online: d.online, group: d.group,
      age: d.age, height: d.height, color: d.color, bio: d.bio,
      seed: d.seed,
    };
    if (!d.hideContact) { payload.qq = d.qq; payload.contact = d.contact; }
    payload.hideContact = !!d.hideContact;
    const base = location.origin + location.pathname;
    return `${base}#c=${Codec.encode(payload)}`;
  },

  openShare() {
    this.readForm();
    if (!this.me.name.trim()) { this.toast('先填个兽设名吧'); return; }
    document.getElementById('shareUrl').value = this.shareUrl(this.me);
    document.getElementById('shareSheet').hidden = false;
  },

  plainText(m) {
    const d = m || this.me;
    const L = [];
    L.push(`【兽设名片】${d.name || '未命名'}`);
    if (d.species) L.push(`兽种：${d.species}`);
    if ((d.traits || []).length) L.push(`性格：${d.traits.join('、')}`);
    if ((d.interests || []).length) L.push(`兴趣：${d.interests.join('、')}`);
    if ((d.wants || []).length) L.push(`想找：${d.wants.join('、')}`);
    if (d.age) L.push(`年龄：${d.age}`);
    if (d.height) L.push(`身高：${d.height}`);
    if (d.color) L.push(`毛色：${d.color}`);
    if (d.online) L.push(`在线：${d.online}`);
    if (d.group) L.push(`常驻群：${d.group}`);
    if (d.bio) L.push(`\n${d.bio}`);
    if (!d.hideContact) {
      if (d.qq) L.push(`\nQQ：${d.qq}`);
      if (d.contact) L.push(`其他：${d.contact}`);
    }
    return L.join('\n');
  },

  /* 导出 PNG：用 Canvas 手绘，避免依赖 html2canvas 之类外链库 */
  exportPng() {
    this.readForm();
    const d = this.me;
    const s = DATA.seed(d.seed);
    const W = 680, H = 900;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const F = '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';

    // 背景
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
    // 封面渐变
    const grd = g.createLinearGradient(0, 0, W, 216);
    grd.addColorStop(0, s.c); grd.addColorStop(1, s.c2);
    g.fillStyle = grd; g.fillRect(0, 0, W, 216);

    // 头像白底圆角块
    const ax = 48, ay = 216 - 76, as = 152;
    g.fillStyle = '#FFFFFF';
    this.roundRect(g, ax, ay, as, as, 32); g.fill();
    g.font = `84px ${F}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(d.emoji || '🦊', ax + as / 2, ay + as / 2 + 6);

    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    let y = 216 + 76;
    // 名字
    g.fillStyle = '#1C1B1F'; g.font = `600 42px ${F}`;
    g.fillText(d.name || '未命名', 48, y);
    y += 34;
    // 兽种
    if (d.species) {
      g.fillStyle = '#79757F'; g.font = `400 24px ${F}`;
      g.fillText(d.species, 48, y); y += 34;
    }

    // 标签（性格 / 兴趣 / 扩列诉求三类，诉求用深色以便区分）
    const tags = (d.traits || []).map(t => [t, s.c])
      .concat((d.interests || []).map(t => [t, s.c2]))
      .concat((d.wants || []).map(t => [t, s.c]));
    if (tags.length) {
      y += 12;
      let tx = 48;
      for (const [t, c] of tags) {
        g.font = `400 22px ${F}`;
        const w = g.measureText(t).width + 28;
        if (tx + w > W - 48) { tx = 48; y += 44; }
        g.fillStyle = c + '22';
        this.roundRect(g, tx, y - 26, w, 38, 19); g.fill();
        g.fillStyle = c;
        g.fillText(t, tx + 14, y);
        tx += w + 10;
      }
      y += 34;
    }

    // 自我介绍
    if (d.bio) {
      y += 16;
      g.fillStyle = '#49454F'; g.font = `400 24px ${F}`;
      const lines = this.wrap(g, d.bio, W - 96, 34);
      for (const ln of lines) { g.fillText(ln, 48, y); y += 34; }
    }

    // 资料行
    const rows = [];
    if (d.age) rows.push(['年龄', d.age]);
    if (d.height) rows.push(['身高', d.height]);
    if (d.color) rows.push(['毛色', d.color]);
    if (d.online) rows.push(['在线', d.online]);
    if (d.group) rows.push(['常驻群', d.group]);
    if (!d.hideContact) {
      if (d.qq) rows.push(['QQ', d.qq]);
      if (d.contact) rows.push(['其他', d.contact]);
    }
    if (rows.length) {
      y += 20;
      for (const [k, v] of rows) {
        g.strokeStyle = '#E7E4EE'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(48, y - 14); g.lineTo(W - 48, y - 14); g.stroke();
        g.fillStyle = '#79757F'; g.font = `400 23px ${F}`;
        g.fillText(k, 48, y + 14);
        g.fillStyle = '#1C1B1F';
        g.fillText(v, 140, y + 14);
        y += 52;
      }
    }

    // QQ 加好友提示条
    if (QQ.valid(d.qq) && !d.hideContact) {
      y += 12;
      g.fillStyle = s.c;
      this.roundRect(g, 48, y - 30, W - 96, 62, 16); g.fill();
      g.fillStyle = '#FFFFFF'; g.font = `500 26px ${F}`;
      g.fillText(`加 QQ 好友  ${d.qq}`, 72, y + 8);
      y += 62;
    }

    // 页脚
    g.fillStyle = '#CAC4D0'; g.font = `400 20px ${F}`;
    g.textAlign = 'center';
    g.fillText(d.hideContact ? '用 Furry 扩列墙制作 · 联系方式已隐藏' : '用 Furry 扩列墙制作',
      W / 2, H - 40);

    // 下载
    cv.toBlob((blob) => {
      if (!blob) { this.toast('导出失败'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(d.name || '兽设名片').replace(/[\\/:*?"<>|]/g, '_')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      this.toast('图片已导出');
    }, 'image/png');
  },

  roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  },
  wrap(g, text, maxW, lh) {
    const out = [];
    let cur = '';
    for (const ch of text) {
      if (ch === '\n') { out.push(cur); cur = ''; continue; }
      if (g.measureText(cur + ch).width > maxW) { out.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  },

  /* ---------- 备份 ---------- */
  exportJson() {
    const blob = new Blob([JSON.stringify({ me: this.me, wall: this.wall }, null, 2)],
      { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'furry-card-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    this.toast('备份已导出');
  },
  importJson(e) {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result);
        if (o.me) { this.me = { ...this.blank(), ...o.me }; Store.saveMe(this.me); this.fillForm(this.me); }
        if (Array.isArray(o.wall)) { this.wall = o.wall; Store.saveWall(this.wall); }
        this.applySeed(this.me.seed || 'violet');
        this.renderPickers();
        this.renderCard();
        this.renderWall();
        this.updateStat();
        this.toast('备份已导入');
      } catch (err) {
        this.toast('这个文件读不出来');
      }
    };
    rd.readAsText(f);
    e.target.value = '';
  },

  updateStat() {
    const n = Store.usage();
    const kb = (n / 1024).toFixed(1);
    document.getElementById('dataStat').textContent =
      `我的名片 1 份 · 扩列墙 ${this.wall.length} 位 · 占用约 ${kb} KB`;
  },

  /* ---------- 视图切换 ---------- */
  go(v) {
    this.view = v;
    ['card', 'wall', 'settings'].forEach(x => {
      document.getElementById('view-' + x).hidden = x !== v;
    });
    document.querySelectorAll('.tab').forEach(b =>
      b.classList.toggle('on', b.dataset.view === v));
    window.scrollTo({ top: 0 });
  },

  /* ---------- 工具 ---------- */
  copy(text, msg) {
    const done = () => this.toast(msg);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(() => this.fallbackCopy(text, done));
    } else this.fallbackCopy(text, done);
  },
  fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); }
    catch (e) { this.toast('复制失败，请手动选择'); }
    ta.remove();
  },
  toastTimer: null,
  toast(msg) {
    const el = document.getElementById('snackbar');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
  },
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
