export const SITE_URL = 'https://www.learnmatch.online'

export const PUBLIC_PAGES = {
  '/': { title: 'LearnMatch | Find the Right College Course', description: 'Explore college courses that match your strengths, interests, personality, and situation with LearnMatch assessments and personalized course guidance.' },
  '/about': { title: 'About LearnMatch | College Course Guidance', description: 'Learn how LearnMatch combines assessments and a Weighted Scoring Model to help students explore college courses and reflect on their options.' },
  '/help': { title: 'Help Center | LearnMatch', description: 'Get help with LearnMatch accounts, assessments, course recommendations, college tracking, and privacy. Find support and account settings guidance.' },
  '/privacy': { title: 'Privacy Notice | LearnMatch', description: 'Read how LearnMatch collects, uses, and protects account, assessment, and college tracking information, including your privacy and deletion options.' },
  '/terms': { title: 'Terms & Conditions | LearnMatch', description: 'Read the terms for using LearnMatch educational course guidance, assessments, course information, and AI-generated explanations.' },
  '/courses/search': { title: 'Course Catalog | LearnMatch', description: 'Search the LearnMatch course catalog by course, skill, or career to explore your college options.' },
}

export const PRERENDER_PATHS = ['/', '/about', '/help', '/privacy', '/terms']

export function getMetadata(pathname) {
  const page = PUBLIC_PAGES[pathname]
  return page ? { ...page, canonical: SITE_URL + (pathname === '/' ? '/' : pathname), robots: 'index, follow' }
    : { title: 'LearnMatch', description: 'LearnMatch student course guidance.', robots: 'noindex, follow' }
}

export const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org', '@type': 'WebSite', name: 'LearnMatch',
  url: SITE_URL + '/', description: PUBLIC_PAGES['/'].description, inLanguage: 'en',
}
