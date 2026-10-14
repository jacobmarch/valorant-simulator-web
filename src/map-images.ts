// Minimap images for the pool, from map_images/. Breeze, Abyss and Haven are turned in src/assets/maps (Breeze 90° clockwise, Abyss and Haven 180°).
import abyss from './assets/maps/abyss.png'
import bind from '../map_images/bind.png'
import breeze from './assets/maps/breeze.png'
import haven from './assets/maps/haven.png'
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
