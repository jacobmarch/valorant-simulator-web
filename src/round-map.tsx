import { X } from 'lucide-react'
import { mapImage } from './map-images'
import type { Mark, RoundFrame } from './round-stages'

const spikeText = {
  planted: 'Spike planted',
  defused: 'Spike defused',
  detonated: 'Spike detonated',
}

/**
 * The map with every player marked on the point they stand at for the current step. Dots glide
 * between points because their positions are CSS transitions.
 */
export function RoundMap({
  map,
  frame,
  name,
}: {
  map: string
  frame: RoundFrame
  name: (id: string) => string
}) {
  const image = mapImage(map)
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
    </figure>
  )
}
