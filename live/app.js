'use strict';

const app=document.querySelector('#app');
const notice=document.querySelector('#notice');
const states={open:'招募中',requested:'等待发起人确认',confirmed:'已确认赴约',completed:'已完成',cancelled:'已取消'};
const categories=['日常搭饭','兴趣搭饭','双人套餐'];
let user=null;
let campus='仙林';
let recover='';
let category='';
let renderVersion=0;

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const options=(items,selected)=>items.map(item=>'<option'+(item===selected?' selected':'')+'>'+item+'</option>').join('');
const dateInChina=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short'}).format(new Date());
const action=(meal,name,label,style='primary')=>'<button type="button" class="'+style+'" data-meal="'+escapeHtml(meal.id)+'" data-action="'+name+'">'+label+'</button>';

async function api(path,data) {
  const response=await fetch('/api/'+path,data===undefined?{}:{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
  });
  const result=await response.json();
  if (!response.ok) throw Error(result.error);
  return result;
}

function card(meal,mine) {
  const common=(meal.tags||[]).filter(tag=>user?.tags.includes(tag));
  const controls=[];
  if (!mine && !meal.isHost) controls.push(action(meal,'join','申请加入'));
  if (mine && meal.isHost && meal.state==='requested') controls.push(action(meal,'accept','确认报名'));
  if (mine && meal.state==='confirmed') controls.push(action(meal,'complete','标记完成'));
  if (mine && ['open','requested','confirmed'].includes(meal.state)) controls.push(action(meal,'cancel','取消','outline'));
  const feedback=mine && meal.state==='completed'
    ? meal.feedback
      ? '<p class="stat">'+(meal.unlocked?'双方愿意再约':'已提交私密反馈')+'</p>'
      : '<form data-feedback="'+escapeHtml(meal.id)+'"><label>饭后反馈（选填）<input name="detail" maxlength="160"></label>'+
        '<label><input type="checkbox" name="again"> 愿意和这位同学再约</label><button class="outline">保存私密反馈</button></form>'
    : '';
  return '<article class="card"><div class="row"><span class="tag">'+escapeHtml(meal.category)+'</span><span class="status">'+states[meal.state]+
    '</span></div><h3>'+escapeHtml(meal.title)+'</h3><p class="slot">'+escapeHtml(meal.date)+' '+escapeHtml(meal.time)+
    ' · '+escapeHtml(meal.campus)+'校区</p><p>'+escapeHtml(meal.place)+' · 预算 ¥'+meal.price+'/人</p>'+
    '<p class="muted">发起人 '+escapeHtml(meal.hostName)+(meal.guestName?' · 搭子 '+escapeHtml(meal.guestName):'')+'</p>'+
    (common.length?'<p class="stat">共同兴趣 · '+escapeHtml(common.join('、'))+'</p>':'')+
    (meal.note?'<p class="card-desc">'+escapeHtml(meal.note)+'</p>':'')+feedback+
    (controls.length?'<div class="actions">'+controls.join('')+'</div>':'')+'</article>';
}

const accountRequired='<div class="empty">请先<a href="#profile">填写个人档案或登录</a>。</div>';
const heading=(h,p)=>'<div class="page-heading"><h1>'+h+'</h1><p class="muted">'+p+'</p></div>';

function profile() {
  const about=heading('个人档案','用昵称参与。向约饭参与者显示昵称，公开招募同时显示兴趣标签。');
  if (user) return about+'<section class="panel"><h2>'+escapeHtml(user.name)+'</h2><p>'+escapeHtml(user.campus)+'校区</p>'+
    '<p>'+escapeHtml(user.tags.join('、'))+'</p>'+
    (recover?'<label>恢复码（仅在创建时显示，请保存到安全位置）<input readonly value="'+escapeHtml(recover)+'"></label><p>使用同一个恢复码可在另一台设备继续访问饭局。</p>':'')+
    '<button class="outline" id="logout">退出登录</button> <button class="outline" id="install">安装到桌面</button></section>';
  return about+'<div class="grid duo"><form class="panel" id="register"><h2>建立档案</h2>'+
    '<label>昵称<input name="name" required maxlength="20"></label><label>校区<select name="campus">'+options(['仙林','鼓楼'],campus)+
    '</select></label><label>兴趣标签（用逗号分隔）<input name="tags" maxlength="70"></label><button class="primary">建立档案</button></form>'+
    '<form class="panel" id="login"><h2>已有档案</h2><label>恢复码<input name="recovery" type="password" required maxlength="43" autocomplete="off"></label>'+
    '<button class="outline">登录</button></form></div><button class="outline" id="install">安装到桌面</button>';
}

function publish() {
  return heading('发布双人饭局','填写一个未来的午餐时段和公开集合地点。')+
    (user?'<form id="publish-form" class="panel form"><label>饭局名称<input name="title" maxlength="40" required placeholder="例如 12:30 食堂午饭"></label>'+
    '<div class="form-grid"><label>校区<select name="campus">'+options(['仙林','鼓楼'],campus)+'</select></label>'+
    '<label>类型<select name="category">'+options(categories,category)+'</select></label>'+
    '<label>日期<input name="date" type="date" min="'+dateInChina()+'" value="'+dateInChina()+'" required></label>'+
    '<label>时间<input name="time" type="time" min="12:00" max="13:00" value="12:30" required></label></div>'+
    '<label>集合地点<input name="place" maxlength="60" required placeholder="例如 食堂正门"></label>'+
    '<label>人均预算（元）<input name="price" type="number" min="1" max="200" value="25" required></label>'+
    '<label>说明（如套餐总价，选填）<textarea name="note" maxlength="160"></textarea></label><button class="primary">发布饭局</button></form>':accountRequired);
}

function browse(meals) {
  return '<section class="live-hero"><div><h1>饭点到了，<br>一起吃吧。</h1><p>约同校同学，在食堂或校门口见。</p><a class="primary" href="#publish">发布午餐饭局</a></div></section>'+
    '<section><div class="row"><h2>午餐饭局</h2><button class="outline" id="refresh">刷新</button></div>'+
    '<div class="form-grid filter"><label>校区<select id="campus">'+options(['仙林','鼓楼'],campus)+'</select></label>'+
    '<label>类型<select id="category">'+options(['全部类型',...categories],category||'全部类型')+'</select></label></div>'+
    (meals.length?'<div class="grid">'+meals.map(meal=>card(meal,false)).join('')+'</div>':
      '<div class="empty">当前筛选暂无饭局。可以<a href="#publish">发布一场</a>。</div>')+'</section>';
}

async function render() {
  const version=++renderVersion;
  const known=['browse','publish','mine','profile'];
  const id=known.includes(location.hash.slice(1))?location.hash.slice(1):'browse';
  document.querySelectorAll('nav a').forEach(a=>a.hash==='#'+id?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));
  try {
    let html;
    if (id==='profile') html=profile();
    if (id==='publish') html=publish();
    if (id==='mine') {
      html=heading('我的饭局','查看确认进度、赴约记录和双向再约状态。')+
        (user?'<button class="outline" id="refresh">刷新</button>':accountRequired);
      if (user) {
        const {meals}=await api('meals?mine=1');
        html+=meals.length?'<div class="grid">'+meals.map(meal=>card(meal,true)).join('')+'</div>':'<div class="empty">你还没有饭局。</div>';
      }
    }
    if (id==='browse') {
      const {meals}=await api('meals?campus='+encodeURIComponent(campus));
      html=browse(category?meals.filter(meal=>meal.category===category):meals);
    }
    if (version===renderVersion) app.innerHTML=html;
  } catch (error) {
    if (version===renderVersion) app.innerHTML='<p class="panel">'+escapeHtml(error.message)+'</p><button class="outline" id="refresh">重试</button>';
  }
}

async function loadSession() {
  ({user}=await api('session'));
  if (user) campus=user.campus;
}

async function perform(control,task) {
  if (control) control.disabled=true;
  notice.textContent='';
  try { await task(); }
  catch (error) { notice.textContent=error.message; }
  finally { if (control) control.disabled=false; }
}

app.addEventListener('change',event=>{
  if (event.target.id==='campus') campus=event.target.value;
  else if (event.target.id==='category') category=event.target.value==='全部类型'?'':event.target.value;
  else return;
  void render();
});
app.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if (!button) return;
  if (button.id==='refresh') {void render();return;}
  if (button.id==='install') {
    notice.textContent='iPhone 在 Safari 共享菜单选「添加到主屏幕」。Android 或电脑在浏览器菜单选「安装应用」。';
    return;
  }
  if (button.id==='logout') {
    void perform(button,async ()=>{await api('logout',{});user=null;recover='';await render();});
  }
  if (!button.dataset.meal) return;
  const name=button.dataset.action;
  if (name==='join' && !user) {location.hash='profile';return;}
  if (name==='cancel' && !window.confirm('确认取消这次饭局？')) return;
  void perform(button,async ()=>{
    await api('meals/'+button.dataset.meal,{action:name});
    if (name==='join') location.hash='mine';
    await render();
    notice.textContent='饭局状态已更新';
  });
});
app.addEventListener('submit',event=>{
  event.preventDefault();
  const form=event.target;
  const data=Object.fromEntries(new FormData(form));
  void perform(event.submitter,async ()=>{
    if (form.id==='register') {({recovery:recover}=await api('register',data));await loadSession();}
    else if (form.id==='login') {await api('login',data);await loadSession();}
    else if (form.id==='publish-form') {await api('meals',{...data,price:Number(data.price)});location.hash='mine';}
    else if (form.dataset.feedback) await api('meals/'+form.dataset.feedback,{action:'feedback',detail:data.detail,again:data.again==='on'});
    await render();
  });
});
window.addEventListener('hashchange',render);
loadSession().catch(error=>{notice.textContent=error.message;}).finally(render);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/live/sw.js',{scope:'/'}).catch(()=>{});
