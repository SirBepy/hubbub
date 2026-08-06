/** Hero-screen slogan pool: one line shown at random under the wordmark while
 * the room has zero players. Source: .for_bepy/mockups/slogan-pool.md (approved copy). */
export const SLOGANS = [
  // Absurdist deadpan
  "This sentence is load-bearing.",
  "A goose owns forty percent of this screen.",
  "This has been peer-reviewed by three ducks.",
  "Somewhere, a raccoon just got a promotion.",
  "The moon has been briefed on tonight's game.",
  "Statistically, this line was necessary.",
  "The committee approved this exact phrase.",
  "Seventy elbows agreed this line was fine.",
  "Local ordinance requires this exact sentence.",
  "This screen is legally a lake in three states.",
  "Your phone is now a licensed notary.",
  "This game is insured against Tuesdays.",
  "The room code is also a minor prophecy.",
  "Turnout exceeded expectations among houseplants.",
  "This line was rehearsed for eleven years.",
  "The wordmark above has tenure.",
  "This screen briefly held a seat on the council.",
  "Warranty void if room code is read aloud twice.",
  // Pure gibberish
  "Snargle plop a doodle woo",
  "Kablooey bing a dingle dop",
  "Boop de wingle fazzle dee",
  "Fwibble dabble nooga zink",
  "Yibbly zap a scronk",
  "Bibbly bobbly zoop patoop",
  "Chunka wunka fibble fee",
  "Ribbity dip a wozzle wam",
  "Wobble sprocket ninny nap",
  "Dooby scoot a wangle womp",
  "Snorf a doodle bink bonk",
  "Crinkle mop a zibba doo",
  "Womba tickle snip a zoo",
  "Plink a plonk a widdershin",
  "Fuzzle nap a boinky doo",
  "Noodly frip a bang a zoom",
  // Commotion words
  "Full-tilt kerfuffle o'clock",
  "Pandemonium, but make it cozy",
  "Bedlam, lightly seasoned",
  "Ballyhoo, hold my hullabaloo",
  "Hurly-burly, extra hurly",
  "Brouhaha with extra brouhaha",
  "Ruckus loading, please stand back",
  "Rumpus achieved, tumult pending",
  "Hullabaloo, self-inflicted",
  "Kerfuffle stacked on kerfuffle",
  "Hoopla dot exe has entered",
  "Razzmatazz with a hint of ruckus",
  "Donnybrook, snacks optional",
  "The hoopla-brouhaha alliance",
] as const;

export function randomSlogan(): string {
  return SLOGANS[Math.floor(Math.random() * SLOGANS.length)];
}
