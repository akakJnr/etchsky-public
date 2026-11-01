export interface JourneyStop {
  /** proper name as listed in named.json, a search label such as "HIP 1234", or a star index */
  star: string | number;
  title: string;
  text: string;
  fov: number;
}

export interface Journey {
  id: string;
  title: string;
  blurb: string;
  stops: JourneyStop[];
}

export const JOURNEYS: Journey[] = [
  {
    id: 'brightest',
    title: 'The brightest stars',
    blurb: 'Six stars that stand out on any clear night.',
    stops: [
      { star: 'Sirius', title: 'Sirius', fov: 14, text: 'The brightest star in the night sky. It is only 8.6 light years away, which is close for a star.' },
      { star: 'Canopus', title: 'Canopus', fov: 14, text: 'Second brightest. It is far away, about 310 light years, so it must be enormously powerful to shine this brightly.' },
      { star: 'Arcturus', title: 'Arcturus', fov: 14, text: 'An orange giant. It is old, and it is racing through the galaxy faster than most stars near the Sun.' },
      { star: 'Vega', title: 'Vega', fov: 14, text: 'A hot white star that spins so fast it bulges at the equator. It will be our pole star again in around 12,000 years.' },
      { star: 'Capella', title: 'Capella', fov: 14, text: 'It looks like one star, but it is four: two bright yellow giants, and two faint red dwarfs further out.' },
      { star: 'Rigel', title: 'Rigel', fov: 14, text: 'A blue-white supergiant tens of thousands of times brighter than the Sun, at the foot of Orion.' },
    ],
  },
  {
    id: 'neighbours',
    title: 'Neighbours of the Sun',
    blurb: 'The closest stars to us, most of them too faint to see.',
    stops: [
      { star: 'Proxima Centauri', title: 'Proxima Centauri', fov: 5, text: 'The closest star to the Sun, 4.2 light years away. It is a small red dwarf, far too faint to see without a telescope.' },
      { star: 'Rigil Kentaurus', title: 'Alpha Centauri', fov: 10, text: 'Proxima has two brighter companions here. Together they are the closest star system, and one of the brightest in the southern sky.' },
      { star: "Barnard's Star", title: "Barnard's Star", fov: 5, text: 'A faint red dwarf about six light years away. It has the fastest apparent motion across the sky of any known star.' },
      { star: 'Wolf 359', title: 'Wolf 359', fov: 5, text: 'One of the faintest and nearest stars we know of, at about eight light years.' },
      { star: 'Sirius', title: 'Sirius', fov: 12, text: 'And the brightest star in the sky is also our neighbour, 8.6 light years away.' },
      { star: 'Procyon', title: 'Procyon', fov: 12, text: 'Another bright star next door, 11.5 light years away. A faint white dwarf circles it.' },
    ],
  },
  {
    id: 'orion',
    title: 'Orion, the hunter',
    blurb: 'A tour of the most recognisable constellation.',
    stops: [
      { star: 'Betelgeuse', title: 'Betelgeuse', fov: 22, text: 'The red shoulder of Orion. It is a supergiant so large that it would fill the orbit of Mars if it took the Sun\'s place.' },
      { star: 'Bellatrix', title: 'Bellatrix', fov: 22, text: 'The other shoulder. A hot blue-white star, much younger than the Sun.' },
      { star: 'Alnitak', title: 'Alnitak', fov: 12, text: 'The eastern star of Orion\'s Belt. Next to it sits the Flame Nebula, a cloud where new stars are forming.' },
      { star: 'Alnilam', title: 'Alnilam', fov: 12, text: 'The middle of the Belt, a blue supergiant shining hundreds of thousands of times brighter than the Sun.' },
      { star: 'Mintaka', title: 'Mintaka', fov: 12, text: 'The western end of the Belt. These three stars make one of the easiest patterns to find in the sky.' },
      { star: 'Rigel', title: 'Rigel', fov: 22, text: 'Orion\'s bright blue foot. Betelgeuse and Rigel are opposites: one cool and red, one hot and blue.' },
    ],
  },
];
