'use strict';

const campuses = ['仙林','鼓楼'];
const topics = ['随便聊聊','电影','摄影','阅读','运动','游戏','音乐','美食','校园生活','学习交流','清淡口味','辣口'];
const seed = [
  {id:'lunch',campus:'仙林',title:'下课一起吃午饭',type:'daily',place:'校园食堂 · 公共入口',time:'12:15',price:20,size:2,description:'各自点餐、各自付款，吃完各自安排。'},
  {id:'movie',campus:'仙林',title:'午饭聊电影',type:'interest',place:'校园食堂 · 公共入口',time:'12:20',price:22,size:3,description:'聊聊最近看过的电影，欢迎第一次参加。'},
  {id:'combo',campus:'仙林',title:'校门口双人套餐',type:'deal',place:'米饭小馆 · 示例门店',time:'12:30',price:25,size:2,shop:'rice',description:'双人堂食共 ¥50，到店付款后凭演示码核销。'},
  {id:'gulou-lunch',campus:'鼓楼',title:'鼓楼食堂午饭搭子',type:'daily',place:'校园食堂 · 公共入口',time:'12:20',price:18,size:2,description:'工作日午饭，各自点餐。'},
  {id:'gulou-read',campus:'鼓楼',title:'午休聊一本书',type:'interest',place:'校园食堂 · 公共入口',time:'12:25',price:20,size:3,description:'自带一个最近喜欢的书名。'},
  {id:'gulou-deal',campus:'鼓楼',title:'双人面食组合',type:'deal',place:'街角面铺 · 示例门店',time:'12:35',price:22,size:2,shop:'noodle',description:'双人堂食共 ¥44，到店付款后凭演示码核销。'}
];
const shops = [
  {id:'rice',campus:'仙林',name:'米饭小馆',style:'简餐',price:25,detail:'双人鸡肉饭组合 · ¥50 / 两人',meal:'combo',image:'meal.webp'},
  {id:'tea',campus:'仙林',name:'午后轻食',style:'轻食',price:23,detail:'适合两三人午餐，可各自点单。'},
  {id:'noodle',campus:'鼓楼',name:'街角面铺',style:'面食',price:22,detail:'双人面食组合 · ¥44 / 两人',meal:'gulou-deal',image:'meal.webp'},
  {id:'bistro',campus:'鼓楼',name:'日常食堂小馆',style:'家常菜',price:20,detail:'适合临时约饭，按个人预算点餐。'}
];
const packageMenus = {
  rice:{name:'双人鸡肉饭组合',total:50,items:'鸡肉饭两份',seedId:'combo'},
  tea:{name:'双人轻食组合',total:46,items:'轻食碗两份'},
  noodle:{name:'双人面食组合',total:44,items:'面食两份',seedId:'gulou-deal'},
  bistro:{name:'双人家常午餐',total:40,items:'家常主菜两份'}
};
const people = [
  {name:'小林',campus:'仙林',tags:['电影','摄影','美食','校园散步'],meal:'movie',note:'最近在补老电影，午饭想聊点轻松的。'},
  {name:'阿禾',campus:'仙林',tags:['随便聊聊','清淡口味','校园生活'],meal:'lunch',note:'下课就去食堂，聊不聊都可以。'},
  {name:'小周',campus:'仙林',tags:['运动','美食','辣口'],meal:'combo',note:'想凑份双人餐，喜欢聊跑步和吃的。'},
  {name:'阿书',campus:'鼓楼',tags:['阅读','电影','学习交流'],meal:'gulou-read',note:'午饭想换换脑子，欢迎互推书和电影。'},
  {name:'见山',campus:'鼓楼',tags:['随便聊聊','音乐','校园生活'],meal:'gulou-lunch',note:'午饭时间比较固定，想找个同路搭子。'},
  {name:'小满',campus:'鼓楼',tags:['美食','游戏','辣口','桌游'],meal:'gulou-deal',note:'想试双人面食组合，游戏也可以聊。'}
];
const cleanProfile = () => ({name:'',campus:'仙林',time:'any',budget:25,tags:[],bio:''});
const labels = {all:'全部饭局',daily:'日常搭饭',interest:'兴趣搭饭',deal:'优惠搭饭'};
const key = 'fandianjian-campus-v1';
const initial = () => ({published:[], bookings:{}, hidden:[], favorites:[], profile:cleanProfile()});
const readState = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(key));
    return raw && Array.isArray(raw.published) && raw.bookings && Array.isArray(raw.hidden) ? {...raw, favorites:Array.isArray(raw.favorites) ? raw.favorites : [], profile:{...cleanProfile(), ...raw.profile}} : initial();
  } catch { return initial(); }
};
const app = document.getElementById('app');
const dialog = document.getElementById('dialog');
const dialogContent = document.getElementById('dialogContent');
const notice = document.getElementById('notice');
let state = readState();
const views = {browse:browseView,match:matchView,shops:shopsView,mine:myView,profile:profileView,buddies:buddiesView,store:storeView};
function tabFromLocation() {
  const hash=globalThis.location?.hash || '';
  const page=hash.startsWith('#view-') ? hash.slice(6) : '';
  return Object.hasOwn(views,page) ? page : 'browse';
}
let tab = tabFromLocation();
let campus = campuses.includes(state.profile.campus) ? state.profile.campus : '仙林';
let category = 'all';
let maxBudget = 0;
let timeWindow = 'all';
let merchantCode = '';
let onlyCompatible = false;
let onlySavedShops = false;
function defaultBookingView() {
  const records=Object.values(state.bookings);
  const active=records.some(record=>['pending','confirmed'].includes(record.phase)) ||
    state.published.some(item=>!state.bookings[item.id]);
  const history=records.some(record=>['completed','cancelled'].includes(record.phase));
  return active || !history ? 'active' : 'history';
}
let bookingView = defaultBookingView();
let toastTimeout;

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function button(label, action, value = '', style = 'outline', disabled = false) {
  return '<button type="button" class="' + style + '" data-action="' + action + '" data-value="' + escapeText(value) + '"' + (disabled ? ' disabled':'') + '>' + label + '</button>';
}
function save(message) {
  try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  render();
  if (toastTimeout) globalThis.clearTimeout?.(toastTimeout);
  notice.textContent = message;
  toastTimeout=globalThis.setTimeout?.(()=>{ notice.textContent=''; },4500);
}
function meals() { return [...seed, ...state.published]; }
function meal(id) { return meals().find(item => item.id === id); }
function inCampus(item) { return (item.campus || '仙林') === campus; }
function normalizedTags(values) {
  const tags=new Map();
  values.forEach(value=>{
    const label=value.normalize('NFKC').trim();
    if (label && !tags.has(label.toLowerCase())) tags.set(label.toLowerCase(),label);
  });
  return [...tags.values()];
}
function matchPerson(person, profile) {
  const item=meal(person.meal);
  const mine=new Set(normalizedTags(profile.tags).map(tag=>tag.toLowerCase()));
  const common=normalizedTags(person.tags).filter(tag=>mine.has(tag.toLowerCase()));
  const wantsTime=profile.time!=='any';
  const timeFit=inTimeWindow(item.time,profile.time);
  const budgetFit=item.price <= profile.budget;
  const sameCampus=person.campus===profile.campus;
  const maxPoints=25+20+(wantsTime?20:0)+(mine.size?35:0);
  const tagPoints=mine.size ? 35*Math.min(1,common.length/Math.min(3,mine.size)) : 0;
  const points=(sameCampus?25:0)+(budgetFit?20:0)+(wantsTime&&timeFit?20:0)+tagPoints;
  return {score:Math.round(100*points/maxPoints),common,timeFit,budgetFit,sameCampus,wantsTime};
}
function campusChooser() {
  return '<label class="campus-control" for="campusSelect"><span>校区</span><select id="campusSelect" data-filter="campus" aria-label="浏览校区">' +
    options(campuses.map(value=>[value,value+'校区']),campus) + '</select></label>';
}
const timeCutoff='12:25';
function inTimeWindow(time, preference) {
  return preference==='all' || preference==='any' ||
    (preference==='early' ? time<timeCutoff : time>=timeCutoff);
}
function budgetChoices() {
  const amounts=[20,25,35];
  if (maxBudget && !amounts.includes(maxBudget)) amounts.push(maxBudget);
  return [['0','全部预算'],...amounts.sort((a,b)=>a-b).map(value=>[String(value),'¥'+value+' 以内'])];
}
function listing() {
  return meals().filter(item => !state.hidden.includes(item.id) && inCampus(item) &&
    (category === 'all' || item.type === category) &&
    (!maxBudget || item.price <= maxBudget) &&
    inTimeWindow(item.time,timeWindow))
    .sort((first, second) => first.time.localeCompare(second.time));
}
function options(entries, selected) {
  return entries.map(([value,label]) => '<option value="' + value + '"' +
    (value === selected ? ' selected' : '') + '>' + label + '</option>').join('');
}
function tag(item) { return '<span class="tag ' + item.type + '">' + (item.external ? '外部套餐' : labels[item.type]) + '</span>'; }
function priceText(amount) {
  return Number(amount).toFixed(2).replace(/\.?0+$/,'');
}
function priceDescription(item) {
  return item.type === 'deal' ? ' · 双人共 ¥' + priceText(item.total ?? item.price*2) : '预算';
}
function parsedShare(raw) {
  const url=raw.match(/https?:\/\/[^\s，。；、！）<>]+/i)?.[0]?.replace(/[),.;]+$/,'') || '';
  const withoutUrl=url ? raw.replace(url,'') : raw;
  const lines=withoutUrl.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const title=(withoutUrl.match(/【([^】]{1,45})】/)?.[1] ||
    lines.find(line=>/(双人|2\s*人|两人)/.test(line)) || '').replace(/^[【「『]|[】」』]$/g,'').slice(0,45);
  const prices=[...withoutUrl.matchAll(/(?:双人总价|套餐总价|总价|到手价)\s*[:：]?\s*[¥￥]?\s*(\d+(?:\.\d{1,2})?)/g)];
  const match=prices.length===1 ? prices[0] : null;
  const before=match ? withoutUrl.slice(0,match.index).split(/[，,；;\n]/).pop() : '';
  const after=match ? withoutUrl.slice(match.index+match[0].length) : '';
  const amount=match && !/(人均|每人)\s*$/.test(before) &&
    !/^\s*(?:元\s*)?(?:[／/]\s*人|每人|人均)/.test(after) ? match[1] : '';
  return {url,title,amount};
}
function recruitmentText(item) {
  const total=priceText(item.total ?? item.price*2);
  return '【'+item.campus+'校区午餐找搭子】'+item.title+'\n'+item.time+'｜'+item.place+
    '｜双人共 ¥'+total+'（约 ¥'+priceText(item.price)+'/人）\n还差一位，想一起吃可以回复我。'+
    (item.external?'\n优惠、可用时间和退款以原购买渠道为准。':'')+
    (item.source?'\n套餐链接：'+item.source:'');
}
function copyDialog(text) {
  openDialog('分享约饭招募','<label for="recruitText">可发到班群或发给同学</label><textarea id="recruitText" readonly rows="6">' +
    escapeText(text)+'</textarea><div class="actions">'+button('复制招募','copyRecruit','','primary')+
    (globalThis.navigator?.share ? button('分享给同学','shareRecruit') : '')+'</div>');
}
async function shareRecruitment() {
  const draft=document.getElementById('recruitText');
  if (!draft || !globalThis.navigator?.share) return;
  try {
    await navigator.share({text:draft.value});
  } catch (error) {
    if (error.name!=='AbortError') {
      const label=dialogContent.querySelector('label');
      if (label) label.textContent='系统分享暂不可用，可以点「复制招募」。';
    }
  }
}
async function copyRecruitment() {
  const draft=document.getElementById('recruitText');
  if (!draft) return;
  try {
    await navigator.clipboard.writeText(draft.value);
    notice.textContent='已复制招募文案，可粘贴发给同学。';
    dialog.close();
  } catch {
    draft.focus();
    draft.select();
    notice.textContent='已选中招募文案，可用手机的复制菜单。';
    const label=dialogContent.querySelector('label');
    if (label) label.textContent='已选中文案，请长按选择「复制」';
  }
}
function windowTitle(title, desc) {
  return '<div class="page"><div class="page-heading"><h1>' + title + '</h1><p class="muted subtext">' + desc + '</p></div>';
}
function openDialog(title, content, style = '') {
  dialog.classList?.toggle('package-dialog',style==='package');
  dialogContent.innerHTML = '<div class="row"><h2 id="dialogTitle" tabindex="-1">' + title + '</h2>' +
    button('关闭','close','','link-button') + '</div>' + content;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  document.getElementById('dialogTitle')?.focus({preventScroll:true});
}
function homeStatus() {
  const entries=Object.entries(state.bookings).reverse().filter(([id])=>meal(id));
  const next=entries.find(([,record])=>record.phase==='confirmed') ||
    entries.find(([,record])=>record.phase==='pending');
  const posted=state.published.filter(item=>!state.bookings[item.id]).at(-1);
  const review=entries.find(([,record])=>record.phase==='completed' && record.own===undefined);
  const primary=next ? meal(next[0]) : posted || (review && meal(review[0]));
  if (!primary) return '';
  const status=next ? (next[1].phase==='confirmed'?'已确认赴约':'等搭子确认') :
    posted ? '已发招募' : '待填写饭后反馈';
  return '<section class="home-status" aria-label="你的饭局进度"><span class="status-mark" aria-hidden="true">◷</span>'+
    '<div><span class="subtle">'+status+'</span><h2>'+escapeText(primary.title)+'</h2><p>'+
    escapeText(primary.campus || '仙林')+'校区 · '+escapeText(primary.time)+' · '+escapeText(primary.place)+'</p></div>'+
    button('查看饭局','openMine',next || !posted ? primary.id : '','outline')+'</section>';
}
function packagePhoto(shop, extraClass='') {
  return '<span class="package-photo '+extraClass+'"><img src="package-'+shop.id+
    '.webp" alt="'+packageMenus[shop.id].name+'的示例餐品" loading="lazy" decoding="async"></span>';
}
function homePackages() {
  const cards=shops.filter(inCampus).map(shop=>{
    const pack=packageMenus[shop.id];
    return '<button class="home-package" data-action="shopPackages" data-value="'+shop.id+'">'+
      packagePhoto(shop)+'<span class="home-package-body"><span class="subtle">'+shop.name+' · '+shop.style+
      '</span><strong>'+pack.name+'</strong><span class="food-availability">'+packageStatus(shop)+'</span><span class="home-package-price">¥'+priceText(pack.total)+
      ' <small>两人合计</small><span class="home-package-arrow" aria-hidden="true">→</span></span></span></button>';
  }).join('');
  return '<section class="home-packages" aria-labelledby="homePackagesTitle"><div class="row home-packages-heading">'+
    '<div><h2 id="homePackagesTitle">推荐双人餐</h2><p class="muted subtext">'+campus+
    '校区 · 两人到店价（演示）</p></div>'+
    button('全部店铺','toShops','','link-button')+'</div><div class="home-packages-grid">'+cards+'</div></section>';
}
function browseView() {
  const chips = Object.entries(labels).map(([value,label]) =>
    '<button data-action="filter" data-value="' + value + '" aria-pressed="' + (value === category) + '">' + label + '</button>').join('');
  const visibleMeals = listing();
  const cards = visibleMeals.map(item => {
    const record = state.bookings[item.id];
    const booked = record && record.phase !== 'cancelled';
    const availability = booked ? '我的饭局' : item.id.startsWith('p-') ? '我发布的饭局' : '还差 1 人';
    return '<article class="card meal-card"><div class="row"><div>' + tag(item) + '</div><span class="subtle">' + availability + '</span></div>' +
      '<h3>' + escapeText(item.title) + '</h3><p class="slot">' + escapeText(item.time) + ' · ' + (item.campus || '仙林') + '</p>' +
      '<p class="muted">' + escapeText(item.place) + ' · ' + item.size + ' 人局</p><p class="card-desc">' + escapeText(item.description) + '</p><div class="row"><span class="amount">¥' + item.price +
      ' <small>/ 人' + priceDescription(item) + '</small></span>' +
      button(booked ? '查看进度' : '查看饭局',booked ? 'openMine' : 'detail',item.id) + '</div></article>';
  }).join('');
  return '<div class="discover"><div class="discover-top">' +
    '<div class="discover-campus"><span class="location-dot" aria-hidden="true"></span><span>南京大学</span>' +
    campusChooser() + '</div><span class="discover-time">午餐 · 12:00–13:00</span></div>' +
    homeStatus() +
    '<section class="hero"><div class="hero-copy"><span class="eyebrow">午餐约饭</span>' +
    '<h1>饭点到了，<br>一起吃吧。</h1><p>约同校同学，在食堂或校门口见。</p>' +
    button('看午餐饭局 <span aria-hidden="true">↗</span>','jump','','primary') + '</div>' +
    '<div class="hero-image"><img src="hero-table.webp" alt="" fetchpriority="high"></div></section>' +
    '<nav class="shortcuts" aria-label="约饭方式">' +
    [['daily','日常搭饭','按时间和预算挑饭局','quickCategory','daily'],
      ['interest','兴趣找搭子','找聊得来的搭子','toMatch',''],
      ['deal','选双人餐','从套餐开始组队','toShops','']].map(([type,title,desc,action,value])=>
      '<button class="shortcut '+type+'" data-action="'+action+'" data-value="'+value+'">'+
      '<img src="shortcut-'+type+'.webp" alt="" width="64" height="64"><span class="shortcut-copy"><strong>'+
      title+'</strong><small>'+desc+'</small></span><span class="shortcut-arrow" aria-hidden="true">↗</span></button>').join('') +
    '</nav>' + homePackages() +
    '<section class="paste-strip" aria-label="外部套餐招募"><div><strong>在别处看到双人餐？</strong>'+
    '<p>粘贴套餐分享文案，确认信息后发招募。</p></div>'+
    button('粘贴双人餐','pastePackage','','outline')+'</section>' +
    '<section id="results" tabindex="-1" aria-label="午餐饭局"><div class="row"><div><h2>午餐饭局</h2><p class="muted subtext">12:00–13:00 · 试点演示</p></div><div class="browse-actions">' +
    button('＋ 发布饭局','publish','','primary') + '</div>' + '</div><div class="filter-bar"><div class="chips" aria-label="饭局类型">' + chips + '</div>' +
    '<div class="filter-fields"><label for="timeWindow">时间<select id="timeWindow" data-filter="time">' +
    options([['all','全部时段'],['early',timeCutoff+' 前'],['late',timeCutoff+' 起']],timeWindow) + '</select></label>' +
    '<label for="maxBudget">每人预算<select id="maxBudget" data-filter="budget">' +
    options(budgetChoices(),String(maxBudget)) +
    '</select></label></div></div><div class="row result-toolbar"><p class="results-count" role="status">共 ' + visibleMeals.length + ' 场饭局</p>' +
    (state.profile.saved ? button('用我的午餐偏好','usePreferences','','link-button') : '') + '</div>' +
    (cards ? '<div class="grid">' + cards + '</div>' :
      '<div class="empty"><p>当前筛选下没有饭局。</p>' + button('清除筛选','clearFilters') + '</div>') + '</section></div>';
}
function matchView() {
  const profile=state.profile;
  const hasPreferences=Boolean(profile.saved);
  const sorted=people.filter(person=>person.campus===campus && !state.hidden.includes(person.meal) &&
    !['pending','confirmed','completed'].includes(state.bookings[person.meal]?.phase))
    .map(person=>({...person, ...matchPerson(person,profile)}))
    .filter(person=>!hasPreferences || !onlyCompatible || (person.budgetFit && person.timeFit))
    .sort((a,b)=>hasPreferences ? b.score-a.score : 0);
  const cards=sorted.map(person=>{
    const q=meal(person.meal);
    const reasons=hasPreferences ? [
      person.sameCampus?'同校区':'跨校区',
      ...(person.wantsTime?[person.timeFit?'饭点合适':'饭点不同']:[]),
      person.budgetFit?'符合预算':'超出预算',
      ...person.common.map(tag=>'共同兴趣 · '+tag)
    ] : person.tags;
    return '<article class="card person-card"><div class="row"><div class="person-name"><span class="avatar">' +
      escapeText(person.name.slice(-1)) + '</span><div><h3>' + person.name + '</h3><span class="subtle">' +
      person.campus + '校区 · 示例搭子</span></div></div>' +
      (hasPreferences ? '<div class="score"><strong>' + person.score + '%</strong><span>偏好匹配</span></div>' : '') +
      '</div>' + (hasPreferences ? '<div class="match-meter" aria-hidden="true"><span style="width:' + person.score + '%"></span></div>' : '') + '<p class="card-desc">' + person.note + '</p><p class="slot">' + q.time + ' · ¥' + q.price +
      ' / 人</p><div class="reason-tags">' + reasons.map(reason=>'<span>' + escapeText(reason) + '</span>').join('') +
      '</div><div class="actions">' + button('查看这场饭局','detail',person.meal,'outline') + '</div></article>';
  }).join('');
  return windowTitle('找匹配搭子','查看同校区的搭子与具体饭局，再决定是否加入。') +
    '<div class="row view-controls">' + campusChooser() + button(hasPreferences?'修改我的偏好':'先设置我的偏好','toProfile','','primary') + '</div>' +
    (hasPreferences ? '<div class="match-toolbar"><label><input type="checkbox" data-filter="compatible"' +
      (onlyCompatible?' checked':'') + '> 只看时间和预算合适的搭子</label><span class="subtle">按偏好匹配度排序</span></div>' :
      '<p class="panel">保存校区、时间或兴趣后，这里会显示分数和推荐理由。</p>') +
    (cards ? '<div class="grid">' + cards + '</div>' :
      '<div class="empty"><h3>暂时没有合适的搭子</h3><p>可以放宽时间和预算条件，或回首页查看饭局。</p>' +
      (onlyCompatible ? button('查看所有搭子','showAllMatches') : button('查看饭局','browse')) + '</div>') +
    (hasPreferences ? '<details class="panel match-explain"><summary>匹配度怎么算？</summary><p>同校区权重 25，预算 20。设置具体饭点后加入时间权重 20，填写标签后加入兴趣权重 35。共同标签的得分最多按 3 个计算。总分按已启用的条件折算为百分比，表示饭局与偏好的适配程度。</p></details>' : '') + '</div>';
}
function shopsView() {
  const available=shops.filter(inCampus).filter(shop=>!onlySavedShops || state.favorites.includes(shop.id));
  return windowTitle('店铺推荐','按校区看午餐选项。门店、价格和套餐均为演示数据。') +
    '<div class="row view-controls">' + campusChooser() + button('粘贴双人餐','pastePackage') + '<label><input type="checkbox" data-filter="favorites"' +
    (onlySavedShops?' checked':'') + '> 只看收藏</label></div>' +
    (available.length ? '<div class="grid shop-grid">' + available.map(shop=>{
      const saved=state.favorites.includes(shop.id);
      const pack=packageMenus[shop.id];
      return '<article class="card shop-card pro-shop-card">'+packagePhoto(shop,'shop-photo')+
        '<div class="shop-body"><div class="row"><span class="tag">'+shop.style+'</span>'+
        '<button type="button" class="favorite" data-action="favorite" data-value="'+shop.id+'" aria-label="'+
        (saved?'取消收藏':'收藏')+shop.name+'" aria-pressed="'+saved+'">'+
        (saved?'已收藏':'收藏')+'</button></div><h3>'+shop.name+'</h3><p class="muted">'+pack.name+'</p><p class="food-availability">'+packageStatus(shop)+'</p>'+
        '<div class="shop-price-row"><span class="amount">¥'+priceText(pack.total)+' <small>双人</small></span>'+
        button('看套餐找搭档','shopPackages',shop.id,'primary')+'</div></div></article>';
    }).join('') + '</div>' : '<div class="empty"><h3>本校区还没有收藏</h3>' +
    button('查看所有店铺','showAllShops') + '</div>') + '</div>';
}
function packageSessions(shop) {
  const ready=seed.filter(item=>item.shop===shop.id && item.type==='deal' && !state.hidden.includes(item.id));
  const own=state.published.filter(item=>item.shop===shop.id && item.type==='deal' && !state.hidden.includes(item.id));
  const active=[...ready,...own].find(item=>['pending','confirmed'].includes(state.bookings[item.id]?.phase));
  const available=ready.find(item=>!state.bookings[item.id] || state.bookings[item.id].phase==='cancelled');
  const recruiting=own.find(item=>!state.bookings[item.id]);
  return {ready,own,active,available,recruiting};
}
function packageStatus(shop) {
  const {active,available,recruiting}=packageSessions(shop);
  if (active) return state.bookings[active.id].phase==='confirmed'?'双方已确认':'等搭子确认';
  if (available) return available.time+' · 还差 1 人';
  if (recruiting) return '你已发起招募';
  return '可以发起招募';
}
function shopPackages(shop) {
  const pack=packageMenus[shop.id];
  if (!pack) return;
  const {ready,own,active,available,recruiting}=packageSessions(shop);
  const mainSession=active || available || recruiting;
  const footer=active ? button('查看我的饭局','openMine',active.id,'primary') :
    available ? button('加入 '+escapeText(available.time)+' 饭局','apply',available.id,'primary') :
    recruiting ? button('复制现有招募','showRecruit',recruiting.id,'primary') :
    button('发起套餐招募','packageCreate',shop.id,'primary');
  const sessions=[...ready,...own].map(item=>{
    const phase=state.bookings[item.id]?.phase;
    const owned=own.includes(item);
    const status={pending:'等搭子确认',confirmed:'双方已确认',completed:'已完成'}[phase] ||
      (owned ? phase==='cancelled'?'我的饭局 · 已取消':'我发起的饭局 · 招募中' : '还差 1 人 · 双人堂食');
    let actionButton='';
    if (item.id!==mainSession?.id) {
      if (owned && !phase) actionButton=button('复制招募','showRecruit',item.id);
      else if (!owned && (!phase || phase==='cancelled')) actionButton=button('申请加入','apply',item.id);
      else actionButton=button('查看饭局','openMine',item.id);
    }
    return '<div class="receipt"><div><strong class="session-time">'+escapeText(item.time)+'</strong><p class="subtle">'+
      status+'</p></div>'+actionButton+'</div>';
  }).join('');
  openDialog(shop.name,
    packagePhoto(shop,'offer-image')+
    '<section class="offer-preview offer-detail"><div class="row"><span class="tag deal">示例双人餐</span>'+
    '<span class="subtle">'+shop.campus+'校区 · 12:00–13:00</span></div><h3>'+pack.name+
    '</h3><p>'+pack.items+'</p><div class="offer-price"><span class="amount">¥'+priceText(pack.total)+
    ' <small>两人合计</small></span><span>约 ¥'+priceText(pack.total/2)+'/人</span></div>'+
    '<p class="subtle">到店堂食 · 模拟核销</p></section>'+
    '<section class="offer-sessions"><h3 class="offer-heading">这个套餐的饭局</h3>' +
    (sessions || '<p class="muted">暂时没人组队，可以发起首场招募。</p>')+
    '</section><div class="offer-footer">'+footer+
    (mainSession ? button('另约一个饭点','packageCreate',shop.id,'link-button') : '')+'</div>','package');
}
function packageField(name,label,input) {
  return '<div class="package-field"><label for="pack-'+name+'">'+label+'</label>'+input+
    '<p id="pack-'+name+'-hint" class="subtle field-hint" aria-live="polite"></p>'+
    '<p id="pack-'+name+'-error" class="field-error" hidden></p></div>';
}
function openPackageForm(shop) {
  const pack=shop ? packageMenus[shop.id] : null;
  openDialog(shop ? '发起套餐招募' : '粘贴双人餐',
    '<form id="packageForm" data-shop="' + (shop?.id || '') + '" novalidate>' +
    '<div id="packageError" class="package-errors" tabindex="-1" role="alert" hidden></div>' +
    (shop ? '<p class="stat">'+pack.name+' · 双人共 ¥'+priceText(pack.total)+' · '+shop.campus+'校区</p>' :
      '<p>粘贴分享文案或链接，核对套餐信息后生成招募。</p>'+
      '<label for="packagePaste">链接或分享文案</label><textarea id="packagePaste" name="raw" rows="3" maxlength="3500" placeholder="例如：双人午餐套餐，双人合计 ¥58，附分享链接"></textarea>'+
      '<div class="row parse-controls">'+button('识别文案','parsePackage')+'<p class="subtle" id="packageParseStatus" role="status"></p></div>'+
      packageField('title','套餐名称','<input id="pack-title" name="title" required maxlength="45" aria-describedby="pack-title-hint pack-title-error" placeholder="例如 双人午餐套餐">')+
      packageField('place','门店或集合地点','<input id="pack-place" name="place" required maxlength="35" aria-describedby="pack-place-hint pack-place-error" placeholder="填写实际门店或公共集合点">')+
      packageField('total','双人合计（元）','<input id="pack-total" name="total" type="number" min="0.02" max="1000" step="0.01" required aria-describedby="pack-total-hint pack-total-error" placeholder="填写两人实付总价">'))+
    packageField('time','午餐时间','<input id="pack-time" name="time" type="time" min="12:00" max="13:00" value="12:30" aria-describedby="pack-time-hint pack-time-error" required>')+
    '<p class="subtle">'+(shop?'发布后可以复制招募文案。':'购买、验券及退款按原渠道规则办理。')+
    '</p><button type="submit" class="primary">发起并生成招募</button></form>');
}
function fillPackageFromShare(form) {
  if (!form?.elements.raw) return;
  const parsed=parsedShare(form.elements.raw.value);
  const suggestions={title:parsed.title,total:parsed.amount};
  for (const field of ['title','place','total']) {
    const input=form.elements[field];
    const hint=document.getElementById('pack-'+field+'-hint');
    const suggestion=suggestions[field];
    if (suggestion && !input.value.trim()) {
      input.value=suggestion;
      input.removeAttribute('aria-invalid');
      document.getElementById('pack-'+field+'-error').hidden=true;
      hint.textContent='已从文案识别，请核对。';
    } else {
      hint.textContent=input.value.trim() ? '已保留当前填写。' : '请手动补填。';
    }
  }
  document.getElementById('packageParseStatus').textContent=parsed.url ?
    '已保留原链接。' : parsed.title || parsed.amount ? '识别结果已标在对应字段下方。' : '可直接填写下面的套餐信息。';
  const summary=document.getElementById('packageError');
  if (summary && !summary.hidden) showPackageErrors(form,packageErrors(new FormData(form),false),false);
}
function packageErrors(fields, hasShop) {
  const errors={};
  if (!hasShop) {
    const title=String(fields.get('title')||'').trim();
    const place=String(fields.get('place')||'').trim();
    const total=String(fields.get('total')||'').trim();
    if (!title || title.length>45) errors.title='请输入 1–45 字的套餐名称。';
    if (!place || place.length>35) errors.place='请输入 1–35 字的门店名或集合点。';
    if (!/^\d+(?:\.\d{1,2})?$/.test(total) || Number(total)<0.02 || Number(total)>1000) {
      errors.total='请输入 ¥0.02 到 ¥1000 的双人总价，最多两位小数。';
    }
  }
  if (!/^(?:12:[0-5]\d|13:00)$/.test(fields.get('time')||'')) errors.time='请选择 12:00 至 13:00 的午餐时间。';
  return errors;
}
function showPackageErrors(form, errors, focus = true) {
  for (const name of ['title','place','total','time']) {
    const error=document.getElementById('pack-'+name+'-error');
    const field=form.elements?.[name];
    if (!error || !field) continue;
    error.hidden=!errors[name];
    error.textContent=errors[name]||'';
    if (errors[name]) field.setAttribute('aria-invalid','true');
    else field.removeAttribute('aria-invalid');
  }
  const summary=document.getElementById('packageError');
  const entries=Object.entries(errors);
  summary.hidden=!entries.length;
  summary.innerHTML=entries.length ? '<strong>请核对以下信息</strong><ul>'+entries.map(([name,message])=>
    '<li><button type="button" class="link-button" data-action="focusPackage" data-value="'+name+'">'+message+'</button></li>').join('')+'</ul>' : '';
  if (focus && entries.length) summary.focus();
}
function unlockedBuddies() {
  return Object.entries(state.bookings).filter(([id,record])=>
    meal(id) && record.phase==='completed' && record.own===true &&
    record.peer===true && !record.blocked
  ).sort((first,second)=>(second[1].unlockedAt||0)-(first[1].unlockedAt||0));
}
function buddyEntry() {
  const count=unlockedBuddies().length;
  return '<section class="buddy-entry"><div><h2>我的搭子</h2><p>' +
    (count ? count + ' 个双向解锁的搭子记录' : '双方都愿意再约后，记录会出现在这里。') +
    '</p></div>' + button('查看搭子','toBuddies','','outline') + '</section>';
}
function buddiesView() {
  const matches=unlockedBuddies();
  const cards=matches.map(([id,record])=>{
    const item=meal(id);
    const person=people.find(entry=>entry.meal===id);
    const name=person?.name || '这场饭局的搭子';
    const unlockedDate=Number.isFinite(record.unlockedAt) ?
      '<p class="subtle">解锁于 ' + new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeZone:'Asia/Shanghai'}).format(record.unlockedAt) + '</p>' : '';
    return '<article class="card buddy-card"><div class="row"><div class="person-name"><span class="avatar" aria-hidden="true">' +
      escapeText(person ? name.slice(-1) : '搭') + '</span><div><h3>' + escapeText(name) + '</h3><span class="subtle">' +
      escapeText(item.campus||'仙林') + '校区</span></div></div><span class="tag deal">已双向解锁</span></div>' +
      '<p class="buddy-meal"><strong>认识于</strong> ' + escapeText(item.title) + '</p>' + unlockedDate +
      '<div class="actions">' + button(record.invited?'已发出演示邀约':'再次邀约','invite',id,'primary',record.invited) +
      button('查看饭局记录','openMine',id) + '</div></article>';
  }).join('');
  return windowTitle('我的搭子','这里保存双方都愿意再次见面的搭子。') +
    '<div class="view-controls">' + button('返回我的主页','toProfile') + '</div>' +
    (cards ? '<div class="grid buddy-grid">' + cards + '</div>' :
      '<div class="empty"><h3>还没有解锁的搭子</h3><p>一起吃饭后，双方都选择愿意再约，才会出现搭子记录。单方选择只在该次饭局保留。</p>' +
      button('查看我的饭局','openMine') + '</div>') + '</div>';
}
function profileView() {
  const profile=state.profile;
  const tags=topics.map(tag=>'<label class="profile-tag"><input type="checkbox" name="tags" value="' + escapeText(tag) +
    '"' + (profile.tags.includes(tag)?' checked':'') + '><span>' + escapeText(tag) + '</span></label>').join('');
  return windowTitle('我的主页','管理自己的午餐偏好和搭子。') + buddyEntry() +
    '<section class="profile-intro"><div class="avatar">' + escapeText(profile.name.slice(0,1)||'饭') +
    '</div><div><h2>' + escapeText(profile.name||'我的午餐档案') + '</h2><p>' +
    escapeText(profile.campus) + '校区 · 人均预算 ¥' + escapeText(profile.budget) +
    '</p>' + (profile.bio ? '<p class="subtle">' + escapeText(profile.bio) + '</p>' : '') + '</div></section>' +
    '<section class="buddy-entry install-entry"><div><h2>添加到手机桌面</h2><p>从桌面图标打开饭点见。</p></div>' +
    '<button type="button" class="outline" data-install>安装方式</button></section>' +
    '<form class="panel profile-form" id="profileForm"><div class="form-grid">' +
    '<label>昵称<input name="name" maxlength="16" placeholder="例如 南雍小饭团" value="' + escapeText(profile.name) + '"></label>' +
    '<label>常用校区<select name="campus">' + options(campuses.map(value=>[value,value+'校区']),profile.campus) + '</select></label>' +
    '<label>午餐偏好<select name="time">' + options([['any','都可以'],['early','12:25 前'],['late','12:25 起']],profile.time) + '</select></label>' +
    '<label>每人预算上限（元）<input name="budget" type="number" min="5" max="200" required value="' + escapeText(profile.budget) + '"></label></div>' +
    '<fieldset><legend>兴趣和用餐标签</legend><div class="profile-tags">' + tags + '</div></fieldset>' +
    '<label>自定义标签 <span class="subtle">用逗号分隔</span><input name="custom" maxlength="72" value="' +
    escapeText(profile.tags.filter(tag=>!topics.includes(tag)).join('，')) + '" placeholder="例如 校园散步，桌游"></label>' +
    '<label>自我介绍（选填）<textarea name="bio" maxlength="100" rows="3" placeholder="聊聊你喜欢怎样吃午饭">' +
    escapeText(profile.bio) + '</textarea></label><p id="profileError" role="alert" class="form-error"></p>' +
    '<p class="subtle">最多保存 8 个标签。资料保存在当前浏览器。</p><div class="actions"><button type="submit" class="primary">保存并看匹配</button></div></form></div>';
}
function myView() {
  const rows = Object.entries(state.bookings).filter(([id,record])=>meal(id) &&
    (bookingView==='active' ? ['pending','confirmed'].includes(record.phase) : ['cancelled','completed'].includes(record.phase)))
    .reverse().map(([id,record]) => {
    const item = meal(id);
    const phases = {pending:'等另一位同学确认',confirmed:'双方已确认',completed:'饭局已完成',cancelled:'已取消'};
    const currentStep = {pending:0,confirmed:1,completed:2}[record.phase];
    const timeline = currentStep === undefined ? '' :
      '<ol class="steps" aria-label="赴约进度">' + ['申请加入','双方确认','完成饭局'].map((step,index) =>
      '<li' + (index === currentStep ? ' aria-current="step"' : '') +
      (index < currentStep ? ' class="past"' : '') + '>' + step + '</li>').join('') + '</ol>';
    const actions = [];
    let info = '';
    if (record.phase === 'pending') actions.push(button('模拟搭子确认','confirm',id,'primary'));
    if (record.phase === 'confirmed') {
      const needsRedemption=record.code && !record.redeemed;
      if (needsRedemption) {
        actions.push(button('去门店核销','toMerchant',id,'primary'),button('结束饭局','askComplete',id));
      } else {
        actions.push(button('标记就餐完成','complete',id,'primary'));
      }
      if (record.code) info = '<p class="stat">门店演示码 <span class="code">' + escapeText(record.code) + '</span> · ' +
        (record.refunded ? '已退款' : record.redeemed ? '已核销' : '待核销 · 到店付款后由门店使用') + '</p>';
    }
    if (['pending','confirmed'].includes(record.phase) && !record.redeemed) actions.push(button('取消赴约','cancel',id));
    if (record.phase==='cancelled' && item.id.startsWith('p-')) {
      actions.push(button('重新开放招募','reopenRecruit',id,'primary'),button('撤回发布','unpublish',id));
    }
    if (record.phase === 'completed') {
      info = record.code ? '<p>套餐：' + (record.refunded ? '已退款' : record.redeemed ? '已核销' : '未核销，演示码已失效') + '</p>' : '';
      if (record.own === undefined) {
        actions.push(button('饭后私密反馈','feedback',id,'primary'),button('跳过反馈','skip',id));
      } else if (record.own === true && !record.blocked) {
        info += '<p class="stat">' + (record.peer === true ? '已双向解锁 · 可再次邀约' : '暂未解锁') + '</p>';
        if (record.peer === undefined) actions.push(button('演示搭子也愿意','peerYes',id),button('演示搭子未确认','peerSkip',id));
        if (record.peer === true) {
          actions.push(button(record.invited ? '已发出演示邀约' : '再次邀约','invite',id,'primary',record.invited),
            button('去我的搭子','toBuddies'));
        }
      } else {
        info += '<p class="stat">' + (record.blocked ? '已屏蔽，搭子邀请关闭' : '已结束 · 暂未解锁') + '</p>';
      }
      if (!record.blocked) actions.push(button('屏蔽这位搭子','block',id,'link-button'));
    }
    return '<article class="panel booking-card" id="booking-' + escapeText(id) + '" tabindex="-1"><div class="row"><h3>' + escapeText(item.title) + '</h3><span class="status">' +
      phases[record.phase] + '</span></div><p class="muted">' + item.time + ' · ' + escapeText(item.place) +
      '</p>' + timeline + info + '<div class="actions">' + actions.join('') + '</div></article>';
  }).join('');
  const published = bookingView==='history' ? '' : state.published.filter(item=>!state.bookings[item.id]).map(item =>
    '<article class="panel"><div class="row"><h3>' + escapeText(item.title) + '</h3><span class="status">已发布 · 等同学加入</span></div>' +
    '<p class="muted">' + item.time + ' · ' + escapeText(item.place) + '</p><div class="actions">' +
    button('模拟同学申请','join',item.id,'primary') +
    (item.type==='deal' ? button('复制招募','showRecruit',item.id) : '') + button('撤回发布','unpublish',item.id) + '</div></article>').join('');
  return windowTitle('我的饭局','查看赴约进度和饭后回顾。') + buddyEntry() +
    '<div class="chips booking-tabs" aria-label="饭局状态">' +
    [['active','进行中'],['history','已结束']].map(([value,label])=>'<button data-action="bookingView" data-value="'+value+
    '" aria-pressed="'+(bookingView===value)+'">'+label+'</button>').join('')+'</div>' +
    (rows || published ? rows + published :
    '<div class="empty"><h3>' + (bookingView==='active'?'还没有进行中的饭局':'还没有结束的饭局') +
    '</h3>' + (bookingView==='active'?button('去找饭搭子','browse','','primary'):'') + '</div>') + '</div>';
}
function storeView() {
  const records = Object.entries(state.bookings).filter(([id,record])=>record.code && meal(id)).reverse();
  const count = records.filter(([,record]) => record.redeemed && !record.refunded).length;
  const statuses = records.map(([id,r])=>{
    const item=meal(id);
    const status=r.refunded?'已退款 · 推广费已撤销':r.redeemed?'已核销':r.phase==='confirmed'?'待核销':'已失效';
    return '<div class="receipt"><div><strong>' + escapeText(item.title) +
      '</strong><p class="subtle">' + escapeText(item.campus||'仙林') + '校区 · 套餐 ¥' + priceText(item.total ?? item.price*2) +
      ' · <span class="receipt-code">' + escapeText(r.code) + '</span></p></div><div class="receipt-status"><span class="status">' +
      status + '</span>' + (r.redeemed && !r.refunded ? button('模拟退款','askRefund',id,'link-button') : '') +
      '</div></div>';
  }).join('');
  return windowTitle('门店核销','试点演示 · 先由门店确认模拟付款，再核销活动码。') +
    '<div class="merchant-metrics" aria-label="门店演示统计">' +
    '<div><span>待核销</span><strong>' + records.filter(([,r])=>!r.redeemed && r.phase === 'confirmed').length + '</strong></div>' +
    '<div><span>有效订单</span><strong>' + count + '</strong></div>' +
    '<div><span>示例推广收入</span><strong>¥' + count*3 + '</strong></div></div>' +
    '<section class="panel"><h3>核销一笔套餐</h3><form id="redeemForm"><label for="redeemCode">饭局核销码</label>' +
    '<input id="redeemCode" name="code" required maxlength="10" placeholder="输入学生出示的代码" autocomplete="off" value="' + escapeText(merchantCode) + '">' +
    '<label><input type="checkbox" name="paid" required> 已确认这笔套餐完成付款（模拟）</label><div id="redeemError" role="alert"></div>' +
    '<button class="primary" type="submit">确认核销</button></form></section><section class="panel"><h3>核销记录</h3>' +
    (statuses || '<p class="muted">学生确认优惠饭局后会生成演示码。</p>') +
    '<p class="stat">已核销 ' + count + ' 笔 · 示例推广费合计 ¥' + count*3 + '（¥3/笔）</p></section></div>';
}
function render() {
  app.innerHTML = views[tab]();
  document.querySelectorAll('[data-nav]').forEach(el => {
    if (el.dataset.nav === tab || (tab==='buddies' && el.dataset.nav==='profile')) el.setAttribute('aria-current','page');
    else el.removeAttribute('aria-current');
  });
}
function navigate(next, updateLocation = true) {
  if (!Object.hasOwn(views,next)) return;
  if (updateLocation && globalThis.history && tabFromLocation()!==next) {
    history.pushState(null,'','#view-'+next);
  }
  if (next==='mine' && tab!=='mine') bookingView=defaultBookingView();
  tab = next;
  render();
  notice.textContent = '';
  app.focus();
  window.scrollTo(0,0);
}
function newBooking(id) { state.bookings[id] = {phase:'pending'}; }
function action(name,id) {
  const item = meal(id);
  const record = state.bookings[id];
  switch(name) {
    case 'close': dialog.close(); break;
    case 'bookingView':
      bookingView=id; render(); document.querySelector('[data-action="bookingView"][aria-pressed="true"]')?.focus(); break;
    case 'usePreferences':
      if (!state.profile.saved) break;
      campus=state.profile.campus;
      timeWindow=state.profile.time==='any'?'all':state.profile.time;
      maxBudget=state.profile.budget;
      render();
      document.getElementById('results')?.focus();
      break;
    case 'quickCategory':
      category=id; maxBudget=0; timeWindow='all'; render(); document.getElementById('results')?.focus(); break;
    case 'favorite': {
      const saved=state.favorites.includes(id);
      state.favorites=saved ? state.favorites.filter(shop=>shop!==id) : [...state.favorites,id];
      save(saved?'已取消收藏。':'已收藏到店铺栏目。');
      (document.querySelector('[data-action="favorite"][data-value="'+id+'"]') || document.querySelector('[data-filter="favorites"]'))?.focus();
      break;
    }
    case 'showAllShops': onlySavedShops=false; render(); document.querySelector('[data-filter="favorites"]')?.focus(); break;
    case 'showAllMatches': onlyCompatible=false; render(); document.querySelector('[data-filter="compatible"]')?.focus(); break;
    case 'toShops': onlySavedShops=false; navigate('shops'); break;
    case 'toMatch': navigate('match'); break;
    case 'shopPackages': {
      const shop=shops.find(entry=>entry.id===id);
      if (shop) shopPackages(shop);
      break;
    }
    case 'packageCreate': {
      const shop=shops.find(entry=>entry.id===id);
      if (shop) openPackageForm(shop);
      break;
    }
    case 'pastePackage': openPackageForm(); break;
    case 'parsePackage': fillPackageFromShare(document.getElementById('packageForm')); break;
    case 'focusPackage': document.getElementById('pack-'+id)?.focus(); break;
    case 'showRecruit':
      if (item?.type==='deal') copyDialog(recruitmentText(item));
      break;
    case 'copyRecruit': void copyRecruitment(); break;
    case 'shareRecruit': void shareRecruitment(); break;
    case 'toProfile': navigate('profile'); break;
    case 'toBuddies': navigate('buddies'); break;
    case 'shopPublish': {
      const shop=shops.find(entry=>entry.id===id);
      if (!shop) break;
      action('publish','');
      dialogContent.querySelector('[name="place"]').value=shop.name+' · 示例门店';
      break;
    }
    case 'browse': navigate('browse'); break;
    case 'openMine':
      if (dialog.open) dialog.close();
      navigate('mine');
      if (record) {
        bookingView=['pending','confirmed'].includes(record.phase)?'active':'history';
        render();
        document.getElementById('booking-'+id)?.focus();
      }
      break;
    case 'jump': document.getElementById('results').focus(); break;
    case 'toMerchant':
      if (!record?.code || record.phase !== 'confirmed' || record.redeemed) break;
      merchantCode=record.code; navigate('store'); document.getElementById('redeemCode')?.focus(); break;
    case 'clearFilters':
      category='all'; maxBudget=0; timeWindow='all'; render(); document.getElementById('results').focus(); break;
    case 'filter':
      category=id; render(); document.querySelector('[data-action="filter"][aria-pressed="true"]').focus(); break;
    case 'detail':
      if (!item) break;
      if (record && record.phase !== 'cancelled') {action('openMine',id); break;}
      openDialog(escapeText(item.title),tag(item) + '<p>' + escapeText(item.description) + '</p><p><strong>' + item.time + ' · ' + (item.campus || '仙林') + '</strong><br>' +
        escapeText(item.place) + ' · ' + item.size + ' 人 · 每人约 ¥' + item.price +
        '</p><p class="muted">双方确认后在公共地点见面。可在饭局开始前取消。</p>' +
        (item.external ? '<p class="subtle">外部套餐，请按原渠道付款、验券和退款。</p>' : '') + '<div class="actions">' +
        button(item.id.startsWith('p-') ? '模拟同学申请' : '申请加入',item.id.startsWith('p-') ? 'join' : 'apply',id,'primary') + '</div>');
      break;
    case 'publish':
      openDialog('发布午餐饭局','<form id="publishForm"><p class="muted">' + campus + '校区</p><label>饭局名称<input name="title" required maxlength="28" placeholder="例如 下课一起去校园食堂"></label>' +
        '<label>公共集合地点<input name="place" required maxlength="35" placeholder="例如 校园食堂公共入口"></label>' +
        '<div class="form-grid"><label>午餐时间<input name="time" type="time" min="12:00" max="13:00" value="12:15" required></label>' +
        '<label>人均预算（元）<input name="price" type="number" min="1" max="200" value="20" required></label>' +
        '<label>饭局人数<select name="size"><option>2</option><option>3</option><option>4</option></select></label>' +
        '<label>饭局类型<select name="type"><option value="daily">日常搭饭</option><option value="interest">兴趣搭饭</option></select></label></div>' +
        '<label>说明（可选）<textarea name="description" rows="2" maxlength="90"></textarea></label><button type="submit" class="primary">发布饭局</button></form>');
      break;
    case 'reopenRecruit':
      if (!item?.id.startsWith('p-') || record?.phase!=='cancelled') break;
      delete state.bookings[id]; bookingView='active'; save('已重新开放招募。'); break;
    case 'unpublish':
      if (!item?.id.startsWith('p-') || (record && record.phase!=='cancelled')) break;
      state.published=state.published.filter(entry=>entry.id!==id);
      delete state.bookings[id]; save('已撤回发布。'); break;
    case 'join':
    case 'apply':
      if (record && record.phase !== 'cancelled') break;
      newBooking(id);
      if (dialog.open) dialog.close();
      navigate('mine'); bookingView='active'; save('已申请加入，等搭子确认。');
      document.getElementById('booking-'+id)?.focus(); break;
    case 'confirm':
      if (record?.phase !== 'pending') break;
      record.phase = 'confirmed';
      if (item.type === 'deal' && !item.external) record.code = 'FD' + crypto.randomUUID().slice(0,8).toUpperCase();
      save('双方已确认，可以按约定赴约。'); break;
    case 'cancel':
      if (!['pending','confirmed'].includes(record?.phase) || record.redeemed) break;
      record.phase = 'cancelled'; bookingView='history'; save('已取消赴约，饭局可重新申请。'); break;
    case 'askComplete':
      if (record?.phase !== 'confirmed' || !record.code || record.redeemed) break;
      openDialog('结束未核销饭局','<p>结束后，这个演示码会失效。若已在门店付款，请先核销。</p><div class="actions">' +
        button('结束并放弃核销','complete',id,'primary') + '</div>');
      break;
    case 'complete':
      if (record?.phase !== 'confirmed') break;
      if (dialog.open) dialog.close();
      record.phase = 'completed'; bookingView='history'; save('饭局已完成，可以填写饭后反馈。'); break;
    case 'feedback':
      openDialog('饭后私密反馈','<p>体验反馈及单方选择仅用于当前演示中的个人记录。</p><form id="feedbackForm" data-id="' + id + '">' +
        '<label>这次相处怎么样？<select name="experience"><option value="">暂不评价</option><option>交流自然</option><option>还不错</option><option>有些不适应</option></select></label>' +
        '<label>想继续聊的话题（可选）<input name="topic" maxlength="60" placeholder="例如 电影、运动"></label>' +
        '<label><input type="checkbox" name="again"> 我愿意和这位同学再约</label><button class="primary" type="submit">保存私密反馈</button></form>');
      break;
    case 'skip': record.own = false; save('已跳过反馈。'); break;
    case 'peerYes':
    case 'peerSkip':
      if (record.own !== true || record.peer !== undefined || record.blocked) break;
      record.peer = name === 'peerYes';
      if (record.peer) record.unlockedAt=Date.now();
      save(record.peer ? '已双向解锁，记录已加入「我的搭子」。' : '暂未解锁。'); break;
    case 'invite': if (record.own && record.peer && !record.invited && !record.blocked) {record.invited = true; save('已发出再次邀约（演示）。');} break;
    case 'askRefund':
      if (!record?.redeemed || record.refunded) break;
      openDialog('确认模拟退款','<p>确认后，这笔订单会从有效核销和推广收入中扣除，核销码不可再次使用。</p><div class="actions">' +
        button('确认退款','refund',id,'primary') + '</div>');
      break;
    case 'refund':
      if (!record?.redeemed || record.refunded) break;
      if (dialog.open) dialog.close();
      record.refunded = true; save('已记录退款，示例推广费已从统计中扣除。'); break;
    case 'block': record.blocked = true; state.hidden.push(id); save('已屏蔽，此饭局不会再出现在推荐里。'); break;
    case 'reset':
      openDialog('重置演示','<p>清除当前浏览器里的个人资料、收藏、演示饭局、反馈与核销记录。</p><div class="actions">' +
        button('清除演示记录','confirmReset','','primary') + '</div>'); break;
    case 'confirmReset':
      state=initial(); category='all'; maxBudget=0; timeWindow='all'; merchantCode=''; campus='仙林'; onlyCompatible=false; onlySavedShops=false; bookingView='active'; dialog.close(); navigate('browse'); save('演示已重置。'); break;
  }
}
document.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.dataset.nav) navigate(target.dataset.nav);
  if (target.dataset.action) action(target.dataset.action,target.dataset.value);
});
document.addEventListener('change', event => {
  if (event.target.id==='packagePaste' && event.target.value.trim()) {
    action('parsePackage','');
    return;
  }
  if (event.target.form?.id==='packageForm') {
    const form=event.target.form;
    const summary=document.getElementById('packageError');
    if (!summary.hidden) showPackageErrors(form,packageErrors(new FormData(form),Boolean(form.dataset.shop)),false);
    return;
  }
  const filter = event.target.dataset.filter;
  if (!filter) return;
  if (filter === 'campus' && campuses.includes(event.target.value)) campus = event.target.value;
  if (filter === 'favorites') onlySavedShops=event.target.checked;
  if (filter === 'compatible') onlyCompatible=event.target.checked;
  if (filter === 'budget') maxBudget = Number(event.target.value);
  if (filter === 'time') timeWindow = event.target.value;
  render();
  document.querySelector('[data-filter="' + filter + '"]')?.focus();
});
document.addEventListener('submit', event => {
  const form = event.target;
  if (!['packageForm','profileForm','publishForm','feedbackForm','redeemForm'].includes(form.id)) return;
  event.preventDefault();
  const fields = new FormData(form);
  if (form.id === 'packageForm') {
    const shop=shops.find(entry=>entry.id===form.dataset.shop);
    const pack=shop ? packageMenus[shop.id] : null;
    const errors=packageErrors(fields,Boolean(pack));
    if (Object.keys(errors).length) {
      showPackageErrors(form,errors);
      return;
    }
    const total=pack ? pack.total : Number(fields.get('total'));
    const title=pack ? pack.name : fields.get('title').trim();
    const place=shop ? shop.name+' · 示例门店' : fields.get('place').trim();
    const time=fields.get('time');
    const source=pack ? '' : parsedShare(fields.get('raw')).url;
    const item={id:'p-'+crypto.randomUUID(),campus:shop?.campus||campus,shop:shop?.id,
      title,place,type:'deal',time,total,price:Math.round(total*50)/100,size:2,external:!pack,source,
      description:pack?'示例双人堂食，双方确认后可演示核销。':'外部双人套餐，购买与验券按原渠道规则。'};
    state.published.push(item);
    dialog.close(); navigate('mine'); bookingView='active'; save('已发布饭局。');
    copyDialog(recruitmentText(item));
  }
  if (form.id === 'profileForm') {
    const tags=[...fields.getAll('tags'),...fields.get('custom').split(/[，,、]/)];
    const unique=normalizedTags(tags);
    if (unique.length>8) {
      document.getElementById('profileError').textContent='最多选择 8 个标签，请取消几项后再保存。';
      return;
    }
    state.profile={name:fields.get('name').trim(),campus:fields.get('campus'),time:fields.get('time'),
      budget:Number(fields.get('budget')),tags:unique,bio:fields.get('bio').trim(),saved:true};
    campus=state.profile.campus;
    navigate('match'); save('已保存个人偏好，搭子推荐已更新。');
  }
  if (form.id === 'publishForm') {
    const title = fields.get('title').trim();
    const place = fields.get('place').trim();
    if (!title || !place) {
      const field = form.elements[title ? 'place' : 'title'];
      field.setCustomValidity('请填写有效内容。'); field.reportValidity();
      field.addEventListener('input',()=>field.setCustomValidity(''),{once:true}); return;
    }
    state.published.push({id:'p-'+Date.now(),campus,title,place,type:fields.get('type'),time:fields.get('time'),
      price:Number(fields.get('price')),size:Number(fields.get('size')),description:fields.get('description').trim() || '公共地点见面，各自付款。'});
    dialog.close(); navigate('mine'); bookingView='active'; save('午餐饭局已发布到当前演示。');
  }
  if (form.id === 'feedbackForm') {
    const record = state.bookings[form.dataset.id];
    if (record?.phase !== 'completed' || record.own !== undefined) return;
    record.experience = fields.get('experience');
    record.topic = fields.get('topic').trim();
    record.own = fields.has('again');
    dialog.close(); save('已保存你的饭后选择。');
  }
  if (form.id === 'redeemForm') {
    const code = fields.get('code').trim().toUpperCase();
    const record = Object.values(state.bookings).find(entry=>entry.code === code && code);
    const error = document.getElementById('redeemError');
    if (!record || record.redeemed || record.phase !== 'confirmed' || !fields.has('paid')) {
      error.textContent = record?.redeemed ? '这笔订单已核销，不能重复计费。' : '未找到可核销订单，请检查代码和饭局状态。';
      return;
    }
    record.redeemed = true; merchantCode=''; save('核销成功，已记入一笔演示推广费。');
  }
});
globalThis.addEventListener?.('popstate',()=>navigate(tabFromLocation(),false));
render();
