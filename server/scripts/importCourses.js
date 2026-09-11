import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importCourses() {
  let connection;

  try {
    const filePath = path.join(
      __dirname,
      "../data/learnmatch_courses_final_342_with_ids.json"
    );

    const rawData = fs.readFileSync(filePath, "utf8");
    const jsonData = JSON.parse(rawData);

    if (!Array.isArray(jsonData.courses)) {
      throw new Error('Invalid JSON: "courses" array not found.');
    }

    console.log(`Found ${jsonData.courses.length} courses.`);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (const course of jsonData.courses) {
      const obtainableSkills = Array.isArray(course.obtainable_skills)
        ? course.obtainable_skills.join("\n")
        : null;

      await connection.execute(
        `
        INSERT INTO COURSE (
          course_code,
          course_name,
          course_abbreviation,
          program_type,
          cluster_category,
          psced_group,
          description,
          obtainable_skills,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          course.course_id,
          course.course_name,
          course.course_abbreviation || null,
          null,
          course.parent_cluster,
          null,
          course.course_description || null,
          obtainableSkills,
          1,
        ]
      );

      console.log(`Imported ${course.course_id} - ${course.course_name}`);
    }

    await connection.commit();

    console.log("\n====================================");
    console.log("Course import completed successfully!");
    console.log(`Total imported: ${jsonData.courses.length}`);
    console.log("====================================");

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("\nImport failed:");
    console.error(error);

  } finally {
    if (connection) {
      connection.release();
    }

    process.exit();
  }
}

importCourses();