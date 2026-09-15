import { describe, expect, test } from 'bun:test'
import { advanceWeek, createGame, fixturesForWeek, rankedTeams, regionalPlayoffQualifiers } from '../src/game'

const memory=new Map<string,string>()
Object.assign(globalThis,{localStorage:{
  setItem:(key:string,value:string)=>memory.set(key,value),
  getItem:(key:string)=>memory.get(key)??null,
  removeItem:(key:string)=>memory.delete(key),
}})

const advance=(weeks:number)=>{
  let state=createGame('Regional test','sen')
  for(let index=0;index<weeks;index++)state=advanceWeek(state,'Measured defaults','Disciplined retakes')
  return state
}

describe('regional split playoffs',()=>{
  test('Kickoff gives prior Champions teams round-one byes',()=>{
    const state=createGame('Regional test','sen')
    ;(['Americas','EMEA','Pacific','China'] as const).forEach(region=>{
      const byes=Object.values(state.teams).filter(team=>team.region===region&&state.kickoff[team.id].openingBye).map(team=>team.id)
      const weekOne=fixturesForWeek(state,1).filter(fixture=>fixture.region===region&&fixture.bId)
      expect(byes).toHaveLength(4)
      expect(weekOne).toHaveLength(4)
      expect(new Set(weekOne.flatMap(fixture=>[fixture.aId,fixture.bId]))).toHaveLength(8)
      expect(weekOne.every(fixture=>!byes.includes(fixture.aId)&&!byes.includes(fixture.bId!))).toBeTrue()
    })
    const weekTwo=advance(1)
    ;(['Americas','EMEA','Pacific','China'] as const).forEach(region=>{
      const fixtures=fixturesForWeek(weekTwo,2).filter(fixture=>fixture.region===region)
      expect(fixtures.filter(fixture=>fixture.label==='Upper Round 2')).toHaveLength(4)
      expect(fixtures.filter(fixture=>fixture.label==='Middle Round 1')).toHaveLength(2)
    })
  })
  test("Kickoff uses BO5 only for the three bracket finals",()=>{
    const state=advance(6),finals=["Upper Final","Middle Final","Lower Final"]
    const kickoff=state.fixtures.filter(fixture=>fixture.phase==="Kickoff"&&fixture.bId)
    expect(kickoff.filter(fixture=>finals.includes(fixture.label))).toHaveLength(12)
    expect(kickoff.every(fixture=>finals.includes(fixture.label)?fixture.bestOf===5:fixture.bestOf===3)).toBeTrue()
  })
  test("Kickoff Round 2 pairs each Round 1 winner with a bye team",()=>{
    const state=advance(1),region="Americas"
    const byes=Object.values(state.teams).filter(team=>team.region===region&&state.kickoff[team.id].openingBye).map(team=>team.id)
    const roundOne=state.fixtures.filter(fixture=>fixture.phase==="Kickoff"&&fixture.region===region&&fixture.label==="Upper Round 1")
    const upperTwo=state.fixtures.filter(fixture=>fixture.phase==="Kickoff"&&fixture.region===region&&fixture.label==="Upper Round 2")
    expect(upperTwo).toHaveLength(4)
    expect(upperTwo.every(fixture=>byes.includes(fixture.aId))).toBeTrue()
    expect(upperTwo.map(fixture=>fixture.bId).sort()).toEqual(roundOne.map(fixture=>fixture.winnerId).sort())
  })
  test('the next season carries Champions qualifiers into Kickoff byes',{timeout:10000},()=>{
    const beforeReset=advance(51)
    const expected=new Map((['Americas','EMEA','Pacific','China'] as const).map(region=>[region,new Set(regionalPlayoffQualifiers(beforeReset,'Stage 2',region,4))]))
    const state=advanceWeek(beforeReset,'Measured defaults','Disciplined retakes')
    ;(['Americas','EMEA','Pacific','China'] as const).forEach(region=>{
      const actual=new Set(Object.values(state.teams).filter(team=>team.region===region&&state.kickoff[team.id].openingBye).map(team=>team.id))
      expect(actual).toEqual(expected.get(region))
    })
  })
  test('Stage 1 playoff results produce three Masters 2 qualifiers per region',()=>{
    const seeded=advance(15),state=advance(18)
    const playoffs=state.fixtures.filter(fixture=>fixture.phase==='Stage 1'&&fixture.stage==='Playoffs')
    expect(playoffs).toHaveLength(48)
    expect(playoffs.filter(fixture=>fixture.status==='completed')).toHaveLength(48)
    expect(playoffs.filter(fixture=>fixture.label==='Grand Final')).toHaveLength(4)
    ;(['Americas','EMEA','Pacific','China'] as const).forEach(region=>{
      const ids=Object.values(state.teams).filter(team=>team.region===region).map(team=>team.id)
      const seeds=rankedTeams(seeded,ids,'Stage 1')
      const upperQf=playoffs.filter(fixture=>fixture.region===region&&fixture.label==='Upper Quarterfinal')
      const lowerOne=playoffs.filter(fixture=>fixture.region===region&&fixture.label==='Lower Round 1')
      expect(upperQf).toHaveLength(2)
      expect(upperQf.flatMap(fixture=>[fixture.aId,fixture.bId]).sort()).toEqual(seeds.slice(2,6).sort())
      expect(lowerOne.flatMap(fixture=>[fixture.aId,fixture.bId])).toContain(seeds[6])
      expect(lowerOne.flatMap(fixture=>[fixture.aId,fixture.bId])).toContain(seeds[7])
      expect(regionalPlayoffQualifiers(state,'Stage 1',region)).toHaveLength(3)
    })
  })

  test('Stage 1 qualifiers are used to seed Masters 2',()=>{
    const state=advance(19)
    const opening=state.fixtures.filter(fixture=>fixture.phase==='Masters 2'&&fixture.label==='Swiss Opening')
    const swissIds=new Set(opening.flatMap(fixture=>[fixture.aId,fixture.bId]))
    ;(['Americas','EMEA','Pacific','China'] as const).forEach(region=>{
      const qualifiers=regionalPlayoffQualifiers(state,'Stage 1',region)
      expect(qualifiers.filter(id=>swissIds.has(id))).toHaveLength(2)
    })
  })

  test('Stage 2 playoff results produce four Champions qualifiers per region',()=>{
    const state=advance(35)
    const playoffs=state.fixtures.filter(fixture=>fixture.phase==='Stage 2'&&fixture.stage==='Playoffs')
    expect(playoffs).toHaveLength(48)
    expect(playoffs.filter(fixture=>fixture.status==='completed')).toHaveLength(48)
    ;(['Americas','EMEA','Pacific','China'] as const).forEach(region=>{
      expect(regionalPlayoffQualifiers(state,'Stage 2',region)).toHaveLength(4)
    })
  })
  test("Kickoff bracket paths stop the undefeated upper winner",()=>{
    const state=advance(6)
    ;(["Americas","EMEA","Pacific","China"] as const).forEach(region=>{
      const upperFinal=state.fixtures.find(fixture=>fixture.phase==="Kickoff"&&fixture.region===region&&fixture.label==="Upper Final")
      expect(upperFinal?.status).toBe("completed")
      const upperWinner=upperFinal?.winnerId
      expect(upperWinner).toBeDefined()
      expect(state.kickoff[upperWinner!].losses).toBe(0)
      expect(state.fixtures.filter(fixture=>fixture.phase==="Kickoff"&&fixture.region===region&&(fixture.aId===upperWinner||fixture.bId===upperWinner)).every(fixture=>fixture.week<=4)).toBeTrue()
      expect(Object.values(state.teams).filter(team=>team.region===region&&state.kickoff[team.id].status==="active")).toHaveLength(0)
    })
  })
})