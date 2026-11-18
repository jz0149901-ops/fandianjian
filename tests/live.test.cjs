const assert=require('node:assert/strict');
const test=require('node:test');
const {once}=require('node:events');
const {mkdtemp,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');

test('shared full flow, participant privacy, competing applications and SQLite persistence',async t=>{
  const {createApp}=await import('../live/server.mjs');
  const directory=await mkdtemp(join(tmpdir(),'fandianjian-'));
  const databasePath=join(directory,'test.sqlite');
  let clock=new Date('2026-11-18T03:50:00Z');
  let server;
  let base;
  async function start() {
    server=createApp({databasePath,now:()=>clock});
    server.listen(0,'127.0.0.1');
    await once(server,'listening');
    base='http://127.0.0.1:'+server.address().port;
  }
  async function stop() {
    if (server?.listening) await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
  t.after(async ()=>{await stop();await rm(directory,{recursive:true,force:true});});
  await start();
  async function send(path,{cookie,body,status=200}={}) {
    const response=await fetch(base+'/api/'+path,{
      method:body===undefined?'GET':'POST',
      headers:{...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},
      body:body===undefined?undefined:JSON.stringify(body)
    });
    const data=await response.json();
    assert.equal(response.status,status,JSON.stringify(data));
    return {...data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  const register=name=>send('register',{body:{name,campus:'仙林',tags:'电影，运动'},status:201});
  const host=await register('发起人');
  const guest=await register('同学甲');
  const other=await register('同学乙');
  const body={title:'鸡肉饭',campus:'仙林',category:'双人套餐',date:'2026-11-18',time:'12:30',place:'食堂门口',price:25,note:''};
  await send('meals',{cookie:host.cookie,body:{...body,time:'12:69'},status:400});
  const {id}=await send('meals',{cookie:host.cookie,body,status:201});
  const {meals}=await send('meals');
  assert.equal(meals[0].id,id);
  assert.deepEqual(meals[0].tags,['电影','运动']);
  assert.equal(meals[0].host,undefined);
  const action=(session,name,status=200,extra={})=>send('meals/'+id,{cookie:session.cookie,body:{action:name,...extra},status});
  await action(host,'join',409);
  await Promise.all([guest,other].map(async session=>{
    const response=await fetch(base+'/api/meals/'+id,{method:'POST',headers:{'Content-Type':'application/json',Cookie:session.cookie},body:JSON.stringify({action:'join'})});
    return [session,response.status];
  })).then(async results=>{
    assert.deepEqual(results.map(([,status])=>status).sort(),[200,409]);
    const winner=results.find(([,status])=>status===200)[0];
    const loser=results.find(([,status])=>status===409)[0];
    await action(winner,'accept',403);
    await action(loser,'cancel',403);
    await action(host,'accept');
    await action(winner,'complete',409);
    clock=new Date('2026-11-18T05:00:00Z');
    await action(winner,'complete');
    await action(host,'feedback',200,{again:true,detail:'发起人的私密反馈'});
    const ownList=session=>send('meals?mine=1',{cookie:session.cookie});
    assert.deepEqual((await ownList(loser)).meals,[]);
    let record=(await ownList(winner)).meals[0];
    assert.equal(record.unlocked,false);
    assert.equal(record.feedback,null);
    assert.doesNotMatch(JSON.stringify(record),/发起人的私密反馈/);
    await action(winner,'feedback',200,{again:true,detail:'搭子的私密反馈'});
    await action(winner,'feedback',409,{again:false});
    await stop();
    await start();
    const signedIn=await send('login',{body:{recovery:winner.recovery}});
    record=(await ownList(signedIn)).meals[0];
    assert.equal(record.unlocked,true);
    assert.equal(record.feedback.detail,'搭子的私密反馈');
    assert.doesNotMatch(JSON.stringify(record),/发起人的私密反馈/);
  });
  for(const path of ['/','/live.js','/live/sw.js','/live/manifest.webmanifest','/hero-table.webp','/demo/']) {
    const response=await fetch(base+path);
    assert.equal(response.status,200,path);
    await response.arrayBuffer();
  }
});
