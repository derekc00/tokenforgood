import { getDataService } from '@/lib/services'
import { HomeClient } from './home-client'

export default async function HomePage() {
  const ds = getDataService()

  const [tasksResult, templates, stats, activities] = await Promise.all([
    ds.getTasks(),
    ds.getTemplates(),
    ds.getPlatformStats(),
    ds.getActivityFeed(25),
  ])

  return (
    <HomeClient
      tasks={tasksResult.data}
      templates={templates}
      stats={stats}
      activities={activities}
      topDonors={stats.top_donors_this_week.slice(0, 5)}
    />
  )
}
