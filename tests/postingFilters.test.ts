// tests/postingFilters.test.ts
import { describe, expect, it } from "vitest";
import { applyPostingFilters } from "@/lib/postingFilters";

function fakeQuery(calls: [string, boolean | string][] = []) {
  const query = {
    calls,
    ilike(column: string, pattern: string) {
      return fakeQuery([...calls, [column, pattern]]);
    },
    eq(column: string, value: boolean | string) {
      return fakeQuery([...calls, [column, value]]);
    },
  };
  return query;
}

describe("applyPostingFilters", () => {
  it("restricts undergrad to non-PhD internships, not all non-PhD postings", () => {
    const result = applyPostingFilters(fakeQuery(), {
      company: "",
      roleType: "",
      location: "",
      keyword: "",
      level: "undergrad",
    });
    expect(result.calls).toEqual([
      ["is_phd", false],
      ["role_type", "internship"],
    ]);
  });

  it("phd level only filters is_phd", () => {
    const result = applyPostingFilters(fakeQuery(), {
      company: "",
      roleType: "",
      location: "",
      keyword: "",
      level: "phd",
    });
    expect(result.calls).toEqual([["is_phd", true]]);
  });
});
