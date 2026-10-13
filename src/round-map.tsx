import { X } from 'lucide-react'
import { mapImage } from './map-images'
import type { Mark, RoundFrame, Stage } from './round-stages'

const spikeText = {
  planted: 'Spike planted',
  defused: 'Spike defused',
  detonated: 'Spike detonated',
}

/**
 * The map with every player marked where they stand at the current step. Dots glide between
 * stages because their positions are CSS transitions, not re-rendered art.
 */
export function RoundMap({
  map,
  frame,
  stages,
  current,
  name,
  onStage,
}: {
  map: string
  frame: RoundFrame
  stages: Stage[]
  current: number
  name: (id: string) => string
  onStage: (index: number) => void
}) {
  const image = mapImage(map)
  const stage = stages[current]
  return (
    <figure className="round-map">
      <div className="round-map-board">
        {image ? <img src={image} alt={`${map} minimap`} /> : <div className="round-map-empty" />}
        {frame.spike && (
          <span
            className={`round-spike ${frame.spike.state}`}
            style={{ left: `${frame.spike.x}%`, top: `${frame.spike.y}%` }}
            title={`${spikeText[frame.spike.state]} on ${frame.spike.site}`}
          >
            {frame.spike.site}
          </span>
        )}
        {frame.marks.map((mark: Mark) => (
          <span
            key={mark.id}
            className={`round-dot side-${mark.side} ${mark.attacking ? 'attack' : 'defense'}${mark.alive ? '' : ' dead'}`}
            style={{ left: `${mark.x}%`, top: `${mark.y}%` }}
            title={name(mark.id)}
          >
            {mark.alive ? (
              name(mark.id).slice(0, 3)
            ) : (
              <X size={11} aria-label={`${name(mark.id)} out`} />
            )}
          </span>
        ))}
      </div>
      <figcaption>
        <ol className="round-stages" aria-label="Stages of this round">
          {stages.map((item, index) => (
            <li key={item.kind}>
              <button
                type="button"
                className={index === current ? 'current' : ''}
                aria-current={index === current ? 'step' : undefined}
                onClick={() => onStage(index)}
              >
                <small>{index + 1}</small>
                {item.label}
              </button>
            </li>
          ))}
        </ol>
        <p className="round-map-note">
          {stage.kind === 'setup' && 'Attackers spawn. Defenders are in position.'}
          {stage.kind === 'contact' && 'Attackers push in. Fights decide the round.'}
          {stage.kind === 'post-plant' &&
            (frame.spike?.state === 'detonated'
              ? 'The spike goes off.'
              : frame.spike?.state === 'defused'
                ? 'Defenders defuse in time.'
                : 'Spike is down. Defenders come in to retake.')}
        </p>
      </figcaption>
    </figure>
  )
}
