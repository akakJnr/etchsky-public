// Hand-written stories for well-known stars, keyed by Hipparcos number.
// Facts are kept general on purpose; exact figures come from the catalog on screen.
export const STORIES: Record<string, string> = {
  '32349': 'Sirius is the brightest star in the night sky. It is really two stars: a bright white one and a faint, dense companion called Sirius B, a white dwarf about the size of Earth.',
  '30438': 'Canopus is the second brightest star in the night sky. Spacecraft use it as a navigation mark, because it is bright and sits far from the Sun in the sky.',
  '71683': 'Rigil Kentaurus, also called Alpha Centauri A, is part of the closest star system to the Sun. It has a slightly cooler companion, and a small red dwarf, Proxima Centauri, circling with them.',
  '69673': 'Arcturus is an orange giant and the brightest star in the northern half of the sky. It is old, and it moves quickly through the galaxy compared with most of its neighbours. Follow the curve of the Big Dipper\'s handle and you reach it.',
  '91262': 'Vega is a hot white star that spins so fast it bulges at the equator. It was the first star other than the Sun to be photographed, and it will be near the north celestial pole again in around 12,000 years.',
  '24608': 'Capella looks like one star, but it is two pairs of stars. The brighter pair are yellow giants, and the fainter pair are small red dwarfs.',
  '24436': 'Rigel is a blue-white supergiant in Orion, shining tens of thousands of times brighter than the Sun. It is the bright star marking the hunter\'s foot.',
  '37279': 'Procyon is one of our closest bright neighbours. Its name means "before the dog": it rises just ahead of Sirius, the Dog Star. A white dwarf circles it.',
  '27989': 'Betelgeuse is a red supergiant at the shoulder of Orion, so large that if it replaced the Sun it would swallow the inner planets. It pulses and changes brightness, and it dimmed sharply in 2019 and 2020.',
  '7588': 'Achernar spins so fast that it is flattened into a squashed ball, wider across its equator than from pole to pole.',
  '80763': 'Antares is a red supergiant, the heart of Scorpius. Its name means "rival of Mars", because its red colour looks so much like the planet.',
  '97649': 'Altair is a fast-spinning white star, one corner of the Summer Triangle with Vega and Deneb. It turns once in about nine hours, where the Sun takes about 25 days.',
  '21421': 'Aldebaran is an orange giant, the bright red-orange eye of Taurus the bull. It looks like part of the Hyades cluster beside it, but it sits much closer to us.',
  '65474': 'Spica is a close pair of hot blue stars that orbit each other in four days. Ancient Greek astronomers\' measurements of Spica helped reveal that Earth\'s axis slowly wobbles.',
  '49669': 'Regulus is the heart of Leo. Its name means "little king". It spins so fast that it is noticeably stretched, and it has companion stars.',
  '113368': 'Fomalhaut is the lone bright star of the autumn sky. A wide ring of dust and rubble circles it, like a young version of our own Kuiper belt.',
  '102098': 'Deneb is a very distant, very luminous white supergiant at the tail of the Swan. It is one of the most powerful stars you can see without a telescope.',
  '11767': 'Polaris, the North Star, sits almost directly above Earth\'s north pole, so it hardly moves while the rest of the sky turns around it. It is not especially bright. It is famous for where it sits.',
  '14576': 'Algol, the Demon Star, is a pair of stars that eclipse each other. Every two days and 21 hours or so it dims noticeably, and ancient sky-watchers noticed.',
  '65378': 'Mizar is the middle star in the handle of the Big Dipper. Next to it sits the fainter Alcor, and together they have been used as an eyesight test for centuries.',
  '65477': 'Alcor sits right next to Mizar in the handle of the Big Dipper. Spotting both as two separate stars was a traditional test of good eyesight.',
  '68756': 'Thuban was the north pole star about 4,700 years ago, when the pyramids of Egypt were being built. Earth\'s axis slowly wobbles, and the pole star changes over thousands of years.',
  '25930': 'Mintaka is the westernmost star of Orion\'s Belt. It is a multiple system of hot blue stars, one of the three bright stars in a short, straight line.',
  '26311': 'Alnilam, the middle star of Orion\'s Belt, is a blue supergiant that shines hundreds of thousands of times more brightly than the Sun.',
  '26727': 'Alnitak is the easternmost star of Orion\'s Belt. It is a hot multiple star sitting near the Flame Nebula.',
  '25336': 'Bellatrix, "the female warrior", is a hot blue-white star at Orion\'s left shoulder.',
  '8102': 'Tau Ceti is a quiet, Sun-like star close by. In 1960 it was one of the first two stars searched for radio messages from other civilisations.',
  '16537': 'Epsilon Eridani is a young, active, Sun-like star with a ring of dust and rubble. It was the other star in the first search for radio messages from other civilisations, in 1960.',
  '70890': 'Proxima Centauri is the closest known star to the Sun. It is a small, dim red dwarf, far too faint to see without a telescope, and at least one planet is known to orbit it.',
  '87937': 'Barnard\'s Star is a faint red dwarf with the fastest apparent motion across the sky of any known star. Over a human lifetime it shifts by a visible fraction of the Moon\'s width.',
};

export const KIND_STORIES: Record<string, string> = {
  'red dwarf': 'Red dwarfs are the most common stars in the galaxy. They burn their fuel so slowly that a red dwarf can shine for trillions of years, far longer than the roughly ten billion years the Sun will last.',
  'orange dwarf': 'Orange dwarfs are a little cooler and smaller than the Sun. They burn steadily for a very long time, longer than the Sun.',
  'yellow dwarf': 'This is a star of the same kind as the Sun: a steady, middle-aged star turning hydrogen into helium at its core.',
  'yellow-white dwarf': 'Hotter and brighter than the Sun, a star like this burns through its fuel faster, so it has a shorter life.',
  'white star': 'Hot white stars burn their fuel much faster than the Sun does, so they shine for a shorter time, in the hundreds of millions to a couple of billion years.',
  'blue-white star': 'Blue-white stars are rare, hot and powerful. They live fast, for only tens of millions of years, a blink compared with the Sun.',
  'blue star': 'Blue stars are the hottest and rarest of all. They shine with tremendous power and live for only a few million years.',
  giant: 'A giant is a star that has used up the hydrogen in its core and swollen to many times its old size. The Sun will become a red giant in about five billion years.',
  supergiant: 'Supergiants are among the largest and most luminous stars in the galaxy. They live fast, and they end their lives as supernova explosions.',
  subgiant: 'A subgiant has run low on hydrogen in its core and is starting to swell, on its way to becoming a giant.',
  'white dwarf': 'A white dwarf is the glowing core left over when a star like the Sun runs out of fuel. It is about the size of Earth but far heavier, and it slowly cools for billions of years.',
  unknown: 'Astronomers have measured how bright this star looks and what colour it is, but we do not yet know much more about it.',
};

export const EXPLAINERS = {
  distance: {
    title: 'How do we know the distance?',
    body: 'Astronomers watch a star from two points on Earth\'s orbit, six months apart. A nearby star appears to shift a tiny amount against the far background. That shift is called parallax, and the smaller it is, the farther the star.',
  },
  colour: {
    title: 'How do we know the temperature?',
    body: 'Hot stars look bluer and cool stars look redder. Astronomers compare a star\'s brightness through a blue filter and a visual filter. The difference, called the B−V colour index, gives the surface temperature.',
  },
  size: {
    title: 'How do we know the size?',
    body: 'Distance and apparent brightness give the star\'s true power. Power and temperature then give its size, because a hotter surface shines more light per square metre.',
  },
};

export const FACTS = [
  'Stars twinkle because the air above us bends their light. From space they shine steadily.',
  'The Sun is a star, and every other star you can see is a distant sun.',
  'Light from the Sun takes about eight minutes to reach us. Light from the next nearest star takes more than four years.',
  'A star\'s colour shows its temperature. Blue stars are hotter than red ones.',
  'Astronomers call a difference of five magnitudes a brightness difference of exactly 100 times.',
  'Most stars in our galaxy are red dwarfs, too faint to see without a telescope.',
  'The Milky Way holds at least a hundred billion stars.',
  'Polaris is not the brightest star. It is famous because it sits almost exactly above Earth\'s north pole.',
  'Ancient Greek astronomers sorted stars into six brightness classes. The scale we use now is a refined version of theirs.',
  'Looking at a faraway star means looking back in time: you see it as it was when its light set out.',
];
