import { useState, type ReactNode } from 'react'
import { activePhaseForWeek, competitionRecord, currentTeam, dateForWeek, fixturesForWeek, rankedTeams, regionalPlayoffQualifiers, type CompetitionPhase, type Fixture, type GameState } from './game'
import { type Region } from './seed'

type PlayablePhase=Exclude<CompetitionPhase,'Break'|'Offseason'>
type EventInfo={start:number;end:number;type:'regional'|'international';location:string;format:string;stakes:string;playoffStart?:number}
const regions:Region[]=['Americas','EMEA','Pacific','China']
const colors:Record<Region,string>={Americas:'#62a0ff',EMEA:'#ff9b62',Pacific:'#7fe1c6',China:'#f1c75b'}
const events:Record<PlayablePhase,EventInfo>={
  Kickoff:{start:1,end:6,type:'regional',location:'Regional studios',format:'Triple elimination',stakes:'Three Masters 1 places per region'},
  'Masters 1':{start:8,end:10,playoffStart:10,type:'international',location:'São Paulo',format:'Swiss into double elimination',stakes:'International title and Championship Points'},
  'Stage 1':{start:12,end:18,playoffStart:16,type:'regional',location:'Regional leagues',format:'League stage and playoffs',stakes:'Three Masters 2 places per region'},
  'Masters 2':{start:20,end:22,playoffStart:22,type:'international',location:'Berlin',format:'Swiss into double elimination',stakes:'International title and Championship Points'},
  'Stage 2':{start:24,end:34,playoffStart:32,type:'regional',location:'Regional roadshows',format:'League stage and playoffs',stakes:'Champions qualification'},
  Champions:{start:36,end:42,playoffStart:39,type:'international',location:'Seoul',format:'Groups into double elimination',stakes:'The 2026 world championship'},
}
const eventOrder=Object.keys(events) as PlayablePhase[]
const Badge=({children,color}:{children:ReactNode;color?:string})=><span className="badge" style={color?{color,borderColor:`${color}55`}:undefined}>{children}</span>
const PanelTitle=({eyebrow,title,right}:{eyebrow:string;title:string;right?:ReactNode})=><div className="panel-title"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div>{right}</div>
const statusFor=(s:GameState,phase:PlayablePhase)=>s.week>events[phase].end?'Complete':s.week<events[phase].start?'Upcoming':'In progress'
const playoffStartFor=(phase:PlayablePhase)=>events[phase].playoffStart??events[phase].end
const stageFor=(fixture:Fixture)=>fixture.stage??(fixture.phase.startsWith('Masters')?(fixture.week===events[fixture.phase as 'Masters 1'|'Masters 2'].end?'Playoffs':'Swiss'):fixture.phase==='Champions'?(fixture.week>=39?'Playoffs':'Groups'):'League')

function FixtureCard({s,fixture,featured=false}:{s:GameState;fixture:Fixture;featured?:boolean}){
  const result=fixture.resultId?s.matches.find(match=>match.id===fixture.resultId):undefined
  const a=s.teams[fixture.aId],b=fixture.bId?s.teams[fixture.bId]:undefined,managed=fixture.aId===s.currentTeamId||fixture.bId===s.currentTeamId
  const score=(id:string)=>result?(result.aId===id?result.aScore:result.bScore):'—'
  return <article className={`matchup-card ${fixture.status} ${managed?'managed':''} ${featured?'featured':''}`}><header><span>{fixture.label}</span><span>{fixture.status==='completed'?'Final':`Week ${fixture.week} · BO${fixture.bestOf}`}</span></header>
    <div className={result?.winnerId===a.id?'winner':''}><i style={{background:a.color}}/><strong>{featured?a.name:a.short}</strong><small>{a.region}</small><b>{score(a.id)}</b></div>
    <div className={b&&result?.winnerId===b.id?'winner':''}>{b?<><i style={{background:b.color}}/><strong>{featured?b.name:b.short}</strong><small>{b.region}</small><b>{score(b.id)}</b></>:<><i className="bye"/><strong>Bye</strong><small>No opponent</small><b>—</b></>}</div></article>
}
function TeamTable({s,region,phase}:{s:GameState;region:Region;phase:PlayablePhase}){
  const ids=Object.values(s.teams).filter(team=>team.region===region).map(team=>team.id)
  const ordered=phase==='Kickoff'?[...ids].sort((a,b)=>s.kickoff[b].wins-s.kickoff[a].wins||s.kickoff[a].losses-s.kickoff[b].losses):rankedTeams(s,ids,phase)
  return <div className="table-wrap competition-table"><table><thead><tr><th>Pos</th><th>Organization</th><th>Series</th><th>Maps</th><th>{phase==='Kickoff'?'Bracket':'Qualification'}</th></tr></thead><tbody>{ordered.map((id,index)=>{
    const team=s.teams[id],record=phase==='Kickoff'?s.kickoff[id]:competitionRecord(s,id,phase)
    const playoffComplete=phase==='Stage 1'||phase==='Stage 2'?s.fixtures.some(fixture=>fixture.season===s.season&&fixture.phase===phase&&fixture.region===region&&fixture.label==='Grand Final'&&fixture.status==='completed'):false
    const qualifiers=phase==='Stage 1'||phase==='Stage 2'?regionalPlayoffQualifiers(s,phase,region):[]
    const qualification=playoffComplete?qualifiers.indexOf(id):-1
    const label=phase==='Kickoff'?(s.kickoff[id].status==='active'?record.losses===0?'Upper':record.losses===1?'Middle':'Lower':s.kickoff[id].status):qualification>=0?(phase==='Stage 1'?'Masters 2 #':'Champions #')+(qualification+1):index<6?'Playoff line':'Outside top 6'
    return <tr className={id===s.currentTeamId?'current':''} key={id}><td>{String(index+1).padStart(2,'0')}</td><td><strong><span className="mini" style={{background:team.color}}>{team.short.slice(0,2)}</span>{team.name}</strong></td><td>{record.wins}–{record.losses}</td><td>{'mapWins' in record?`${record.mapWins}–${record.mapLosses}`:'—'}</td><td><Badge color={label==='qualified'||label==='Playoff line'||label.includes('#')?'#d7ff56':label==='eliminated'?'#ff7882':'#94a3b8'}>{label}</Badge></td></tr>
  })}</tbody></table></div>
}
function RegionPicker({region,setRegion}:{region:Region;setRegion:(value:Region)=>void}){return <div className="region-picker">{regions.map(value=><button className={region===value?'active':''} onClick={()=>setRegion(value)} key={value}><i style={{background:colors[value]}}/>{value}</button>)}</div>}
function Schedule({s,fixtures,title,empty}:{s:GameState;fixtures:Fixture[];title:string;empty?:string}){return <section className="panel schedule-panel"><PanelTitle eyebrow="MATCH DESK" title={title} right={<Badge>{fixtures.length} matches</Badge>}/>{fixtures.length?<div className="matchup-list">{fixtures.map(fixture=><FixtureCard s={s} fixture={fixture} featured key={fixture.id}/>)}</div>:<div className="competition-empty"><strong>Nothing on the slate</strong><span>{empty??'No matches are scheduled in this window.'}</span></div>}</section>}
function Matchday({week,setWeek,min,max}:{week:number;setWeek:(week:number)=>void;min:number;max:number}){return <div className="matchday-control"><button onClick={()=>setWeek(Math.max(min,week-1))}>←</button><span><small>SELECTED MATCHDAY</small><strong>Week {week} · {dateForWeek(week)}</strong></span><button onClick={()=>setWeek(Math.min(max,week+1))}>→</button></div>}

function KickoffView({s,region,week,setWeek}:{s:GameState;region:Region;week:number;setWeek:(week:number)=>void}){
  const ids=Object.values(s.teams).filter(team=>team.region===region).map(team=>team.id)
  const openingByes=ids.filter(id=>s.kickoff[id].openingBye)
  const buckets=[
    {key:'upper',title:'Upper bracket',note:'No losses',ids:ids.filter(id=>s.kickoff[id].status==='active'&&s.kickoff[id].losses===0)},
    {key:'middle',title:'Middle bracket',note:'One loss',ids:ids.filter(id=>s.kickoff[id].status==='active'&&s.kickoff[id].losses===1)},
    {key:'lower',title:'Lower bracket',note:'Final life',ids:ids.filter(id=>s.kickoff[id].status==='active'&&s.kickoff[id].losses===2)},
    {key:'qualified',title:'Masters bound',note:'Final won',ids:ids.filter(id=>s.kickoff[id].status==='qualified')},
  ]
  const fixtures=fixturesForWeek(s,week).filter(fixture=>fixture.phase==='Kickoff'&&fixture.region===region)
  return <><section className="panel format-explainer"><div><div className="eyebrow">HOW THE FORMAT WORKS</div><h2>Three lives. Seeds with an opening bye.</h2><p>Eight teams play in round one. The four organizations that reached last year's Champions start in the second upper-bracket round. Losses then move teams through the middle and lower paths.</p></div><div className="life-key"><span>Upper</span><b>→</b><span>Middle</span><b>→</b><span>Lower</span><b>→</b><span>Out</span></div></section>
    <section className="panel kickoff-byes"><PanelTitle eyebrow="OPENING ROUND" title="Returning Champions receive byes" right={<Badge>4 byes</Badge>}/><div className="bye-list">{openingByes.map(id=>{const team=s.teams[id];return <article key={id}><i style={{background:team.color}}/><strong>{team.name}</strong><small>Upper Round 2</small></article>})}</div><p>These teams skip week one and enter the second upper-bracket round against a round-one winner.</p></section>
    <section className="kickoff-board">{buckets.map(bucket=><div className={`life-lane ${bucket.key}`} key={bucket.key}><header><span>{bucket.title}</span><small>{bucket.note}</small><b>{bucket.ids.length}</b></header><div>{bucket.ids.length?bucket.ids.map(id=>{const team=s.teams[id],record=s.kickoff[id];return <article className={id===s.currentTeamId?'managed':''} key={id}><i style={{background:team.color}}/><strong>{team.short}</strong><small>{team.name}</small><b>{record.wins}–{record.losses}</b></article>}):<p>No teams here</p>}</div></div>)}</section>
    <div className="competition-split"><section className="panel"><PanelTitle eyebrow={`${region.toUpperCase()} QUALIFICATION RACE`} title="Kickoff standings" right={<Badge color={colors[region]}>3 qualify</Badge>}/><TeamTable s={s} region={region} phase="Kickoff"/></section><div><Matchday week={week} setWeek={setWeek} min={1} max={6}/><Schedule s={s} fixtures={fixtures} title={`Week ${week} matchups`}/></div></div></>
}
function LeagueView({s,phase,region,week,setWeek,stage,setStage}:{s:GameState;phase:'Stage 1'|'Stage 2';region:Region;week:number;setWeek:(week:number)=>void;stage:'opening'|'playoffs';setStage:(stage:'opening'|'playoffs')=>void}){
  const info=events[phase],fixtures=fixturesForWeek(s,week).filter(fixture=>fixture.phase===phase&&fixture.region===region),current=fixtures.filter(fixture=>stageFor(fixture)===(stage==='opening'?'League':'Playoffs'))
  const playoffFixtures=s.fixtures.filter(fixture=>fixture.season===s.season&&fixture.phase===phase&&fixture.region===region&&stageFor(fixture)==='Playoffs')
  const qualificationCount=phase==='Stage 1'?3:4
  return <>
    <div className="stage-tabs">
      <button className={stage==='opening'?'active':''} onClick={()=>setStage('opening')}><small>01</small>League stage</button>
      <button className={stage==='playoffs'?'active':''} onClick={()=>setStage('playoffs')}><small>02</small>Regional playoffs</button>
    </div>
    {stage==='opening'
      ?<div className="competition-split"><section className="panel"><PanelTitle eyebrow={region.toUpperCase()+' / '+phase.toUpperCase()} title="League table" right={<Badge color={colors[region]}>{"Top 6 playoffs · "+qualificationCount+" qualify"}</Badge>}/><TeamTable s={s} region={region} phase={phase}/></section><div><Matchday week={week} setWeek={setWeek} min={info.start} max={info.end}/><Schedule s={s} fixtures={current} title={region+' league fixtures'} empty="The league schedule begins when this split starts."/></div></div>
      :<><PlayoffBracket s={s} fixtures={playoffFixtures}/><Matchday week={week} setWeek={setWeek} min={info.start} max={info.end}/><Schedule s={s} fixtures={current} title={region+' playoff matchups'} empty="The regional playoff bracket fills after league play concludes."/></>}
  </>
}
function fixtureRecord(id:string,fixtures:Fixture[]){let wins=0,losses=0;fixtures.filter(f=>f.status==='completed'&&(f.aId===id||f.bId===id)).forEach(f=>f.winnerId===id?wins++:losses++);return{wins,losses}}
function SwissView({s,phase,fixtures}:{s:GameState;phase:'Masters 1'|'Masters 2';fixtures:Fixture[]}){
  const source=phase==='Masters 1'?'Kickoff':'Stage 1',direct=regions.map(region=>phase==='Masters 1'?rankedTeams(s,Object.values(s.teams).filter(team=>team.region===region).map(team=>team.id),source)[0]:regionalPlayoffQualifiers(s,'Stage 1',region,3)[0])
  const swiss=fixtures.filter(f=>stageFor(f)==='Swiss'),ids=[...new Set(swiss.flatMap(f=>f.bId?[f.aId,f.bId]:[f.aId]))]
  const ordered=[...ids].sort((a,b)=>{const ar=fixtureRecord(a,swiss),br=fixtureRecord(b,swiss);return br.wins-ar.wins||ar.losses-br.losses})
  return <div className="tournament-stage-grid"><section className="panel direct-seeds"><PanelTitle eyebrow="DIRECT PLAYOFF SEEDS" title="Regional champions"/><p>These four teams skip Swiss and enter the upper playoff bracket.</p>{direct.map(id=>{const team=s.teams[id];return <article key={id}><i style={{background:team.color}}/><strong>{team.name}</strong><small>{team.region} #1</small></article>})}</section><section className="panel swiss-panel"><PanelTitle eyebrow="SWISS STAGE" title="Two wins advance. Two losses eliminate." right={<Badge>4 spots</Badge>}/><div className="swiss-table">{ordered.map((id,index)=>{const team=s.teams[id],record=fixtureRecord(id,swiss),state=record.wins>=2?'Advanced':record.losses>=2?'Eliminated':'In play';return <article className={id===s.currentTeamId?'managed':''} key={id}><b>{index+1}</b><i style={{background:team.color}}/><span><strong>{team.name}</strong><small>{team.region}</small></span><em>{record.wins}–{record.losses}</em><Badge color={state==='Advanced'?'#d7ff56':state==='Eliminated'?'#ff7882':'#94a3b8'}>{state}</Badge></article>})}{!ordered.length&&<div className="competition-empty"><strong>Swiss draw pending</strong><span>The eight non-champion seeds appear here when the event begins.</span></div>}</div></section></div>
}
const bracketColumns=[
  {key:'Upper Quarterfinal',title:'Quarterfinals',lane:'upper'},{key:'Upper Semifinal',title:'Semifinals',lane:'upper'},{key:'Upper Final',title:'Upper final',lane:'upper'},
  {key:'Lower Round 1',title:'Round 1',lane:'lower'},{key:'Lower Round 2',title:'Round 2',lane:'lower'},{key:'Lower Round 3',title:'Round 3',lane:'lower'},{key:'Lower Final',title:'Lower final',lane:'lower'},
] as const
function PlayoffBracket({s,fixtures}:{s:GameState;fixtures:Fixture[]}){
  const playoff=fixtures.filter(f=>stageFor(f)==='Playoffs'),final=playoff.find(f=>f.label==='Grand Final')
  const lane=(name:'upper'|'lower')=><section className={`bracket-lane ${name}`}><header><div><b>{name==='upper'?'Upper bracket':'Lower bracket'}</b><span>{name==='upper'?'A loss moves a team to the lower path':'Every series is elimination'}</span></div></header><div className="bracket-path">{bracketColumns.filter(c=>c.lane===name).map(column=>{const matches=playoff.filter(f=>f.label===column.key);return <div className="bracket-step" key={column.key}><h3>{column.title}<small>{matches.length||'—'} matches</small></h3>{matches.length?matches.map(f=><FixtureCard s={s} fixture={f} key={f.id}/>):<div className="bracket-placeholder"><strong>Awaiting teams</strong><span>Previous results fill this round.</span></div>}</div>})}</div></section>
  return <section className="playoff-board"><div className="bracket-legend"><span><i/>Upper path</span><span><i/>Elimination path</span></div>{lane('upper')}{lane('lower')}<div className="grand-final"><div><div className="eyebrow">TITLE MATCH</div><h2>Grand final</h2><p>The upper-bracket winner meets the survivor of the lower bracket.</p></div>{final?<FixtureCard s={s} fixture={final} featured/>:<div className="bracket-placeholder"><strong>Finalists not decided</strong><span>The title match appears when both paths finish.</span></div>}</div></section>
}
function ChampionsGroups({s,fixtures}:{s:GameState;fixtures:Fixture[]}){return <section className="panel"><PanelTitle eyebrow="CHAMPIONS GROUP STAGE" title="Four double-elimination groups" right={<Badge>Top 2 advance</Badge>}/><div className="group-grid">{(['A','B','C','D'] as const).map(group=>{const matches=fixtures.filter(f=>f.group===group),ids=[...new Set(matches.flatMap(f=>f.bId?[f.aId,f.bId]:[f.aId]))];return <article className="group-card" key={group}><header><strong>Group {group}</strong><small>{matches.length} matches</small></header>{ids.sort((a,b)=>{const ar=fixtureRecord(a,matches),br=fixtureRecord(b,matches);return br.wins-ar.wins||ar.losses-br.losses}).map((id,index)=>{const team=s.teams[id],record=fixtureRecord(id,matches);return <div className={id===s.currentTeamId?'managed':''} key={id}><b>{index+1}</b><i style={{background:team.color}}/><strong>{team.short}</strong><small>{record.wins}–{record.losses}</small></div>})}{!ids.length&&<p>Draw pending</p>}</article>})}</div></section>}
function InternationalView({s,phase,stage,setStage}:{s:GameState;phase:'Masters 1'|'Masters 2'|'Champions';stage:'opening'|'playoffs';setStage:(stage:'opening'|'playoffs')=>void}){
  const fixtures=s.fixtures.filter(f=>f.season===s.season&&f.phase===phase&&f.scope==='international'),current=fixtures.filter(f=>f.status==='scheduled'&&f.week===s.week)
  return <><div className="stage-tabs"><button className={stage==='opening'?'active':''} onClick={()=>setStage('opening')}><small>01</small>{phase==='Champions'?'Group stage':'Swiss stage'}</button><button className={stage==='playoffs'?'active':''} onClick={()=>setStage('playoffs')}><small>02</small>Playoff bracket</button></div>{stage==='opening'?(phase==='Champions'?<ChampionsGroups s={s} fixtures={fixtures.filter(f=>stageFor(f)==='Groups')}/>:<SwissView s={s} phase={phase} fixtures={fixtures}/>):<PlayoffBracket s={s} fixtures={fixtures}/>}<Schedule s={s} fixtures={current} title={`${phase} · current matchups`} empty={s.week<events[phase].start?'The qualified field appears when the event begins.':'No matches remain this week.'}/></>
}
export function CompetitionV2({s}:{s:GameState}){
  const active=activePhaseForWeek(s.week),initial=(active==='Offseason'?'Champions':active) as PlayablePhase
  const[phase,setPhase]=useState<PlayablePhase>(initial),[region,setRegion]=useState<Region>(currentTeam(s).region),[week,setWeek]=useState(Math.max(events[initial].start,Math.min(events[initial].end,s.week))),[stage,setStage]=useState<'opening'|'playoffs'>(s.week>=playoffStartFor(initial)?'playoffs':'opening')
  const info=events[phase],status=statusFor(s,phase),selectEvent=(next:PlayablePhase)=>{setPhase(next);setWeek(Math.max(events[next].start,Math.min(events[next].end,s.week)));setStage(s.week>=playoffStartFor(next)?'playoffs':'opening')}
  return <div className="page competition-hub"><div className="page-head"><div><div className="eyebrow">COMPETITION CENTER / WEEK {s.week}</div><h1>The road through {s.season}.</h1><p>Move event by event through the season. Every format has its own standings, rules, and match path.</p></div></div>
    <nav className="event-rail">{eventOrder.map((event,index)=><button className={phase===event?'active':''} onClick={()=>selectEvent(event)} key={event}><small>{String(index+1).padStart(2,'0')}</small><span><strong>{event}</strong><em>{events[event].location}</em></span><i className={statusFor(s,event).toLowerCase().replace(' ','-')}/></button>)}</nav>
    <section className="event-hero"><div><div className="event-kicker"><span className={`event-status ${status.toLowerCase().replace(' ','-')}`}>{status}</span><span>{info.type==='international'?'Global event':region}</span><span>Weeks {info.start}–{info.end}</span></div><h2>{phase}<em> · {info.type==='international'?info.location:region}</em></h2><p>{info.format}</p></div><aside><small>WHAT IS AT STAKE</small><strong>{info.stakes}</strong><span>{dateForWeek(info.start)} — {dateForWeek(info.end)}</span></aside></section>
    {info.type==='regional'&&<RegionPicker region={region} setRegion={setRegion}/>}
    {phase==='Kickoff'?<KickoffView s={s} region={region} week={week} setWeek={setWeek}/>:phase==='Stage 1'||phase==='Stage 2'?<LeagueView s={s} phase={phase} region={region} week={week} setWeek={setWeek} stage={stage} setStage={setStage}/>:<InternationalView s={s} phase={phase} stage={stage} setStage={setStage}/>}
  </div>
}
