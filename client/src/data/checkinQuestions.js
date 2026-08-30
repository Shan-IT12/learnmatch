// 5-question alignment survey, reworded per phase (Early/Mid/End) but all
// measuring the same 5 dimensions. See "LearnMatch_Semester_Checkin_Final.pdf"
// for sources and full methodology.

export const checkinQuestions = {
  Early: [
    { number: 1, dimension: 'Interest-Major Fit', text: "So far, this course feels like something I actually enjoy." },
    { number: 2, dimension: 'Demands-Abilities Fit', text: "The workload and difficulty so far feel manageable for me." },
    { number: 3, dimension: 'Needs-Supplies Fit', text: "I'm getting the support and resources I need to get started." },
    { number: 4, dimension: 'Career / Forward-Looking Fit', text: "I can already picture how this leads to the career I want." },
    { number: 5, dimension: 'Overall Satisfaction', text: "If I'm being honest, I'm glad I picked this course so far." },
  ],
  Mid: [
    { number: 1, dimension: 'Interest-Major Fit', text: "At this point in the semester, this course still feels like a good fit for me." },
    { number: 2, dimension: 'Demands-Abilities Fit', text: "I'm keeping up okay with how hard the coursework has gotten." },
    { number: 3, dimension: 'Needs-Supplies Fit', text: "I'm getting enough support (profs, resources, classmates) to keep going." },
    { number: 4, dimension: 'Career / Forward-Looking Fit', text: "The more I learn, the more I can see myself doing this as a career." },
    { number: 5, dimension: 'Overall Satisfaction', text: "Looking back at the semester so far, I don't regret choosing this course." },
  ],
  End: [
    { number: 1, dimension: 'Interest-Major Fit', text: "Looking back at this whole semester, this course really fit what I enjoy." },
    { number: 2, dimension: 'Demands-Abilities Fit', text: "I was able to handle the workload and difficulty by the end of the semester." },
    { number: 3, dimension: 'Needs-Supplies Fit', text: "I felt supported (resources, teachers, classmates) throughout the semester." },
    { number: 4, dimension: 'Career / Forward-Looking Fit', text: "This semester made me more confident this leads to the career I want." },
    { number: 5, dimension: 'Overall Satisfaction', text: "If I could go back, I'd choose this course again." },
  ],
}

export const checkinScale = [
  { value: 1, label: 'Not true for me at all' },
  { value: 2, label: 'Somewhat untrue' },
  { value: 3, label: 'Neutral / Not sure' },
  { value: 4, label: 'Somewhat true' },
  { value: 5, label: 'Completely true for me' },
]