export const CURRENT_INTEREST_RIASEC_MAP = Object.freeze({
  Drawing: Object.freeze({ primary: 'A', secondary: null }),
  Painting: Object.freeze({ primary: 'A', secondary: null }),
  Photography: Object.freeze({ primary: 'A', secondary: 'R' }),
  'Video Editing': Object.freeze({ primary: 'A', secondary: 'I' }),
  Filmmaking: Object.freeze({ primary: 'A', secondary: 'I' }),
  Music: Object.freeze({ primary: 'A', secondary: null }),
  Singing: Object.freeze({ primary: 'A', secondary: null }),
  Dancing: Object.freeze({ primary: 'A', secondary: 'S' }),
  'Acting / Theater': Object.freeze({ primary: 'A', secondary: 'S' }),
  'Coding / Programming': Object.freeze({ primary: 'I', secondary: 'C' }),
  'Building Gadgets': Object.freeze({ primary: 'R', secondary: 'I' }),
  'Fixing Gadgets': Object.freeze({ primary: 'R', secondary: 'I' }),
  'Science Experiments': Object.freeze({ primary: 'I', secondary: null }),
  'Mathematics / Problem Solving': Object.freeze({ primary: 'I', secondary: 'C' }),
  'Research / Reading Non-Fiction': Object.freeze({ primary: 'I', secondary: null }),
  Basketball: Object.freeze({ primary: 'R', secondary: 'S' }),
  Swimming: Object.freeze({ primary: 'R', secondary: null }),
  Volleyball: Object.freeze({ primary: 'R', secondary: 'S' }),
  'Fitness / Working Out': Object.freeze({ primary: 'R', secondary: null }),
  'Outdoor Activities / Hiking': Object.freeze({ primary: 'R', secondary: 'I' }),
  'Helping Others / Volunteering': Object.freeze({ primary: 'S', secondary: null }),
  'Teaching / Tutoring': Object.freeze({ primary: 'S', secondary: 'C' }),
  'Public Speaking / Debate': Object.freeze({ primary: 'S', secondary: 'E' }),
  'Leading Groups / Organizations': Object.freeze({ primary: 'E', secondary: 'S' }),
  'Event Planning / Organizing': Object.freeze({ primary: 'E', secondary: 'C' }),
  'Entrepreneurship / Selling': Object.freeze({ primary: 'E', secondary: 'C' }),
  'Cooking / Baking': Object.freeze({ primary: 'R', secondary: 'A' }),
  'Writing / Journalism': Object.freeze({ primary: 'A', secondary: 'I' }),
  'Law / Justice': Object.freeze({ primary: 'E', secondary: 'C' }),
  'Reading Fiction / Storytelling': Object.freeze({ primary: 'A', secondary: null }),
  'Animals / Wildlife': Object.freeze({ primary: 'R', secondary: 'I' }),
  'Gardening / Plants': Object.freeze({ primary: 'R', secondary: 'I' }),
  'Environment / Conservation': Object.freeze({ primary: 'I', secondary: 'S' }),
  'Cooking with Local/Natural Ingredients': Object.freeze({ primary: 'R', secondary: 'A' }),
  'Travel / Exploring New Places': Object.freeze({ primary: 'S', secondary: 'E' }),
})

export const HISTORICAL_INTEREST_RIASEC_MAP = Object.freeze({
  'Video Editing / Filmmaking': Object.freeze({ primary: 'A', secondary: 'I' }),
  'Music / Singing': Object.freeze({ primary: 'A', secondary: null }),
  'Dancing / Performing Arts': Object.freeze({ primary: 'A', secondary: 'S' }),
  'Building / Fixing Gadgets': Object.freeze({ primary: 'R', secondary: 'I' }),
})

export const INTEREST_RIASEC_MAP = Object.freeze({
  ...CURRENT_INTEREST_RIASEC_MAP,
  ...HISTORICAL_INTEREST_RIASEC_MAP,
})

export const PRIMARY_INTEREST_CONTRIBUTION = 1
export const SECONDARY_INTEREST_CONTRIBUTION = 0.5
