// Minimap images for the pool, in src/assets/maps. Each is turned so its sites face up and the attack spawn sits at the bottom.
import abyss from './assets/maps/abyss.png'
import bind from './assets/maps/bind.png'
import breeze from './assets/maps/breeze.png'
import haven from './assets/maps/haven.png'
import icebox from './assets/maps/icebox.png'
import lotus from './assets/maps/lotus.png'
import sunset from './assets/maps/sunset.png'

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
