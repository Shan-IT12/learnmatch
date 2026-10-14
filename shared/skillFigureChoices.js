// Presentation metadata only. This module deliberately contains no answer keys.
// Match the full question/choice signature, never a guessed database row ID.
const figure = (name, description) => ({ src: `/images/quiz/choices/${name}.svg`, description })
const shapes = {
  triangle: figure('triangle', 'Outline triangle'),
  circle: figure('circle', 'Outline circle'),
  square: figure('square', 'Outline square'),
  diamond: figure('rhombus', 'Outline rhombus'),
  rectangle: figure('rectangle', 'Outline rectangle, twice as wide as it is tall'),
  hexagon: figure('hexagon', 'Outline hexagon'),
  octagon: figure('octagon', 'Outline octagon'),
  filledSquare: figure('filled-square', 'Solid square'),
  filledCircle: figure('filled-circle', 'Solid circle'),
  up: figure('arrow-up', 'Arrow pointing up'),
  right: figure('arrow-right', 'Arrow pointing right'),
  down: figure('arrow-down', 'Arrow pointing down'),
  left: figure('arrow-left', 'Arrow pointing left'),
  cube: figure('cube', 'Line drawing of a cube'),
  pyramid: figure('pyramid', 'Line drawing of a square-based pyramid'),
  cylinder: figure('cylinder', 'Line drawing of a cylinder'),
  cone: figure('cone', 'Line drawing of a cone'),
}

export const SKILL_FIGURE_ITEMS = [
  {
    itemNumber: '3.3', dimension: 'Abstract/Logical',
    questionText: 'Look at the figure. Each shape gains one more side than the last: Triangle → Square → Pentagon → ___. Which shape completes the sequence?',
    texts: ['Hexagon', 'Circle', 'Triangle', 'Octagon'],
    figures: [shapes.hexagon, shapes.circle, shapes.triangle, shapes.octagon],
    promptAlt: 'Sequence showing an outline triangle, square, pentagon, and a blank.',
    promptMinWidth: 520,
  },
  {
    itemNumber: '3.6', dimension: 'Abstract/Logical',
    questionText: 'Look at the figure. The shapes repeat in a group of 2 circles followed by 3 triangles. What comes next?',
    texts: ['Circle', 'Triangle', 'Square', 'Diamond'],
    figures: [shapes.circle, shapes.triangle, shapes.square, shapes.diamond],
    promptAlt: 'Two groups of two circles and three triangles, followed by one circle and a blank.',
    // Keep wide sequences legible on phones; allow horizontal scrolling.
    promptMinWidth: 600,
  },
  {
    itemNumber: '3.8', dimension: 'Abstract/Logical',
    questionText: 'Look at the figure. An arrow rotates 90 degrees clockwise at each step: up, right, down, ___. Which direction comes next?',
    texts: ['Upward arrow', 'Rightward arrow', 'Downward arrow', 'Leftward arrow'],
    figures: [shapes.up, shapes.right, shapes.down, shapes.left],
    promptAlt: 'Sequence of arrows pointing up, right, and down, followed by a blank.',
    promptMinWidth: 420,
  },
  {
    itemNumber: '3.10', dimension: 'Abstract/Logical',
    questionText: 'Look at the figure. In each row, the right shape is a filled-in version of the left shape. Which figure belongs in the blank?',
    texts: ['Filled square', 'Empty square', 'Filled circle', 'Empty triangle'],
    figures: [shapes.filledSquare, shapes.square, shapes.filledCircle, shapes.triangle],
    promptAlt: 'Two-by-two grid: outline circle, solid circle; outline square, blank.',
  },
  {
    itemNumber: '3.13', dimension: 'Abstract/Logical',
    questionText: 'Look at the four figures (A–D). Which one is the odd one out based on its number of sides?',
    texts: ['Square (A)', 'Rectangle (B)', 'Triangle (C)', 'Rhombus (D)'],
    figures: [shapes.square, shapes.rectangle, shapes.triangle, shapes.diamond],
    // These figures now live in the selectable A-D cards, not a duplicate strip.
    promptImage: null,
  },
  {
    itemNumber: '4.1', dimension: 'Spatial',
    questionText: 'If you rotate the letter "F" 180 degrees, which orientation would it show?',
    texts: ['Upside-down and mirrored', 'Same as original', 'Mirrored only', 'Upside-down only'],
    figures: [
      figure('f-a', 'Block letter with a right vertical stem and two bars extending left near the bottom'),
      figure('f-b', 'Block letter with a left vertical stem and two bars extending right near the top'),
      figure('f-c', 'Block letter with a right vertical stem and two bars extending left near the top'),
      figure('f-d', 'Block letter with a left vertical stem and two bars extending right near the bottom'),
    ],
    promptImage: '/images/quiz/choices/f-b.svg', promptAlt: 'Reference: upright block letter F.',
  },
  {
    itemNumber: '4.5', dimension: 'Spatial',
    questionText: 'Which 3D shape would you get if you fold a net consisting of one square and four triangles attached to each side?',
    texts: ['Cube', 'Pyramid', 'Cylinder', 'Cone'],
    figures: [shapes.cube, shapes.pyramid, shapes.cylinder, shapes.cone],
    promptImage: '/images/quiz/choices/square-pyramid-net.svg',
    promptAlt: 'A square with one triangle attached to each of its four sides. Dashed lines mark folds.',
  },
  {
    itemNumber: '4.7', dimension: 'Spatial',
    questionText: 'A cube is sliced straight through, parallel to one of its faces. What shape is the newly exposed cross-section?',
    texts: ['Square', 'Circle', 'Triangle', 'Rectangle (non-square)'],
    figures: [shapes.square, shapes.circle, shapes.triangle, shapes.rectangle],
  },
  {
    itemNumber: '4.10', dimension: 'Spatial',
    questionText: 'A rectangular room is twice as long as it is wide. How would you best describe the shape of its perimeter (outline)?',
    texts: ['A square', 'A triangle', 'A rectangle', 'A circle'],
    figures: [shapes.square, shapes.triangle, shapes.rectangle, shapes.circle],
  },
  {
    itemNumber: '4.11', dimension: 'Spatial',
    questionText: 'If you view a cylinder directly from the top, what 2D shape do you see?',
    texts: ['Rectangle', 'Triangle', 'Square', 'Circle'],
    figures: [shapes.rectangle, shapes.triangle, shapes.square, shapes.circle],
  },
]

export function getSkillFigurePresentation(question) {
  return SKILL_FIGURE_ITEMS.find((item) => (
    question.dimension === item.dimension && question.question_text === item.questionText
    && item.texts.every((text, index) => question[`choice_${'abcd'[index]}`] === text)
  )) || null
}
