/* ============================================================
   Furry 扩列地图 · 应用逻辑
   ============================================================ */

const App = {
  me: null,
  wall: [],
  view: 'card',
  radius: 0,        // 0 = 全部
  hl: null,         // 地图高亮的兽友名

  blank() {
    return {
      name: '', species: '', emoji: '🦊',
      avatarImg: '', bgImg: '',
      city: '', lng: null, lat: null,
      traits: [], interests: [],
      age: '', height: '', color: '', bio: '',
      qq: '', contact: '', hideContact: false,
      wants: [], online: '', group: '',
      seed: 'violet',
    };
  },

  init() {
    this.me = Store.loadMe() || this.blank();
    // 老数据可能没有新字段，补齐后再用
    this.me = { ...this.blank(), ...this.me };
    this.me.traits = this.me.traits || [];
    this.me.interests = this.me.interests || [];
    this.me.wants = this.me.wants || [];
    this.wall = Store.loadWall();

    const savedTh = localStorage.getItem('furrymap.theme');
    if (savedTh) document.documentElement.setAttribute('data-theme', savedTh);

    this.applySeed(this.me.seed || 'violet');
    this.renderCitySelect('');
    this.renderHotCities();
    this.renderPickers();
    this.fillForm(this.me);
    this.renderCard();
    this.renderWall();
    this.bind();

    const shared = Codec.fromHash(location.hash);
    if (shared) this.showShared(shared);
  },

  /* ============================================================
     绑定
     ============================================================ */
  bind() {
    document.getElementById('themeBtn').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('furrymap.theme', next);
      this.syncThemePick();
    });
    document.querySelectorAll('#themePick button').forEach(b =>
      b.addEventListener('click', () => {
        document.documentElement.setAttribute('data-theme', b.dataset.v);
        localStorage.setItem('furrymap.theme', b.dataset.v);
        this.syncThemePick();
      }));
    this.syncThemePick();

    document.querySelectorAll('.tab').forEach(b =>
      b.addEventListener('click', () => { this.go(b.dataset.view); if (b.dataset.view === 'map') this.renderMap(); }));

    // 文本输入 → 实时预览
    const IDS = ['iName', 'iSpecies', 'iEmoji', 'iAge', 'iHeight', 'iColor', 'iBio',
                 'iQQ', 'iContact', 'iOnline', 'iGroup'];
    IDS.forEach(id => document.getElementById(id)
      .addEventListener('input', () => { this.readForm(); this.renderCard(); }));
    document.getElementById('iHideContact').addEventListener('change', () => {
      this.readForm(); this.renderCard();
    });
    document.getElementById('iBio').addEventListener('input', () =>
      document.getElementById('bioCount').textContent = document.getElementById('iBio').value.length);

    // 城市
    document.getElementById('iCity').addEventListener('change', () => {
      // 必须先切显隐再读数：坐标框隐藏时 input 不可见，
      // 若顺序反了，切到「自定义坐标」后输入框不会露出来。
      this.toggleCustom(document.getElementById('iCity').value === '__custom');
      this.readForm();
      this.renderHotCities();
      this.renderCard(); this.renderCoordHint();
    });

    // 城市搜索过滤
    const cs = document.getElementById('citySearch');
    cs.addEventListener('input', () => this.renderCitySelect(cs.value));
    cs.addEventListener('keydown', (e) => {
      // 回车直接选中第一个结果，手机上省一次点击
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const first = document.querySelector('#iCity option:not([value=""]):not([value="__custom"])');
      if (first) {
        document.getElementById('iCity').value = first.value;
        this.toggleCustom(false);
        this.readForm(); this.renderHotCities(); this.renderCard(); this.renderCoordHint();
      }
    });
    ['iLng', 'iLat'].forEach(id => document.getElementById(id).addEventListener('input', () => {
      this.readForm(); this.renderCoordHint(); this.renderCard();
    }));

    // 自定义标签
    document.getElementById('iCustomTag').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = e.target.value.trim();
      if (!v) return;
      if (!this.me.interests.includes(v)) this.me.interests.push(v);
      e.target.value = '';
      this.renderPickers(); this.renderCard();
    });

    // 图片上传
    document.getElementById('btnAvatar').addEventListener('click', () =>
      document.getElementById('fileAvatar').click());
    document.getElementById('btnBg').addEventListener('click', () =>
      document.getElementById('fileBg').click());
    document.getElementById('fileAvatar').addEventListener('change', (e) =>
      this.pickImage(e, 'avatar', 240, 240));
    document.getElementById('fileBg').addEventListener('change', (e) =>
      this.pickImage(e, 'bg', 680, 240));
    document.getElementById('btnAvatarClear').addEventListener('click', () => {
      this.me.avatarImg = ''; this.persist(); this.renderCard(); this.updateImgNote();
      this.toast('已移除头像');
    });
    document.getElementById('btnBgClear').addEventListener('click', () => {
      this.me.bgImg = ''; this.persist(); this.renderCard(); this.updateImgNote();
      this.toast('已移除背景');
    });

    // 保存 / 加墙 / 清空
    document.getElementById('btnSave').addEventListener('click', () => {
      this.readForm();
      if (!this.me.name.trim()) { this.toast('先填个兽设名吧'); return; }
      this.toast(this.persist() ? '已保存到本机' : '保存失败：存储空间不足，试试移除图片');
    });
    document.getElementById('btnAddToWall').addEventListener('click', () => {
      this.readForm();
      if (!this.me.name.trim()) { this.toast('先填个兽设名吧'); return; }
      this.persist();
      this.addToWall({ ...this.me });
      this.toast('已加入扩列墙');
      this.go('wall');
    });
    document.getElementById('btnClear').addEventListener('click', () => {
      if (!confirm('确定清空名片内容（含图片）？')) return;
      this.me = this.blank();
      this.fillForm(this.me);
      this.applySeed('violet');
      this.renderPickers();
      this.renderCard();
      this.updateImgNote();
      this.toast('已清空');
    });

    // 导出 / 分享
    document.getElementById('btnExport').addEventListener('click', () => this.exportPng());
    document.getElementById('btnShare').addEventListener('click', () => this.openShare());
    document.getElementById('shareClose').addEventListener('click', () =>
      document.getElementById('shareSheet').hidden = true);
    document.getElementById('shareSheet').addEventListener('click', (e) => {
      if (e.target.id === 'shareSheet') document.getElementById('shareSheet').hidden = true;
    });
    document.getElementById('btnCopyUrl').addEventListener('click', () =>
      this.copy(document.getElementById('shareUrl').value, '链接已复制'));
    document.getElementById('btnCopyText').addEventListener('click', () =>
      this.copy(this.plainText(this.me), '纯文本版已复制'));

    // 导入
    document.getElementById('btnImport').addEventListener('click', () => {
      document.getElementById('importSheet').hidden = false;
      document.getElementById('importErr').hidden = true;
      document.getElementById('importUrl').value = '';
    });
    document.getElementById('importClose').addEventListener('click', () =>
      document.getElementById('importSheet').hidden = true);
    document.getElementById('importSheet').addEventListener('click', (e) => {
      if (e.target.id === 'importSheet') document.getElementById('importSheet').hidden = true;
    });
    document.getElementById('btnDoImport').addEventListener('click', () => {
      const v = document.getElementById('importUrl').value.trim();
      const o = Codec.fromHash(v) || Codec.decode(v);
      const err = document.getElementById('importErr');
      if (!o || !o.name) {
        err.textContent = '这段链接里没有有效的名片数据，检查一下是不是复制全了。';
        err.hidden = false; return;
      }
      this.addToWall(o);
      document.getElementById('importSheet').hidden = true;
      this.toast(`已收藏 ${o.name}`);
    });

    // 扩列墙
    document.getElementById('btnAddMine').addEventListener('click', () => {
      if (!this.me.name.trim()) { this.toast('先去「我的名片」填一下资料'); this.go('card'); return; }
      this.persist();
      this.addToWall({ ...this.me });
      this.toast('已加入扩列墙');
    });
    document.getElementById('wallSearch').addEventListener('input', () => this.renderWall());

    // 地图范围
    document.querySelectorAll('#radiusPick button').forEach(b =>
      b.addEventListener('click', () => {
        this.radius = +b.dataset.r;
        document.querySelectorAll('#radiusPick button').forEach(x =>
          x.classList.toggle('on', x === b));
        this.renderMap();
      }));

    // 数据
    document.getElementById('btnExportJson').addEventListener('click', () => this.exportJson());
    document.getElementById('btnImportJson').addEventListener('click', () =>
      document.getElementById('jsonFile').click());
    document.getElementById('jsonFile').addEventListener('change', (e) => this.importJson(e));
    document.getElementById('btnWipe').addEventListener('click', () => {
      if (!confirm('确定清空全部数据？名片、图片和扩列墙都会消失，且无法恢复。')) return;
      Store.wipe();
      this.me = this.blank(); this.wall = [];
      this.fillForm(this.me); this.renderCard(); this.renderWall();
      this.updateImgNote(); this.updateStat();
      this.toast('已清空全部数据');
    });

    this.updateImgNote();
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

    // 城市 / 坐标
    const cv = document.getElementById('iCity').value;
    this.me.city = cv;
    if (cv === '__custom') {
      const lng = parseFloat(document.getElementById('iLng').value);
      const lat = parseFloat(document.getElementById('iLat').value);
      this.me.lng = isFinite(lng) ? lng : null;
      this.me.lat = isFinite(lat) ? lat : null;
    } else if (cv) {
      const c = DATA.city(cv);
      if (c) { this.me.lng = c.lng; this.me.lat = c.lat; }
    } else { this.me.lng = null; this.me.lat = null; }

    this.syncQqHint();
    this.autoSave();
  },

  /* 改动后自动落盘（防抖）。
     之前只有点「保存到本机」才写，用户改完城市直接刷新就会丢——
     这是本地工具，不该让人手动记着保存。 */
  autoSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      if (!this.me.name || !this.me.name.trim()) return;   // 没填名字就不存
      if (this.persist()) this.updateStat();
    }, 600);
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

    const sel = document.getElementById('iCity');
    if (m.city && m.city !== '__custom') sel.value = m.city;
    else if (m.city === '__custom') {
      sel.value = '__custom';
      document.getElementById('iLng').value = m.lng ?? '';
      document.getElementById('iLat').value = m.lat ?? '';
    } else sel.value = '';
    this.toggleCustom(m.city === '__custom');
    this.renderHotCities();
    this.syncQqHint();
    this.renderCoordHint();
  },

  toggleCustom(show) {
    document.getElementById('customCoord').hidden = !show;
  },

  renderCoordHint() {
    const el = document.getElementById('coordHint');
    if (!el) return;
    const { lng, lat } = this.me;
    if (lng == null || lat == null) { el.textContent = '填经纬度，或直接选上面的城市'; el.className = 'hintline'; return; }
    if (!Geo.inRange(lng, lat)) {
      el.textContent = `坐标超出中国范围（经度 ${Geo.LNG0}-${Geo.LNG1}，纬度 ${Geo.LAT1}-${Geo.LAT0}），地图上不会显示`;
      el.className = 'hintline warn'; return;
    }
    el.textContent = `✓ 会画在地图上（${lng.toFixed(2)}, ${lat.toFixed(2)}）`;
    el.className = 'hintline ok';
  },

  syncQqHint() {
    const el = document.getElementById('qqHint');
    if (!el) return;
    const v = this.me.qq;
    if (!v) { el.textContent = '可留空'; el.className = 'hintline'; return; }
    if (QQ.valid(v)) { el.textContent = '✓ 对方点名片上的 QQ 就能加你好友'; el.className = 'hintline ok'; }
    else { el.textContent = 'QQ 号应为 5-15 位数字，当前不会生成加好友链接'; el.className = 'hintline warn'; }
  },

  persist() {
    const ok = Store.saveMe(this.me);
    if (ok) this.updateStat();
    return ok;
  },

  /* ============================================================
     位置
     ============================================================ */
  /* ------------------------------------------------------------
     城市下拉：347 个地级市，按省份分组 + 搜索过滤
     直接渲染 347 个 option 在手机上根本没法用，所以：
       - 搜索框输入时只留匹配项（带省份标签）
       - 未搜索时按省份分组（optgroup），可折叠展开
       - 常备「热门城市」快捷 chip
     ------------------------------------------------------------ */
  renderCitySelect(q) {
    const sel = document.getElementById('iCity');
    const hint = document.getElementById('cityHint');
    const keep = sel.value;   // 保住当前选中项，避免重渲染时丢失

    let html = '<option value="">（不填）</option>';

    if (q && q.trim()) {
      const hit = DATA.search(q);
      if (!hit.length) {
        hint.textContent = '没找到，换个词试试（也可以选「自定义坐标」）';
        hint.className = 'hintline warn';
      } else {
        hint.textContent = `找到 ${hit.length} 个` + (hit.length >= 60 ? '（只显示前 60 个）' : '');
        hint.className = 'hintline ok';
      }
      html += hit.map(c =>
        `<option value="${this.esc(c[0])}">${this.esc(c[0])} · ${this.esc(c[3])}</option>`).join('');
    } else {
      hint.textContent = '';
      const g = DATA.byProv();
      for (const prov in g) {
        html += `<optgroup label="${this.esc(prov)}">`
          + g[prov].map(c => `<option value="${this.esc(c[0])}">${this.esc(c[0])}</option>`).join('')
          + '</optgroup>';
      }
    }
    html += '<option value="__custom">自定义坐标…</option>';
    sel.innerHTML = html;

    // 恢复选中（若该项被过滤掉了就放弃，避免回落到错误城市）
    const still = Array.from(sel.options).some(o => o.value === keep);
    sel.value = still ? keep : (this.me.city || '');
  },

  renderHotCities() {
    const box = document.getElementById('hotCities');
    if (!box) return;
    box.innerHTML = DATA.HOT.map(c =>
      `<button data-c="${this.esc(c)}" class="${this.me.city === c ? 'on' : ''}">${this.esc(c)}</button>`).join('');
    box.querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => {
        document.getElementById('iCity').value = b.dataset.c;
        document.getElementById('citySearch').value = '';
        this.readForm(); this.renderCitySelect(''); this.renderHotCities(); this.renderCard();
      }));
  },

  pos(m) {
    // 优先用自定义坐标，其次查城市表
    if (m.lng != null && m.lat != null && isFinite(m.lng) && isFinite(m.lat)) {
      return Geo.inRange(m.lng, m.lat) ? { lng: m.lng, lat: m.lat } : null;
    }
    return m.city && m.city !== '__custom' ? DATA.city(m.city) : null;
  },

  /* ============================================================
     选择器
     ============================================================ */
  renderPickers() {
    const ep = document.getElementById('emojiPick');
    ep.innerHTML = DATA.EMOJIS.map(e =>
      `<button data-e="${e}" class="${this.me.emoji === e ? 'on' : ''}">${e}</button>`).join('');
    ep.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      this.me.emoji = b.dataset.e;
      document.getElementById('iEmoji').value = b.dataset.e;
      this.renderPickers(); this.renderCard();
    }));

    const mk = (box, list, arr) => {
      const all = list.concat((arr || []).filter(x => !list.includes(x)));
      box.innerHTML = all.map(t =>
        `<button data-t="${this.esc(t)}" class="${(arr || []).includes(t) ? 'on' : ''}">${this.esc(t)}</button>`).join('');
      box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        const v = b.dataset.t;
        const i = arr.indexOf(v);
        if (i >= 0) arr.splice(i, 1); else arr.push(v);
        this.renderPickers(); this.renderCard();
      }));
    };
    mk(document.getElementById('traitPick'), DATA.TRAITS, this.me.traits);
    mk(document.getElementById('interestPick'), DATA.INTERESTS, this.me.interests);
    mk(document.getElementById('wantPick'), DATA.WANTS, this.me.wants);

    const op = document.getElementById('onlinePick');
    op.innerHTML = DATA.ONLINES.map(o =>
      `<button data-o="${this.esc(o)}" class="${this.me.online === o ? 'on' : ''}">${this.esc(o)}</button>`).join('');
    op.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      this.me.online = b.dataset.o;
      document.getElementById('iOnline').value = b.dataset.o;
      this.renderPickers(); this.renderCard();
    }));

    const sp = document.getElementById('seedPick');
    sp.innerHTML = DATA.SEEDS.map(s =>
      `<button data-s="${s.id}" class="${this.me.seed === s.id ? 'on' : ''}"
        style="background:linear-gradient(135deg,${s.c},${s.c2})" title="${s.name}"></button>`).join('');
    sp.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
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

    // 背景：有图用图，否则渐变
    const cover = document.getElementById('fcCover');
    const bg = document.getElementById('fcBg');
    if (d.bgImg) { bg.src = d.bgImg; bg.hidden = false; }
    else { bg.hidden = true; bg.removeAttribute('src'); }
    cover.style.background = `linear-gradient(135deg, ${s.c}, ${s.c2})`;

    // 头像：有图用图，否则 emoji
    const av = document.getElementById('fcAvatar');
    av.innerHTML = d.avatarImg
      ? `<img src="${d.avatarImg}" alt="">`
      : this.esc(d.emoji || '🦊');

    document.getElementById('fcName').textContent = d.name || '未命名';
    document.getElementById('fcSpecies').textContent = d.species || '未填写兽种';

    const p = this.pos(d);
    const loc = document.getElementById('fcLoc');
    if (p) {
      loc.hidden = false;
      loc.textContent = '📍 ' + (d.city && d.city !== '__custom' ? d.city : '自定义位置');
    } else loc.hidden = true;

    const tags = (d.traits || []).map(t => `<span class="chip">${this.esc(t)}</span>`)
      .concat((d.interests || []).map(t => `<span class="chip alt">${this.esc(t)}</span>`))
      .concat((d.wants || []).map(t => `<span class="chip want">${this.esc(t)}</span>`));
    document.getElementById('fcTags').innerHTML = tags.join('');
    document.getElementById('fcBio').textContent = d.bio || '';

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

    const qbox = document.getElementById('fcQq');
    const u = QQ.addUrl(d.qq);
    qbox.innerHTML = (u && !d.hideContact)
      ? `<a class="qqbtn" href="${u}" target="_blank" rel="noopener noreferrer">加 QQ 好友 · ${this.esc(d.qq)}</a>` : '';
    qbox.hidden = !(u && !d.hideContact);

    document.getElementById('fcFoot').textContent =
      d.hideContact ? '用 Furry 扩列地图制作 · 联系方式已隐藏' : '用 Furry 扩列地图制作';
  },

  /* ============================================================
     图片上传
     ============================================================ */
  async pickImage(e, kind, w, h) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { this.toast('请选择图片文件'); return; }
    this.toast('处理中…');
    try {
      const url = await Img.compress(f, w, h, 0.75);
      if (kind === 'avatar') this.me.avatarImg = url; else this.me.bgImg = url;
      const ok = this.persist();
      this.renderCard();
      this.updateImgNote();
      this.toast(ok ? `已设置（约 ${Img.kb(url)} KB）`
                    : `已设置，但存储空间不足，刷新可能丢失（约 ${Img.kb(url)} KB）`);
    } catch (err) {
      this.toast('图片处理失败：' + err.message);
    }
  },

  updateImgNote() {
    const a = document.getElementById('avatarNote');
    const b = document.getElementById('bgNote');
    const ac = document.getElementById('btnAvatarClear');
    const bc = document.getElementById('btnBgClear');
    a.textContent = this.me.avatarImg ? `已设置 · 约 ${Img.kb(this.me.avatarImg)} KB` : '未设置';
    b.textContent = this.me.bgImg ? `已设置 · 约 ${Img.kb(this.me.bgImg)} KB` : '未设置';
    ac.hidden = !this.me.avatarImg;
    bc.hidden = !this.me.bgImg;
  },

  /* ============================================================
     扩列墙
     ============================================================ */
  addToWall(o) {
    const clean = { ...o };
    const i = this.wall.findIndex(x => x.name === clean.name);
    if (i >= 0) this.wall[i] = clean; else this.wall.push(clean);
    const ok = Store.saveWall(this.wall);
    this.renderWall();
    this.updateStat();
    if (!ok) this.toast('扩列墙保存失败：存储空间不足');
  },

  renderWall() {
    const q = document.getElementById('wallSearch').value.trim().toLowerCase();
    const list = this.wall.filter(x => {
      if (!q) return true;
      return [x.name, x.species, x.city].concat(x.traits || [], x.interests || [], x.wants || [])
        .some(v => (v || '').toLowerCase().includes(q));
    });

    document.getElementById('wallCount').textContent = this.wall.length;
    const empty = document.getElementById('wallEmpty');
    const box = document.getElementById('wall');
    empty.hidden = this.wall.length > 0;
    if (!list.length) { box.innerHTML = ''; return; }

    const myPos = this.pos(this.me);

    box.innerHTML = list.map((x, idx) => {
      const s = DATA.seed(x.seed);
      const tags = (x.traits || []).slice(0, 3).concat((x.interests || []).slice(0, 3))
        .map(t => `<span>${this.esc(t)}</span>`).join('');
      const wants = (x.wants || []).slice(0, 3).map(t => `<span class="want">${this.esc(t)}</span>`).join('');
      const qqUrl = QQ.addUrl(x.qq);
      const p = this.pos(x);
      const km = (myPos && p && myPos !== p) ? Geo.dist(myPos, p) : null;
      return `<div class="wcard">
        <div class="wcard__hd" style="--c1:${s.c};--c2:${s.c2}">
          ${x.bgImg ? `<img src="${x.bgImg}" alt="">` : ''}
          <div class="wcard__ava">${x.avatarImg ? `<img src="${x.avatarImg}" alt="">` : this.esc(x.emoji || '🦊')}</div>
        </div>
        <div class="wcard__bd">
          <div class="wcard__nm">${this.esc(x.name || '未命名')}</div>
          <div class="wcard__sp">${this.esc(x.species || '')}</div>
          ${p ? `<div class="wcard__loc">📍 ${this.esc(x.city && x.city !== '__custom' ? x.city : '自定义位置')}${km != null ? ' · ' + Geo.fmt(km) : ''}</div>` : ''}
          ${tags ? `<div class="wcard__tags">${tags}</div>` : ''}
          ${wants ? `<div class="wcard__tags">${wants}</div>` : ''}
          ${x.bio ? `<div class="wcard__bio">${this.esc(x.bio)}</div>` : ''}
          ${(!x.hideContact && (x.qq || x.contact)) ? `<div class="wcard__meta">${this.esc(x.qq ? 'QQ ' + x.qq : '')}${x.qq && x.contact ? ' · ' : ''}${this.esc(x.contact || '')}</div>` : ''}
          ${(qqUrl && !x.hideContact) ? `<a class="qqbtn" href="${qqUrl}" target="_blank" rel="noopener noreferrer" style="margin-top:10px">加 QQ 好友</a>` : ''}
        </div>
        <div class="wcard__act">
          <button data-act="share" data-n="${this.esc(x.name)}">分享</button>
          <button data-act="copy" data-n="${this.esc(x.name)}">复制资料</button>
          <button data-act="map" data-n="${this.esc(x.name)}">在地图看</button>
          <button data-act="del" data-n="${this.esc(x.name)}" class="danger">删除</button>
        </div>
      </div>`;
    }).join('');

    box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const n = b.dataset.n;
      const o = this.wall.find(x => x.name === n);
      if (!o) return;
      if (b.dataset.act === 'share') this.copy(this.shareUrl(o), `已复制 ${n} 的分享链接`);
      else if (b.dataset.act === 'copy') this.copy(this.plainText(o), `已复制 ${n} 的资料`);
      else if (b.dataset.act === 'map') { this.hl = n; this.go('map'); this.renderMap(); }
      else if (b.dataset.act === 'del') {
        if (!confirm(`确定把「${n}」从扩列墙移除？`)) return;
        const i = this.wall.findIndex(x => x.name === n);
        if (i >= 0) this.wall.splice(i, 1);
        Store.saveWall(this.wall);
        this.renderWall(); this.updateStat();
        this.toast(`已移除 ${n}`);
      }
    }));
  },

  showShared(o) {
    this.renderCard(o);
    this.go('card');
    const nm = o.name || '这位兽友';
    setTimeout(() => {
      if (confirm(`收到「${nm}」的扩列名片。要收藏到你的扩列墙吗？`)) {
        this.addToWall(o);
        this.toast(`已收藏 ${nm}`);
        history.replaceState(null, '', location.pathname + location.search);
      }
    }, 300);
  },

  /* ============================================================
     地图
     ============================================================ */
  renderMap() {
    const svg = document.getElementById('mapSvg');
    const hint = document.getElementById('mapHint');
    const myPos = this.pos(this.me);

    // ---- 底图：轮廓 + 经纬网格 + 城市点 ----
    const poly = (pts) => pts.map(p => `${Geo.x(p[0]).toFixed(1)},${Geo.y(p[1]).toFixed(1)}`).join(' ');
    let out = '';

    // 网格：每 10 度
    const grid = [];
    for (let lng = 80; lng <= 130; lng += 10) {
      grid.push(`M${Geo.x(lng)},${Geo.y(Geo.LAT0)} L${Geo.x(lng)},${Geo.y(Geo.LAT1)}`);
    }
    for (let lat = 20; lat <= 50; lat += 10) {
      grid.push(`M${Geo.x(Geo.LNG0)},${Geo.y(lat)} L${Geo.x(Geo.LNG1)},${Geo.y(lat)}`);
    }
    out += `<path class="mp-grid" d="${grid.join(' ')}" />`;

    out += `<polygon class="mp-outline" points="${poly(DATA.OUTLINE.main)}" />`;
    out += `<polygon class="mp-outline" points="${poly(DATA.OUTLINE.hainan)}" />`;
    out += `<polygon class="mp-outline" points="${poly(DATA.OUTLINE.taiwan)}" />`;

    /* 城市底点：347 个全画（r=1.1 的淡点），形成"城市密度"的底图感；
       名字只标 12 个主要城市，否则会糊成一片。 */
    for (const c of DATA.CITIES) {
      out += `<circle class="mp-city" cx="${Geo.x(c[1]).toFixed(1)}" cy="${Geo.y(c[2]).toFixed(1)}" r="1.1" />`;
    }
    const labelCities = ['北京', '上海', '广州', '成都', '西安', '哈尔滨',
                         '乌鲁木齐', '拉萨', '昆明', '武汉', '枣庄', '三亚'];
    for (const n of labelCities) {
      const c = DATA.CITIES.find(x => x[0] === n);
      if (!c) continue;
      out += `<text class="mp-city-label" x="${(Geo.x(c[1]) + 4).toFixed(1)}" y="${(Geo.y(c[2]) + 3).toFixed(1)}">${this.esc(n)}</text>`;
    }

    // ---- 兽友点 ----
    /* 把自己加进扩列墙是常见操作，此时墙里会有一份"我"的副本。
       若不排除，地图上就会画出两个点、且自己到自己的距离是 0。 */
    const isMe = (x) => this.me.name && x.name === this.me.name;
    const myPosNow = myPos;
    const items = this.wall.filter(x => !isMe(x))
      .map(x => ({ x, p: this.pos(x) })).filter(o => o.p);
    const mine = myPosNow ? [{ x: this.me, p: myPosNow, me: true }] : [];
    let shown = items.concat(mine);

    // 范围筛选（以我的位置为圆心）
    if (this.radius > 0 && myPosNow) {
      shown = shown.filter(o => o.me || Geo.dist(myPosNow, o.p) <= this.radius);
    }

    // 同城点做小圆环偏移，避免完全重叠
    const groups = {};
    shown.forEach(o => {
      const k = `${o.p.lng.toFixed(2)},${o.p.lat.toFixed(2)}`;
      (groups[k] = groups[k] || []).push(o);
    });
    const placed = [];
    for (const k in groups) {
      const arr = groups[k];
      arr.forEach((o, i) => {
        let px = Geo.x(o.p.lng), py = Geo.y(o.p.lat);
        if (arr.length > 1 && i > 0) {
          const ang = (i - 1) * (Math.PI * 2 / Math.max(1, arr.length - 1));
          px += Math.cos(ang) * 7; py += Math.sin(ang) * 7;
        }
        placed.push({ ...o, px, py });
      });
    }

    for (const o of placed) {
      if (o.me) {
        out += `<circle class="mp-pulse" cx="${o.px.toFixed(1)}" cy="${o.py.toFixed(1)}" r="8" />`;
        out += `<circle class="mp-dot mp-dot--me" cx="${o.px.toFixed(1)}" cy="${o.py.toFixed(1)}" r="7"
                  data-n="${this.esc(o.x.name || '我')}" />`;
      } else {
        const on = this.hl && this.hl === o.x.name;
        out += `<circle class="mp-dot mp-dot--other" cx="${o.px.toFixed(1)}" cy="${o.py.toFixed(1)}" r="${on ? 8 : 5.5}"
                  data-n="${this.esc(o.x.name || '')}" />`;
      }
    }

    svg.innerHTML = out;

    // tooltip
    const tip = document.getElementById('mapTip');
    const box = document.getElementById('mapBox');
    svg.querySelectorAll('.mp-dot').forEach(c => {
      const show = () => {
        const n = c.dataset.n;
        const rec = this.wall.find(x => x.name === n) || (n === (this.me.name || '我') ? this.me : null);
        const p = rec ? this.pos(rec) : null;
        let km = '';
        if (myPosNow && p && rec !== this.me) km = ' · ' + Geo.fmt(Geo.dist(myPosNow, p));
        tip.innerHTML = `<b>${this.esc(n)}</b>${km}`;
        const r = c.getBoundingClientRect();
        const br = box.getBoundingClientRect();
        tip.style.left = (r.left - br.left + r.width / 2) + 'px';
        tip.style.top = (r.top - br.top) + 'px';
        tip.hidden = false;
      };
      c.addEventListener('mouseenter', show);
      c.addEventListener('click', show);
      c.addEventListener('mouseleave', () => { tip.hidden = true; });
    });

    document.getElementById('mapCount').textContent = placed.length;

    // 提示
    if (!myPosNow) {
      hint.hidden = false;
      hint.textContent = '还没设置你的位置——去「我的名片 → 所在位置」选个城市，这里就会出现你，并显示到各地的距离。';
    } else if (this.radius > 0 && shown.length <= 1) {
      hint.hidden = false;
      hint.textContent = `${this.radius} km 内还没有其他兽友。换个更大范围看看？`;
    } else hint.hidden = true;

    this.renderNearList(myPosNow);
  },

  renderNearList(myPos) {
    const box = document.getElementById('nearList');
    // 与地图保持一致：列表里也不重复出现"我"
    const list = this.wall.filter(x => !(this.me.name && x.name === this.me.name))
      .map(x => ({ x, p: this.pos(x) }));
    const withKm = [];
    const noPos = [];
    for (const o of list) {
      if (o.p && myPos) withKm.push({ ...o, km: Geo.dist(myPos, o.p) });
      else if (o.p) withKm.push({ ...o, km: null });
      else noPos.push(o);
    }
    withKm.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));

    let html = '';
    if (!withKm.length && !noPos.length) {
      html = '<div class="near-empty">扩列墙还是空的</div>';
    } else {
      html = withKm.map(o => `
        <div class="near-item" data-n="${this.esc(o.x.name)}">
          <div class="near-item__ava">${o.x.avatarImg ? `<img src="${o.x.avatarImg}" alt="">` : this.esc(o.x.emoji || '🦊')}</div>
          <div class="near-item__tx">
            <div class="near-item__nm">${this.esc(o.x.name)}</div>
            <div class="near-item__sp">${this.esc(o.x.city || o.x.species || '')}</div>
          </div>
          <div class="near-item__km ${o.km == null || o.km > 1000 ? 'far' : ''}">${o.km == null ? '—' : Geo.fmt(o.km)}</div>
        </div>`).join('');
      if (noPos.length) {
        html += `<div class="near-empty" style="text-align:left">${noPos.length} 位未标注位置</div>`;
      }
    }
    box.innerHTML = html;
    box.querySelectorAll('.near-item').forEach(el => el.addEventListener('click', () => {
      this.hl = el.dataset.n;
      this.renderMap();
    }));
  },

  /* ============================================================
     分享 / 导出
     ============================================================ */
  shareUrl(m) {
    const d = m || this.me;
    const payload = {
      name: d.name, species: d.species, emoji: d.emoji,
      city: d.city, lng: d.lng, lat: d.lat,
      traits: d.traits, interests: d.interests, wants: d.wants,
      age: d.age, height: d.height, color: d.color, bio: d.bio,
      online: d.online, group: d.group, seed: d.seed,
    };
    /* 图片不进链接：一张图几十 KB，base64 后会让链接长到发不出去。
       对方看到的是 emoji 头像 + 渐变背景。 */
    if (!d.hideContact) { payload.qq = d.qq; payload.contact = d.contact; }
    payload.hideContact = !!d.hideContact;
    return `${location.origin}${location.pathname}#c=${Codec.encode(payload)}`;
  },

  openShare() {
    this.readForm();
    if (!this.me.name.trim()) { this.toast('先填个兽设名吧'); return; }
    document.getElementById('shareUrl').value = this.shareUrl(this.me);
    document.getElementById('shareSheet').hidden = false;
  },

  plainText(m) {
    const d = m || this.me;
    const L = [`【兽设名片】${d.name || '未命名'}`];
    if (d.species) L.push(`兽种：${d.species}`);
    if (d.city) L.push(`位置：${d.city === '__custom' ? '自定义坐标' : d.city}`);
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

  /* ---------- 导出 PNG（含图片） ---------- */
  async exportPng() {
    this.readForm();
    const d = this.me;
    const s = DATA.seed(d.seed);
    const W = 680, H = 900;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const F = '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';

    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);

    // 背景图 or 渐变
    const bgIm = await Img.load(d.bgImg);
    if (bgIm) {
      const sc = Math.max(W / bgIm.width, 216 / bgIm.height);
      const dw = bgIm.width * sc, dh = bgIm.height * sc;
      g.drawImage(bgIm, (W - dw) / 2, (216 - dh) / 2, dw, dh);
    } else {
      const grd = g.createLinearGradient(0, 0, W, 216);
      grd.addColorStop(0, s.c); grd.addColorStop(1, s.c2);
      g.fillStyle = grd; g.fillRect(0, 0, W, 216);
    }

    // 头像
    const ax = 48, ay = 140, as = 152;
    g.fillStyle = '#FFFFFF'; this.roundRect(g, ax, ay, as, as, 32); g.fill();
    const avIm = await Img.load(d.avatarImg);
    if (avIm) {
      g.save();
      this.roundRect(g, ax + 6, ay + 6, as - 12, as - 12, 26); g.clip();
      const sc = Math.max((as - 12) / avIm.width, (as - 12) / avIm.height);
      const dw = avIm.width * sc, dh = avIm.height * sc;
      g.drawImage(avIm, ax + 6 + (as - 12 - dw) / 2, ay + 6 + (as - 12 - dh) / 2, dw, dh);
      g.restore();
    } else {
      g.font = `84px ${F}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(d.emoji || '🦊', ax + as / 2, ay + as / 2 + 6);
    }

    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    let y = 216 + 76;
    g.fillStyle = '#1C1B1F'; g.font = `600 42px ${F}`;
    g.fillText(d.name || '未命名', 48, y);
    y += 34;
    if (d.species) { g.fillStyle = '#79757F'; g.font = `400 24px ${F}`; g.fillText(d.species, 48, y); y += 30; }
    if (d.city) {
      g.fillStyle = '#79757F'; g.font = `400 22px ${F}`;
      g.fillText('📍 ' + (d.city === '__custom' ? '自定义位置' : d.city), 48, y); y += 34;
    }

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
        g.fillStyle = c + '22'; this.roundRect(g, tx, y - 26, w, 38, 19); g.fill();
        g.fillStyle = c; g.fillText(t, tx + 14, y);
        tx += w + 10;
      }
      y += 34;
    }

    if (d.bio) {
      y += 16;
      g.fillStyle = '#49454F'; g.font = `400 24px ${F}`;
      for (const ln of this.wrap(g, d.bio, W - 96, 34)) { g.fillText(ln, 48, y); y += 34; }
    }

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
        g.fillStyle = '#79757F'; g.font = `400 23px ${F}`; g.fillText(k, 48, y + 14);
        g.fillStyle = '#1C1B1F'; g.fillText(v, 140, y + 14);
        y += 52;
      }
    }
    if (QQ.valid(d.qq) && !d.hideContact) {
      y += 12;
      g.fillStyle = s.c; this.roundRect(g, 48, y - 30, W - 96, 62, 16); g.fill();
      g.fillStyle = '#FFFFFF'; g.font = `500 26px ${F}`;
      g.fillText(`加 QQ 好友  ${d.qq}`, 72, y + 8);
      y += 62;
    }

    g.fillStyle = '#CAC4D0'; g.font = `400 20px ${F}`; g.textAlign = 'center';
    g.fillText(d.hideContact ? '用 Furry 扩列地图制作 · 联系方式已隐藏' : '用 Furry 扩列地图制作', W / 2, H - 40);

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
    const out = []; let cur = '';
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
    const blob = new Blob([JSON.stringify({ me: this.me, wall: this.wall }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'furrymap-backup.json';
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
        if (o.me) { this.me = { ...this.blank(), ...o.me }; this.persist(); this.fillForm(this.me); }
        if (Array.isArray(o.wall)) { this.wall = o.wall; Store.saveWall(this.wall); }
        this.applySeed(this.me.seed || 'violet');
        this.renderPickers(); this.renderCard(); this.renderWall();
        this.updateImgNote(); this.updateStat();
        this.toast('备份已导入');
      } catch (err) { this.toast('这个文件读不出来'); }
    };
    rd.readAsText(f);
    e.target.value = '';
  },

  updateStat() {
    const n = Store.usage();
    document.getElementById('dataStat').textContent =
      `我的名片 1 份 · 扩列墙 ${this.wall.length} 位 · 占用约 ${(n / 1024).toFixed(1)} KB`;
  },

  go(v) {
    this.view = v;
    ['card', 'wall', 'map', 'settings'].forEach(x =>
      document.getElementById('view-' + x).hidden = x !== v);
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    window.scrollTo({ top: 0 });
    if (v === 'map') this.renderMap();
  },

  copy(text, msg) {
    const done = () => this.toast(msg);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(() => this.fallbackCopy(text, done));
    } else this.fallbackCopy(text, done);
  },
  fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); }
    catch (e) { this.toast('复制失败，请手动选择'); }
    ta.remove();
  },
  toastTimer: null,
  toast(msg) {
    const el = document.getElementById('snackbar');
    el.textContent = msg; el.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
  },
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
