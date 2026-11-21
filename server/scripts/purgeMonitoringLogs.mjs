import pool from '../config/db.js'
import { purgeExpiredMonitoringLogs } from '../services/assessmentMonitoringService.js'

// Manual or cron entry point. Removes only expired assessment_monitoring_logs rows.
try {
  const deleted = await purgeExpiredMonitoringLogs(pool)
  console.log(JSON.stringify({ job: 'monitoring-log-retention', deleted }))
} catch (error) {
  console.error('Monitoring log retention failed:', error.code || error.message)
  process.exitCode = 1
} finally { await pool.end() }
