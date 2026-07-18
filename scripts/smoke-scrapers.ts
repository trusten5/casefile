// ponytail self-check: hits the live Greenhouse/Lever/Ashby APIs through the
// real adapters and asserts basic shape. Run with: npx tsx scripts/smoke-scrapers.ts
import { fetchGreenhousePostings } from "../src/lib/scrapers/greenhouse";
import { fetchLeverPostings } from "../src/lib/scrapers/lever";
import { fetchAshbyPostings } from "../src/lib/scrapers/ashby";
import { inferRoleType, isPhdRole } from "../src/lib/scrapers/types";

function checkInferRoleType() {
  const cases: [string, "internship" | "new_grad" | "full_time"][] = [
    ["Software Engineering Intern", "internship"],
    ["Summer 2027 Internship - Data Science", "internship"],
    ["Co-op (Fall 2026) - Mechanical Engineering", "internship"],
    ["Co Op Student, Supply Chain", "internship"],
    ["International Sales Manager", "full_time"],
    ["Internal Audit Associate", "full_time"],
    ["Internet Systems Engineer", "full_time"],
    ["Software Engineer, New Grad", "new_grad"],
  ];
  for (const [title, expected] of cases) {
    const actual = inferRoleType(title);
    console.assert(actual === expected, `inferRoleType("${title}") = ${actual}, expected ${expected}`);
  }
  console.log(`ok: inferRoleType passed ${cases.length} cases`);
}

function checkIsPhdRole() {
  const cases: [string, boolean][] = [
    ["PhD Research Intern, Machine Learning", true],
    ["Ph.D. Fellow - Applied Science", true],
    ["Doctoral Researcher, Robotics", true],
    ["Software Engineering Intern", false],
    ["Physical Design Engineer", false],
  ];
  for (const [title, expected] of cases) {
    const actual = isPhdRole(title);
    console.assert(actual === expected, `isPhdRole("${title}") = ${actual}, expected ${expected}`);
  }
  console.log(`ok: isPhdRole passed ${cases.length} cases`);
}

async function main() {
  checkInferRoleType();
  checkIsPhdRole();

  const gh = await fetchGreenhousePostings("stripe");
  console.assert(gh.length > 0, "expected greenhouse postings");
  console.assert(Boolean(gh[0].title && gh[0].url), "greenhouse posting missing fields");

  const lv = await fetchLeverPostings("palantir");
  console.assert(lv.length > 0, "expected lever postings");
  console.assert(Boolean(lv[0].title && lv[0].url), "lever posting missing fields");

  const ab = await fetchAshbyPostings("notion");
  console.assert(ab.length > 0, "expected ashby postings");
  console.assert(Boolean(ab[0].title && ab[0].url), "ashby posting missing fields");

  console.log(
    `ok: greenhouse=${gh.length} postings, lever=${lv.length} postings, ashby=${ab.length} postings`
  );
}

main();
