// Minimap images for the pool, from map_images/ (Breeze is turned 90° clockwise into src/assets/maps).
import abyss from '../map_images/abyss.png'
import bind from '../map_images/bind.png'
import breeze from './assets/maps/breeze.png'
import haven from '../map_images/haven.png'
import icebox from '../map_images/icebox.png'
import lotus from '../map_images/lotus.png'
import sunset from '../map_images/sunset.png'

const images: Record<string, string> = {
  Abyss: abyss,
  Bind: bind,
  Breeze: breeze,
  Haven: haven,
  Icebox: icebox,
  Lotus: lotus,
  Sunset: sunset,
}

export function mapImage(map: string): string | undefined {
  return images[map]
}
