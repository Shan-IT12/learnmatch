const MANILA_TIME_ZONE = 'Asia/Manila'

export function getPhilippineDateTime(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date))

  let greeting = 'Good Evening'
  if (hour >= 5 && hour < 12) greeting = 'Good Morning'
  else if (hour >= 12 && hour < 18) greeting = 'Good Afternoon'

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)

  return { greeting, formattedDate }
}
