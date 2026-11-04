import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const common=html.slice(html.indexOf('function wdOf(s)'),html.indexOf('/* ===== Tabs ===== */'));
const calendar=html.slice(html.indexOf('function eventsOnDate(ds)'),html.indexOf('function renderDay()'));
const fixture=(id,extra={})=>({id,kind:'confirmed',name:id,date:'2026-11-04',classes:[1],allClasses:false,periods:[1,2],...extra});
function setup(events=[]){
 const nodes=new Map();
 const node=()=>({children:[],appendChild(n){this.children.push(n);},set innerHTML(v){this.html=v;this.children=[];},get innerHTML(){return this.html||'';}});
 const ctx=vm.createContext({Date,Map,Set,Number,String,ALL:[1,2,3,4,5,6,7,8,9],WD:['일','월','화','수','목','금','토'],state:{events},curY:2026,curM:11,selDate:'2026-11-04',TODAY:new Date('2026-11-04T00:00:00'),colorOf:()=> '#3b7dd8',document:{getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node}});
 vm.runInContext(common+'\n'+calendar,ctx);
 return {ctx,nodes};
}
const json=x=>JSON.parse(JSON.stringify(x));
test('same class and intersecting period flag both schedules, with exact intersection',()=>{
 const {ctx}=setup();const r=ctx.conflictsFor([fixture('a',{classes:[1,3]}),fixture('b',{classes:[3,5],periods:[2,3]})]);
 assert.equal(r.size,2);assert.deepEqual(json(r.get('a')),[{otherId:'b',otherName:'b',classes:[3],periods:[2]}]);
});
test('different classes, adjacent periods, untimed events and same id are not conflicts',()=>{
 const {ctx}=setup();for(const b of [fixture('b',{classes:[2]}),fixture('b',{periods:[3,4]}),fixture('b',{periods:[]}),fixture('b',{classes:[]}),fixture('a')])assert.equal(ctx.conflictsFor([fixture('a'),b]).size,0);
});
test('whole-grade and recurring lessons participate; undated pending lessons do not',()=>{
 const {ctx}=setup();const r=ctx.conflictsFor([fixture('all',{allClasses:true,classes:[]}),fixture('weekly',{kind:'recurring',classes:[9]}),fixture('pending',{kind:'pending'})]);
 assert.deepEqual(json(r.get('all')[0].classes),[9]);assert.equal(r.has('pending'),false);
});
test('occurrences respect date, recurring weekday/range and range event middle days',()=>{
 const {ctx}=setup([fixture('now'),fixture('tomorrow',{date:'2026-11-05'}),fixture('weekly',{kind:'recurring',weekday:'수',date:'2026-11-01',endDate:'2026-11-30'}),fixture('ended',{kind:'recurring',weekday:'수',date:'2026-10-01',endDate:'2026-10-31'}),fixture('school',{kind:'event',date:'2026-11-02',endDate:'2026-11-06',classes:[],periods:[]})]);
 const day=ctx.eventsOnDate('2026-11-04');assert.deepEqual(json(ctx.dayOccurrences(day).map(e=>e.id)),['now','weekly','school']);
});
test('desktop keeps same-title entries separate and renders metadata, warning and escaped title',()=>{
 const {ctx,nodes}=setup([fixture('a',{name:'<탐구> "협력"'}),fixture('b',{name:'<탐구> "협력"',periods:[2,3]})]);ctx.renderCal();
 const cell=nodes.get('grid').children.find(x=>x.innerHTML.includes('<div class="dnum">4</div>'));
 assert.equal((cell.innerHTML.match(/class="chip-t"/g)||[]).length,2);assert.match(cell.innerHTML,/5학년 1반 · 1교시·2교시/);assert.match(cell.innerHTML,/⚠ 일정 겹침/);assert.match(cell.innerHTML,/&lt;탐구&gt; &quot;협력&quot;/);assert.doesNotMatch(cell.innerHTML,/<탐구>/);
});
test('distribution copies stay identical and inline script compiles',()=>{
 assert.equal(html,readFileSync(new URL('../app-base.html',import.meta.url),'utf8'));
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
});
