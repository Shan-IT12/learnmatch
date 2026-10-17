// Read-only bundled CRS001 snapshot plus explicitly new tutorial explanations.
export const draftCourseExample = {
  "courseCode": "CRS001",
  "profileName": "Bachelor of Management Accounting",
  "catalogName": "Bachelor of Science in Management Accounting",
  "abbreviation": "BSMA",
  "cluster": "BUSINESS CLUSTER",
  "profileFile": "server/data/learnmatch_course_matching_profiles_final_342_with_ids.json",
  "catalogFile": "server/data/learnmatch_courses_final_342_with_ids.json",
  "source": {
    "title": "CMO No. 28, series of 2017",
    "url": "https://legacy.ched.gov.ph/wp-content/uploads/2017/10/CMO-28-s-2017.pdf",
    "pageCount": 31
  },
  "rows": [
    {
      "dimension": "Verbal",
      "group": "Skill",
      "weight": 2,
      "evidence": "Supported by obtainable skills: Professional communication.",
      "recordReference": "skills_profile[0].evidence"
    },
    {
      "dimension": "Numerical",
      "group": "Skill",
      "weight": 3,
      "evidence": "Supported by obtainable skills: Management accounting, Financial accounting and reporting, Cost accounting and cost analysis.",
      "recordReference": "skills_profile[1].evidence"
    },
    {
      "dimension": "I - Investigative",
      "group": "RIASEC",
      "weight": 3,
      "evidence": "Reflected in obtainable skills: Cost accounting and cost analysis, Budget preparation and analysis, Financial analysis.",
      "recordReference": "riasec_profile.I.evidence"
    },
    {
      "dimension": "E - Enterprising",
      "group": "RIASEC",
      "weight": 3,
      "evidence": "Reflected in obtainable skills: Management accounting, Business and financial decision-making.",
      "recordReference": "riasec_profile.E.evidence"
    }
  ],
  "historicalNote": "The supplied prompt documents a relevance rubric, but does not prove how each historical weight was assigned or generated. Original assignment-specific explanations/page links, reviewer/date and expert approval remain Not documented in the inspected project records. Tutorial explanations are newly written illustrations.",
  "tutorials": [
    {
      "dimension": "Verbal",
      "group": "Skill",
      "page": 6,
      "section": "Section 6.1, outcome 2",
      "passage": "effectively communicate orally and in writing",
      "relationship": "Oral and written communication relate to Verbal, which the prompt links to oral/written comprehension and expression (page 2).",
      "rubricValue": 2,
      "application": "Illustratively, Medium (2) fits communication that is frequently used but is not the main accounting focus described in section 5.2 (page 3). This is a new explanation; the existing profile also records 2."
    },
    {
      "dimension": "Numerical",
      "group": "Skill",
      "page": 3,
      "section": "Section 5.2, Nature of the Field of Study",
      "passage": "apply accounting and finance skills",
      "relationship": "The bundled facts list cost analysis, budgeting and financial analysis. These require working with numbers, relating to Numerical and its mathematical-reasoning reference (prompt page 2).",
      "rubricValue": 3,
      "application": "Illustratively, High (3) fits a core accounting/finance focus rather than a minor activity. The existing profile records 3; this tutorial does not establish the original author's rationale."
    },
    {
      "dimension": "I - Investigative",
      "group": "RIASEC",
      "page": 7,
      "section": "Section 6.3, outcome 2",
      "passage": "conduct management accounting research",
      "relationship": "Research and the bundled financial-analysis skills relate to Investigative, defined by analysis, research and problem-solving (prompt page 3).",
      "rubricValue": 3,
      "application": "Illustratively, High (3) is supported when analysis is central to the program, considering the field description and outcomes together. A single mention of research alone is not enough. The existing profile records 3."
    },
    {
      "dimension": "E - Enterprising",
      "group": "RIASEC",
      "page": 3,
      "section": "Section 5.2, Nature of the Field of Study",
      "passage": null,
      "sourceSummary": "The section describes management decision-making, planning, performance management and financial reporting/control.",
      "relationship": "The bundled profile cites management accounting and business decision-making. Management, business and decision-making are explicitly included in Enterprising (prompt page 3).",
      "rubricValue": 3,
      "application": "Illustratively, High (3) fits management decision-making as a core program focus. This example applies the documented rubric now; it does not certify why the historical Enterprising=3 was assigned."
    }
  ]
}
