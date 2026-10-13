// Minimap images for the pool, from map_images/. Each one is square, so 0-100 layout points map straight onto it.
import abyss from '../map_images/abyss.png'
import bind from '../map_images/bind.png'
import breeze from '../map_images/breeze.png'
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
