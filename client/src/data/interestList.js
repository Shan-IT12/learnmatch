// Approved current Interest Assessment options across 6 groups.

const interestGroups = [
  {
    group: "Creative & Arts",
    items: [
      { name: "Drawing", primary: "A", secondary: null },
      { name: "Painting", primary: "A", secondary: null },
      { name: "Photography", primary: "A", secondary: "R" },
      { name: "Video Editing", primary: "A", secondary: "I" },
      { name: "Filmmaking", primary: "A", secondary: "I" },
      { name: "Music", primary: "A", secondary: null },
      { name: "Singing", primary: "A", secondary: null },
      { name: "Dancing", primary: "A", secondary: "S" },
      { name: "Acting / Theater", primary: "A", secondary: "S" },
    ],
  },
  {
    group: "Technology & Science",
    items: [
      { name: "Coding / Programming", primary: "I", secondary: "C" },
      { name: "Building Gadgets", primary: "R", secondary: "I" },
      { name: "Fixing Gadgets", primary: "R", secondary: "I" },
      { name: "Science Experiments", primary: "I", secondary: null },
      { name: "Mathematics / Problem Solving", primary: "I", secondary: "C" },
      { name: "Research / Reading Non-Fiction", primary: "I", secondary: null },
    ],
  },
  {
    group: "Sports & Physical",
    items: [
      { name: "Basketball", primary: "R", secondary: "S" },
      { name: "Swimming", primary: "R", secondary: null },
      { name: "Volleyball", primary: "R", secondary: "S" },
      { name: "Fitness / Working Out", primary: "R", secondary: null },
      { name: "Outdoor Activities / Hiking", primary: "R", secondary: "I" },
    ],
  },
  {
    group: "Social & Service",
    items: [
      { name: "Helping Others / Volunteering", primary: "S", secondary: null },
      { name: "Teaching / Tutoring", primary: "S", secondary: "C" },
      { name: "Public Speaking / Debate", primary: "S", secondary: "E" },
      { name: "Leading Groups / Organizations", primary: "E", secondary: "S" },
      { name: "Event Planning / Organizing", primary: "E", secondary: "C" },
    ],
  },
  {
    group: "Business & Practical",
    items: [
      { name: "Entrepreneurship / Selling", primary: "E", secondary: "C" },
      { name: "Cooking / Baking", primary: "R", secondary: "A" },
      { name: "Writing / Journalism", primary: "A", secondary: "I" },
      { name: "Law / Justice", primary: "E", secondary: "C" },
      { name: "Reading Fiction / Storytelling", primary: "A", secondary: null },
    ],
  },
  {
    group: "Nature & Environment",
    items: [
      { name: "Animals / Wildlife", primary: "R", secondary: "I" },
      { name: "Gardening / Plants", primary: "R", secondary: "I" },
      { name: "Environment / Conservation", primary: "I", secondary: "S" },
      { name: "Cooking with Local/Natural Ingredients", primary: "R", secondary: "A" },
      { name: "Travel / Exploring New Places", primary: "S", secondary: "E" },
    ],
  },
]

export const MIN_INTEREST_SELECTIONS = 3
export const MAX_INTEREST_SELECTIONS = 10

export function updateInterestSelection(selected, name) {
  if (selected.includes(name)) {
    return { selected: selected.filter((interest) => interest !== name), maxReached: false }
  }

  if (selected.length >= MAX_INTEREST_SELECTIONS) {
    return { selected, maxReached: true }
  }

  return { selected: [...selected, name], maxReached: false }
}

export default interestGroups
