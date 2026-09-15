import { beforeEach, describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { CompetitionV2 } from '../src/competition-view'
import { advanceWeek, createGame } from '../src/game'
import { MatchesV2 } from '../src/game-views'

const memory=new Map<string,string>()
Object.assign(globalThis,{localStorage:{
  setItem:(key:string,value:string)=>memory.set(key,value),
  getItem:(key:string)=>memory.get(key)??null,
  removeItem:(key:string)=>memory.delete(key),
}})
beforeEach(()=>memory.clear())

describe('competition center',()=>{
  test('Kickoff renders its three lives as named bracket lanes',()=>{
    const html=renderToStaticMarkup(<CompetitionV2 s={createGame('Manager','sen')}/>)
    expect(html).toContain('Upper bracket')
    expect(html).toContain('Middle bracket')
    expect(html).toContain('Lower bracket')
    expect(html).toContain('Masters bound')
    expect(html).toContain('Kickoff standings')
  })
  test('Masters opens on a Swiss view with direct regional seeds',()=>{
    let state=createGame('Manager','sen')
    for(let week=0;week<7;week++)state=advanceWeek(state,'Measured defaults','Disciplined retakes')
    const html=renderToStaticMarkup(<CompetitionV2 s={state}/>)
    expect(html).toContain('Swiss stage')
    expect(html).toContain('Regional champions')
    expect(html).toContain('Two wins advance. Two losses eliminate.')
    expect(html).toContain('Masters 1 · current matchups')
  })
  test('a completed season exposes the upper, lower, and title paths',()=>{
    let state=createGame('Manager','sen')
    for(let week=0;week<43;week++)state=advanceWeek(state,'Measured defaults','Disciplined retakes')
    const html=renderToStaticMarkup(<CompetitionV2 s={state}/>)
    expect(html).toContain('Upper bracket')
    expect(html).toContain('Lower bracket')
    expect(html).toContain('Grand final')
    expect(html).toContain('TITLE MATCH')
  })
  test('background match results are available in the reusable broadcast view',()=>{
    let state=createGame('Manager','sen')
    state=advanceWeek(state,'Measured defaults','Disciplined retakes')
    const background=state.matches.find(match=>{const a=state.teams[match.aId],b=state.teams[match.bId];return a.region==='Americas'&&a.id!==state.currentTeamId&&b.id!==state.currentTeamId})!
    const viewState=structuredClone(state); viewState.week=1
    const broadcast=renderToStaticMarkup(<MatchesV2 s={state} initialMatchId={background.id}/>)
    expect(broadcast).toContain(`value="${background.id}"`)
    expect(broadcast).toContain(state.teams[background.aId].name)
    expect(broadcast).toContain(state.teams[background.bId].name)
    expect((broadcast.match(/<option/g)??[]).length).toBe(state.matches.length)
    const competition=renderToStaticMarkup(<CompetitionV2 s={viewState} onOpenMatch={()=>{}}/>)
    expect((competition.match(/role="button"/g)??[]).length).toBeGreaterThan(0)
  })
})