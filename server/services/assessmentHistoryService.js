import { toDisplayPercent } from './recommendationService.js'

function shapeItem(row) {
  return {
    rank_position: Number(row.rank_position),
    course_id: row.course_id,
    course_code: row.course_code,
    course_name: row.course_name,
    course_abbreviation: row.course_abbreviation,
    cluster_category: row.cluster_category,
    match_score: toDisplayPercent(Number(row.match_score)),
    score_breakdown: {
      skill_match: toDisplayPercent(Number(row.skill_match)),
      interest_match: toDisplayPercent(Number(row.interest_match)),
      personality_match: toDisplayPercent(Number(row.personality_match)),
      personal_factor_match: toDisplayPercent(Number(row.personal_factor_match)),
    },
    ai_narrative: row.ai_narrative ?? null,
  }
}

async function getCompletedSnapshotRows(database, userId, recommendationId = null) {
  const params = [userId]
  const recommendationFilter = recommendationId === null ? '' : ' AND r.recommendation_id = ?'
  if (recommendationId !== null) params.push(recommendationId)

  const [rows] = await database.query(
    `SELECT r.recommendation_id, r.assessment_id, r.generated_at,
            pa.mbti_type, pa.score_ei, pa.score_ns, pa.score_tf, pa.score_jp,
            ri.rank_position, ri.match_score, ri.skill_match, ri.interest_match,
            ri.personality_match, ri.personal_factor_match, ri.ai_narrative,
            c.course_id, c.course_code, c.course_name, c.course_abbreviation,
            c.cluster_category
     FROM RECOMMENDATION r
     JOIN PERSONALITY_ASSESSMENT pa
       ON pa.assessment_id = r.assessment_id AND pa.user_id = r.user_id
     JOIN (
       SELECT recommendation_id
       FROM RECOMMENDATION_ITEM
       GROUP BY recommendation_id
       HAVING COUNT(*) = 3
          AND COUNT(DISTINCT rank_position) = 3
          AND MIN(rank_position) = 1
          AND MAX(rank_position) = 3
          AND SUM(rank_position) = 6
     ) completed ON completed.recommendation_id = r.recommendation_id
     JOIN RECOMMENDATION_ITEM ri ON ri.recommendation_id = r.recommendation_id
     JOIN COURSE c ON c.course_id = ri.course_id
     WHERE r.user_id = ?${recommendationFilter}
     ORDER BY r.generated_at ASC, r.recommendation_id ASC, ri.rank_position ASC`,
    params
  )
  return rows
}

function groupSnapshots(rows) {
  const snapshots = []
  for (const row of rows) {
    let snapshot = snapshots.at(-1)
    if (!snapshot || snapshot.recommendation_id !== row.recommendation_id) {
      snapshot = {
        recommendation_id: row.recommendation_id,
        assessment_id: row.assessment_id,
        generated_at: row.generated_at,
        mbti: {
          type: row.mbti_type,
          scores: {
            EI: Number(row.score_ei),
            NS: Number(row.score_ns),
            TF: Number(row.score_tf),
            JP: Number(row.score_jp),
          },
        },
        recommendations: [],
      }
      snapshots.push(snapshot)
    }
    snapshot.recommendations.push(shapeItem(row))
  }

  return snapshots.filter(({ recommendations }) => recommendations.length === 3)
}

export async function getAssessmentHistory(database, userId) {
  const snapshots = groupSnapshots(await getCompletedSnapshotRows(database, userId))
  const numbered = snapshots.map((snapshot, index) => ({
    ...snapshot,
    attempt_number: index + 1,
  }))
  return numbered.reverse()
}

export async function getAssessmentHistoryDetail(database, userId, recommendationId) {
  if (!Number.isInteger(Number(recommendationId)) || Number(recommendationId) <= 0) return null

  const history = await getAssessmentHistory(database, userId)
  return history.find(
    (snapshot) => Number(snapshot.recommendation_id) === Number(recommendationId)
  ) ?? null
}

