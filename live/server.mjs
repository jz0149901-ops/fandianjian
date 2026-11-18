import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {mkdirSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = new Map(Object.entries({
  '/':['live/index.html','text/html'], '/live.js':['live/app.js','application/javascript'],
  '/demo/':['index.html','text/html'], '/demo/app.js':['app.js','application/javascript'],
  '/demo/install.js':['install.js','application/javascript'], '/demo/sw.js':['sw.js','application/javascript']
}));
for (const [file,type] of [
  ['nju.css','text/css'], ['live/theme.css','text/css'], ['live/manifest.webmanifest','application/manifest+json'],
  ['live/sw.js','application/javascript'], ['install.js','application/javascript'],
  ['manifest.webmanifest','application/manifest+json'], ['app-icon-192.png','image/png'], ['app-icon-512.png','image/png'],
  ...['hero-table','meal','package-rice','package-tea','package-noodle','package-bistro','shortcut-daily','shortcut-interest','shortcut-deal'].map(name=>[name+'.webp','image/webp'])
]) {
  assets.set('/'+file,[file,type]);
  if (!file.startsWith('live/')) assets.set('/demo/'+file,[file,type]);
}
const campuses = ['仙林','鼓楼'];
const categories = ['日常搭饭','兴趣搭饭','双人套餐'];
const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const sessionKey = req => req.headers.cookie?.match(/(?:^|; *)fdj_session=([\w-]{43})(?:;|$)/)?.[1];
const fail = (status,message) => Object.assign(new Error(message), {status});
const timezone = 'Asia/Shanghai';
const localTime = new Intl.DateTimeFormat('sv-SE',{timeZone:timezone,dateStyle:'short',timeStyle:'short'});

const schema = `
  PRAGMA foreign_keys=ON;
  PRAGMA journal_mode=WAL;
  PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, recovery TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    campus TEXT NOT NULL, tags TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    secret TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meals (
    id TEXT PRIMARY KEY, host TEXT NOT NULL REFERENCES users(id), guest TEXT REFERENCES users(id),
    title TEXT NOT NULL, category TEXT NOT NULL, campus TEXT NOT NULL, date TEXT NOT NULL,
    time TEXT NOT NULL, place TEXT NOT NULL, price INTEGER NOT NULL, note TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','requested','confirmed','completed','cancelled'))
  );
  CREATE TABLE IF NOT EXISTS feedback (
    meal_id TEXT NOT NULL REFERENCES meals(id), user_id TEXT NOT NULL REFERENCES users(id),
    again INTEGER NOT NULL, detail TEXT NOT NULL, PRIMARY KEY(meal_id,user_id)
  );
  CREATE INDEX IF NOT EXISTS meal_listing ON meals(campus,state,date,time);
  CREATE INDEX IF NOT EXISTS meal_guest ON meals(guest,date);
  CREATE INDEX IF NOT EXISTS meal_host ON meals(host,date);
`;

function textField(value, max, name, required = true) {
  const result = typeof value === 'string' ? value.trim() : '';
  if ((required && !result) || result.length > max) throw fail(400, name+'格式不正确');
  return result;
}

async function readJson(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw fail(415,'需要 JSON 请求');
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 8192) throw fail(413,'内容过长');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
    return value;
  } catch { throw fail(400,'无法读取请求内容'); }
}

export function createApp({databasePath = 'data/fandianjian.sqlite', secure = false, now = ()=>new Date()} = {}) {
  if (databasePath !== ':memory:') mkdirSync(dirname(resolve(databasePath)), {recursive:true});
  const db = new DatabaseSync(databasePath);
  db.exec(schema);
  const get = (sql,...args) => db.prepare(sql).get(...args);
  const all = (sql,...args) => db.prepare(sql).all(...args);
  const run = (sql,...args) => db.prepare(sql).run(...args);

  function sessionUser(req) {
    const key = sessionKey(req);
    return key && get('SELECT users.id,name,campus,tags FROM sessions JOIN users ON users.id=user_id WHERE secret=? AND expires>?',hash(key),now().getTime());
  }
  function sessionCookie(id) {
    const key = token();
    const maxAge = 30*24*60*60;
    run('DELETE FROM sessions WHERE expires<=?',now().getTime());
    run('INSERT INTO sessions VALUES (?,?,?)',hash(key),id,now().getTime()+maxAge*1000);
    return `fdj_session=${key}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`;
  }
  function mealData(body) {
    const title = textField(body.title,40,'饭局名称');
    const place = textField(body.place,60,'集合地点');
    const note = textField(body.note,160,'说明',false);
    const {campus,category,date,time,price} = body;
    if (!campuses.includes(campus) || !categories.includes(category)) throw fail(400,'请选择校区和饭局类型');
    const start = typeof date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(date+'T00:00:00+08:00') : NaN;
    if (!Number.isFinite(start) || localTime.format(new Date(start)).slice(0,10)!==date ||
        start > now().getTime()+30*86400000 || typeof time!=='string' || !/^\d{2}:[0-5]\d$/.test(time) ||
        time<'12:00' || time>'13:00' || date+' '+time<=localTime.format(now())) throw fail(400,'请选择未来 30 天内 12:00–13:00 的有效饭点');
    if (!Number.isInteger(price) || price<1 || price>200) throw fail(400,'人均预算须为 1–200 元整数');
    return {title,campus,category,date,time,place,price,note};
  }

  function listMeals(user,search) {
    const campus=search.get('campus') || '仙林';
    const boundary=localTime.format(now());
    const columns=`SELECT m.id,title,category,m.campus,date,time,place,price,note,state,
      host.name AS hostName, host.tags AS hostTags, m.host, m.guest, guest.name AS guestName
      FROM meals m JOIN users host ON host.id=m.host LEFT JOIN users guest ON guest.id=m.guest`;
    if (search.get('mine')==='1') {
      if (!user) throw fail(401,'请先建立档案或登录');
      return all(columns+' WHERE m.host=? OR m.guest=? ORDER BY date DESC,time DESC LIMIT 100',user.id,user.id).map(row=>{
        const {host,guest,hostTags,...safe}=row;
        const own=get('SELECT again,detail FROM feedback WHERE meal_id=? AND user_id=?',row.id,user.id);
        const peer=own?.again===1 && get('SELECT again FROM feedback WHERE meal_id=? AND user_id=?',row.id,host===user.id?guest:host);
        return {...safe,isHost:host===user.id,feedback:own||null,unlocked:peer?.again===1};
      });
    }
    return all(columns+` WHERE m.campus=? AND state='open' AND (date||' '||time)>?
      ORDER BY date,time LIMIT 100`,campus,boundary).map(({host,guest,guestName,hostTags,...row})=>({
      ...row, isHost:user?.id===host, tags:JSON.parse(hostTags)
    }));
  }

  function changeMeal(id, user, body) {
    const current=get('SELECT * FROM meals WHERE id=?',id);
    if (!current) throw fail(404,'饭局不存在');
    const asHost=current.host===user.id;
    const asGuest=current.guest===user.id;
    const past=current.date+' '+current.time<=localTime.format(now());
    const where=' WHERE id=? AND state=?';
    let change;
    switch(body.action) {
      case 'join':
        if (asHost || past || current.state!=='open') throw fail(409,'这个场次已不可报名');
        change=run("UPDATE meals SET state='requested', guest=?"+where,user.id,id,'open');
        break;
      case 'accept':
        if (!asHost) throw fail(403,'只有发起人可以确认');
        if (past || current.state!=='requested') throw fail(409,'当前无法确认');
        change=run("UPDATE meals SET state='confirmed'"+where,id,'requested');
        break;
      case 'cancel':
        if (!asHost && !asGuest) throw fail(403,'只有参与者可以取消');
        if (!['open','requested','confirmed'].includes(current.state)) throw fail(409,'当前无法取消');
        change=asGuest && current.state==='requested'
          ? run("UPDATE meals SET state='open',guest=NULL"+where+' AND guest=?',id,'requested',user.id)
          : run("UPDATE meals SET state='cancelled'"+where,id,current.state);
        break;
      case 'complete':
        if (!asHost && !asGuest) throw fail(403,'只有参与者可以完成饭局');
        if (!past || current.state!=='confirmed') throw fail(409,'确认后的饭局到达约定时间才能标记完成');
        change=run("UPDATE meals SET state='completed'"+where,id,'confirmed');
        break;
      case 'feedback':
        if (!asHost && !asGuest) throw fail(403,'只有参与者可以反馈');
        if (current.state!=='completed' || typeof body.again!=='boolean') throw fail(409,'完成饭局后可提交反馈');
        change=run('INSERT OR IGNORE INTO feedback VALUES (?,?,?,?)',id,user.id,Number(body.again),textField(body.detail,160,'反馈',false));
        break;
      default: throw fail(400,'未知操作');
    }
    if (change.changes!==1) throw fail(409,'饭局状态已变化或反馈已提交，请刷新');
  }

  const server=createServer(async (req,res)=>{
    const send=(status,data)=>{
      res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      res.end(JSON.stringify(data));
    };
    try {
      const url=new URL(req.url,'http://localhost');
      const path=url.pathname;
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Referrer-Policy','same-origin');
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
      if (!path.startsWith('/api/')) {
        if (path==='/demo') {res.writeHead(302,{Location:'/demo/'});res.end();return;}
        const asset=assets.get(path);
        if (!asset || !['GET','HEAD'].includes(req.method)) return send(404,{error:'页面不存在'});
        res.writeHead(200,{'Content-Type':asset[1]+(asset[1].startsWith('text/')?'; charset=utf-8':''),'Cache-Control':'no-cache',
          ...(path==='/live/sw.js'?{'Service-Worker-Allowed':'/'}:{})});
        res.end(req.method==='HEAD'?undefined:readFileSync(resolve(root,asset[0])));
        return;
      }
      if (req.method==='GET' && path==='/api/health') return send(200,{ok:true});
      const user=sessionUser(req);
      if (req.method==='GET' && path==='/api/session') return send(200,{user:user?{name:user.name,campus:user.campus,tags:JSON.parse(user.tags)}:null});
      if (req.method==='GET' && path==='/api/meals') return send(200,{meals:listMeals(user,url.searchParams)});
      if (req.method!=='POST') return send(404,{error:'接口不存在'});
      if (req.headers['sec-fetch-site']==='cross-site' ||
          (req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)) throw fail(403,'请求来源不符');
      const body=await readJson(req);
      if (path==='/api/register') {
        const name=textField(body.name,20,'昵称');
        if (!campuses.includes(body.campus)) throw fail(400,'请选择校区');
        const tags=[...new Set(textField(body.tags,70,'兴趣标签',false).split(/[,，、]/).map(tag=>tag.trim()).filter(Boolean))].slice(0,8);
        const id=randomUUID();
        const recovery=token();
        run('INSERT INTO users VALUES (?,?,?,?,?)',id,hash(recovery),name,body.campus,JSON.stringify(tags));
        res.setHeader('Set-Cookie',sessionCookie(id));
        return send(201,{recovery});
      }
      if (path==='/api/login') {
        const recovery=textField(body.recovery,43,'恢复码');
        const account=get('SELECT id FROM users WHERE recovery=?',hash(recovery));
        if (!account) throw fail(401,'恢复码不正确');
        res.setHeader('Set-Cookie',sessionCookie(account.id));
        return send(200,{ok:true});
      }
      if (!user) throw fail(401,'请先建立档案或登录');
      if (path==='/api/logout') {
        const key=sessionKey(req);
        run('DELETE FROM sessions WHERE secret=?',hash(key));
        res.setHeader('Set-Cookie','fdj_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'+(secure?'; Secure':''));
        return send(200,{ok:true});
      }
      if (path==='/api/meals') {
        const meal=mealData(body);
        const id=randomUUID();
        run('INSERT INTO meals (id,host,title,category,campus,date,time,place,price,note) VALUES (?,?,?,?,?,?,?,?,?,?)',
          id,user.id,meal.title,meal.category,meal.campus,meal.date,meal.time,meal.place,meal.price,meal.note);
        return send(201,{id});
      }
      const id=path.match(/^\/api\/meals\/([0-9a-f-]{36})$/)?.[1];
      if (!id) throw fail(404,'接口不存在');
      changeMeal(id,user,body);
      send(200,{ok:true});
    } catch (error) {
      if (!error.status) console.error(error);
      if (!res.headersSent) send(error.status||500,{error:error.status?error.message:'服务暂时不可用'});
    }
  });
  server.on('close',()=>db.close());
  return server;
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT||3000);
  createApp({databasePath:process.env.DB_PATH,secure:process.env.SECURE_COOKIES==='1'})
    .listen(port,process.env.HOST||'0.0.0.0',()=>console.log('饭点见已启动，端口 '+port));
}
