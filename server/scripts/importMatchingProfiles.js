import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importMatchingProfiles() {
  let connection;

  try {
    const filePath = path.join(
      __dirname,
      "../data/learnmatch_course_matching_profiles_final_342_with_ids.json"
    );

    const rawData = fs.readFileSync(filePath, "utf8");
    const jsonData = JSON.parse(rawData);

    const profiles =
      jsonData.courses ||
      jsonData.profiles ||
      jsonData.course_matching_profiles ||
      (Array.isArray(jsonData) ? jsonData : null);

    if (!Array.isArray(profiles)) {
      throw new Error("Could not find matching profiles array in JSON.");
    }

    console.log(`Found ${profiles.length} matching profiles.`);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (const profile of profiles) {
      const [courseRows] = await connection.execute(
        `
        SELECT course_id
        FROM COURSE
        WHERE course_code = ?
        LIMIT 1
        `,
        [profile.course_id]
      );

      if (courseRows.length === 0) {
        throw new Error(
          `No course found for matching profile ${profile.course_id}`
        );
      }

      const internalCourseId = courseRows[0].course_id;

      if (Array.isArray(profile.skills_profile)) {
        for (const skill of profile.skills_profile) {
          await connection.execute(
            `
            INSERT INTO COURSE_SKILL_PROFILE (
              course_id,
              skill_domain,
              weight,
              evidence
            )
            VALUES (?, ?, ?, ?)
            `,
            [
              internalCourseId,
              skill.skill,
              skill.weight,
              skill.evidence || null,
            ]
          );
        }
      }

      if (profile.riasec_profile) {
        for (const riasecType of ["R", "I", "A", "S", "E", "C"]) {
          const riasecData = profile.riasec_profile[riasecType];

          if (!riasecData) {
            continue;
          }

          await connection.execute(
            `
            INSERT INTO COURSE_RIASEC_PROFILE (
              course_id,
              riasec_type,
              weight,
              evidence
            )
            VALUES (?, ?, ?, ?)
            `,
            [
              internalCourseId,
              riasecType,
              riasecData.weight,
              riasecData.evidence || null,
            ]
          );
        }
      }

      console.log(`Imported matching profile for ${profile.course_id}`);
    }

    await connection.commit();

    console.log("\nMatching profile import completed!");
    console.log(`Total course profiles processed: ${profiles.length}`);
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("\nMatching profile import failed:");
    console.error(error);
  } finally {
    if (connection) {
      connection.release();
    }

    process.exit();
  }
}

importMatchingProfiles();