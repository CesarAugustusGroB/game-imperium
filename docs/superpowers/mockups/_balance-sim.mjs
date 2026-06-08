// Headless balance sim — mirrors battle-rework.html combat math.
const BAL = { DMG_SCALE:17, RECOIL_SCALE:26, CENTER_MOVE:0.55, START_MORALE:10, MORALE_K:10, MORALE_RESIST:0.05, DISC_DMG:0.05, MAX_ROUNDS:14 };
const ORDERS = {
  advance:{sub:'push',stat:'push',mult:0.55,disc:2,push:22},
  holdLine:{sub:'push',stat:'push',mult:0.30,disc:2,push:14,defensive:true,protect:0.38},
  charge:{sub:'charge',stat:'charge',mult:1.05,disc:2,eMorale:1},
  skirmish:{sub:'harass',stat:'harass',mult:0.85,disc:2,ammo:9,eMorale:0.4},
  siege:{sub:'siege',stat:'siege',mult:1.45,disc:4,pierce:true,eMorale:0.7},
  envelop:{sub:'move',stat:'movement',mult:1.1,disc:6,check:12,eMorale:1.0,effect:'encircle'},
  flank:{sub:'move',stat:'movement',mult:0.7,disc:5,check:9,effect:'flank'},
  drums:{sub:'moral',disc:3,sMorale:1.6,drums:true},
  taunt:{sub:'moral',disc:3,eMorale:1.0,mult:0.05,stat:'harass'},
  rally:{sub:'moral',disc:2,sMorale:2.6},
  warCry:{sub:'push',stat:'push',mult:0.35,disc:3,push:16,eMorale:0.85,sMorale:0.5},
  fireMissiles:{sub:'harass',stat:'harass',mult:0.8,disc:4,ammo:14,eMorale:1.4},
  hitRun:{sub:'move',stat:'movement',mult:0.65,disc:4,check:9,effect:'hitrun',eMorale:0.5},
  wedge:{sub:'charge',stat:'charge',mult:1.35,disc:5,eMorale:1.5,pierceBrace:true,breakCenter:true,wedge:true},
  allOut:{sub:'charge',stat:'charge',mult:2.2,disc:6,eMorale:2.5,sMorale:-3,reckless:true,allIn:true},
  lineRelief:{sub:'moral',disc:6,sMorale:1.5,refresh:true},
};
const FORMATIONS = {
  battleLine:{disc:2,orders:['advance','charge','skirmish','holdLine','rally']},
  openOrder:{disc:2,orders:['skirmish','fireMissiles','hitRun','flank','charge','rally']},
  shieldWall:{disc:3,orders:['holdLine','warCry','drums','taunt','advance','rally']},
  triplex:{disc:6,orders:['advance','charge','holdLine','lineRelief','envelop','rally']},
  testudo:{disc:5,antiMissile:true,orders:['holdLine','advance','siege','rally']},
  cuneus:{disc:5,orders:['charge','wedge','allOut','flank','advance','rally']},
};
const CENTERS = { hill:{dmg:0.15}, ford:{enemyChargePenalty:0.25}, camp:{moraleRegen:0.8}, plain:{chargeBonus:0.25} };
const ARMORS = { copper:5, bronze:12, iron:20, steel:30 };
const rollDn = n => 1 + Math.floor(Math.random()*n);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
let S=null;
function moraleState(m){ if(m<=0)return{mult:0}; if(m<3)return{mult:0.6}; if(m<6)return{mult:0.8}; return{mult:1.0}; }
function controllerOf(){ if(S.control>=25)return'you'; if(S.control<=-25)return'enemy'; return null; }
function centerTier(side){ const c=side==='you'?S.control:-S.control; if(c<25)return 0; if(c<50)return 1; if(c<75)return 2; return 3; }
function makeArmy(o){ return {...o, maxHp:o.hp, discipline:o.disc, encircled:false, drums:0, defendedLast:false, guardMult:1}; }
function mitigate(raw,def,o){ let m=raw; if(!(o&&o.pierce)){ m*=(1-def.armorPct/100); if(def.fortPct>0)m*=(1-def.fortPct/100);} m*=(def.guardMult||1); return m; }
function validOrders(a){ const ms=moraleState(a.morale); return a.formation.orders.filter(k=>{const o=ORDERS[k]; if(a.discipline<o.disc)return false; if(o.ammo&&a.ammo<o.ammo)return false; if(ms.mult<1&&(o.reckless||o.disc>=6)&&!o.sMorale)return false; return true;}); }
function aiChoose(self,foe){ const av=validOrders(self); const has=k=>av.includes(k); const sideCtrl=controllerOf();
  if(self.morale<3&&has('lineRelief'))return'lineRelief'; if(self.morale<2.5&&has('rally'))return'rally';
  if((foe.encircled||foe.morale<3)&&has('allOut'))return'allOut'; if((foe.encircled||foe.morale<3)&&has('charge'))return'charge';
  if(sideCtrl===foe.side&&foe.defendedLast&&has('wedge'))return'wedge';
  if(sideCtrl===foe.side&&has('flank'))return'flank';
  if(foe.armorPct>=20&&has('siege'))return'siege';
  if(has('envelop')&&!foe.encircled&&self.stats.movement+4>=ORDERS.envelop.check)return'envelop';
  const enemyAhead=self.side==='you'?S.control< -20:S.control>20;
  if(enemyAhead&&has('advance'))return'advance'; if(enemyAhead&&has('holdLine'))return'holdLine';
  const pref=['charge','wedge','allOut','fireMissiles','skirmish','warCry','advance','holdLine','hitRun','drums','taunt','flank','rally'];
  for(const p of pref) if(has(p))return p; return av[0]||'rally';
}
function resolveCenter(yKey,eKey,yDie,eDie){ const yO=ORDERS[yKey],eO=ORDERS[eKey];
  const yPush=yO.push?(S.you.stats.push+yDie)*(yO.push/14):0; const ePush=eO.push?(S.enemy.stats.push+eDie)*(eO.push/14):0;
  const delta=yPush-ePush; if(delta!==0)S.control=clamp(S.control+delta*BAL.CENTER_MOVE,-100,100); }
function resolveOrder(att,def,o,die,side,defO){ let eMoraleHit=o.eMorale||0; const discBonus=1+att.discipline*BAL.DISC_DMG; const ms=moraleState(att.morale).mult;
  const attHasCenter=controllerOf()===att.side; const centerDmgBonus=(attHasCenter&&S.center.dmg)?S.center.dmg:0;
  if(o.sub==='moral'&&!o.mult){ if(o.drums)att.drums=3; else if(o.refresh){att.morale=clamp(att.morale+o.sMorale,0,10);att.guardMult=0.5;} else if(o.sMorale)att.morale=clamp(att.morale+o.sMorale,0,10); return{eMoraleHit}; }
  const statVal=o.stat?att.stats[o.stat]:0;
  if(o.sub==='move'){ const total=die+att.stats.movement; if(total<o.check)return{eMoraleHit:0}; let mult=o.mult;
    if(o.effect==='flank'&&controllerOf()===def.side)mult*=2.5;
    let dmg=mitigate(statVal*die*mult*discBonus*ms*(1+centerDmgBonus)*BAL.DMG_SCALE,def,o); def.hp=Math.max(0,def.hp-dmg);
    if(o.effect==='encircle'){def.encircled=true;def.encircleTurns=2;eMoraleHit+=1.0;} if(o.effect==='hitrun')att.guardMult=0.25; return{eMoraleHit}; }
  if(o.sub==='charge'){ let impactMult=o.mult,recoilMult=0.55; const defBraced=defO&&defO.defensive;
    if(defBraced&&!o.pierceBrace){impactMult*=0.6;recoilMult=1.8;} if(o.allIn)recoilMult*=1.5;
    if(S.center.chargeBonus&&attHasCenter)impactMult*=(1+S.center.chargeBonus);
    if(S.center.enemyChargePenalty&&controllerOf()===def.side)impactMult*=(1-S.center.enemyChargePenalty);
    let impact=mitigate(statVal*die*impactMult*discBonus*ms*(1+centerDmgBonus)*BAL.DMG_SCALE,def,o); def.hp=Math.max(0,def.hp-impact);
    const exposure=1+Math.max(0,7-die)/10; let recoil=mitigate(def.stats.push*recoilMult*exposure*BAL.RECOIL_SCALE,att,{}); att.hp=Math.max(0,att.hp-recoil);
    eMoraleHit+=impact>recoil?0.6:-0.2; if(o.sMorale)att.morale=clamp(att.morale+o.sMorale,0,10);
    if(o.breakCenter&&impact>recoil)S.control=clamp(S.control+(att.side==='you'?1:-1)*32,-100,100); return{eMoraleHit:Math.max(0,eMoraleHit)}; }
  if(o.sub==='harass'){ att.ammo=Math.max(0,att.ammo-(o.ammo||0)); let dmg=mitigate(statVal*die*o.mult*discBonus*ms*BAL.DMG_SCALE,def,o);
    if(def.formation.antiMissile){dmg*=0.12;eMoraleHit*=0.3;} def.hp=Math.max(0,def.hp-dmg); return{eMoraleHit}; }
  if(o.sub==='siege'){ let dmg=statVal*die*o.mult*discBonus*ms*(1+centerDmgBonus)*BAL.DMG_SCALE; dmg*=(def.guardMult||1); def.hp=Math.max(0,def.hp-dmg); return{eMoraleHit}; }
  if(o.sub==='push'){ let dmg=mitigate(statVal*die*o.mult*discBonus*ms*(1+centerDmgBonus)*BAL.DMG_SCALE,def,o); def.hp=Math.max(0,def.hp-dmg);
    if(o.sMorale)att.morale=clamp(att.morale+o.sMorale,0,10); return{eMoraleHit}; }
  return{eMoraleHit:0}; }
function applyMorale(army,hpBefore,ownO,foeO,incoming){ const frac=(hpBefore-army.hp)/Math.max(hpBefore,1);
  let casualty=frac*BAL.MORALE_K; if(ownO.defensive&&ownO.protect)casualty*=(1-ownO.protect);
  let loss=casualty+(incoming||0); if(army.encircled)loss+=1.0;
  loss*=Math.max(0,1-army.discipline*BAL.MORALE_RESIST); loss=Math.max(0,loss);
  if(ownO.sMorale&&ownO.sMorale<0)loss+=-ownO.sMorale;
  if(controllerOf()===army.side&&S.center.moraleRegen)army.morale=clamp(army.morale+S.center.moraleRegen,0,10);
  army.morale=clamp(army.morale-loss,0,10); }
function ended(){ const y=S.you,e=S.enemy; if(e.hp<=0)return'win'; if(y.hp<=0)return'lose'; if(e.morale<=0)return'win'; if(y.morale<=0)return'lose';
  if(S.round>=BAL.MAX_ROUNDS){ const ys=y.hp/y.maxHp+y.morale/10, es=e.hp/e.maxHp+e.morale/10; return ys>=es?'win':'lose'; } return null; }
function round(yKey){ S.round++; S.you.guardMult=1; S.enemy.guardMult=1; const eKey=aiChoose(S.enemy,S.you);
  const yO=ORDERS[yKey],eO=ORDERS[eKey]; const yDie=rollDn(6+centerTier('you')),eDie=rollDn(6+centerTier('enemy'));
  const yHp=S.you.hp,eHp=S.enemy.hp; resolveCenter(yKey,eKey,yDie,eDie);
  const yRes=resolveOrder(S.you,S.enemy,yO,yDie,'you',eO); const eRes=resolveOrder(S.enemy,S.you,eO,eDie,'enemy',yO);
  applyMorale(S.you,yHp,yO,eO,eRes.eMoraleHit); applyMorale(S.enemy,eHp,eO,yO,yRes.eMoraleHit);
  if(S.you.drums>0){S.you.morale=clamp(S.you.morale+1.0+S.you.discipline*0.06,0,10);S.you.drums--;}
  if(S.enemy.drums>0){S.enemy.morale=clamp(S.enemy.morale+1.0+S.enemy.discipline*0.06,0,10);S.enemy.drums--;}
  for(const a of [S.you,S.enemy]){ if(a.encircled){ a.encircleTurns=(a.encircleTurns||1)-1; if(a.encircleTurns<=0)a.encircled=false; } }
  S.you.defendedLast=!!yO.defensive; S.enemy.defendedLast=!!eO.defensive; }
function newBattle(pf,disc){ const ck=Object.keys(CENTERS); const efk=['battleLine','openOrder','cuneus','triplex'];
  S={ you:makeArmy({side:'you',hp:10000,morale:BAL.START_MORALE,disc,stats:{charge:10,harass:8,push:16,siege:5,movement:9},armorPct:ARMORS.iron,ammo:32,formation:FORMATIONS[pf],fortPct:0}),
      enemy:makeArmy({side:'enemy',hp:10000,morale:BAL.START_MORALE,disc:6,stats:{charge:15,harass:9,push:12,siege:5,movement:11},armorPct:ARMORS.bronze,ammo:26,formation:FORMATIONS[efk[Math.floor(Math.random()*efk.length)]],fortPct:0}),
      round:0,control:0,center:CENTERS[ck[Math.floor(Math.random()*ck.length)]] }; }
function simulate(pf,disc,n){ let wins=0,rounds=0,byHp=0,byMor=0,byAttr=0;
  for(let i=0;i<n;i++){ newBattle(pf,disc); let r=null; while(!(r=ended()))round(aiChoose(S.you,S.enemy)); rounds+=S.round; if(r==='win')wins++;
    if(S.enemy.hp<=0||S.you.hp<=0)byHp++; else if(S.enemy.morale<=0||S.you.morale<=0)byMor++; else byAttr++; }
  return `${pf.padEnd(11)} disc${disc}  win ${(wins/n*100).toFixed(1).padStart(5)}%  rounds ${(rounds/n).toFixed(1).padStart(4)}  [HP ${(byHp/n*100).toFixed(0)}% · morale ${(byMor/n*100).toFixed(0)}% · attr ${(byAttr/n*100).toFixed(0)}%]`; }
const N=4000;
console.log('Win% should sit near 50 at parity (disc6), battles ~8-14 rounds, HP & morale both as win paths:');
for(const f of ['battleLine','openOrder','shieldWall','triplex','testudo','cuneus']) console.log(simulate(f,Math.max(6,FORMATIONS[f].disc),N));
console.log('\nDiscipline sweep (battleLine):');
for(const dsc of [2,4,6,8,10]) console.log(simulate('battleLine',dsc,N));
