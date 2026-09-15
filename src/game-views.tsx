import { useMemo, useState, type ReactNode } from 'react'
import {
  activePhaseForWeek, competitionRecord, currentTeam, dateForWeek, fixturesForWeek, isInternationalPhase,
  nextFixtureForTeam, phaseForWeek, rankedTeams, saveGame,
  type Fixture, type GameState, type MatchResult, type Player, type PlayerStat,
} from './game'
import { maps, roles, type Region, type Role } from './seed'

type View='dashboard'|'roster'|'training'|'scouting'|'tactics'|'matches'|'competition'|'finances'|'settings'
const colors:Record<Region,string>={Americas:'#62a0ff',EMEA:'#ff9b62',Pacific:'#7fe1c6',China:'#f1c75b'}
const phaseName=(week:number)=>phaseForWeek(week)==='Break'?`Break before ${activePhaseForWeek(week)}`:phaseForWeek(week)
const money=(value:number)=>`$${Math.max(0,Math.round(value)).toLocaleString()}`
const Badge=({children,color}:{children:ReactNode;color?:string})=><span className="badge" style={color?{color,borderColor:`${color}55`}:undefined}>{children}</span>
const Stat=({label,value,detail,accent=false}:{label:string;value:string;detail:string;accent?:boolean})=><div className={`stat ${accent?'accent':''}`}><small>{label}</small><strong>{value}</strong><span>{detail}</span></div>
const PanelTitle=({eyebrow,title,right}:{eyebrow:string;title:string;right?:ReactNode})=><div className="panel-title"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div>{right}</div>
const Page=({eyebrow,title,subtitle,children}:{eyebrow:string;title:string;subtitle:string;children:ReactNode})=><div className="page"><div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div><div className="season"><small>SEASON 2026</small><strong>{phaseName(1)}</strong></div></div>{children}</div>
const TeamMark=({s,id,big=false}:{s:GameState;id:string;big?:boolean})=>{const team=s.teams[id];return <b className={`mark ${big?'big':''}`} style={{background:team.color}}>{team.short.slice(0,3)}</b>}

function recentManagedMatches(s:GameState){
  return s.matches.filter(match=>match.aId===s.currentTeamId||match.bId===s.currentTeamId).slice(0,5)
}
function latestManagedMatch(s:GameState){return s.matches.find(match=>match.aId===s.currentTeamId||match.bId===s.currentTeamId)}
function fixtureOpponent(fixture:Fixture|undefined,teamId:string){if(!fixture)return undefined;return fixture.aId===teamId?fixture.bId:fixture.aId}
function MiniStandings({s,onView}:{s:GameState;onView:(view:View)=>void}){
  const team=currentTeam(s),active=activePhaseForWeek(s.week)
  const phase=active==='Masters 1'?'Kickoff':active==='Masters 2'?'Stage 1':active==='Champions'?'Stage 2':active
  const ids=Object.values(s.teams).filter(candidate=>candidate.region===team.region).map(candidate=>candidate.id)
  const ordered=phase==='Kickoff'?[...ids].sort((a,b)=>s.kickoff[b].wins-s.kickoff[a].wins||s.kickoff[a].losses-s.kickoff[b].losses):rankedTeams(s,ids,phase)
  return <section className="panel mini-standings">
    <PanelTitle eyebrow={`${team.region.toUpperCase()} / ${phase}`} title="Regional picture" right={<button className="link" onClick={()=>onView('competition')}>Open competition →</button>}/>
    {ordered.slice(0,5).map((id,index)=>{const candidate=s.teams[id];const record=phase==='Kickoff'?s.kickoff[id]:competitionRecord(s,id,phase);return <div className="mini-row" key={id}>
      <b>{String(index+1).padStart(2,'0')}</b><span className="mini" style={{background:candidate.color}}>{candidate.short.slice(0,2)}</span>
      <strong>{candidate.name}</strong><span>{record.wins}–{record.losses}</span><small>{phase==='Kickoff'?`${Math.max(0,3-record.losses)} lives`:`${candidate.championshipPoints} CP`}</small>
    </div>})}
  </section>
}

export function DashboardV2({s,setView,setMatchId}:{s:GameState;setView:(view:View)=>void;setMatchId?:(id:string)=>void}){
  const team=currentTeam(s),fixture=nextFixtureForTeam(s,team.id,s.week),opponentId=fixtureOpponent(fixture,team.id)
  const opponent=opponentId?s.teams[opponentId]:undefined,last=latestManagedMatch(s),recentResults=recentManagedMatches(s)
  const job=s.jobs.find(candidate=>candidate.status==='pending'&&candidate.expiresWeek>=s.week)
  const noMatch=phaseForWeek(s.week)==='Break'||!fixture
  return <Page eyebrow={`MANAGER DESK / WEEK ${s.week}`} title={`${s.managerName}, your next move matters.`}
    subtitle={phaseForWeek(s.week)==='Break'?'The calendar is between competitions. Review the field before play resumes.':'The fixture, competition state, and match preparation now stay synchronized.'}>
    <div className="stats">
      <Stat label="Organization" value={team.short} detail={team.name} accent/>
      <Stat label="Record" value={`${team.wins}–${team.losses}`} detail={`${team.mapWins}–${team.mapLosses} maps`}/>
      <Stat label="Cash balance" value={money(team.cash)} detail={`${money(team.salaryBudget)} salary budget`}/>
      <Stat label="Championship points" value={String(team.championshipPoints)} detail="performance points"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel spotlight">
        <PanelTitle eyebrow="CURRENT FIXTURE" title={fixture?.phase??phaseName(s.week)}
          right={<Badge color={isInternationalPhase(fixture?.phase??'')?'#d7ff56':colors[team.region]}>{fixture?.scope==='international'?'INTERNATIONAL':team.region}</Badge>}/>
        <div className="versus">
          <div><TeamMark s={s} id={team.id} big/><strong>{team.name}</strong><small>YOUR ORGANIZATION</small></div>
          <em>{opponent?'VS':'—'}</em>
          <div>{opponent?<><TeamMark s={s} id={opponent.id} big/><strong>{opponent.name}</strong><small>{fixture?.label.toUpperCase()} · {dateForWeek(fixture?.week??s.week)}</small></>
            :<><b className="mark big opponent">—</b><strong>{phaseForWeek(s.week)==='Break'?'Calendar break':s.week===1&&s.kickoff[team.id]?.openingBye?'Opening-round bye':'No scheduled match'}</strong><small>{dateForWeek(s.week)}</small></>}</div>
        </div>
        <div className="spotlight-actions">
          <button className="primary full" onClick={()=>setView(noMatch?'competition':'tactics')}>{noMatch?'Open competition':'Prepare match'} <b>→</b></button>
          <button className="secondary full" onClick={()=>setView('competition')}>{fixture?.phase==='Kickoff'?'View Kickoff bracket':'View fixtures & standings'}</button>
        </div>
      </section>
      <section className="panel recent-results-panel">
        <PanelTitle eyebrow="RECENT RESULTS" title="Recent results" right={<button className="link" onClick={()=>setView("matches")}>Match center →</button>}/>
        <div className="recent-results">
          {recentResults.length?recentResults.map(match=>{
            const home=s.teams[match.aId],away=s.teams[match.bId]
            return <button className="recent-result" key={match.id} onClick={()=>{setMatchId?.(match.id);setView("matches")}}>
              <span className="recent-result-context"><small>WEEK {match.week}</small><em>{match.phase}</em></span>
              <span className="recent-result-score"><strong className={match.winnerId===match.aId?"winner":""}>{home.short}</strong><b>{match.aScore}–{match.bScore}</b><strong className={match.winnerId===match.bId?"winner":""}>{away.short}</strong></span>
              <span className="recent-result-date">{dateForWeek(match.week)} <b>→</b></span>
            </button>
          }):<div className="recent-results-empty">No matches played yet.</div>}
        </div>
      </section>
    </div>
    <MiniStandings s={s} onView={setView}/>
    {job&&<section className="panel offer"><PanelTitle eyebrow="CAREER MARKET" title="Offer on the table" right={<Badge color="#d7ff56">NEW</Badge>}/><div><span><strong>{s.teams[job.teamId].name}</strong><small>{job.reason}</small></span><span className="offer-action">{money(job.salary)} / year<button className="primary compact" onClick={()=>setView('settings')}>Review offer</button></span></div></section>}
    {last&&<section className="panel result"><PanelTitle eyebrow={`LAST RESULT / ${last.phase}`} title={last.winnerId===team.id?'Series win':'Series loss'} right={<button className="link" onClick={()=>setView('matches')}>Open match center →</button>}/><div><strong>{s.teams[last.aId].short}</strong><b className={last.winnerId===last.aId?'win':''}>{last.aScore}</b><span>–</span><b className={last.winnerId===last.bId?'win':''}>{last.bScore}</b><strong>{s.teams[last.bId].short}</strong><small>BO{last.bestOf}</small></div></section>}
  </Page>
}

export function TacticsV2({s,setState,attack,setAttack,defense,setDefense}:{s:GameState;setState:(state:GameState)=>void;attack:string;setAttack:(value:string)=>void;defense:string;setDefense:(value:string)=>void}){
  const team=currentTeam(s),players=team.lineup.map(id=>s.players[id]).filter(Boolean)
  const fixture=nextFixtureForTeam(s,team.id,s.week),opponentId=fixtureOpponent(fixture,team.id),opponent=opponentId?s.teams[opponentId]:undefined
  const setRole=(player:Player,role:Role)=>{const next=structuredClone(s);next.teams[team.id].roleAssignments[player.id]=role;saveGame(next);setState(next)}
  return <Page eyebrow={`MATCH PREPARATION / ${phaseName(s.week)}`} title={opponent?`${team.short} vs ${opponent.short}`:'No match to prepare'}
    subtitle={opponent?`${fixture?.label} · ${dateForWeek(fixture?.week??s.week)} · BO${fixture?.bestOf}`:'Open Competition to review the current bracket and upcoming schedule.'}>
    {opponent&&<section className="panel prep-opponent"><div><TeamMark s={s} id={team.id}/><strong>{team.name}</strong></div><span>VS</span><div><TeamMark s={s} id={opponent.id}/><strong>{opponent.name}</strong></div></section>}
    <div className="columns">
      <section className="panel"><PanelTitle eyebrow="STARTING LINEUP" title="Five for the series" right={<span className="muted">Role fit matters</span>}/>
        {players.map((player,index)=><div className="lineup" key={player.id}><b>0{index+1}</b><span><strong>{player.name}</strong><small>Primary {player.primaryRole} · {player.secondaryRoles.join(', ')||'no secondary'}</small></span>
          <select value={team.roleAssignments[player.id]??player.primaryRole} onChange={event=>setRole(player,event.target.value as Role)}>{roles.map(role=><option key={role}>{role}</option>)}</select></div>)}
      </section>
      <section className="panel"><PanelTitle eyebrow="SERIES PLAN" title="Broad tactical identity"/>
        <label className="field">Attack style<select value={attack} onChange={event=>setAttack(event.target.value)}><option>Measured defaults</option><option>Fast and explosive</option><option>Slow information play</option></select></label>
        <label className="field">Defense style<select value={defense} onChange={event=>setDefense(event.target.value)}><option>Disciplined retakes</option><option>Proactive contesting</option><option>Deep site anchors</option></select></label>
        <div className="maps"><div className="eyebrow">MAP VETO / MVP ORDER</div>{maps.map((map,index)=><div className={index<(fixture?.bestOf??3)?'map selected':'map'} key={map}><b>{index+1}</b>{map}<small>{index<(fixture?.bestOf??3)?'selected':'ban'}</small></div>)}</div>
      </section>
    </div>
  </Page>
}

function aggregateStats(match:MatchResult,mapIndex:'series'|number):Record<string,PlayerStat>{
  const selected=mapIndex==='series'?match.maps:[match.maps[mapIndex]]
  const totals:Record<string,PlayerStat&{maps:number}>={}
  selected.forEach(map=>Object.entries(map.stats).forEach(([id,stat])=>{
    const current=totals[id]??{kills:0,deaths:0,assists:0,acs:0,adr:0,kast:0,firstKills:0,firstDeaths:0,clutches:0,plants:0,defuses:0,headshots:0,maps:0}
    current.kills+=stat.kills;current.deaths+=stat.deaths;current.assists+=stat.assists
    current.acs+=stat.acs;current.adr+=stat.adr;current.kast+=stat.kast;current.firstKills+=stat.firstKills;current.firstDeaths+=stat.firstDeaths
    current.clutches+=stat.clutches;current.plants+=stat.plants;current.defuses+=stat.defuses;current.headshots+=stat.headshots;current.maps++
    totals[id]=current
  }))
  return Object.fromEntries(Object.entries(totals).map(([id,stat])=>[id,{...stat,acs:Math.round(stat.acs/stat.maps),adr:Math.round(stat.adr/stat.maps),kast:Math.round(stat.kast/stat.maps)}]))
}

type ScoreboardMode="teams"|"lobby"
type ScoreDirection="asc"|"desc"
type ScoreNumericKey="acs"|"adr"|"kills"|"deaths"|"assists"|"kast"|"firstKills"|"firstDeaths"|"clutches"|"headshots"
type ScoreSortKey="player"|"kd"|ScoreNumericKey

const scoreColumns:Array<{key:ScoreSortKey;label:string}>=[
  {key:"player",label:"Player"},
  {key:"acs",label:"ACS"},
  {key:"adr",label:"ADR / damage"},
  {key:"kd",label:"K/D"},
  {key:"assists",label:"Assists"},
  {key:"kast",label:"KAST"},
  {key:"firstKills",label:"FK"},
  {key:"firstDeaths",label:"FD"},
  {key:"clutches",label:"Clutches"},
  {key:"headshots",label:"HS"},
]

function scoreValue(s:GameState,id:string,stat:PlayerStat,key:ScoreSortKey):number|string{
  if(key==="player")return s.players[id]?.name??""
  if(key==="kd")return stat.deaths?stat.kills/stat.deaths:stat.kills
  return {acs:stat.acs,adr:stat.adr,kills:stat.kills,deaths:stat.deaths,assists:stat.assists,kast:stat.kast,firstKills:stat.firstKills,firstDeaths:stat.firstDeaths,clutches:stat.clutches,headshots:stat.headshots}[key]
}

function sortedScoreIds(s:GameState,stats:Record<string,PlayerStat>,ids:string[],key:ScoreSortKey,direction:ScoreDirection){
  return [...ids].sort((leftId,rightId)=>{
    const left=scoreValue(s,leftId,stats[leftId],key),right=scoreValue(s,rightId,stats[rightId],key)
    const comparison=typeof left==="string"&&typeof right==="string"?left.localeCompare(right):Number(left)-Number(right)
    return comparison===0?(s.players[leftId]?.name??"").localeCompare(s.players[rightId]?.name??"")*(direction==="asc"?1:-1):comparison*(direction==="asc"?1:-1)
  })
}

function ScoreHeader({column,sortKey,direction,onSort}:{column:{key:ScoreSortKey;label:string};sortKey:ScoreSortKey;direction:ScoreDirection;onSort:(key:ScoreSortKey)=>void}){
  const active=sortKey===column.key
  return <th aria-sort={active?(direction==="asc"?"ascending":"descending"):"none"}><button type="button" className={active?"scoreboard-sort active":"scoreboard-sort"} onClick={()=>onSort(column.key)}>{column.label}<span aria-hidden="true">{active?(direction==="asc"?" ↑":" ↓"):" ↕"}</span></button></th>
}

function ScoreTable({s,stats,ids,sortKey,direction,onSort,showRank=false,showTeam=false}:{s:GameState;stats:Record<string,PlayerStat>;ids:string[];sortKey:ScoreSortKey;direction:ScoreDirection;onSort:(key:ScoreSortKey)=>void;showRank?:boolean;showTeam?:boolean}){
  const ordered=sortedScoreIds(s,stats,ids,sortKey,direction)
  return <div className="table-wrap scoreboard-table-wrap"><table className="scoreboard-table"><thead><tr>{showRank&&<th className="scoreboard-rank-head">#</th>}{showTeam&&<th>Team</th>}{scoreColumns.map(column=><ScoreHeader key={column.key} column={column} sortKey={sortKey} direction={direction} onSort={onSort}/>)}</tr></thead><tbody>
    {ordered.map((id,index)=>{const player=s.players[id],team=s.teams[player?.teamId??""];if(!player||!stats[id])return null;return <tr key={id}>{showRank&&<td className="scoreboard-rank">{String(index+1).padStart(2,"0")}</td>}{showTeam&&<td><span className="scoreboard-team-tag"><i style={{background:team?.color}}/>{team?.short}</span></td>}<td className="scoreboard-player"><strong>{player.name}</strong><small>{player.primaryRole}</small></td><td>{stats[id].acs}</td><td>{stats[id].adr}</td><td>{stats[id].kills}/{stats[id].deaths}</td><td>{stats[id].assists}</td><td>{stats[id].kast}%</td><td>{stats[id].firstKills}/{stats[id].firstDeaths}</td><td>{stats[id].clutches}</td><td>{stats[id].headshots}</td></tr>})}
  </tbody></table></div>
}

function Scoreboard({s,match,stats,mode,sortKey,direction,onSort,onModeChange}:{s:GameState;match:MatchResult;stats:Record<string,PlayerStat>;mode:ScoreboardMode;sortKey:ScoreSortKey;direction:ScoreDirection;onSort:(key:ScoreSortKey)=>void;onModeChange:(mode:ScoreboardMode)=>void}){
  const teams=[match.aId,match.bId]
  const allIds=Object.keys(stats)
  return <div className="scoreboard">
    <div className="scoreboard-toolbar"><div><div className="eyebrow">SCOREBOARD VIEW</div><div className="scoreboard-mode"><button type="button" className={mode==="teams"?"active":""} onClick={()=>onModeChange("teams")}>Teams separated</button><button type="button" className={mode==="lobby"?"active":""} onClick={()=>onModeChange("lobby")}>Lobby ranking</button></div></div><span className="muted">Click any column to sort · default: ACS</span></div>
    {mode==="teams"?<div className="scoreboard-teams">{teams.map((teamId,index)=>{const team=s.teams[teamId],teamIds=allIds.filter(id=>s.players[id]?.teamId===teamId);return <section className={index===0?"scoreboard-team scoreboard-team-a":"scoreboard-team scoreboard-team-b"} key={teamId}><div className="scoreboard-team-head"><div><span className="scoreboard-team-kicker">{index===0?"TEAM A":"TEAM B"}</span><strong><i style={{background:team.color}}/>{team.name}</strong></div><span className="scoreboard-team-score">{team.short}<b>{teamId===match.aId?match.aScore:match.bScore}</b></span></div><ScoreTable s={s} stats={stats} ids={teamIds} sortKey={sortKey} direction={direction} onSort={onSort}/></section>})}</div>:<section className="scoreboard-lobby"><div className="scoreboard-lobby-head"><div><span className="scoreboard-team-kicker">ALL PLAYERS</span><strong>Lobby ranking</strong></div><span className="muted">Ranked across both teams</span></div><ScoreTable s={s} stats={stats} ids={allIds} sortKey={sortKey} direction={direction} onSort={onSort} showRank showTeam/></section>}
  </div>
}

export function MatchesV2({s,initialMatchId}:{s:GameState;initialMatchId?:string}){
  const matches=s.matches
  const managedMatches=s.matches.filter(match=>match.aId===s.currentTeamId||match.bId===s.currentTeamId)
  const[selectedId,setSelectedId]=useState(matches.find(match=>match.id===initialMatchId)?.id??managedMatches[0]?.id??matches[0]?.id??"")
  const[tab,setTab]=useState<"series"|number>("series")
  const[scoreboardMode,setScoreboardMode]=useState<ScoreboardMode>("teams")
  const[sortKey,setSortKey]=useState<ScoreSortKey>("acs")
  const[sortDirection,setSortDirection]=useState<ScoreDirection>("desc")
  const match=matches.find(candidate=>candidate.id===selectedId)??matches[0]
  const stats=useMemo(()=>match?aggregateStats(match,tab):{},[match,tab])
  const setScoreSort=(key:ScoreSortKey)=>{
    if(key===sortKey)setSortDirection(current=>current==="desc"?"asc":"desc")
    else{setSortKey(key);setSortDirection(key==="player"?"asc":"desc")}
  }
  if(!match)return <Page eyebrow="BROADCAST CENTER / RESULTS" title="Every round tells a story." subtitle="Advance the week to play your first series."><section className="panel empty"><span>◌</span><h2>No matches played yet</h2><p>Your first result will appear here.</p></section></Page>
  const selectedMaps=tab==="series"?match.maps:[match.maps[tab]]
  const keyRounds=tab==="series"?[]:selectedMaps[0].rounds.filter(round=>round.includes("ACE")||round.includes("3K")||round.startsWith("OT")).slice(-8)
  return <Page eyebrow="BROADCAST CENTER / RESULTS" title="Every round tells a story." subtitle="Review the entire series or isolate any map. Every box-score event comes from the round simulation.">
    <section className="panel match-picker"><label>Series<select value={match.id} onChange={event=>{setSelectedId(event.target.value);setTab("series")}}>{matches.map(candidate=><option value={candidate.id} key={candidate.id}>W{candidate.week} · {s.teams[candidate.aId].short} {candidate.aScore}-{candidate.bScore} {s.teams[candidate.bId].short}</option>)}</select></label></section>
    <section className="broadcast"><div><span>{match.phase}</span><span>WEEK {match.week} · BO{match.bestOf}</span></div>
      <strong>{s.teams[match.aId].short}<b className={match.winnerId===match.aId?"win":""}>{match.aScore}</b> : <b className={match.winnerId===match.bId?"win":""}>{match.bScore}</b>{s.teams[match.bId].short}</strong>
      <div className="map-results">{match.maps.map((map,index)=><button className={tab===index?"active":""} onClick={()=>setTab(index)} key={map.map+"-"+index}><small>{map.map}</small><b>{map.aScore} — {map.bScore}</b><em>{s.teams[map.winnerId].short} won</em></button>)}</div>
    </section>
    <section className="panel">
      <div className="view-tabs"><button className={tab==="series"?"active":""} onClick={()=>setTab("series")}>Entire series</button>{match.maps.map((map,index)=><button className={tab===index?"active":""} onClick={()=>setTab(index)} key={map.map+"-tab"}>{map.map}</button>)}</div>
      <PanelTitle eyebrow={tab==="series"?"SERIES BOX SCORE":"MAP BOX SCORE / "+match.maps[tab as number].map} title={tab==="series"?"Series statistics":match.maps[tab as number].map+" statistics"} right={<span className="muted">ACS · ADR / damage per round · K/D</span>}/>
      <Scoreboard s={s} match={match} stats={stats} mode={scoreboardMode} sortKey={sortKey} direction={sortDirection} onSort={setScoreSort} onModeChange={setScoreboardMode}/>
    </section>
    <section className="panel"><PanelTitle eyebrow={tab==="series"?"SERIES NOTES":"ROUND REPLAY"} title={tab==="series"?"Match highlights":match.maps[tab as number].map+" key rounds"}/>
      {(tab==="series"?match.highlights:keyRounds.length?keyRounds:selectedMaps[0].rounds.slice(-6)).map((text,index)=><div className="highlight" key={text+"-"+index}>✦ {text}</div>)}
    </section>
  </Page>
}

function FixtureCard({s,fixture}:{s:GameState;fixture:Fixture}){
  const result=fixture.resultId?s.matches.find(match=>match.id===fixture.resultId):undefined
  const a=s.teams[fixture.aId],b=fixture.bId?s.teams[fixture.bId]:undefined
  return <div className={`bracket-match ${fixture.status}`}>
    <small>{fixture.label} · BO{fixture.bestOf}</small>
    <div className={result?.winnerId===a.id?'winner':''}><span className="team-dot" style={{background:a.color}}/>{a.short}<b>{result?(result.aId===a.id?result.aScore:result.bScore):'—'}</b></div>
    <div className={b&&result?.winnerId===b.id?'winner':''}>{b?<><span className="team-dot" style={{background:b.color}}/>{b.short}<b>{result?(result.aId===b.id?result.aScore:result.bScore):'—'}</b></>:<><span className="team-dot bye"/>BYE<b>—</b></>}</div>
  </div>
}
function StandingsTable({s,region,phase}:{s:GameState;region:Region;phase:string}){
  const ids=Object.values(s.teams).filter(team=>team.region===region).map(team=>team.id)
  const ordered=phase==='Kickoff'?[...ids].sort((a,b)=>s.kickoff[b].wins-s.kickoff[a].wins||s.kickoff[a].losses-s.kickoff[b].losses):rankedTeams(s,ids,phase)
  return <div className="table-wrap"><table><thead><tr><th>#</th><th>Organization</th><th>W</th><th>L</th><th>{phase==='Kickoff'?'Lives':'Maps'}</th><th>Status</th></tr></thead><tbody>
    {ordered.map((id,index)=>{const team=s.teams[id],record=phase==='Kickoff'?s.kickoff[id]:competitionRecord(s,id,phase);return <tr className={id===s.currentTeamId?'current':''} key={id}>
      <td>{String(index+1).padStart(2,'0')}</td><td><strong><span className="mini" style={{background:team.color}}>{team.short.slice(0,2)}</span>{team.name}</strong></td>
      <td>{record.wins}</td><td>{record.losses}</td><td>{phase==='Kickoff'?<span className="lives">{[0,1,2].map(life=><i className={life<record.losses?'lost':''} key={life}/>)}</span>:`${'mapWins' in record?record.mapWins:0}–${'mapLosses' in record?record.mapLosses:0}`}</td>
      <td><Badge color={phase==='Kickoff'?(s.kickoff[id].status==='qualified'?'#d7ff56':s.kickoff[id].status==='eliminated'?'#ff7882':'#94a3b8'):'#94a3b8'}>{phase==='Kickoff'?s.kickoff[id].status:team.playoffStage}</Badge></td>
    </tr>})}
  </tbody></table></div>
}

export function CompetitionV2({s}:{s:GameState}){
  const managed=currentTeam(s),currentPhase=activePhaseForWeek(s.week)
  const[scope,setScope]=useState<Region|'International'>(isInternationalPhase(currentPhase)?'International':managed.region)
  const[week,setWeek]=useState(s.week)
  const phase=scope==='International'
     ?(isInternationalPhase(currentPhase)?currentPhase:s.week<20?'Masters 1':s.week<36?'Masters 2':'Champions')
    :(week<=11?'Kickoff':week<=23?'Stage 1':'Stage 2')
  const boardFixtures=s.fixtures.filter(fixture=>fixture.season===s.season&&(scope==='International'?fixture.scope==='international'&&fixture.phase===phase:fixture.region===scope&&fixture.phase===phase))
  const grouped=Object.entries(boardFixtures.reduce<Record<string,Fixture[]>>((groups,fixture)=>{const key=String(fixture.round);(groups[key]??=[]).push(fixture);return groups},{})).sort(([left],[right])=>Number(left)-Number(right))
  const weekFixtures=fixturesForWeek(s,week).filter(fixture=>scope==='International'?fixture.scope==='international':fixture.region===scope)
  return <Page eyebrow={`COMPETITION HUB / WEEK ${s.week}`} title="See the whole field." subtitle="Kickoff uses three lives: a third series loss eliminates a team. Every scheduled and completed matchup is visible here.">
    <section className="panel competition-controls">
      <div className="tabs">{(['Americas','EMEA','Pacific','China','International'] as const).map(value=><button className={scope===value?'active':''} onClick={()=>setScope(value)} key={value}>{value}</button>)}</div>
      <div className="week-control"><button onClick={()=>setWeek(Math.max(1,week-1))}>←</button><strong>WEEK {week}</strong><span>{dateForWeek(week)}</span><button onClick={()=>setWeek(Math.min(52,week+1))}>→</button></div>
    </section>
    {scope!=='International'&&<section className="panel"><PanelTitle eyebrow={`${scope.toUpperCase()} / ${phase}`} title={phase==='Kickoff'?'Triple-elimination standings':'Regional standings'} right={<Badge color={colors[scope]}>{phase==='Kickoff'?'3 LOSSES = OUT':scope}</Badge>}/><StandingsTable s={s} region={scope} phase={phase}/></section>}
    <section className="panel bracket-panel">
      <PanelTitle eyebrow={scope==='International'?`${phase.toUpperCase()} / TOURNAMENT BRACKET`:`${scope.toUpperCase()} / ${String(phase).toUpperCase()} BRACKET`}
        title={phase==='Kickoff'?'Kickoff bracket':'Tournament board'} right={<Badge>{boardFixtures.length} fixtures</Badge>}/>
      {grouped.length?<div className="bracket-scroll">{grouped.map(([round,fixtures])=><div className="bracket-round" key={round}><div className="eyebrow">ROUND {round}</div>{fixtures!.map(fixture=><FixtureCard s={s} fixture={fixture} key={fixture.id}/>)}</div>)}</div>
        :<div className="competition-empty"><strong>No bracket fixtures yet</strong><span>This tournament field is populated when its qualification stage is complete.</span></div>}
    </section>
    <section className="panel"><PanelTitle eyebrow="WEEKLY MATCHUPS" title={`Week ${week} schedule`} right={<Badge>{weekFixtures.length} matches</Badge>}/>
      {weekFixtures.length?<div className="fixture-list">{weekFixtures.map(fixture=><FixtureCard s={s} fixture={fixture} key={fixture.id}/>)}</div>
        :<div className="competition-empty"><strong>No matches scheduled</strong><span>This is a calendar break or the selected field is not active this week.</span></div>}
    </section>
  </Page>
}
